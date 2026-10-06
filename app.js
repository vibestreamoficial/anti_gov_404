// ==================== CONFIG ====================
const OWNER_PASSWORD = "Vx9#mK2$pL7qR4!nT"; // senha do dono (não publique)
const STORAGE_KEY = "anti_gov_404_data";

// Palavras e padrões que o bot detecta (ban automático)
const BANNED_PATTERNS = [
  /ameaça|ameaçar|vou te matar|te mato|explodir|bomba/i,
  /fake news|notícia falsa|mentira sobre/i,
  /acusação falsa|calúnia|difamação/i,
  /gore|sangue real|vídeo de morte|snuff/i,
  /porn|sexo explícito|nudes de menor|cp\b/i,
  /drogas ilegais|vender coca|vender maconha/i,
  /hackear banco|clonar cartão|golpe pix|phishing/i,
  /terrorismo|atentado/i
];

// ==================== STATE ====================
let data = loadData();
let currentUser = null;

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try { return JSON.parse(raw); } catch(e) {}
  }
  // dados iniciais
  return {
    users: {
      // dono pré-criado (você)
      "admin": {
        nick: "admin",
        role: "owner",
        status: "approved",
        joinedAt: Date.now()
      }
    },
    pending: {},
    messages: [
      {
        id: 1,
        nick: "Sistema",
        role: "system",
        text: "Bem-vindo ao anti_gov_404. Respeite as regras. Bot de moderação ativo.",
        time: Date.now(),
        type: "text"
      }
    ],
    banned: {}
  };
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ==================== TELAS ====================
function showScreen(name) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const el = document.getElementById("screen-" + name);
  if (el) el.classList.add("active");
}

// ==================== AUTH / FLUXO ====================
function tryEnter() {
  const nick = prompt("Digite seu nick:");
  if (!nick) return;
  const clean = nick.trim().toLowerCase();

  if (data.banned[clean]) {
    showBanModal("Você está banido permanentemente deste site.");
    return;
  }

  const user = data.users[clean];
  if (!user) {
    alert("Nick não encontrado. Faça a solicitação de entrada primeiro.");
    return;
  }
  if (user.status === "pending") {
    currentUser = user;
    document.getElementById("pending-nick").textContent = user.nick;
    showScreen("pending");
    return;
  }
  if (user.status === "approved") {
    currentUser = user;
    enterChat();
    return;
  }
  alert("Status desconhecido.");
}

function submitApplication(e) {
  e.preventDefault();
  const nick = document.getElementById("nick").value.trim();
  const reason = document.getElementById("reason").value.trim();
  const how = document.getElementById("how").value.trim();
  const key = nick.toLowerCase();

  if (data.banned[key]) {
    showBanModal("Este nick está banido.");
    return;
  }
  if (data.users[key] || data.pending[key]) {
    alert("Este nick já existe ou já tem solicitação pendente.");
    return;
  }

  data.pending[key] = {
    nick: nick,
    reason: reason,
    how: how,
    status: "pending",
    appliedAt: Date.now()
  };
  saveData();

  currentUser = data.pending[key];
  document.getElementById("pending-nick").textContent = nick;
  showScreen("pending");
}

function enterChat() {
  showScreen("chat");
  document.getElementById("user-nick").textContent = currentUser.nick;

  const roleEl = document.getElementById("user-role");
  roleEl.textContent = currentUser.role;
  roleEl.className = "badge " + currentUser.role;

  const btnAdmin = document.getElementById("btn-admin");
  if (currentUser.role === "admin" || currentUser.role === "owner") {
    btnAdmin.style.display = "inline-block";
  } else {
    btnAdmin.style.display = "none";
  }

  // mostrar seção dono só pro owner
  const ownerSec = document.getElementById("owner-section");
  if (currentUser.role === "owner") {
    ownerSec.classList.remove("hidden");
  } else {
    ownerSec.classList.add("hidden");
  }

  renderMessages();
  renderAdminLists();
}

function logout() {
  currentUser = null;
  document.getElementById("admin-panel").classList.add("hidden");
  showScreen("home");
}

