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
      try { localStorage.clear(); } catch (e) {}
      try { sessionStorage.clear(); } catch (e) {}
      try { window._idbStore && window._idbStore.clearAll && window._idbStore.clearAll(); } catch (e) {}
      try { indexedDB.deleteDatabase("akini_img_db"); } catch (e) {}
      try { indexedDB.deleteDatabase("AkiniApp"); } catch (e) {}
      try {
        if (window.caches && caches.keys) caches.keys().then(function (ks) { ks.forEach(function (k) { caches.delete(k); }); });
      } catch (e) {}
      setTimeout(function () { location.reload(); }, 400);
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
