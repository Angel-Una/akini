/* v905：Service Worker 已退役。
   本文件仅作为占位保留——防止旧版本安装包中残留的 service-worker.js 请求 404。
   新版页面永不注册 SW；boot-guard 启动时会注销一切存量注册并清理 akini-cache-* 缓存。
   数据保险箱 akini-vault-v1 缓存由 storage-mgr 维护，与本文件无关。 */
self.addEventListener('install', function (event) {
  self.skipWaiting();
});
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) {
          /* 退役 SW 激活时清掉自己的一切代码缓存，仅保留数据保险箱 */
          return key !== 'akini-vault-v1';
        }).map(function (key) {
          return caches.delete(key);
        })
      );
    }).then(function () {
      return self.clients.claim();
    }).then(function () {
      /* 主动注销：让本 SW 立即退出，页面回归直连网络模式 */
      return self.registration.unregister();
    })
  );
});
