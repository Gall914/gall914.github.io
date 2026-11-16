// RetroMesh — Отправка в Firebase, кнопка назад, поиск пользователя, FAB
// ════════════════════════════════════════
//  PUSH MESSAGE TO FIREBASE
// ════════════════════════════════════════
function pushMsg(payload){
  return db.ref('chats/'+CUR_CH+'/msgs').push(payload);
}

// ════════════════════════════════════════
//  BACK
// ════════════════════════════════════════
$('backbtn').onclick=()=>{
  cancelSelect(); cancelReply();
  if(mediaRec) cancelRec();
  CUR_PEER='';CUR_CH='';CUR_GRP='';
  renderList();goTo('chats');
};

// ════════════════════════════════════════
//  MODAL — FIND USER
// ════════════════════════════════════════
$('modal-x').onclick=closeModal;
$('modal').onclick=e=>{if(e.target===$('modal'))closeModal()};
$('peer-inp').onkeydown=e=>{if(e.key==='Enter')searchUser()};
$('modal-ok').onclick=searchUser;

// ════════════════════════════════════════
//  FAB MENU
// ════════════════════════════════════════
function toggleFabMenu(e){
  e.stopPropagation();
  const menu=$('fab-menu');
  const isOpen=menu.classList.contains('open');
  menu.classList.toggle('open');
  if(!isOpen){
    // Закрыть при клике снаружи — один раз, с задержкой чтобы не поймать текущий клик
    setTimeout(()=>{
      document.addEventListener('click', function closeFab(){
        $('fab-menu').classList.remove('open');
        document.removeEventListener('click', closeFab);
      });
    }, 10);
  }
}
function closeFabMenu(){ $('fab-menu').classList.remove('open'); }

function openModal(){
  $('modal-chat').style.display='';
  $('modal-group').style.display='none';
  $('peer-inp').value=''; setMS('','');
  $('modal').classList.add('open');
  setTimeout(()=>$('peer-inp').focus(),340);
}
function openGroupCreate(){
  $('modal-chat').style.display='none';
  $('modal-group').style.display='';
  $('gc-name').value=''; $('gc-err').textContent='';
  gcPendingAvatar='';
  $('gc-av').innerHTML='👥';
  $('modal').classList.add('open');
  setTimeout(()=>$('gc-name').focus(),340);
}
function closeModal(){ $('modal').classList.remove('open'); }
function closeGroupCreate(){ closeModal(); }

let gcPendingAvatar='';
function gcPickAvatar(input){
  const file=input.files[0]; input.value=''; if(!file) return;
  const reader=new FileReader();
  reader.onload=ev=>{
    const img=new Image();
    img.onload=()=>{
      const SIZE=200, c=document.createElement('canvas');
      c.width=SIZE; c.height=SIZE;
      const ctx=c.getContext('2d');
      const side=Math.min(img.width,img.height);
      ctx.drawImage(img,(img.width-side)/2,(img.height-side)/2,side,side,0,0,SIZE,SIZE);
      const b64=c.toDataURL('image/jpeg',0.82);
      if(b64.length>80*1024){ toast('⚠ Фото слишком большое'); return; }
      gcPendingAvatar=b64;
      $('gc-av').innerHTML=`<img src="${escA(b64)}" style="width:100%;height:100%;object-fit:cover;display:block">`;
    };
    img.src=ev.target.result;
  };
  reader.readAsDataURL(file);
}
function setMS(m,c){const e=$('mst');e.textContent=m;e.className=c}

function searchUser(){
  const raw=$('peer-inp').value.trim().toLowerCase().replace(/[^a-z0-9_]/g,'');
  if(!raw){toast('⚠ Введите ник');return}
  if(raw===ME_NICK){toast('⚠ Это ваш собственный ник');return}
  if(contacts.includes(raw)){closeModal();openChat(raw);return}
  setMS('⏳ Поиск…','srch'); $('modal-ok').disabled=true;
  db.ref('users/'+raw).once('value')
    .then(snap=>{
      $('modal-ok').disabled=false;
      if(snap.exists()){
        const d=snap.val(); setMS('✓ @'+raw+' найден!','ok');
        setTimeout(()=>{addContact(raw,d.uid);closeModal()},700);
      }else setMS('✕ @'+raw+' не зарегистрирован','err');
    })
    .catch(e=>{$('modal-ok').disabled=false;setMS('✕ Ошибка: '+e.message,'err')});
}

function addContact(peerNick,peerUid){
  const upd={};
  upd['contacts/'+ME_UID+'/'+peerNick]=peerNick;
  if(peerUid)upd['contacts/'+peerUid+'/'+ME_NICK]=ME_NICK;
  db.ref().update(upd);
  if(!contacts.includes(peerNick)){
    contacts.push(peerNick);
    msgCache[chid(ME_NICK,peerNick)]=[];
    listenMsgs(peerNick); renderList();
  }
  openChat(peerNick); toast('+ @'+peerNick+' добавлен');
}

