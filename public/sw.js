const CACHE_NAME = 'accounts-manager-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/index.css',
  '/app.js',
  '/icon.png',
  '/manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (e) => {
  // For API requests, network first, then fallback to cache
  if (e.request.url.includes('/api/')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
  } else {
    // For static assets, cache first, then fallback to network
    e.respondWith(
      caches.match(e.request).then((response) => response || fetch(e.request))
    );
  }
});
