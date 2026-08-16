const CACHE='vencivo-v5';
const APP=['/','/index.html','/ia.html','/ia-v2.html','/whatsapp-config.html','/manifest.json','/icon.svg'];

self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(APP)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));

async function networkHtml(request){
  try{
    const response=await fetch(request,{cache:'no-store'});
    if(!response.ok)return response;
    const path=new URL(request.url).pathname;
    if(path.endsWith('/ia-v2.html')||path.endsWith('/whatsapp-config.html')){
      const text=await response.text();
      const injected=text.includes('/implant-flow.js')?text:text.replace('</body>','<script type="module" src="/implant-flow.js?v=5"></script></body>');
      const headers=new Headers(response.headers);
      headers.delete('content-length');
      return new Response(injected,{status:response.status,statusText:response.statusText,headers});
    }
    return response;
  }catch{return caches.match(request)}
}

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const url=new URL(e.request.url);
  if(url.origin!==self.location.origin)return;
  if(url.pathname.endsWith('/implant-flow.js')){
    e.respondWith(fetch(new Request(e.request.url,{cache:'no-store'})).catch(()=>caches.match(e.request)));
    return;
  }
  if(e.request.mode==='navigate'||url.pathname.endsWith('.html')){
    e.respondWith(networkHtml(e.request));
    return;
  }
  e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match('/index.html'))));
});