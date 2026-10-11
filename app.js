const $=id=>document.getElementById(id);
let token=localStorage.getItem('ag404_token'),currentUser=null,myIp='desconhecido';

function setScreen(n){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));const e=$('screen-'+n);if(e)e.classList.add('active')}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function db(){
  let r=localStorage.getItem('ag404_db');
  if(r){const d=JSON.parse(r);if(!d.ipBans)d.ipBans=[];if(!d.ipLogs)d.ipLogs=[];if(!d.nextId)d.nextId=2;if(!d.nextMsg)d.nextMsg=1;return d}
  const d={users:[{id:1,nick:'admin',password:'admin123',role:'owner',status:'approved',reason:''}],messages:[],ipBans:[],ipLogs:[],nextId:2,nextMsg:1};
  localStorage.setItem('ag404_db',JSON.stringify(d));return d;
}
function save(d){localStorage.setItem('ag404_db',JSON.stringify(d))}
function me(){const id=Number(String(token||'').replace('local-',''));return db().users.find(u=>u.id===id)}
function showErr(m){const e=$('auth-error');if(!e)return;e.textContent=m;e.classList.remove('hidden')}

async function loadIp(){
  try{
    const r=await fetch('https://api.ipify.org?format=json');
    const j=await r.json();
    myIp=j.ip||'desconhecido';
  }catch(_){myIp='local-'+((navigator.userAgent||'').slice(0,24));}
  const d=db();
  if(d.ipBans.includes(myIp)){
    document.body.innerHTML='<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0e14;color:#ff3b5c;font-family:system-ui;text-align:center;padding:20px"><div><h1>IP bloqueado</h1><p>Seu IP foi banido por tentativa de invasao ao painel.</p><p style="color:#888;margin-top:12px">'+esc(myIp)+'</p></div></div>';
    throw new Error('IP_BANNED');
  }
}

function logIntrusion(action){
  const d=db();
  d.ipLogs.unshift({ip:myIp,action,at:new Date().toISOString(),nick:(me()&&me().nick)||'anon'});
  d.ipLogs=d.ipLogs.slice(0,100);
  save(d);
}
function isBannedIp(ip){return db().ipBans.includes(ip)}

document.querySelectorAll('.tab').forEach(tab=>{
  tab.onclick=()=>{
    document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
    tab.classList.add('active');
    const reg=tab.dataset.mode==='register';
    document.querySelectorAll('.reg-only').forEach(el=>el.classList.toggle('hidden',!reg));
    if($('auth-btn'))$('auth-btn').textContent=reg?'Solicitar acesso':'Entrar';
    if($('auth-error'))$('auth-error').classList.add('hidden');
  };
});

$('auth-form').onsubmit=async e=>{
  e.preventDefault();
  const nick=$('auth-nick').value.trim().toLowerCase();
  const password=$('auth-password').value;
  const reason=($('auth-reason')&&$('auth-reason').value.trim())||'';
  const isReg=document.querySelector('.tab.active')?.dataset.mode==='register';
  $('auth-error').classList.add('hidden');
  try{
    if(isBannedIp(myIp))throw new Error('IP bloqueado');
    const d=db();
    if(isReg){
      if(nick.length<2)throw new Error('Nick obrigatorio');
      if(d.users.find(u=>u.nick===nick))throw new Error('Nick ja existe');
      const u={id:d.nextId++,nick,password,role:'user',status:'pending',reason,ip:myIp};
      d.users.push(u);save(d);
      token='local-'+u.id;localStorage.setItem('ag404_token',token);
      currentUser={id:u.id,nick,role:'user',status:'pending'};
    }else{
      const u=d.users.find(x=>x.nick===nick&&x.password===password);
      if(!u)throw new Error('Nick ou senha incorretos');
      u.lastIp=myIp;save(d);
      token='local-'+u.id;localStorage.setItem('ag404_token',token);
      currentUser={id:u.id,nick:u.nick,role:u.role,status:u.status,ban_reason:u.ban_reason};
    }
    afterAuth();
  }catch(err){showErr(err.message)}
};

