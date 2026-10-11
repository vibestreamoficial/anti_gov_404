const $ = (id) => document.getElementById(id);
let token = localStorage.getItem('ag404_token');
let currentUser = null;
let myIp = '...';
let envInfo = {};
let failCount = Number(sessionStorage.getItem('ag404_fails') || 0);

const DEFAULT_OWNER_PASS = 'A404#Owner9x';
const BLOCKED_NICK = [/admin/i, /^adm$/i, /\badm\b/i, /hacker/i, /hack/i, /root/i, /owner/i, /moderator/i, /ameaca/i, /ameaça/i, /matar/i, /terror/i];
const SCAN_UA = /dirb|dirbuster|gobuster|nikto|sqlmap|nmap|masscan|wfuzz|ffuf|burp|zaproxy|acunetix|nessus|openvas|wget\/|curl\/|python-requests|scrapy|httpclient|libwww/i;

function setScreen(n) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  const e = $('screen-' + n);
  if (e) e.classList.add('active');
}
function esc(s) {
  return String(s).replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>');
}
function db() {
  let r = localStorage.getItem('ag404_db');
  if (r) {
    const d = JSON.parse(r);
    if (!d.ipBans) d.ipBans = [];
    if (!d.ipLogs) d.ipLogs = [];
    if (!d.botAccepted) d.botAccepted = [];
    if (!d.users) d.users = [];
    if (!d.messages) d.messages = [];
    if (!d.nextId) d.nextId = 2;
    if (!d.nextMsg) d.nextMsg = 1;
    // migra senha antiga admin123 -> nova (uma vez)
    const owner = d.users.find((u) => u.nick === 'admin' && u.role === 'owner');
    if (owner && (owner.password === 'admin123' || !owner.password)) {
      owner.password = DEFAULT_OWNER_PASS;
      localStorage.setItem('ag404_db', JSON.stringify(d));
    }
    return d;
  }
  const d = {
    users: [{ id: 1, nick: 'admin', password: DEFAULT_OWNER_PASS, role: 'owner', status: 'approved', reason: '' }],
    messages: [],
    ipBans: [],
    ipLogs: [],
    botAccepted: [],
    nextId: 2,
    nextMsg: 1
  };
  localStorage.setItem('ag404_db', JSON.stringify(d));
  return d;
}
function save(d) {
  localStorage.setItem('ag404_db', JSON.stringify(d));
}
function me() {
  const id = Number(String(token || '').replace('local-', ''));
  return db().users.find((u) => u.id === id);
}
function showErr(m) {
  const e = $('auth-error');
  if (!e) return;
  e.textContent = m;
  e.classList.remove('hidden');
}
function nickBlocked(nick) {
  return BLOCKED_NICK.some((re) => re.test(nick));
}
function banIpNow(reason) {
  const d = db();
  if (myIp && d.ipBans.indexOf(myIp) < 0) d.ipBans.push(myIp);
  d.ipLogs.unshift({
    ip: myIp,
    action: reason || 'ban',
    at: new Date().toISOString(),
    nick: (me() && me().nick) || 'anon',
    windows: !!(envInfo && envInfo.windows),
    maybeVm: !!(envInfo && envInfo.maybeVm)
  });
  d.ipLogs = d.ipLogs.slice(0, 100);
  save(d);
}
function detectEnv() {
  const ua = navigator.userAgent || '';
  const p = navigator.platform || '';
  const cores = navigator.hardwareConcurrency || 0;
  const mem = navigator.deviceMemory || 0;
  const win = /Windows/i.test(ua) || /Win/i.test(p);
  const maybeVm = win && (cores <= 2 || (mem > 0 && mem <= 2) || /VirtualBox|VMware|Hyper-V|QEMU|Xen/i.test(ua));
  envInfo = { ua: ua.slice(0, 160), platform: p, windows: win, maybeVm: !!maybeVm, cores: cores };
  return envInfo;
}
function logIntrusion(action) {
  const d = db();
  d.ipLogs.unshift({
    ip: myIp,
    action: action,
    at: new Date().toISOString(),
    nick: (me() && me().nick) || 'anon',
    windows: !!(envInfo && envInfo.windows),
    maybeVm: !!(envInfo && envInfo.maybeVm)
  });
  d.ipLogs = d.ipLogs.slice(0, 100);
  save(d);
}

