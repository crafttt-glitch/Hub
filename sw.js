/* Hub de Neurologia v43 — cópia completa offline e atualização sem interromper a leitura. */
'use strict';
const SCOPE = new URL(self.registration.scope);
const INDEX = new URL('index.html', SCOPE).href;
const PREFIX = 'manual-hub-neurologia-' + encodeURIComponent(SCOPE.pathname) + '-';
const CACHE = PREFIX + 'v43';
const ASSETS = ['manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'].map(path => new URL(path, SCOPE).href);
let refreshing;
const offlinePage = () => new Response('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Preparar acesso offline</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f4f7f1;color:#263d3a;font:16px/1.6 system-ui}main{max-width:32rem;padding:2rem}a{color:#286858}</style><main><h1>A cópia offline ainda não está pronta</h1><p>Conecte-se uma vez e aguarde o aviso “4 manuais disponíveis offline” no Hub. Depois você pode fechar e reabrir este endereço sem internet.</p><a href="' + SCOPE.href + '">Tentar novamente</a></main></html>', {status:503,headers:{'Content-Type':'text/html; charset=utf-8'}});
function isEntry(url) {return url.origin === SCOPE.origin && (url.pathname === SCOPE.pathname || url.pathname === new URL(INDEX).pathname)}
async function download(url, html = false) {
 const response = await fetch(new Request(url, {cache:'no-store',credentials:'same-origin'}));
 if (!response.ok || response.redirected || response.type === 'opaque') throw Error('Arquivo offline indisponível');
 if (html) {
  if (!response.headers.get('Content-Type')?.includes('text/html')) throw Error('Resposta não é um HTML');
  const text = await response.clone().text();
  if (!text.includes('name="manual-hub-build"') || !/\bconst MANUALS\s*=/.test(text) || !text.includes('const ReaderHistory=') || !text.trimEnd().endsWith('</html>')) throw Error('Documento incompleto ou diferente do Hub');
 } else if (url.endsWith('.png') && !response.headers.get('Content-Type')?.startsWith('image/png')) throw Error('Ícone inválido');
 else if (url.endsWith('.webmanifest')) {const manifest=await response.clone().json();if(!manifest.name||!manifest.start_url)throw Error('Manifesto inválido')}
 return response;
}
async function complete(cache) {return (await Promise.all([INDEX,...ASSETS].map(url=>cache.match(url)))).every(Boolean)}
async function notify() {
 const ready=await complete(await caches.open(CACHE));
 for (const client of await self.clients.matchAll({type:'window',includeUncontrolled:true})) if(client.url.startsWith(SCOPE.href)) client.postMessage({type:'HUB_OFFLINE_STATUS',ready,version:43});
}
async function refresh() {
 if (refreshing) return refreshing;
 refreshing=(async()=>{const cache=await caches.open(CACHE),response=await download(SCOPE.href,true);await cache.put(INDEX,response);for(const url of ASSETS)if(!await cache.match(url))await cache.put(url,await download(url));await notify();return true})().finally(()=>{refreshing=null});
 return refreshing;
}
self.addEventListener('install',event=>event.waitUntil((async()=>{
 // Complete the new generation before activating it; an existing worker/cache stays usable on failure.
 const cache=await caches.open(CACHE);
 await cache.put(INDEX,await download(SCOPE.href,true));
 for(const url of ASSETS)await cache.put(url,await download(url));
 if(!await complete(cache))throw Error('Cópia offline incompleta');
 await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 if(!await complete(await caches.open(CACHE)))throw Error('Cópia offline incompleta');
 await self.clients.claim();
 for(const name of await caches.keys())if(name.startsWith(PREFIX)&&name!==CACHE)await caches.delete(name);
 await notify();
})()));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);
 if(event.request.mode==='navigate'&&isEntry(url)){
  // Register the background lifetime synchronously, even when the cached response is returned immediately.
  const update=refresh().catch(()=>false);event.waitUntil(update);
  event.respondWith((async()=>{const cache=await caches.open(CACHE),saved=await cache.match(INDEX);if(saved)return saved;await update;return await cache.match(INDEX)||offlinePage()})());return;
 }
 if(ASSETS.includes(url.href))event.respondWith((async()=>{const cache=await caches.open(CACHE),saved=await cache.match(url.href);if(saved)return saved;const response=await download(url.href);await cache.put(url.href,response.clone());return response})());
});
self.addEventListener('message',event=>{
 if(event.data?.type==='HUB_OFFLINE_STATUS')event.waitUntil((async()=>{const ready=await complete(await caches.open(CACHE));event.ports[0]?.postMessage({type:'HUB_OFFLINE_STATUS',ready,version:43})})());
 if(event.data?.type==='HUB_OFFLINE_UPDATE')event.waitUntil(refresh().catch(()=>false));
});
