(function () {
  "use strict";
  if (window.akiniMailEngine) return;

  function fmtDate() {
    return new Date().toLocaleString("zh-CN", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    });
  }

  function getSent() {
    return window.akiniStore && window.akiniStore.getSync
      ? window.akiniStore.getSync("akini_mail_sent", [])
      : [];
  }
  function getReceived() {
    return window.akiniStore && window.akiniStore.getSync
      ? window.akiniStore.getSync("akini_mail_received", [])
      : [];
  }
  function saveSent(arr) {
    var n = JSON.stringify(arr || []);
    if (window.akiniStore && window.akiniStore.set) window.akiniStore.set("akini_mail_sent", n);
    else if (window._idbStore && window._idbStore.set) {
      window._idbStore.set("akini_mail_sent", n);
      window._idbStore.set("akini_mail_sent_backup", n);
    }
  }
  function saveReceived(arr) {
    var n = JSON.stringify(arr || []);
    if (window.akiniStore && window.akiniStore.set) window.akiniStore.set("akini_mail_received", n);
    else if (window._idbStore && window._idbStore.set) {
      window._idbStore.set("akini_mail_received", n);
      window._idbStore.set("akini_mail_received_backup", n);
    }
  }

  // 生成随机来信内容（取自用户字卡库，与聊天/朋友圈一致）
  function genLetter(count) {
    count = parseInt(count, 10);
    if (isNaN(count) || count < 1) count = Math.floor(Math.random() * 8) + 5;
    if (!window.pickWordCards) return "";
    var raw = window.pickWordCards(count);
    if (!raw) return "";
    return raw.split("\n").filter(function (s) { return s && s.trim(); }).join(" ");
  }

  // ========== 离线回信投递：检查所有已预约 replyTime 且到点的回信 ==========
  function checkStatus() {
    try {
      var now = Date.now();
      var sent = getSent();
      var changed = false;
      var delivered = [];
      for (var i = 0; i < sent.length; i++) {
        var s = sent[i];
        if (s && s.replyTime && !s.repliedByTa && now >= s.replyTime) {
          // 仅在信箱活跃时段投递（与原逻辑一致，非活跃时段顺延到下次检查）
          if (window.AKR && typeof window.AKR.isInTimeRange === "function" && !window.AKR.isInTimeRange("mail")) {
            continue;
          }
          var recv = getReceived();
          recv.push({
            content: s.replyContent || genLetter(),
            date: fmtDate(),
            from: s.replyFromName || s.to || "对方",
            fromId: s.replyFromId || s.toId,
            subtype: "reply",
            originalContent: s.content,
          });
          saveReceived(recv);
          s.repliedByTa = true;
          changed = true;
          delivered.push(s);
        }
      }
      if (changed) saveSent(sent);
      // 通知 UI
      for (var d = 0; d < delivered.length; d++) {
        var s2 = delivered[d];
        if (window.showInAppNotif) {
          window.showInAppNotif({
            app: "信箱",
            appIcon: "✉️",
            avatar: window.nt ? window.nt(s2.replyAvatar, 40) : "",
            name: s2.replyFromName || "对方",
            fullContent: true,
            msg: (s2.replyFromName || "对方") + "回复了你的信件",
            onTap: function () { if (window.o) window.o("mail"); },
          });
        }
      }
      if (delivered.length && window.__renderMail) window.__renderMail();
    } catch (e) {
      console.warn("[akini-mail-engine] checkStatus error", e);
    }
  }

  // ========== 主动来信定时器（syy envelopeAutoSend 模式） ==========
  var autoTimer = null;
  function manageAutoSendTimer() {
    if (autoTimer) clearTimeout(autoTimer);
    var enabled = localStorage.getItem("akini_mailAutoSendEnabled");
    if (enabled === "0") return;
    var min = parseFloat(localStorage.getItem("akini_num_mailAutoSendMin") || "30");
    var max = parseFloat(localStorage.getItem("akini_num_mailAutoSendMax") || "90");
    if (isNaN(min) || min < 1) min = 30;
    if (isNaN(max) || max < min) max = min + 30;
    var delay = (min + Math.random() * (max - min)) * 60 * 1000;
    autoTimer = setTimeout(function () {
      try {
        if (window.AKR && typeof window.AKR.isInTimeRange === "function" && !window.AKR.isInTimeRange("mail")) {
          manageAutoSendTimer();
          return;
        }
        var contacts = window.akiniContacts ? window.akiniContacts.getContacts() : [];
        if (!contacts || !contacts.length) { manageAutoSendTimer(); return; }
        var c = contacts[Math.floor(Math.random() * contacts.length)];
        var content = genLetter();
        if (!content) { manageAutoSendTimer(); return; }
        var recv = getReceived();
        recv.push({
          content: content,
          date: fmtDate(),
          from: c.name,
          fromId: c.id,
          subtype: "letter",
        });
        saveReceived(recv);
        if (window.showInAppNotif) {
          window.showInAppNotif({
            app: "信箱",
            appIcon: "✉️",
            avatar: window.nt ? window.nt(c.avatar, 40) : "",
            name: c.name,
            fullContent: true,
            msg: c.name + "给你写了一封信",
            onTap: function () { if (window.o) window.o("mail"); },
          });
        }
        if (window.__renderMail) window.__renderMail();
      } catch (e) {
        console.warn("[akini-mail-engine] autoSend error", e);
      }
      manageAutoSendTimer();
    }, delay);
  }

  function start() {
    // 启动时立即检查一次（投递离线期间到点的回信），再启动定时器
    checkStatus();
    manageAutoSendTimer();
    // 每 30 秒巡检一次，确保应用保持打开时也能按时投递
    setInterval(checkStatus, 30000);
  }

  window.akiniMailEngine = {
    checkStatus: checkStatus,
    start: start,
  };

  // 等待数据恢复完成后启动
  function boot() {
    if (window.__akiniBooted) { start(); return; }
    var waited = 0;
    var iv = setInterval(function () {
      waited += 200;
      if (window.__akiniBooted || waited > 8000) {
        clearInterval(iv);
        start();
      }
    }, 200);
  }
  boot();

  console.log("[akini-mail-engine] 信箱离线回信/主动来信引擎已加载（syy envelope 模式）");
})();