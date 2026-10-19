const V='nashdom-v4';
const FILES=['./','index.html','css/app.css','js/assets.js','js/core.js','js/pages1.js', 'js/pins.js','js/pages2.js','js/stage2.js','js/stage3.js','js/sync.js','js/main.js','manifest.webmanifest','icons/icon.svg','fonts/literata-r.woff','fonts/literata-m.woff','fonts/literata-sb.woff','fonts/literata-i.woff','fonts/literata-mi.woff'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET'||new URL(e.request.url).pathname.startsWith('/api/'))return;
  e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(V).then(ca=>ca.put(e.request,c));return r}).catch(()=>caches.match(e.request).then(m=>m||caches.match('index.html'))));
});
