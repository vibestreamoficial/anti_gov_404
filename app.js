// ==================== SUPABASE CLIENT ====================
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==================== BOT DE MODERAÇÃO ====================
const BANNED_PATTERNS = [
  /ameaça|ameaçar|vou te matar|te mato|explodir|bomba/i,
  /fake news|notícia falsa|mentira sobre/i,
  /acusação falsa|calúnia|difamação/i,
  /gore|sangue real|vídeo de morte|snuff/i,
  /porn|sexo explícito|nudes de menor|\bcp\b/i,
  /drogas ilegais|vender coca|vender maconha/i,
  /hackear banco|clonar cartão|golpe pix|phishing/i,
  /terrorismo|atentado/i
];

function isSuspicious(text) {
  return BANNED_PATTERNS.some(re => re.test(text));
}

// ==================== STATE ====================
let currentUser = null;   // auth user
let currentProfile = null; // profiles row
let messagesChannel = null;
let profilesChannel = null;
let applicationsChannel = null;
let authMode = 'login'; // 'login' | 'register'

// ==================== TELAS ====================
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('screen-' + name);
  if (el) el.classList.add('active');
}

function switchAuthTab(mode) {
  authMode = mode;
  document.getElementById('tab-login').classList.toggle('active', mode === 'login');
  document.getElementById('tab-register').classList.toggle('active', mode === 'register');
  document.getElementById('nick-field').classList.toggle('hidden', mode === 'login');
  document.getElementById('register-extra').classList.toggle('hidden', mode === 'login');
  document.getElementById('auth-title').textContent = mode === 'login' ? 'Entrar' : 'Cadastrar';
  document.getElementById('auth-sub').textContent = mode === 'login' ? 'Use e-mail e senha' : 'Crie sua conta e solicite acesso';
  document.getElementById('auth-btn').textContent = mode === 'login' ? 'Entrar' : 'Cadastrar e Solicitar';
  document.getElementById('auth-error').classList.add('hidden');
}

// ==================== AUTH ====================
async function handleAuth(e) {
  e.preventDefault();
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const errorEl = document.getElementById('auth-error');
  errorEl.classList.add('hidden');

  try {
    if (authMode === 'login') {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await afterAuth(data.user);
    } else {
      const nick = document.getElementById('auth-nick').value.trim();
      const reason = document.getElementById('auth-reason').value.trim();
      const how = document.getElementById('auth-how').value.trim();

      if (!nick || nick.length < 3) throw new Error('Nick deve ter pelo menos 3 caracteres');
      if (!reason || reason.length < 10) throw new Error('Motivo deve ter pelo menos 10 caracteres');

      // Verificar se nick já existe
      const { data: existing } = await supabase.from('profiles').select('id').eq('nick', nick).maybeSingle();
      if (existing) throw new Error('Este nick já está em uso');

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { nick } }
      });
      if (error) throw error;

      // Aguardar trigger criar o profile
      await new Promise(r => setTimeout(r, 800));

      // Atualizar profile e criar application
      if (data.user) {
        await supabase.from('profiles').update({ nick }).eq('id', data.user.id);
        await supabase.from('applications').insert({
          user_id: data.user.id,
          nick,
          reason,
          how: how || null,
          status: 'pending'
        });
      }

      alert('Conta criada! Aguarde um administrador aprovar seu acesso.');
      await afterAuth(data.user);
    }
  } catch (err) {
    errorEl.textContent = err.message || 'Erro ao autenticar';
    errorEl.classList.remove('hidden');
  }
}

async function afterAuth(user) {
  if (!user) return;
  currentUser = user;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error || !profile) {
    alert('Perfil não encontrado. Tente novamente.');
    await logout();
    return;
  }

  currentProfile = profile;

  if (profile.status === 'banned') {
    document.getElementById('ban-reason-text').textContent = 'Motivo: ' + (profile.ban_reason || 'Violação das regras');
    showScreen('banned');
    return;
  }

  if (profile.status === 'pending') {
    document.getElementById('pending-nick').textContent = profile.nick;
    showScreen('pending');
    // Escutar aprovação em tempo real
    subscribeProfileChanges();
    return;
  }

  // Aprovado → entrar no chat
  enterChat();
}

async function logout() {
  unsubscribeAll();
  await supabase.auth.signOut();
  currentUser = null;
  currentProfile = null;
  document.getElementById('admin-panel').classList.add('hidden');
  showScreen('home');
}

// ==================== CHAT ====================
async function enterChat() {
  showScreen('chat');
  document.getElementById('user-nick').textContent = currentProfile.nick;

  const roleEl = document.getElementById('user-role');
  roleEl.textContent = currentProfile.role;
  roleEl.className = 'badge ' + currentProfile.role;

  const btnAdmin = document.getElementById('btn-admin');
  if (currentProfile.role === 'admin' || currentProfile.role === 'owner') {
    btnAdmin.style.display = 'inline-block';
  } else {
    btnAdmin.style.display = 'none';
  }

  const ownerSec = document.getElementById('owner-section');
  if (currentProfile.role === 'owner') {
    ownerSec.classList.remove('hidden');
  } else {
    ownerSec.classList.add('hidden');
  }

  await loadMessages();
  subscribeMessages();
  subscribeProfileChanges();
  if (currentProfile.role === 'admin' || currentProfile.role === 'owner') {
    await renderAdminLists();
    subscribeApplications();
  }
}

