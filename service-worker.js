const CACHE_NAME = 'akini-cache-v1';
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './akini.html',
  './akini-style.css',
  './akini-main.js',
  './favicon.png'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(PRECACHE_ASSETS);
    }).catch(function(){})
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) {
          return key !== CACHE_NAME;
        }).map(function(key) {
          return caches.delete(key);
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request).then(function(response) {
      return response || fetch(event.request);
    }).catch(function() {
      return fetch(event.request);
    })
  );
});

self.addEventListener('push', function(event) {
  if (!event.data) return;
  try {
    const payload = event.data.json();
    const title = payload.title || 'Akini';
    const options = {
      body: payload.body || '你有一条新消息',
      icon: './favicon.png',
      badge: './favicon.png',
      tag: payload.tag || 'akini-default',
      data: payload.data || {}
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (e) {
    const title = 'Akini';
    const options = { body: '你有一条新消息', icon: './favicon.png' };
    event.waitUntil(self.registration.showNotification(title, options));
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    self.clients.openWindow('./akini.html')
  );
});
