// RetroMesh — Онлайн, статус, «печатает»
// ════════════════════════════════════════
//  ONLINE PRESENCE
// ════════════════════════════════════════
let presenceListeners={};

function startPresence(){
  if(!ME_UID) return;
  const ref=db.ref('presence/'+ME_NICK);
  ref.set({online:true, ts:Date.now()});
  ref.onDisconnect().set({online:false, ts:Date.now()});
  // Обновляем каждые 30 сек
  setInterval(()=>{ if(ME_NICK) db.ref('presence/'+ME_NICK+'/ts').set(Date.now()); }, 30000);
}

function listenPresence(nick){
  if(presenceListeners[nick]) return;
  presenceListeners[nick]=true;
  db.ref('presence/'+nick).on('value', snap=>{
    const d=snap.val();
    const online=d&&d.online&&(Date.now()-d.ts<90000);
    // Обновить точку в списке чатов
    const dot=document.getElementById('odot_'+nick);
    if(dot) dot.classList.toggle('show', online);
    // Обновить хедер если открыт этот чат
    if(CUR_PEER===nick){
      $('c-online').classList.toggle('show', online);
      $('c-online-dot').classList.toggle('show', online);
      $('c-sub').textContent = online ? 'В СЕТИ' : 'ЛИЧНЫЙ ЧАТ';
    }
    // Обновить статус в листе
    const statusEl=document.getElementById('ustatus_'+nick);
    if(statusEl && d && d.status) statusEl.textContent=d.status;
  });
}

function stopPresenceListeners(){
  Object.keys(presenceListeners).forEach(nick=>{
    db.ref('presence/'+nick).off();
  });
  presenceListeners={};
}

// ════════════════════════════════════════
//  USER STATUS
// ════════════════════════════════════════
function initStatusField(){
  db.ref('presence/'+ME_NICK).once('value').then(snap=>{
    const d=snap.val();
    if(d&&d.status) $('status-inp').value=d.status;
  });
  $('status-save-btn').onclick=()=>{
    const s=$('status-inp').value.trim().slice(0,60);
    db.ref('presence/'+ME_NICK).update({status:s, online:true, ts:Date.now()}).then(()=>toast('✓ Статус сохранён',1500));
  };
  $('status-inp').onkeydown=e=>{ if(e.key==='Enter') $('status-save-btn').click(); };
}

// ════════════════════════════════════════
//  TYPING INDICATOR
// ════════════════════════════════════════
let typingTimer=null, typingListenerCH='';

function onInputTyping(){
  if(!CUR_CH||!CUR_PEER) return; // только личные чаты
  db.ref('typing/'+CUR_CH+'/'+ME_NICK).set(Date.now());
  clearTimeout(typingTimer);
  typingTimer=setTimeout(()=>{
    db.ref('typing/'+CUR_CH+'/'+ME_NICK).remove();
  }, 3000);
}

function listenTyping(chatId, peerNick){
  if(typingListenerCH===chatId) return;
  // Снять старый
  if(typingListenerCH) db.ref('typing/'+typingListenerCH+'/'+peerNick).off();
  typingListenerCH=chatId;
  db.ref('typing/'+chatId+'/'+peerNick).on('value', snap=>{
    const ts=snap.val();
    const active=ts&&(Date.now()-ts<5000);
    const ind=$('typing-indicator');
    if(active){
      ind.innerHTML=`@${peerNick} печатает <span class="typing-dots"><span>.</span><span>.</span><span>.</span></span>`;
      ind.classList.add('show');
    } else {
      ind.classList.remove('show');
    }
  });
}

function stopTypingListener(){
  if(typingListenerCH){
    db.ref('typing/'+typingListenerCH).off();
    typingListenerCH='';
  }
  $('typing-indicator').classList.remove('show');
}

