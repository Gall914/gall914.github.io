// RetroMesh — Группы и удаление чатов
// ════════════════════════════════════════
//  GROUPS
// ════════════════════════════════════════
// Firebase структура:
//   groups/{gid} = {name, creator, created, avatar?}
//   groups/{gid}/members/{nick} = nick
//   chats/{gid}/msgs/{msgId} = {...}
//   groupContacts/{uid}/{gid} = gid   (мои группы)

let groups = {};       // {gid: {name, creator, members:{nick:nick}, avatar}}
let groupListeners = {}; // {gid: true}
let CUR_GRP = '';      // gid текущей открытой группы (если это группа)

// -- Создание группы --
$('gc-name').onkeydown=e=>{ if(e.key==='Enter') doCreateGroup(); };
$('gc-ok').onclick=doCreateGroup;
$('modal').onclick=e=>{ if(e.target===$('modal')) closeModal(); };

function doCreateGroup(){
  const name=$('gc-name').value.trim();
  if(!name){ $('gc-err').textContent='⚠ Введите название'; return; }
  $('gc-ok').disabled=true;
  const gid='g_'+Date.now()+'_'+Math.random().toString(36).slice(2,6);
  const info={name, creator:ME_NICK, created:Date.now()};
  if(gcPendingAvatar) info.avatar=gcPendingAvatar;
  const upd={};
  upd[`groups/${gid}/info`]=info;
  upd[`groups/${gid}/members/${ME_NICK}`]=ME_NICK;
  upd[`groupContacts/${ME_UID}/${gid}`]=gid;
  db.ref().update(upd).then(()=>{
    $('gc-ok').disabled=false;
    closeModal();
    loadGroup(gid,()=>openGroupChat(gid));
    toast('✓ Группа создана',2000);
  }).catch(e=>{ $('gc-ok').disabled=false; $('gc-err').textContent='⚠ '+e.message; });
}

// -- Загрузка групп при входе --
function loadGroups(){
  db.ref('groupContacts/'+ME_UID).on('child_added', snap=>{
    const gid=snap.val(); if(!gid)return;
    loadGroup(gid);
  });
}

function loadGroup(gid, cb){
  if(groups[gid]){ if(cb)cb(); return; }
  db.ref('groups/'+gid).once('value').then(snap=>{
    const d=snap.val(); if(!d)return;
    groups[gid]={
      name: d.info?.name||'Группа',
      creator: d.info?.creator||'',
      avatar: d.info?.avatar||'',
      members: d.members||{}
    };
    if(!msgCache[gid]) msgCache[gid]=[];
    listenGroupMsgs(gid);
    listenReads(gid);
    renderList();
    if(cb) cb();
  });
  // Слушать изменения инфо группы (смена названия, аватара, участников)
  db.ref('groups/'+gid+'/info').on('value', snap=>{
    const d=snap.val(); if(!d||!groups[gid])return;
    groups[gid].name=d.name||groups[gid].name;
    groups[gid].avatar=d.avatar||'';
    renderList();
    if(CUR_GRP===gid){
      $('c-name').textContent=groups[gid].name;
      if(groups[gid].avatar) $('c-av').innerHTML=`<img src="${escA(groups[gid].avatar)}" alt="g">`;
      else $('c-av').innerHTML=grpIni(groups[gid].name);
    }
  });
  db.ref('groups/'+gid+'/members').on('child_added', snap=>{
    const nick=snap.val(); if(!nick)return;
    if(groups[gid]) groups[gid].members[nick]=nick;
    renderList();
  });
  db.ref('groups/'+gid+'/members').on('child_removed', snap=>{
    const nick=snap.key; if(!nick||!groups[gid])return;
    delete groups[gid].members[nick];
    renderList();
    // Если нас выгнали — уходим
    if(nick===ME_NICK){ delete groups[gid]; toast('⚠ Вас удалили из группы',3000); renderList(); }
  });
}

