// RetroMesh — Галочки прочтения, контекстное меню сообщения
// ════════════════════════════════════════
//  READ RECEIPTS
// ════════════════════════════════════════
const readTs = {};      // {chatId: {nick: timestamp}} — кто и когда прочитал
const readListeners={}; // {chatId: true}

function listenReads(chatId){
  if(readListeners[chatId]) return;
  readListeners[chatId]=true;
  db.ref('reads/'+chatId).on('value', snap=>{
    const data=snap.val()||{};
    readTs[chatId]=data;
    updateTicksForChat(chatId);
    // Пересчитать unread для этого чата
    recalcUnread(chatId);
  });
}

function updateTicksForChat(chatId){
  const msgs=msgCache[chatId]||[];
  const reads=readTs[chatId]||{};
  msgs.forEach(msg=>{
    if(msg.from!==ME_NICK) return;
    const tickEl=document.getElementById('ticks_'+msg.id);
    if(!tickEl) return;
    const isRead=Object.entries(reads).some(([nick,ts])=> nick!==ME_NICK && ts>=msg.ts);
    tickEl.textContent=isRead?'✓✓':'✓';
    tickEl.className='ticks'+(isRead?' read':'');
  });
}

function recalcUnread(chatId){
  // Найти nick собеседника или тип чата
  const myLastRead=(readTs[chatId]||{})[ME_NICK]||0;
  const msgs=msgCache[chatId]||[];
  const count=msgs.filter(m=>m.from!==ME_NICK && m.ts>myLastRead).length;

  // Найти ключ в unread
  if(contacts.includes(getChatPeer(chatId))){
    const peer=getChatPeer(chatId);
    if(unread[peer]!==count){ unread[peer]=count; renderList(); }
  } else if(groups[chatId]){
    if(unread[chatId]!==count){ unread[chatId]=count; renderList(); }
  }
}

function getChatPeer(chatId){
  // chatId вида 'nick1~~nick2'
  if(!chatId.includes('~~')) return null;
  return chatId.split('~~').find(n=>n!==ME_NICK)||null;
}

// Показать popup "кто прочитал"
function showReadBy(msg, e){
  const chatId=CUR_CH;
  const reads=readTs[chatId]||{};
  const readers=Object.entries(reads)
    .filter(([nick,ts])=> nick!==ME_NICK && ts>=msg.ts)
    .map(([nick])=>nick);

  const popup=$('readby-popup');
  if(!readers.length){
    $('readby-list').textContent='Никто ещё не прочитал';
  } else {
    $('readby-list').innerHTML=readers.map(n=>`<div>@${esc(n)}</div>`).join('');
  }
  // Позиционируем рядом с пальцем
  const x=Math.min(e.clientX, window.innerWidth-230);
  const y=Math.max(e.clientY-80, 60);
  popup.style.left=x+'px';
  popup.style.top=y+'px';
  popup.classList.add('show');
  // Закрыть через 2.5 сек или по тапу
  clearTimeout(popup._t);
  popup._t=setTimeout(()=>popup.classList.remove('show'),2500);
  popup.style.pointerEvents='auto';
  popup.onclick=()=>popup.classList.remove('show');
}
document.addEventListener('pointerdown',e=>{
  const p=$('readby-popup');
  if(p.classList.contains('show')&&!p.contains(e.target)) p.classList.remove('show');
});

// ════════════════════════════════════════
//  MESSAGE CONTEXT MENU
// ════════════════════════════════════════
let ctxMenuEl=null;