// ==================== CHAT ====================
function renderMessages() {
  const box = document.getElementById("messages");
  box.innerHTML = "";

  data.messages.forEach(m => {
    if (m.type === "system") {
      const div = document.createElement("div");
      div.className = "system-msg";
      div.textContent = m.text;
      box.appendChild(div);
      return;
    }

    const div = document.createElement("div");
    div.className = "msg" + (currentUser && m.nick === currentUser.nick ? " own" : "");

    const isMod = currentUser && (currentUser.role === "admin" || currentUser.role === "owner");

    let roleClass = "";
    if (m.role === "admin") roleClass = "admin";
    if (m.role === "owner") roleClass = "owner";

    div.innerHTML = `
      <div class="meta">
        <span class="author ${roleClass}">${escapeHtml(m.nick)}${m.role === "admin" || m.role === "owner" ? " • " + m.role : ""}</span>
        <span>${formatTime(m.time)}</span>
        ${isMod ? `<button class="delete-btn" onclick="deleteMessage(${m.id})">apagar</button>` : ""}
      </div>
      <div class="text">${m.type === "image" ? "" : escapeHtml(m.text)}</div>
      ${m.type === "image" ? `<img src="${m.text}" alt="foto" />` : ""}
    `;
    box.appendChild(div);
  });

  box.scrollTop = box.scrollHeight;
}

function sendMessage() {
  if (!currentUser) return;
  const input = document.getElementById("msg-input");
  const text = input.value.trim();
  if (!text) return;

  // Bot de moderação
  if (isSuspicious(text)) {
    banUser(currentUser.nick.toLowerCase(), "Mensagem detectada como ameaça / conteúdo proibido pelo bot de moderação.");
    return;
  }

  data.messages.push({
    id: Date.now(),
    nick: currentUser.nick,
    role: currentUser.role,
    text: text,
    time: Date.now(),
    type: "text"
  });
  saveData();
  input.value = "";
  renderMessages();
}

function sendPhoto(e) {
  const file = e.target.files[0];
  if (!file || !currentUser) return;

  if (file.size > 1.5 * 1024 * 1024) {
    alert("Imagem muito grande (máx ~1.5 MB neste demo).");
    return;
  }

  const reader = new FileReader();
  reader.onload = function(ev) {
    const base64 = ev.target.result;

    // bot também analisa nome do arquivo (simples)
    if (isSuspicious(file.name)) {
      banUser(currentUser.nick.toLowerCase(), "Arquivo suspeito detectado pelo bot.");
      return;
    }

    data.messages.push({
      id: Date.now(),
      nick: currentUser.nick,
      role: currentUser.role,
      text: base64,
      time: Date.now(),
      type: "image"
    });
    saveData();
    renderMessages();
  };
  reader.readAsDataURL(file);
  e.target.value = "";
}

function deleteMessage(id) {
  if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "owner")) return;
  data.messages = data.messages.filter(m => m.id !== id);
  saveData();
  renderMessages();
}

function clearChat() {
  if (!confirm("Limpar todas as mensagens?")) return;
  data.messages = [{
    id: Date.now(),
    nick: "Sistema",
    role: "system",
    text: "Chat limpo por um administrador.",
    time: Date.now(),
    type: "text"
  }];
  saveData();
  renderMessages();
}

// ==================== BOT MODERAÇÃO ====================
function isSuspicious(text) {
  return BANNED_PATTERNS.some(re => re.test(text));
}

function banUser(key, reason) {
  data.banned[key] = { reason, at: Date.now() };
  // remove de users e pending
  delete data.users[key];
  delete data.pending[key];
  // remove mensagens do usuário
  data.messages = data.messages.filter(m => m.nick.toLowerCase() !== key);
  saveData();

  if (currentUser && currentUser.nick.toLowerCase() === key) {
    showBanModal(reason);
    currentUser = null;
  } else {
    alert("Usuário banido: " + key);
    renderAdminLists();
    renderMessages();
  }
}