async function loadMessages() {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(200);

  if (error) {
    console.error(error);
    return;
  }
  renderMessages(data || []);
}

function renderMessages(list) {
  const box = document.getElementById('messages');
  box.innerHTML = '';

  list.forEach(m => {
    if (m.type === 'system') {
      const div = document.createElement('div');
      div.className = 'system-msg';
      div.textContent = m.text;
      box.appendChild(div);
      return;
    }

    const div = document.createElement('div');
    div.className = 'msg' + (currentProfile && m.nick === currentProfile.nick ? ' own' : '');

    const isMod = currentProfile && (currentProfile.role === 'admin' || currentProfile.role === 'owner');
    let roleClass = '';
    if (m.role === 'admin') roleClass = 'admin';
    if (m.role === 'owner') roleClass = 'owner';

    div.innerHTML = `
      <div class="meta">
        <span class="author ${roleClass}">${escapeHtml(m.nick)}${m.role === 'admin' || m.role === 'owner' ? ' • ' + m.role : ''}</span>
        <span>${formatTime(m.created_at)}</span>
        ${isMod ? `<button class="delete-btn" onclick="deleteMessage('${m.id}')">apagar</button>` : ''}
      </div>
      <div class="text">${m.type === 'image' ? '' : escapeHtml(m.text)}</div>
      ${m.type === 'image' ? `<img src="${m.text}" alt="foto" />` : ''}
    `;
    box.appendChild(div);
  });

  box.scrollTop = box.scrollHeight;
}

async function sendMessage() {
  if (!currentProfile || currentProfile.status !== 'approved') return;
  const input = document.getElementById('msg-input');
  const text = input.value.trim();
  if (!text) return;

  // Bot de moderação
  if (isSuspicious(text)) {
    await banUser(currentProfile.id, currentProfile.nick, 'Mensagem detectada como ameaça / conteúdo proibido pelo bot de moderação.');
    return;
  }

  const { error } = await supabase.from('messages').insert({
    user_id: currentProfile.id,
    nick: currentProfile.nick,
    role: currentProfile.role,
    text,
    type: 'text'
  });

  if (error) {
    alert('Erro ao enviar: ' + error.message);
    return;
  }
  input.value = '';
}

async function sendPhoto(e) {
  const file = e.target.files[0];
  if (!file || !currentProfile) return;

  if (file.size > 1.5 * 1024 * 1024) {
    alert('Imagem muito grande (máx ~1.5 MB).');
    return;
  }

  if (isSuspicious(file.name)) {
    await banUser(currentProfile.id, currentProfile.nick, 'Arquivo suspeito detectado pelo bot.');
    return;
  }

  const reader = new FileReader();
  reader.onload = async function(ev) {
    const base64 = ev.target.result;
    const { error } = await supabase.from('messages').insert({
      user_id: currentProfile.id,
      nick: currentProfile.nick,
      role: currentProfile.role,
      text: base64,
      type: 'image'
    });
    if (error) alert('Erro ao enviar foto: ' + error.message);
  };
  reader.readAsDataURL(file);
  e.target.value = '';
}

async function deleteMessage(id) {
  if (!currentProfile || (currentProfile.role !== 'admin' && currentProfile.role !== 'owner')) return;
  await supabase.from('messages').delete().eq('id', id);
}

async function clearChat() {
  if (!confirm('Limpar todas as mensagens?')) return;
  // Apaga todas e recria a de sistema
  await supabase.from('messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('messages').insert({
    nick: 'Sistema',
    role: 'system',
    text: 'Chat limpo por um administrador.',
    type: 'system'
  });
}

// ==================== REALTIME ====================
function subscribeMessages() {
  if (messagesChannel) supabase.removeChannel(messagesChannel);
  messagesChannel = supabase
    .channel('messages-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, async () => {
      await loadMessages();
    })
    .subscribe();
}

function subscribeProfileChanges() {
  if (profilesChannel) supabase.removeChannel(profilesChannel);
  profilesChannel = supabase
    .channel('profile-changes')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'profiles',
      filter: `id=eq.${currentUser.id}`
    }, async (payload) => {
      currentProfile = payload.new;
      if (currentProfile.status === 'approved') {
        enterChat();
      } else if (currentProfile.status === 'banned') {
        document.getElementById('ban-reason-text').textContent = 'Motivo: ' + (currentProfile.ban_reason || 'Violação das regras');
        showScreen('banned');
      }
    })
    .subscribe();
}

function subscribeApplications() {
  if (applicationsChannel) supabase.removeChannel(applicationsChannel);
  applicationsChannel = supabase
    .channel('applications-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'applications' }, async () => {
      await renderAdminLists();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, async () => {
      await renderAdminLists();
    })
    .subscribe();
}

