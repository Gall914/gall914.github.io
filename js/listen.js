// RetroMesh — Уведомления, mute, слушатель сообщений
// ════════════════════════════════════════
//  NOTIFICATIONS + MUTE
// ════════════════════════════════════════

// Mute — хранится в localStorage
function getMuted(){ try{ return JSON.parse(localStorage.getItem('rm_muted')||'{}'); }catch(e){return {};} }
function saveMuted(m){ localStorage.setItem('rm_muted',JSON.stringify(m)); }
function isMuted(key){ return !!getMuted()[key]; }

function toggleMute(key){
  const m=getMuted();
  if(m[key]) delete m[key]; else m[key]=true;
  saveMuted(m);
  // Обновляем кнопку
  const btn=document.getElementById('mute_'+key);
  if(btn) btn.innerHTML=getMuteLabel(key);
  toast(m[key]?'🔇 Уведомления отключены':'🔔 Уведомления включены', 1500);
  renderList();
}

function getMuteLabel(key){
  return isMuted(key) ? '🔔 Включить уведомления' : '🔇 Отключить уведомления';
}

// VAPID ключ — замени после получения из Firebase Console
const VAPID_KEY='BEhn5PUTEdajquCMspc8kReBoVVjXQAMIs7QiX02rz4TSTRzR2tsr4waOjUGA_vmlMPl9Uj1Sljfc_OxQyemfkk';
let fcmMessaging=null;

// Инициализация FCM (push при закрытом приложении)
async function initFCM(){
  if(!('Notification' in window)) return;
  try{
    fcmMessaging=firebase.messaging();
    const token=await fcmMessaging.getToken({vapidKey:VAPID_KEY});
    if(token&&ME_NICK){
      const key=token.slice(-20); // короткий ключ для хранения
      await db.ref('fcmTokens/'+ME_NICK+'/'+key).set(token);
    }
    // Уведомления когда приложение открыто (foreground)
    fcmMessaging.onMessage(payload=>{
      const chatId=payload.data&&payload.data.chatId;
      if(CUR_CH===chatId) return; // открыт этот чат — не показываем
      const {title,body}=payload.notification||{};
      const key=chatId||'msg';
      if(isMuted(key)) return;
      playNotifSound();
      if(Notification.permission==='granted'){
        new Notification(title||'RetroMesh',{
          body,icon:'/icon-192.png',badge:'/icon-72.png',
          tag:key,renotify:true
        });
      }
    });
    updateNotifBtn();
  }catch(e){
    console.log('FCM:',e.message);
  }
}

function requestNotifPermission(){
  const btn=$('notif-btn');
  if(!('Notification' in window)){
    if(btn) btn.textContent='[ ⚠ УВЕДОМЛЕНИЯ НЕ ПОДДЕРЖИВАЮТСЯ ]';
    return;
  }
  if(Notification.permission==='granted'){
    initFCM(); // переинициализируем FCM
    if(btn) btn.textContent='[ ✓ УВЕДОМЛЕНИЯ ВКЛЮЧЕНЫ ]';
    return;
  }
  if(Notification.permission==='denied'){
    if(btn) btn.textContent='[ ✗ ЗАБЛОКИРОВАНО В НАСТРОЙКАХ ]';
    toast('⚠ Разреши уведомления в настройках браузера',3000);
    return;
  }
  Notification.requestPermission().then(p=>{
    if(p==='granted'){
      if(btn) btn.textContent='[ ✓ УВЕДОМЛЕНИЯ ВКЛЮЧЕНЫ ]';
      toast('🔔 Уведомления включены!',1500);
      initFCM();
    } else {
      if(btn) btn.textContent='[ ✗ ОТКЛОНЕНО ]';
      toast('⚠ Уведомления отклонены',2000);
    }
  });
}

function updateNotifBtn(){
  const btn=$('notif-btn'); if(!btn) return;
  if(!('Notification' in window)){ btn.textContent='[ ⚠ НЕ ПОДДЕРЖИВАЕТСЯ ]'; return; }
  if(Notification.permission==='granted') btn.textContent='[ ✓ УВЕДОМЛЕНИЯ ВКЛЮЧЕНЫ ]';
  else if(Notification.permission==='denied') btn.textContent='[ ✗ ЗАБЛОКИРОВАНО ]';
  else btn.textContent='[ 🔔 ВКЛЮЧИТЬ УВЕДОМЛЕНИЯ ]';
}

