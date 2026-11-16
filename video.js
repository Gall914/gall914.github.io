// RetroMesh — Видеосообщения
// ════════════════════════════════════════
//  VIDEO MESSAGES  ◈
// ════════════════════════════════════════
let vidStream=null, vidRec=null, vidChunks=[], vidSec=0, vidTimer=null, vidChatCH='';
const VID_MAX_SEC=30;

async function toggleVideo(){
  if(vidRec){ sendVideo(); return; }
  if(!CUR_CH){ toast('⚠ Сначала откройте чат'); return; }
  await startVideo();
}

async function startVideo(){
  try{
    vidStream=await navigator.mediaDevices.getUserMedia({
      video:{facingMode:'user', width:{ideal:320}, height:{ideal:320}},
      audio:true
    });
  }catch(e){
    toast(e.name==='NotAllowedError'?'⚠ Разрешите доступ к камере/микрофону':'⚠ Камера недоступна');
    return;
  }
  vidChunks=[]; vidSec=0;
  vidChatCH=CUR_CH;

  // Показываем превью
  const prev=$('vido-preview');
  prev.srcObject=vidStream;
  $('vido-preview-wrap').classList.add('show');
  $('vido-rec-bar').classList.add('show');
  $('vido-rec-t').textContent='0:00';
  $('videobtn').classList.add('vrec');

  // Браузер использует VP9+Opus — это WebM кодеки, принудительно пишем webm
  const mimes=[
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9,opus',
    'video/webm',
    'video/mp4',
  ];
  const mime=mimes.find(m=>MediaRecorder.isTypeSupported(m))||'';

  vidRec=new MediaRecorder(vidStream, mime?{mimeType:mime, videoBitsPerSecond:200000}:{});
  vidRec.ondataavailable=e=>{if(e.data&&e.data.size>0) vidChunks.push(e.data);};
  vidRec.start(200);

  vidTimer=setInterval(()=>{
    vidSec++;
    $('vido-rec-t').textContent=fmtD(vidSec);
    if(vidSec>=VID_MAX_SEC) sendVideo();
  },1000);
}

function cancelVideo(){
  clearInterval(vidTimer); vidTimer=null;
  if(vidRec&&vidRec.state!=='inactive') vidRec.stop();
  vidRec=null; vidChunks=[];
  if(vidStream){ vidStream.getTracks().forEach(t=>t.stop()); vidStream=null; }
  $('vido-preview').srcObject=null;
  $('vido-preview-wrap').classList.remove('show');
  $('vido-rec-bar').classList.remove('show');
  $('videobtn').classList.remove('vrec');
  $('vido-rec-t').textContent='0:00';
}

function sendVideo(){
  if(!vidRec) return;
  clearInterval(vidTimer); vidTimer=null;

  const dur=vidSec;
  const targetCH=vidChatCH;

  // Скрываем UI сразу
  $('vido-preview').srcObject=null;
  $('vido-preview-wrap').classList.remove('show');
  $('vido-rec-bar').classList.remove('show');
  $('videobtn').classList.remove('vrec');
  if(vidStream){ vidStream.getTracks().forEach(t=>t.stop()); vidStream=null; }

  // Запрашиваем последний чанк и останавливаем
  const rec=vidRec;
  const mime=rec.mimeType||'video/webm';
  vidRec=null;

  rec.onstop=()=>{
    const chunks=[...vidChunks];
    vidChunks=[];

    const blob=new Blob(chunks,{type:mime});

    if(blob.size===0){
      toast('⚠ Видео пустое — попробуй записать подольше'); return;
    }
    if(blob.size>950*1024){
      toast('⚠ Видео слишком тяжёлое, сократи длину'); return;
    }

    $('videobtn').classList.add('busy');
    const reader=new FileReader();
    reader.onload=ev=>{
      // Сохраняем полный data URL как есть
      const payload={from:ME_NICK, type:'video', text:'◈ Видеосообщение',
        data:ev.target.result, dur, ts:Date.now()};
      if(replyMsg && CUR_CH===targetCH){ payload.replyTo=replyMsg; }
      db.ref('chats/'+targetCH+'/msgs').push(payload)
        .then(()=>{
          $('videobtn').classList.remove('busy');
          cancelReply();
          toast('◈ Отправлено', 1500);
        })
        .catch(e=>{ $('videobtn').classList.remove('busy'); toast('⚠ '+e.message); });
    };
    reader.onerror=()=>{ $('videobtn').classList.remove('busy'); toast('⚠ Ошибка чтения видео'); };
    reader.readAsDataURL(blob);
  };

  if(rec.state==='recording') rec.requestData(); // получаем последний чанк
  if(rec.state!=='inactive') rec.stop();
  else rec.onstop();
}

// Воспроизведение видео-ромба
const vidState={};
const vidStore={}; // {vid: base64data}

// Конвертация base64 data URL → ObjectURL
function b64toObjectURL(b64){
  const marker=b64.indexOf('base64,');
  if(marker===-1) throw new Error('нет base64 маркера');
  const rawB64=b64.slice(marker+7);
  const mimeRaw=(b64.slice(0,marker).match(/data:([^;]+)/)||[])[1]||'video/webm';
  const mime=(mimeRaw.includes('mp4')&&(b64.includes('vp8')||b64.includes('vp9')||b64.includes('opus')))
    ?'video/webm':mimeRaw.split(';')[0];
  // Чистим: только валидные base64 символы
  const clean=rawB64.replace(/[^A-Za-z0-9+/=]/g,'');
  // Добавляем padding
  const padded=clean+'==='.slice(0,(4-clean.length%4)%4);
  const binStr=atob(padded);
  const bytes=new Uint8Array(binStr.length);
  for(let i=0;i<binStr.length;i++) bytes[i]=binStr.charCodeAt(i);
  const blob=new Blob([bytes],{type:mime});
  return URL.createObjectURL(blob);
}

function playVideo(vid){
  const wrap=document.getElementById('vw_'+vid);
  const videoEl=document.getElementById('vv_'+vid);
  const thumb=document.getElementById('vthumb_'+vid);
  if(!wrap||!videoEl) return;

  const b64=vidStore[vid];
  if(!b64){ toast('⚠ Видео не найдено'); return; }

  // Пауза если играет
  if(!videoEl.paused){
    videoEl.pause();
    wrap.classList.remove('open');
    return;
  }

  // Создаём ObjectURL если ещё нет
  if(!videoEl._objUrl){
    try{
      videoEl._objUrl=b64toObjectURL(b64);
    }catch(e){
      toast('⚠ '+e.message.slice(0,50)); return;
    }
    videoEl.src=videoEl._objUrl;
    if(thumb) thumb.style.display='none';
    videoEl.style.display='block';
  }

  // Раскрываем ромб
  wrap.classList.add('open');

  videoEl.onended=()=>{
    wrap.classList.remove('open');
    videoEl.currentTime=0;
  };
  videoEl.onerror=()=>{
    wrap.classList.remove('open');
    const err=videoEl.error;
    toast('⚠ Ошибка видео '+(err?'код'+err.code:''));
  };

  if(videoEl.readyState>=2){
    videoEl.play().catch(e=>{ if(e.name!=='AbortError') toast('⚠ '+e.message); });
  } else {
    videoEl.addEventListener('loadeddata',()=>{
      videoEl.play().catch(e=>{ if(e.name!=='AbortError') toast('⚠ '+e.message); });
    },{once:true});
    videoEl.load();
  }
}

function openVidOverlay(){}
function closeVidOverlay(){ $('vid-overlay').style.display='none'; }
function doPlayVideo(){}

