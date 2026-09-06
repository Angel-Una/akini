/*
 * akini-cloud-backup.js  云端自动备份/恢复
 * 本地三层存储（内存/localStorage/IndexedDB）之上再加一道云保险：
 * - 每 90 秒检测数据变化并自动备份到 Supabase
 * - 切后台/关闭页面前立即备份（keepalive）
 * - 启动时若本地缺失数据（被浏览器清理等），从云端按 key 补缺恢复
 *   （只补本地没有的 key，绝不覆盖本地已有数据）
 */
(function () {
  "use strict";
  if (window.__akiniCloudBackupReady) return;
  window.__akiniCloudBackupReady = true;

  var SUPA_URL = "https://backend.appmiaoda.com/projects/supabase350621681116557312";
  var SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoyMTAzMDIxOTIzLCJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwic3ViIjoiYW5vbiJ9.e2IDMd4wU_ZRexRXJYACzBfTtr_DNqE-jIidvoT0RKY";
  var TABLE = "akini_cloud_backups";
  var MAX_PAYLOAD = 4.5 * 1024 * 1024; // 超出则剔除最大 value 的 key
  var SKIP_RE = /^akini_(next_|last_)/; // 高频调度键不备份

  // ---- 设备 ID：本机唯一标识，持久化 ----
  function getDeviceId() {
    var id = null;
    try { id = localStorage.getItem("akini_device_id"); } catch (e) {}
    if (!id) {
      id = "dev_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
      try { localStorage.setItem("akini_device_id", id); } catch (e) {}
    }
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
    // 内存镜像补充（localStorage 写满时数据可能只在内存里）
    try {
      if (window.akiniStore && window.akiniStore.memoryGet) {
        Object.keys(data).forEach(function (k) {
          var mv = window.akiniStore.memoryGet(k);
          if (mv != null && mv !== "") data[k] = mv;
        });
      }
    } catch (e) {}
    return data;
  }

  // ---- 体积控制：超出上限时剔除最大 value 的非关键 key ----
  function shrink(data) {
    var s = JSON.stringify(data);
    if (s.length <= MAX_PAYLOAD) return s;
    var entries = Object.keys(data).map(function (k) {
      return { k: k, size: (data[k] || "").length };
    });
    entries.sort(function (a, b) { return b.size - a.size; });
    for (var i = 0; i < entries.length && s.length > MAX_PAYLOAD; i++) {
      var k = entries[i].k;
      // 会话索引、通讯录、设置等核心小 key 绝不剔除
      if (k === "akini_sessions" || k === "akini_contacts" || k === "akini_device_id") continue;
      console.warn("[云备份] 数据过大，跳过备份: " + k + " (" + Math.round(entries[i].size / 1024) + "KB)");
      delete data[k];
      s = JSON.stringify(data);
    }
    return s;
  }

  var _lastBackupSig = "";
  var _backupTimer = null;
  var _backingUp = false;

  function backup(immediate) {
    if (_backingUp && !immediate) return;
    if (_backupTimer) { clearTimeout(_backupTimer); _backupTimer = null; }
    var run = function () {
      try {
        var data = collectAll();
        var keys = Object.keys(data);
        if (!keys.length) return;
        var sig = keys.length + ":" + keys.reduce(function (a, k) { return a + (data[k] || "").length; }, 0);
        if (!immediate && sig === _lastBackupSig) return; // 无变化不传
        var payload = shrink(data);
        _backingUp = true;
        fetch(SUPA_URL + "/rest/v1/" + TABLE, {
          method: "POST",
          headers: {
            apikey: SUPA_KEY,
            Authorization: "Bearer " + SUPA_KEY,
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates",
          },
          body: JSON.stringify({ device_id: DEVICE_ID, payload: payload, updated_at: new Date().toISOString() }),
          keepalive: !!immediate,
        }).then(function (r) {
          _backingUp = false;
          if (r.ok) {
            _lastBackupSig = sig;
            try { localStorage.setItem("akini_cloud_backup_at", String(Date.now())); } catch (e) {}
          } else {
            console.warn("[云备份] 备份失败 HTTP " + r.status);
          }
        }).catch(function () { _backingUp = false; });
      } catch (e) { _backingUp = false; }
    };
    if (immediate) run();
    else _backupTimer = setTimeout(run, 3000);
  }

  // ---- 启动恢复：只补本地缺失的 key，绝不覆盖本地已有数据 ----
  function restore() {
    try {
      fetch(SUPA_URL + "/rest/v1/" + TABLE + "?device_id=eq." + encodeURIComponent(DEVICE_ID) + "&select=payload,updated_at", {
        headers: { apikey: SUPA_KEY, Authorization: "Bearer " + SUPA_KEY },
      }).then(function (r) {
        if (!r.ok) { backup(); return; } // 无记录/失败：先做一次初始备份
        return r.json();
      }).then(function (rows) {
        if (!rows) return;
        if (!rows.length || !rows[0].payload) { backup(); return; }
        var cloud = null;
        try { cloud = JSON.parse(rows[0].payload); } catch (e) { return; }
        if (!cloud || typeof cloud !== "object") return;
        var cloudKeys = Object.keys(cloud);
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
        // 回填缺失 key：localStorage + 内存 + IDB
        missing.forEach(function (k) {
          try { localStorage.setItem(k, cloud[k]); } catch (e) {}
          try { if (window.akiniStore && window.akiniStore.memorySet) window.akiniStore.memorySet(k, cloud[k]); } catch (e) {}
          try { if (window._idbStore && window._idbStore.set) { window._idbStore.set(k, cloud[k]); window._idbStore.set(k + "_backup", cloud[k]); } } catch (e) {}
        });
        console.warn("[云备份] 已从云端恢复 " + missing.length + " 项缺失数据");
        // 缺失较多说明本地被清理过：回填后刷新一次让界面用上恢复的数据（防循环）
        if (missing.length >= 3) {
          try {
            if (!sessionStorage.getItem("akini_cloud_restored")) {
              sessionStorage.setItem("akini_cloud_restored", "1");
              location.reload();
            }
          } catch (e) {}
        }
      }).catch(function () {});
    } catch (e) {}
  }

  // ---- 钩子 ----
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) backup(true);
  });
  window.addEventListener("pagehide", function () { backup(true); });
  window.addEventListener("beforeunload", function () { backup(true); });
  // 每 90 秒周期检测（有变化才上传）
  setInterval(function () { backup(false); }, 90000);
  // 启动：先恢复（补缺），30 秒后开始周期备份
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { setTimeout(restore, 1500); });
  } else {
    setTimeout(restore, 1500);
  }
  setTimeout(function () { backup(false); }, 30000);

  window.__akiniCloudBackup = { backup: backup, restore: restore, deviceId: DEVICE_ID };
  console.log("[云备份] 已启用，设备 " + DEVICE_ID);
})();
