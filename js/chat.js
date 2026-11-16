// RetroMesh — Открытие чата, ответы, отправка текста и файлов
// ════════════════════════════════════════
//  OPEN CHAT
// ════════════════════════════════════════
function openChat(peer){
  cancelSelect(); cancelReply(); closeSearchBar();
  if(mediaRec && recChatCH && recChatCH!==chid(ME_NICK,peer)){
    cancelRec();
    toast('⚠ Запись отменена (смена чата)',2000);
  }
  if(vidRec) cancelVideo();
  CUR_PEER=peer; CUR_CH=chid(ME_NICK,peer); CUR_GRP=''; unread[peer]=0;
  hidePinnedBar();
  db.ref('reads/'+CUR_CH+'/'+ME_NICK).set(Date.now());
  listenReads(CUR_CH);
  listenPresence(peer);
  listenTyping(CUR_CH, peer);
  $('c-av').innerHTML=`${ini(peer)}<div class="online-dot" id="c-online-dot"></div>`;
  $('c-name').textContent='@'+peer;
  $('c-sub').textContent='ЛИЧНЫЙ ЧАТ';
  $('call-btn').style.display='';
  $('vcall-btn').style.display='';
  // Установить онлайн-статус в хедер
  const pd=presenceListeners[peer];
  $('c-online').classList.remove('show');
  $('c-online-dot').classList.remove('show');
  loadAvatar(peer, b64=>{ if(b64) $('c-av').innerHTML=`<img src="${escA(b64)}" alt="av"><div class="online-dot" id="c-online-dot"></div>`; });
  const ml=$('msglist'); ml.innerHTML=''; ml.dataset.lastDate='';
  (msgCache[CUR_CH]||[]).forEach(m=>appendMsg(m,false));
  scrollToBottom(ml);
  loadReactionsForChat(CUR_CH);
  startReactionsListener(CUR_CH);
  goTo('chat');
  setTimeout(()=>{ scrollToBottom(ml); $('msginput').focus(); },100);
}