function showMsgContextMenu(msg, msgEl){
  removeCtxMenu();
  const isMe=msg.from===ME_NICK;
  const isGroup=!!CUR_GRP;
  const isCreator=isGroup&&groups[CUR_GRP]&&groups[CUR_GRP].creator===ME_NICK;

  const menu=document.createElement('div');
  menu.style.cssText=`position:fixed;z-index:900;background:var(--s1);border:1px solid var(--g2);
    min-width:190px;box-shadow:0 4px 24px rgba(0,0,0,.8);font-family:'VT323',monospace;`;

  const items=[];
  items.push({icon:'😊', label:'Реакция',     fn:()=>{ removeCtxMenu(); openReactPickerByEl(msg.id, msgEl); }});
  items.push({icon:'↩',  label:'Ответить',    fn:()=>{ removeCtxMenu(); setReply(msg); }});
  items.push({icon:'↗',  label:'Переслать',   fn:()=>{ removeCtxMenu(); fwdMsgs=[msg]; openFwdSelect(); }});
  if(isMe) items.push({icon:'👁', label:'Кто прочитал', fn:()=>{ removeCtxMenu(); showReadByEl(msg, msgEl); }});
  if(isGroup&&(isMe||isCreator)) items.push({icon:'📌', label:'Закрепить', fn:()=>{ removeCtxMenu(); pinMessage(msg.id); }});
  items.push({icon:'☑',  label:'Выделить',    fn:()=>{ removeCtxMenu(); toggleMsgSelect(msg.id, msgEl); }});

  items.forEach(({icon,label,fn},i)=>{
    const btn=document.createElement('div');
    btn.innerHTML=`<span style="margin-right:8px">${icon}</span>${label}`;
    btn.style.cssText=`padding:11px 16px;cursor:pointer;font-size:15px;letter-spacing:1px;
      color:var(--txt);user-select:none;-webkit-user-select:none;
      ${i<items.length-1?'border-bottom:1px solid var(--bdr)':''}`;
    btn.addEventListener('pointerdown', e=>{ e.stopPropagation(); });
    btn.addEventListener('pointerup',   e=>{ e.stopPropagation(); fn(); });
    menu.appendChild(btn);
  });

  document.body.appendChild(menu);
  ctxMenuEl=menu;

  // Позиционируем по элементу сообщения
  const rect=msgEl.getBoundingClientRect();
  const mh=menu.offsetHeight||items.length*44;
  const mw=menu.offsetWidth||200;
  let x=isMe ? rect.right-mw : rect.left;
  let y=rect.top-mh-6;
  if(y<8) y=rect.bottom+6;
  if(x+mw>window.innerWidth-8) x=window.innerWidth-mw-8;
  if(x<8) x=8;
  menu.style.left=x+'px';
  menu.style.top=y+'px';

  setTimeout(()=>{
    document.addEventListener('pointerdown', removeCtxMenuOnTap, {capture:true});
  }, 50);
}

function removeCtxMenu(){
  if(ctxMenuEl){ ctxMenuEl.remove(); ctxMenuEl=null; }
  document.removeEventListener('pointerdown', removeCtxMenuOnTap, {capture:true});
}
function removeCtxMenuOnTap(e){
  if(ctxMenuEl&&!ctxMenuEl.contains(e.target)) removeCtxMenu();
}

// Открыть пикер реакций по элементу (без e)
function openReactPickerByEl(msgId, msgEl){
  reactTargetMsgId=msgId;
  reactTargetCH=CUR_CH;
  const picker=$('react-picker');
  const rect=msgEl.getBoundingClientRect();
  picker.classList.add('show');
  let x=rect.left, y=rect.top-70;
  if(x+240>window.innerWidth) x=window.innerWidth-250;
  if(y<10) y=rect.bottom+8;
  picker.style.left=x+'px';
  picker.style.top=y+'px';
}

// Показать кто прочитал по элементу
function showReadByEl(msg, msgEl){
  const chatId=CUR_CH;
  const popup=$('readby-popup');
  $('readby-list').innerHTML='загрузка...';
  const rect=msgEl.getBoundingClientRect();
  let x=rect.right-220, y=rect.top-90;
  if(x<8) x=8;
  if(y<8) y=rect.bottom+8;
  popup.style.left=x+'px';
  popup.style.top=y+'px';
  popup.classList.add('show');
  clearTimeout(popup._t);

  db.ref('reads/'+chatId).once('value').then(snap=>{
    const reads=snap.val()||{};
    const readers=Object.entries(reads)
      .filter(([nick,ts])=>nick!==ME_NICK && ts>=msg.ts)
      .map(([nick])=>nick);
    $('readby-list').innerHTML=readers.length
      ? readers.map(n=>`<div>@${esc(n)}</div>`).join('')
      : 'Никто ещё не прочитал';
    popup._t=setTimeout(()=>popup.classList.remove('show'),3000);
  }).catch(()=>{
    $('readby-list').textContent='Ошибка загрузки';
  });
}