async function loadIp() {
  detectEnv();
  // ferramentas tipo dirb/nikto/sqlmap no User-Agent -> bloqueia na hora
  if (SCAN_UA.test(navigator.userAgent || '')) {
    try {
      const r = await fetch('https://api.ipify.org?format=json');
      const j = await r.json();
      myIp = j.ip || 'scan';
    } catch (e) {
      myIp = 'scan';
    }
    banIpNow('scan_tool_ua');
    document.body.innerHTML =
      '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0e14;color:#ff3b5c;font-family:system-ui;padding:20px;text-align:center"><div><h1>405</h1><p>Ferramenta de scan bloqueada.</p></div></div>';
    return false;
  }
  try {
    const r = await fetch('https://api.ipify.org?format=json');
    const j = await r.json();
    myIp = j.ip || 'desconhecido';
  } catch (e) {
    myIp = 'local';
  }
  if ($('my-ip-label')) {
    $('my-ip-label').textContent =
      'Seu IP: ' + myIp + (envInfo.windows ? ' | Windows' : '') + (envInfo.maybeVm ? ' | VM?' : '');
  }
  if (db().ipBans.indexOf(myIp) >= 0) {
    document.body.innerHTML =
      '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0e14;color:#ff3b5c;font-family:system-ui;padding:20px;text-align:center"><div><h1>405 / IP bloqueado</h1><p>' +
      esc(myIp) +
      '</p></div></div>';
    return false;
  }
  return true;
}

document.querySelectorAll('.tab').forEach((tab) => {
  tab.onclick = function () {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    const reg = tab.getAttribute('data-mode') === 'register';
    document.querySelectorAll('.reg-only').forEach((el) => el.classList.toggle('hidden', !reg));
    $('auth-btn').textContent = reg ? 'Solicitar acesso' : 'Entrar';
    $('auth-error').classList.add('hidden');
  };
});

$('auth-form').onsubmit = function (e) {
  e.preventDefault();
  const nick = $('auth-nick').value.trim().toLowerCase();
  const password = $('auth-password').value;
  const reason = ($('auth-reason') && $('auth-reason').value.trim()) || '';
  const isReg = document.querySelector('.tab.active').getAttribute('data-mode') === 'register';
  $('auth-error').classList.add('hidden');
  try {
    if (db().ipBans.indexOf(myIp) >= 0) throw new Error('IP bloqueado');
    const d = db();
    if (isReg) {
      if (nick.length < 2) throw new Error('Nick obrigatorio');
      if (nickBlocked(nick)) {
        logIntrusion('nick_bloqueado:' + nick);
        failCount++;
        sessionStorage.setItem('ag404_fails', String(failCount));
        if (failCount >= 3) {
          banIpNow('nick_ataque');
          throw new Error('405 IP banido');
        }
        throw new Error('Nick nao permitido');
      }
      if (d.users.find((u) => u.nick === nick)) throw new Error('Nick ja existe');
      const u = {
        id: d.nextId++,
        nick: nick,
        password: password,
        role: 'user',
        status: 'approved',
        reason: reason,
        ip: myIp,
        windows: !!envInfo.windows,
        maybeVm: !!envInfo.maybeVm
      };
      d.users.push(u);
      d.botAccepted = d.botAccepted || [];
      d.botAccepted.unshift({ nick: u.nick, ip: myIp, at: new Date().toISOString() });
      d.botAccepted = d.botAccepted.slice(0, 50);
      save(d);
      token = 'local-' + u.id;
      localStorage.setItem('ag404_token', token);
      failCount = 0;
      sessionStorage.setItem('ag404_fails', '0');
      afterAuth();
      return;
    }
    // LOGIN
    if (nick !== 'admin' && nickBlocked(nick)) {
      logIntrusion('login_nick_bloqueado:' + nick);
      throw new Error('Nick nao permitido');
    }
    const u = d.users.find((x) => x.nick === nick && x.password === password);
    if (!u) {
      failCount++;
      sessionStorage.setItem('ag404_fails', String(failCount));
      logIntrusion('login_falha:' + nick);
      if (failCount >= 5 || (nick === 'admin' && failCount >= 3)) {
        banIpNow('brute_force_login');
        throw new Error('405 IP banido por tentativas');
      }
      throw new Error('Nick ou senha incorretos (' + failCount + '/5)');
    }
    u.lastIp = myIp;
    u.windows = !!envInfo.windows;
    u.maybeVm = !!envInfo.maybeVm;
    save(d);
    token = 'local-' + u.id;
    localStorage.setItem('ag404_token', token);
    failCount = 0;
    sessionStorage.setItem('ag404_fails', '0');
    afterAuth();
  } catch (err) {
    showErr(err.message);
  }
};

