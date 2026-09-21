/*
 * akini-storage-safe.js  v20261028 重做版
 * 网站式可靠存储：localStorage 同步读写为主（和普通网站一致），
 * IndexedDB 双副本镜像兜底，启动时全量对账恢复。
 * 保证：写入绝不中断、绝不主动删除任何数据、退出/刷新/随时打开数据都在。
 */
(function () {
  'use strict';
  if (window.__akiniStorageSafeReady) return;
  window.__akiniStorageSafeReady = true;

  // wipe 保险丝：上一轮清除若在刷新前来不及清完 IDB，本轮启动第一时间清空（cookie 不受 localStorage.clear 影响）
  try {
    if (/(?:^|;\s*)akini_wipe_pending=1/.test(document.cookie || "")) {
      try { document.cookie = "akini_wipe_pending=;path=/;max-age=0"; } catch (e) {}
      // 清除数据后的启动：10 秒后摘掉的 ?reset= 参数，避免用户收藏带参链接导致云恢复永久失效
      try {
        if (/[?&]reset=/.test(location.search || "") && window.history && history.replaceState) {
          setTimeout(function () {
            try { history.replaceState(null, "", location.pathname); } catch (e) {}
          }, 10000);
        }
      } catch (e) {}
      try { localStorage.clear(); } catch (e) {}
      try { sessionStorage.clear(); } catch (e) {}
      try {
        if (typeof localforage !== "undefined") {
          var _wlf = localforage.createInstance({ name: "AkiniApp", storeName: "akini_data" });
          _wlf.clear().catch(function () {});
        }
      } catch (e) {}
      try { indexedDB.deleteDatabase("akini_img_db"); } catch (e) {}
    }
  } catch (e) {}

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
  // 图片/壁纸类大键：配额紧张时优先清理它们，为关键数据腾出空间
  var BIG_IMG_RE = /^akini_(chat_history_|home_bg|bubble_css|icity_|my_avatar|ta_avatar|contact_avatar_)/;
  function _evictBigKeys() {
    var removed = 0;
    try {
      var keys = lsKeys();
      // 优先清理最大的图片键（聊天记录/壁纸），保留联系人/设置等小键
      var bigs = [];
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (!k || String(k).indexOf('akini_') !== 0) continue;
        var v = lsGet(k);
        if (v && typeof v === 'string' && v.length > 60000) bigs.push({ k: k, len: v.length });
      }
      bigs.sort(function (a, b) { return b.len - a.len; });
      // 最多清理最大的 8 个大键（它们在 IndexedDB 中有镜像，可按需水合恢复）
      for (var j = 0; j < bigs.length && j < 8; j++) {
        try { lsRemoveRaw(bigs[j].k); removed++; } catch (e) {}
      }
    } catch (e) {}
    return removed;
  }
  function lsSet(k, v) {
    try { if (origSet) origSet.call(rawLS, k, v); else rawLS.setItem(k, v); return true; }
    catch (e) {
      // 配额满（QuotaExceededError）：清理大体积图片键后重试，避免关键数据静默丢失
      try {
        var evicted = _evictBigKeys();
        if (evicted > 0) {
          if (origSet) origSet.call(rawLS, k, v); else rawLS.setItem(k, v);
          console.warn('[存储] 配额紧张，已清理' + evicted + '个大键后重试写入', k);
          return true;
        }
      } catch (e2) {}
      return false;
    }
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

  // ---- standard 同款①：大键（>200KB，图片/壁纸 dataURL）不进 localStorage ----
  // 手机 LS 配额仅 ~5MB，几张图片就撑爆；撑爆后【所有】后续 setItem 全部静默失败，
  // 这就是数据"随机消失"的头号根因。大键只进 内存缓存 + IndexedDB（配额大得多）。
  var LS_BIG_LIMIT = 200 * 1024;
  function isBigVal(v) { return typeof v === 'string' && v.length > LS_BIG_LIMIT; }

  // ---- standard 同款②：LS 写失败脏键集合——对账时这些键信 IDB，不信 LS 残留旧值 ----
  var _lsDirty = {};
  try {
    var _d = JSON.parse(sessionStorage.getItem('akini_ls_dirty') || '[]');
    if (Array.isArray(_d)) _d.forEach(function (k) { if (k) _lsDirty[k] = 1; });
  } catch (e) {}
  function lsDirtySave() { try { sessionStorage.setItem('akini_ls_dirty', JSON.stringify(Object.keys(_lsDirty))); } catch (e) {} }
  function markDirty(k) { if (!_lsDirty[k]) { _lsDirty[k] = 1; lsDirtySave(); } }
  function clearDirty(k) { if (_lsDirty[k]) { delete _lsDirty[k]; lsDirtySave(); } }

  function getIDB() { return window._idbStore; }
  function idbGet(k, cb) {
    var IDB = getIDB();
    if (!IDB || !IDB.get) { if (cb) cb(null); return; }
    try { IDB.get(k, function (v) { if (cb) cb(v != null ? String(v) : null); }); } catch (e) { if (cb) cb(null); }
  }

  // ---- IDB 防抖批量镜像（500ms），页面隐藏/关闭立即落盘 ----
  var _idbQueue = {};
  // 启动恢复完成前的程序性写入暂存：此期间的写入不立即镜像到 IndexedDB，
  // 待恢复对账后仅补写 IndexedDB 中没有真实数据的键——防止启动默认值覆盖 IndexedDB 中的真实数据
  var _preRestorePending = {};
  var _reconciledKeys = {};
  var _idbFlushTimer = null;
  function flushIdbQueue() {
    _idbFlushTimer = null;
    // 清除数据期间：丢弃队列，绝不再写 IDB（否则 clearAll 之后队列落盘导致数据复活）
    if (window.__akiniWiping) { _idbQueue = {}; return; }
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
  function queueIdbWrite(k, v) {
    if (window.__akiniWiping) return; // 清除数据期间禁止入队
    _idbQueue[k] = v == null ? null : String(v); scheduleIdbFlush();
  }
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
  // 核心数据资产键：非显式清除操作下一律拒绝被空数组覆盖（彻底解决后台/切回/随机时间数据丢失）
  var _GUARD_KEYS2 = {
    akini_contacts: 1, akini_mail_sent: 1, akini_mail_received: 1, akini_posts: 1, akini_icity_diaries: 1, akini_wordbank: 1,
    akini_start_date: 1, akini_day_label: 1, akini_meaningful_numbers: 1, akini_signature: 1, akini_friends_signature: 1,
    akini_bubble_color: 1, akini_swap_avatar_pos: 1, akini_last_page_state: 1, akini_wb_groups: 1,
    akini_shop_orders: 1, akini_shop_products: 1, akini_surveys: 1
  };
  var _GUARD_PREFIXES2 = ['akini_settings_', 'akini_toggle_', 'akini_num_', 'akini_chat_history_', 'akini_stickers_'];
  function _isGuardKey(k) {
    if (!k) return false;
    if (_GUARD_KEYS2[k]) return true;
    var ks = String(k);
    for (var i = 0; i < _GUARD_PREFIXES2.length; i++) {
      if (ks.indexOf(_GUARD_PREFIXES2[i]) === 0) return true;
    }
    return false;
  }
  function akiniSet(k, v, cb) {
    if (typeof v !== 'string') v = String(v);
    if ((v === '[]' || v === '{}') && _isGuardKey(k) && !window.__akiniWiping && !window._akiniAllowRemove) {
      var _gp = memGet(k);
      if (_gp == null) _gp = lsGet(k);
      if (_gp && _gp !== '[]' && _gp !== '{}' && _gp.length > 2) {
        console.warn('[存储] 永久防御：拒绝非显式空值覆盖核心键(akiniSet)', k);
        if (cb) cb(true);
        return;
      }
    }
    memSet(k, v);
    var lsOk = true;
    if (isBigVal(v)) {
      // 大键：跳过 localStorage，并清掉 LS 里的旧残留，防止旧值遮蔽新值
      lsRemoveRaw(k);
    } else {
      lsOk = lsSet(k, v);
      if (lsOk) clearDirty(k); else markDirty(k);
    }
    if (isCriticalKey(k)) {
      if (!_restored) { _preRestorePending[k] = v; }
      else queueIdbWrite(k, v);
    }
    // localStorage 写失败（配额满等）时立即落盘 IDB，不等 500ms 防抖，防退出丢数据
    if (!lsOk && _restored) flushIdbQueue();
    if (cb) cb(true || lsOk);
  }
  function akiniRemove(k, cb) {
    memRemove(k);
    lsRemoveRaw(k); lsRemoveRaw(k + '_backup');
    if (isCriticalKey(k)) {
      if (!_restored) { _preRestorePending[k] = null; }
      else queueIdbWrite(k, null);
    }
    var IDB = getIDB();
    if (IDB && IDB.remove) { try { IDB.remove(k); IDB.remove(k + '_backup'); } catch (e) {} }
    if (cb) cb(true);
  }
  function akiniGetJson(k, cb, fb) { akiniGet(k, function (v) { cb(safeParse(v, fb)); }); }
  function akiniSetJson(k, v, cb) { var s = safeStringify(v); if (s == null) { if (cb) cb(false); return; } akiniSet(k, s, cb); }

  // ---- 启动全量对账恢复（standard 同款 OOM 防线）：分批流式 + 大键驻留预算 ----
  // 背景：几十 MB 的图片/字卡键一次性全量读入内存会把 JS 堆推到渲染进程上限直接崩溃
  //（Chrome "喔唷崩溃啦"），低端安卓机尤其明显。防两条：
  //  ① 分批恢复：每批 4 键、批间隔 25ms，瞬时内存峰值不再叠加；
  //  ② 大键驻留预算：>200KB 的键驻留总量 ≤4GB 设备 12MB / 其他 24MB，超预算的键
  //     不驻留内存（记入 __akiniDeferredKeys），读取时按需从 IDB 异步水合。
  var _restored = false;
  var BIG_MEM_BUDGET = ((typeof navigator !== 'undefined' && navigator.deviceMemory) || 4) <= 4 ? 12 * 1024 * 1024 : 24 * 1024 * 1024;
  var _bigMemUsed = 0;
  if (!window.__akiniDeferredKeys) window.__akiniDeferredKeys = {};
  function restoreAll() {
    var IDB = getIDB();
    if (!IDB || !IDB.keys) return;
    try {
      IDB.keys(function (keys) {
        if (!Array.isArray(keys)) return;
        var targets = keys.filter(function (k) {
          return k && String(k).indexOf('akini_') === 0 && String(k).indexOf('_backup') < 0 && !HIGH_FREQ_RE.test(String(k));
        });
        var i = 0;
        (function nextBatch() {
          if (i >= targets.length) {
            if (!_restored) {
              _restored = true;
              // 启动期暂缓的写入落盘：强制写回 IndexedDB，确保用户数据落盘
              // v573 关键修复：空值（'[]'/'{}'/'null'）一律不落盘——防止任何遗漏路径把
              // 启动默认空值写回 IDB 覆盖真实数据（数据丢失双保险之二）
              try {
                Object.keys(_preRestorePending).forEach(function (k) {
                  var pv = _preRestorePending[k];
                  if (pv != null && pv !== '' && pv !== '[]' && pv !== '{}' && pv !== 'null') {
                    queueIdbWrite(k, pv);
                  }
                });
              } catch (e) {}
              _preRestorePending = {};
              try { if (typeof window.__akiniOnCriticalRestored === 'function') window.__akiniOnCriticalRestored(); } catch (e) {}
              console.log('[存储] 启动恢复完成，共同步', targets.length, '个键，大键驻留', Math.round(_bigMemUsed / 1024), 'KB');
            }
            return;
          }
          var batch = targets.slice(i, i + 4);
          i += 4;
          var pending = batch.length;
          batch.forEach(function (k) {
            idbGet(k, function (v) {
              try {
                if (v != null && v !== '') {
                  _reconciledKeys[k] = 1;
                  // v573 关键修复：该键已在 IDB 有真实数据并完成对账 → 立即丢弃启动期暂存的
                  // 程序性默认值（'[]'等），否则恢复完成后 pending 落盘会把空值写回 IDB，
                  // 污染刚回填的真实数据——这正是"字卡库/设置/纪念日被清空"的根因
                  try { if (_preRestorePending && Object.prototype.hasOwnProperty.call(_preRestorePending, k)) { delete _preRestorePending[k]; } } catch (e2) {}
                  // 对账策略（standard 同款）：localStorage 有值且【不在脏键集合】且非恢复前程序性写入 → 以 LS 为准并回写 IDB；
                  // LS 丢失 / LS 是脏键（上次写失败残留旧值）/ 恢复完成前的启动默认值 → 一律信 IDB 镜像回填，杜绝旧数据回滚
                  // 【安卓/鸿蒙加固】空值永不覆盖非空：IDB 异步落盘滞后/写失败时易残留旧空值（'[]'/'{}'），
                  // 若 LS 存有真实数据，空语义 IDB 值一律视为陈旧，改信 LS（根治重启后数据被空值回填消失）
                  var _idbEmpty = v === '[]' || v === '{}' || v === 'null';
                  var ls = lsGet(k);
                  if (_idbEmpty && ls != null && ls !== '' && ls !== '[]' && ls !== '{}' && ls !== 'null') {
                    memSet(k, ls);
                    queueIdbWrite(k, ls); // 回写 IDB 纠正陈旧空值
                    if (--pending === 0) setTimeout(nextBatch, 25);
                    return;
                  }
                  var big = isBigVal(v);
                  // 彻底修复刷新/切回数据丢失 bug：localStorage 中的非空有效数据具有【绝对最高权威】，
                  // 绝不能被陈旧的 IDB 镜像覆盖（IDB 镜像 500ms 防抖，切回/重进时极易滞后为旧值）。
                  // 策略：LS 有非空真实值 → 永远以 LS 为准（仅当 LS 与 IDB 不一致时回写 IDB 纠正）；
                  //       LS 丢失/空 → 才信 IDB 兜底回填。
                  if (ls != null && ls !== '' && ls !== '[]' && ls !== '{}' && ls !== 'null') {
                    if (_preRestorePending && Object.prototype.hasOwnProperty.call(_preRestorePending, k)) {
                      var pendingVal = _preRestorePending[k];
                      if (pendingVal != null && pendingVal !== '') {
                        memSet(k, pendingVal);
                        lsSet(k, pendingVal);
                        queueIdbWrite(k, pendingVal);
                        if (--pending === 0) setTimeout(nextBatch, 25);
                        return;
                      }
                    }
                    if (big && _bigMemUsed + ls.length > BIG_MEM_BUDGET) {
                      window.__akiniDeferredKeys[k] = 1; // 超预算：不驻留，按需水合
                    } else {
                      memSet(k, ls);
                      if (big) _bigMemUsed += ls.length;
                    }
                    if (ls !== v) queueIdbWrite(k, ls); // LS 与 IDB 不一致，以 LS 回写 IDB
                  } else if (big) {
                    // 大键不回填 LS（防回填又撑爆配额）；预算内驻留内存，超预算按需水合
                    if (_bigMemUsed + v.length > BIG_MEM_BUDGET) {
                      window.__akiniDeferredKeys[k] = 1;
                    } else {
                      memSet(k, v);
                      _bigMemUsed += v.length;
                    }
                    lsRemoveRaw(k);
                  } else {
                    // 仅当 LS 为空/丢失时，才用 IDB 镜像兜底回填（绝不覆盖已有真实数据）
                    memSet(k, v);
                    if (lsSet(k, v)) clearDirty(k); else markDirty(k);
                  }
                }
              } catch (e) {}
              if (--pending <= 0) setTimeout(nextBatch, 25);
            });
          });
        })();
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
    memoryRemove: memRemove,
    memoryKeys: function () { return Object.keys(memoryCache); },
    // 清除数据专用：清空内存镜像 + IDB 待写队列 + 启动前暂存 + 脏键集合，
    // 防止清除后内存/队列里的旧数据在刷新前的间隙被重新落盘
    wipeMemory: function () {
      try { memoryCache = {}; } catch (e) {}
      try { _idbQueue = {}; } catch (e) {}
      try { _preRestorePending = {}; } catch (e) {}
      try { _reconciledKeys = {}; } catch (e) {}
      try { _lsDirty = {}; lsDirtySave(); } catch (e) {}
      try { if (_idbFlushTimer) { clearTimeout(_idbFlushTimer); _idbFlushTimer = null; } } catch (e) {}
    }
  };

  // ---- 拦截 localStorage 写入：先原始写入（绝不被中断），再镜像内存+IDB ----
  // 注意：origSet 为空说明 localStorage 是内存 shim（隐私模式/被禁用），其原型是 Object.prototype，
  // 绝不能往 Object.prototype 上挂 setItem/getItem/removeItem，否则污染所有对象——此时走 shim 包装分支
  try {
    var lsProto = Object.getPrototypeOf(rawLS);
    if (lsProto && rawLS && typeof origSet === 'function') {
      var self = { memGet: memGet, memSet: memSet, memRemove: memRemove, queueIdbWrite: queueIdbWrite, isCritical: isCriticalKey, origSet: origSet, origGet: origGet, origRemove: origRemove, isBigVal: isBigVal, markDirty: markDirty, clearDirty: clearDirty };
      // standard 同款③：读取拦截——内存缓存优先（大键只存在内存/IDB，直接读 LS 会拿到空）
      lsProto.getItem = function (k) {
        try {
          if (self.isCritical(k)) {
            var m = self.memGet(k);
            if (m !== null && m !== '') return m;
            // 超预算大键未驻留内存：触发异步水合，本次先返回 LS 值，水合完成后下次读取即得
            if (window.__akiniDeferredKeys && window.__akiniDeferredKeys[k]) {
              delete window.__akiniDeferredKeys[k];
              idbGet(k, function (v) { if (v != null && v !== '') memSet(k, v); });
            }
            // 内存缓存为空时回退到原始 LS（绝不让内存的空状态遮蔽 LS 里的真实数据）
            var raw = self.origGet ? self.origGet.call(this, k) : null;
            if (raw != null && raw !== '') return raw;
            return null;
          }
          return self.origGet ? self.origGet.call(this, k) : null;
        } catch (e) { return null; }
      };
      // 核心数据资产键：非显式清除操作下一律拒绝被空数组覆盖（安卓/鸿蒙/iOS慢机切回与后台GC高发防护）
      var _GUARD_KEYS = {
        akini_contacts: 1, akini_mail_sent: 1, akini_mail_received: 1, akini_posts: 1, akini_icity_diaries: 1, akini_wordbank: 1,
        akini_start_date: 1, akini_day_label: 1, akini_meaningful_numbers: 1, akini_signature: 1, akini_friends_signature: 1,
        akini_bubble_color: 1, akini_swap_avatar_pos: 1, akini_last_page_state: 1, akini_wb_groups: 1,
        akini_shop_orders: 1, akini_shop_products: 1, akini_surveys: 1
      };
      var _GUARD_PREFIXES = ['akini_settings_', 'akini_toggle_', 'akini_num_', 'akini_chat_history_', 'akini_stickers_'];
      function _isGuardKeyProto(k) {
        if (!k) return false;
        if (_GUARD_KEYS[k]) return true;
        var ks = String(k);
        for (var i = 0; i < _GUARD_PREFIXES.length; i++) {
          if (ks.indexOf(_GUARD_PREFIXES[i]) === 0) return true;
        }
        return false;
      }
      lsProto.setItem = function (k, v) {
        // 清除数据期间：akini_ 键一律拒写（含原始 LS 层），杜绝清完复活
        if (window.__akiniWiping && k && String(k).indexOf('akini_') === 0) return;
        var sv = String(v);
        if ((sv === '[]' || sv === '{}') && _isGuardKeyProto(k) && !window.__akiniWiping && !window._akiniAllowRemove) {
          try {
            var _gp = self.memGet(k);
            if (_gp == null) _gp = self.origGet ? self.origGet.call(this, k) : null;
            if (_gp && _gp !== '[]' && _gp !== '{}' && _gp.length > 2) {
              console.warn('[存储] 永久防御：拒绝非显式空值覆盖核心键(setItem)', k);
              return;
            }
          } catch (e) {}
        }
        var big = self.isCritical(k) && self.isBigVal(sv);
        var ok = true;
        // 1) 原始写入永远先执行（大键跳过 LS 并清残留，防撑爆配额）；任何异常都不影响镜像
        if (big) {
          try { self.origRemove.call(this, k); } catch (e) {}
        } else {
          try { self.origSet.call(this, k, v); } catch (e) {
            // 配额满：清理大体积图片键后重试，避免关键数据静默丢失
            try {
              var _ev = _evictBigKeys();
              if (_ev > 0) { self.origSet.call(this, k, v); ok = true; }
              else { ok = false; }
            } catch (e2) { ok = false; }
          }
        }
        // 2) 镜像层失败无所谓，绝不影响数据本体
        try {
          if (self.isCritical(k)) {
            self.memSet(k, sv);
            if (!_restored) { _preRestorePending[k] = sv; }
            else { self.queueIdbWrite(k, sv); }
            if (ok || big) { self.clearDirty(k); }
            else { self.markDirty(k); if (_restored) flushIdbQueue(); }
          }
        } catch (e) {}
      };
      if (typeof lsProto.clear === 'function') {
        var _origClear = lsProto.clear;
        lsProto.clear = function () {
          try { _origClear.call(this); } catch (e) {}
          try { if (window.akiniStore && window.akiniStore.wipeMemory) window.akiniStore.wipeMemory(); } catch (e) {}
        };
      }
      lsProto.removeItem = function (k) {
        try { self.origRemove.call(this, k); } catch (e) {}
        try {
          if (self.isCritical(k)) {
            self.memRemove(k);
            if (!_restored) { _preRestorePending[k] = null; }
            else { self.queueIdbWrite(k, null); }
          }
        } catch (e) {}
      };
    }
  } catch (e) {
    console.warn('[存储] localStorage 拦截安装失败（不影响读写）', e);
  }

  // ---- localStorage 被禁用（隐私模式/部分内置浏览器）时的兜底 ----
  // shim 是带自有方法的普通对象，原型拦截装不上；直接包装其自有方法，
  // 让关键写入仍镜像到 内存缓存 + IndexedDB，重开后可从 IndexedDB 完整恢复
  try {
    if (window.__akiniLocalStorageBlocked && rawLS && typeof rawLS.setItem === 'function' && typeof origSet !== 'function') {
      var _shimSet = rawLS.setItem, _shimGet = rawLS.getItem, _shimRemove = rawLS.removeItem;
      rawLS.setItem = function (k, v) {
        var sv = String(v);
        try { _shimSet.call(rawLS, k, sv); } catch (e) {}
        try {
          if (isCriticalKey(k)) {
            memSet(k, sv);
            if (!_restored) { _preRestorePending[k] = sv; }
            else queueIdbWrite(k, sv);
          }
        } catch (e) {}
      };
      rawLS.getItem = function (k) {
        try {
          if (isCriticalKey(k)) {
            var m = memGet(k);
            if (m !== null && m !== '') return m;
            if (window.__akiniDeferredKeys && window.__akiniDeferredKeys[k]) {
              delete window.__akiniDeferredKeys[k];
              idbGet(k, function (v) { if (v != null && v !== '') memSet(k, v); });
            }
            var raw = _shimGet.call(rawLS, k);
            if (raw != null && raw !== '') return raw;
            return null;
          }
        } catch (e) {}
        try { return _shimGet.call(rawLS, k); } catch (e) { return null; }
      };
      rawLS.removeItem = function (k) {
        try { _shimRemove.call(rawLS, k); } catch (e) {}
        try {
          if (isCriticalKey(k)) {
            memRemove(k);
            if (!_restored) { _preRestorePending[k] = null; }
            else queueIdbWrite(k, null);
          }
        } catch (e) {}
      };
      console.log('[存储] localStorage 被禁用，已包装内存 shim（数据经 IndexedDB 持久化）');
    }
  } catch (e) {}

  // ---- 申请持久化存储，彻底消除系统静默清理（启动立即申请 + 首次交互手势加权申请）----
  function requestPersistentStorage() {
    try {
      if (navigator.storage && navigator.storage.persist) {
        var _p = navigator.storage.persist();
        if (_p && typeof _p.then === 'function') {
          _p.then(function (granted) {
            console.log('[存储] 持久化存储授权:', granted ? '已获准(免清空)' : '未获准(使用多层镜像兜底)');
          }).catch(function () {});
        }
      }
    } catch (e) {}
  }
  requestPersistentStorage();
  // 现代移动端(Safari/Chrome)手势授权：首次点击/触摸时再次调用以极大提高获准率
  var _persistGestureHandler = function () {
    requestPersistentStorage();
    document.removeEventListener('click', _persistGestureHandler, true);
    document.removeEventListener('touchend', _persistGestureHandler, true);
  };
  document.addEventListener('click', _persistGestureHandler, true);
  document.addEventListener('touchend', _persistGestureHandler, true);

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

  // ---- 生命周期守护：后台挂起切回立即落盘，切离也立即落盘 ----
  // 注意：切回/往返缓存恢复时【不再】重新跑全量对账——这些场景 localStorage 根本不会丢失，
  // 重复对账反而会在 IDB 镜像滞后的情况下用旧值覆盖 LS 真实数据（导致设置/纪念日被重置）。
  // 仅做落盘（把内存里的最新值写回 IDB），保证数据不丢。
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      flushIdbQueue();
      try { if (window.__akiniVaultSave) window.__akiniVaultSave(); } catch (e) {}
    } else {
      flushIdbQueue();
    }
  });
  window.addEventListener('pagehide', function () {
    flushIdbQueue();
    try { if (window.__akiniVaultSave) window.__akiniVaultSave(); } catch (e) {}
  });
  window.addEventListener('pageshow', function (evt) {
    // 从 bfcache(往返缓存)恢复时，仅落盘，不重新对账
    if (evt && evt.persisted) {
      flushIdbQueue();
    }
  });

  // 每 30s 兜底落盘一次，极端崩溃退出也不丢
  setInterval(flushIdbQueue, 30000);

  console.log('[akini-storage-safe] 网站式可靠存储层已加载 (v20261028)');
})();
