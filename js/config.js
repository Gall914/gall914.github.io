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


// AI-ассистент: Google Gemini (бесплатный тариф, ключ из https://aistudio.google.com/apikey)
// Ключ виден всем в браузере: ограничьте его по сайту (см. README) и не давайте платный биллинг.
const AI_KEY   = 'AQ.Ab8RN6LTNgJ6cVHyOw8gxZxonI_U2xoK0Xe_8h9UzoNPyWR3Jg';
const AI_MODEL = 'gemini-3.8-flash';   // если ответит «model not found» — возьмите ID модели из AI Studio
