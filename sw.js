const SHELL='thai-shell-v1', AUDIO='thai-audio-v1';
const FILES=['./','index.html','style.css','app.js','data.js','manifest.webmanifest','icon-192.png','icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(SHELL).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==SHELL&&k!==AUDIO).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin)return;
  if(u.pathname.includes('/audio/')){
    e.respondWith(caches.open(AUDIO).then(async c=>{const key='audio/'+u.pathname.split('/audio/')[1];const hit=await c.match(key);if(hit)return hit;const r=await fetch(e.request);if(r.ok)c.put(key,r.clone());return r}));
    return;
  }
  // 앱 파일: 네트워크 우선, 실패 시 캐시
  e.respondWith(fetch(e.request).then(r=>{if(r.ok){const cl=r.clone();caches.open(SHELL).then(c=>c.put(e.request,cl))}return r}).catch(()=>caches.match(e.request,{ignoreSearch:true}).then(r=>r||caches.match('index.html'))));
});
