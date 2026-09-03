const CACHE_NAME = 'akini-cache-v20260946';
const PRECACHE_ASSETS = [
  './akini.html',
  './akini-style.css',
  './akini-main.js',
  './qrcode-bundle.js',
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
  var req = event.request;
  var url = new URL(req.url);
  var isNav = req.mode === 'navigate';
  var isSW = url.pathname.endsWith('service-worker.js');
  if (isNav || isSW) {
    req = new Request(req.url, { method: req.method, mode: req.mode, cache: 'no-store' });
  }
  event.respondWith(
    fetch(req).then(function(response) {
      if (response && response.status === 200 && response.type === 'basic') {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, clone);
        }).catch(function(){});
      }
      return response;
    }).catch(function() {
      return caches.match(event.request, { ignoreSearch: true }).then(function(cached) {
        return cached || fetch(event.request);
      });
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
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url && client.url.indexOf('/akini') > -1) {
          client.focus();
          return;
        }
      }
      self.clients.openWindow('./akini.html');
    }).catch(function() {
      self.clients.openWindow('./akini.html');
    })
  );
});

self.addEventListener('message', function(event){
  if(event.data && event.data.type === 'GET_CACHE_NAME'){
    if(event.ports && event.ports[0]){
      event.ports[0].postMessage({cacheName: CACHE_NAME});
    }
  }
});