// ════════════════════════════════════════
function appendMsg(msg,scroll=true){
  const isMe=msg.from===ME_NICK;
  const isGroup=!!CUR_GRP;
  const ml=$('msglist');

  // ── Разделитель дат ──
  if(msg.ts){
    const d=new Date(msg.ts);
    const dateKey=d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();
    const lastKey=ml.dataset.lastDate||'';
    if(dateKey!==lastKey){
      ml.dataset.lastDate=dateKey;
      const sep=document.createElement('div');
      sep.className='date-sep';
      sep.innerHTML='<span>'+fmtDate(msg.ts)+'</span>';
      ml.appendChild(sep);
    }
  }
  const g=document.createElement('div');
  g.className='mg '+(isMe?'me':'them');
  g.dataset.id=msg.id;

  // Стрелка ответа
  const arrow=document.createElement('div');
  arrow.className='reply-arrow';
  arrow.innerHTML='↩';

  // Внутренний блок (свайпается)
  const inner=document.createElement('div');
  inner.className='mg-inner';

  // Ник + аватарка отправителя (только в группах, не у своих)
  if(isGroup && !isMe){
    const sender=document.createElement('div');
    sender.className='msg-sender';
    const avId='sav_'+msg.id;
    sender.innerHTML=`<div class="msg-sender-av" id="${avId}">${ini(msg.from)}</div>`+
      `<span class="msg-sender-nick">@${esc(msg.from)}</span>`;
    inner.appendChild(sender);
    // Загрузить аватарку асинхронно
    loadAvatar(msg.from, b64=>{
      const el=document.getElementById(avId);
      if(el && b64) el.innerHTML=`<img src="${escA(b64)}" alt="av">`;
    });
  }

  // Цитата если это ответ
  if(msg.replyTo){
    const qel=document.createElement('div');
    qel.className='reply-quote';
    qel.innerHTML=`<div class="rq-author">${esc(msg.replyTo.from||'')}</div>
      <div class="rq-text">${esc(replyPreview(msg.replyTo))}</div>`;
    qel.style.cursor='pointer';
    qel.onclick=e=>{ e.stopPropagation(); scrollToMsg(msg.replyTo.id); };
    inner.appendChild(qel);
  }

  // Пузырь + мета
  const bubWrap=document.createElement('div');
  const ticksHtml=isMe?`<span class="ticks" id="ticks_${msg.id}">✓</span>`:'';
  bubWrap.innerHTML=buildBub(msg)+`<div class="meta"><span>${fmtT(msg.ts)}</span>${ticksHtml}</div>`;
  while(bubWrap.firstChild) inner.appendChild(bubWrap.firstChild);

  g.appendChild(arrow);
  g.appendChild(inner);

  // Реакции если есть — ПОСЛЕ appendChild чтобы .mg-inner был в DOM
  if(msg.reactions && Object.keys(msg.reactions).length){
    renderReactions(g, msg.reactions);
  }

  // Двойной тап → реакция
  let lastTap=0;
  inner.addEventListener('pointerup', e=>{
    if(selectMode||swiping) return;
    const now=Date.now();
    if(now-lastTap<300){
      openReactPicker(msg.id, inner, e);
    }
    lastTap=now;
  },{passive:true});

  // ── СВАЙП ВПРАВО → ОТВЕТИТЬ ──
  let sx=0,sy=0,dx=0,swiping=false,swipeTriggered=false;
  const THRESHOLD=60;

  inner.addEventListener('pointerdown',e=>{
    if(selectMode)return;
    sx=e.clientX; sy=e.clientY; dx=0;
    swiping=false; swipeTriggered=false;
  },{passive:true});

  inner.addEventListener('pointermove',e=>{
    if(selectMode)return;
    const cx=e.clientX,cy=e.clientY;
    const adx=Math.abs(cx-sx),ady=Math.abs(cy-sy);
    // Только горизонтальный свайп вправо
    if(!swiping){
      if(adx>8&&adx>ady){ swiping=true; inner.classList.add('swiping'); }
      else if(ady>8){ return; }
    }
    if(!swiping)return;
    dx=Math.max(0,cx-sx); // только вправо
    // Нелинейное сопротивление
    const pull=Math.min(dx,THRESHOLD*1.4);
    const t=pull<THRESHOLD ? pull : THRESHOLD+(pull-THRESHOLD)*.25;
    inner.style.transform=`translateX(${t}px)`;
    // Показываем стрелку при достижении порога
    if(dx>=THRESHOLD&&!swipeTriggered){
      arrow.classList.add('show');
    } else if(dx<THRESHOLD){
      arrow.classList.remove('show');
    }
  },{passive:true});

  function endSwipe(){
    if(!swiping)return;
    swiping=false;
    inner.classList.remove('swiping');
    inner.style.transform='';
    if(dx>=THRESHOLD&&!swipeTriggered){
      swipeTriggered=true;
      arrow.classList.remove('show');
      // Маленький отскок
      inner.style.transition='transform .18s cubic-bezier(.34,1.56,.64,1)';
      inner.style.transform='translateX(12px)';
      setTimeout(()=>{inner.style.transform='';setTimeout(()=>{inner.style.transition='';},200)},120);
      // Активируем ответ
      setReply(msg);
    } else {
      arrow.classList.remove('show');
    }
    dx=0;
  }

  inner.addEventListener('pointerup',endSwipe,{passive:true});
  inner.addEventListener('pointercancel',endSwipe,{passive:true});

  // ── ДОЛГОЕ НАЖАТИЕ → ВЫДЕЛЕНИЕ ──
  let pressTimer=null;
  inner.addEventListener('pointerdown',e=>{
    pressTimer=setTimeout(()=>{
      pressTimer=null;
      if(swiping) return;
      if(!selectMode){
        showMsgContextMenu(msg, g);
      } else {
        toggleMsgSelect(msg.id, g);
      }
    },450);
  },{passive:true});
  inner.addEventListener('pointerup',()=>{ if(pressTimer){clearTimeout(pressTimer);pressTimer=null;} },{passive:true});
  inner.addEventListener('pointercancel',()=>{ if(pressTimer){clearTimeout(pressTimer);pressTimer=null;} },{passive:true});

  // В режиме выделения — клик переключает
  g.addEventListener('click',e=>{
    if(selectMode){ e.preventDefault(); e.stopPropagation(); toggleMsgSelect(msg.id,g); }
  });

  $('msglist').appendChild(g);
  if(scroll) scrollToBottom();
}

