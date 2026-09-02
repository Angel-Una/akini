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
    'akini_ta_name_backup'
  ];
  var CHAT_HISTORY_RE = /^akini_chat_history_/;
  var WB_GROUPS_RE = /^akini_wb_groups_/;

  function getIDB() { return window._idbStore; }

  function isCriticalKey(k) {
    if (!k) return false;
    if (CRITICAL_KEYS.indexOf(k) >= 0) return true;
    if (CHAT_HISTORY_RE.test(k)) return true;
    if (WB_GROUPS_RE.test(k)) return true;
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

  function idbSet(k, v, cb) {
    var IDB = getIDB();
    if (!IDB || !IDB.set) { if (cb) cb(false); return; }
    try {
      IDB.set(k, v);
      IDB.set(k + '_backup', v);
      if (IDB.backupAll) IDB.backupAll();
      if (cb) cb(true);
    } catch (e) { if (cb) cb(false); }
  }

  function idbRemove(k, cb) {
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

  function restoreOneKey(k) {
    akiniGet(k, function (v) {
      if (v == null) return;
      memSet(k, v);
      var ls = lsGet(k);
      if (v.length > (ls ? ls.length : 0)) {
        try { localStorage.setItem(k, v); } catch (e) {}
      }
    });
  }

  function restoreCriticalFromIdb() {
    CRITICAL_KEYS.forEach(function (k) {
      if (k.indexOf('_backup') >= 0) return;
      restoreOneKey(k);
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

  function restoreAll() {
    restoreCriticalFromIdb();
    setTimeout(restoreChatHistoryFromIdb, 100);
  }

  // 暴露全局接口
  window.akiniStore = {
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
  var pendingWrites = [];
  var pendingTimer = null;

  function isCritical(k) {
    if (!k) return false;
    if (CRITICAL_KEYS.indexOf(k) >= 0) return true;
    if (CHAT_HISTORY_RE.test(k)) return true;
    if (WB_GROUPS_RE2.test(k)) return true;
    return false;
  }

  function flushPending() {
    var IDB = window._idbStore;
    if (!IDB || !IDB.set) return;
    while (pendingWrites.length) {
      var item = pendingWrites.shift();
      try {
        IDB.set(item.k, item.v);
        IDB.set(item.k + '_backup', item.v);
      } catch (e) {}
    }
    if (IDB.backupAll) IDB.backupAll();
  }

  function watchIDB() {
    if (pendingTimer) return;
    pendingTimer = setInterval(function () {
      if (window._idbStore && window._idbStore.set) {
        flushPending();
        if (!pendingWrites.length) {
          clearInterval(pendingTimer);
          pendingTimer = null;
        }
      }
    }, 50);
    setTimeout(function () {
      if (pendingTimer) { clearInterval(pendingTimer); pendingTimer = null; flushPending(); }
    }, 5000);
  }

  function queueIDBWrite(k, v) {
    // 去重：只保留最后一次写入
    for (var i = pendingWrites.length - 1; i >= 0; i--) {
      if (pendingWrites[i].k === k) { pendingWrites.splice(i, 1); break; }
    }
    pendingWrites.push({ k: k, v: v });
    watchIDB();
  }

  var origSetItem = localStorage.setItem;
  var origRemoveItem = localStorage.removeItem;

  localStorage.setItem = function (k, v) {
    // 关键 key 同步到内存缓存，确保即使 localStorage 写满也能读到最新值
    if (isCritical(k)) memSet(k, String(v));
    // 先执行原 localStorage 写入（保持同步语义）
    try { origSetItem.call(localStorage, k, v); } catch (e) {}
    if (isCritical(k)) {
      var IDB = window._idbStore;
      if (IDB && IDB.set) {
        try {
          IDB.set(k, String(v));
          IDB.set(k + '_backup', String(v));
          if (IDB.backupAll) IDB.backupAll();
        } catch (e) {}
      } else {
        queueIDBWrite(k, String(v));
      }
    }
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
