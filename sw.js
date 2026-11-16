const CACHE='retromesh-v3';
const ASSETS=[
  "./",
  "index.html",
  "manifest.json",
  "icon-72.png",
  "icon-144.png",
  "icon-192.png",
  "icon-512.png",
  "css/base.css",
  "css/auth.css",
  "css/chats.css",
  "css/chat.css",
  "css/media.css",
  "css/calls.css",
  "css/ai.css",
  "css/profile.css",
  "css/overlays.css",
  "css/theme.css",
  "js/config.js",
  "js/core.js",
  "js/auth.js",
  "js/app.js",
  "js/listen.js",
  "js/chat.js",
  "js/voice.js",
  "js/modals.js",
  "js/groups.js",
  "js/selection.js",
  "js/profile.js",
  "js/message-menu.js",
  "js/presence.js",
  "js/reactions.js",
  "js/search-pin.js",
  "js/video.js",
  "js/calls.js",
  "js/theme.js",
  "js/ai.js",
  "js/boot.js"
];

self.addEventListener('install',e=>{
  // add по одному: если один файл недоступен, остальные всё равно кешируются
  e.waitUntil(caches.open(CACHE).then(c=>Promise.all(ASSETS.map(a=>c.add(a).catch(()=>{})))));
  self.skipWaiting();
});

self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(keys=>
    Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  const url=new URL(e.request.url);
  if(url.protocol!=='http:'&&url.protocol!=='https:') return;
  if(url.hostname.includes('firebase')||url.hostname.includes('gstatic')||
     url.hostname.includes('googleapis')||url.hostname.includes('emailjs')||
     url.hostname.includes('cloudflare')) return;
  e.respondWith(
    fetch(e.request)
      .then(res=>{
        // clone нужно делать сразу: после return тело ответа уже читается страницей
        if(res.ok){ const copy=res.clone(); caches.open(CACHE).then(c=>c.put(e.request,copy)); }
        return res;
      })
      .catch(()=>caches.match(e.request).then(r=>r||(e.request.mode==='navigate'?caches.match('index.html'):undefined)))
  );
});

self.addEventListener('notificationclick',e=>{
  e.notification.close();
  e.waitUntil(
    clients.matchAll({type:'window'}).then(list=>{
      for(const c of list) if('focus' in c) return c.focus();
      if(clients.openWindow) return clients.openWindow('/');
    })
  );
});
