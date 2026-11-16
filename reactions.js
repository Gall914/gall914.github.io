// RetroMesh — Реакции
// ════════════════════════════════════════
//  REACTIONS
// ════════════════════════════════════════
let reactTargetMsgId='', reactTargetCH='';

function openReactPicker(msgId, el, e){
  reactTargetMsgId=msgId;
  reactTargetCH=CUR_CH;
  const picker=$('react-picker');
  picker.classList.add('show');
  const rect=el.getBoundingClientRect();
  let x=rect.left, y=rect.top-60;
  if(x+220>window.innerWidth) x=window.innerWidth-230;
  if(y<10) y=rect.bottom+8;
  picker.style.left=x+'px';
  picker.style.top=y+'px';
  e.stopPropagation();
}

function pickReaction(emoji){
  $('react-picker').classList.remove('show');
  if(!reactTargetMsgId) return;
  const ref=db.ref('chats/'+reactTargetCH+'/msgs/'+reactTargetMsgId+'/reactions/'+ME_NICK);
  // Если уже поставил эту — убрать
  ref.once('value').then(snap=>{
    if(snap.val()===emoji) ref.remove();
    else ref.set(emoji);
  });
}

document.addEventListener('pointerdown', e=>{
  if(!$('react-picker').contains(e.target)) $('react-picker').classList.remove('show');
});

function loadReactionsForChat(chatId){
  db.ref('chats/'+chatId+'/msgs').once('value').then(snap=>{
    if(CUR_CH!==chatId) return;
    snap.forEach(child=>{
      const d=child.val();
      if(d && d.reactions){
        const msgEl=document.querySelector(`.mg[data-id="${child.key}"]`);
        if(msgEl) renderReactions(msgEl, d.reactions);
      }
    });
  });
}

// Separate child_changed ref for reactions - won't be killed by msgs.off()
let _reactRef=null, _reactCH='';
function startReactionsListener(chatId){
  if(_reactRef){ _reactRef.off('child_changed'); _reactRef=null; }
  _reactCH=chatId;
  _reactRef=db.ref('chats/'+chatId+'/msgs');
  _reactRef.on('child_changed', snap=>{
    if(CUR_CH!==chatId) return;
    const d=snap.val(); if(!d) return;
    const el=document.querySelector(`.mg[data-id="${snap.key}"]`);
    if(el) renderReactions(el, d.reactions||null);
    // Also update ticks
    updateTicksForChat(chatId);
  });
}

function renderReactions(msgEl, reactions){
  let wrap=msgEl.querySelector('.reactions');
  if(!reactions||!Object.keys(reactions).length){
    if(wrap) wrap.remove(); return;
  }
  // Агрегировать
  const counts={};
  Object.entries(reactions).forEach(([nick,emoji])=>{
    if(!counts[emoji]) counts[emoji]={count:0,users:[]};
    counts[emoji].count++;
    counts[emoji].users.push(nick);
  });
  if(!wrap){
    wrap=document.createElement('div');
    wrap.className='reactions';
    msgEl.querySelector('.mg-inner').appendChild(wrap);
  }
  wrap.innerHTML='';
  Object.entries(counts).forEach(([emoji,data])=>{
    const mine=reactions[ME_NICK]===emoji;
    const chip=document.createElement('div');
    chip.className='reaction-chip'+(mine?' mine':'');
    chip.title=data.users.join(', ');
    chip.innerHTML=`${emoji}<span class="rc">${data.count}</span>`;
    chip.onclick=()=>pickReactionDirect(emoji, msgEl.dataset.id);
    wrap.appendChild(chip);
  });
}

function pickReactionDirect(emoji, msgId){
  const ref=db.ref('chats/'+CUR_CH+'/msgs/'+msgId+'/reactions/'+ME_NICK);
  ref.once('value').then(snap=>{
    if(snap.val()===emoji) ref.remove(); else ref.set(emoji);
  });
}

// ════════════════════════════════════════
//  REACTIONS LISTENER
// ════════════════════════════════════════
// ════════════════════════════════════════
//  FORWARD MESSAGE
// ════════════════════════════════════════
let fwdMsgs=[];

function forwardSelected(){
  const ids=[...selectedMsgs];
  if(!ids.length) return;
  fwdMsgs=ids.map(id=>(msgCache[CUR_CH]||[]).find(m=>m.id===id)).filter(Boolean);
  cancelSelect();
  openFwdSelect();
}

function openFwdSelect(){
  const list=$('fwd-select-list');
  list.innerHTML='';

  function makeRow(html, fn, avEl, avNick){
    const row=document.createElement('div');
    row.className='crow'; row.style.cursor='pointer';
    row.innerHTML=html;
    if(avEl && avNick) setAvatarEl(row.querySelector('.av'), avNick);
    let sy=0;
    row.addEventListener('pointerdown',e=>{sy=e.clientY;},{passive:true});
    row.addEventListener('pointerup',e=>{
      if(Math.abs(e.clientY-sy)>10) return;
      fn();
    });
    return row;
  }

  contacts.forEach(peer=>{
    list.appendChild(makeRow(
      `<div class="av">${ini(peer)}</div><div class="ci"><div class="cn">@${esc(peer)}</div></div>`,
      ()=>doForward(chid(ME_NICK,peer), '@'+peer),
      true, peer
    ));
  });
  Object.entries(groups).forEach(([gid,g])=>{
    list.appendChild(makeRow(
      `<div class="av" style="background:var(--g3)">${grpIni(g.name)}</div><div class="ci"><div class="cn">${esc(g.name)}</div></div>`,
      ()=>doForward(gid, g.name)
    ));
  });
  $('fwd-select').classList.add('show');
}

function closeFwdSelect(){ $('fwd-select').classList.remove('show'); fwdMsgs=[]; }

function doForward(targetCH, targetName){
  const msgs=[...fwdMsgs]; // сохраняем копию ДО очистки
  closeFwdSelect();
  if(!msgs.length){ toast('⚠ Нет сообщений для пересылки'); return; }
  const promises=msgs.map(msg=>{
    const originalFrom=msg.fwdFrom||msg.from;
    let text;
    if(msg.type==='image') text='📷 Фото';
    else if(msg.type==='audio') text='🎤 Голосовое';
    else if(msg.type==='file') text='📎 '+(msg.fname||'Файл');
    else text=msg.text||'';
    const payload={from:ME_NICK, type:msg.type||'text', text, ts:Date.now(), fwdFrom:originalFrom};
    if(msg.data) payload.data=msg.data;
    if(msg.fname) payload.fname=msg.fname;
    if(msg.fsize) payload.fsize=msg.fsize;
    if(msg.dur) payload.dur=msg.dur;
    return db.ref('chats/'+targetCH+'/msgs').push(payload);
  });
  Promise.all(promises).then(()=>toast(`↗ Переслано в ${targetName}`,2000))
    .catch(e=>toast('⚠ Ошибка пересылки: '+e.message));
}

