// Akini 通知专用 Service Worker——不缓存任何资源，只处理通知点击
self.addEventListener('install', function(e) { self.skipWaiting(); });
self.addEventListener('activate', function(e) { e.waitUntil(clients.claim()); });
self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(function(cs){
    if (cs.length > 0) { cs[0].focus(); return; }
    return clients.openWindow('/');
  }));
});
