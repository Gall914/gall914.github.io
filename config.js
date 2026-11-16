// RetroMesh — Конфиги EmailJS и Firebase (ключи тут)
// ════════════════════════════════════════
//  EMAILJS CONFIG — вставь свои ключи
// ════════════════════════════════════════
const EMAILJS_PUBLIC_KEY  = 'ihjP4Q-VNIWYuez36';
const EMAILJS_SERVICE_ID  = 'service_c6972sm';
const EMAILJS_TEMPLATE_ID = 'template_x1fopcq';
emailjs.init(EMAILJS_PUBLIC_KEY);

// ── Состояние верификации ──
let pendingReg = null;   // {nick, em, pw}
let verifyCode = '';     // 4-значный код
let verifyExpiry = 0;    // timestamp истечения
let resendCountdown = null;

firebase.initializeApp({
  apiKey:"AIzaSyBsi-K-yqcLw231KfqFqMd3XxrJrxztFbM",
  authDomain:"retromeshchat.firebaseapp.com",
  databaseURL:"https://retromeshchat-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:"retromeshchat",
  storageBucket:"retromeshchat.firebasestorage.app",
  messagingSenderId:"239709570570",
  appId:"1:239709570570:web:c22ce12fbf1737379fc1f3"
});
const auth = firebase.auth();
const db   = firebase.database();


// AI-ассистент (Groq). Ключ виден всем в браузере — см. README: его нужно перевыпустить.
const DEEPSEEK_KEY='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';
