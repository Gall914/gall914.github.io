// RetroMesh — Состояние, хелперы, навигация между экранами, вкладки входа
// ── state ──
let ME_UID='', ME_NICK='', CUR_PEER='', CUR_CH='';
let contacts=[], msgCache={}, listeners={}, unread={};
// voice — объявлено в блоке VOICE ниже
let mediaRec=null, recChunks=[], recSec=0, recTimer=null;

// ── helpers ──
const $   = id => document.getElementById(id);
const ini = s  => (s||'?')[0].toUpperCase();
const chid= (a,b) => [a,b].sort().join('~~');
const fmtT= ts => { const d=new Date(ts); return d.getHours().toString().padStart(2,'0')+':'+d.getMinutes().toString().padStart(2,'0') };
const fmtD= s  => { const m=Math.floor(s/60),x=Math.round(s%60); return m+':'+(x<10?'0':'')+x };
const esc = s  => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
// безопасная подстановка в HTML-атрибут (src="..."), закрывает XSS через кавычки
const escA= s  => String(s==null?'':s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const MONTHS=['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
function fmtDate(ts){
  const d=new Date(ts), now=new Date();
  const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const yesterday=new Date(today-86400000);
  const msgDay=new Date(d.getFullYear(),d.getMonth(),d.getDate());
  if(+msgDay===+today) return 'СЕГОДНЯ';
  if(+msgDay===+yesterday) return 'ВЧЕРА';
  const day=d.getDate(), mon=MONTHS[d.getMonth()];
  if(d.getFullYear()===now.getFullYear()) return day+' '+mon.toUpperCase();
  return day+' '+mon.toUpperCase()+' '+d.getFullYear();
}
const fmtSz= b => b<1024?b+' Б':b<1048576?(b/1024).toFixed(1)+' КБ':(b/1048576).toFixed(1)+' МБ';

function toast(msg,dur=3000){
  const e=$('toast');e.textContent=msg;e.classList.add('show');
  clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove('show'),dur);
}
function setConn(st){
  const d=$('dot'),l=$('clabel');
  if(st==='on'){d.className='on';l.textContent='ONLINE';l.style.color='var(--g1)'}
  else if(st==='off'){d.className='off';l.textContent='OFFLINE';l.style.color='var(--red)'}
  else{d.className='wait';l.textContent='CONNECTING…';l.style.color='var(--amb)'}
}
function setErr(m){$('lerr').textContent=m}
function setBusy(on){$('lbtn-t').style.display=on?'none':'';$('lspin').style.display=on?'block':'none';$('lbtn').disabled=on}
function setProg(pct){
  if(pct==null){$('ibar-prog').classList.remove('show');$('ibar-fill').style.width='0';return}
  $('ibar-prog').classList.add('show');$('ibar-fill').style.width=pct+'%';
}

// ── navigation ──
let curScr='login';
function goTo(scr){
  document.querySelectorAll('.scr').forEach(s=>s.classList.remove('on'));
  $('s-'+scr).classList.add('on'); curScr=scr;
  document.querySelectorAll('.ntab').forEach(t=>t.classList.toggle('act',t.dataset.s===scr));
  $('bnav').style.display=(scr==='login'||scr==='chat')?'none':'block';
}
document.querySelectorAll('.ntab').forEach(t=>t.onclick=()=>goTo(t.dataset.s));

// ── tabs ──
let curTab='l';
function switchTab(tab){
  curTab=tab;
  // Сброс верификации при смене вкладки
  if(pendingReg){ cancelVerify(); }
  $('form-l').style.display=tab==='l'?'':'none';
  $('form-r').style.display=tab==='r'?'':'none';
  $('form-verify').style.display='none';
  $('tab-l').classList.toggle('act',tab==='l');
  $('tab-r').classList.toggle('act',tab==='r');
  $('lbtn-t').textContent=tab==='l'?'[ ВОЙТИ ]':'[ ЗАРЕГИСТРИРОВАТЬСЯ ]';
  $('lhint').textContent=tab==='l'?'Нет аккаунта? Перейди на РЕГИСТРАЦИЯ':'Есть аккаунт? Перейди на ВХОД';
  setErr('');
}