function listenGroupMsgs(gid){
  if(groupListeners[gid])return;
  groupListeners[gid]=true;
  if(!msgCache[gid]) msgCache[gid]=[];
  db.ref('chats/'+gid+'/msgs').orderByChild('ts').on('child_added', snap=>{
    const d=snap.val(); if(!d)return;
    const id=snap.key;
    if(msgCache[gid].some(m=>m.id===id))return;
    const msg={id,from:d.from||'',type:d.type||'text',text:d.text||'',
      data:d.data||'',fname:d.fname||'',fsize:d.fsize||0,dur:d.dur||0,
      replyTo:d.replyTo||null,fwdFrom:d.fwdFrom||null,reactions:d.reactions||null,ts:d.ts||0};
    msgCache[gid].push(msg);
    msgCache[gid].sort((a,b)=>a.ts-b.ts);
    const g=groups[gid];
    if(g){
      const prev=document.getElementById('prev_'+gid);
      if(prev) prev.textContent=(msg.from===ME_NICK?'Вы: ':('@'+msg.from+': '))+prevText(msg);
    }
    if(CUR_GRP===gid){
      appendMsg(msg);
      db.ref('reads/'+gid+'/'+ME_NICK).set(Date.now());
    } else if(msg.from!==ME_NICK){
      const myLastRead=(readTs[gid]||{})[ME_NICK]||0;
      if(msg.ts>myLastRead){
        unread[gid]=(unread[gid]||0)+1; renderList();
        const grpName=groups[gid]?groups[gid].name:gid;
        const text=msg.type==='image'?'📷 Фото':msg.type==='audio'?'🎤 Голосовое':msg.type==='video'?'◈ Видео':(msg.text||'').slice(0,80);
        showNotification(grpName+' · @'+msg.from, text, '__g__'+gid);
      }
    }
    updateTicksForChat(gid);
  });

}

// -- Открыть групповой чат --
function openGroupChat(gid){
  cancelSelect(); cancelReply(); closeSearchBar();
  if(mediaRec) cancelRec();
  if(vidRec) cancelVideo();
  const g=groups[gid]; if(!g) return;
  CUR_PEER=''; CUR_GRP=gid; CUR_CH=gid; unread[gid]=0;
  stopTypingListener();
  db.ref('reads/'+gid+'/'+ME_NICK).set(Date.now());
  listenReads(gid);
  pinnedListenerGid=''; // сброс чтобы закреп перезагрузился
  listenPinned(gid);
  $('c-name').textContent=g.name;
  $('c-sub').textContent='ГРУППА · '+Object.keys(g.members).length+' уч.';
  $('call-btn').style.display='none';
  $('vcall-btn').style.display='none';
  $('c-online').classList.remove('show');
  $('c-online-dot').classList.remove('show');
  if(g.avatar){ $('c-av').innerHTML=`<img src="${escA(g.avatar)}" alt="g">`; }
  else { $('c-av').innerHTML=grpIni(g.name); }
  const ml=$('msglist'); ml.innerHTML=''; ml.dataset.lastDate='';
  (msgCache[gid]||[]).forEach(m=>appendMsg(m,false));
  scrollToBottom(ml);
  loadReactionsForChat(gid);
  startReactionsListener(gid);
  goTo('chat');
  setTimeout(()=>{ scrollToBottom(ml); $('msginput').focus(); },100);
}

function grpIni(name){ return (name||'G')[0].toUpperCase(); }

// -- Клик по аватарке/имени в хедере чата --
function onChatAvatarClick(){
  if(CUR_GRP) openGrpPanel(CUR_GRP);
}

