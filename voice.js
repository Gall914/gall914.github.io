// RetroMesh — Голосовые сообщения
// ════════════════════════════════════════
//  VOICE  🎤
// ════════════════════════════════════════
let recStream=null, recMime='', recPaused=false;
let recChatPeer='', recChatGid='', recChatCH=''; // чат, в котором началась запись
let waveAnim=null;

function toggleVoice(){
  if(mediaRec){
    // Уже идёт запись — нажатие на микрофон = отправить
    sendRec(); return;
  }
  if(!CUR_CH){toast('⚠ Сначала откройте чат');return}
  startRec();
}

async function startRec(){
  try{
    recStream=await navigator.mediaDevices.getUserMedia({audio:true,video:false});
  }catch(e){
    toast(e.name==='NotAllowedError'?'⚠ Разрешите доступ к микрофону':'⚠ Микрофон недоступен');
    return;
  }

  recChunks=[]; recSec=0; recPaused=false;
  recChatPeer=CUR_PEER;   // для личных чатов
  recChatGid =CUR_GRP;    // для групп
  recChatCH  =CUR_CH;     // универсальный channel id
  const mimes=['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus','audio/ogg','audio/mp4'];
  recMime=mimes.find(m=>MediaRecorder.isTypeSupported(m))||'';

  mediaRec=new MediaRecorder(recStream, recMime?{mimeType:recMime}:{});
  mediaRec.ondataavailable=e=>{if(e.data&&e.data.size>0)recChunks.push(e.data)};
  mediaRec.onstop=()=>{}; // обрабатываем вручную в sendRec/cancelRec

  mediaRec.start(100);
  recSec=0;

  // UI
  $('rec-t').textContent=fmtD(0);
  $('ibar-rec').classList.add('show');
  $('voicebtn').classList.add('rec');
  updateRecUI(false);
  startRecTimer();
  startWaveAnim();
}

function startRecTimer(){
  clearInterval(recTimer);
  recTimer=setInterval(()=>{
    if(recPaused)return;
    recSec++;
    $('rec-t').textContent=fmtD(recSec);
    if(recSec>=120)sendRec(); // автоотправка через 2 мин
  },1000);
}

function updateRecUI(paused){
  const dot=$('rec-dot'), label=$('rec-label'), pbtn=$('rec-pause-btn');
  if(paused){
    dot.className='rec-dot paused'; label.textContent='ПАУЗА';
    label.className='paused'; pbtn.textContent='▶'; pbtn.title='Продолжить';
  } else {
    dot.className='rec-dot active'; label.textContent='REC';
    label.className=''; pbtn.textContent='⏸'; pbtn.title='Пауза';
  }
}

function toggleRecPause(){
  if(!mediaRec)return;
  if(!recPaused){
    // Ставим на паузу
    if(mediaRec.state==='recording') mediaRec.pause();
    recPaused=true;
    updateRecUI(true);
    stopWaveAnim();
  } else {
    // Продолжаем
    if(mediaRec.state==='paused') mediaRec.resume();
    recPaused=false;
    updateRecUI(false);
    startWaveAnim();
  }
}

function sendRec(){
  if(!mediaRec)return;
  const dur=recSec;
  const targetCH=recChatCH;
  const targetPeer=recChatPeer; // только для тоста в личных чатах

  stopRecClean();

  if(!recChunks.length){toast('⚠ Запись пустая');return}

  const mime=recMime||'audio/webm';
  const blob=new Blob(recChunks,{type:mime});
  recChunks=[];

  $('voicebtn').classList.add('busy');
  const reader=new FileReader();
  reader.onload=ev=>{
    const b64=ev.target.result;
    if(b64.length>700*1024){
      $('voicebtn').classList.remove('busy');
      toast('⚠ Запись слишком длинная (макс ~2 мин)');
      return;
    }
    const payload={from:ME_NICK,type:'audio',text:'🎤 Голосовое',data:b64,dur,ts:Date.now()};
    if(replyMsg && CUR_CH===targetCH){payload.replyTo=replyMsg;}
    db.ref('chats/'+targetCH+'/msgs').push(payload)
      .then(()=>{
        $('voicebtn').classList.remove('busy');
        cancelReply();
        if(CUR_CH===targetCH) toast('🎤 Отправлено',1500);
        else toast('🎤 Голосовое отправлено',2000);
      })
      .catch(e=>{$('voicebtn').classList.remove('busy');toast('⚠ '+e.message)});
  };
  reader.onerror=()=>{$('voicebtn').classList.remove('busy');toast('⚠ Ошибка аудио')};
  reader.readAsDataURL(blob);
}

function cancelRec(){
  stopRecClean();
  recChunks=[];
  toast('Запись отменена',1500);
}

function stopRecClean(){
  clearInterval(recTimer); recTimer=null;
  stopWaveAnim();
  if(mediaRec){
    try{
      if(mediaRec.state!=='inactive') mediaRec.stop();
    }catch(e){}
    mediaRec=null;
  }
  if(recStream){
    recStream.getTracks().forEach(t=>t.stop());
    recStream=null;
  }
  recPaused=false;
  recChatPeer=''; recChatGid=''; recChatCH='';
  $('ibar-rec').classList.remove('show');
  $('voicebtn').classList.remove('rec','busy');
}

// Анимация волны во время записи
function startWaveAnim(){
  const wave=$('rec-wave');
  wave.innerHTML='';
  const bars=16;
  for(let i=0;i<bars;i++){
    const b=document.createElement('span');
    b.style.height='4px';
    wave.appendChild(b);
  }
  function animate(){
    if(recPaused){
      // Заморозить волну
      return;
    }
    wave.querySelectorAll('span').forEach(b=>{
      b.style.height=(4+Math.random()*18)+'px';
      b.style.background=recPaused?'var(--amb)':'var(--red)';
    });
    waveAnim=setTimeout(animate,120);
  }
  animate();
}

function stopWaveAnim(){
  if(waveAnim){clearTimeout(waveAnim);waveAnim=null;}
  // Выровнять все полосы
  const wave=$('rec-wave');
  if(wave)wave.querySelectorAll('span').forEach(b=>{b.style.height='4px';b.style.background='var(--amb)'});
}

// Запись привязана к чату — stopRecClean вызывается при backbtn/cancelSelect


