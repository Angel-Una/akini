/*
 * akini-storage-safe.js
 * 全局数据安全读写层：核心数据（聊天、联系人、信箱、朋友圈、iCity、字卡库等）
 * 统一改为 IndexedDB 优先，localStorage 仅作热备/兜底。
 * 目标：根治 localStorage 5MB 配额导致的数据静默丢失。
 *
 * 兼容 _idbStore 延迟初始化：akini-main.js 先创建 _idbStore，本层检测到后立即生效。
 */
(function () {
  'use strict';
  if (window.__akiniStorageSafeReady) return;
  window.__akiniStorageSafeReady = true;

  var CRITICAL_KEYS = [
    'akini_contacts',
    'akini_contacts_backup',
    'akini_groups',
    'akini_groups_backup',
    'akini_chat_sessions',
    'akini_chat_sessions_backup',
    'akini_home_avatars',
    'akini_home_avatars_backup',
    'akini_mail_sent',
    'akini_mail_sent_backup',
    'akini_mail_received',
    'akini_mail_received_backup',
    'akini_posts',
    'akini_posts_backup',
    'akini_icity_diaries',
    'akini_icity_diaries_backup',
    'akini_wordbank',
    'akini_wordbank_backup',
    'akini_wb_groups',
    'akini_wb_groups_backup',
    'akini_stickers',
    'akini_stickers_idx',
    'akini_stickers_backup',
    'akini_stickers_idx_backup',
    'akini_chat_pins',
    'akini_chat_pins_backup',
    'akini_my_avatar',
    'akini_my_avatar_backup',
    'akini_ta_avatar',
    'akini_ta_avatar_backup',
    'akini_icity_my_avatar',
    'akini_icity_my_avatar_backup',
    'akini_icity_ta_avatar',
    'akini_icity_ta_avatar_backup',
    'akini_my_name',
    'akini_my_name_backup',
    'akini_ta_name',
    'akini_ta_name_backup',
    'akini_music_playlist'
  ];
  var CHAT_HISTORY_RE = /^akini_chat_history_/;
  var WB_GROUPS_RE = /^akini_wb_groups_/;

  function getIDB() { return window._idbStore; }

  var CONTACT_AVATAR_RE = /^akini_contact_avatar_/;
  function isCriticalKey(k) {
    if (!k) return false;
    var ks = String(k);
    // 高频调度键（每几秒写一次）不走双写/全量备份，否则 IDB 事务堆积导致越用越卡、写入失败丢数据
    if (ks.indexOf("akini_next_") === 0 || ks.indexOf("akini_last_") === 0) return false;
    // 全量保护：凡 akini_ 前缀的键（设置/内容/图片/任何数据）一律镜像 IDB，网站长期使用任何数据都不丢失
    if (ks.indexOf("akini_") === 0) return true;
    if (CRITICAL_KEYS.indexOf(k) >= 0) return true;
    if (CHAT_HISTORY_RE.test(k)) return true;
    if (WB_GROUPS_RE.test(k)) return true;
    if (CONTACT_AVATAR_RE.test(k)) return true; // 联系人头像专用键，走 IDB 优先读写
    return false;
  }

  function safeStringify(v) {
    try { return JSON.stringify(v); } catch (e) { return null; }
  }

  function safeParse(s, fallback) {
    if (s == null) return fallback;
    try { return JSON.parse(s); } catch (e) { return fallback; }
  }

  function lsGet(k) {
    try { return localStorage.getItem(k); } catch (e) { return null; }
  }

  function lsSet(k, v) {
    try { localStorage.setItem(k, v); return true; } catch (e) { return false; }
  }

  function lsRemove(k) {
    try { localStorage.removeItem(k); } catch (e) { return false; }
  }

  // 内存缓存：作为 IDB 与 localStorage 之上的同步读取层，避免 localStorage 写满后读不到最新数据
  var memoryCache = {};

  function memGet(k) {
    return memoryCache.hasOwnProperty(k) ? memoryCache[k] : null;
  }

  function memSet(k, v) {
    memoryCache[k] = v;
  }

  function memRemove(k) {
    delete memoryCache[k];
  }

  function idbGet(k, cb) {
    var IDB = getIDB();
    if (!IDB || !IDB.get) { if (cb) cb(null); return; }
    try {
      IDB.get(k, function (v) { if (cb) cb(v != null ? String(v) : null); });
    } catch (e) { if (cb) cb(null); }
  }

  /* ===== milk 式防抖批量写（throttledSaveData 500ms）=====
   * 内存 + localStorage 保持同步写（页面内同步读取语义不变），
   * IndexedDB 写入进入去重队列，500ms 防抖后批量落盘；
   * backupAll 全量快照 30s 节流（原实现每次写入都全库遍历比对，是卡顿/发烫主因）；
   * 页面隐藏/关闭时立即 flush，保证数据可靠长期保存。 */
  var _idbQueue = {};
  var _idbFlushTimer = null;
  var _lastBackupAllAt = 0;

  function flushIdbQueue() {
    _idbFlushTimer = null;
    var keys = Object.keys(_idbQueue);
    if (!keys.length) return;
    var IDB = getIDB();
    if (!IDB || !IDB.set) {
      // IDB 未就绪：500ms 后重试，队列不丢
      _idbFlushTimer = setTimeout(flushIdbQueue, 500);
      return;
    }
    var batch = _idbQueue;
    _idbQueue = {};
    keys.forEach(function (k) {
      try { IDB.set(k, batch[k]); IDB.set(k + '_backup', batch[k]); } catch (e) {}
    });
    if (IDB.backupAll && Date.now() - _lastBackupAllAt > 30000) {
      _lastBackupAllAt = Date.now();
      try { IDB.backupAll(); } catch (e) {}
    }
  }

  function scheduleIdbFlush() {
    if (_idbFlushTimer) return;
    _idbFlushTimer = setTimeout(flushIdbQueue, 500);
  }

  function queueIdbWrite(k, v) {
    _idbQueue[k] = String(v); // 同 key 去重，只保留最新值
    scheduleIdbFlush();
  }

  // 页面切后台/关闭时立即落盘，防止防抖窗口内丢数据
  try {
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) flushIdbQueue();
    });
    window.addEventListener('pagehide', flushIdbQueue);
    window.addEventListener('beforeunload', flushIdbQueue);
  } catch (e) {}

  function idbSet(k, v, cb) {
    queueIdbWrite(k, v);
    if (cb) cb(true);
  }

  function idbRemove(k, cb) {
    delete _idbQueue[k];
    delete _idbQueue[k + '_backup'];
    var IDB = getIDB();
    if (!IDB || !IDB.remove) { if (cb) cb(false); return; }
    try { IDB.remove(k); IDB.remove(k + '_backup'); if (cb) cb(true); } catch (e) { if (cb) cb(false); }
  }

  function idbKeys(cb) {
    var IDB = getIDB();
    if (!IDB || !IDB.keys) { if (cb) cb([]); return; }
    try { IDB.keys(cb); } catch (e) { if (cb) cb([]); }
  }

  // 对关键 key 的异步读取：优先 IDB，其次 backup，最后 localStorage
  function akiniGet(k, cb) {
    if (!isCriticalKey(k)) {
      if (cb) cb(lsGet(k));
      return;
    }
    idbGet(k, function (v) {
      if (v != null && v !== '') { if (cb) cb(v); return; }
      idbGet(k + '_backup', function (b) {
        if (b != null && b !== '') { if (cb) cb(b); return; }
        if (cb) cb(lsGet(k));
      });
    });
  }

  // 同步读取：优先内存缓存（IDB 权威数据会预加载到这里），再读 localStorage
  function akiniGetSync(k) {
    var mem = memGet(k);
    if (mem !== null) return mem;
    return lsGet(k);
  }

  function akiniSet(k, v, cb) {
    if (typeof v !== 'string') v = String(v);
    memSet(k, v);
    if (!isCriticalKey(k)) {
      var ok = lsSet(k, v);
      if (cb) cb(ok);
      return;
    }
    // 大值守卫（milk 式存储）：>150KB 的键只写 IDB + 内存，localStorage 热备删除以释放配额
    // 读取侧有保障：akiniGet 先查 IDB；启动时 restoreCriticalFromIdb 会把 IDB 值预加载进内存缓存
    if (v.length > 153600) {
      // 大键：IDB 为主存储；LS 尽力回写（写失败只影响热备，不影响数据），绝不删除 LS 旧值——
      // 站内大量读取路径直读 localStorage，删 LS 会导致"数据明明在库里却读不到=看似消失"
      idbSet(k, v, function (idbOk) {
        try { lsSet(k, v); } catch (e) {}
        if (cb) cb(idbOk);
      });
      return;
    }
    // 优先写 IDB（主存储），再写 localStorage（热备，失败不影响）
    idbSet(k, v, function (idbOk) {
      var lsOk = lsSet(k, v);
      if (!lsOk) {
        try { lsSet(k + '_backup', v); } catch (e) {}
      }
      if (cb) cb(idbOk || lsOk);
    });
  }

  function akiniRemove(k, cb) {
    memRemove(k);
    lsRemove(k);
    lsRemove(k + '_backup');
    idbRemove(k, cb);
  }

  function akiniGetJson(k, cb, fallback) {
    akiniGet(k, function (v) { cb(safeParse(v, fallback)); });
  }

  function akiniSetJson(k, v, cb) {
    var s = safeStringify(v);
    if (s == null) { if (cb) cb(false); return; }
    akiniSet(k, s, cb);
  }

  function restoreOneKey(k, cb) {
    akiniGet(k, function (v) {
      if (v != null) {
        memSet(k, v);
        var ls = lsGet(k);
        if (v.length <= 153600 && v.length > (ls ? ls.length : 0)) {
          try { localStorage.setItem(k, v); } catch (e) {}
        }
      }
      if (typeof cb === 'function') cb();
    });
  }

  function restoreCriticalFromIdb() {
    var staticKeys = CRITICAL_KEYS.filter(function (k) { return k.indexOf('_backup') < 0; });
    function run(keys) {
      var remaining = keys.length;
      function fireRestored() {
        try { if (typeof window.__akiniOnCriticalRestored === 'function') window.__akiniOnCriticalRestored(); } catch (e) {}
      }
      if (!remaining) { fireRestored(); return; }
      keys.forEach(function (k) {
        restoreOneKey(k, function () {
          remaining--;
          if (remaining <= 0) fireRestored();
        });
      });
    }
    // 先把联系人头像专用键（动态前缀）从 IDB 查出，与静态关键键合并后一起恢复
    idbKeys(function (allKeys) {
      var avKeys = Array.isArray(allKeys)
        ? allKeys.filter(function (k) { return CONTACT_AVATAR_RE.test(k) && k.indexOf('_backup') < 0; })
        : [];
      run(staticKeys.concat(avKeys));
    });
  }

  function restoreChatHistoryFromIdb() {
    idbKeys(function (keys) {
      if (!Array.isArray(keys)) return;
      keys.forEach(function (k) {
        if (CHAT_HISTORY_RE.test(k) && k.indexOf('_backup') < 0) {
          restoreOneKey(k);
        }
      });
    });
  }

  // 一次性搬迁：localStorage 里残留的 >150KB critical 大键迁到 IDB 并删除（milk 式：LS 只留小数据）
  function evictBigKeysToIdb() {
    try {
      var doomed = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!k || !isCriticalKey(k)) continue;
        var v = localStorage.getItem(k);
        if (v && v.length > 153600) doomed.push({ k: k, v: v });
      }
      doomed.forEach(function (it) {
        memSet(it.k, it.v);
        idbSet(it.k, it.v, function () {
          try { localStorage.removeItem(it.k); } catch (e) {}
          try { localStorage.removeItem(it.k + '_backup'); } catch (e) {}
        });
      });
      if (doomed.length) console.log('[存储瘦身] 大键迁入浏览器库:', doomed.length, '个');
    } catch (e) {}
  }

  function restoreAll() {
    restoreCriticalFromIdb();
    setTimeout(restoreChatHistoryFromIdb, 100);
    setTimeout(evictBigKeysToIdb, 800);
  }

  // 暴露全局接口
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

  // 监听 _idbStore 出现后立即恢复一次关键数据
  var _restoreTimer = null;
  function tryRestoreWhenReady() {
    if (getIDB() && getIDB().set) {
      restoreAll();
      return true;
    }
    return false;
  }

  if (!tryRestoreWhenReady()) {
    _restoreTimer = setInterval(function () {
      if (tryRestoreWhenReady()) {
        clearInterval(_restoreTimer);
        _restoreTimer = null;
      }
    }, 50);
    // 最多等 5 秒
    setTimeout(function () {
      if (_restoreTimer) { clearInterval(_restoreTimer); _restoreTimer = null; restoreAll(); }
    }, 5000);
  }

  // 页面加载完成后再兜底恢复一次
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(restoreAll, 300); });
  } else {
    setTimeout(restoreAll, 300);
  }

  console.log('[akini-storage-safe] 核心数据 IDB 优先安全层已加载');
})();