function buildBub(msg){
  const fwdHeader=msg.fwdFrom
    ?`<div style="font-size:10px;color:var(--g1);letter-spacing:1px;margin-bottom:5px;border-left:2px solid var(--g1);padding-left:6px">↗ от @${esc(msg.fwdFrom)}</div>`
    :'';
  switch(msg.type){

    case 'image':
      if(!msg.data)return`<div class="bub">${fwdHeader}📷 [нет данных]</div>`;
      return`<div class="img-wrap" onclick="openLb('${encodeURIComponent(msg.data)}')">${fwdHeader}
        <img src="${escA(msg.data)}" alt="фото" loading="lazy">
      </div>`;

    case 'audio':
      if(!msg.data)return`<div class="bub">🎤 [нет данных]</div>`;
      const uid='a'+Math.random().toString(36).slice(2,7);
      const dur=msg.dur?fmtD(msg.dur):'—';
      const bars=Array.from({length:18},()=>`<b style="height:${6+Math.random()*14|0}px"></b>`).join('');
      return`<div class="voice-bub">
        <button class="vbtn" onclick="playAudio(this,'${encodeURIComponent(msg.data)}','${uid}')">▶</button>
        <div class="vwave">${bars}</div>
        <div class="vdur" id="vd_${uid}">${dur}</div>
        <audio id="va_${uid}" preload="none" style="display:none"></audio>
      </div>`;

    case 'file':
      if(!msg.data)return`<div class="bub">${fwdHeader}📎 [нет данных]</div>`;
      return`<a class="file-bub" onclick="dlFile('${encodeURIComponent(msg.data)}','${encodeURIComponent(msg.fname||'file')}')" href="javascript:void(0)">
        ${fwdHeader}<div class="f-ico">📄</div>
        <div class="f-info">
          <div class="f-name">${esc(msg.fname||'файл')}</div>
          <div class="f-size">${msg.fsize?fmtSz(msg.fsize):''} · нажми чтобы скачать</div>
        </div>
      </a>`;

    case 'video':{
      if(!msg.data)return`<div class="bub">${fwdHeader}◈ [нет данных]</div>`;
      const vid='v'+Math.random().toString(36).slice(2,7);
      const durStr=msg.dur?fmtD(msg.dur):'';
      // Данные храним в JS объекте, не встраиваем в HTML атрибут
      vidStore[vid]=msg.data;
      // Определяем mime из data url для <source type="">
      const vmime=(msg.data.match(/data:([^;]+);/)||[])[1]||'video/mp4';
      return`<div class="vmsg-wrap" id="vw_${vid}" onclick="playVideo('${vid}')">
        ${fwdHeader}
        <div class="vmsg-diamond-border"></div>
        <div class="vmsg-diamond" id="vd_${vid}">
          <video id="vv_${vid}" playsinline preload="none" style="display:none"></video>
          <div class="vmsg-thumb-ph" id="vthumb_${vid}">
            <span style="font-size:52px;color:var(--g0);opacity:.6;filter:drop-shadow(0 0 8px var(--g1))">◈</span>
          </div>
        </div>
        <div class="vmsg-play" id="vp_${vid}">▶</div>
        ${durStr?`<div class="vmsg-dur">${durStr}</div>`:''}
      </div>`;
    }

    default:
      return`<div class="bub">${fwdHeader}${esc(msg.text)}</div>`;
  }
}

// ── Lightbox ──
function openLb(encoded){
  $('lb-img').src=decodeURIComponent(encoded);
  $('lb').classList.add('open');
}
$('lb-x').onclick=()=>$('lb').classList.remove('open');
$('lb').onclick=e=>{if(e.target===$('lb')||e.target===$('lb-img'))$('lb').classList.remove('open')};

// ── Audio player ──
const audioState={};
function playAudio(btn,encoded,uid){
  const aud=$('va_'+uid); if(!aud)return;
  // если уже играет — пауза
  if(audioState[uid]&&!aud.paused){aud.pause();btn.textContent='▶';return}
  // подставляем src только один раз
  if(!aud._loaded){
    try{
      const b64=decodeURIComponent(encoded);
      const arr=b64.split(','),mime=(arr[0].match(/:(.*?);/)||[])[1]||'audio/webm';
      const bin=atob(arr[1]);
      const bytes=new Uint8Array(bin.length);
      for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
      aud.src=URL.createObjectURL(new Blob([bytes],{type:mime}));
      aud._loaded=true;
    }catch(e){toast('⚠ Ошибка воспроизведения');return}
  }
  btn.textContent='⏸'; audioState[uid]=true;
  aud.play().catch(()=>{btn.textContent='▶'});
  aud.onended=()=>{btn.textContent='▶';audioState[uid]=false};
  aud.ontimeupdate=()=>{
    const d=$('vd_'+uid);
    if(d&&aud.duration)d.textContent=fmtD(Math.max(0,aud.duration-aud.currentTime));
  };
}

// ── File download ──
function dlFile(encoded,fname){
  try{
    const b64=decodeURIComponent(encoded);
    const a=document.createElement('a');
    a.href=b64; a.download=decodeURIComponent(fname); a.click();
  }catch(e){toast('⚠ Ошибка скачивания')}
}

// ════════════════════════════════════════
//  REPLY
// ════════════════════════════════════════
let replyMsg=null; // {id, from, type, text, data, fname}

function replyPreview(m){
  if(!m)return'';
  if(m.type==='image')return'📷 Фото';
  if(m.type==='audio')return'🎤 Голосовое';
  if(m.type==='file')return'📎 '+(m.fname||'Файл');
  return(m.text||'').slice(0,60);
}

