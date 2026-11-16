// RetroMesh — Вход в приложение, контакты, список чатов
// ════════════════════════════════════════
//  ENTER APP
// ════════════════════════════════════════
function enterApp(uid,nick,email){
  ME_UID=uid; ME_NICK=nick;
  setBusy(false); setErr('');
  $('pav').dataset.nick = nick;
  $('pname').textContent='@'+nick.toUpperCase();
  $('p-nick').textContent='@'+nick;
  $('p-email').textContent=email||'';
  contacts=[]; msgCache={}; listeners={}; unread={};
  groups={}; groupListeners={}; CUR_GRP='';
  startPresence();
  initStatusField();
  listenIncomingCalls();
  requestNotifPermission();
  // FCM инициализируем после небольшой задержки (нужен ME_NICK)
  setTimeout(()=>initFCM(), 2000);
  setTimeout(updateNotifBtn, 500);
  // Загрузить свою аватарку
  MY_AVATAR='';
  loadAvatar(nick, b64=>{
    MY_AVATAR=b64;
    if(b64){ $('pav').innerHTML=`<img src="${escA(b64)}" alt="av">`; }
    else   { $('pav').innerHTML=ini(nick); }
  });
  loadContacts();
  loadGroups();
  goTo('chats');
  $('bnav').style.display='block';
  toast('✓ @'+nick.toUpperCase(),2000);
}

// ════════════════════════════════════════
//  CONTACTS
// ════════════════════════════════════════
function loadContacts(){
  db.ref('contacts/'+ME_UID).on('child_added',snap=>{
    const p=snap.val(); if(!p||contacts.includes(p))return;
    contacts.push(p);
    const ch=chid(ME_NICK,p);
    if(!msgCache[ch])msgCache[ch]=[];
    listenMsgs(p);
    listenReads(ch);
    renderList();
  });
}

// ════════════════════════════════════════
//  CHAT LIST
// ════════════════════════════════════════
function renderList(){
  const list=$('chat-list'),empty=$('empty');
  list.innerHTML='';
  const hasAny = contacts.length>0 || Object.keys(groups).length>0;
  if(!hasAny){empty.classList.remove('hide');return}
  empty.classList.add('hide');

  // ── Личные чаты ──
  contacts.forEach(peer=>{
    const ch=chid(ME_NICK,peer),msgs=msgCache[ch]||[],last=msgs[msgs.length-1];
    const prev=last?prevText(last):'— нет сообщений —';
    const row=document.createElement('div');
    row.className='crow';
    const safePeer=peer.replace(/'/g,"\\'");
    row.innerHTML=
      '<div class="av" id="lav_'+peer+'" style="position:relative">'+ini(peer)+
        '<div class="online-dot" id="odot_'+peer+'"></div>'+
      '</div>'+
      '<div class="ci"><div class="cn">@'+esc(peer)+'</div>'+
      '<div class="cp" id="prev_'+peer+'">'+prev+'</div></div>'+
      (unread[peer]?'<div class="badge">'+unread[peer]+'</div>':'')+
      '<button class="c-dots" onclick="event.stopPropagation();toggleChatMenu(event,\''+safePeer+'\')">&#8943;</button>'+
      '<div class="c-menu" id="cmenu_'+peer+'">'+
        '<button class="c-menu-item" onclick="toggleMute(\''+safePeer+'\')" id="mute_'+peer+'">'+getMuteLabel(peer)+'</button>'+
        '<button class="c-menu-item" onclick="confirmDeleteChat(\''+safePeer+'\')">&#128465; Удалить чат</button>'+
      '</div>';
    row.onclick = e => {
      if(e.target.closest('.c-dots,.c-menu')) return;
      openChat(peer);
    };
    setAvatarEl(row.querySelector('.av'), peer);
    listenPresence(peer);
    list.appendChild(row);
  });

  // ── Групповые чаты ──
  Object.entries(groups).forEach(([gid,g])=>{
    const msgs=msgCache[gid]||[],last=msgs[msgs.length-1];
    const prevMsg=last?(last.from===ME_NICK?'Вы: ':'@'+esc(last.from)+': ')+prevText(last):'— нет сообщений —';
    const row=document.createElement('div');
    row.className='crow';
    const safeGid=gid.replace(/'/g,"\\'");
    const avHtml=g.avatar?`<img src="${escA(g.avatar)}" alt="g">`:'<span>'+grpIni(g.name)+'</span>';
    row.innerHTML=
      '<div class="av" style="background:var(--g3);font-size:20px;overflow:hidden">'+avHtml+'</div>'+
      '<div class="ci">'+
        '<div class="cn">'+esc(g.name)+'</div>'+
        '<div class="cp" id="prev_'+gid+'">'+prevMsg+'</div>'+
      '</div>'+
      (unread[gid]?'<div class="badge">'+unread[gid]+'</div>':'')+
      '<button class="c-dots" onclick="event.stopPropagation();toggleChatMenu(event,\'__g__'+safeGid+'\')">&#8943;</button>'+
      '<div class="c-menu" id="cmenu___g__'+gid+'">'+
        '<button class="c-menu-item" onclick="toggleMute(\'__g__'+safeGid+'\')" id="mute___g__'+gid+'">'+getMuteLabel('__g__'+gid)+'</button>'+
        '<button class="c-menu-item" onclick="confirmLeaveGroup(\''+safeGid+'\')">&#128465; Покинуть группу</button>'+
      '</div>';
    row.onclick = e => {
      if(e.target.closest('.c-dots,.c-menu')) return;
      openGroupChat(gid);
    };
    list.appendChild(row);
  });
}
function prevText(m){
  if(m.type==='image')return'📷 Фото';
  if(m.type==='audio')return'🎤 Голосовое';
  if(m.type==='video')return'◈ Видеосообщение';
  if(m.type==='file')return'📎 '+esc(m.fname||'Файл');
  return esc((m.text||'').slice(0,40));
}

