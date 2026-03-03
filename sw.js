const CACHE = 'lucrotech-v13'
const FILES = [
  './index.html',
  './style.css',
  './storage.js',
  './calc.js',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './teste.html'
]

// INSTALL: cacheia TODOS os arquivos incluindo teste.html
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => {
      return Promise.allSettled(FILES.map(f => c.add(f)))
    })
  )
  self.skipWaiting()
})

// ACTIVATE: limpa caches antigos
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// FETCH: network-first, fallback para cache, fallback para index.html (evita 404)
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return
  const url = new URL(e.request.url)
  
  // Fontes do Google: network only, sem cache
  if (url.hostname.includes('fonts.g')) return

  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(e.request, clone))
        }
        return res
      })
      .catch(async () => {
        // Offline: tenta cache exato
        const cached = await caches.match(e.request)
        if (cached) return cached
        // Se não achou e é navegação, serve index.html (evita 404)
        if (e.request.mode === 'navigate') {
          return caches.match('./index.html')
        }
        return new Response('Offline', { status: 503 })
      })
  )
})

// Responde ao pedido de atualização imediata
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting()
})
