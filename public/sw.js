const CACHE = 'velor-one-v1'
const ASSETS = ['/', '/index.html', '/manifest.json']

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)))
    self.skipWaiting()
})

self.addEventListener('activate', e => {
    e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))))
    self.clients.claim()
})

self.addEventListener('fetch', e => {
    if (e.request.method !== 'GET') return
    e.respondWith(
          fetch(e.request).catch(() => caches.match(e.request))
        )
})

self.addEventListener('push', e => {
    const data = e.data?.json() || {}
        e.waitUntil(
              self.registration.showNotification(data.title || 'Velor One', {
                      body: data.body || '',
                      icon: '/icon-192.png',
                      badge: '/icon-192.png',
                      tag: data.tag || 'velor-one',
                      data: { url: data.url || '/' }
              })
            )
})

self.addEventListener('notificationclick', e => {
    e.notification.close()
    e.waitUntil(clients.openWindow(e.notification.data?.url || '/'))
})
