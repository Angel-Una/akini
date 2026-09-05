/* ============================================================
 * Akini 自救 Service Worker（放在 GitHub 仓库【根目录】，与 akini 文件夹平级）
 * 作用：解除旧版根路径 Service Worker 的死锁（旧 SW 拦截页面导致白屏）
 * 原理：旧 SW 更新检查时会拉取根目录 /service-worker.js，拉到本文件后
 *       自动激活 → 清空过期的缓存（仅 Cache Storage 静态资源缓存，
 *       不碰 localStorage / IndexedDB 里的聊天记录等用户数据）
 *       → 让打开的页面重新加载 → 注销自己，从此不再拦截任何请求
 * ============================================================ */
self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (k) { return caches.delete(k); }));
      })
      .then(function () {
        return self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      })
      .then(function (clients) {
        clients.forEach(function (c) {
          try { c.navigate(c.url); } catch (e) {}
        });
        return self.registration.unregister();
      })
      .catch(function () {
        return self.registration.unregister();
      })
  );
});

/* 不注册 fetch 拦截：所有请求直接走网络，不再干预 */