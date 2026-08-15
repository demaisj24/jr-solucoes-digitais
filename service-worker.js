const CACHE='vencivo-ai-v2';
const APP_SHELL=['/ia.html','/manifest.webmanifest','/icons/vencivo.svg'];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(cache=>cache.addAll(APP_SHELL))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  const url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname==='/api/chat')return;

  // HTML: rede primeiro para evitar que uma versão antiga do app fique presa no cache.
  if(request.mode==='navigate'||url.pathname.endsWith('.html')){
    event.respondWith(
      fetch(request)
        .then(response=>{
          if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy));}
          return response;
        })
        .catch(()=>caches.match(request).then(cached=>cached||caches.match('/ia.html')))
    );
    return;
  }

  // Recursos estáticos: cache primeiro, com atualização em segundo plano.
  event.respondWith(
    caches.match(request).then(cached=>{
      const network=fetch(request).then(response=>{
        if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy));}
        return response;
      });
      return cached||network.catch(()=>caches.match('/ia.html'));
    })
  );
});