function showBanModal(reason) {
  document.getElementById("ban-reason").textContent = "Motivo: " + reason;
  document.getElementById("ban-modal").classList.remove("hidden");
  showScreen("home");
}

// ==================== ADMIN ====================
function toggleAdminPanel() {
  if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "owner")) return;
  document.getElementById("admin-panel").classList.toggle("hidden");
  renderAdminLists();
}

function renderAdminLists() {
  // Pendentes
  const pendingBox = document.getElementById("pending-list");
  pendingBox.innerHTML = "";
  const pendings = Object.values(data.pending);
  if (pendings.length === 0) {
    pendingBox.innerHTML = "<p class='small'>Nenhuma solicitação pendente.</p>";
  } else {
    pendings.forEach(p => {
      const div = document.createElement("div");
      div.className = "pending-item";
      div.innerHTML = `
        <strong>${escapeHtml(p.nick)}</strong><br>
        <span class="small">${escapeHtml(p.reason)}</span>
        <div class="actions">
          <button class="btn-accept" onclick="approveUser('${p.nick.toLowerCase()}')">Aceitar</button>
          <button class="btn-reject" onclick="rejectUser('${p.nick.toLowerCase()}')">Recusar</button>
        </div>
      `;
      pendingBox.appendChild(div);
    });
  }

  // Membros
  const membersBox = document.getElementById("members-list");
  membersBox.innerHTML = "";
  Object.values(data.users).forEach(u => {
    const div = document.createElement("div");
    div.className = "member-item";
    div.innerHTML = `
      <strong>${escapeHtml(u.nick)}</strong> <span class="badge ${u.role}">${u.role}</span>
      <div class="actions">
        ${u.role !== "owner" ? `<button class="btn-ban" onclick="banUser('${u.nick.toLowerCase()}', 'Banido por administrador')">Banir</button>` : ""}
      </div>
    `;
    membersBox.appendChild(div);
  });
}

function approveUser(key) {
  const p = data.pending[key];
  if (!p) return;
  data.users[key] = {
    nick: p.nick,
    role: "member",
    status: "approved",
    joinedAt: Date.now()
  };
  delete data.pending[key];
  saveData();
  renderAdminLists();

  // se for o próprio usuário testando no mesmo navegador
  if (currentUser && currentUser.nick.toLowerCase() === key) {
    currentUser = data.users[key];
    enterChat();
  }
}

function rejectUser(key) {
  delete data.pending[key];
  saveData();
  renderAdminLists();
}

function promoteToAdmin() {
  if (currentUser.role !== "owner") return;
  const nick = document.getElementById("promote-nick").value.trim().toLowerCase();
  if (!nick || !data.users[nick]) {
    alert("Usuário não encontrado.");
    return;
  }
  if (data.users[nick].role === "owner") {
    alert("Já é o dono.");
    return;
  }
  data.users[nick].role = "admin";
  saveData();
  renderAdminLists();
  alert(nick + " agora é administrador.");
}

function resetAllData() {
  if (!confirm("Isso apaga TODOS os usuários, mensagens e bans. Continuar?")) return;
  localStorage.removeItem(STORAGE_KEY);
  data = loadData();
  logout();
  alert("Dados resetados.");
}

// ==================== HELPERS ====================
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, """);
}

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// ==================== DONO RÁPIDO (senha) ====================
// Para virar o dono no seu navegador: digite a senha
function becomeOwner() {
  const pass = prompt("Senha do dono:");
  if (pass === OWNER_PASSWORD) {
    data.users["admin"] = {
      nick: "admin",
      role: "owner",
      status: "approved",
      joinedAt: Date.now()
    };
    currentUser = data.users["admin"];
    saveData();
    enterChat();
    alert("Você entrou como DONO (admin).");
  } else {
    alert("Senha incorreta.");
  }
}

// Atalho secreto: clique 5 vezes no logo da home
let clickCount = 0;
document.addEventListener("click", (e) => {
  if (e.target.closest(".logo")) {
    clickCount++;
    if (clickCount >= 5) {
      clickCount = 0;
      becomeOwner();
    }
  }
});

// Inicia
showScreen("home");
