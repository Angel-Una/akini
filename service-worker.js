const CACHE_NAME = 'akini-cache-v20260913zzu';
const PRECACHE_ASSETS = [
  './akini.html',
  './akini-style.css',
  './akini-main.js',
  './favicon.png',
  './localforage.min.js',
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
          // 数据保险箱缓存永不清除：它是 LS/IDB 被系统清理后的最后兜底
          return key !== CACHE_NAME && key !== 'akini-vault-v1';
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

self.addEventListener('message', function(event) {
  var d = event && event.data;
  if (d && d.type === 'GET_CACHE_NAME') {
    var reply = { type: 'CACHE_NAME', name: CACHE_NAME };
    try {
      if (event.source && event.source.postMessage) {
        event.source.postMessage(reply);
      } else if (self.clients && self.clients.matchAll) {
        self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(function(clients) {
          clients.forEach(function(c) { c.postMessage(reply); });
        });
      }
    } catch (e) {}
  }
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

// ---- 周期性后台同步：应用被系统冻结/杀死后，系统定时唤醒 SW 检查未读并发系统通知 ----
function akiniIdbGet(key) {
  return new Promise(function(resolve) {
    try {
      var req = indexedDB.open('AkiniApp');
      req.onsuccess = function() {
        try {
          var db = req.result;
          var tx = db.transaction('akini_data', 'readonly');
          var g = tx.objectStore('akini_data').get(key);
          g.onsuccess = function() { resolve(g.result != null ? g.result : null); };
          g.onerror = function() { resolve(null); };
        } catch (e) { resolve(null); }
      };
      req.onerror = function() { resolve(null); };
    } catch (e) { resolve(null); }
  });
}
self.addEventListener('periodicsync', function(event) {
  if (event.tag !== 'akini-bg-check') return;
  event.waitUntil(
    (async function() {
      try {
        // 有页面在前台时不打扰
        var cls = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (var i = 0; i < cls.length; i++) { if (cls[i].visibilityState === 'visible') return; }
        var unread = 0;
        var ss = await akiniIdbGet('akini_chat_sessions');
        if (ss) {
          try {
            var obj = typeof ss === 'string' ? JSON.parse(ss) : ss;
            Object.keys(obj || {}).forEach(function(k) { unread += (obj[k] && obj[k].unread) || 0; });
          } catch (e) {}
        }
        var mails = await akiniIdbGet('akini_mail_received');
        var seen = await akiniIdbGet('akini_mail_seen_count');
        var mailUnread = 0;
        if (mails) {
          try {
            var arr = typeof mails === 'string' ? JSON.parse(mails) : mails;
            mailUnread = Math.max(0, (Array.isArray(arr) ? arr.length : 0) - (parseInt(seen, 10) || 0));
          } catch (e) {}
        }
        var total = unread + mailUnread;
        if (total > 0) {
          await self.registration.showNotification('Akini 情侣空间', {
            body: 'Ta 给你留了 ' + total + ' 条新消息，快回来看看',
            icon: './favicon.png',
            badge: './favicon.png',
            tag: 'akini_bg_check_' + Date.now(),
            data: { app: 'chat' },
          });
        }
      } catch (e) {}
    })()
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  // 解析 tag（akini_<app>_<chatId>_<ts>），点击后让页面跳转到对应聊天/信箱
  var payload = { type: 'AKINI_NOTIF_TAP', app: '', chatId: '', ts: 0 };
  try {
    var m = String(event.notification && event.notification.tag || '').match(/^akini_([^_]+)_([^_]*)_(\d+)$/);
    if (m) { payload.app = m[1]; payload.chatId = m[2]; payload.ts = +m[3] || 0; }
  } catch(e){}
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url && client.url.indexOf('/akini') > -1) {
          try { client.postMessage(payload); } catch(e){}
          return client.focus();
        }
      }
      return self.clients.openWindow('./akini.html?notifApp=' + encodeURIComponent(payload.app || '') + '&notifChat=' + encodeURIComponent(payload.chatId || ''));
    }).catch(function() {
      return self.clients.openWindow('./akini.html?notifApp=' + encodeURIComponent(payload.app || '') + '&notifChat=' + encodeURIComponent(payload.chatId || ''));
    })
  );
});

self.addEventListener('message', function(event){
  if(event.data && event.data.type === 'GET_CACHE_NAME'){
    // 页面端通过 navigator.serviceWorker.addEventListener('message') 接收，需回 {type:'CACHE_NAME', name}
    try { if (event.source && event.source.postMessage) event.source.postMessage({ type: 'CACHE_NAME', name: CACHE_NAME }); } catch(e){}
    if(event.ports && event.ports[0]){
      event.ports[0].postMessage({ type: 'CACHE_NAME', name: CACHE_NAME, cacheName: CACHE_NAME });
    }
  }
});
