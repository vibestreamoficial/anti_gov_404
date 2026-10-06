const API_BASE = window.location.origin;

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Erro na requisição');
  return data;
}

let currentUser = null;
let socket = null;
let messagesChannel = null;

function setScreen(name) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  const screen = document.getElementById('screen-' + name);
  if (screen) screen.classList.add('active');
}

function switchAuthTab(mode) {
  const loginTab = document.getElementById('tab-login');
  const regTab = document.getElementById('tab-register');
  const nickField = document.getElementById('nick-field');
  const registerExtra = document.getElementById('register-extra');
  const title = document.getElementById('auth-title');
  const sub = document.getElementById('auth-sub');
  const btn = document.getElementById('auth-btn');
  const error = document.getElementById('auth-error');

  const isLogin = mode === 'login';
  loginTab.classList.toggle('active', isLogin);
  regTab.classList.toggle('active', !isLogin);
  nickField.classList.toggle('hidden', isLogin);
  registerExtra.classList.toggle('hidden', isLogin);
  title.textContent = isLogin ? 'Entrar' : 'Cadastrar';
  sub.textContent = isLogin ? 'Use e-mail e senha' : 'Crie sua conta e solicite acesso';
  btn.textContent = isLogin ? 'Entrar' : 'Cadastrar e Solicitar';
  error.classList.add('hidden');
}

async function handleAuth(event) {
  event.preventDefault();
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const nick = document.getElementById('auth-nick')?.value.trim();
  const reason = document.getElementById('auth-reason')?.value.trim() || '';
  const how = document.getElementById('auth-how')?.value.trim() || '';
  const errorEl = document.getElementById('auth-error');

  try {
    const mode = document.getElementById('tab-register').classList.contains('active') ? 'register' : 'login';
    const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const payload = mode === 'login' ? { email, password } : { email, password, nick, reason, how };

    const result = await request(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    localStorage.setItem('token', result.token);
    currentUser = result.user;
    await afterAuth();
  } catch (err) {
    errorEl.textContent = err.message || 'Erro ao autenticar';
    errorEl.classList.remove('hidden');
  }
}

async function afterAuth() {
  const token = localStorage.getItem('token');
  if (!token) return;

  try {
    const result = await request('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
    });

    currentUser = result.user;

    if (currentUser.status === 'banned') {
      document.getElementById('ban-reason-text').textContent = 'Motivo: ' + (currentUser.ban_reason || 'Violação das regras');
      setScreen('banned');
      return;
    }

    if (currentUser.status === 'pending') {
      document.getElementById('pending-nick').textContent = currentUser.nick;
      setScreen('pending');
      return;
    }

    enterChat();
  } catch (err) {
    console.error(err);
    logout();
  }
}

async function logout() {
  localStorage.removeItem('token');
  currentUser = null;
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  setScreen('home');
}

async function enterChat() {
  const token = localStorage.getItem('token');
  setScreen('chat');
  document.getElementById('user-nick').textContent = currentUser.nick;
  document.getElementById('user-role').textContent = currentUser.role;
  document.getElementById('user-role').className = 'badge ' + currentUser.role;

  document.getElementById('btn-admin').style.display = ['admin', 'owner'].includes(currentUser.role) ? 'inline-block' : 'none';
  document.getElementById('owner-section').classList.toggle('hidden', currentUser.role !== 'owner');

  initializeSocket();
  await loadMessages();
  if (['admin', 'owner'].includes(currentUser.role)) await renderAdminLists();
}

function initializeSocket() {
  if (socket) socket.disconnect();
  socket = io({ transports: ['websocket'] });
  socket.emit('join_room', 'global_chat');
  socket.on('message_received', (msg) => {
    renderOneMessage(msg);
  });
}

async function loadMessages() {
  try {
    const token = localStorage.getItem('token');
    const result = await request('/api/chat/messages', {
      headers: { Authorization: `Bearer ${token}` }
    });

    const box = document.getElementById('messages');
    box.innerHTML = '';
    result.forEach((msg) => renderOneMessage(msg));
  } catch (err) {
    console.error(err);
  }
}

function renderOneMessage(msg) {
  const box = document.getElementById('messages');
  if (!box) return;

  const line = document.createElement('div');
  line.className = 'msg';
  const isAdmin = currentUser && ['admin', 'owner'].includes(currentUser.role);
  const roleBadge = msg.role && ['admin', 'owner'].includes(msg.role) ? ` <span class="badge ${msg.role}">${msg.role}</span>` : '';

  line.innerHTML = `
    <div class="meta">
      <span class="author">${msg.nick || 'Sistema'}</span>${roleBadge}
      <span>${new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
      ${isAdmin ? `<button class="delete-btn" onclick="deleteMessage(${msg.id})">apagar</button>` : ''}
    </div>
    <div class="text">${escapeHtml(msg.text || '')}</div>
  `;

  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
}

async function sendMessage() {
  const input = document.getElementById('msg-input');
  const text = input.value.trim();
  if (!text) return;

  try {
    const token = localStorage.getItem('token');
    const result = await request('/api/chat/message', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ text, type: 'text' })
    });

    socket.emit('send_message', { room: 'global_chat', message: result.message });
    input.value = '';
  } catch (err) {
    alert(err.message);
  }
}

