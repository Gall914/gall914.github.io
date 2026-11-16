// RetroMesh — Статус соединения и автовход
// ════════════════════════════════════════
//  CONNECTION + AUTO-LOGIN
// ════════════════════════════════════════

setConn('wait');

// .info/connected: первое значение может быть false пока идёт handshake
// Показываем offline только если уже получили true хотя бы раз
let wasConnected = false;
db.ref('.info/connected').on('value', s => {
  if(s.val()) {
    wasConnected = true;
    setConn(ME_UID ? 'on' : 'wait');
  } else if(wasConnected) {
    // Реальный разрыв — уже были онлайн
    setConn('off');
  }
  // Если wasConnected=false и s.val()=false — просто ждём, не показываем offline
});

auth.onAuthStateChanged(user=>{
  if(user && !ME_UID){
    setConn('wait');
    db.ref('uids/'+user.uid).once('value').then(s=>{
      const nick=s.val();
      if(nick){ enterApp(user.uid,nick,user.email); setConn('on'); }
      else{ auth.signOut(); setConn('off'); }
    }).catch(()=>setConn('off'));
  } else if(!user){
    if(ME_UID) setConn('off'); // был залогинен — теперь нет
    // иначе просто ждём подключения
  }
});
