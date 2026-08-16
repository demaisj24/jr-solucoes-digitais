const CACHE='vencivo-v9';
const APP=['/','/index.html','/ia.html','/ia-v2.html','/whatsapp-config.html','/conta.html','/implantacao.html','/manifest.json','/icon.svg'];

self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(APP)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))).then(()=>self.clients.claim()))));

async function networkHtml(request){
  try{
    const response=await fetch(request,{cache:'no-store'});
    if(!response.ok)return response;
    const path=new URL(request.url).pathname;
    const text=await response.text();
    let injected=text;
    if(!injected.includes('/ui-readable.js')){
      injected=injected.replace('</body>','<script src="/ui-readable.js?v=2"></script></body>');
    }
    if(path.endsWith('/ia-v2.html')||path.endsWith('/whatsapp-config.html')){
      if(!injected.includes('/implant-flow.js')){
        injected=injected.replace('</body>','<script type="module" src="/implant-flow.js?v=7"></script></body>');
      }
    }
    const headers=new Headers(response.headers);
    headers.delete('content-length');
    headers.set('Cache-Control','no-store');
    return new Response(injected,{status:response.status,statusText:response.statusText,headers});
  }catch{return caches.match(request)}
}

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const url=new URL(e.request.url);
  if(url.origin!==self.location.origin)return;

  // Nunca cachear APIs: respostas de autenticação, agentes e assinatura precisam ser sempre atuais.
  if(url.pathname.startsWith('/api/')){
    e.respondWith(fetch(new Request(e.request.url,{cache:'no-store'})));
    return;
  }

  if(url.pathname.endsWith('/implant-flow.js')||url.pathname.endsWith('/ui-readable.js')){
    e.respondWith(fetch(new Request(e.request.url,{cache:'no-store'})).catch(()=>caches.match(e.request)));
    return;
  }
  if(e.request.mode==='navigate'||url.pathname.endsWith('.html')){
    e.respondWith(networkHtml(e.request));
    return;
  }
  e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match('/index.html'))));
});
