// RetroMesh — Вход, регистрация, подтверждение кода (логика не менялась)
// ── enter handling (перенесено из core.js: doAuth объявлена в этом файле) ──
['l-pw','r-pw'].forEach(id=>$(id).onkeydown=e=>{if(e.key==='Enter')doAuth()});
$('r-em').onkeydown=e=>{if(e.key==='Enter')$('r-pw').focus()};
$('r-nm').onkeydown=e=>{if(e.key==='Enter')$('r-em').focus()};
$('l-em').onkeydown=e=>{if(e.key==='Enter')$('l-pw').focus()};
$('lbtn').onclick=doAuth;

// ════════════════════════════════════════
//  AUTH
// ════════════════════════════════════════
function doAuth(){
  setErr('');
  if(curTab==='l') doLogin();
  else if($('form-verify').style.display!=='none') doVerify();
  else doRegister();
}

function doLogin(){
  const em=$('l-em').value.trim(), pw=$('l-pw').value;
  if(!em){setErr('⚠ Введите e-mail');return}
  if(!pw){setErr('⚠ Введите пароль');return}
  setBusy(true);
  auth.signInWithEmailAndPassword(em,pw)
    .then(cr=>db.ref('uids/'+cr.user.uid).once('value').then(s=>{
      const nick=s.val(); if(!nick)throw new Error('Профиль не найден');
      enterApp(cr.user.uid,nick,cr.user.email);
    }))
    .catch(e=>{setBusy(false);setErr(authErr(e))});
}

function doRegister(){
  const nick=$('r-nm').value.trim().toLowerCase().replace(/[^a-z0-9_]/g,'');
  const em=$('r-em').value.trim(), pw=$('r-pw').value;
  if(nick.length<2){setErr('⚠ Ник: минимум 2 символа');return}
  if(!em||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)){setErr('⚠ Введите корректный e-mail');return}
  if(pw.length<6){setErr('⚠ Пароль: минимум 6 символов');return}

  setBusy(true);

  // Сначала создаём Auth-аккаунт (чтобы быть залогиненым при чтении DB)
  auth.createUserWithEmailAndPassword(em,pw)
    .then(cr=>{
      const uid=cr.user.uid;
      // Теперь авторизованы — проверяем ник
      return db.ref('users/'+nick).once('value').then(snap=>{
        if(snap.exists()){
          // Ник занят — удаляем только что созданный auth-аккаунт
          return cr.user.delete().then(()=>{
            setBusy(false);
            setErr('⚠ Ник @'+nick+' уже занят');
          });
        }
        // Ник свободен — отправляем код подтверждения
        pendingReg={nick, em, pw, uid};
        // Разлогиниваемся до подтверждения email
        return auth.signOut().then(()=>{
          sendVerifyCode(em);
        });
      });
    })
    .catch(e=>{setBusy(false);setErr(authErr(e))});
}

function sendVerifyCode(em){
  verifyCode = String(Math.floor(1000+Math.random()*9000));
  verifyExpiry = Date.now() + 10*60*1000;

  const templateParams = {
    to_email: em,
    to_name:  pendingReg ? pendingReg.nick : 'пользователь',
    code:     verifyCode,
  };

  emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams)
    .then(()=>{
      setBusy(false);
      showVerifyStep(em);
    }).catch(e=>{
      setBusy(false);
      setErr('⚠ Не удалось отправить письмо: '+(e.text||e.message||JSON.stringify(e)));
      console.error('EmailJS error:', e, 'params:', templateParams);
    });
}

function showVerifyStep(em){
  setErr('');
  $('form-r').style.display='none';
  $('form-verify').style.display='block';
  $('verify-email-hint').textContent=em;
  $('lbtn-t').textContent='[ ПОДТВЕРДИТЬ ]';
  $('lhint').textContent='';

  // Очищаем поля кода
  document.querySelectorAll('.cdig').forEach(el=>{
    el.value=''; el.classList.remove('filled');
  });
  // Фокус на первый разряд
  setTimeout(()=>document.querySelectorAll('.cdig')[0].focus(), 300);

  // Таймер повторной отправки (60 сек)
  startResendTimer();
}