function afterAuth(){
  const u=me();
  if(!u){logout();return}
  if(isBannedIp(myIp)){showErr('IP bloqueado');logout();return}
  currentUser={id:u.id,nick:u.nick,role:u.role,status:u.status,ban_reason:u.ban_reason};
  if(u.status==='banned'){$('ban-text').textContent=u.ban_reason||'Banido';setScreen('banned');return}
  if(u.status==='pending'){$('pending-nick').textContent=u.nick;setScreen('pending');return}
  enterChat();
}
function checkMe(){afterAuth()}
function logout(){token=null;currentUser=null;localStorage.removeItem('ag404_token');setScreen('auth')}
function enterChat(){
  setScreen('chat');
  $('user-nick').textContent='@'+currentUser.nick;
  $('user-role').textContent=currentUser.role;
  $('user-role').className='badge '+currentUser.role;
  const adm=['admin','owner'].includes(currentUser.role);
  $('btn-admin').classList.toggle('hidden',!adm);
  loadMessages();
  if(adm)refreshAdmin();
}
function loadMessages(){const box=$('messages');box.innerHTML='';db().messages.forEach(renderMsg);box.scrollTop=box.scrollHeight}
function renderMsg(msg){
  const box=$('messages');
  if(box.querySelector('[data-id="'+msg.id+'"]'))return;
  const div=document.createElement('div');
  div.className='msg'+(msg.flagged?' flag':'');
  div.dataset.id=msg.id;
  const adm=currentUser&&['admin','owner'].includes(currentUser.role);
  div.innerHTML='<div class="meta"><span class="author">'+esc(msg.nick)+'</span> '+(msg.flagged?'⚠️ ':'')+(adm?' <button type="button" class="btn sm reject" onclick="delMsg('+msg.id+')">apagar</button>':'')+'</div><div>'+esc(msg.text||'')+'</div>';
  box.appendChild(div);box.scrollTop=box.scrollHeight;
}
function sendMsg(){
  const input=$('msg-input');const text=input.value.trim();if(!text)return;
  const u=me();if(!u||u.status!=='approved'){alert('Sem acesso');afterAuth();return}
  if(isBannedIp(myIp)){alert('IP bloqueado');return}
  const d=db();
  const flagged=/matar|bomba|fake news|calunia|ameaca/i.test(text);
  const msg={id:d.nextMsg++,user_id:u.id,nick:u.nick,text,flagged:flagged?1:0,flag_reason:flagged?'conteudo suspeito':null,created_at:new Date().toISOString()};
  d.messages.push(msg);save(d);input.value='';
  if(flagged){$('bot-banner').textContent='Bot: '+msg.flag_reason;$('bot-banner').classList.remove('hidden')}
  renderMsg(msg);
}
$('msg-input')&&$('msg-input').addEventListener('keydown',e=>{if(e.key==='Enter')sendMsg()});
function delMsg(id){const d=db();d.messages=d.messages.filter(m=>m.id!==id);save(d);const el=document.querySelector('[data-id="'+id+'"]');if(el)el.remove()}
function toggleAdmin(){
  const u=me();
  if(!u||!['admin','owner'].includes(u.role)){
    logIntrusion('tentativa_painel_admin');
    alert('405 – acesso negado. IP registrado: '+myIp);
    return;
  }
  const p=$('admin-panel');
  p.classList.toggle('hidden');
  if(!p.classList.contains('hidden'))refreshAdmin();
}
function refreshAdmin(){
  const u=me();
  if(!u||!['admin','owner'].includes(u.role)){
    logIntrusion('tentativa_refresh_admin');
    alert('405 – so admin');
    return;
  }
  const d=db();
  const pending=d.users.filter(x=>x.status==='pending');
  $('pending-list').innerHTML=pending.length?pending.map(x=>'<div class="item"><strong>@'+esc(x.nick)+'</strong><div class="sub">'+esc(x.reason||'')+(x.ip?' · IP '+esc(x.ip):'')+'</div><div class="actions"><button type="button" class="btn sm accept" onclick="approve('+x.id+')">Aceitar</button><button type="button" class="btn sm reject" onclick="reject('+x.id+')">Recusar</button></div></div>').join(''):'<p class="sub">Nenhum</p>';
  $('members-list').innerHTML=d.users.map(x=>'<div class="item"><strong>@'+esc(x.nick)+'</strong> '+x.role+' / '+x.status+(x.lastIp||x.ip?' · '+(x.lastIp||x.ip):'')+(x.nick!=='admin'?'<div class="actions"><button type="button" class="btn sm ban" onclick="ban('+x.id+')">Banir</button></div>':'')+'</div>').join('');
  const fl=d.messages.filter(m=>m.flagged);
  $('flagged-list').innerHTML=fl.length?fl.map(m=>'<div class="item">@'+esc(m.nick)+': '+esc((m.text||'').slice(0,80))+'</div>').join(''):'<p class="sub">Nenhum</p>';
  let ipBox=$('ip-sec');
  if(!ipBox){
    ipBox=document.createElement('div');
    ipBox.id='ip-sec';
    ipBox.innerHTML='<h4>IPs / invasoes</h4><div id="ip-logs"></div><div id="ip-bans" style="margin-top:8px"></div>';
    $('admin-panel').appendChild(ipBox);
  }
  $('ip-logs').innerHTML='<p class="sub">Tentativas</p>'+(d.ipLogs.length?d.ipLogs.slice(0,20).map(l=>'<div class="item">'+esc(l.ip)+' · '+esc(l.action)+' · '+esc(l.nick)+'<div class="actions"><button type="button" class="btn sm ban" onclick="banIp(\''+String(l.ip).replace(/'/g,'')+'\')">Banir IP</button></div></div>').join(''):'<p class="sub">Nenhuma</p>');
  $('ip-bans').innerHTML='<p class="sub">IPs banidos</p>'+(d.ipBans.length?d.ipBans.map(ip=>'<div class="item">'+esc(ip)+' <button type="button" class="btn sm accept" onclick="unbanIp(\''+String(ip).replace(/'/g,'')+'\')">Liberar</button></div>').join(''):'<p class="sub">Nenhum</p>');
}
function approve(id){const d=db();const u=d.users.find(x=>x.id===id);if(u)u.status='approved';save(d);refreshAdmin()}
function reject(id){const d=db();d.users=d.users.filter(x=>!(x.id===id&&x.status==='pending'));save(d);refreshAdmin()}
function ban(userId){const reason=prompt('Motivo:','Violacao das regras');if(!reason)return;const d=db();const u=d.users.find(x=>x.id===userId&&x.role!=='owner');if(u){u.status='banned';u.ban_reason=reason;if(u.ip||u.lastIp){const ip=u.lastIp||u.ip;if(ip&&!d.ipBans.includes(ip))d.ipBans.push(ip)}}save(d);refreshAdmin()}
function banIp(ip){const d=db();if(!d.ipBans.includes(ip))d.ipBans.push(ip);save(d);refreshAdmin();alert('IP banido: '+ip)}
function unbanIp(ip){const d=db();d.ipBans=d.ipBans.filter(x=>x!==ip);save(d);refreshAdmin()}
let ownerClicks=0,ownerTimer=null;
function setupOwnerHidden(){
  document.addEventListener('click',(ev)=>{
    const t=ev.target;
    if(t && t.tagName==='STRONG' && t.textContent.includes('anti_gov_404')){
      ownerClicks++;
      clearTimeout(ownerTimer);
      ownerTimer=setTimeout(()=>{ownerClicks=0},2500);
      if(ownerClicks>=7){
        ownerClicks=0;
        const u=me();
        if(!u||u.role!=='owner'){
          logIntrusion('tentativa_painel_owner');
          alert('405 – owner only. IP: '+myIp);
          return;
        }
        openOwnerPanel();
      }
    }
  });
}
function openOwnerPanel(){
  let p=$('owner-panel');
  if(!p){
    p=document.createElement('div');
    p.id='owner-panel';
    p.className='admin-panel';
    p.innerHTML='<h3>Owner (escondido)</h3><p class="sub">Seu IP: '+esc(myIp)+'</p><div id="owner-body"></div><button type="button" class="btn sm outline" onclick="this.parentElement.classList.add(\'hidden\')">Fechar</button>';
    const chat=$('screen-chat');
    if(chat) chat.insertBefore(p, chat.querySelector('.messages'));
  }
  p.classList.remove('hidden');
  const d=db();
  $('owner-body').innerHTML='<p class="sub">Usuarios: '+d.users.length+' · Msgs: '+d.messages.length+' · Bans IP: '+d.ipBans.length+'</p>'+d.ipLogs.slice(0,15).map(l=>'<div class="item">'+esc(l.ip)+' | '+esc(l.action)+'</div>').join('');
}
window.checkMe=checkMe;window.logout=logout;window.sendMsg=sendMsg;window.toggleAdmin=toggleAdmin;
window.delMsg=delMsg;window.approve=approve;window.reject=reject;window.ban=ban;
window.banIp=banIp;window.unbanIp=unbanIp;
(async()=>{try{await loadIp()}catch(e){if(e.message==='IP_BANNED')return}setupOwnerHidden();if(token)afterAuth();else setScreen('auth');})();