/*
 * 拦截 localStorage.setItem/removeItem：关键 key 的写入优先走 IDB。
 * 即使 _idbStore 尚未初始化，也会排队，等可用后一次性刷入 IDB。
 */
(function () {
  var CRITICAL_KEYS = window.akiniStore ? (function () {
    // 复用上面的列表
    var keys = [
      'akini_contacts','akini_groups','akini_chat_sessions','akini_home_avatars',
      'akini_mail_sent','akini_mail_received','akini_posts','akini_icity_diaries',
      'akini_wordbank','akini_wb_groups','akini_stickers','akini_stickers_idx','akini_chat_pins',
      'akini_my_avatar','akini_ta_avatar','akini_icity_my_avatar','akini_icity_ta_avatar',
      'akini_my_name','akini_ta_name'
    ];
    var out = [];
    keys.forEach(function (k) { out.push(k); out.push(k + '_backup'); });
    return out;
  })() : [];
  var CHAT_HISTORY_RE = /^akini_chat_history_/;
  var WB_GROUPS_RE2 = /^akini_wb_groups_/;

  function isCritical(k) {
    if (!k) return false;
    if (CRITICAL_KEYS.indexOf(k) >= 0) return true;
    if (CHAT_HISTORY_RE.test(k)) return true;
    if (WB_GROUPS_RE2.test(k)) return true;
    return false;
  }

  function queueIDBWrite(k, v) {
    // 统一走第一段的 milk 式防抖队列（500ms 批量落盘，页面隐藏时立即落盘）
    if (window.akiniStore && window.akiniStore._queueIdbWrite) {
      window.akiniStore._queueIdbWrite(k, v);
    }
  }

  var origSetItem = localStorage.setItem;
  var origRemoveItem = localStorage.removeItem;

  localStorage.setItem = function (k, v) {
    // 关键 key 同步到内存缓存，确保即使 localStorage 写满也能读到最新值
    if (isCritical(k)) memSet(k, String(v));
    // 先执行原 localStorage 写入（保持同步语义）
    try { origSetItem.call(localStorage, k, v); } catch (e) {}
    if (isCritical(k)) queueIDBWrite(k, String(v));
  };

  localStorage.removeItem = function (k) {
    try { origRemoveItem.call(localStorage, k); } catch (e) {}
    if (isCritical(k)) {
      memRemove(k);
      var IDB = window._idbStore;
      if (IDB && IDB.remove) {
        try { IDB.remove(k); IDB.remove(k + '_backup'); } catch (e) {}
      }
    }
  };
})();
