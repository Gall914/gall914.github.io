// RetroMesh — Показ пароля, аватар
// ════════════════════════════════════════
//  PASSWORD VISIBILITY TOGGLE
// ════════════════════════════════════════
function togglePw(inputId, btn){
  const inp=$(inputId);
  const show = inp.type==='password';
  inp.type = show ? 'text' : 'password';
  btn.textContent = show ? '🙈' : '👁';
  btn.style.color = show ? 'var(--g1)' : 'var(--dim)';
}

// ════════════════════════════════════════
//  AVATAR
// ════════════════════════════════════════
let MY_AVATAR = ''; // base64 текущего пользователя
const avatarCache = {}; // {nick: base64}

function uploadAvatar(input){
  const file = input.files[0]; input.value='';
  if(!file) return;
  if(!file.type.startsWith('image/')) { toast('⚠ Только изображения'); return; }

  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      // Сжимаем до 200x200
      const SIZE = 200;
      const c = document.createElement('canvas');
      c.width = SIZE; c.height = SIZE;
      const ctx = c.getContext('2d');
      // Crop по центру
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      ctx.drawImage(img, sx, sy, side, side, 0, 0, SIZE, SIZE);
      const b64 = c.toDataURL('image/jpeg', 0.82);
      if(b64.length > 80*1024) { toast('⚠ Фото слишком большое, попробуй другое'); return; }
      saveAvatar(b64);
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

function saveAvatar(b64){
  if(!ME_UID) return;
  db.ref('avatars/'+ME_NICK).set(b64)
    .then(()=>{
      MY_AVATAR = b64;
      avatarCache[ME_NICK] = b64;
      applyAvatar('pav', b64);
      // Обновить маленькие аватарки в чат-листе
      renderList();
      toast('✓ Аватарка обновлена', 2000);
    })
    .catch(e => toast('⚠ '+e.message));
}

function applyAvatar(elId, b64){
  const el = $(elId); if(!el) return;
  if(b64){
    el.innerHTML = `<img src="${escA(b64)}" alt="av">`;
  } else {
    // Восстановить инициалы
    const nick = el.dataset.nick || ME_NICK || '?';
    el.innerHTML = ini(nick);
  }
}

function loadAvatar(nick, callback){
  if(avatarCache[nick] !== undefined){ callback(avatarCache[nick]); return; }
  db.ref('avatars/'+nick).once('value').then(s=>{
    const v = s.val() || '';
    avatarCache[nick] = v;
    callback(v);
  }).catch(()=>{ avatarCache[nick]=''; callback(''); });
}

function setAvatarEl(el, nick){
  if(!el) return;
  el.dataset.nick = nick;
  if(avatarCache[nick]){
    el.innerHTML = avatarCache[nick] ? `<img src="${escA(avatarCache[nick])}" alt="av">` : ini(nick);
  } else {
    el.innerHTML = ini(nick);
    loadAvatar(nick, b64=>{
      if(b64) el.innerHTML = `<img src="${escA(b64)}" alt="av">`;
    });
  }
}

