// RetroMesh — Звонки (WebRTC)
// ════════════════════════════════════════
//  CALLS  📞📹  (WebRTC)
// ════════════════════════════════════════
const STUN={iceServers:[
  {urls:'stun:stun.l.google.com:19302'},
  {urls:'stun:stun1.l.google.com:19302'},
  {urls:'stun:stun.cloudflare.com:3478'},
]};

let pc=null, localStream=null;
let callPeer='', callRole='', callRef=null;
let callTimer=null, callSec=0;
let callMuted=false, callCamOff=false;
let callWithVideo=false;
let pendingCandidates=[];

function createPC(){
  const p=new RTCPeerConnection(STUN);
  p.onicecandidate=e=>{
    if(!e.candidate||!callRef) return;
    const key=callRole==='caller'?'callerCandidates':'calleeCandidates';
    callRef.child(key).push(e.candidate.toJSON());
  };
  p.oniceconnectionstatechange=()=>{
    if(p.iceConnectionState==='connected'||p.iceConnectionState==='completed') onCallActive();
    if(p.iceConnectionState==='failed'){ toast('⚠ Соединение не удалось'); endCall(); }
  };
  p.ontrack=e=>{
    const track=e.track;
    if(track.kind==='audio'){
      const audio=$('call-audio');
      if(!audio.srcObject) audio.srcObject=new MediaStream();
      audio.srcObject.addTrack(track);
      audio.play().catch(()=>{});
    } else if(track.kind==='video'){
      const rv=$('call-video-remote');
      if(!rv.srcObject) rv.srcObject=new MediaStream();
      rv.srcObject.addTrack(track);
      rv.style.display='block';
      $('call-av').classList.add('has-video');
    }
  };
  return p;
}

async function addPendingCandidates(){
  for(const cand of pendingCandidates){
    if(pc&&pc.remoteDescription)
      await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(()=>{});
  }
  pendingCandidates=[];
}

// ── Начать звонок (withVideo=true/false) ──
async function startCall(withVideo){
  if(!CUR_PEER){toast('⚠ Открой личный чат');return;}
  if(pc){toast('⚠ Звонок уже идёт');return;}
  callPeer=CUR_PEER; callRole='caller'; callWithVideo=!!withVideo;
  try{
    localStream=await navigator.mediaDevices.getUserMedia({
      audio:true, video:withVideo?{facingMode:'user',width:{ideal:640},height:{ideal:480}}:false
    });
  }catch(e){
    toast('⚠ Нет доступа к '+(withVideo?'камере':'микрофону'));return;
  }
  if(withVideo){
    const lv=$('call-video-local');
    lv.srcObject=localStream; lv.style.display='block';
  }
  showCallScreen('outgoing');
  const callId='call_'+ME_NICK+'_'+callPeer+'_'+Date.now();
  callRef=db.ref('calls/'+callId);
  pendingCandidates=[];
  pc=createPC();
  localStream.getTracks().forEach(t=>pc.addTrack(t,localStream));
  callRef.child('calleeCandidates').on('child_added',async snap=>{
    const cand=snap.val(); if(!cand) return;
    if(pc&&pc.remoteDescription) await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(()=>{});
    else pendingCandidates.push(cand);
  });
  const offer=await pc.createOffer({offerToReceiveAudio:true,offerToReceiveVideo:true});
  await pc.setLocalDescription(offer);
  await callRef.set({
    caller:ME_NICK,callee:callPeer,status:'ringing',
    withVideo:!!withVideo,
    offer:{type:offer.type,sdp:offer.sdp},ts:Date.now()
  });
  callRef.child('answer').on('value',async snap=>{
    const ans=snap.val();
    if(ans&&pc&&!pc.currentRemoteDescription){
      await pc.setRemoteDescription(new RTCSessionDescription(ans));
      await addPendingCandidates();
    }
  });
  listenCallStatus();
  setTimeout(()=>{if(callRole==='caller'&&callRef)endCall();},60000);
}

// ── Входящие ──
function listenIncomingCalls(){
  db.ref('calls').on('child_added',snap=>{
    const call=snap.val();
    if(!call||call.callee!==ME_NICK) return;
    if(call.status!=='ringing') return;
    if(Date.now()-call.ts>30000) return;
    if(pc) return;
    callRef=snap.ref; callPeer=call.caller; callRole='callee';
    callWithVideo=!!call.withVideo;
    pendingCandidates=[];
    callRef._offer=call.offer;
    $('ib-name').textContent='@'+call.caller;
    $('incoming-banner').classList.add('show');
    showCallScreen('incoming', call.withVideo);
    playRingtone(true);
    listenCallStatus();
  });
}

function listenCallStatus(){
  if(!callRef) return;
  callRef.child('status').on('value',snap=>{
    const st=snap.val();
    if(st==='ended'||st==='rejected') onCallEnded();
  });
}

