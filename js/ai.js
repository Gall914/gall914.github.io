// RetroMesh — AI-ассистент
// ════════════════════════════════════════
//  AI ASSISTANT  (Deepseek)
// ════════════════════════════════════════
let aiHistory=[]; // {role, content}
let aiTyping=false;

const AI_SYSTEM=`Ты — RETRO AI, встроенный ассистент мессенджера RetroMesh.
Ты умный, дружелюбный и лаконичный. Отвечаешь на русском если вопрос на русском.
Можешь помочь с любыми вопросами: написать текст, объяснить что-то, помочь с кодом, поболтать.
Не используй длинные вступления — сразу к делу.`;

function renderAiWelcome(){
  const ml=$('ai-msglist');
  ml.innerHTML=`<div class="ai-welcome">
    <div class="ai-logo">◈</div>
    <b style="color:var(--g0);letter-spacing:2px;font-family:'VT323',monospace;font-size:20px">RETRO AI</b><br>
    Встроенный ассистент<br>
    Спроси что угодно — помогу!
  </div>`;
}

function appendAiMsg(role, text, isThinking=false){
  const ml=$('ai-msglist');
  // Убираем welcome если есть
  const welcome=ml.querySelector('.ai-welcome');
  if(welcome) welcome.remove();

  const wrap=document.createElement('div');
  wrap.className='ai-msg '+role;
  const bub=document.createElement('div');
  bub.className='ai-bubble'+(isThinking?' thinking':'');
  bub.innerHTML=formatAiText(text);
  wrap.appendChild(bub);
  ml.appendChild(wrap);
  ml.scrollTop=ml.scrollHeight;
  return bub;
}

function formatAiText(text){
  // Простое форматирование markdown
  return esc(text)
    .replace(/```([\s\S]*?)```/g,'<pre>$1</pre>')
    .replace(/`([^`]+)`/g,'<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>')
    .replace(/\n/g,'<br>');
}

async function sendAiMsg(){
  if(aiTyping) return;
  const inp=$('ai-input');
  const text=inp.value.trim();
  if(!text) return;
  inp.value='';

  appendAiMsg('user', text);
  aiHistory.push({role:'user', content:text});

  aiTyping=true;
  $('ai-send-btn').classList.add('busy');

  // Показываем индикатор
  const thinkBub=appendAiMsg('assistant','◈ думаю...',true);

  try{
    // Google Gemini API (generateContent)
    const resp=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+AI_MODEL+':generateContent',{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'x-goog-api-key':AI_KEY
      },
      body:JSON.stringify({
        systemInstruction:{parts:[{text:AI_SYSTEM}]},
        contents:aiHistory.map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:m.content}]})),
        generationConfig:{maxOutputTokens:2048}
      })
    });
    const data=await resp.json();
    const cand=data.candidates&&data.candidates[0];
    const aiText=cand&&cand.content&&cand.content.parts&&cand.content.parts.map(p=>p.text||'').join('');
    const aiOk=!!aiText;
    const reply=aiText||
      (data.error&&('⚠ '+data.error.message))||
      (data.promptFeedback&&data.promptFeedback.blockReason&&'⚠ Запрос отклонён фильтром')||'⚠ Нет ответа';

    // Заменяем индикатор на ответ
    thinkBub.className='ai-bubble';
    thinkBub.innerHTML=formatAiText(reply);
    $('ai-msglist').scrollTop=$('ai-msglist').scrollHeight;

    if(aiOk) aiHistory.push({role:'assistant', content:reply}); else aiHistory.pop();
    // Ограничиваем историю последними 20 сообщениями
    if(aiHistory.length>20) aiHistory=aiHistory.slice(-20);

  }catch(e){
    thinkBub.className='ai-bubble';
    thinkBub.innerHTML='⚠ Ошибка соединения';
    aiHistory.pop();
  }

  aiTyping=false;
  $('ai-send-btn').classList.remove('busy');
  setTimeout(()=>inp.focus(),100);
}

function clearAiChat(){
  aiHistory=[];
  renderAiWelcome();
}

// Enter для отправки
document.addEventListener('DOMContentLoaded',()=>{
  renderAiWelcome();
  const inp=$('ai-input');
  if(inp) inp.onkeydown=e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); sendAiMsg(); } };
});


$('cpybtn').onclick=()=>{
  if(navigator.clipboard)navigator.clipboard.writeText('@'+ME_NICK).then(()=>toast('✓ СКОПИРОВАНО'));
  else toast('@'+ME_NICK);
};
$('logoutbtn').onclick=()=>{
  if(!confirm('Выйти из @'+ME_NICK+'?'))return;
  Object.keys(listeners).forEach(ch=>db.ref('chats/'+ch+'/msgs').off());
  if(ME_UID)db.ref('contacts/'+ME_UID).off();
  auth.signOut().then(()=>{
    ME_UID='';ME_NICK='';CUR_PEER='';CUR_CH='';CUR_GRP='';
    MY_AVATAR='';
    contacts=[];msgCache={};listeners={};unread={};
    groups={};groupListeners={};
    Object.keys(readTs).forEach(k=>delete readTs[k]);
    Object.keys(readListeners).forEach(k=>delete readListeners[k]);
    stopPresenceListeners();
    stopTypingListener();
    if(ME_NICK) db.ref('presence/'+ME_NICK).update({online:false,ts:Date.now()});
    Object.keys(avatarCache).forEach(k=>delete avatarCache[k]);
    $('bnav').style.display='none';
    $('l-em').value='';$('l-pw').value='';
    setErr('');setBusy(false);switchTab('l');goTo('login');
  });
};

