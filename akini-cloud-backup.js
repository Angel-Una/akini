/*
 * akini-cloud-backup.js  v20260915 云端自动备份/恢复（zzzs 修复版）
 * 本地三层存储（内存/localStorage/IndexedDB）之上的云端保险：
 * - 修复：旧项目后端已暂停（SupabaseNotReady）导致备份彻底失效 → 切换到当前活跃项目
 * - 增强：头像/封面/会话/联系人等关键 key 永不因体积被剔除
 * - 防空覆盖：本地数据异常骤减（被浏览器清理）时禁止上传空壳覆盖云端，改为先恢复
 * - 恢复提前到脚本加载即发起，网络失败自动重试，恢复完成后立即刷新界面（含头像）
 * - 每 150 秒检测变化自动备份；切后台/关闭页面前立即备份（keepalive）
 */
(function () {
  "use strict";
  if (window.__akiniCloudBackupReady) return;
  window.__akiniCloudBackupReady = true;

  var SUPA_URL = "https://backend.miaoda.online/projects/supabase356066302944653312";
  var SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoyMTA0MzIwMDIyLCJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwic3ViIjoiYW5vbiJ9.-sN1xREpzprJmdy1bxy9YnVRXjpHv-2WT7thmiit45c";
  var TABLE = "akini_cloud_backups";
  var MAX_PAYLOAD = 4.5 * 1024 * 1024; // 超出则剔除最大 value 的非关键 key
  var SKIP_RE = /^akini_(next_|last_)/; // 高频调度键不备份

  // 绝不因体积剔除的关键 key：会话索引/通讯录/头像/封面/名字/核心设置
  var PROTECT_EXACT = {
    akini_sessions: 1, akini_contacts: 1, akini_device_id: 1,
    akini_my_avatar: 1, akini_ta_avatar: 1,
    akini_icity_my_avatar: 1, akini_icity_ta_avatar: 1,
    akini_my_name: 1, akini_ta_name: 1, akini_home_bg: 1,
  };
  var PROTECT_PREFIX = ["akini_contact_avatar_"];
  function isProtectedKey(k) {
    if (PROTECT_EXACT[k]) return true;
    for (var i = 0; i < PROTECT_PREFIX.length; i++) {
      if (k.indexOf(PROTECT_PREFIX[i]) === 0) return true;
    }
    return false;
  }

  // ---- 设备 ID：本机唯一标识，多层冗余持久化（localStorage + cookie 十年），防止浏览器清理后无法关联云端备份 ----
  function getDeviceId() {
    var id = null;
    try { id = localStorage.getItem("akini_device_id"); } catch (e) {}
    if (!id) {
      // localStorage 被清理时从 cookie 找回，并回填 localStorage
      try {
        var m = (document.cookie || "").match(/(?:^|;\s*)akini_device_id=([^;]+)/);
        if (m && m[1]) id = decodeURIComponent(m[1]);
        if (id) { try { localStorage.setItem("akini_device_id", id); } catch (e) {} }
      } catch (e) {}
    }
    if (!id) {
      id = "dev_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
      try { localStorage.setItem("akini_device_id", id); } catch (e) {}
    }
    // 始终同步写 cookie（10 年）做第二重保障
    try { document.cookie = "akini_device_id=" + encodeURIComponent(id) + ";path=/;max-age=315360000;SameSite=Lax"; } catch (e) {}
    return id;
  }
  var DEVICE_ID = getDeviceId();

  // ---- 收集全部 akini_ 数据 ----
  function collectAll() {
    var data = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!k || k.indexOf("akini_") !== 0 || SKIP_RE.test(k)) continue;
        var v = localStorage.getItem(k);
        if (v != null) data[k] = v;
      }
    } catch (e) {}
    // 内存镜像补充：大键（>200KB 图片等）只存在内存/IDB，必须全量遍历内存键，否则会漏备
    try {
      if (window.akiniStore && window.akiniStore.memoryKeys && window.akiniStore.memoryGet) {
        window.akiniStore.memoryKeys().forEach(function (k) {
          if (!k || k.indexOf("akini_") !== 0 || SKIP_RE.test(k)) return;
          var mv = window.akiniStore.memoryGet(k);
          if (mv != null && mv !== "") data[k] = mv;
        });
      }
    } catch (e) {}
    return data;
  }

  // ---- 体积控制：超出上限时剔除最大 value 的非关键 key（关键 key 绝不剔除）----
  function shrink(data) {
    var s = JSON.stringify(data);
    if (s.length <= MAX_PAYLOAD) return s;
    var entries = Object.keys(data).map(function (k) {
      return { k: k, size: (data[k] || "").length };
    });
    entries.sort(function (a, b) { return b.size - a.size; });
    for (var i = 0; i < entries.length && s.length > MAX_PAYLOAD; i++) {
      var k = entries[i].k;
      if (isProtectedKey(k)) continue;
      console.warn("[云备份] 数据过大，跳过备份: " + k + " (" + Math.round(entries[i].size / 1024) + "KB)");
      delete data[k];
      s = JSON.stringify(data);
    }
    return s;
  }

  var _lastBackupSig = "";
  var _backupTimer = null;
  var _backingUp = false;
  var _restoreDone = false;  // 本轮启动已确认云端状态（成功或确认无数据）
  var _cloudKeyCount = 0;    // 云端 key 数量（用于检测本地数据骤减）

  function backup(immediate) {
    if (window.__akiniWiping) return; // 清除数据期间禁止上传，避免把中间态写回云端
    if (_backingUp && !immediate) return;
    if (document.hidden && !immediate) return; // 页面在后台时不跑周期备份（切后台瞬间已有 immediate 备份兜底）
    if (_backupTimer) { clearTimeout(_backupTimer); _backupTimer = null; }
    var run = function () {
      try {
        var data = collectAll();
        var keys = Object.keys(data);
        if (!keys.length) return;
        // 防空覆盖 1：云端状态尚未确认且本地数据异常少（疑似刚被清理）→ 跳过，等待恢复流程
        if (!_restoreDone && keys.length < 8) {
          console.warn("[云备份] 云端状态未确认且本地数据过少，跳过本次备份");
          return;
        }
        // 防空覆盖 2：云端数据量明显多于本地（本地被浏览器清理过）→ 禁止上传空壳，改为触发恢复
        if (_cloudKeyCount >= 8 && keys.length < Math.max(8, Math.floor(_cloudKeyCount * 0.5))) {
          console.warn("[云备份] 检测到本地数据骤减（" + keys.length + "/" + _cloudKeyCount + "），跳过备份并触发恢复");
          restore();
          return;
        }
        var sig = keys.length + ":" + keys.reduce(function (a, k) { return a + (data[k] || "").length; }, 0);
        if (!immediate && sig === _lastBackupSig) return; // 无变化不传
        var payload = shrink(data);
        _backingUp = true;
        var bodyStr = JSON.stringify({ device_id: DEVICE_ID, payload: payload, updated_at: new Date().toISOString() });
        /* zzzy：keepalive 请求体上限约 64KB，超限的即时备份改用普通 fetch（尽力送达），避免每次都静默失败 */
        var useKeepalive = !!immediate && bodyStr.length < 60000;
        fetch(SUPA_URL + "/rest/v1/" + TABLE, {
          method: "POST",
          headers: {
            apikey: SUPA_KEY,
            Authorization: "Bearer " + SUPA_KEY,
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates",
          },
          body: bodyStr,
          keepalive: useKeepalive,
        }).then(function (r) {
          _backingUp = false;
          if (r.ok) {
            _lastBackupSig = sig;
            _cloudKeyCount = Math.max(_cloudKeyCount, keys.length);
            try { localStorage.setItem("akini_cloud_backup_at", String(Date.now())); } catch (e) {}
            backupBlobs(); // zzzx：顺带备份小说正文等大体积 IDB 内容
          } else {
            console.warn("[云备份] 备份失败 HTTP " + r.status);
          }
        }).catch(function () { _backingUp = false; });
      } catch (e) { _backingUp = false; }
    };
    // 卡崩修复：即时备份（切后台/关闭页面前）不再同步执行 collectAll+stringify 大负载，
    // 改为微任务延迟到下一轮事件循环，避免与 _akiniImmediateBackup / localStorage 拦截的 pagehide
    // 备份在同一时刻叠加触发，造成低端机 OOM 闪退
    if (immediate) setTimeout(run, 0);
    else _backupTimer = setTimeout(run, 3000);
  }

  /* ==================== zzzx 大体积内容云端保险 ====================
   * 小说正文等存在 IndexedDB 的大文本不在主 payload（4.5MB 上限）内，
   * iOS/Safari 清理 IndexedDB 后会永久丢失 → 逐键独立行备份到 akini_cloud_blobs 表。
   * 只补本地缺失、绝不覆盖；单条 >3MB 跳过。
   */
  var BLOB_TABLE = "akini_cloud_blobs";
  var BLOB_RE = /^akini_novel_content_/;
  var BLOB_MAX = 3 * 1024 * 1024;
  var _blobCache = {}; // key -> 本地内容长度（变化才上传，避免重复流量）

  function backupBlobs() {
    try {
      if (window.__akiniWiping) return;
      if (!window._idbStore || !window._idbStore.keys || !window._idbStore.get) return;
      window._idbStore.keys(function (ks) {
        if (!ks || !ks.length) return;
        var targets = [];
        for (var i = 0; i < ks.length; i++) {
          if (BLOB_RE.test(ks[i])) targets.push(ks[i]);
        }
        if (!targets.length) return;
        var idx = 0;
        (function next() {
          if (idx >= targets.length) return;
          var k = targets[idx++];
          window._idbStore.get(k, function (v) {
            try {
              if (typeof v === "string" && v.length > 0 && v.length <= BLOB_MAX && _blobCache[k] !== v.length) {
                _blobCache[k] = v.length;
                fetch(SUPA_URL + "/rest/v1/" + BLOB_TABLE, {
                  method: "POST",
                  headers: {
                    apikey: SUPA_KEY,
                    Authorization: "Bearer " + SUPA_KEY,
                    "Content-Type": "application/json",
                    Prefer: "resolution=merge-duplicates,return=minimal",
                  },
                  body: JSON.stringify({ device_id: DEVICE_ID, key: k, value: v, updated_at: new Date().toISOString() }),
                }).catch(function () { delete _blobCache[k]; }); // 失败下次重传
              }
            } catch (e) {}
            setTimeout(next, 300); // 逐本间隔上传，避免突发
          });
        })();
      });
    } catch (e) {}
  }

  function restoreBlobs() {
    try {
      if (!window._idbStore || !window._idbStore.get || !window._idbStore.set) return;
      fetch(SUPA_URL + "/rest/v1/" + BLOB_TABLE + "?device_id=eq." + encodeURIComponent(DEVICE_ID) + "&select=key,value", {
        headers: { apikey: SUPA_KEY, Authorization: "Bearer " + SUPA_KEY },
      }).then(function (r) { return r.ok ? r.json() : []; })
        .then(function (rows) {
          if (!rows || !rows.length) return;
          var idx = 0, restored = 0;
          (function next() {
            if (idx >= rows.length) {
              if (restored > 0) console.warn("[云备份] 已从云端恢复 " + restored + " 项小说内容");
              return;
            }
            var row = rows[idx++];
            if (!row || !row.key || typeof row.value !== "string" || !row.value) { next(); return; }
            // 只补本地缺失的内容，绝不覆盖本地已有
            window._idbStore.get(row.key, function (local) {
              if (local === null || local === undefined || local === "") {
                window._idbStore.set(row.key, row.value, function () { restored++; setTimeout(next, 100); });
              } else {
                _blobCache[row.key] = (typeof local === "string") ? local.length : 0;
                setTimeout(next, 30);
              }
            });
          })();
        })
        .catch(function () {});
    } catch (e) {}
  }

  // ---- 启动恢复：只补本地缺失的 key，绝不覆盖本地已有数据 ----
  function restore() {
    try {
      // 清除数据后的首次启动（?reset= 时间戳）：用户要求全部归0，绝不从云端复活
      if (/[?&]reset=/.test(location.search || "")) {
        console.warn("[云备份] 检测到清除数据后的启动，跳过恢复");
        _restoreDone = true;
        return;
      }
      fetch(SUPA_URL + "/rest/v1/" + TABLE + "?device_id=eq." + encodeURIComponent(DEVICE_ID) + "&select=payload,updated_at", {
        headers: { apikey: SUPA_KEY, Authorization: "Bearer " + SUPA_KEY },
      }).then(function (r) {
        if (!r.ok) { _restoreDone = true; backup(); return; } // 无记录/失败：先做一次初始备份
        return r.json();
      }).then(function (rows) {
        if (!rows) return;
        _restoreDone = true;
        restoreBlobs(); // zzzx：云端状态确认后，补回本地缺失的小说正文等大内容
        if (!rows.length || !rows[0].payload) { backup(); return; }
        var cloud = null;
        try { cloud = JSON.parse(rows[0].payload); } catch (e) { return; }
        if (!cloud || typeof cloud !== "object") return;
        var cloudKeys = Object.keys(cloud);
        _cloudKeyCount = cloudKeys.length;
        var missing = [];
        cloudKeys.forEach(function (k) {
          var local = null;
          try { local = localStorage.getItem(k); } catch (e) {}
          var mem = null;
          try { if (window.akiniStore && window.akiniStore.memoryGet) mem = window.akiniStore.memoryGet(k); } catch (e) {}
          if ((local == null || local === "") && (mem == null || mem === "") && cloud[k]) {
            missing.push(k);
          }
        });
        if (!missing.length) return; // 本地完整，无需恢复
        // 回填缺失 key：localStorage + 内存 + IDB 三层同时写入
        missing.forEach(function (k) {
          try { localStorage.setItem(k, cloud[k]); } catch (e) {}
          try { if (window.akiniStore && window.akiniStore.memorySet) window.akiniStore.memorySet(k, cloud[k]); } catch (e) {}
          try { if (window._idbStore && window._idbStore.set) { window._idbStore.set(k, cloud[k]); window._idbStore.set(k + "_backup", cloud[k]); } } catch (e) {}
        });
        console.warn("[云备份] 已从云端恢复 " + missing.length + " 项缺失数据");
        // 恢复完成后立即刷新界面（联系人/聊天/头像/预览），让恢复的数据即刻生效
        try { if (window.__akiniOnCriticalRestored) window.__akiniOnCriticalRestored(); } catch (e) {}
        // 缺失较多说明本地被清理过：回填后刷新一次让界面用上恢复的数据（防循环）
        if (missing.length >= 3) {
          try {
            var lock = +(localStorage.getItem("akini_cloud_restore_lock") || 0);
            if (Date.now() - lock > 3 * 60 * 1000) {
              // 用户已进入应用则不再自动刷新（恢复的数据已在内存，界面下次启动自然生效）
              if (window.__akiniSplashDone) { console.warn("[云备份] 已进入应用，跳过恢复后刷新"); return; }
              localStorage.setItem("akini_cloud_restore_lock", String(Date.now()));
              location.reload();
            }
          } catch (e) {}
        }
      }).catch(function () {
        // 网络失败：不标记完成（防止空数据覆盖云端），10 秒后自动重试
        setTimeout(restore, 10000);
      });
    } catch (e) {}
  }

  // ---- 钩子 ----
  // v604: 切后台/关闭页面绝不执行 collectAll+JSON.stringify(可达数MB) ——
  // 后台冻结窗口内跑长任务会被系统强杀（=切后台闪退的根因），对齐 milk/syy：后台零工作。
  // 数据安全：akiniStore 每次写操作已即时落盘本地 IndexedDB（不丢），回前台后延迟补跑云备份即可。
  var _pendingHideBackup = false;
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      _pendingHideBackup = true; // 仅做标记，回前台补跑
    } else if (_pendingHideBackup) {
      _pendingHideBackup = false;
      setTimeout(function () { backup(false); }, 2000); // 回前台 2s 后补跑，避开 UI 恢复高峰
    }
  });
  // pagehide / beforeunload 不再触发备份：冻结窗口内的重序列化正是被杀原因；
  // 本地 IDB 已即时持久化，下次打开页面后 150s 周期内自动补上云端。
  // 每 150 秒周期检测（有变化才上传；切后台/关闭页面前仍有即时备份）
  // zzzy：60s 全量 collectAll+stringify 是主线程卡顿/掉帧大户，恢复 150s；后台时 backup(false) 内部已跳过
  setInterval(function () { backup(false); }, 150000);
  // 启动：立即发起恢复（不再延迟，尽早兜底），30 秒后开始周期备份
  restore();
  setTimeout(function () { backup(false); }, 30000);

  // ---- 清除云端备份：清除数据时调用，保证云端同样归0 ----
  function wipeCloud() {
    try {
      // zzzx：同步清空大体积内容表
      try {
        fetch(SUPA_URL + "/rest/v1/" + BLOB_TABLE + "?device_id=eq." + encodeURIComponent(DEVICE_ID), {
          method: "DELETE",
          headers: { apikey: SUPA_KEY, Authorization: "Bearer " + SUPA_KEY },
          keepalive: true,
        }).catch(function () {});
      } catch (e0) {}
      return fetch(SUPA_URL + "/rest/v1/" + TABLE + "?device_id=eq." + encodeURIComponent(DEVICE_ID), {
        method: "DELETE",
        headers: { apikey: SUPA_KEY, Authorization: "Bearer " + SUPA_KEY },
        keepalive: true,
      }).then(function (r) {
        if (r.ok) {
          _lastBackupSig = "";
          _cloudKeyCount = 0;
          try { localStorage.removeItem("akini_cloud_backup_at"); } catch (e) {}
        }
        return r.ok;
      }).catch(function () { return false; });
    } catch (e) { return Promise.resolve(false); }
  }

  window.__akiniCloudBackup = { backup: backup, restore: restore, wipeCloud: wipeCloud, deviceId: DEVICE_ID };
  console.log("[云备份] 已启用，设备 " + DEVICE_ID);
})();
