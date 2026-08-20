const CACHE_NAME = 'akini-cache-v20260821u';
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
  // 对 HTML 导航请求使用 network-first，避免缓存旧版本导致异常刷新
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then(function(response) {
        if (response && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          }).catch(function(){});
        }
        return response;
      }).catch(function() {
        return caches.match(event.request, { ignoreSearch: true });
      })
    );
    return;
  }

  // 静态资源使用 cache-first，忽略查询参数以兼容版本戳
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(function(cached) {
      if (cached) return cached;
      return fetch(event.request).then(function(response) {
        if (response && response.status === 200 && response.type === 'basic') {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          }).catch(function(){});
        }
        return response;
      });
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