function afterAuth() {
  const u = me();
  if (!u) {
    logout();
    return;
  }
  currentUser = { id: u.id, nick: u.nick, role: u.role, status: u.status, ban_reason: u.ban_reason };
  if (u.status === 'banned') {
    $('ban-text').textContent = u.ban_reason || 'Banido';
    setScreen('banned');
    return;
  }
  if (u.status === 'pending') {
    $('pending-nick').textContent = u.nick;
    setScreen('pending');
    return;
  }
  enterChat();
}

function checkMe() {
  afterAuth();
}
function logout() {
  token = null;
  currentUser = null;
  localStorage.removeItem('ag404_token');
  setScreen('auth');
}

function enterChat() {
  setScreen('chat');
  $('user-nick').textContent = '@' + currentUser.nick;
  $('user-role').textContent = currentUser.role;
  $('user-role').className = 'badge ' + currentUser.role;
  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'owner';
  $('btn-admin').classList.toggle('hidden', !isAdmin);
  if ($('btn-owner')) $('btn-owner').classList.toggle('hidden', currentUser.role !== 'owner');
  if ($('my-ip-label')) {
    $('my-ip-label').textContent =
      'Seu IP: ' + myIp + (envInfo.windows ? ' | Windows' : '') + (envInfo.maybeVm ? ' | VM?' : '');
  }
  const btnPass = $('btn-change-pass');
  if (btnPass) {
    btnPass.onclick = function () {
      const u = me();
      if (!u || u.role !== 'owner') return;
      const np = prompt('Nova senha do owner (min 8):');
      if (!np || np.length < 8) {
        alert('Senha fraca');
        return;
      }
      const d = db();
      const owner = d.users.find((x) => x.nick === 'admin');
      if (owner) {
        owner.password = np;
        save(d);
        alert('Senha alterada. Guarde ela.');
      }
    };
  }
  loadMessages();
}

function loadMessages() {
  const box = $('messages');
  box.innerHTML = '';
  db().messages.forEach(renderMsg);
  box.scrollTop = box.scrollHeight;
}

function renderMsg(msg) {
  const box = $('messages');
  if (box.querySelector('[data-id="' + msg.id + '"]')) return;
  const div = document.createElement('div');
  div.className = 'msg' + (msg.flagged ? ' flag' : '');
  div.setAttribute('data-id', msg.id);
  div.innerHTML =
    '<div class="meta"><span class="author">' + esc(msg.nick) + '</span></div><div>' + esc(msg.text || '') + '</div>';
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function sendMsg() {
  const input = $('msg-input');
  const text = input.value.trim();
  if (!text) return;
  const u = me();
  if (!u || u.status !== 'approved') {
    alert('Sem acesso');
    afterAuth();
    return;
  }
  const d = db();
  const flagged = /matar|bomba|fake news|ameaca|ameaça|hacker|doxx/i.test(text);
  const msg = { id: d.nextMsg++, nick: u.nick, text: text, flagged: flagged ? 1 : 0 };
  d.messages.push(msg);
  save(d);
  input.value = '';
  if (flagged) {
    $('bot-banner').textContent = 'Bot: mensagem suspeita';
    $('bot-banner').classList.remove('hidden');
  }
  renderMsg(msg);
}

$('msg-input').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') sendMsg();
});

function toggleAdmin() {
  const u = me();
  if (!u || (u.role !== 'admin' && u.role !== 'owner')) {
    logIntrusion('tentativa_painel_admin');
    banIpNow('invasao_admin');
    alert('405 Method Not Allowed\nIP banido: ' + myIp);
    return;
  }
  $('admin-panel').classList.toggle('hidden');
  if (!$('admin-panel').classList.contains('hidden')) refreshAdmin();
}