// Звук уведомления через Web Audio
let notifAudioCtx=null;
function playNotifSound(){
  try{
    if(!notifAudioCtx) notifAudioCtx=new(window.AudioContext||window.webkitAudioContext)();
    if(notifAudioCtx.state==='suspended') notifAudioCtx.resume();
    const o=notifAudioCtx.createOscillator();
    const g=notifAudioCtx.createGain();
    o.connect(g); g.connect(notifAudioCtx.destination);
    o.type='sine'; o.frequency.value=880;
    g.gain.setValueAtTime(0,notifAudioCtx.currentTime);
    g.gain.linearRampToValueAtTime(0.3,notifAudioCtx.currentTime+0.01);
    g.gain.exponentialRampToValueAtTime(0.001,notifAudioCtx.currentTime+0.4);
    o.start(); o.stop(notifAudioCtx.currentTime+0.4);
  }catch(e){}
}

// Показать уведомление
async function showNotification(title, body, key){
  if(isMuted(key)) return;

  // Всегда играем звук если приложение открыто
  playNotifSound();

  if(Notification.permission!=='granted') return;

  // Используем service worker для уведомления — работает в APK и когда вкладка скрыта
  const swReg = await navigator.serviceWorker.getRegistration().catch(()=>null);
  if(swReg){
    swReg.showNotification(title,{
      body,
      icon:'icon-192.png',
      badge:'icon-72.png',
      tag:key,
      renotify:true,
      vibrate:[200,100,200],
      data:{key}
    }).catch(()=>{
      // Fallback на обычное уведомление
      try{ new Notification(title,{body,icon:'icon-192.png',tag:key}); }catch(e){}
    });
  } else {
    try{ new Notification(title,{body,icon:'icon-192.png',tag:key}); }catch(e){}
  }
}

function scrollToBottom(el){
  const e=el||$('msglist');
  e.scrollTop=e.scrollHeight+9999;
  // Повторно после layout — для случаев с изображениями
  requestAnimationFrame(()=>{ e.scrollTop=e.scrollHeight+9999; });
}

// ════════════════════════════════════════
//  LISTEN MESSAGES  ← главный слушатель
// ════════════════════════════════════════
function listenMsgs(peer){
  const ch=chid(ME_NICK,peer);
  if(listeners[ch])return;
  if(!msgCache[ch])msgCache[ch]=[];
  listeners[ch]=true;

  db.ref('chats/'+ch+'/msgs').orderByChild('ts').on('child_added',snap=>{
    const d=snap.val(); if(!d)return;
    const id=snap.key;
    if(msgCache[ch].some(m=>m.id===id))return;

    // ── ЕДИНСТВЕННЫЙ формат сообщения ──
    const msg={
      id,
      from : d.from  || '',
      type : d.type  || 'text',
      text : d.text  || '',
      data : d.data  || '',
      fname: d.fname || '',
      fsize: d.fsize || 0,
      dur  : d.dur   || 0,
      replyTo: d.replyTo || null,
      fwdFrom: d.fwdFrom || null,
      reactions: d.reactions || null,
      ts   : d.ts    || 0,
    };

    msgCache[ch].push(msg);
    msgCache[ch].sort((a,b)=>a.ts-b.ts);

    const prev=$('prev_'+peer);
    if(prev)prev.textContent=prevText(msg);

    if(CUR_PEER===peer){
      appendMsg(msg);
      // Обновляем время прочтения раз мы в этом чате
      db.ref('reads/'+ch+'/'+ME_NICK).set(Date.now());
    } else if(msg.from!==ME_NICK){
      const myLastRead=(readTs[ch]||{})[ME_NICK]||0;
      if(msg.ts>myLastRead){
        unread[peer]=(unread[peer]||0)+1; renderList();
        const text=msg.type==='image'?'📷 Фото':msg.type==='audio'?'🎤 Голосовое':msg.type==='video'?'◈ Видео':(msg.text||'').slice(0,80);
        showNotification('@'+msg.from, text, peer);
      }
    }
    // Обновить галочки для отправителя
    updateTicksForChat(ch);
  });

}