// ── Group info panel ──
let panelGid='';
function openGrpPanel(gid){
  panelGid=gid;
  const g=groups[gid]; if(!g)return;
  $('gp-title').textContent=g.name.toUpperCase();
  $('gp-name-edit').value=g.name;
  // Аватарка
  const av=$('gp-av');
  if(g.avatar){ av.innerHTML=`<img src="${escA(g.avatar)}" alt="g"><div class="grp-av-badge">✎</div><input type="file" class="grp-av-inp" accept="image/*" onchange="uploadGrpAvatar(this)">`; }
  else { av.innerHTML=`<span style="font-size:36px;color:var(--g0)">${grpIni(g.name)}</span><div class="grp-av-badge">✎</div><input type="file" class="grp-av-inp" accept="image/*" onchange="uploadGrpAvatar(this)">`; }
  renderMembersList(gid);
  $('add-member-form').classList.remove('open');
  $('am-status').textContent=''; $('am-inp').value='';
  $('grp-panel').classList.add('open');
}

function closeGrpPanel(){
  $('grp-panel').classList.remove('open');
  panelGid='';
}
$('grp-panel').onclick=e=>{ if(e.target===$('grp-panel')) closeGrpPanel(); };

function renderMembersList(gid){
  const g=groups[gid]; if(!g)return;
  const list=$('gp-members-list'); list.innerHTML='';
  Object.keys(g.members).forEach(nick=>{
    const isMe=nick===ME_NICK;
    const isCreator=nick===g.creator;
    const row=document.createElement('div');
    row.className='member-row';
    row.innerHTML=`<div class="member-av" id="mav_${nick}">${ini(nick)}</div>
      <div class="member-nick">@${esc(nick)}${isCreator?' <span style="color:var(--g2);font-size:10px">★ создатель</span>':''}</div>
      ${isMe?'<span class="member-role">вы</span>':
        (ME_NICK===g.creator?`<button class="member-kick" onclick="kickMember('${gid}','${nick}')">удалить</button>`:'')
      }`;
    list.appendChild(row);
    // Аватарка участника
    loadAvatar(nick, b64=>{ const el=document.getElementById('mav_'+nick); if(el&&b64) el.innerHTML=`<img src="${escA(b64)}" alt="av">`; });
  });
}

function saveGrpName(){
  const name=$('gp-name-edit').value.trim();
  if(!name||!panelGid){toast('⚠ Введите название');return}
  db.ref('groups/'+panelGid+'/info/name').set(name).then(()=>{
    groups[panelGid].name=name;
    $('gp-title').textContent=name.toUpperCase();
    toast('✓ Название сохранено',1500);
  }).catch(e=>toast('⚠ '+e.message));
}

function uploadGrpAvatar(input){
  const file=input.files[0]; input.value=''; if(!file)return;
  const reader=new FileReader();
  reader.onload=ev=>{
    const img=new Image();
    img.onload=()=>{
      const SIZE=200,c=document.createElement('canvas');
      c.width=SIZE; c.height=SIZE;
      const ctx=c.getContext('2d');
      const side=Math.min(img.width,img.height);
      ctx.drawImage(img,(img.width-side)/2,(img.height-side)/2,side,side,0,0,SIZE,SIZE);
      const b64=c.toDataURL('image/jpeg',0.82);
      if(b64.length>80*1024){toast('⚠ Фото слишком большое');return}
      db.ref('groups/'+panelGid+'/info/avatar').set(b64).then(()=>{
        groups[panelGid].avatar=b64;
        openGrpPanel(panelGid); // перерендер панели
        toast('✓ Аватарка обновлена',1500);
      }).catch(e=>toast('⚠ '+e.message));
    };
    img.src=ev.target.result;
  };
  reader.readAsDataURL(file);
}

function toggleAddMember(){
  $('add-member-form').classList.toggle('open');
  if($('add-member-form').classList.contains('open')) setTimeout(()=>$('am-inp').focus(),100);
}

function setAMS(m,c){ const e=$('am-status');e.textContent=m;e.className='am-status '+(c||''); }