async function deleteMessage(id) {
  try {
    const token = localStorage.getItem('token');
    await request(`/api/chat/message/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    await loadMessages();
  } catch (err) {
    alert(err.message);
  }
}

async function renderAdminLists() {
  try {
    const token = localStorage.getItem('token');
    const pending = await request('/api/admin/pending', {
      headers: { Authorization: `Bearer ${token}` }
    });

    const members = await request('/api/admin/members', {
      headers: { Authorization: `Bearer ${token}` }
    });

    const pendingBox = document.getElementById('pending-list');
    const membersBox = document.getElementById('members-list');

    pendingBox.innerHTML = '';
    if (!pending.length) {
      pendingBox.innerHTML = '<p class="small">Nenhuma solicitação pendente.</p>';
    } else {
      pending.forEach((user) => {
        const item = document.createElement('div');
        item.className = 'pending-item';
        item.innerHTML = `
          <strong>${escapeHtml(user.nick)}</strong><br>
          <span class="small">${escapeHtml(user.reason || 'Sem motivo')}</span>
          <div class="actions">
            <button class="btn-accept" onclick="approveUser(${user.id})">Aceitar</button>
            <button class="btn-reject" onclick="rejectUser(${user.id})">Recusar</button>
          </div>
        `;
        pendingBox.appendChild(item);
      });
    }

    membersBox.innerHTML = '';
    members.forEach((user) => {
      const item = document.createElement('div');
      item.className = 'member-item';
      item.innerHTML = `
        <strong>${escapeHtml(user.nick)}</strong>
        <span class="badge ${user.role}">${user.role}</span>
        <div class="actions">
          <button class="btn-ban" onclick="banUser(${user.id}, '${escapeHtml(user.nick)}')">Banir</button>
        </div>
      `;
      membersBox.appendChild(item);
    });
  } catch (err) {
    console.error(err);
  }
}

async function approveUser(id) {
  try {
    const token = localStorage.getItem('token');
    await request(`/api/admin/approve/${id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    await renderAdminLists();
  } catch (err) {
    alert(err.message);
  }
}

async function rejectUser(id) {
  try {
    const token = localStorage.getItem('token');
    await request(`/api/admin/reject/${id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    await renderAdminLists();
  } catch (err) {
    alert(err.message);
  }
}

async function banUser(userId, nick) {
  const reason = prompt('Motivo do banimento:', 'Violação das regras');
  if (!reason) return;

  try {
    const token = localStorage.getItem('token');
    await request('/api/admin/ban', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId, reason })
    });
    alert('Usuário banido: ' + nick);
    await renderAdminLists();
  } catch (err) {
    alert(err.message);
  }
}

async function toggleAdminPanel() {
  if (!['admin', 'owner'].includes(currentUser?.role)) return;
  const panel = document.getElementById('admin-panel');
  panel.classList.toggle('hidden');
  if (!panel.classList.contains('hidden')) {
    await renderAdminLists();
  }
}

async function promoteToAdmin() {
  if (currentUser?.role !== 'owner') return;
  const nick = document.getElementById('promote-nick').value.trim();
  if (!nick) return alert('Digite o nick');

  try {
    const token = localStorage.getItem('token');
    const users = await request('/api/admin/members', { headers: { Authorization: `Bearer ${token}` } });
    const match = users.find((u) => u.nick.toLowerCase() === nick.toLowerCase());
    if (!match) return alert('Usuário não encontrado');

    await request(`/api/admin/promote/${match.id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });

    alert(`${nick} foi promovido a admin.`);
    document.getElementById('promote-nick').value = '';
    await renderAdminLists();
  } catch (err) {
    alert(err.message);
  }
}

async function clearChat() {
  if (!confirm('Limpar todo o chat?')) return;
  try {
    const token = localStorage.getItem('token');
    await request('/api/admin/clear-chat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    await loadMessages();
  } catch (err) {
    alert(err.message);
  }
}

async function analyzeBotInput() {
  const text = document.getElementById('bot-input')?.value || '';
  if (!text) return;

  try {
    const token = localStorage.getItem('token');
    const result = await request('/api/bot/analyze', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ text })
    });

    document.getElementById('bot-results').innerHTML = `<pre>${escapeHtml(JSON.stringify(result, null, 2))}</pre>`;
  } catch (err) {
    alert(err.message);
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

window.handleAuth = handleAuth;
window.switchAuthTab = switchAuthTab;
window.logout = logout;
window.sendMessage = sendMessage;
window.toggleAdminPanel = toggleAdminPanel;
window.approveUser = approveUser;
window.rejectUser = rejectUser;
window.banUser = banUser;
window.promoteToAdmin = promoteToAdmin;
window.clearChat = clearChat;
window.deleteMessage = deleteMessage;
window.analyzeBotInput = analyzeBotInput;

async function init() {
  const token = localStorage.getItem('token');
  if (token) await afterAuth();
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('auth-form')?.addEventListener('submit', handleAuth);
  document.getElementById('sendBtn')?.addEventListener('click', sendMessage);
  document.getElementById('auth-btn')?.addEventListener('click', handleAuth);
  document.getElementById('analyze-btn')?.addEventListener('click', analyzeBotInput);
  document.getElementById('logoutBtn')?.addEventListener('click', logout);
  init();
});