function cancelVerify(){
  // Удаляем pre-created auth аккаунт если есть
  const user=auth.currentUser;
  if(user) user.delete().catch(()=>{});

  pendingReg=null; verifyCode=''; verifyExpiry=0;
  clearInterval(resendCountdown);
  $('form-verify').style.display='none';
  $('form-r').style.display='block';
  $('lbtn-t').textContent='[ ЗАРЕГИСТРИРОВАТЬСЯ ]';
  $('lhint').textContent='Есть аккаунт? Перейди на ВХОД';
  setErr('');
}

function doVerify(){
  if(Date.now()>verifyExpiry){setErr('⚠ Код истёк — отправьте новый');return}
  const digits=[...document.querySelectorAll('.cdig')].map(i=>i.value.trim());
  const entered=digits.join('');
  if(entered.length<4){setErr('⚠ Введите все 4 цифры');return}
  if(entered!==verifyCode){setErr('⚠ Неверный код, попробуйте ещё раз');return}

  setErr(''); setBusy(true);
  const {nick,em,pw}=pendingReg;

  // Логинимся (аккаунт уже создан в doRegister) и пишем профиль
  auth.signInWithEmailAndPassword(em,pw)
    .then(cr=>{
      const uid=cr.user.uid;
      const upd={};
      upd['users/'+nick]={nick,uid,email:em,created:Date.now()};
      upd['uids/'+uid]=nick;
      return db.ref().update(upd).then(()=>{
        pendingReg=null; verifyCode=''; verifyExpiry=0;
        clearInterval(resendCountdown);
        enterApp(uid,nick,em);
      });
    })
    .catch(e=>{setBusy(false);setErr(authErr(e))});
}

function resendCode(){
  if(!pendingReg)return;
  setErr(''); setBusy(true);
  sendVerifyCode(pendingReg.em);
  toast('📧 Новый код отправлен',2000);
}

function startResendTimer(){
  let secs=60;
  $('resend-btn').disabled=true;
  $('resend-timer').textContent=' ('+secs+'с)';
  clearInterval(resendCountdown);
  resendCountdown=setInterval(()=>{
    secs--;
    if(secs<=0){
      clearInterval(resendCountdown);
      $('resend-btn').disabled=false;
      $('resend-timer').textContent='';
    } else {
      $('resend-timer').textContent=' ('+secs+'с)';
    }
  },1000);
}

// ── Навигация по цифрам кода ──
document.addEventListener('DOMContentLoaded',()=>initCodeInputs());
function initCodeInputs(){
  const digits=[...document.querySelectorAll('.cdig')];
  digits.forEach((inp,i)=>{
    inp.addEventListener('input',e=>{
      const v=inp.value.replace(/\D/g,'');
      inp.value=v?v[0]:'';
      inp.classList.toggle('filled',!!inp.value);
      // Авто-переход к следующему
      if(inp.value&&i<digits.length-1) digits[i+1].focus();
      // Если все заполнены — авто-подтверждение
      if(digits.every(d=>d.value)) setTimeout(()=>{ if(curTab==='r') doAuth(); },120);
    });
    inp.addEventListener('keydown',e=>{
      if(e.key==='Backspace'&&!inp.value&&i>0){ digits[i-1].focus(); digits[i-1].value=''; digits[i-1].classList.remove('filled'); }
      if(e.key==='Enter') doAuth();
    });
    inp.addEventListener('paste',e=>{
      e.preventDefault();
      const pasted=(e.clipboardData||window.clipboardData).getData('text').replace(/\D/g,'').slice(0,4);
      digits.forEach((d,j)=>{ d.value=pasted[j]||''; d.classList.toggle('filled',!!d.value); });
      if(pasted.length===4) setTimeout(()=>{ if(curTab==='r') doAuth(); },120);
    });
  });
}



function authErr(e){
  const m={
    'auth/user-not-found':'⚠ Пользователь не найден',
    'auth/wrong-password':'⚠ Неверный пароль',
    'auth/invalid-email':'⚠ Неверный e-mail',
    'auth/invalid-credential':'⚠ Неверный e-mail или пароль',
    'auth/too-many-requests':'⚠ Слишком много попыток',
    'auth/email-already-in-use':'⚠ E-mail уже используется',
    'auth/weak-password':'⚠ Пароль слишком простой',
    'auth/network-request-failed':'⚠ Нет соединения',
  };
  return m[e.code]||'⚠ '+e.message;
}

