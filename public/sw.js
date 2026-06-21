const CACHE = 'syntax-v10';
const OFFLINE = '/offline.html';

const PRECACHE = [
  OFFLINE,
  '/css/style.css',
  '/css/tokens.css',
  '/css/base.css',
  '/css/layout.css',
  '/css/components.css',
  '/css/pages.css',
  '/css/animations.css',
  '/js/main.js',
  '/js/chat.js',
  '/js/bank.js',
  '/js/shop.js',
  '/js/wheel.js',
  '/js/gift-box.js',
  '/images/logo.png',
  '/images/logo.svg',
  '/images/default-avatar.svg',
  '/favicon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim()).then(() =>
      self.clients.matchAll({ type: 'window' }).then(clients =>
        clients.forEach(c => c.postMessage({ type: 'SW_UPDATED' }))
      )
    )
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  if (!['localhost', '127.0.0.1'].includes(url.hostname.replace(/:.*$/, ''))) return;

  if (
    url.pathname.startsWith('/css/') ||
    url.pathname.startsWith('/js/') ||
    url.pathname.startsWith('/images/') ||
    url.pathname === '/offline.html' ||
    url.pathname === '/favicon.svg' ||
    url.pathname === '/favicon.ico' ||
    url.pathname === '/images/logo.png'
  ) {
    e.respondWith(
      fetch(e.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return response;
      }).catch(() => caches.match(e.request).then(c => c || Response.error()))
    );
    return;
  }

  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(response => {
        if (response.ok || response.status === 404 || response.status === 500) {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return response;
      }).catch(() => {
        return caches.match(e.request).then(cached => {
          return cached || caches.match(OFFLINE);
        });
      })
    );
    return;
  }
});