function doAddMember(){
  const nick=$('am-inp').value.trim().toLowerCase().replace(/[^a-z0-9_]/g,'');
  if(!nick){setAMS('⚠ Введите ник','err');return}
  if(nick===ME_NICK){setAMS('⚠ Это вы','err');return}
  if(!panelGid){return}
  const g=groups[panelGid];
  if(g&&g.members[nick]){setAMS('⚠ Уже в группе','err');return}
  setAMS('⏳ Поиск…','srch');
  db.ref('users/'+nick).once('value').then(snap=>{
    if(!snap.exists()){setAMS('⚠ @'+nick+' не найден','err');return}
    const uid=snap.val().uid;
    const upd={};
    upd[`groups/${panelGid}/members/${nick}`]=nick;
    upd[`groupContacts/${uid}/${panelGid}`]=panelGid;
    return db.ref().update(upd).then(()=>{
      if(g) g.members[nick]=nick;
      setAMS('✓ @'+nick+' добавлен!','ok');
      $('am-inp').value='';
      renderMembersList(panelGid);
      $('c-sub').textContent='ГРУППА · '+Object.keys(g?.members||{}).length+' уч.';
      setTimeout(()=>setAMS('',''),2000);
    });
  }).catch(e=>setAMS('⚠ '+e.message,'err'));
}
$('am-inp').onkeydown=e=>{if(e.key==='Enter')doAddMember()};

function kickMember(gid, nick){
  if(!confirm('Удалить @'+nick+' из группы?'))return;
  db.ref('groups/'+gid+'/members/'+nick).remove()
    .then(()=>{ toast('Удалён @'+nick,1500); renderMembersList(gid); })
    .catch(e=>toast('⚠ '+e.message));
}

// ════════════════════════════════════════
//  УДАЛЕНИЕ ЧАТА
// ════════════════════════════════════════
function toggleChatMenu(e, peer){
  e.stopPropagation();
  // Закрыть все другие меню
  document.querySelectorAll('.c-menu.open').forEach(m=>{
    if(m.id!=='cmenu_'+peer) m.classList.remove('open');
  });
  const menu=$('cmenu_'+peer);
  if(menu) menu.classList.toggle('open');
}

function confirmDeleteChat(peer){
  document.querySelectorAll('.c-menu.open').forEach(m=>m.classList.remove('open'));
  if(!confirm('Удалить чат с @'+peer+'?\n\nСообщения удалятся только у вас.')) return;
  deleteChat(peer);
}

function deleteChat(peer){
  const ch=chid(ME_NICK,peer);
  if(listeners[ch]){ db.ref('chats/'+ch+'/msgs').off(); delete listeners[ch]; }
  contacts=contacts.filter(c=>c!==peer);
  delete msgCache[ch]; delete unread[peer];
  db.ref('contacts/'+ME_UID+'/'+peer).remove();
  if(CUR_PEER===peer){ CUR_PEER=''; CUR_CH=''; goTo('chats'); }
  renderList(); toast('Чат с @'+peer+' удалён');
}

function confirmLeaveGroup(gid){
  document.querySelectorAll('.c-menu.open').forEach(m=>m.classList.remove('open'));
  const g=groups[gid]; if(!g)return;
  if(!confirm('Покинуть группу «'+g.name+'»?')) return;
  // Убираем себя из участников и из groupContacts
  const upd={};
  upd['groups/'+gid+'/members/'+ME_NICK]=null;
  upd['groupContacts/'+ME_UID+'/'+gid]=null;
  db.ref().update(upd).then(()=>{
    if(groupListeners[gid]){ db.ref('chats/'+gid+'/msgs').off(); delete groupListeners[gid]; }
    db.ref('groups/'+gid+'/info').off();
    db.ref('groups/'+gid+'/members').off();
    delete groups[gid]; delete msgCache[gid]; delete unread[gid];
    if(CUR_GRP===gid){ CUR_GRP=''; CUR_CH=''; CUR_PEER=''; goTo('chats'); }
    renderList(); toast('Вы покинули группу');
  }).catch(e=>toast('⚠ '+e.message));
}