// ── Принять (withVideo) ──
async function acceptCall(withVideo){
  $('incoming-banner').classList.remove('show');
  playRingtone(false);
  callWithVideo=!!withVideo;
  try{
    localStream=await navigator.mediaDevices.getUserMedia({
      audio:true, video:withVideo?{facingMode:'user',width:{ideal:640},height:{ideal:480}}:false
    });
  }catch(e){
    // Если видео недоступно — принять только аудио
    try{ localStream=await navigator.mediaDevices.getUserMedia({audio:true,video:false}); callWithVideo=false; }
    catch(e2){ toast('⚠ Нет доступа к микрофону');return; }
  }
  if(callWithVideo){
    const lv=$('call-video-local');
    lv.srcObject=localStream; lv.style.display='block';
  }
  pc=createPC();
  localStream.getTracks().forEach(t=>pc.addTrack(t,localStream));
  callRef.child('callerCandidates').on('child_added',async snap=>{
    const cand=snap.val(); if(!cand) return;
    if(pc&&pc.remoteDescription) await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(()=>{});
    else pendingCandidates.push(cand);
  });
  await pc.setRemoteDescription(new RTCSessionDescription(callRef._offer));
  await addPendingCandidates();
  const answer=await pc.createAnswer();
  await pc.setLocalDescription(answer);
  await callRef.update({answer:{type:answer.type,sdp:answer.sdp},status:'active'});
  showCallScreen('active');
}

function rejectCall(){
  $('incoming-banner').classList.remove('show');
  playRingtone(false);
  if(callRef) callRef.update({status:'rejected'});
  cleanupCall();
}

function endCall(){
  if(callRef) callRef.update({status:'ended'});
  cleanupCall();
}

function onCallActive(){
  if(callTimer) return;
  $('call-status').textContent='СОЕДИНЕНО';
  $('call-btns-outgoing').style.display='none';
  $('call-btns-incoming').style.display='none';
  $('call-btns-active').style.display='flex';
  $('call-timer').style.display='block';
  callSec=0;
  callTimer=setInterval(()=>{
    callSec++;
    const m=Math.floor(callSec/60),s=callSec%60;
    $('call-timer').textContent=m+':'+(s<10?'0':'')+s;
  },1000);
  playRingtone(false);
}

function onCallEnded(){ cleanupCall(); toast('📵 Звонок завершён'); }

function cleanupCall(){
  clearInterval(callTimer); callTimer=null; callSec=0;
  if(pc){pc.close();pc=null;}
  if(localStream){localStream.getTracks().forEach(t=>t.stop());localStream=null;}
  $('call-audio').srcObject=null;
  const rv=$('call-video-remote'); rv.srcObject=null; rv.style.display='none';
  const lv=$('call-video-local'); lv.srcObject=null; lv.style.display='none';
  $('call-av').classList.remove('has-video');
  if(callRef){
    callRef.child('status').off(); callRef.child('answer').off();
    callRef.child('callerCandidates').off(); callRef.child('calleeCandidates').off();
  }
  callRef=null; callPeer=''; callRole=''; callWithVideo=false;
  callMuted=false; callCamOff=false; pendingCandidates=[];
  $('call-screen').classList.remove('show');
  $('incoming-banner').classList.remove('show');
  $('call-mic-btn').classList.remove('off');
  $('call-cam-btn').classList.remove('off');
  playRingtone(false);
}

function toggleCallMic(){
  if(!localStream) return;
  callMuted=!callMuted;
  localStream.getAudioTracks().forEach(t=>t.enabled=!callMuted);
  $('call-mic-btn').classList.toggle('off',callMuted);
  $('call-mic-btn').textContent=callMuted?'🔇':'🎤';
}

function toggleCallCam(){
  if(!localStream) return;
  callCamOff=!callCamOff;
  localStream.getVideoTracks().forEach(t=>t.enabled=!callCamOff);
  $('call-cam-btn').classList.toggle('off',callCamOff);
  $('call-cam-btn').textContent=callCamOff?'🚫':'📹';
  $('call-video-local').style.opacity=callCamOff?'0.2':'1';
}

function showCallScreen(mode, withVideo){
  $('call-screen').classList.add('show');
  $('call-btns-incoming').style.display=mode==='incoming'?'flex':'none';
  $('call-btns-outgoing').style.display=mode==='outgoing'?'flex':'none';
  $('call-btns-active').style.display=mode==='active'?'flex':'none';
  $('call-timer').style.display=mode==='active'?'block':'none';
  $('call-name').textContent='@'+callPeer;
  $('call-status').textContent=
    mode==='incoming'?(withVideo?'ВИДЕОЗВОНОК':'ВХОДЯЩИЙ ЗВОНОК'):
    mode==='active'?'СОЕДИНЕНО':'ВЫЗОВ...';
  // Показываем/скрываем кнопку камеры
  $('call-cam-btn').style.display=callWithVideo?'flex':'none';
  const av=$('call-av');
  av.textContent=ini(callPeer);
  loadAvatar(callPeer,b64=>{if(b64)av.innerHTML=`<img src="${escA(b64)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;});
}

let ringtoneCtx=null,ringtoneInterval=null;
function playRingtone(on){
  if(ringtoneInterval){clearInterval(ringtoneInterval);ringtoneInterval=null;}
  if(!on) return;
  const beep=()=>{
    try{
      if(!ringtoneCtx) ringtoneCtx=new(window.AudioContext||window.webkitAudioContext)();
      if(ringtoneCtx.state==='suspended') ringtoneCtx.resume();
      [[880,0,0.15],[660,0.2,0.15]].forEach(([freq,delay,dur])=>{
        const o=ringtoneCtx.createOscillator();
        const g=ringtoneCtx.createGain();
        o.connect(g);g.connect(ringtoneCtx.destination);
        o.frequency.value=freq;g.gain.value=0.25;
        const t=ringtoneCtx.currentTime;
        o.start(t+delay);o.stop(t+delay+dur);
      });
    }catch(e){}
  };
  beep();
  ringtoneInterval=setInterval(beep,2000);
}