function setReply(msg){
  replyMsg={id:msg.id,from:msg.from,type:msg.type,text:msg.text,data:msg.data,fname:msg.fname};
  $('rb-author').textContent=msg.from===ME_NICK?'Вы':'@'+msg.from;
  $('rb-text').textContent=replyPreview(msg);
  $('reply-bar').classList.add('show');
  $('msginput').focus();
}

function cancelReply(){
  replyMsg=null;
  $('reply-bar').classList.remove('show');
}

function scrollToMsg(id){
  const el=document.querySelector(`.mg[data-id="${id}"]`);
  if(!el)return;
  el.scrollIntoView({behavior:'smooth',block:'center'});
  // Мигание
  const inner=el.querySelector('.mg-inner');
  if(inner){
    inner.style.transition='background .1s';
    inner.style.background='rgba(51,255,0,.12)';
    setTimeout(()=>inner.style.background='',600);
  }
}

// ════════════════════════════════════════
//  SEND TEXT
// ════════════════════════════════════════
$('sendbtn').onclick=sendText;
$('msginput').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendText()}};
function sendText(){
  const text=$('msginput').value.trim(); if(!text||!CUR_CH)return;
  $('msginput').value=''; $('msginput').focus();
  const payload={from:ME_NICK,type:'text',text,ts:Date.now()};
  if(replyMsg){ payload.replyTo=replyMsg; cancelReply(); }
  pushMsg(payload);
}

// ════════════════════════════════════════
//  SEND FILE / IMAGE  📎
// ════════════════════════════════════════
$('file-inp').onchange=function(){
  const file=this.files[0]; this.value='';
  if(!file)return;
  if(!CUR_CH){toast('⚠ Сначала откройте чат');return}

  const isImage=file.type.startsWith('image/');
  if(isImage) sendImage(file);
  else sendFile(file);
};

function sendImage(file){
  $('filebtn').classList.add('busy'); setProg(10);
  const reader=new FileReader();
  reader.onload=ev=>{
    setProg(35);
    const img=new Image();
    img.onload=()=>{
      // Сжимаем до макс 900px
      const MAX=900; let w=img.width,h=img.height;
      if(w>MAX||h>MAX){if(w>h){h=Math.round(h*MAX/w);w=MAX}else{w=Math.round(w*MAX/h);h=MAX}}
      const c=document.createElement('canvas'); c.width=w; c.height=h;
      c.getContext('2d').drawImage(img,0,0,w,h);
      setProg(65);
      let b64=c.toDataURL('image/jpeg',0.75);
      // Если всё равно > 700КБ — сжать сильнее
      if(b64.length>700*1024)b64=c.toDataURL('image/jpeg',0.45);
      if(b64.length>900*1024){setProg(null);$('filebtn').classList.remove('busy');toast('⚠ Изображение слишком большое');return}
      setProg(85);
      pushMsg({from:ME_NICK,type:'image',text:'📷 Фото',data:b64,ts:Date.now(),...(replyMsg?{replyTo:replyMsg}:{})})
        .then(()=>{setProg(null);$('filebtn').classList.remove('busy');cancelReply();})
        .catch(e=>{setProg(null);$('filebtn').classList.remove('busy');toast('⚠ '+e.message)});
    };
    img.onerror=()=>{setProg(null);$('filebtn').classList.remove('busy');toast('⚠ Не удалось прочитать изображение')};
    img.src=ev.target.result;
  };
  reader.onerror=()=>{setProg(null);$('filebtn').classList.remove('busy');toast('⚠ Ошибка чтения файла')};
  reader.readAsDataURL(file);
}

function sendFile(file){
  // Лимит: 500 КБ для файлов (base64 ~700КБ → ≤ 900КБ лимит Firebase)
  if(file.size>500*1024){toast('⚠ Файл слишком большой (макс 500 КБ)');return}
  $('filebtn').classList.add('busy'); setProg(20);
  const reader=new FileReader();
  reader.onload=ev=>{
    setProg(75);
    pushMsg({from:ME_NICK,type:'file',text:'📎 Файл',data:ev.target.result,
      fname:file.name,fsize:file.size,ts:Date.now(),...(replyMsg?{replyTo:replyMsg}:{})})
      .then(()=>{setProg(null);$('filebtn').classList.remove('busy');cancelReply();})
      .catch(e=>{setProg(null);$('filebtn').classList.remove('busy');toast('⚠ '+e.message)});
  };
  reader.onerror=()=>{setProg(null);$('filebtn').classList.remove('busy');toast('⚠ Ошибка чтения файла')};
  reader.readAsDataURL(file);
}

