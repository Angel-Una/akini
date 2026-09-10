/**
 * Akini 储存数据页（数据管理）
 * 入口：设置页「储存数据」行 → 全屏页面
 * 功能：导出备份 / 导入备份 / 清除数据
 */
(function () {
  "use strict";

  var AREA_ID = "storageArea";

  function renderStorage() {
    var body = document.getElementById("akStorBody");
    if (!body) return;

    body.innerHTML =
      '<div class="settings-card"><div class="card-title">备份与恢复</div>' +
        '<div class="ak-hint" style="margin-top:0">数据每次变更已自动备份到浏览器本地库；换设备/清理浏览器前请先导出备份文件</div>' +
        '<div class="ak-btn-col">' +
          '<button class="ak-stor-btn primary" id="akStorExport" type="button">导出备份</button>' +
          '<button class="ak-stor-btn" id="akStorImport" type="button">导入备份</button>' +
          '<input type="file" id="akStorImportFile" accept=".zip,.json" style="display:none">' +
        "</div>" +
      "</div>" +

      '<div class="settings-card"><div class="card-title">清除数据</div>' +
        '<div class="ak-hint" style="margin-top:0">清空后聊天记录、联系人、朋友圈、iCity、贴纸、设置全部删除（含浏览器本地库），不可恢复</div>' +
        '<div class="ak-btn-col">' +
          '<button class="ak-stor-btn danger" id="akStorWipe" type="button">清除全部数据</button>' +
        "</div>" +
      "</div>";

    bindActions();
  }

  function bindActions() {
    var $ = function (id) { return document.getElementById(id); };
    var note = function (msg) {
      try {
        if (window.__akiniCenterModal) window.__akiniCenterModal("储存数据", msg);
        else alert(msg);
      } catch (e) { alert(msg); }
    };

    var expBtn = $("akStorExport");
    if (expBtn) expBtn.onclick = function () {
      try {
        if (window.akExportBackup) window.akExportBackup();
        else note("备份模块加载中，请稍后再试");
      } catch (e) { note("导出失败：" + e.message); }
    };

    var impBtn = $("akStorImport");
    var impFile = $("akStorImportFile");
    if (impBtn && impFile) {
      impBtn.onclick = function () { impFile.click(); };
      impFile.onchange = function (ev) {
        var file = ev.target.files && ev.target.files[0];
        if (file && window.akImportBackup) window.akImportBackup(file);
        ev.target.value = "";
      };
    }

    var wipeBtn = $("akStorWipe");
    if (wipeBtn) wipeBtn.onclick = function () {
      if (!confirm("确定要清空全部数据吗？\n聊天记录、联系人、朋友圈、iCity、贴纸、设置都会被删除，且无法恢复！")) return;
      if (!confirm("最后确认：真的要全部删除吗？建议先点「导出备份」留底。")) return;
      wipeBtn.disabled = true;
      wipeBtn.textContent = "正在清除…";
      // 全局清除标记：阻断一切 localStorage 写回与 IDB 备份，防止清除后数据复活
      try { window.__akiniWiping = true; } catch (e) {}
      // 保险丝 cookie：即使本次刷新前 IDB 没清完，下次启动会再清一轮
      try { document.cookie = "akini_wipe_pending=1;path=/;max-age=600"; } catch (e) {}
      var reloaded = false;
      var doReload = function () {
        if (reloaded) return;
        reloaded = true;
        // milk 式：换 URL 整页加载（?reset= 时间戳），bfcache 对 URL 变化不适用，旧页面无法从内存复活
        try { location.href = location.pathname + "?reset=" + Date.now(); }
        catch (e) { try { location.reload(true); } catch (e2) { location.reload(); } }
      };
      var clearLocal = function () {
        try { localStorage.clear(); } catch (e) {}
        try { sessionStorage.clear(); } catch (e) {}
      };
      var finish = function () {
        // 所有 IDB 已删，最后清 localStorage 并立即刷新（顺序不能反，否则快照机制会在间隙写回）
        clearLocal();
        // milk 式全量归0：清空所有可访问 cookie（含残留的标记/会话 cookie）
        try {
          document.cookie.split(";").forEach(function (c) {
            var n = String(c).split("=")[0].trim();
            if (n) document.cookie = n + "=;path=/;max-age=0";
          });
        } catch (e) {}
        // 注销 Service Worker + 清 Cache Storage，避免旧缓存恢复页面
        try {
          if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
            navigator.serviceWorker.getRegistrations().then(function (rs) {
              rs.forEach(function (r) { try { r.unregister(); } catch (e) {} });
            });
          }
        } catch (e) {}
        try {
          if (window.caches && caches.keys) caches.keys().then(function (ks) { ks.forEach(function (k) { try { caches.delete(k); } catch (e) {} }); });
        } catch (e) {}
        try { document.cookie = "akini_wipe_pending=;path=/;max-age=0"; } catch (e) {}
        setTimeout(doReload, 400);
      };
      var deleteAllIdb = function () {
        // milk 式：主库已被 _idbStore.clearAll()（= localforage.clear()，同连接清空）处理
        // 全量归0：枚举删除所有 IDB 库；主库虽有活动连接导致删除被 blocked，但数据已被 clearAll 归零，
        // 删除请求随页面卸载消亡，配合保险丝 cookie 下次启动再清一轮，保证无任何残留
        try {
          if (indexedDB.databases) {
            indexedDB.databases().then(function (dbs) {
              (dbs || []).forEach(function (d) {
                if (d && d.name) { try { indexedDB.deleteDatabase(d.name); } catch (e) {} }
              });
            }).catch(function () {});
          }
        } catch (e) {}
        try { indexedDB.deleteDatabase("akini_img_db"); } catch (e) {}
        finish();
      };
      // 等待主库真正清空后再删库，最后刷新
      try {
        if (window._idbStore && window._idbStore.clearAll) window._idbStore.clearAll(function () { deleteAllIdb(); });
        else deleteAllIdb();
      } catch (e) { deleteAllIdb(); }
      // 终极兜底：6 秒仍未完成则再补一轮清空后强制刷新
      setTimeout(function () {
        try { if (window._idbStore && window._idbStore.clearAll) window._idbStore.clearAll(function () {}); } catch (e) {}
        try { clearLocal(); } catch (e) {}
        setTimeout(doReload, 300);
      }, 6000);
    };
  }

  function buildArea() {
    if (document.getElementById(AREA_ID)) return;
    var anchor = document.getElementById("settingsArea");
    var d = document.createElement("div");
    d.id = AREA_ID;
    d.className = "settings-area ak-storage-area";
    d.style.display = "none";
    d.innerHTML =
      '<div class="settings-header">' +
        '<button class="back-btn" id="storageBackBtn" type="button" ' +
        'onclick="window.hideAll&&window.hideAll();window.showArea&&window.showArea(\'settingsArea\');return false;">‹</button>' +
        '<div class="title">储存数据</div>' +
      "</div>" +
      '<div class="settings-body" id="akStorBody"></div>';
    (anchor && anchor.parentNode ? anchor.parentNode : document.body).appendChild(d);
  }

  window.__openStorageMgr = function () {
    try {
      buildArea();
      if (window.hideAll) window.hideAll();
      if (window.showArea) window.showArea(AREA_ID);
      else { var e = document.getElementById(AREA_ID); if (e) e.style.display = "flex"; }
      renderStorage();
    } catch (err) {
      console.error("[StorageMgr] open error", err);
    }
  };
})();
