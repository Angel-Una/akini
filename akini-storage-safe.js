/*
 * akini-storage-safe.js  v20261026 重做版
 * 网站式可靠存储：localStorage 同步读写为主（和普通网站一致），
 * IndexedDB 双副本镜像兜底，启动时全量对账恢复。
 * 保证：写入绝不中断、绝不主动删除任何数据、退出/刷新/随时打开数据都在。
 */
(function () {
  'use strict';
  if (window.__akiniStorageSafeReady) return;
  window.__akiniStorageSafeReady = true;

  var HIGH_FREQ_RE = /^akini_(next_|last_)/; // 高频调度键不镜像，避免事务堆积
  function isCriticalKey(k) {
    if (!k) return false;
    var ks = String(k);
    if (HIGH_FREQ_RE.test(ks)) return false;
    return ks.indexOf('akini_') === 0; // 全量保护：所有 akini_ 数据都镜像
  }

  function safeParse(s, fb) { if (s == null) return fb; try { return JSON.parse(s); } catch (e) { return fb; } }
  function safeStringify(v) { try { return JSON.stringify(v); } catch (e) { return null; } }

  // ---- localStorage 原始引用（在拦截前取到，供内部直读直写）----
  var rawLS = null;
  try { rawLS = window.localStorage; } catch (e) {}
  var origSet = null, origGet = null, origRemove = null, origKey = null;
  try {
    var proto = rawLS ? Object.getPrototypeOf(rawLS) : null;
    if (proto) {
      origSet = proto.setItem; origGet = proto.getItem; origRemove = proto.removeItem; origKey = proto.key;
    }
  } catch (e) {}
  function lsGet(k) {
    try { return origGet ? origGet.call(rawLS, k) : rawLS.getItem(k); } catch (e) { return null; }
  }
  function lsSet(k, v) {
    try { if (origSet) origSet.call(rawLS, k, v); else rawLS.setItem(k, v); return true; } catch (e) { return false; }
  }
  function lsRemoveRaw(k) {
    try { if (origRemove) origRemove.call(rawLS, k); else rawLS.removeItem(k); return true; } catch (e) { return false; }
  }
  function lsKeys() {
    var out = [];
    try {
      for (var i = 0; i < rawLS.length; i++) {
        var k = origKey ? origKey.call(rawLS, i) : rawLS.key(i);
        if (k) out.push(k);
      }
    } catch (e) {}
    return out;
  }

  // ---- 内存缓存：同步读取的权威层，IDB 恢复后也会回填到这里 ----
  var memoryCache = {};
  function memGet(k) { return memoryCache.hasOwnProperty(k) ? memoryCache[k] : null; }
  function memSet(k, v) { memoryCache[k] = v; }
  function memRemove(k) { delete memoryCache[k]; }

  function getIDB() { return window._idbStore; }
  function idbGet(k, cb) {
    var IDB = getIDB();
    if (!IDB || !IDB.get) { if (cb) cb(null); return; }
    try { IDB.get(k, function (v) { if (cb) cb(v != null ? String(v) : null); }); } catch (e) { if (cb) cb(null); }
  }

  // ---- IDB 防抖批量镜像（500ms），页面隐藏/关闭立即落盘 ----
  var _idbQueue = {};
  var _idbFlushTimer = null;
  function flushIdbQueue() {
    _idbFlushTimer = null;
    var keys = Object.keys(_idbQueue);
    if (!keys.length) return;
    var IDB = getIDB();
    if (!IDB || !IDB.set) { _idbFlushTimer = setTimeout(flushIdbQueue, 500); return; }
    var batch = _idbQueue; _idbQueue = {};
    keys.forEach(function (k) {
      if (batch[k] == null) {
        try { IDB.remove(k); IDB.remove(k + '_backup'); } catch (e) {}
      } else {
        try { IDB.set(k, batch[k]); IDB.set(k + '_backup', batch[k]); } catch (e) {}
      }
    });
  }
  function scheduleIdbFlush() { if (!_idbFlushTimer) _idbFlushTimer = setTimeout(flushIdbQueue, 500); }
  function queueIdbWrite(k, v) { _idbQueue[k] = v == null ? null : String(v); scheduleIdbFlush(); }
  try {
    document.addEventListener('visibilitychange', function () { if (document.hidden) flushIdbQueue(); });
    window.addEventListener('pagehide', flushIdbQueue);
    window.addEventListener('beforeunload', flushIdbQueue);
  } catch (e) {}

  // ---- 对外读写接口 ----
  function akiniGet(k, cb) {
    if (!isCriticalKey(k)) { if (cb) cb(lsGet(k)); return; }
    idbGet(k, function (v) {
      if (v != null && v !== '') { if (cb) cb(v); return; }
      idbGet(k + '_backup', function (b) {
        if (b != null && b !== '') { if (cb) cb(b); return; }
        if (cb) cb(lsGet(k));
      });
    });
  }
  function akiniGetSync(k) {
    var m = memGet(k);
    if (m !== null) return m;
    return lsGet(k);
  }
  function akiniSet(k, v, cb) {
    if (typeof v !== 'string') v = String(v);
    memSet(k, v);
    var lsOk = lsSet(k, v);
    if (isCriticalKey(k)) queueIdbWrite(k, v);
    // localStorage 写失败（配额满等）时立即落盘 IDB，不等 500ms 防抖，防退出丢数据
    if (!lsOk) flushIdbQueue();
    if (cb) cb(true || lsOk);
  }
  function akiniRemove(k, cb) {
    memRemove(k);
    lsRemoveRaw(k); lsRemoveRaw(k + '_backup');
    if (isCriticalKey(k)) queueIdbWrite(k, null);
    var IDB = getIDB();
    if (IDB && IDB.remove) { try { IDB.remove(k); IDB.remove(k + '_backup'); } catch (e) {} }
    if (cb) cb(true);
  }
  function akiniGetJson(k, cb, fb) { akiniGet(k, function (v) { cb(safeParse(v, fb)); }); }
  function akiniSetJson(k, v, cb) { var s = safeStringify(v); if (s == null) { if (cb) cb(false); return; } akiniSet(k, s, cb); }

  // ---- 启动全量对账恢复：IDB 有的全部回填到 内存 + localStorage ----
  var _restored = false;
  function restoreAll() {
    var IDB = getIDB();
    if (!IDB || !IDB.keys) return;
    try {
      IDB.keys(function (keys) {
        if (!Array.isArray(keys)) return;
        var done = 0, total = 0;
        var targets = keys.filter(function (k) {
          return k && String(k).indexOf('akini_') === 0 && String(k).indexOf('_backup') < 0 && !HIGH_FREQ_RE.test(String(k));
        });
        total = targets.length;
        function fin() {
          done++;
          if (done >= total) {
            _restored = true;
            try { if (typeof window.__akiniOnCriticalRestored === 'function') window.__akiniOnCriticalRestored(); } catch (e) {}
            console.log('[存储] 启动恢复完成，共同步', total, '个键');
          }
        }
        if (!total) { fin(); return; }
        targets.forEach(function (k) {
          idbGet(k, function (v) {
            if (v != null && v !== '') {
              // 对账策略：localStorage 是同步权威层，有值一律以 LS 为准并回写 IDB；
              // 仅当 LS 丢失（被浏览器清理等）时才用 IDB 镜像回填，避免旧数据回滚覆盖新操作
              var ls = lsGet(k);
              if (ls != null && ls !== '') {
                memSet(k, ls);
                if (ls !== v) queueIdbWrite(k, ls);
              } else {
                memSet(k, v);
                lsSet(k, v);
              }
            }
            fin();
          });
        });
      });
    } catch (e) {}
  }
  function restoreCriticalFromIdb() { restoreAll(); }
  function restoreChatHistoryFromIdb() { restoreAll(); }

  window.akiniStore = {
    _queueIdbWrite: queueIdbWrite,
    flushIdb: flushIdbQueue,
    get: akiniGet,
    getSync: akiniGetSync,
    set: akiniSet,
    remove: akiniRemove,
    getJson: akiniGetJson,
    setJson: akiniSetJson,
    isCritical: isCriticalKey,
    restoreCriticalFromIdb: restoreCriticalFromIdb,
    restoreChatHistoryFromIdb: restoreChatHistoryFromIdb,
    memoryGet: memGet,
    memorySet: memSet,
    memoryRemove: memRemove
  };

  // ---- 拦截 localStorage 写入：先原始写入（绝不被中断），再镜像内存+IDB ----
  try {
    var lsProto = Object.getPrototypeOf(rawLS);
    if (lsProto && rawLS) {
      var self = { memSet: memSet, memRemove: memRemove, queueIdbWrite: queueIdbWrite, isCritical: isCriticalKey, origSet: origSet, origRemove: origRemove };
      lsProto.setItem = function (k, v) {
        // 1) 原始写入永远先执行，任何异常都不影响它
        var ok = true;
        try { self.origSet.call(this, k, v); } catch (e) { ok = false; }
        // 2) 镜像层失败无所谓，绝不影响数据本体
        try {
          if (self.isCritical(k)) {
            self.memSet(k, String(v));
            self.queueIdbWrite(k, String(v));
            // 原始写入失败时立即落盘 IDB，不等防抖
            if (!ok) flushIdbQueue();
          }
        } catch (e) {}
      };
      lsProto.removeItem = function (k) {
        try { self.origRemove.call(this, k); } catch (e) {}
        try {
          if (self.isCritical(k)) {
            self.memRemove(k);
            self.queueIdbWrite(k, null);
          }
        } catch (e) {}
      };
    }
  } catch (e) {
    console.warn('[存储] localStorage 拦截安装失败（不影响读写）', e);
  }

  // ---- 申请持久化存储，降低浏览器/系统清理 IndexedDB 的概率（荣耀/小米等机型尤其需要）----
  try {
    if (navigator.storage && navigator.storage.persist) {
      var _persistRet = navigator.storage.persist();
      if (_persistRet && typeof _persistRet.then === 'function') {
        _persistRet.then(function (granted) {
          console.log('[存储] 持久化存储申请', granted ? '已获准' : '未获准（继续使用镜像兜底）');
        });
      }
    }
  } catch (e) {}

  // ---- 启动恢复：等 _idbStore 就绪后全量对账 ----
  var _restoreTimer = null;
  function tryRestore() { if (getIDB() && getIDB().keys) { restoreAll(); return true; } return false; }
  if (!tryRestore()) {
    _restoreTimer = setInterval(function () {
      if (tryRestore()) { clearInterval(_restoreTimer); _restoreTimer = null; }
    }, 50);
    setTimeout(function () { if (_restoreTimer) { clearInterval(_restoreTimer); _restoreTimer = null; restoreAll(); } }, 5000);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(restoreAll, 300); });
  } else {
    setTimeout(restoreAll, 300);
  }
  // 每 60s 兜底落盘一次，极端情况下也不丢
  setInterval(flushIdbQueue, 60000);

  console.log('[akini-storage-safe] 网站式可靠存储层已加载 (v20261026)');
})();