function refreshAdmin() {
  const u = me();
  if (!u || (u.role !== 'admin' && u.role !== 'owner')) {
    logIntrusion('tentativa_admin');
    banIpNow('invasao_admin');
    alert('405');
    return;
  }
  const d = db();
  if ($('my-ip-label')) {
    $('my-ip-label').textContent =
      'Seu IP: ' + myIp + (envInfo.windows ? ' | Windows' : '') + (envInfo.maybeVm ? ' | VM?' : '');
  }
  $('pending-list').innerHTML = '<p class="sub">Bot auto-aceita. Veja Aceitos pelo bot.</p>';
  if ($('bot-accepted-list')) {
    const ba = d.botAccepted || [];
    $('bot-accepted-list').innerHTML = ba.length
      ? ba
          .slice(0, 25)
          .map(function (x) {
            return (
              '<div class="item"><strong>@' +
              esc(x.nick) +
              '</strong><div class="sub">IP ' +
              esc(x.ip || '') +
              '</div></div>'
            );
          })
          .join('')
      : '<p class="sub">Ninguem ainda</p>';
  }
  $('members-list').innerHTML = d.users
    .map(function (x) {
      return (
        '<div class="item"><strong>@' +
        esc(x.nick) +
        '</strong> ' +
        x.role +
        ' / ' +
        x.status +
        (x.nick !== 'admin'
          ? '<div class="actions"><button type="button" class="btn sm ban" data-act="ban" data-id="' +
            x.id +
            '">Banir</button></div>'
          : '') +
        '</div>'
      );
    })
    .join('');
  const fl = d.messages.filter((m) => m.flagged);
  $('flagged-list').innerHTML = fl.length
    ? fl.map((m) => '<div class="item">@' + esc(m.nick) + ': ' + esc((m.text || '').slice(0, 80)) + '</div>').join('')
    : '<p class="sub">Nenhum</p>';
  $('ip-logs').innerHTML = d.ipLogs.length
    ? d.ipLogs
        .slice(0, 30)
        .map(function (l) {
          return (
            '<div class="item">' +
            esc(l.ip) +
            ' · ' +
            esc(l.action) +
            (l.windows ? ' · Win' : '') +
            (l.maybeVm ? ' · VM?' : '') +
            '<div class="actions"><button type="button" class="btn sm ban" data-act="banip" data-ip="' +
            esc(l.ip) +
            '">Banir IP</button></div></div>'
          );
        })
        .join('')
    : '<p class="sub">Nenhuma</p>';
  $('ip-bans').innerHTML = d.ipBans.length
    ? d.ipBans
        .map(function (ip) {
          return (
            '<div class="item">' +
            esc(ip) +
            ' <button type="button" class="btn sm accept" data-act="unbanip" data-ip="' +
            esc(ip) +
            '">Liberar</button></div>'
          );
        })
        .join('')
    : '<p class="sub">Nenhum</p>';
}

document.addEventListener('click', function (ev) {
  const btn = ev.target.closest('button[data-act]');
  if (!btn) return;
  const act = btn.getAttribute('data-act');
  const id = Number(btn.getAttribute('data-id'));
  const ip = btn.getAttribute('data-ip');
  const d = db();
  if (act === 'ban') {
    const reason = prompt('Motivo:', 'Violacao');
    if (!reason) return;
    const u = d.users.find((x) => x.id === id && x.role !== 'owner');
    if (u) {
      u.status = 'banned';
      u.ban_reason = reason;
      const bip = u.lastIp || u.ip;
      if (bip && d.ipBans.indexOf(bip) < 0) d.ipBans.push(bip);
    }
    save(d);
    refreshAdmin();
  }
  if (act === 'banip' && ip) {
    if (d.ipBans.indexOf(ip) < 0) d.ipBans.push(ip);
    save(d);
    refreshAdmin();
  }
  if (act === 'unbanip' && ip) {
    d.ipBans = d.ipBans.filter((x) => x !== ip);
    save(d);
    refreshAdmin();
  }
});

function openOwnerPanel() {
  const u = me();
  if (!u || u.role !== 'owner') {
    logIntrusion('tentativa_painel_owner');
    banIpNow('invasao_owner');
    alert('405 owner only. IP banido: ' + myIp);
    return;
  }
  const d = db();
  $('owner-body').innerHTML =
    '<p class="sub">IP: ' +
    esc(myIp) +
    ' | Users: ' +
    d.users.length +
    ' | Bans: ' +
    d.ipBans.length +
    '</p>';
  $('owner-panel').classList.remove('hidden');
}

window.checkMe = checkMe;
window.logout = logout;
window.sendMsg = sendMsg;
window.toggleAdmin = toggleAdmin;
window.openOwnerPanel = openOwnerPanel;

(async function () {
  const ok = await loadIp();
  if (ok === false) return;
  if (token) afterAuth();
  else setScreen('auth');
})();
