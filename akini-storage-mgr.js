/**
 * Akini 储存数据页（milk 风格数据管理）
 * 入口：设置页「储存数据」行 → 全屏页面
 * 功能：存储用量总览 / 自动任务调度状态 / 发帖调度记录 / 数据明细 / 备份与恢复 / 清理
 */
(function () {
  "use strict";

  var AREA_ID = "storageArea";
  var QUOTA_BYTES = 5 * 1024 * 1024; // localStorage 典型配额 ~5MB

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function fmtBytes(b) {
    if (b < 1024) return b + " B";
    if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
    return (b / 1048576).toFixed(2) + " MB";
  }
  function fmtTime(ts) {
    if (!ts) return "无记录";
    var d = new Date(ts);
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return (d.getMonth() + 1) + "/" + d.getDate() + " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }
  function fmtRemain(ts) {
    if (!ts) return "未排期";
    var diff = ts - Date.now();
    if (diff <= 0) return "已到期待执行";
    var m = Math.round(diff / 60000);
    if (m < 1) return "1 分钟内";
    if (m < 60) return m + " 分钟后";
    return Math.round(m / 60 * 10) / 10 + " 小时后";
  }

  /* 键分类：聊天 / 朋友圈 / icity / 媒体 / 其他设置 */
  function classify(k, v) {
    var kl = k.toLowerCase();
    if (k.indexOf("akini_chat_history_") === 0 || /messageshtml|chat_history|session/.test(kl)) return "chat";
    if (/icity/.test(kl)) return "icity";
    if (/friends|moment|_posts/.test(kl)) return "friends";
    if (typeof v === "string" && /^data:(image|video|audio)\//i.test(v)) return "media";
    if (/avatar|image|img|photo|wallpaper|bg_/.test(kl)) return "media";
    return "other";
  }
  var CAT_META = {
    chat: { label: "聊天记录", color: "#07c160" },
    friends: { label: "朋友圈", color: "#4a90e2" },
    icity: { label: "iCity", color: "#9c6fd4" },
    media: { label: "图片媒体", color: "#3bc8a4" },
    other: { label: "设置与其他", color: "#999" },
  };

  function collectStats() {
    var st = { total: 0, chat: 0, friends: 0, icity: 0, media: 0, other: 0, keys: [] };
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i) || "";
        if (!k) continue;
        var v = "";
        try { v = localStorage.getItem(k) || ""; } catch (e) {}
        var bytes = (k.length + v.length) * 2;
        st.total += bytes;
        var cat = classify(k, v);
        st[cat] += bytes;
        st.keys.push({ k: k, bytes: bytes, cat: cat });
      }
      st.keys.sort(function (a, b) { return b.bytes - a.bytes; });
    } catch (e) {}
    return st;
  }

  /* 自动任务调度状态：直接读 timer 持久化键 */
  var TASKS = [
    { name: "friendsPost", label: "朋友圈发布", lastKey: "akini_last_friendsPost_run" },
    { name: "icityPost", label: "iCity日记", lastKey: "akini_last_icityPost_run" },
    { name: "mail", label: "主动写信", lastKey: "akini_last_activeMail_run" },
  ];
  function taskRowsHTML() {
    var html = "";
    TASKS.forEach(function (t) {
      var next = parseFloat(localStorage.getItem("akini_next_" + t.name) || "0") || 0;
      var last = parseFloat(localStorage.getItem(t.lastKey) || "0") || 0;
      html +=
        '<div class="ak-task-row">' +
        '<div class="ak-task-name">' + esc(t.label) + "</div>" +
        '<div class="ak-task-info">上次 ' + esc(fmtTime(last)) + "<br>下次 " + esc(fmtRemain(next)) +
        '<span class="ak-task-time">' + (next ? esc(fmtTime(next)) : "") + "</span></div>" +
        "</div>";
    });
    return html;
  }

  function postLogHTML() {
    var arr = [];
    try { arr = JSON.parse(localStorage.getItem("akini_post_log") || "[]"); } catch (e) {}
    if (!arr.length) return '<div class="ak-empty">暂无记录（新版发布后每次朋友圈/iCity 调度都会记录在此）</div>';
    var html = "";
    arr.slice(0, 15).forEach(function (it) {
      var badge = it.app === "friends" ? "朋友圈" : it.app === "icity" ? "iCity" : esc(it.app);
      var cls = it.app === "friends" ? "ak-badge-blue" : it.app === "icity" ? "ak-badge-purple" : "ak-badge-gray";
      html +=
        '<div class="ak-log-row"><span class="ak-badge ' + cls + '">' + badge + "</span>" +
        '<span class="ak-log-msg">' + esc(it.msg) + "</span>" +
        '<span class="ak-log-time">' + esc(fmtTime(it.t)) + "</span></div>";
    });
    return html;
  }

  function keyRowsHTML(keys) {
    if (!keys.length) return '<div class="ak-empty">无数据</div>';
    var html = "";
    keys.slice(0, 5).forEach(function (it) {
      var meta = CAT_META[it.cat] || CAT_META.other;
      html +=
        '<div class="ak-key-row">' +
        '<span class="ak-key-dot" style="background:' + meta.color + '"></span>' +
        '<span class="ak-key-name" title="' + esc(it.k) + '">' + esc(it.k) + "</span>" +
        '<span class="ak-key-size">' + fmtBytes(it.bytes) + "</span></div>";
    });
    if (keys.length > 5) {
      html += '<div class="ak-empty">… 共 ' + keys.length + " 个键，仅显示前 5</div>";
    }
    return html;
  }

  function renderStorage() {
    var body = document.getElementById("akStorBody");
    if (!body) return;
    var st = collectStats();
    var pct = Math.min(100, (st.total / QUOTA_BYTES) * 100);
    var barColor = pct > 80 ? "#ff3b30" : pct > 50 ? "#ff9f0a" : "#07c160";
    var warn = pct > 80
      ? '<div class="ak-warn">存储空间已超 80%！建议导出备份后清理，否则最旧的聊天消息可能被自动修剪</div>'
      : "";

    body.innerHTML =
      '<div class="settings-card ak-stor-hero">' +
        '<div class="ak-stor-total-row"><span class="ak-stor-total-label">存储总用量</span>' +
        '<span class="ak-stor-total-val">' + fmtBytes(st.total) + " / ~5 MB</span></div>" +
        '<div class="ak-stor-track"><div class="ak-stor-fill" style="width:' + pct.toFixed(1) + "%;background:" + barColor + '"></div></div>' +
        warn +
        '<div class="ak-stor-grid">' +
          ["chat", "friends", "icity", "media", "other"].map(function (c) {
            var meta = CAT_META[c];
            return '<div class="ak-stor-cell"><div class="ak-stor-cell-val" style="color:' + meta.color + '">' +
              fmtBytes(st[c]) + '</div><div class="ak-stor-cell-key">' + meta.label + "</div></div>";
          }).join("") +
        "</div>" +
        '<div class="ak-hint" style="margin-top:8px">含图片/贴纸的消息以高清原图存储，比纯文字（仅几B）大很多属正常；可用下方「危险区」一键清空重开</div>' +
      "</div>" +

      '<div class="settings-card"><div class="card-title">自动任务调度状态</div>' +
        taskRowsHTML() +
        '<div class="ak-hint">若「下次」时间异常偏远，新版本会自动按设置间隔重排</div>' +
      "</div>" +

      '<div class="settings-card"><div class="card-title">备份与恢复</div>' +
        '<div class="ak-hint">数据每次变更已自动备份到浏览器本地库；换设备/清理浏览器前请先导出备份文件</div>' +
        '<div class="ak-btn-col">' +
          '<button class="ak-stor-btn primary" id="akStorExport" type="button">导出全部备份</button>' +
          '<button class="ak-stor-btn" id="akStorImport" type="button">从备份文件恢复</button>' +
          '<input type="file" id="akStorImportFile" accept=".zip,.json" style="display:none">' +
        "</div>" +
      "</div>" +

      '<div class="settings-card"><div class="card-title">危险区</div>' +
        '<div class="ak-hint">清空后聊天记录、联系人、朋友圈、iCity、贴纸、设置全部删除（含浏览器本地库），不可恢复</div>' +
        '<div class="ak-btn-col">' +
          '<button class="ak-stor-btn" id="akStorWipe" type="button" style="color:#fa5151;border-color:#fa5151">清空全部数据</button>' +
        "</div>" +
      "</div>";

    bindActions();
  }

  function bindActions() {
    // 备份与恢复
    var expBtn = $("akStorExport");
    if (expBtn) expBtn.onclick = function () {
      if (window.akExportBackup) { window.akExportBackup(); }
      else { alert("备份模块加载中，请稍后再试"); }
    };
    var impBtn = $("akStorImport");
    var impFile = $("akStorImportFile");
    if (impBtn && impFile) {
      impBtn.onclick = function () { impFile.click(); };
      impFile.onchange = function () {
        var f = impFile.files && impFile.files[0];
        if (f && window.akImportBackup) window.akImportBackup(f);
        impFile.value = "";
      };
    }
    var wipeBtn = $("akStorWipe");
    if (wipeBtn) wipeBtn.onclick = function () {
      if (!confirm("确定要清空全部数据吗？\n聊天记录、联系人、朋友圈、iCity、贴纸、设置都会被删除，且无法恢复！")) return;
      if (!confirm("最后确认：真的要全部删除吗？建议先点「导出全部备份」留底。")) return;
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
    var g = function (id) { return document.getElementById(id); };
    var note = function (msg) {
      try {
        if (window.__akiniCenterModal) window.__akiniCenterModal("储存数据", msg);
        else alert(msg);
      } catch (e) { alert(msg); }
    };
    if (g("akStorBackupNow")) g("akStorBackupNow").onclick = function () {
      try {
        window._idbStore && window._idbStore.backupAll && window._idbStore.backupAll();
        window._akiniCacheStore && window._akiniCacheStore.backupAll && window._akiniCacheStore.backupAll();
        note("已触发完整备份到浏览器本地库（IndexedDB + Cache）");
      } catch (e) { note("备份失败：" + e.message); }
    };
    if (g("akStorExport")) g("akStorExport").onclick = function () {
      try {
        if (window.akExportBackup) window.akExportBackup();
        else note("备份模块未就绪，请稍候重试");
      } catch (e) { note("导出失败：" + e.message); }
    };
    if (g("akStorImport")) g("akStorImport").onclick = function () {
      var f = g("akStorImportFile");
      if (f) f.click();
    };
    if (g("akStorImportFile")) g("akStorImportFile").onchange = function (ev) {
      var file = ev.target.files && ev.target.files[0];
      if (file && window.akImportBackup) window.akImportBackup(file);
      ev.target.value = "";
    };
    if (g("akStorClearChat")) g("akStorClearChat").onclick = function () {
      if (!confirm("确定清空所有聊天记录？此操作不可恢复！")) return;
      try {
        window._idbStore && window._idbStore.backupAll && window._idbStore.backupAll();
        var toDel = [];
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (k && k.indexOf("akini_chat_history_") === 0) toDel.push(k);
        }
        toDel.forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
        note("已清空 " + toDel.length + " 个聊天的记录缓存，返回聊天页后生效");
        renderStorage();
      } catch (e) { note("清理失败：" + e.message); }
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