function unsubscribeAll() {
  if (messagesChannel) supabase.removeChannel(messagesChannel);
  if (profilesChannel) supabase.removeChannel(profilesChannel);
  if (applicationsChannel) supabase.removeChannel(applicationsChannel);
  messagesChannel = profilesChannel = applicationsChannel = null;
}

// ==================== ADMIN ====================
function toggleAdminPanel() {
  if (!currentProfile || (currentProfile.role !== 'admin' && currentProfile.role !== 'owner')) return;
  document.getElementById('admin-panel').classList.toggle('hidden');
  renderAdminLists();
}

async function renderAdminLists() {
  // Pendentes
  const { data: pendings } = await supabase
    .from('profiles')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  const pendingBox = document.getElementById('pending-list');
  pendingBox.innerHTML = '';
  if (!pendings || pendings.length === 0) {
    pendingBox.innerHTML = "<p class='small'>Nenhuma solicitação pendente.</p>";
  } else {
    // Buscar reasons das applications
    for (const p of pendings) {
      const { data: app } = await supabase
        .from('applications')
        .select('reason')
        .eq('user_id', p.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const div = document.createElement('div');
      div.className = 'pending-item';
      div.innerHTML = `
        <strong>${escapeHtml(p.nick)}</strong><br>
        <span class="small">${escapeHtml(app?.reason || '(sem motivo)')}</span>
        <div class="actions">
          <button class="btn-accept" onclick="approveUser('${p.id}')">Aceitar</button>
          <button class="btn-reject" onclick="rejectUser('${p.id}')">Recusar</button>
        </div>
      `;
      pendingBox.appendChild(div);
    }
  }

  // Membros aprovados
  const { data: members } = await supabase
    .from('profiles')
    .select('*')
    .eq('status', 'approved')
    .order('created_at', { ascending: true });

  const membersBox = document.getElementById('members-list');
  membersBox.innerHTML = '';
  (members || []).forEach(u => {
    const div = document.createElement('div');
    div.className = 'member-item';
    div.innerHTML = `
      <strong>${escapeHtml(u.nick)}</strong> <span class="badge ${u.role}">${u.role}</span>
      <div class="actions">
        ${u.role !== 'owner' && currentProfile.role === 'owner' || (u.role === 'member' && (currentProfile.role === 'admin' || currentProfile.role === 'owner'))
          ? `<button class="btn-ban" onclick="banUser('${u.id}', '${escapeHtml(u.nick)}', 'Banido por administrador')">Banir</button>`
          : ''}
      </div>
    `;
    membersBox.appendChild(div);
  });
}

async function approveUser(userId) {
  await supabase.from('profiles').update({ status: 'approved' }).eq('id', userId);
  await supabase.from('applications').update({ status: 'approved' }).eq('user_id', userId).eq('status', 'pending');
  await renderAdminLists();
}

async function rejectUser(userId) {
  await supabase.from('profiles').update({ status: 'banned', ban_reason: 'Solicitação recusada' }).eq('id', userId);
  await supabase.from('applications').update({ status: 'rejected' }).eq('user_id', userId).eq('status', 'pending');
  await renderAdminLists();
}

async function banUser(userId, nick, reason) {
  await supabase.from('profiles').update({ status: 'banned', ban_reason: reason }).eq('id', userId);
  await supabase.from('bans').insert({
    user_id: userId,
    nick,
    reason,
    banned_by: currentProfile?.id || null
  });

  // Remove mensagens do usuário
  await supabase.from('messages').delete().eq('user_id', userId);

  if (currentProfile && currentProfile.id === userId) {
    document.getElementById('ban-reason-text').textContent = 'Motivo: ' + reason;
    showScreen('banned');
  } else {
    alert('Usuário banido: ' + nick);
    await renderAdminLists();
  }
}

async function promoteToAdmin() {
  if (currentProfile.role !== 'owner') return;
  const nick = document.getElementById('promote-nick').value.trim();
  if (!nick) return alert('Digite o nick');

  const { data, error } = await supabase
    .from('profiles')
    .update({ role: 'admin' })
    .eq('nick', nick)
    .eq('status', 'approved')
    .select();

  if (error || !data || data.length === 0) {
    alert('Usuário não encontrado ou não aprovado.');
    return;
  }
  alert(nick + ' agora é administrador.');
  document.getElementById('promote-nick').value = '';
  await renderAdminLists();
}

// ==================== HELPERS ====================
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// ==================== INÍCIO ====================
async function init() {
  // Verificar se config está preenchida
  if (!SUPABASE_URL || SUPABASE_URL.includes('COLE_AQUI') || !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes('COLE_AQUI')) {
    document.getElementById('home-hint').textContent = '⚠️ Configure o config.js com URL e chave do Supabase antes de usar.';
    document.getElementById('home-hint').style.color = '#ff5252';
  }

  // Sessão existente?
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    await afterAuth(session.user);
  }

  // Listener de mudanças de auth
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_OUT') {
      currentUser = null;
      currentProfile = null;
      showScreen('home');
    }
  });
}

init();
