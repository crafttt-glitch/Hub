/* Hub de Neurologia V32 — cache imediato com atualização em segundo plano. */

const CACHE_PREFIX = 'manual-hub-neurologia-';
const CACHE_NAME = `${CACHE_PREFIX}v32`;
const HUB_URL = './';

const offlinePage = () => new Response(
  '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Hub indisponível</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f8f9fa;color:#202124;font:16px/1.5 system-ui}.box{max-width:32rem;padding:2rem}h1{font-size:1.6rem}</style><main class="box"><h1>Primeiro acesso necessário</h1><p>Abra o hub uma vez com internet para preparar seu funcionamento offline.</p></main>',
  {status:503,headers:{'Content-Type':'text/html; charset=utf-8'}}
);

async function fetchAndStore(request, cache) {
  const response = await fetch(request, {cache:'no-cache'});
  if (response.ok) await cache.put(HUB_URL, response.clone());
  return response;
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await fetchAndStore(HUB_URL, cache);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || event.request.mode !== 'navigate') return;

  let backgroundUpdate;
  const response = (async () => {
    const cache = await caches.open(CACHE_NAME);
    const saved = await cache.match(HUB_URL);

    if (saved) {
      backgroundUpdate = fetchAndStore(event.request, cache);
      return saved;
    }

    try {
      return await fetchAndStore(event.request, cache);
    } catch {
      return offlinePage();
    }
  })();

  event.respondWith(response);
  event.waitUntil((async () => {
    await response;
    if (backgroundUpdate) await backgroundUpdate.catch(() => undefined);
  })());
});
