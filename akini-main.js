/* [Akini] 所有数据仅保存在本地设备（localStorage/IndexedDB），不联网、不同步。 */
/* 图片压缩：所有 FileReader 读取的图片统一压缩，避免 base64 过大撑爆 localStorage 配额导致数据丢失 */
(function () {
  if (window.__akiniFRCompress) return;
  window.__akiniFRCompress = true;
  if (typeof FileReader === "undefined" || !FileReader.prototype) return;
  var orig = FileReader.prototype.readAsDataURL;
  FileReader.prototype.readAsDataURL = function (blob) {
    var self = this;
    try {
      var type = (blob && blob.type) || "";
      if (type.indexOf("image/") !== 0) return orig.call(self, blob);
      var url = URL.createObjectURL(blob);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        try {
          var w = img.naturalWidth || img.width;
          var h = img.naturalHeight || img.height;
          if (!w || !h) { orig.call(self, blob); return; }
          var maxDim = 1024;
          if (w > maxDim || h > maxDim) {
            var s = Math.min(maxDim / w, maxDim / h);
            w = Math.round(w * s);
            h = Math.round(h * s);
          }
          var cv = document.createElement("canvas");
          cv.width = w;
          cv.height = h;
          var ctx = cv.getContext("2d");
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, w, h);
          var q = 0.85;
          var dataUrl = cv.toDataURL("image/jpeg", q);
          var guard = 0;
          while (dataUrl.length > 120000 && q > 0.3 && guard < 6) {
            q -= 0.1;
            guard++;
            dataUrl = cv.toDataURL("image/jpeg", q);
          }
          try {
            Object.defineProperty(self, "result", { value: dataUrl, configurable: true, writable: true, enumerable: true });
          } catch (_) {
            self.result = dataUrl;
          }
          try { self.dispatchEvent(new Event("load")); } catch (_) {}
          try { self.dispatchEvent(new Event("loadend")); } catch (_) {}
        } catch (e) {
          orig.call(self, blob);
        }
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        orig.call(self, blob);
      };
      img.src = url;
    } catch (e) {
      orig.call(self, blob);
    }
  };
})();

/* 启动迁移：把 localStorage 中已存在的超大 base64 图片就地压缩，腾出配额 */
window.__akiniCompressExistingImages = function (done) {
  var keys = [];
  try {
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf("akini_") === 0) keys.push(k);
    }
  } catch (e) {}
  var dataUrlRe = /data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]{2000,}/g;
  var candidates = [];
  keys.forEach(function (k) {
    var v;
    try { v = localStorage.getItem(k); } catch (e) { return; }
    if (!v || v.length < 50000) return;
    var matches = v.match(dataUrlRe);
    if (matches && matches.length) candidates.push({ key: k, val: v, matches: matches });
  });
  if (!candidates.length) { if (done) done(0); return; }
  var pending = candidates.length;
  candidates.forEach(function (c) {
    var replaced = c.val;
    var left = c.matches.length;
    c.matches.forEach(function (du) {
      var img = new Image();
      img.onload = function () {
        try {
          var maxDim = 1024, w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
          if (w > maxDim || h > maxDim) { var s = Math.min(maxDim / w, maxDim / h); w = Math.round(w * s); h = Math.round(h * s); }
          var cv = document.createElement("canvas"); cv.width = w; cv.height = h;
          cv.getContext("2d").drawImage(img, 0, 0, w, h);
          var q = 0.8, nd = cv.toDataURL("image/jpeg", q);
          while (nd.length > 100000 && q > 0.3) { q -= 0.1; nd = cv.toDataURL("image/jpeg", q); }
          replaced = replaced.split(du).join(nd);
        } catch (e) {}
        left--;
        if (left === 0) {
          try { localStorage.setItem(c.key, replaced); } catch (e) {}
          pending--;
          if (pending === 0 && done) done(candidates.length);
        }
      };
      img.onerror = function () {
        left--;
        if (left === 0) {
          try { localStorage.setItem(c.key, replaced); } catch (e) {}
          pending--;
          if (pending === 0 && done) done(candidates.length);
        }
      };
      img.src = du;
    });
  });
};
try { window.__akiniCompressExistingImages(); } catch (e) {}
function setHtmlKeepInput(t, e) {
  if (t) {
    var n = t.querySelector('input[type="file"]'),
      i = t.getAttribute && t.getAttribute("for");
    ((t.innerHTML = e), n && (t.appendChild(n), i && t.setAttribute("for", i)));
  }
}
function __akiniShowBanner(msg, color) {
  var b = document.getElementById("akiniBootBanner");
  if (!b) {
    b = document.createElement("div");
    b.id = "akiniBootBanner";
    b.style.cssText =
      "position:fixed;top:0;left:0;right:0;z-index:99999999;background:" +
      (color || "#ff4444") +
      ";color:#fff;font:bold 14px/1.4 sans-serif;padding:10px 12px;max-height:160px;overflow:auto;white-space:normal;word-break:break-all;";
    document.body
      ? document.body.appendChild(b)
      : document.addEventListener("DOMContentLoaded", function () {
          document.body.appendChild(b);
        });
  }
  b.textContent = msg;
}
window.__akiniBootStep = "start";
/* 尽早同步用户装扮，避免先显示默认再替换的闪烁 */
(function () {
  try {
    var bg = localStorage.getItem("akini_home_bg");
    if (bg) {
      var pf = document.getElementById("phoneFrame");
      if (pf) {
        pf.style.backgroundImage = "url(" + bg + ")";
        pf.style.backgroundSize = "cover";
        pf.style.backgroundPosition = "center";
        pf.style.backgroundRepeat = "no-repeat";
        pf.classList.add("has-custom-bg");
      }
    }
  } catch (e) {}
})();
/* 默认开启：已读回执、时间戳（仅在用户从未设置时写入） */
(function () {
  try {
    ["readReceiptToggle", "timestampToggle"].forEach(function (key) {
      if (localStorage.getItem("akini_toggle_" + key) === null) {
        localStorage.setItem("akini_toggle_" + key, "0");
      }
    });
  } catch (e) {}
})();
/* ====== AKR（Akini 随机内核）：随机行为/概率/时间范围控制 ====== */
window.AKR = (function () {
  /* 概率默认值（可用 localStorage 覆盖：akini_prob_<name>，范围 0-100） */
  var DEFAULT_PROBS = {
    meaningfulNumber: 0.12,
    quote: 0.3,
    taTransfer: 0.08,
    groupTransferMe: 0.08,
    noReply: 0.05,
    sticker: 0.2,
    incomingCall: 0.03,
    groupCall: 0.03,
    answerCall: 0.65,
    missCall: 0.30,
    refundTransfer: 0.1,
    poke: 0.03,
  };
  function getProb(name) {
    try {
      var cfg = parseFloat(
        localStorage.getItem("akini_prob_" + name) || "",
      );
      if (!isNaN(cfg) && cfg >= 0) return Math.min(1, cfg / 100);
    } catch (e) {}
    var d = DEFAULT_PROBS[name];
    return "number" == typeof d ? d : 0;
  }
  /* 活跃时间范围：未配置时始终为 true（默认全天生效） */
  function isInTimeRange(scope) {
    try {
      var sh = parseInt(
          localStorage.getItem("akini_num_activeStartHour") || "",
          10,
        ),
        eh = parseInt(
          localStorage.getItem("akini_num_activeEndHour") || "",
          10,
        );
      if (!isNaN(sh) && !isNaN(eh) && 0 <= sh && sh <= 24 && 0 <= eh && eh <= 24) {
        var h = new Date().getHours();
        if (sh <= eh) return h >= sh && h < eh;
        return h >= sh || h < eh; /* 跨午夜 */
      }
    } catch (e) {}
    return !0;
  }
  /* 一次回复的消息条数：读取设置页私聊/群聊字卡数量范围 */
  function getCardCount(type) {
    try {
      var isGroup = type === "group";
      var minKey = isGroup ? "akini_num_replyCardCountGroupMin" : "akini_num_replyCardCountMin";
      var maxKey = isGroup ? "akini_num_replyCardCountGroupMax" : "akini_num_replyCardCountMax";
      var mn = parseInt(localStorage.getItem(minKey) || "", 10);
      var mx = parseInt(localStorage.getItem(maxKey) || "", 10);
      if (isNaN(mn) || mn < 1) mn = 1;
      if (isNaN(mx) || mx < mn) mx = mn;
      mn = Math.max(1, Math.min(20, mn));
      mx = Math.max(1, Math.min(20, mx));
      return mn >= mx ? mn : Math.floor(Math.random() * (mx - mn + 1)) + mn;
    } catch (e) {
      var r = Math.random();
      return r < 0.55 ? 1 : r < 0.88 ? 2 : 3;
    }
  }
  /* 回复行为：未开“已读不回”时必回；开启后才按概率已读不回；3% 概率触发拍一拍 */
  function pickReplyBehavior() {
    var readNoReply = false;
    try {
      readNoReply = localStorage.getItem("akini_toggle_readNoReplyToggle") === "1";
    } catch (e) {}
    if (readNoReply) {
      if (Math.random() < getProb("noReply"))
        return { type: "none", cardCount: 0, extra: {} };
    }
    var extra = {};
    if (Math.random() < getProb("poke")) extra.poke = true;
    if (localStorage.getItem("akini_toggle_emojiMixToggle") === "1")
      extra.emojiMix = true;
    return {
      type: "text",
      cardCount: getCardCount("private"),
      extra: extra,
    };
  }
  return {
    getProb: getProb,
    isInTimeRange: isInTimeRange,
    getCardCount: getCardCount,
    pickReplyBehavior: pickReplyBehavior,
    isUserPresent: function () {
      return Date.now() - (window.__akiniLastActive || 0) < 6e5;
    },
    isAppActive: function () {
      try {
        return !document.hidden;
      } catch (e) {
        return !0;
      }
    },
  };
})();
window.__akiniFileProtocol =
  typeof location !== "undefined" && location.protocol === "file:";
function requestPersistentStorage() {
  if (window.__akiniFileProtocol) {
    console.warn("[Akini] 本地文件模式：跳过持久化存储请求");
    return;
  }
  if (
    typeof navigator !== "undefined" &&
    navigator.storage &&
    navigator.storage.persist
  ) {
    navigator.storage
      .persist()
      .then(function (persistent) {
        if (!persistent) {
          console.warn(
            "[Akini] 浏览器未授予持久存储权限，重新进入页面可能导致数据丢失",
          );
        }
      })
      .catch(function (e) {
        console.warn("[Akini] 持久存储请求失败", e);
      });
  }
}
document.addEventListener("DOMContentLoaded", function () {
  try {
    window.__akiniBootStep = "dom-ready";
    requestPersistentStorage();
    // === 健壮的导航按钮绑定（确保点击可用）===
    function __navOpenApp(t) {
      try {
        if (window.navTo) {
          window.navTo(t);
          return;
        }
        if (window.openAppPage) {
          window.openAppPage(t);
          return;
        }
        if (t === "icity") {
          window.showArea && window.showArea("icityArea");
          return;
        }
        window.showPage && window.showPage(t);
        if (t === "mail" && window.__renderMail) window.__renderMail();
      } catch (e) {
        console.error("[nav] openAppPage failed", e);
      }
    }
    function __navShowArea(t) {
      try {
        window.showArea && window.showArea(t);
      } catch (e) {
        console.error("[nav] showArea failed", e);
      }
    }
    function __bindNav(id, fn) {
      var el = document.getElementById(id);
      if (el) {
        el.setAttribute("data-bound", "1");
        var last = 0;
        function run(e) {
          var now = Date.now();
          if (now - last < 120) return;
          last = now;
          try { fn(); } catch (err) { console.error("[nav] handler error", err); }
        }
        el.addEventListener("click", run, !0);
      }
    }
    [
      "appBtnChat",
      "appBtnFriends",
      "appBtnMusic",
      "appBtnIcity",
      "appBtnShop",
    ].forEach(function (b) {
      var el = document.getElementById(b);
      if (el) {
        var app = el.getAttribute("data-app");
        __bindNav(b, function () {
          __navOpenApp(app);
        });
      }
    });
    // === 全局事件委托兜底：任何带 data-app 的元素被点击都触发导航 ===
    // 这是最可靠的机制，不受按钮自身绑定失效/iframe 限制影响
    document.addEventListener("click", function (e) {
      var target = e.target;
      while (target && target !== document.body) {
        if (target.dataset && target.dataset.app) {
          __navOpenApp(target.dataset.app);
          return;
        }
        target = target.parentNode;
      }
    }, true);
    __bindNav("settingsBtn", function () {
      __navShowArea("settingsArea");
    });
    __bindNav("beautifyBtn", function () {
      __navShowArea("beautifyArea");
    });
    __bindNav("wordBtn", function () {
      __navShowArea("wordbankOverlay");
      if ("function" == typeof window.renderWordbank) window.renderWordbank();
    });
    window.__navOpenApp = __navOpenApp;
    window.__navShowArea = __navShowArea;
    window.__bindNav = __bindNav;
    // 全局兜底：任何 [data-app] 按钮被点击都尝试导航（即使个别绑定失败也能响应）
    document.addEventListener(
      "click",
      function (ev) {
        var t = ev.target.closest && ev.target.closest("[data-app]");
        if (t && !t.getAttribute("data-bound")) {
          var app = t.getAttribute("data-app");
          if (app && window.__navOpenApp) {
            window.__navOpenApp(app);
          }
        }
      },
      !0,
    );
    // 居中弹窗（替代 alert/confirm），在屏幕正中显示文字提示
    window.__akiniCenterModal = function (title, message, opts) {
      opts = opts || {};
      var old = document.getElementById("__akiniCenterModal");
      if (old) old.remove();
      var overlay = document.createElement("div");
      overlay.id = "__akiniCenterModal";
      overlay.className = "akini-center-modal-overlay";
      overlay.style.cssText =
        "position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);";
      var panel = document.createElement("div");
      panel.className = "akini-center-modal-panel";
      panel.style.cssText =
        "background:#fff;border-radius:24px;width:100%;max-width:320px;padding:24px 20px 20px;box-shadow:0 24px 80px rgba(0,0,0,.28);text-align:center;display:flex;flex-direction:column;gap:12px;";
      var titleText = title || "提示";
      var iconHtml = "";
      if (!opts.noIcon) {
        var iconColor = "#007aff";
        var iconPath = "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z";
        if (titleText.indexOf("成功") >= 0) {
          iconColor = "#07c160";
          iconPath = "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z";
        } else if (titleText.indexOf("失败") >= 0 || titleText.indexOf("错误") >= 0) {
          iconColor = "#ff4d4f";
          iconPath = "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z";
        } else if (titleText.indexOf("确认") >= 0 || titleText.indexOf("提醒") >= 0) {
          iconColor = "#faad14";
          iconPath = "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 15c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm0-3h-2V7h2v7z";
        }
        iconHtml = '<svg viewBox="0 0 24 24" width="36" height="36" style="color:' + iconColor + ';fill:currentColor;"><path d="' + iconPath + '"/></svg>';
      }
      var iconWrap = document.createElement("div");
      iconWrap.style.cssText = "display:flex;justify-content:center;align-items:center;margin-bottom:2px;";
      iconWrap.innerHTML = iconHtml;
      var titleEl = document.createElement("div");
      titleEl.style.cssText = "font-size:17px;font-weight:700;color:#1a1a1a;line-height:1.3;";
      titleEl.textContent = titleText;
      var bodyEl = document.createElement("div");
      bodyEl.style.cssText =
        "font-size:14px;line-height:1.55;color:#555;white-space:pre-wrap;word-break:break-word;";
      bodyEl.textContent = message || "";
      iconHtml && panel.appendChild(iconWrap);
      panel.appendChild(titleEl);
      panel.appendChild(bodyEl);
      var close = function (result) {
        overlay.remove();
        if (typeof opts.onClose === "function") opts.onClose(result);
      };
      if (opts.confirm) {
        var row = document.createElement("div");
        row.style.cssText = "display:flex;gap:10px;margin-top:8px;";
        var cancel = document.createElement("button");
        cancel.type = "button";
        cancel.className = "akini-modal-btn akini-modal-btn-cancel";
        cancel.textContent = opts.cancelText || "取消";
        cancel.style.cssText =
          "flex:1;height:44px;border:1px solid #e0e0e0;border-radius:14px;background:#f7f7f7;color:#555;font-size:15px;font-weight:600;cursor:pointer;";
        var ok = document.createElement("button");
        ok.type = "button";
        ok.className = "akini-modal-btn akini-modal-btn-ok";
        ok.textContent = opts.okText || "确定";
        ok.style.cssText =
          "flex:1;height:44px;border:none;border-radius:14px;background:#07c160;color:#fff;font-size:15px;font-weight:600;cursor:pointer;";
        cancel.addEventListener("click", function () {
          close(false);
        });
        ok.addEventListener("click", function () {
          close(true);
        });
        row.appendChild(cancel);
        row.appendChild(ok);
        panel.appendChild(row);
      } else {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "akini-modal-btn akini-modal-btn-ok";
        btn.textContent = opts.okText || "确定";
        btn.style.cssText =
          "margin-top:4px;height:44px;border:none;border-radius:14px;background:#07c160;color:#fff;font-size:15px;font-weight:600;padding:0 32px;cursor:pointer;align-self:center;min-width:120px;";
        btn.addEventListener("click", function () {
          close();
        });
        panel.appendChild(btn);
      }
      overlay.appendChild(panel);
      document.body.appendChild(overlay);
    };
    window._idbStore = (function () {
      var STORE = "imgs";
      var DB_NAME = "akini_img_db";
      var DB_VERSION = 1;
      var db = null;
      var queue = [];
      var opening = false;

      function fireReady(cbs, conn) {
        for (var i = 0; i < cbs.length; i++) {
          try { cbs[i](conn); } catch (e) {}
        }
      }

      function open(cb) {
        if (db) { cb(db); return; }
        queue.push(cb);
        if (opening) return;
        opening = true;
        try {
          var req = indexedDB.open(DB_NAME, DB_VERSION);
          req.onupgradeneeded = function (e) {
            var _db = e.target.result;
            if (!_db.objectStoreNames.contains(STORE)) {
              _db.createObjectStore(STORE);
            }
          };
          req.onsuccess = function (e) {
            db = e.target.result;
            try {
              db.onclose = function () { db = null; };
              db.onversionchange = function () { try { db.close(); } catch (_) {} db = null; };
            } catch (_) {}
            opening = false;
            var q = queue; queue = [];
            fireReady(q, db);
          };
          req.onerror = req.onblocked = function () {
            opening = false;
            var q = queue; queue = [];
            fireReady(q, null);
          };
        } catch (err) {
          opening = false;
          var q = queue; queue = [];
          fireReady(q, null);
        }
      }

      function withDB(use, fail) {
        open(function (conn) {
          if (!conn) { if (fail) fail(); return; }
          function tryUse(retrying) {
            try {
              use(conn);
            } catch (err) {
              if (
                !retrying && err &&
                (err.name === "InvalidStateError" ||
                 err.name === "NotFoundError" ||
                 (err.message && err.message.toLowerCase().indexOf("closing") >= 0))
              ) {
                try { db.close(); } catch (_) {}
                db = null;
                open(function (conn2) {
                  if (conn2) {
                    try { use(conn2); } catch (e2) { if (fail) fail(); }
                  } else if (fail) fail();
                });
              } else {
                if (fail) fail();
              }
            }
          }
          tryUse(false);
        });
      }

      function lsSet(k, v) {
        try { if (typeof T !== "undefined" && T) T.call(localStorage, k, v); } catch (e) {}
      }

      return {
        set: function (k, v, cb) {
          var done = function () { if (typeof cb === "function") cb(); };
          withDB(function (conn) {
            var tx = conn.transaction(STORE, "readwrite");
            tx.objectStore(STORE).put(v, k);
            tx.oncomplete = done;
            tx.onerror = function () { lsSet(k, v); done(); };
            tx.onabort = function () { lsSet(k, v); done(); };
          }, function () { lsSet(k, v); done(); });
        },
        get: function (k, cb) {
          if (typeof cb !== "function") return;
          withDB(function (conn) {
            var req = conn.transaction(STORE, "readonly").objectStore(STORE).get(k);
            req.onsuccess = function () { cb(req.result !== undefined ? req.result : localStorage.getItem(k)); };
            req.onerror = function () { cb(localStorage.getItem(k)); };
          }, function () { cb(localStorage.getItem(k)); });
        },
        backupAll: function (cb) {
          var done = function () { if (typeof cb === "function") cb(); };
          function isEmpty(v) {
            return v === null || v === undefined || v === "" || v === "null" || v === "undefined" || v === "[]" || v === "{}";
          }
          function isSnapKey(k) {
            return k === "akini_localstorage_snapshot" || k === "akini_localstorage_snapshot_backup";
          }
          // 收集 localStorage 中需要备份的键值，但写入 IDB 前必须确认 IDB 中无该键，
          // 防止用可能已过期/被系统清空的 localStorage 数据覆盖 IDB 主存储。
          var lsItems = [];
          for (var i = 0; i < localStorage.length; i++) {
            var r = localStorage.key(i), c = localStorage.getItem(r);
            if (!r || r.indexOf("akini_app_icon_") === 0 || isSnapKey(r)) continue;
            if (isEmpty(c)) continue;
            lsItems.push({ k: r, v: c });
          }
          withDB(function (conn) {
            var tx = conn.transaction(STORE, "readwrite");
            var store = tx.objectStore(STORE);
            var existing = {};
            var cursorReq = store.openCursor();
            cursorReq.onsuccess = function (e) {
              var cursor = e.target.result;
              if (cursor) {
                existing[cursor.key] = cursor.value;
                cursor.continue();
              } else {
                for (var j = 0; j < lsItems.length; j++) {
                  var item = lsItems[j];
                  var idbVal = existing[item.k];
                  var idbLen = idbVal === undefined || idbVal === null ? 0 : String(idbVal).length;
                  // 只在新于 IDB 时才覆盖：聊天记录由 C() 直接维护，通常 IDB >= localStorage；
                  // 设置类只在 localStorage 更新且更长时才同步到 IDB，避免过期快照覆盖最新数据。
                  if (idbLen < String(item.v).length) {
                    store.put(item.v, item.k);
                  }
                }
              }
            };
            cursorReq.onerror = function () {
              // 无法枚举已有键时宁可不写入，也不覆盖 IDB 中可能更新、更完整的数据
            };
            tx.oncomplete = done;
            tx.onerror = done;
          }, done);
        },
        restoreAll: function (cb) {
          var done = function () { if (typeof cb === "function") cb(); };
          function isEmpty(v) {
            return v === null || v === undefined || v === "" || v === "null" || v === "undefined" || v === "[]" || v === "{}";
          }
          withDB(function (conn) {
            var cursorReq = conn.transaction(STORE, "readonly").openCursor();
            cursorReq.onsuccess = function (e) {
              var o = e.target.result;
              if (o) {
                var k = o.key, v = o.value;
                if (
                  k && k.indexOf("akini_app_icon_") !== 0 &&
                  k.indexOf("akini_localstorage_snapshot") !== 0 &&
                  !isEmpty(v)
                ) {
                  // 把 IDB 权威数据同步到内存缓存，避免 localStorage 满后读不到最新数据
                  if (window.akiniStore && window.akiniStore.memorySet) {
                    window.akiniStore.memorySet(k, v);
                  }
                  var cur = localStorage.getItem(k);
                  // 只在本地为空/占位时才用 IDB 回填；已有数据不覆盖，防止旧数据覆盖新数据
                  if (isEmpty(cur)) {
                    try { localStorage.setItem(k, v); } catch (x) {}
                  }
                }
                o.continue();
              } else done();
            };
            cursorReq.onerror = done;
          }, done);
        },
        getAll: function (cb) {
          if (typeof cb !== "function") return;
          withDB(function (conn) {
            var out = {};
            var req = conn.transaction(STORE, "readonly").openCursor();
            req.onsuccess = function (e) {
              var r = e.target.result;
              if (r) { out[r.key] = r.value; r.continue(); } else cb(out);
            };
            req.onerror = function () { cb(out); };
          }, function () { cb({}); });
        },
        remove: function (k, cb) {
          var done = function () { if (typeof cb === "function") cb(); };
          withDB(function (conn) {
            var tx = conn.transaction(STORE, "readwrite");
            tx.objectStore(STORE).delete(k);
            tx.oncomplete = done;
            tx.onerror = done;
          }, done);
        },
        clearAll: function (cb) {
          var done = function () { if (typeof cb === "function") cb(); };
          withDB(function (conn) {
            var tx = conn.transaction(STORE, "readwrite");
            tx.objectStore(STORE).clear();
            tx.oncomplete = done;
            tx.onerror = done;
          }, done);
        }
      };
    })();
    // 同步紧急恢复：在应用任何代码读取 localStorage 之前，先从 localStorage 快照同步回填，
    // 确保启动瞬间 localStorage 已有数据，避免读到空默认值后再写回覆盖（参照 milk 的紧急备份思路）
    (function () {
      function isSnapKey(k) {
        return k === "akini_localstorage_snapshot" || k === "akini_localstorage_snapshot_backup";
      }
      function isEmpty(v) {
        return v === null || v === undefined || v === "" || v === "null" || v === "undefined" || v === "[]" || v === "{}";
      }
      try {
        var keys = ["akini_localstorage_snapshot", "akini_localstorage_snapshot_backup"];
        for (var ki = 0; ki < keys.length; ki++) {
          var raw = localStorage.getItem(keys[ki]);
          if (!raw) continue;
          var data = JSON.parse(raw);
          if (!data || typeof data !== "object") continue;
          for (var k in data) {
            if (!data.hasOwnProperty(k)) continue;
            if (k.indexOf("akini_") !== 0 || k.indexOf("akini_app_icon_") === 0) continue;
            if (isSnapKey(k)) continue;
            try {
              var cur = localStorage.getItem(k);
              if (isEmpty(cur)) localStorage.setItem(k, data[k]);
            } catch (x) {}
          }
          break; // 优先用主快照
        }
      } catch (e) {
        console.warn("[Akini] sync snapshot restore error", e);
      }
      // 同步快照恢复完成后仍不立即允许实时备份，需等待异步 IDB/Cache 恢复与 __akiniBootApp 完成，
      // 防止默认值在异步恢复前覆盖 IDB 里的真实数据
      window._akiniSyncRestored = true;
    })();
    !(function () {
        SNAPSHOT_KEY = "akini_localstorage_snapshot";
      window._akiniCacheStore = {
        backupAll: function (e) {
          try {
            if ("undefined" == typeof caches || !caches.open) return void (e && e());
            function isEmpty(v) {
              return v === null || v === undefined || v === "" || v === "null" || v === "undefined" || v === "[]" || v === "{}";
            }
            function isSnapKey(k) {
              return k === "akini_localstorage_snapshot" || k === "akini_localstorage_snapshot_backup";
            }
            var data = {};
            for (var i = 0; i < localStorage.length; i++) {
              var k = localStorage.key(i);
              if (!k || k.indexOf("akini_") !== 0 || k.indexOf("akini_app_icon_") === 0 || isSnapKey(k)) continue;
              try {
                var v = localStorage.getItem(k);
                if (!isEmpty(v)) data[k] = v;
              } catch (t) {}
            }
            caches
              .open(CACHE_NAME)
              .then(function (cache) {
                return cache.put(
                  SNAPSHOT_KEY,
                  new Response(JSON.stringify(data), {
                    headers: { "Content-Type": "application/json" },
                  }),
                );
              })
              .then(function () {
                e && e();
              })
              .catch(function () {
                e && e();
              });
          } catch (t) {
            e && e();
          }
        },
        restoreAll: function (e) {
          try {
            if ("undefined" == typeof caches || !caches.open)
              return void (e && e());
            caches
              .open(CACHE_NAME)
              .then(function (cache) {
                return cache.match(SNAPSHOT_KEY);
              })
              .then(function (response) {
                if (!response) return e && e();
                return response.text();
              })
              .then(function (text) {
                if (!text) return e && e();
                var data = JSON.parse(text);
                var changed = !1;
                for (var k in data)
                  if (data.hasOwnProperty(k) && k.indexOf("akini_") === 0 && k.indexOf("akini_app_icon_") !== 0) {
                    try {
                      var cur = localStorage.getItem(k);
                      if (
                        !cur ||
                        cur === "" ||
                        cur === "null" ||
                        cur === "undefined" ||
                        cur === "[]" ||
                        cur === "{}" ||
                        cur.length === 0
                      ) {
                        localStorage.setItem(k, data[k]);
                        changed = !0;
                      }
                    } catch (t) {}
                  }
                e && e(changed);
              })
              .catch(function () {
                e && e();
              });
          } catch (t) {
            e && e();
          }
        },
      };
    })();
    // 实时备份：拦截 localStorage.setItem/removeItem，每次数据变更后自动写入 IDB + Cache API
    try {
      (function () {
        var origSetItem = localStorage.setItem;
        var origRemoveItem = localStorage.removeItem;
        var backupTimer = null;
        function isSnapshotKey(k) {
          return k === "akini_localstorage_snapshot" || k === "akini_localstorage_snapshot_backup";
        }
        function isEmptyValue(v) {
          return v === null || v === undefined || v === "" || v === "null" || v === "undefined" || v === "[]" || v === "{}";
        }
        function snapshotLs() {
          try {
            var snap = {};
            for (var i = 0; i < localStorage.length; i++) {
              var kk = localStorage.key(i);
              if (kk && kk.indexOf("akini_app_icon_") !== 0 && !isSnapshotKey(kk)) {
                var vv = localStorage.getItem(kk);
                if (!isEmptyValue(vv)) snap[kk] = vv;
              }
            }
            var json = JSON.stringify(snap);
            localStorage.setItem("akini_localstorage_snapshot", json);
            localStorage.setItem("akini_localstorage_snapshot_backup", json);
          } catch (e) {}
        }
        function doBackup() {
          if (backupTimer) return;
          // 启动恢复完成前不触发备份，避免用可能不完整的 localStorage 覆盖 IDB/Cache 里的完整数据
          if (!window._akiniDataRestored) return;
          backupTimer = setTimeout(function () {
            backupTimer = null;
            snapshotLs();
            try {
              window._idbStore && window._idbStore.backupAll && window._idbStore.backupAll();
            } catch (e) {}
            try {
              window._akiniCacheStore && window._akiniCacheStore.backupAll && window._akiniCacheStore.backupAll();
            } catch (e) {}
          }, 200);
        }
        localStorage.setItem = function (k, v) {
          var r = origSetItem.apply(this, arguments);
          // 快照键自身的写入不再触发备份，否则会形成 snapshotLs→setItem→doBackup→snapshotLs 的无限循环
          if (k && String(k).indexOf("akini_") === 0 && !isSnapshotKey(k)) doBackup();
          return r;
        };
        localStorage.removeItem = function (k) {
          var r = origRemoveItem.apply(this, arguments);
          if (k && String(k).indexOf("akini_") === 0 && !isSnapshotKey(k)) doBackup();
          return r;
        };
      })();
    } catch (e) {}
    try {
      window._akiniRestoreFromSnapshot = function (e) {
        function restoreFromSource(src) {
          if (!src) return 0;
          try {
            var data = JSON.parse(src);
            if (data && "object" == typeof data) {
              var restored = 0;
              for (var k in data) {
                if (data.hasOwnProperty(k) && k.indexOf("akini_") === 0) {
                  try {
                    var cur = localStorage.getItem(k);
                    if (
                      !cur ||
                      cur === "" ||
                      cur === "null" ||
                      cur === "undefined" ||
                      cur === "[]" ||
                      cur === "{}"
                    ) {
                      localStorage.setItem(k, data[k]);
                      restored++;
                    }
                  } catch (x) {}
                }
              }
              return restored;
            }
          } catch (p) {}
          return 0;
        }

        // 快照同时保存在 localStorage 和 IndexedDB；先尝试 localStorage，再用 IDB 兜底
        try {
          var lsRestored = restoreFromSource(localStorage.getItem("akini_localstorage_snapshot")) +
            restoreFromSource(localStorage.getItem("akini_localstorage_snapshot_backup"));
          if (lsRestored > 0) {
            console.log("[Akini] restoreFromSnapshot restored", lsRestored);
            "function" == typeof e && e();
            return;
          }
        } catch (p) {}

        try {
          if (window._idbStore && window._idbStore.get) {
            var keys = ["akini_localstorage_snapshot", "akini_localstorage_snapshot_backup"];
            var completed = 0;
            var callbacked = !1;
            var done = function () {
              if (callbacked) return;
              completed++;
              if (completed >= keys.length) {
                callbacked = !0;
                "function" == typeof e && e();
              }
            };
            keys.forEach(function (key) {
              window._idbStore.get(key, function (v) {
                if (v) restoreFromSource(v);
                done();
              });
            });
            setTimeout(done, 2000); // 安全兜底
            return;
          }
        } catch (p) {}
        "function" == typeof e && e();
      };
      window._akiniCacheStore &&
        window._akiniCacheStore.restoreAll &&
        window._akiniCacheStore.restoreAll(function () {
          window._idbStore &&
            window._idbStore.restoreAll &&
            window._idbStore.restoreAll(function () {
              window._akiniRestoreFromSnapshot &&
                window._akiniRestoreFromSnapshot(function () {
                  console.log("[Akini] cache+idb+snapshot restoreAll done");
                  // 恢复完成后的渲染与 _akiniDataRestored 开关统一交给 __akiniBootApp，
                  // 避免此处过早打开备份闸门导致空 localStorage 覆盖 IDB/Cache 真实数据
                });
            });
        });
    } catch (e) {
      console.warn("[Akini] restoreAll error", e);
    }
    // 定时器调度器：支持后台/冻结后恢复时追赶触发
    (function () {
      var jobs = {};
      window._akiniTimer = {
        schedule: function (name, fn, delayMs) {
          try {
            if (jobs[name]) clearTimeout(jobs[name]);
            localStorage.setItem(
              "akini_next_" + name,
              String(Date.now() + delayMs),
            );
          } catch (e) {}
          jobs[name] = setTimeout(function () {
            try {
              localStorage.setItem("akini_last_" + name, String(Date.now()));
              localStorage.removeItem("akini_next_" + name);
            } catch (e) {}
            try {
              fn();
            } catch (e) {
              console.warn("[AkiniTimer] " + name + " error", e);
            }
          }, Math.max(0, delayMs));
        },
        runIfDue: function (name, fn) {
          try {
            var next = parseFloat(
              localStorage.getItem("akini_next_" + name) || "0",
            );
            if (next && Date.now() >= next) {
              if (jobs[name]) clearTimeout(jobs[name]);
              try {
                localStorage.setItem("akini_last_" + name, String(Date.now()));
                localStorage.removeItem("akini_next_" + name);
              } catch (e) {}
              fn();
            }
          } catch (e) {}
        },
        catchUp: function (actions) {
          var dueNames = [];
          for (var name in actions) {
            if (actions.hasOwnProperty(name) && "function" == typeof actions[name]) {
              try {
                var next = parseFloat(localStorage.getItem("akini_next_" + name) || "0");
                if (next && Date.now() >= next) dueNames.push(name);
              } catch (e) {}
            }
          }
          // 多个任务同时到期时随机打散到 0~30 秒，避免“连发”
          dueNames.forEach(function (name, idx) {
            var delay = Math.floor(Math.random() * 30000) + idx * 2000;
            setTimeout(function () {
              if (actions[name]) window._akiniTimer.runIfDue(name, actions[name]);
            }, delay);
          });
        },
      };
    })();
    document.addEventListener("DOMContentLoaded", function() {
  // 恢复流程统一交给 __akiniBootApp；此处不再单独 set _akiniDataRestored 或 resetCache，
  // 避免与 4550 行的 IDB→tryRestoreFromBackup→__akiniBootApp 路径竞争导致数据被空值覆盖
  setTimeout(function() {
    try {
      window._akiniCacheStore && window._akiniCacheStore.restoreAll && window._akiniCacheStore.restoreAll();
      window._idbStore && window._idbStore.restoreAll && window._idbStore.restoreAll();
      window._akiniRestoreFromSnapshot && window._akiniRestoreFromSnapshot();
    } catch(e){}
  }, 100);
});
((window.onerror = function (t, e, n, i, a) {
      var r = t + "";
      if (a && a.stack) r += "\\n" + a.stack;
      console.error("[Akini Error]", t, "line:" + n, "col:" + i, a);
      return !0;
    }),
      window.addEventListener("unhandledrejection", function (t) {
        var n = t.reason,
          i = n && n.message ? n.message : String(n);
        if (n && n.stack) i += "\\n" + n.stack;
        console.error("[Akini Promise Error]", n);
        try { t.preventDefault(); } catch (_) {}
      }));
    const t = [520, 1314, 9999, 10001, 13140, 5200, 52e3];
    function e() {
      if (Math.random() < window.AKR.getProb("meaningfulNumber")) {
        var e = (function () {
          var e = (
            localStorage.getItem("akini_meaningful_numbers") || "520,1314,9999"
          )
            .split(/[,，]/)
            .map(function (t) {
              return parseFloat(t.trim());
            })
            .filter(function (t) {
              return !isNaN(t) && t > 0;
            });
          return e.length ? e : t;
        })();
        return e[Math.floor(Math.random() * e.length)];
      }
      return 1 * (99999.99 * Math.random() + 0.01).toFixed(2);
    }
    function n() {
      const t = i("akini_wordbank", []).filter(
        (t) => !t.tab || "main" === t.tab,
      );
      if (0 === t.length) return "";
      const e = t[Math.floor(Math.random() * t.length)];
      return (e.text || e.content || "").trim() || "";
    }
    // 同步读取：先读内存缓存（IDB 预加载/写入同步），再读 localStorage
    function i(t, e) {
      try {
        if (window.akiniStore && window.akiniStore.memoryGet) {
          var cached = window.akiniStore.memoryGet(t);
          if (cached !== null) return JSON.parse(cached);
        }
      } catch (n) {}
      try {
        var n = localStorage.getItem(t);
        return n !== null ? JSON.parse(n) : e;
      } catch (n) {
        return (console.warn("localStorage JSON解析失败:", t, n), e);
      }
    }
    function a(t, e) {
      if (t) {
        t.style.cursor = "pointer";
        t.style.webkitTapHighlightColor = "transparent";
        t.style.touchAction = "manipulation";
        t.__akTapLock = 0;
        t.__akTapHandled = 0;
        t.__touchStartX = 0;
        t.__touchStartY = 0;
        t.__touchMoved = false;
        var swallowNext = function () {
          var done = 0;
          var h = function (ev) {
            if (done) return;
            done = 1;
            document.removeEventListener("click", h, true);
            document.removeEventListener("touchend", h, true);
            try {
              ev.preventDefault();
              ev.stopPropagation();
            } catch (x) {}
          };
          document.addEventListener("click", h, true);
          document.addEventListener("touchend", h, true);
          setTimeout(function () {
            document.removeEventListener("click", h, true);
            document.removeEventListener("touchend", h, true);
          }, 400);
        };
        var fire = function (evt) {
          var n = Date.now();
          if (n - t.__akTapLock < 250) return;
          t.__akTapLock = n;
          t.__akTapHandled = 1;
          swallowNext();
          if (evt) {
            try {
              evt.preventDefault();
              evt.stopPropagation();
            } catch (x) {}
          }
          e(evt);
        };
        t.addEventListener(
          "touchstart",
          function (evt) {
            if (evt.touches && evt.touches.length > 0) {
              t.__touchStartX = evt.touches[0].clientX;
              t.__touchStartY = evt.touches[0].clientY;
              t.__touchMoved = false;
            }
          },
          { passive: true },
        );
        t.addEventListener(
          "touchmove",
          function (evt) {
            if (evt.touches && evt.touches.length > 0) {
              var dx = Math.abs(evt.touches[0].clientX - t.__touchStartX);
              var dy = Math.abs(evt.touches[0].clientY - t.__touchStartY);
              if (dx > 8 || dy > 8) {
                t.__touchMoved = true;
              }
            }
          },
          { passive: true },
        );
        t.addEventListener(
          "touchend",
          function (evt) {
            if (t.__touchMoved) {
              t.__touchMoved = false;
              return;
            }
            fire(evt);
          },
          { passive: false },
        );
        t.addEventListener("click", function (evt) {
          if (t.__akTapHandled) {
            t.__akTapHandled = 0;
            return;
          }
          fire(evt);
        });
      }
    }
    window.__navHistory = [];
    window.__navInBack = !1;
    window.__navGetCurrent = function () {
      var pages = [
        "",
        "chat",
        "chat-list",
        "create-group",
        "friends",
        "mail",
        "music",
        "call",
        "add-contact",
        "contact-detail",
      ];
      for (var i = 0; i < pages.length; i++) {
        var p = document.getElementById("app-" + pages[i]);
        if (p && p.style.display !== "none" && p.classList.contains("show"))
          return { type: "page", id: pages[i] };
      }
      var areas = [
        "settingsArea",
        "beautifyArea",
        "icityArea",
        "wordbankOverlay",
      ];
      for (var i = 0; i < areas.length; i++) {
        var a = document.getElementById(areas[i]);
        if (a && a.style.display !== "none" && a.classList.contains("show"))
          return { type: "area", id: areas[i] };
      }
      return null;
    };
    window.__navPush = function () {
      if (window.__navInBack) return;
      var s = window.__navGetCurrent();
      if (
        s &&
        (!window.__navHistory.length ||
          JSON.stringify(
            window.__navHistory[window.__navHistory.length - 1],
          ) !== JSON.stringify(s))
      )
        window.__navHistory.push(s);
    };
    window.__navBack = function () {
      if (!window.__navHistory.length) {
        console.log("[nav] back ignored: history empty");
        return !1;
      }
      var prev = window.__navHistory.pop();
      if (!prev) {
        console.log("[nav] back ignored: prev null");
        return !1;
      }
      window.__navInBack = !0;
      try {
        console.log("[nav] back to", prev);
        if (prev.type === "page") {
          window.showArea && window.showArea(null);
          window.showPage && window.showPage(prev.id);
        } else if (prev.type === "area") {
          window.showArea && window.showArea(prev.id);
        }
      } catch (e) {
        console.error("[nav] back error", e);
      }
      window.__navInBack = !1;
      return !0;
    };
    function o(t) {
      window.__navPush();
      [
        "settingsArea",
        "beautifyArea",
        "icityArea",
        "wordbankOverlay",
        "surveyListModal",
        "surveyCreateModal",
        "surveyDetailModal",
        "surveyCreatedListModal",
      ].forEach(function (t) {
        var e = document.getElementById(t);
        e && (e.style.display = "none");
      });
      [
        "musicMenuOverlay",
        "musicContactPicker",
        "musicPlaylistOverlay",
        "musicQrWrap",
        "musicLoginInfo",
        "musicPlaylistSelect",
        "musicOptionPicker",
      ].forEach(function (t) {
        var e = document.getElementById(t);
        e && ((e.style.display = "none"), e.classList.remove("show"));
      });
      [
        "chat",
        "chat-list",
        "create-group",
        "friends",
        "mail",
        "music",
        "settings",
        "beautify",
        "call",
        "icity",
        "add-contact",
        "contact-detail",
      ].forEach(function (t) {
        const e = document.getElementById("app-" + t);
        e && (e.classList.remove("show"), (e.style.display = "none"));
      });
      const e = document.getElementById("app-" + t);
      e
        ? ((e.style.zIndex = "999999"),
          e.parentNode !== document.body && document.body.appendChild(e),
          (e.style.display = "flex"),
          e.classList.add("show"))
        : t && alert("showPage " + t + ": target NOT found");
      document.getElementById("cameraBtn");
      const n = document.getElementById("mailComposeFab");
      (n && (n.style.display = "mail" === t ? "flex" : "none"),
        "mail" === t && window.__renderMail && window.__renderMail(),
        "chat" === t &&
          U &&
          (window.akiniContacts &&
            window.openChat &&
            window.openChat(window.akiniContacts.getActiveChatId(), !0),
          lt(),
          requestAnimationFrame(function () {
            U.scrollTo({ top: U.scrollHeight, behavior: "auto" });
          })),
        "chat-list" === t && (_t("wechat"), ot()),
        "create-group" === t && ut());
      var i = document.getElementById("callMiniWindow");
      if (
        (i &&
          i.classList.contains("call-mini-shrunk") &&
          "none" !== i.style.display &&
          ((i.style.zIndex = "2147483647"),
          document.body.insertBefore(i, document.body.firstChild)),
        "friends" === t &&
          ("function" == typeof window._renderPosts && window._renderPosts(),
          Tn()),
        "icity" === t &&
          ("function" == typeof window._renderIcity && window._renderIcity(),
          Tn()),
        "music" === t &&
          ("function" == typeof syncAvatars && syncAvatars(),
          "function" == typeof window.applyChatBackground &&
            window.applyChatBackground()),
        !t)
      ) {
        ("function" == typeof window.reapplyAvatarSwap &&
          window.reapplyAvatarSwap(),
          "function" == typeof window.updateChatPreview &&
            window.updateChatPreview(),
          "function" == typeof window.updateChatPreviewBubbles &&
            window.updateChatPreviewBubbles(),
          Tn(),
          (document.documentElement.scrollTop = 0),
          (document.body.scrollTop = 0));
        try {
          window.scrollTo({ top: 0, left: 0, behavior: "instant" });
        } catch (t) {
          window.scrollTo(0, 0);
        }
      }
    }
    function r(t) {
      if (!window.__navInBack) window.__navPush();
      if (
        ([
          "settingsArea",
          "beautifyArea",
          "icityArea",
          "wordbankOverlay",
          "surveyListModal",
          "surveyCreateModal",
          "surveyDetailModal",
          "surveyCreatedListModal",
        ].forEach(function (t) {
          var e = document.getElementById(t);
          e && (e.style.display = "none");
        }),
        o(""),
        t)
      ) {
        var e = document.getElementById(t);
        e &&
          ((e.style.zIndex = "999999"),
          e.parentNode !== document.body && document.body.appendChild(e),
          (e.style.display = "flex"),
          e.classList.add("show"),
          "icityArea" === t &&
            "function" == typeof window._renderIcity &&
            (window._renderIcity(),
            setTimeout(function () {
              "function" == typeof window._renderIcityContactProfiles &&
                window._renderIcityContactProfiles();
            }, 150),
            setTimeout(function () {
              "function" == typeof window._renderIcityContactProfiles &&
                window._renderIcityContactProfiles();
            }, 500)));
      }
      var n = document.getElementById("callMiniWindow");
      n &&
        n.classList.contains("call-mini-shrunk") &&
        "none" !== n.style.display &&
        ((n.style.zIndex = "2147483647"),
        document.body.insertBefore(n, document.body.firstChild));
    }
    window.showArea = r;
    !(function () {})();
    (function () {
      var t = "akini_contacts",
        e = "akini_groups",
        n = "akini_chat_sessions",
        a = "akini_active_chat_id",
        o = "akini_home_avatars",
        r = "akini_contacts_migrated";
      function c(t, e) {
        try {
          var n = JSON.stringify(e);
          if ("[]" === n || "{}" === n) return;
          (_idbStore.set(t, n), _idbStore.set(t + "_backup", n));
        } catch (t) {
          console.warn("backupToIDB error:", t);
        }
      }
      function l(t, e) {
        try {
          _idbStore.get(t, function (t) {
            if (t)
              try {
                e(JSON.parse(t));
              } catch (t) {
                e(null);
              }
            else e(null);
          });
        } catch (t) {
          e(null);
        }
      }
      function s(t) {
        return (
          t +
          "_" +
          Date.now().toString(36) +
          "_" +
          Math.random().toString(36).slice(2, 8)
        );
      }
      var d = null,
        m = null;
      function f() {
        if (d) return d;
        var e = i(t, []);
        if (!Array.isArray(e) || 0 === e.length) {
          if (window._restoringData) return (d = []);
          e = [];
        }
        return ((d = e), e);
      }
      function g(e) {
        // 防御性：禁止用空数组覆盖已有联系人，避免异步恢复期间误读为空导致数据丢失
        if (!Array.isArray(e) || 0 === e.length) {
          var cur = i(t, []);
          if (Array.isArray(cur) && cur.length > 0) e = cur;
        }
        d = e;
        // IndexedDB 优先；localStorage 仅作热备，超配额不抛错
        if (window.akiniStore && window.akiniStore.setJson) {
          window.akiniStore.setJson(t, e);
        } else {
          try { localStorage.setItem(t, JSON.stringify(e)); } catch (err) { console.warn('[akiniContacts] save to localStorage failed', err); }
          c(t, e);
        }
        try { if(typeof window._snapshotCritical === 'function') window._snapshotCritical(); } catch(err){}
      }
      function y() {
        if (m) return m;
        var t = i(e, []);
        return (m = Array.isArray(t) ? t : []);
      }
      function p(t) {
        if (!Array.isArray(t) || 0 === t.length) {
          var cur = i(e, []);
          if (Array.isArray(cur) && cur.length > 0) t = cur;
        }
        m = t;
        if (window.akiniStore && window.akiniStore.setJson) {
          window.akiniStore.setJson(e, t);
        } else {
          try { localStorage.setItem(e, JSON.stringify(t)); } catch (err) {}
          c(e, t);
        }
        try { if(typeof window._snapshotCritical === 'function') window._snapshotCritical(); } catch(err){}
      }
      function v(t) {
        return f().find(function (e) {
          return e.id === t;
        });
      }
      function h(t) {
        return y().find(function (e) {
          return e.id === t;
        });
      }
      function w(t) {
        if (!t) return null;
        if ("me" === t)
          return {
            id: "me",
            name:
              "function" == typeof window.getMyName
                ? window.getMyName()
                : localStorage.getItem("akini_my_name") || "我",
            avatar:
              "function" == typeof window.getMyAvatar
                ? window.getMyAvatar()
                : localStorage.getItem("akini_my_avatar") ||
                  (window.__akiniAvatarCache && window.__akiniAvatarCache.my) ||
                  "🐱",
          };
        var e = v(t);
        if (e) {
          var a = e.avatar;
          if (!a && e.isDefault) {
            try {
              a = localStorage.getItem("akini_ta_avatar") || "";
            } catch (e) {}
          }
          return {
            type: "contact",
            id: e.id,
            name: e.name,
            avatar: a || e.avatar,
            isDefault: e.isDefault,
            createdAt: e.createdAt,
          };
        }
        var n = h(t);
        return n
          ? {
              type: "group",
              id: n.id,
              name: n.name,
              avatar: n.avatar,
              memberIds: n.memberIds || [],
              createdAt: n.createdAt,
            }
          : null;
      }
      var sessCache = null;
      function k() {
        if (sessCache) return sessCache;
        var t = i(n, {});
        return (sessCache =
          "object" == typeof t && null !== t ? t : {}), sessCache;
      }
      function _(t) {
        sessCache = t || {};
        if (window.akiniStore && window.akiniStore.setJson) {
          window.akiniStore.setJson(n, t || {});
        } else {
          try { localStorage.setItem(n, JSON.stringify(t)); } catch (t) { console.warn("saveSessions localStorage error:", t); }
          c(n, t);
        }
      }
      function b(t) {
        var e = k();
        return (
          e[t] ||
            (e[t] = { messagesHTML: "", unread: 0, lastMsg: "", lastTime: 0 }),
          e[t]
        );
      }
      function I(t, e) {
        var n = k(),
          i = b(t);
        // 关键修复：messagesHTML 不再写入 sessions 的 localStorage（避免大对象超配额失败、
        // 避免返回聊天时用 sessions 里的陈旧 messagesHTML 覆盖 akini_chat_history_* 完整记录）。
        // messagesHTML 只通过 C() 独立持久化到 akini_chat_history_*，内存里仍保留用于即时渲染。
        var htmlToSave = null;
        if (
          e &&
          e.hasOwnProperty("messagesHTML") &&
          "string" == typeof e.messagesHTML
        ) {
          htmlToSave = e.messagesHTML;
          // 聊天记录只增不减：防止陈旧会话数据用短的 messagesHTML 覆盖内存中的完整记录
          if (i.messagesHTML && "string" == typeof i.messagesHTML) {
            var newRows = __akiniCountMsgRows(e.messagesHTML);
            var oldRows = __akiniCountMsgRows(i.messagesHTML);
            if (newRows < oldRows) {
              console.warn("[I] 拒绝用更短的聊天记录更新会话：" + t + " (" + newRows + " < " + oldRows + ")");
              delete e.messagesHTML;
              htmlToSave = null;
            }
          }
        }
        for (var a in e) e.hasOwnProperty(a) && (i[a] = e[a]);
        // 内存中保留 messagesHTML 用于即时渲染，但不随 sessions 写入 localStorage
        var memHtml = i.messagesHTML;
        delete i.messagesHTML;
        return (
          (n[t] = i),
          _(n),
          (i.messagesHTML = memHtml),
          htmlToSave &&
            htmlToSave.trim().length > 0 &&
            "function" == typeof C &&
            C(t, htmlToSave),
          i
        );
      }
      function x() {
        return localStorage.getItem(a) || (f()[0] || {}).id || null;
      }
      function E() {
        var t = i(o, {});
        var e = f();
        // 左侧固定为“我”，右侧为选中的联系人
        t.left = "me";
        (t.right &&
          e.some(function (e) {
            return e.id === t.right;
          })) ||
          (t.right = (e[0] || {}).id);
        return t;
      }
      function S(t, e) {
        // 左侧固定为“我”，只保存右侧联系人
        localStorage.setItem(o, JSON.stringify({ left: "me", right: e }));
      }
      window.pickWordCards = function (count) {
        count = Math.max(1, parseInt(count) || 1);
        var wb = i("akini_wordbank", []);
        if (!wb.length) return "";
        var valid = wb.filter(function (t) {
          var e = (t.tab || "").toLowerCase(),
            n = (t.type || "").toLowerCase();
          return t && t.text && "pat" !== e && "pat" !== n;
        });
        if (!valid.length) return "";
        var out = [];
        for (var i = 0; i < count; i++) {
          var idx = Math.floor(Math.random() * valid.length);
          out.push(valid[idx].text);
        }
        return out.join("\n");
      };
      window.akiniContacts = {
        generateId: s,
        getContacts: f,
        saveContacts: g,
        getGroups: y,
        saveGroups: p,
        getContactById: v,
        getGroupById: h,
        getChatTarget: w,
        getSessions: k,
        saveSessions: _,
        getSession: b,
        updateSession: I,
        getActiveChatId: x,
        resetCache: function () {
          // 注意：不清 sessCache，sessions 内存缓存是最新权威数据；
          // 恢复链路通过 _(merged) 更新缓存，清空会导致读回 localStorage 陈旧版本
          ((d = null), (m = null));
        },
        setActiveChatId: function (t) {
          if (t) {
            localStorage.setItem(a, t);
            var e = w(t);
            if (e && "contact" === e.type) {
              try {
                localStorage.setItem("akini_ta_avatar", e.avatar);
              } catch (t) {}
              try {
                localStorage.setItem("akini_ta_name", e.name);
              } catch (t) {}
              u("ta", e.avatar);
            }
          }
        },
        getHomeAvatars: E,
        setHomeAvatars: S,
        addContact: function (t, e) {
          var n = f(),
            i = localStorage.getItem("akini_ta_avatar") || "",
            a = {
              id: s("ta"),
              name: t || "新联系人",
              avatar: e || i || "🐰",
              note: window.pickWordCards ? window.pickWordCards(1) : "",
              createdAt: Date.now(),
            };
          return (
            n.push(a),
            g(n),
            I(a.id, { messagesHTML: "", unread: 0, lastMsg: "", lastTime: 0 }),
            a
          );
        },
        updateContact: function (t, e) {
          var n = f(),
            i = n.findIndex(function (e) {
              return e.id === t;
            });
          if (i < 0) return null;
          for (var a in e) e.hasOwnProperty(a) && (n[i][a] = e[a]);
          if (!n[i].note && window.pickWordCards)
            n[i].note = window.pickWordCards(1);
          g(n);
          var o = n[i],
            r = x();
          if (o && (o.isDefault || o.id === r)) {
            if (void 0 !== e.avatar) {
              try {
                localStorage.setItem("akini_ta_avatar", e.avatar);
              } catch (t) {}
              u("ta", e.avatar);
            }
            if (void 0 !== e.name)
              try {
                localStorage.setItem("akini_ta_name", e.name);
              } catch (t) {}
          }
          return (
            Tn(),
            "function" == typeof renderIcityContactSelector &&
              renderIcityContactSelector(),
            "function" == typeof renderIcityContactProfiles &&
              renderIcityContactProfiles(),
            "function" == typeof window._renderIcity && window._renderIcity(),
            "function" == typeof window._renderPosts && window._renderPosts(),
            n[i]
          );
        },
        deleteContact: function (t) {
          var e = f(),
            n = e.filter(function (t) {
              return !t.isDefault;
            });
          if (0 === e.length) return (alert("至少保留一个联系人"), !1);

          // ========== 级联删除：该联系人的所有相关数据 ==========
          try {
            // 1. 聊天历史（含 backup）
            var chatKey = "akini_chat_history_" + t;
            var chatBkKey = "akini_chat_history_backup_" + t;
            if (window.akiniStore && window.akiniStore.remove) {
              window.akiniStore.remove(chatKey);
              window.akiniStore.remove(chatBkKey);
            } else {
              localStorage.removeItem(chatKey);
              localStorage.removeItem(chatBkKey);
              if (window._idbStore && window._idbStore.remove) {
                window._idbStore.remove(chatKey);
                window._idbStore.remove(chatBkKey);
              }
            }

            // 2. 信件：sent 中 toId === t 或 received 中 fromId === t 的记录
            var sent = i("akini_mail_sent", []);
            var received = i("akini_mail_received", []);
            sent = sent.filter(function (m) { return m && m.toId !== t; });
            received = received.filter(function (m) { return m && m.fromId !== t; });
            window.akiniStore && window.akiniStore.setJson
              ? (window.akiniStore.setJson("akini_mail_sent", sent), window.akiniStore.setJson("akini_mail_received", received))
              : (localStorage.setItem("akini_mail_sent", JSON.stringify(sent)), localStorage.setItem("akini_mail_received", JSON.stringify(received)));

            // 3. 朋友圈：删除该联系人发布的动态及该联系人的所有评论
            var posts = O() || [];
            var cname = (v(t) || {}).name || "";
            posts = posts.filter(function (p) { return p && p.authorId !== t && p.contactId !== t; });
            posts.forEach(function (p) {
              if (p.comments && p.comments.length) {
                p.comments = p.comments.filter(function (c) { return c && c.authorId !== t && c.author !== cname; });
              }
            });
            R(posts);

            // 4. iCity：删除该联系人发布的日记及该联系人在所有日记下的评论
            var diaries = q() || [];
            var cname = (v(t) || {}).name || "";
            diaries = diaries.filter(function (d) { return d && d.authorId !== t && d.contactId !== t; });
            diaries.forEach(function (d) {
              if (d.comments && d.comments.length) {
                d.comments = d.comments.filter(function (c) { return c && c.authorId !== t && c.author !== cname; });
              }
            });
            j(diaries);

            // 5. TA 手机收藏
            if (window.akiniStore && window.akiniStore.remove) {
              window.akiniStore.remove("akini_ta_phone_" + t);
            } else {
              localStorage.removeItem("akini_ta_phone_" + t);
            }

            // 6. 商店订单（按 contactId / buyerId / sellerId）
            var orders = i("akini_shop_orders", []);
            orders = orders.filter(function (o) { return o && o.contactId !== t && o.buyerId !== t && o.sellerId !== t; });
            window.akiniStore && window.akiniStore.setJson
              ? window.akiniStore.setJson("akini_shop_orders", orders)
              : localStorage.setItem("akini_shop_orders", JSON.stringify(orders));

            // 7. 聊天置顶
            var pins = i("akini_chat_pins", []);
            pins = pins.filter(function (pid) { return pid !== t; });
            window.akiniStore && window.akiniStore.setJson
              ? window.akiniStore.setJson("akini_chat_pins", pins)
              : localStorage.setItem("akini_chat_pins", JSON.stringify(pins));

            // 8. 表情包（联系人专属）
            if (window.akiniStore && window.akiniStore.remove) {
              window.akiniStore.remove("akini_stickers_" + t);
              window.akiniStore.remove("akini_stickers_" + t + "_backup");
            } else {
              localStorage.removeItem("akini_stickers_" + t);
              localStorage.removeItem("akini_stickers_" + t + "_backup");
            }
          } catch (err) {
            console.warn("[Akini] 删除联系人级联清理出错", err);
          }
          // ========== 级联删除结束 ==========

          g(
            (e = e.filter(function (e) {
              return e.id !== t;
            })),
          );
          var i = k();
          (delete i[t], _(i));
          var a = y();
          (a.forEach(function (e) {
            e.memberIds = (e.memberIds || []).filter(function (e) {
              return e !== t;
            });
          }),
            p(a));
          var o = E();
          return (
            o.right === t && (o.right = (e[0] || {}).id),
            o.left === t && (o.left = "me"),
            S(o.left, o.right),
            !0
          );
        },
        addGroup: function (t, e, n) {
          var i = y(),
            a = {
              id: s("gp"),
              name: t || "群聊",
              avatar: e || "👥",
              memberIds: n || [],
              createdAt: Date.now(),
            };
          return (
            i.push(a),
            p(i),
            I(a.id, { messagesHTML: "", unread: 0, lastMsg: "", lastTime: 0 }),
            a
          );
        },
        updateGroup: function (t, e) {
          var n = y(),
            i = n.findIndex(function (e) {
              return e.id === t;
            });
          if (i < 0) return null;
          for (var a in e) e.hasOwnProperty(a) && (n[i][a] = e[a]);
          return (p(n), n[i]);
        },
        deleteGroup: function (t) {
          p(
            y().filter(function (e) {
              return e.id !== t;
            }),
          );
          var e = k();
          (delete e[t], _(e));
        },
        migrateContacts: function () {
          if ("1" !== localStorage.getItem(r)) {
            var t = f().filter(function (e) {
              return "ta_default" !== e.id;
            });
            t.forEach(function (e) {
              if (!e.note && window.pickWordCards)
                e.note = window.pickWordCards(1);
            });
            (g(t), localStorage.setItem(r, "1"));
          }
        },
        tryRestoreFromBackup: function (a) {
          var o,
            r = i(t, []),
            c = i(e, []),
            s = i(n, {}),
            d = !1,
            u = 0;
          function m() {
            a && a(d);
          }
          function f() {
            0 === u && m();
          }
          function mergeSessions(cur, idb) {
            var merged = {};
            for (var k in cur) cur.hasOwnProperty(k) && (merged[k] = cur[k]);
            for (var k in idb)
              if (idb.hasOwnProperty(k)) {
                if (!merged[k]) merged[k] = idb[k];
                else {
                  // 同一会话：聊天记录取更长的一方，其他元数据保留较新
                  var cH = (merged[k].messagesHTML || "").length;
                  var iH = (idb[k].messagesHTML || "").length;
                  if (iH > cH) {
                    var longer = idb[k].messagesHTML;
                    var newer = (idb[k].lastTime || 0) >= (merged[k].lastTime || 0) ? idb[k] : merged[k];
                    merged[k] = newer;
                    merged[k].messagesHTML = longer;
                  }
                }
              }
            return merged;
          }
          function restoreSessions() {
            u++;
            l(n, function (t) {
              if (t && "object" == typeof t && Object.keys(t).length > 0) {
                // 合并基线必须用 k()（内存权威缓存）而不是恢复时读到的 localStorage 陈旧副本 s
                var baseline = k();
                var merged = mergeSessions(baseline, t);
                // sessions 已分离存储 messagesHTML：逐会话从 IDB 的 akini_chat_history_* 兜底找回聊天记录
                var pending = 0, done = !1;
                function finish() {
                  if (done) return; done = !0;
                  JSON.stringify(merged) !== JSON.stringify(baseline) && (_(merged), (d = !0));
                  u--;
                  f();
                }
                var sids = Object.keys(merged);
                if (!sids.length) { finish(); return; }
                pending = sids.length;
                sids.forEach(function (sid) {
                  if ((merged[sid].messagesHTML || "").trim()) { if (--pending === 0) finish(); return; }
                  l("akini_chat_history_" + sid, function (v) {
                    if (v && "string" == typeof v && v.trim()) {
                      merged[sid].messagesHTML = v;
                      E[sid] = v;
                    }
                    if (--pending === 0) finish();
                  });
                });
              } else {
                u--;
                f();
              }
            });
          }
          function restoreAvatars() {
            var avatarKeys = [
              "akini_my_avatar",
              "akini_ta_avatar",
              "akini_icity_my_avatar",
              "akini_icity_ta_avatar",
            ];
            avatarKeys.forEach(function (k) {
              u++;
              l(k, function (v) {
                if (
                  v &&
                  "string" == typeof v &&
                  v.trim() &&
                  v !== "null" &&
                  v !== "undefined"
                ) {
                  try {
                    var cur = localStorage.getItem(k) || "";
                    if (!cur || cur === "null" || cur === "undefined") {
                      localStorage.setItem(k, v);
                      d = !0;
                    }
                  } catch (e) {}
                }
                u--;
                f();
              });
            });
          }
          (u++,
            l(t, function (idbC) {
              // 始终合并本地与 IDB 联系人（按 id 取并集），任何一方存在的联系人都不会丢失
              if (Array.isArray(idbC) && idbC.length > 0) {
                var byId = {};
                (Array.isArray(r) ? r : []).forEach(function (c) {
                  c && c.id && (byId[c.id] = c);
                });
                var changed = !1;
                idbC.forEach(function (c) {
                  c && c.id && !byId[c.id] && ((byId[c.id] = c), (changed = !0));
                });
                if (changed) {
                  var merged = Object.keys(byId).map(function (k) {
                    return byId[k];
                  });
                  g(merged);
                  d = !0;
                }
              }
              u--;
              f();
            }),
            (Array.isArray(c) && 0 !== c.length) ||
              (u++,
              l(e, function (t) {
                (t && t.length > 0 && (p(t), (d = !0)), u--, f());
              })),
            restoreSessions(),
            restoreAvatars(),
            0 === u && m());
        },
        backupToIDB: c,
        restoreFromIDB: l,
      };
    })();
    try {
      // 恢复期间禁止写入空联系人，防止异步恢复完成前空数组覆盖 localStorage
      if (!window._restoringData) {
        window.akiniContacts.migrateContacts();
        var __contacts = window.akiniContacts.getContacts();
        __contacts.forEach(function (e) {
          if (e && !e.note && window.pickWordCards)
            e.note = window.pickWordCards(1);
        });
        window.akiniContacts.saveContacts(__contacts);
      }
    } catch (e) {
      console.error("[Akini] contact note init error", e);
    }
    window.akiniContacts.tryRestoreFromBackup(function (restored) {
      console.log("[Akini] contacts/chat restore from backup", restored);
      // 头像可能已从 IDB 恢复，立即刷新所有 DOM 头像
      if (restored || window.__akiniAvatarCache) {
        try {
          "function" == typeof et && et();
        } catch (e) {}
        try {
          "function" == typeof Tn && Tn();
        } catch (e) {}
      }
    });
    requestAnimationFrame(function t() {
      var e = document.getElementById("dayNumber");
      if (e) {
        var n = localStorage.getItem("akini_start_date"),
          i = 0;
        (n &&
          (i = Math.floor((new Date() - new Date(n)) / 864e5)) < 0 &&
          (i = 0),
          (e.innerText = i));
        var a = document.getElementById("dayUnit");
        a && (a.style.display = "none");
      } else requestAnimationFrame(t);
    });
    function akiniClickFallback(t) {
      var e = t.target;
      if (
        (e.closest("#settingsBtn") ||
          e.closest("#beautifyBtn") ||
          e.closest("#wordBtn")) &&
        (e = e.closest("button"))
      ) {
        var i = e.id;
        "settingsBtn" === i
          ? showArea("settingsArea")
          : "beautifyBtn" === i
            ? showArea("beautifyArea")
            : "wordBtn" === i &&
              (showArea("wordbankOverlay"),
              "function" == typeof renderWordbank &&
                requestAnimationFrame(function () {
                  renderWordbank();
                }));
      }
    }
    document.addEventListener("click", akiniClickFallback, !0);
    ((window.showPage = o),
      (window.showPage = o),
      (window.showArea = r),
      (window.openAppPage = function (t, e) {
        e && e.stopPropagation && e.stopPropagation();
        try {
          if ("icity" === t) {
            r("icityArea");
            return;
          }
          if ("music" === t) {
            try {
              if (window._showMusicContactPicker) {
                window._showMusicContactPicker();
                return;
              }
              var _am = document.getElementById("app-music");
              if (_am) {
                _am.style.display = "flex";
                _am.classList.add("show");
              }
              var _menu = document.getElementById("musicMenuOverlay");
              if (_menu) {
                _menu.style.display = "block";
                _menu.classList.add("show");
              }
              if (window._startNeteaseQr) {
                window._startNeteaseQr();
              }
            } catch (mErr) {
              console.error("[music] 打开失败", mErr);
            }
            return;
          }
          if ("survey" === t) {
            try {
              if (window._openSurveyList) {
                window._openSurveyList();
              }
            } catch (sErr) {
              console.error("[survey] 打开失败", sErr);
            }
            return;
          }
          r(null);
          o(t);
          "mail" === t &&
            "function" == typeof window.__renderMail &&
            window.__renderMail();
        } catch (err) {
          console.error("[openAppPage] error", err);
        }
      }));
    var c = document.getElementById("settingsBtn"),
      l = document.getElementById("beautifyBtn"),
      s = document.getElementById("wordBtn");
    function d(t) {
      return "";
    }
    function __akiniFormatMsgTime(t) {
      const e = new Date(t || Date.now()),
        n = String(e.getHours()).padStart(2, "0"),
        i = String(e.getMinutes()).padStart(2, "0");
      return n + ":" + i;
    }
    function __akiniToggleOn(id) {
      return localStorage.getItem("akini_toggle_" + id) === "1";
    }
    function __akiniProcessMsgMeta(row) {
      if (!row || row.nodeType !== 1) return;
      if (!row.classList.contains("msg-row")) return;
      if (row.classList.contains("timestamp-row")) return;
      if (row.id && row.id.indexOf("typingBubbleRow_") === 0) return;
      if (row.querySelector(".msg-meta")) return;
      var isMe = row.classList.contains("me");
      var isOther = row.classList.contains("other");
      var isSystem = row.classList.contains("system");
      if (isSystem) return; // 系统消息不显示时间戳和已读回执
      if (!isMe && !isOther) return;
      // 时间戳每条消息都显示；已读回执仅用户消息且每条都显示
      var showTs = __akiniToggleOn("timestampToggle");
      var showRr = isMe && __akiniToggleOn("readReceiptToggle");
      if (!showTs && !showRr) return;
      var ts = row.getAttribute("data-ts");
      if (!ts) {
        ts = Date.now();
        row.setAttribute("data-ts", ts);
      }
      // 先显示时间戳（保持立即显示），已读回执延迟显示
      if (showTs) {
        var meta = document.createElement("div");
        meta.className = "msg-meta";
        meta.style.cssText = isMe
          ? "display:flex;justify-content:flex-end;padding-right:46px;margin-top:2px;"
          : "display:flex;justify-content:flex-start;padding-left:46px;margin-top:2px;";
        meta.innerHTML = '<span style="font-size:10px;color:#aaa;">' + __akiniFormatMsgTime(parseInt(ts, 10)) + '</span>';
        row.appendChild(meta);
      }
      // 已读回执：发出去不立即显示，延迟 1.5~4s
      if (showRr) {
        row.setAttribute("data-read-pending", "1");
        (function(__r) {
          var readDelay = 1500 + Math.random() * 2500;
          setTimeout(function() {
            __akiniShowReadReceipt(__r);
          }, readDelay);
        })(row);
      }
    }
    function __akiniShowReadReceipt(row) {
      if (!row) return;
      if (!row.classList.contains("me")) return;
      row.removeAttribute("data-read-pending");
      var meta = row.querySelector(".msg-meta");
      if (meta) {
        var span = meta.querySelector("span");
        if (span) {
          if ((span.textContent || "").indexOf("已读") >= 0) return;
          span.textContent = (span.textContent ? span.textContent + "   " : "") + "已读";
        }
      } else {
        var newMeta = document.createElement("div");
        newMeta.className = "msg-meta";
        newMeta.style.cssText = "display:flex;justify-content:flex-end;padding-right:46px;margin-top:2px;";
        newMeta.innerHTML = '<span style="font-size:10px;color:#aaa;">已读</span>';
        row.appendChild(newMeta);
      }
    }
    function __akiniInsertTimestampSeparators() {
      var chatBody = document.getElementById("chatBody");
      if (!chatBody) return;
      // 用户反馈聊天中灰色时间戳分隔行像系统消息，直接移除所有时间戳分隔行
      chatBody.querySelectorAll(".timestamp-row").forEach(function (row) {
        row.remove();
      });
    }
    function __akiniSetupChatMetaObserver() {
      var chatBody = document.getElementById("chatBody");
      if (!chatBody) return;
      Array.from(chatBody.children).forEach(__akiniProcessMsgMeta);
      __akiniInsertTimestampSeparators();
      if (!chatBody.__akiniMetaObserver) {
        var obs = new MutationObserver(function (mutations) {
          mutations.forEach(function (m) {
            Array.from(m.addedNodes).forEach(function (node) {
              if (node.nodeType === 1 && node.classList && node.classList.contains("msg-row") && !node.classList.contains("timestamp-row")) {
                __akiniProcessMsgMeta(node);
                __akiniInsertTimestampSeparators();
              }
            });
          });
        });
        obs.observe(chatBody, { childList: true });
        chatBody.__akiniMetaObserver = obs;
      }
      if (!chatBody.__akiniMetaInterval) {
        chatBody.__akiniMetaInterval = setInterval(function () {
          var cb = document.getElementById("chatBody");
          if (cb) Array.from(cb.children).forEach(__akiniProcessMsgMeta);
        }, 1500);
      }
    }
    function __akiniMarkLastRead(t) {
      __akiniSetupChatMetaObserver();
    }
    window.__akiniRefreshChatMeta = function () {
      var chatBody = document.getElementById("chatBody");
      if (!chatBody) return;
      chatBody.querySelectorAll(".msg-meta").forEach(function (meta) {
        meta.remove();
      });
      chatBody.querySelectorAll(".timestamp-row").forEach(function (row) {
        row.remove();
      });
      Array.from(chatBody.children).forEach(__akiniProcessMsgMeta);
      __akiniInsertTimestampSeparators();
      __akiniSetupChatMetaObserver();
    };
    function u(t, e) {
      e &&
        "string" == typeof e &&
        ("my" === t && (window.__akiniAvatarCache.my = e),
        "ta" === t && (window.__akiniAvatarCache.ta = e));
    }
    function m(t, e, n) {
      _idbStore.get(e, function (i) {
        if (
          i &&
          "string" == typeof i &&
          i.trim() &&
          "null" !== i.trim() &&
          "undefined" !== i.trim()
        ) {
          /* 仅当 localStorage 无有效值时，才用 idb 回填，避免覆盖刚上传的新头像 */
          var lsVal = "";
          try {
            lsVal = localStorage.getItem(e) || "";
          } catch (t) {}
          var lsValid =
            lsVal &&
            "string" == typeof lsVal &&
            lsVal.trim() &&
            "null" !== lsVal.trim() &&
            "undefined" !== lsVal.trim();
          if (!lsValid) {
            u(t, i);
            try {
              localStorage.setItem(e, i);
            } catch (t) {}
            if (n)
              try {
                localStorage.setItem(n, i);
              } catch (t) {}
            if (window.__akiniSyncingAvatars) {
              window.__akiniAvatarNeedsRefresh = !0;
            } else {
              Tn();
            }
          } else {
            /* localStorage 已有有效值，仅同步缓存，不覆盖 */
            u(t, lsVal);
          }
        }
      });
    }
    function f() {
      var n =
        localStorage.getItem("akini_my_avatar") ||
        localStorage.getItem("akini_icity_my_avatar");
      if (n) {
        window.__akiniAvatarCache.my = n;
        return it(n, "🐱") === "🐱" ? "🐱" : it(n, "🐱");
      }
      const t = window.__akiniAvatarCache.my;
      if (t) {
        const av = it(t, "🐱");
        return av === "🐱" ? "🐱" : av;
      }
      const e = document.getElementById("myMsgAvatar");
      if (e && e.innerHTML) {
        const av = it(e.innerHTML, "🐱");
        return av === "🐱" ? "🐱" : av;
      }
      return (m("my", "akini_my_avatar", "akini_icity_my_avatar"), "🐱");
    }
    function g() {
      return localStorage.getItem("akini_my_name") || "我";
    }
    window.getMyName = g;
    function y(id) {
      if (window.akiniContacts) {
        var _aid = id || window.akiniContacts.getActiveChatId();
        var ct = window.akiniContacts.getChatTarget(_aid);
        if (ct) {
          if (ct.avatar && ct.avatar.trim()) {
            window.__akiniAvatarCache.ta = ct.avatar;
            return it(ct.avatar, "🐰");
          }
          // 联系人对象无头像时，回退到本地保存的对方头像，避免直接显示 emoji 兜底
          var _lsTa =
            localStorage.getItem("akini_ta_avatar") ||
            localStorage.getItem("akini_icity_ta_avatar");
          if (_lsTa) {
            window.__akiniAvatarCache.ta = _lsTa;
            return it(_lsTa, "🐰");
          }
          // 无头像时用成员自身的 emoji/名字首字作为兜底，避免显示群头像
          var _fb =
            (ct.emoji && String(ct.emoji).trim()) ||
            (ct.name ? String(ct.name).charAt(0) : "🐰");
          return nt(_fb, 38);
        }
      }
      var n =
        localStorage.getItem("akini_ta_avatar") ||
        localStorage.getItem("akini_icity_ta_avatar");
      if (n) {
        window.__akiniAvatarCache.ta = n;
        return it(n, "🐰");
      }
      const t = window.__akiniAvatarCache.ta;
      if (t) return it(t, "🐰");
      const e = document.getElementById("taMsgAvatar");
      if (e && e.innerHTML) return it(e.innerHTML, "🐰");
      return (m("ta", "akini_ta_avatar", "akini_icity_ta_avatar"), "🐰");
    }
    function p() {
      const t = document.getElementById("chatTaName");
      if (t && (t.innerText || t.textContent))
        return t.innerText || t.textContent;
      if (window.akiniContacts) {
        var e = window.akiniContacts.getChatTarget(
          window.akiniContacts.getActiveChatId(),
        );
        if (e) return e.name;
      }
      return localStorage.getItem("akini_ta_name") || "对方";
    } /* bottom-btn 使用 inline onclick，移除 a 绑定 */
    ((window.__akiniAvatarCache = window.__akiniAvatarCache || {
      my: "",
      ta: "",
    }),
      (window.getMyAvatar = f),
      (window.getMyName = g),
      (window.getTaAvatar = y));
    var v = 0;
    function h() {
      v = Date.now();
    }
    function w(t, a, o) {
      h();
      try {
        if (((o = o || {}), !window.akiniContacts)) return;
        var r = window.akiniContacts.getChatTarget(t),
          c = window.akiniContacts.getChatTarget(a);
        if (!r || !c) return;
        var l = t === window.akiniContacts.getActiveChatId(),
          s = "group" === r.type,
          u = (function () {
            var _av = c.avatar && String(c.avatar).trim();
            if (_av) return nt(_av, 38);
            var _fb =
              (c.emoji && String(c.emoji).trim()) ||
              (c.name ? String(c.name).charAt(0) : "👤");
            return nt(_fb, 38);
          })(),
          m = getContactStickersSync(c.id),
          f = i("akini_wordbank", []).filter(function (t) {
            return !t.tab || "main" === t.tab;
          });
        if (0 === f.length && !o.forceText) return;
        var y = "msg-row other" + (s ? " group" : ""),
          p = document.createElement("div");
        p.className = y;
        var v = "",
          h = !1,
          w = o.forceMentions || [],
          k = null,
          _ = o.quoteText || "",
          b = o.quoteName || "";
        if (!_ && l && !s && Math.random() < window.AKR.getProb("quote")) {
          var I = getMyLatestMessageText();
          I && ((_ = I), (b = g() || "我"));
        }
        var B = "";
        if (
          (l || !s) &&
          (s
            ? Math.random() < window.AKR.getProb("groupTransferMe")
            : Math.random() < window.AKR.getProb("taTransfer"))
        ) {
          var M = e(),
            L = n(),
            D = null;
          if (s) {
            var N = (r.memberIds || []).filter(function (t) {
              return t !== c.id;
            });
            D =
              N.length > 0 && Math.random() < 0.15
                ? N[Math.floor(Math.random() * N.length)]
                : "me";
          }
          if (l && U)
            (an("ta", M, L, c.name, s ? D : null),
              (v = "【转账】" + L),
              window.akiniContacts.updateSession(t, {
                lastMsg: v,
                lastTime: Date.now(),
                lastSenderAvatar: c.avatar,
                lastSenderName: c.name,
              }));
          else {
            var P = s
                ? '<div class="msg-bubble-wrap"><div class="msg-sender-name">' +
                  rt(c.name) +
                  '</div><div class="msg-bubble-row">'
                : "",
              H = s ? "</div></div>" : "",
              z =
                "tr_" + Date.now() + "_" + Math.random().toString(36).slice(2),
              O =
                '<div class="' +
                y +
                '"><div class="msg-content-line">' +
                P +
                '<div class="msg-avatar" data-sender-name="' +
                rt(c.name) +
                '">' +
                u +
                '</div><div class="bubble transfer-bubble ta-tr" id="' +
                z +
                '_bubble" data-tr-uid="' +
                z +
                '" data-tr-who="ta" data-tr-amount="' +
                M +
                '" data-tr-note="' +
                rt(L) +
                '" data-tr-recipient="' +
                rt(D || "") +
                '" onclick="(function(el){ if(typeof window._openTransferDetailFromBubble===&#39;function&#39;) window._openTransferDetailFromBubble(el.dataset.trUid); })(this)"><div style="font-size:20px;font-weight:700;">¥' +
                M +
                '</div><div style="font-size:12px;opacity:0.8;margin-top:2px;">' +
                L +
                '</div><div style="height:1px;background:rgba(255,255,255,0.25);margin:6px 0 4px;"></div><div style="display:flex;justify-content:flex-end;"><span class="tr-status" id="' +
                z +
                '_status">待收款</span></div></div>' +
                H +
                "</div></div>",
              R =
                ((G = window.akiniContacts.getSession(t)).messagesHTML || "") +
                O;
            (window.akiniContacts.updateSession(t, {
              messagesHTML: R,
              lastMsg: "转账：" + L,
              lastTime: Date.now(),
              unread: (G.unread || 0) + 1,
              lastSenderAvatar: c.avatar,
              lastSenderName: c.name,
            }),
              C(t, R));
          }
          return (V(), { mentionSender: k });
        }
        var cc =
          o.cardCount || (window.AKR && window.AKR.getCardCount)
            ? window.AKR.getCardCount(s ? "group" : "private")
            : 1;
        cc = Math.max(1, Math.min(20, parseInt(cc, 10) || 1));
        var msgArr = [];
        if (Math.random() < window.AKR.getProb("sticker") && m.length > 0) {
          msgArr.push({
            html:
              '<img src="' +
              m[Math.floor(Math.random() * m.length)] +
              '" style="max-width:120px;max-height:120px;border-radius:8px;display:block;">',
            text: "【表情包】",
          });
          cc = Math.max(1, cc - 1);
        }
        for (var ci = 0; ci < cc; ci++) {
          var q = o.forceText
              ? o.forceText
              : f[Math.floor(Math.random() * f.length)],
            j = "string" == typeof q ? q : q.text || q.content || "";
          if (!j) continue;
          msgArr.push({ html: rt(j), text: B + j });
        }
        if (0 === msgArr.length) return;
        var $ = "";
        if (_ && Math.random() < window.AKR.getProb("quote")) {
          var W = b || "我",
            J = _.slice(0, 40) + (_.length > 40 ? "…" : "");
          $ =
            '<div class="quote-bubble" style="background:#fff!important;color:#333!important;border:none!important;border-radius:10px!important;padding:4px 10px!important;font-size:11px!important;max-width:70%!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;box-shadow:0 1px 3px rgba(0,0,0,.1)!important;margin-top:3px!important;display:inline-block!important;">' +
            rt(W) +
            "：" +
            rt(J) +
            "</div>";
        }
        ((P = s
          ? '<div class="msg-bubble-wrap"><div class="msg-sender-name">' +
            rt(c.name) +
            '</div><div class="msg-bubble-row">'
          : ""),
          (H = s ? "</div></div>" : ""));
        ((p.innerHTML =
          '<div class="msg-content-line">' +
          P +
          '<div class="msg-avatar" data-sender-name="' +
          rt(c.name) +
          '">' +
          u +
          '</div><div class="bubble">' +
          msgArr
            .map(function (x) {
              return x.html;
            })
            .join(
              '<div style="height:1px;background:rgba(255,255,255,0.15);margin:4px 0;"></div>',
            ) +
          "</div>" +
          ($
            ? '<div style="flex-basis:100%;width:100%;padding-left:44px;box-sizing:border-box;margin-top:2px;">' +
              $ +
              "</div>"
            : "") +
          H +
          "</div>" +
          ""),
          (v = msgArr
            .map(function (x) {
              return x.text;
            })
            .join(" ")),
          Math.random() < window.AKR.getProb("noReply") && (h = !0));
        if (l && U)
          (__akiniAppendMessageHTML(t, p.outerHTML, {
              lastMsg: v,
              lastSenderAvatar: c.avatar,
              lastSenderName: c.name,
            }),
            S(),
            (U.scrollTop = U.scrollHeight));
        else {
          R =
            ((G = window.akiniContacts.getSession(t)).messagesHTML || "") +
            p.outerHTML;
          var G,
            K = (G.unread || 0) + 1;
          (window.akiniContacts.updateSession(t, {
            messagesHTML: R,
            lastMsg: v.replace(/^【转账】/, "转账："),
            lastTime: Date.now(),
            unread: K,
            lastSenderAvatar: c.avatar,
            lastSenderName: c.name,
          }),
            C(t, R));
        }
        if ((V(), "function" == typeof window.showInAppNotif)) {
          var X = {
            app: "微信",
            appIcon: "💬",
            avatar: u,
            name: c.name,
            fullContent: !0,
            msg: v,
            chatId: t,
            onTap: function () {
              ct(t);
            },
          };
          (s && (X.groupName = r.name), window.showInAppNotif(X));
        }
        return { mentionSender: k };
      } catch (t) {
        return (console.error("simulateMemberReply error:", t), null);
      }
    }
    function k() {
      if (!K || !U || !window.akiniContacts) return;
      const t = K.value.trim();
      if ("" === t) return;
      h();
      const n = !!zt && zt.classList.contains("show"),
        i = K.getAttribute("data-quote") || "";
      let a = "";
      (n &&
        i &&
        (a =
          '<div class="quote-bubble" style="background:#fff!important;color:#333!important;border:none!important;border-radius:10px!important;padding:4px 10px!important;font-size:11px!important;max-width:70%!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;box-shadow:0 1px 3px rgba(0,0,0,.1)!important;margin-top:3px!important;display:inline-block!important;">' +
          i +
          "</div>"),
        K.removeAttribute("data-quote"),
        (K.placeholder = "输入消息..."),
        zt && zt.classList.remove("show"));
      const o = document.createElement("div");
      ((o.className = "msg-row me"),
        (o.innerHTML =
          '<div class="msg-content-line"><div class="bubble">' +
          t +
          '</div><div class="msg-avatar">' +
          f() +
          "</div></div>" +
          (a
            ? '<div style="flex-basis:100%;width:100%;padding-right:44px;box-sizing:border-box;margin-top:2px;text-align:right">' +
              a +
              "</div>"
            : "") +
          d("right")));
      var r = window.akiniContacts.getActiveChatId(),
        c = window.akiniContacts.getChatTarget(r);
      (__akiniAppendMessageHTML(r, o.outerHTML, {
        lastMsg: t,
        lastSenderAvatar: f() || "👤",
        lastSenderName: g() || "我",
      }),
        S(),
        V(),
        (K.value = ""));
      // TA的手机：按概率自动收藏用户发送的聊天消息
      try { if (window.akiniTaPhoneCollectChat && r) window.akiniTaPhoneCollectChat(r, t, Date.now()); } catch (e) {}
      const __bh = _();
      if ("none" === __bh.type) return;
      const l = document.getElementById("typingIndicator");
      const __sendTarget = window.akiniContacts.getChatTarget(r);
      const s = parseFloat(
          localStorage.getItem("akini_num_replyDelayMin") || "2",
        ),
        u = parseFloat(localStorage.getItem("akini_num_replyDelayMax") || "5"),
        m = 1e3 * s,
        y = 1e3 * u,
        p = m + Math.random() * Math.max(0, y - m),
        v = i,
        k = t,
        b = v ? v + " " + t : t;
      // 输入状态：用户发送后立即显示（milk-main 逻辑），且用户发送不打断联系人输入动画
      (function() {
        if (l) l.style.display = "block";
        showTypingBubble(
          r,
          "group" === (__sendTarget && __sendTarget.type)
            ? (__sendTarget.memberIds || [])[0]
            : null,
        );
      })();
      var x =
          c && "group" === c.type
            ? (function (t) {
                for (
                  var e, n = [], i = /@([^\s@]+(?:\s[^\s@]+)?)/g;
                  null !== (e = i.exec(t));
                ) {
                  var a = e[1].trim();
                  a && n.push(a);
                }
                return n;
              })(b)
            : [],
        E = x.some(function (t) {
          return "全体成员" === t || "all" === t;
        });
      setTimeout(function () {
        try {
          console.log("[sendMsg] setTimeout fired, calling I");
          var __dbg = null;
          if (__dbg) {
            __dbg.style.display = "block";
            __dbg.textContent = "准备回复…";
          }
          r === window.akiniContacts.getActiveChatId() &&
            (l && (l.style.display = "none"),
            h());
          var t = c;
          if (!t) {
            if (__dbg) __dbg.textContent = "t 为空，无法回复";
            return;
          }
          if ("group" === t.type) {
            var e = t.memberIds || [];
            if (0 === e.length) return;
            var n = [];
            E
              ? (n = e.slice())
              : x.length > 0
                ? (e.forEach(function (t) {
                    var e = window.akiniContacts.getChatTarget(t);
                    e && x.indexOf(e.name) >= 0 && n.push(t);
                  }),
                  0 === n.length && (n = e.slice()))
                : (n = e.slice());
            var i = g() || "我",
              a = v ? i : "",
              o = v || k || "";
            return void n.forEach(function (e, n) {
              var i = 3e3 * Math.random() + 1500 * n;
              setTimeout(function () {
                var n = w(t.id, e, { quoteText: o, quoteName: a, isGroup: !0 });
                false && n &&
                  n.mentionSender &&
                  "me" !== n.mentionSender &&
                  setTimeout(
                    function () {
                      w(t.id, n.mentionSender, { isGroup: !0 });
                    },
                    1500 + 2e3 * Math.random(),
                  );
              }, i);
            });
          }
          window.I(t.id, t, __bh);
        } catch (t) {
          console.error("sendMsg reply error:", t);
          try {
            var __dbg = null;
            if (__dbg) {
              __dbg.style.display = "block";
              __dbg.textContent = "回复出错: " + ((t && t.message) || t);
            }
          } catch (e) {}
        }
      }, p);
    }
    function _() {
      return window.AKR ? window.AKR.pickReplyBehavior() : { type: "text" };
    }
    function showTypingBubble(t, memberId) {
      var chatBody = document.getElementById("chatBody");
      if (!chatBody) return;
      window.__akiniTypingMap = window.__akiniTypingMap || {};
      var existing = document.getElementById("typingBubbleRow_" + t);
      if (existing) {
        // 已有则移到最底部，确保始终在所有消息下方
        if (t === window.akiniContacts.getActiveChatId()) {
          chatBody.appendChild(existing);
          chatBody.scrollTop = chatBody.scrollHeight;
        }
        return;
      }
      var target =
        window.akiniContacts && window.akiniContacts.getChatTarget(t);
      var avatar = "🐰";
      if (memberId && window.akiniContacts) {
        var member = window.akiniContacts.getContactById(memberId);
        if (member) avatar = nt(member.avatar, 38);
      } else if (target) avatar = nt(target.avatar, 38);
      var row = document.createElement("div");
      row.id = "typingBubbleRow_" + t;
      row.className = "msg-row other";
      row.innerHTML =
        "<div class=msg-content-line><div class=msg-avatar>" +
        avatar +
        '</div><div class="bubble typing-bubble"><div class=typing-dot></div><div class=typing-dot></div><div class=typing-dot></div></div></div>';
      window.__akiniTypingMap[t] = { row: row, timer: null };
      window.__akiniTypingMap[t].timer = setTimeout(function () {
        hideTypingBubble(t);
      }, 6e4);
      if (t === window.akiniContacts.getActiveChatId()) {
        chatBody.appendChild(row);
        chatBody.scrollTop = chatBody.scrollHeight;
      }
    }
    function hideTypingBubble(t) {
      if (t) {
        var m = window.__akiniTypingMap && window.__akiniTypingMap[t];
        if (m) {
          m.timer && clearTimeout(m.timer);
          m.row && m.row.remove();
          delete window.__akiniTypingMap[t];
        }
        return;
      }
      var chatBody = document.getElementById("chatBody");
      if (chatBody) {
        var rows = chatBody.querySelectorAll('[id^="typingBubbleRow_"]');
        for (var i = 0; i < rows.length; i++) rows[i].remove();
      }
      window.__akiniTypingMap = window.__akiniTypingMap || {};
      for (var k in window.__akiniTypingMap) {
        var m = window.__akiniTypingMap[k];
        m.timer && clearTimeout(m.timer);
      }
      window.__akiniTypingMap = {};
    }
    function b(t) {
      if (we && we.active) return;
      if (!window.akiniContacts) return;
      t = t || window.akiniContacts.getActiveChatId();
      const e = window.akiniContacts.getChatTarget(t);
      if (!e) return;
      const n = _();
      if ("none" === n.type) {
        if (t) {
          var __s = window.akiniContacts.getSession(t);
          __s && window.akiniContacts.updateSession(t, { unread: 0 });
        }
        try {
          var __rrt = document.getElementById("readReceiptToggle");
          if (
            (!__rrt || __rrt.classList.contains("on")) &&
            window.__akiniMarkLastRead
          )
            window.__akiniMarkLastRead(t);
        } catch (e) {}
        return;
      }
      n.cardCount =
        window.AKR && window.AKR.getCardCount
          ? window.AKR.getCardCount(e.type === "group" ? "group" : "private")
          : 1;
      const a = t === window.akiniContacts.getActiveChatId();
      a &&
        showTypingBubble(t, "group" === e.type ? (e.memberIds || [])[0] : null);
      const o = parseFloat(
          localStorage.getItem("akini_num_replyDelayMin") || "2",
        ),
        r = parseFloat(localStorage.getItem("akini_num_replyDelayMax") || "5"),
        c = 1e3 * o,
        l = 1e3 * r,
        s = c + Math.random() * Math.max(0, l - c);
      function replyAction() {
        if (!window.AKR.isInTimeRange("reply")) {
          hideTypingBubble(t);
          return;
        }
        if ("group" !== e.type) I(t, e, n);
        else {
          var o = (e.memberIds || []).slice();
          if (0 === o.length) return;
          o.forEach(function (e, a) {
            setTimeout(
              function () {
                w(t, e, { isGroup: !0, cardCount: n.cardCount });
              },
              1500 * a + 2e3 * Math.random(),
            );
          });
        }
      }
      window._akiniReplyAction = function () {
        b(t);
      };
      window._akiniTimer.schedule("reply", replyAction, s);
    }
    (function () {
      var actions = {
        activeMsg: function () {
          window._akiniActiveMsgAction && window._akiniActiveMsgAction();
        },
        friendsPost: function () {
          window._akiniFriendsPostAction && window._akiniFriendsPostAction();
        },
        friendsInteract: function () {
          window._akiniFriendsInteractAction &&
            window._akiniFriendsInteractAction();
        },
        mail: function () {
          window._akiniMailAction && window._akiniMailAction();
        },
        icityPost: function () {
          window._akiniIcityPostAction && window._akiniIcityPostAction();
        },
        reply: function () {
          window._akiniReplyAction && window._akiniReplyAction();
        },
      };
      document.addEventListener("visibilitychange", function () {
        if (!document.hidden && window._akiniTimer) {
          window._akiniTimer.catchUp(actions);
        }
      });
      window.addEventListener("pageshow", function (e) {
        if (e.persisted && window._akiniTimer) {
          window._akiniTimer.catchUp(actions);
        }
      });
      /* 首次加载也补一次，处理应用关闭期间错过的定时任务 */
      setTimeout(function () {
        try {
          window._akiniTimer && window._akiniTimer.catchUp(actions);
        } catch (e) {}
      }, 3000);
      /* 后台/低功耗设备可能丢定时器，周期性 catch-up 确保任务不遗漏 */
      setInterval(function () {
        try {
          window._akiniTimer && window._akiniTimer.catchUp(actions);
        } catch (e) {}
      }, 15000);
    })();
    window._akiniTransferAmount = e;
    window._akiniTransferNote = n;
    window.__akiniForceReply = function () {
      try {
        if (typeof b === "function") {
          b(
            window.akiniContacts
              ? window.akiniContacts.getActiveChatId()
              : null,
          );
        } else {
          console.log("[Akini] b() not found for force reply");
        }
      } catch (e) {
        console.error("[Akini] force reply error:", e);
        try {
          var _ac =
            window.akiniContacts && window.akiniContacts.getActiveChatId();
          if (_ac) {
            var _e = window.akiniContacts.getChatTarget(_ac);
            if (_e) {
              var _n = { type: "text", cardCount: 1, extra: {} };
              if (typeof I === "function") {
                I(_ac, _e, _n);
              }
            }
          }
        } catch (e2) {
          console.error("[Akini] fallback reply error:", e2);
        }
      }
    };
    function I(t, e, n) {
      n = n || _();
      console.log("[I] type:", n.type, "extra:", JSON.stringify(n.extra || {}));
      var __dbg = null;
      if (__dbg) {
        __dbg.style.display = "block";
        __dbg.textContent =
          "回复中… type=" + n.type + " extra=" + JSON.stringify(n.extra || {});
      }
      if ("1" !== localStorage.getItem("akini_toggle_contactReplyToggle")) {
        console.log("[I] contactReplyToggle off, skip reply");
        return;
      }
      if ("none" === n.type) {
        if (__dbg) {
          __dbg.textContent = "已读不回，不回复";
        }
        return;
      }
      if ((e || (e = window.akiniContacts.getChatTarget(t)), !e)) return;
      const i = (
          window._akiniAv ||
          (window._akiniAv = function (v, s) {
            s = s || 38;
            var x = v && String(v).trim();
            if (x) return nt(x, s);
            try {
              var ls = localStorage.getItem("akini_ta_avatar");
              if (ls && ls.trim()) return nt(ls, s);
            } catch (e) {}
            var cc = window.__akiniAvatarCache && window.__akiniAvatarCache.ta;
            if (cc) return nt(cc, s);
            return nt("", s);
          })
        )(e.avatar, 38),
        a = t === window.akiniContacts.getActiveChatId(),
        o = localStorage.getItem("akini_my_name") || "我",
        r = "contact" === e.type ? e.id : null;
      var ex = n.extra || {};
      function doTransfer() {
        h();
        var tM = window._akiniTransferAmount(),
          tL = window._akiniTransferNote();
        if (a && U)
          (an("ta", tM, tL, e.name, null),
            window.akiniContacts.updateSession(t, {
              lastMsg: "【转账】" + tL,
              lastTime: Date.now(),
              lastSenderAvatar: e.avatar,
              lastSenderName: e.name,
            }));
        else {
          var tz =
              "tr_" + Date.now() + "_" + Math.random().toString(36).slice(2),
            tO =
              '<div class="msg-row other"><div class="msg-content-line"><div class="msg-avatar" data-sender-name="' +
              rt(e.name) +
              '">' +
              i +
              '</div><div class="bubble transfer-bubble ta-tr" id="' +
              tz +
              '_bubble" data-tr-uid="' +
              tz +
              '" data-tr-who="ta" data-tr-amount="' +
              tM +
              '" data-tr-note="' +
              rt(tL) +
              '" data-tr-recipient="" onclick="(function(el){ if(typeof window._openTransferDetailFromBubble===&#39;function&#39;) window._openTransferDetailFromBubble(el.dataset.trUid); })(this)"><div style="font-size:20px;font-weight:700;">¥' +
              tM +
              '</div><div style="font-size:12px;opacity:0.8;margin-top:2px;">' +
              tL +
              '</div><div style="height:1px;background:rgba(255,255,255,0.25);margin:6px 0 4px;"></div><div style="display:flex;justify-content:flex-end;"><span class="tr-status" id="' +
              tz +
              '_status">待收款</span></div></div></div></div>' +
              "",
            tR =
              ((tG = window.akiniContacts.getSession(t)).messagesHTML || "") +
              tO;
          (window.akiniContacts.updateSession(t, {
            messagesHTML: tR,
            lastMsg: "【转账】" + tL,
            lastTime: Date.now(),
            unread: (tG.unread || 0) + 1,
            lastSenderAvatar: e.avatar,
            lastSenderName: e.name,
          }),
            C(t, tR));
        }
        if ((V(), "function" == typeof window.showInAppNotif)) {
          var ts = {
            app: "微信",
            appIcon: "💬",
            avatar: i,
            name: e.name,
            fullContent: !0,
            msg: "【转账】" + tL,
            chatId: t,
            onTap: function () {
              ct(t);
            },
          };
          window.showInAppNotif(ts);
        }
      }
      function doSticker() {
        h();
        const o = getContactStickersSync(r);
        if (0 === o.length) return;
        const n =
          '<div class="msg-row other"><div class="msg-content-line"><div class="msg-avatar">' +
          i +
          '</div><div class="bubble sticker-bubble" style="background:transparent;padding:0;box-shadow:none;"><img src="' +
          o[Math.floor(Math.random() * o.length)] +
          '" style="max-width:120px;max-height:120px;border-radius:8px;display:block;"></div></div></div>' +
          "";
        if (a && U) {
          const i = document.createElement("div");
          ((i.innerHTML = n),
            U.appendChild(i.firstChild),
            (U.scrollTop = U.scrollHeight),
            S(),
            window.akiniContacts.updateSession(t, {
              lastMsg: "【表情包】",
              lastTime: Date.now(),
              lastSenderAvatar: e.avatar,
              lastSenderName: e.name,
            }));
        } else {
          var c =
              ((v = window.akiniContacts.getSession(t)).messagesHTML || "") + n,
            l = (v.unread || 0) + 1;
          (window.akiniContacts.updateSession(t, {
            messagesHTML: c,
            lastMsg: "【表情包】",
            lastTime: Date.now(),
            unread: l,
            lastSenderAvatar: e.avatar,
            lastSenderName: e.name,
          }),
            C(t, c));
        }
        if ((V(), "function" == typeof window.showInAppNotif)) {
          var s = {
            app: "微信",
            appIcon: "💬",
            avatar: i,
            name: e.name,
            fullContent: !0,
            msg: "【表情包】",
            chatId: t,
            onTap: function () {
              ct(t);
            },
          };
          ("group" === e.type && (s.groupName = e.name),
            window.showInAppNotif(s));
        }
      }
      function doCall() {
        h();
        if ("function" == typeof window.showInAppNotif) {
          var cI = {
            app: "电话",
            appIcon: "📞",
            avatar: i,
            name: e.name,
            fullContent: !0,
            msg: "正在来电",
            chatId: t,
            onTap: function () {
              ct(t);
            },
          };
          window.showInAppNotif(cI);
        }
        "function" == typeof Te &&
          Te(e.name, !1, {
            callerName: e.name,
            callerAvatar: e.avatar,
            targetId: t,
          });
      }
      function doPoke() {
        h();
        window.taPoke(t);
      } // === 最外层：文字回复（已读必回，100%）===
      var __isQuote = !!ex.quote;
      var cardCount =
        (n && n.cardCount) ||
        (window.AKR && window.AKR.getCardCount
          ? window.AKR.getCardCount(e.type === "group" ? "group" : "private")
          : 1);
      cardCount = Math.max(1, Math.min(20, parseInt(cardCount, 10) || 1));
      // 联系人只能使用用户字卡库内容，绝无兜底字卡（syy 逻辑）
      var picked = window.pickWordCards ? window.pickWordCards(cardCount) : "";
      var messages = picked.split("\n").filter(function (x) {
        return x.trim();
      });
      if (0 === messages.length) {
        // 字卡库为空或无可用内容时，不发送任何回复（无兜底）
        return;
      }
      let g = "";
      if (__isQuote) {
        var y = a
          ? getMyLatestMessageText()
          : (function (t) {
              if (!window.akiniContacts) return "";
              var e = window.akiniContacts.getSession(t),
                n = (e && e.messagesHTML) || "";
              if (!n) return "";
              var i = document.createElement("div");
              i.innerHTML = n;
              var a = Array.from(i.querySelectorAll(".msg-row.me")),
                texts = [];
              for (var o = a.length - 1; o >= 0; o--) {
                var r = a[o].querySelector(".bubble");
                if (r && !r.classList.contains("transfer-bubble"))
                  if (!r.querySelector("img")) {
                    var c = r.textContent.trim();
                    if (c) texts.push(c);
                  }
              }
              if (!texts.length) return "";
              return texts[Math.floor(Math.random() * texts.length)];
            })(t);
        if (y) {
          g =
            '<div class="quote-bubble" style="background:#fff!important;color:#333!important;border:none!important;border-radius:10px!important;padding:4px 10px!important;font-size:11px!important;max-width:70%!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;box-shadow:0 1px 3px rgba(0,0,0,.1)!important;margin-top:3px!important;display:inline-block!important;">' +
            o +
            "：" +
            (y.slice(0, 40) + (y.length > 40 ? "…" : "")) +
            "</div>";
        }
      }
      function mixEmojiToText(text) {
        if (!ex.emojiMix || !text) return text;
        if (Math.random() >= 0.2) return text;
        var emojis = [];
        try {
          var wb = i("akini_wordbank", []);
          emojis = wb
            .filter(function (it) {
              var tab = (it.tab || "").toLowerCase();
              return tab === "emoji" && it.text;
            })
            .map(function (it) {
              return it.text;
            });
        } catch (err) {}
        // 无自定义 emoji 时不混入（联系人只能用字卡库内容，无兜底）
        if (!emojis.length) return text;
        var emoji = emojis[Math.floor(Math.random() * emojis.length)];
        return Math.random() < 0.5 ? emoji + " " + text : text + " " + emoji;
      }
      function sendMessageAt(idx) {
        if (idx >= messages.length) {
          hideTypingBubble(t);
          return;
        }
        let f = messages[idx];
        f = mixEmojiToText(f);
        const p =
          '<div class="msg-row other"><div class="msg-content-line"><div class="msg-avatar">' +
          i +
          '</div><div class="bubble">' +
          rt(f) +
          "</div></div>" +
          (g
            ? '<div style="flex-basis:100%;width:100%;padding-left:44px;box-sizing:border-box;margin-top:2px;">' +
              g +
              "</div>"
            : "") +
          "</div>" +
          "";
        if (a && U) {
          const n = document.createElement("div");
          (__akiniAppendMessageHTML(t, p, {
              lastMsg: f,
              lastSenderAvatar: e.avatar,
              lastSenderName: e.name,
            }),
            S());
        } else {
          var v;
          ((c =
            ((v = window.akiniContacts.getSession(t)).messagesHTML || "") + p),
            (l = (v.unread || 0) + 1));
          (window.akiniContacts.updateSession(t, {
            messagesHTML: c,
            lastMsg: f,
            lastTime: Date.now(),
            unread: l,
            lastSenderAvatar: e.avatar,
            lastSenderName: e.name,
          }),
            C(t, c));
        }
        if ((V(), "function" == typeof window.showInAppNotif)) {
          var s = {
            app: "微信",
            appIcon: "💬",
            avatar: i,
            name: e.name,
            fullContent: !0,
            msg: f,
            chatId: t,
            onTap: function () {
              ct(t);
            },
          };
          ("group" === e.type && (s.groupName = e.name),
            window.showInAppNotif(s));
        }
        if (idx < messages.length - 1) {
          showTypingBubble(
            t,
            "group" === e.type ? (e.memberIds || [])[0] : null,
          );
          setTimeout(
            function () {
              sendMessageAt(idx + 1);
            },
            1500 + Math.random() * 1000,
          );
        } else {
          hideTypingBubble(t);
          runExtras();
        }
      }
      function runExtras() {
        var list = [];
        if (ex.transfer && "1" === localStorage.getItem("akini_toggle_contactTransferToggle")) list.push(doTransfer);
        if (ex.sticker && "1" === localStorage.getItem("akini_toggle_contactEmojiToggle")) list.push(doSticker);
        if (ex.poke && "group" !== e.type) list.push(doPoke);
        if (ex.call && "1" === localStorage.getItem("akini_toggle_contactActiveMsgToggle")) list.push(doCall);
        if (0 === list.length) return;
        var k = 0;
        function next() {
          if (k >= list.length) return;
          var fn = list[k++];
          setTimeout(
            function () {
              try {
                fn();
              } catch (err) {
                console.error("[I] extra error:", err);
              }
              next();
            },
            800 + Math.random() * 700,
          );
        }
        next();
      }
      if (ex.poke) {
        runExtras();
      } else {
        sendMessageAt(0);
      }
    }
    function akiniTriggerReply(t) {
      if (!window.akiniContacts) return;
      t = t || window.akiniContacts.getActiveChatId();
      var e = window.akiniContacts.getChatTarget(t);
      if (!e) return;
      var n = _();
      if (!n || "none" === n.type) return;
      window.I(t, e, n);
    }
    window.akiniTriggerReply = akiniTriggerReply;
    var x = null,
      E = {};
    function S() {
      if (U && window.akiniContacts) {
        if (window._restoringChatHistory || window._restoringData) return;
        (x && clearTimeout(x), A());
      }
    }
    function A() {
      if (U && window.akiniContacts) {
        if (window._restoringChatHistory || window._restoringData) return;
        var e = window.akiniContacts.getActiveChatId();
        if (e) {
          var d = U.getAttribute("data-rendered-chat-id");
          // 切换会话时，用会话里的完整记录保存，不要用截断后的 DOM HTML
          if (d && d !== e) {
            var oldSess = window.akiniContacts.getSession(d);
            if (oldSess && oldSess.messagesHTML) {
              C(d, oldSess.messagesHTML);
            }
          }
          U.setAttribute("data-rendered-chat-id", e);
          var n = window.akiniContacts.getSession(e);
          if (n && n.messagesHTML && "" !== n.messagesHTML.trim()) {
            C(e, n.messagesHTML);
          }
        }
      }
    }
    var AKINI_CHAT_BATCH_SIZE = 100;
    function __akiniCountMsgRows(html) {
      if (!html) return 0;
      var m = html.match(/<div[^>]*class="msg-row/g);
      return m ? m.length : 0;
    }
    function __akiniSliceLastMsgRows(html, n) {
      if (!html || n <= 0) return html || "";
      var total = __akiniCountMsgRows(html);
      if (total <= n) return html;
      // 找到倒数第 n+1 条消息的起始位置，从它之后截取
      var count = 0, idx = html.length;
      while ((idx = html.lastIndexOf('<div class="msg-row', idx - 1)) !== -1) {
        count++;
        if (count === n + 1) {
          return html.slice(idx);
        }
      }
      return html;
    }
    function __akiniGetMsgRowsHTML(html, start, end) {
      // 按 msg-row 切片（start/end 为消息索引）
      var rows = [];
      var i = 0;
      while ((i = html.indexOf('<div class="msg-row', i)) !== -1) {
        var next = html.indexOf('<div class="msg-row', i + 1);
        rows.push(html.slice(i, next === -1 ? html.length : next));
        i = next === -1 ? html.length : next;
      }
      return rows.slice(start, end).join("");
    }
    function __akiniCreateLoadMoreBtn(chatId) {
      var div = document.createElement("div");
      div.className = "msg-load-more";
      div.style.cssText = "text-align:center;padding:12px 0;font-size:13px;color:#888;cursor:pointer;-webkit-tap-highlight-color:transparent;user-select:none;";
      div.innerHTML = '<span class="load-more-text">↑ 加载更多聊天记录</span>';
      div.addEventListener("click", function () {
        __akiniLoadMoreHistory(chatId);
      });
      return div;
    }
    function __akiniRenderChatBody(fullHTML, chatId) {
      if (!U) return;
      var total = __akiniCountMsgRows(fullHTML);
      if (total <= AKINI_CHAT_BATCH_SIZE) {
        U.innerHTML = fullHTML;
      } else {
        var batchHTML = __akiniSliceLastMsgRows(fullHTML, AKINI_CHAT_BATCH_SIZE);
        U.innerHTML = batchHTML;
        U.appendChild(__akiniCreateLoadMoreBtn(chatId));
      }
      try {
        U.setAttribute(
          "data-rendered-chat-id",
          window.akiniContacts ? window.akiniContacts.getActiveChatId() : "",
        );
      } catch (e) {}
      U.scrollTop = U.scrollHeight;
      __akiniSetupChatMetaObserver();
    }
    function __akiniLoadMoreHistory(chatId) {
      if (!U) return;
      var sess = window.akiniContacts.getSession(chatId) || {};
      var fullHTML = sess.messagesHTML || "";
      var total = __akiniCountMsgRows(fullHTML);
      var currentRows = U.querySelectorAll('.msg-row').length;
      var newCount = Math.min(total, currentRows + AKINI_CHAT_BATCH_SIZE);
      if (newCount <= currentRows) return;
      var newHTML = __akiniSliceLastMsgRows(fullHTML, newCount);
      // 记录旧高度，避免加载后滚动位置跳到底部
      var oldHeight = U.scrollHeight, oldTop = U.scrollTop;
      U.innerHTML = newHTML;
      U.appendChild(__akiniCreateLoadMoreBtn(chatId));
      U.scrollTop = oldTop + (U.scrollHeight - oldHeight);
      __akiniSetupChatMetaObserver();
    }
    function __akiniAppendMessageHTML(chatId, html, meta) {
      // meta: {lastMsg, lastSenderAvatar, lastSenderName}
      if (!chatId || !html) return;
      var sess = window.akiniContacts.getSession(chatId) || {};
      var fullHTML = (sess.messagesHTML || "") + html;
      window.akiniContacts.updateSession(chatId, Object.assign({
        messagesHTML: fullHTML,
        lastTime: Date.now()
      }, meta || {}));
      C(chatId, fullHTML);
      // 若当前正在看该聊天，把新消息追加到 DOM（同时保持虚拟滚动）
      if (U && window.akiniContacts.getActiveChatId() === chatId) {
        var total = __akiniCountMsgRows(fullHTML);
        // 如果当前 DOM 里已经展示了全部消息，直接追加；否则只追加到末尾（用户仍在底部时可见）
        var visibleRows = U.querySelectorAll('.msg-row').length;
        if (total - visibleRows <= 1) {
          var loadMore = U.querySelector('.msg-load-more');
          var temp = document.createElement('div'); temp.innerHTML = html;
          while (temp.firstChild) {
            U.insertBefore(temp.firstChild, loadMore || null);
          }
          U.scrollTop = U.scrollHeight;
        }
      }
    }
    function C(t, e) {
      if (!t || "string" != typeof e) return;
      var key = "akini_chat_history_" + t;
      var backup = "akini_chat_history_backup_" + t;
      // 关键防护：如果新记录比现有记录短，不覆盖任何备份，防止恢复时选错源导致数据被截断
      // 注意：大记录(>60KB)只存 IDB 不存 localStorage，因此必须同时对比内存 E[t] 与 localStorage
      var existingRows = 0;
      try {
        existingRows = __akiniCountMsgRows(localStorage.getItem(key) || "");
      } catch (err) {}
      var memRows = E[t] ? __akiniCountMsgRows(E[t]) : 0;
      if (memRows > existingRows) existingRows = memRows;
      var newRows = __akiniCountMsgRows(e);
      if (newRows < existingRows) {
        console.warn("[C] 拒绝用更短的聊天记录覆盖：" + key + " (" + newRows + " < " + existingRows + ")");
        return;
      }
      E[t] = e;
      // IDB 复核：先读 IDB 现有记录，行数更多时不覆盖，防止陈旧会话数据截断完整记录
      var doWrite = function () {
        // 使用安全存储层：优先写 IDB，同时尝试写 localStorage 热备
        if (window.akiniStore && window.akiniStore.set) {
          window.akiniStore.set(key, e);
          window.akiniStore.set(backup, e);
        } else {
          try { _idbStore.set(key, e); } catch (err) {}
          try { _idbStore.set(backup, e); } catch (err) {}
          try { localStorage.setItem(key, e); } catch (i) {}
          try { localStorage.setItem(backup, e); } catch (i) {}
        }
      };
      try {
        _idbStore.get(key, function (idbExisting) {
          var idbRows = idbExisting ? __akiniCountMsgRows(String(idbExisting)) : 0;
          if (newRows >= idbRows) {
            doWrite();
          } else {
            console.warn("[C] IDB 复核拒绝覆盖：" + key + " (" + newRows + " < " + idbRows + ")");
          }
        });
      } catch (err) {
        // IDB 读取异常时直接写，保底不丢数据
        doWrite();
      }
      // 精简应急备份（最后 200 条），确保 localStorage 满后仍有兜底
      try {
        __akiniBackupCriticalChatData(t, e);
      } catch (e) {}
      try {
        window._akiniCacheStore && window._akiniCacheStore.backupAll && window._akiniCacheStore.backupAll();
      } catch (e) {}
    }
    function __akiniSaveChatHistory(t, e) {
      if (!t || "string" != typeof e) return;
      C(t, e);
    }
    function __akiniBackupCriticalChatData(t, e) {
      if (!t || "string" != typeof e || !e.trim()) return;
      try {
        var compact = __akiniSliceLastMsgRows(e, 200);
        localStorage.setItem("akini_chat_critical_" + t, compact);
      } catch (e) {}
    }
    function __akiniRecoverCriticalChatData(t) {
      try {
        return localStorage.getItem("akini_chat_critical_" + t) || "";
      } catch (e) {
        return "";
      }
    }
    function B() {
      [
        "akini_my_avatar",
        "akini_ta_avatar",
        "akini_home_bg",
        "akini_bg_img",
        "akini_friends_bg",
        "akini_cover_img",
        "akini_chat_bg",
        "akini_contact_stickers",
        "akini_stickers",
        "akini_stickers_idx",
      ].forEach(function (t) {
        try {
          var e = localStorage.getItem(t);
          e && e.length > 0 && _idbStore.set(t, e);
        } catch (t) {}
      });
      for (var t = localStorage.length - 1; t >= 0; t--) {
        var e = localStorage.key(t);
        if (
          e &&
          (/^akini_stickers_/.test(e) ||
            /^akini_chat_bg_/.test(e) ||
            /^akini_icity_ta_bg_/.test(e) ||
            /^akini_app_icon_/.test(e))
        )
          try {
            var v = localStorage.getItem(e);
            v && _idbStore.set(e, v);
            localStorage.removeItem(e);
          } catch (t) {}
      }
    }
    var T = Storage.prototype.setItem,
      M = [
        "akini_contacts",
        "akini_groups",
        "akini_chat_sessions",
        "akini_active_chat_id",
        "akini_home_avatars",
        "akini_migrated",
        "akini_contacts_migrated",
        "akini_wordbank",
        "akini_wb_groups",
        "akini_my_avatar",
        "akini_ta_avatar",
        "akini_my_name",
        "akini_ta_name",
        "akini_posts",
        "akini_posts_backup",
        "akini_icity_diaries",
        "akini_icity_diaries_backup",
        "akini_chat_history",
        "akini_chat_history_backup",
        "akini_stickers",
        "akini_stickers_backup",
        "akini_stickers_idx",
        "akini_contact_stickers",
        "akini_last_page_state",
        "akini_signature",
        "akini_friends_signature",
        "akini_day_label",
        "akini_start_date",
        "akini_bubble_color",
        "akini_swap_avatar_pos",
        "akini_bg_img",
        "akini_home_bg",
        "akini_cover_img",
        "akini_friends_bg",
        "akini_chat_bg",
        "akini_music_playlist",
        "akini_music_index",
        "akini_music_mode",
        "akini_music_bg",
        "akini_music_current_time",
        "akini_music_playing",
        "akini_music_listen_seconds",
        "akini_music_listening_active",
        "akini_music_chat_messages",
        "akini_music_selected_contacts",
        "akini_music_selected_option",
        "akini_music_platform",
        "akini_netease_cookie",
        "akini_netease_uid",
        "akini_meaningful",
        "akini_meaningful_numbers",
        "akini_chat_pins",
        "akini_call_full_pos",
        "akini_call_mini_pos",
        "akini_call_state",
        "akini_preview_contact_id",
        "akini_preview_bubble_left",
        "akini_preview_bubble_right",
        "akini_localstorage_snapshot",
        "akini_localstorage_snapshot_backup",
        "akini_icity_my_nick",
        "akini_icity_my_handle",
        "akini_icity_my_bio",
        "akini_icity_my_avatar",
        "akini_icity_my_bg",
        "akini_icity_ta_nick",
        "akini_icity_ta_handle",
        "akini_icity_ta_bio",
        "akini_icity_ta_avatar",
        "akini_icity_ta_bg",
        "akini_mail_sent",
        "akini_mail_sent_backup",
        "akini_mail_received",
        "akini_mail_received_backup",
        "akini_icity_comments",
        "akini_icity_comments_backup",
        "akini_shop_orders",
        "akini_shop_products",
        "akini_surveys",
      ],
      MP = [
        "akini_chat_history_",
        "akini_chat_history_backup_",
        "akini_icity_profile_",
        "akini_icity_ta_bg_",
        "akini_icity_my_bg_",
        "akini_chat_bg_",
        "akini_toggle_",
        "akini_num_",
        "akini_settings_",
        "akini_beautify_",
        "akini_stickers_",
        "akini_preview_",
        "akini_music_",
        "akini_backup_",
        "akini_localstorage_",
        "akini_full_backup_",
        "akini_wb_groups_",
        "akini_shop_",
      ];
    function _akiniMProtected(t) {
      return (
        M.indexOf(t) > -1 ||
        MP.some(function (e) {
          return 0 === t.indexOf(e);
        })
      );
    }
    function L(t, e, n) {
      var i = /_(bg|img|stickers)$/.test(t),
        a = /_avatar$/.test(t);
      if (
        ("akini_my_avatar" === t && u("my", e),
        "akini_ta_avatar" === t && u("ta", e),
        "akini_my_avatar" === t)
      ) {
        try {
          localStorage.setItem("akini_icity_my_avatar", e);
        } catch (t) {}
        try {
          _idbStore.set("akini_icity_my_avatar", e);
        } catch (t) {}
      }
      if ("akini_ta_avatar" === t) {
        try {
          localStorage.setItem("akini_icity_ta_avatar", e);
        } catch (t) {}
        try {
          _idbStore.set("akini_icity_ta_avatar", e);
        } catch (t) {}
        try {
          if (
            window.akiniContacts &&
            window.akiniContacts.getContacts &&
            window.akiniContacts.updateContact
          ) {
            var _defC = window.akiniContacts
              .getContacts()
              .find(function (c) {
                return c.isDefault;
              });
            if (_defC && (!_defC.avatar || _defC.avatar === "🐰")) {
              window.akiniContacts.updateContact(_defC.id, { avatar: e });
            }
          }
        } catch (t) {}
      }
      if (i && !a)
        return (
          _idbStore.set(t, e, function () {
            n && n(!0);
          }),
          !0
        );
      try {
        return (
          localStorage.setItem(t, e),
          _idbStore.set(t, e),
          n && n(!0),
          !0
        );
      } catch (i) {
        if (a) {
          B();
          try {
            return (
              localStorage.setItem(t, e),
              _idbStore.set(t, e),
              n && n(!0),
              !0
            );
          } catch (t) {}
        }
        try {
          _idbStore.set(t, e, n);
        } catch (t) {
          n && n(!1);
        }
        return !1;
      }
    }
    function D(t, e) {
      var n = localStorage.getItem(t);
      n
        ? e(n)
        : _idbStore.get(t, function (t) {
            e(t || "");
          });
    }
    function N(t, e) {
      if (t) {
        var n = "akini_stickers_" + t,
          i = "akini_stickers_" + t + "_backup",
          a = localStorage.getItem(n);
        if (a)
          try {
            var o = JSON.parse(a);
            ((window.__csCache = window.__csCache || {}),
              (window.__csCache[n] = o));
            return (
              _idbStore.set(n, a),
              _idbStore.set(i, a, function () {
                try {
                  (localStorage.removeItem(n),
                    localStorage.removeItem(n + "_idx"));
                } catch (t) {}
              }),
              void e(o)
            );
          } catch (t) {}
        _idbStore.get(n, function (t) {
          var n = [];
          try {
            n = JSON.parse(t || "[]");
          } catch (t) {}
          ((window.__csCache = window.__csCache || {}),
            (window.__csCache[
              "akini_stickers_" + (typeof t === "undefined" ? "" : t)
            ] = n),
            e(n));
        });
      } else H(e);
    }
    function P(t, e, n) {
      if (t) {
        var i = "akini_stickers_" + t,
          a = "akini_stickers_" + t + "_backup",
          o = JSON.stringify(e || []);
        ((window.__csCache = window.__csCache || {}),
          (window.__csCache[i] = e || []),
          _idbStore.set(a, o),
          _idbStore.set(i, o, function () {
            try {
              (localStorage.removeItem(i), localStorage.removeItem(i + "_idx"));
            } catch (t) {}
          }),
          n &&
            setTimeout(function () {
              n();
            }, 0));
      } else W(e, n);
    }
    function H(t) {
      var e = localStorage.getItem("akini_stickers");
      if (e)
        try {
          var n = JSON.parse(e);
          return (
            _idbStore.set("akini_stickers", e),
            _idbStore.set("akini_stickers_backup", e, function () {
              try {
                (localStorage.removeItem("akini_stickers"),
                  localStorage.removeItem("akini_stickers_idx"));
              } catch (t) {}
            }),
            void t(n)
          );
        } catch (t) {}
      _idbStore.get("akini_stickers", function (e) {
        var n = [];
        try {
          n = JSON.parse(e || "[]");
        } catch (t) {}
        t(n);
      });
    }
    ((Storage.prototype.setItem = function (t, e) {
      if (this !== localStorage && this !== sessionStorage)
        return T.apply(this, arguments);
      // 聊天记录过大时只写 IndexedDB，避免 localStorage 超限崩溃
      if (
        this === localStorage &&
        t &&
        "string" == typeof t &&
        /^akini_chat_history_/.test(t) &&
        e &&
        e.length > 60000
      ) {
        try {
          window._idbStore &&
            window._idbStore.set &&
            window._idbStore.set(t, e);
        } catch (n) {}
        return;
      }
      try {
        var a = T.call(this, t, e);
        if (
          this === localStorage &&
          t &&
          "string" == typeof t &&
          0 === t.indexOf("akini_")
        )
          try {
            window._idbStore &&
              window._idbStore.set &&
              window._idbStore.set(t, e);
          } catch (n) {}
        return a;
      } catch (c) {
        if (
          this !== localStorage ||
          !(function (t) {
            if (!t) return !1;
            var e = (t.message || t.name || "").toLowerCase();
            return (
              "QuotaExceededError" === t.name ||
              22 === t.code ||
              1014 === t.code ||
              /quota/.test(e) ||
              /exceeded/.test(e) ||
              /storage/.test(e)
            );
          })(c)
        )
          throw c;
        B();
        // 配额超限导致 localStorage 写入失败时，仍把数据写入 IndexedDB，避免数据彻底丢失
        try {
          window._idbStore &&
            window._idbStore.set &&
            window._idbStore.set(t, e);
        } catch (_) {}
        try {
          return T.call(this, t, e);
        } catch (t) {}
        try {
          for (var n = null, i = 0, a = 0; a < this.length; a++) {
            var o = this.key(a);
            if (o && o !== t && !_akiniMProtected(o)) {
              var r = this.getItem(o) || "";
              r.length > i && ((i = r.length), (n = o));
            }
          }
          return (n && this.removeItem(n), T.call(this, t, e));
        } catch (e) {
          console.warn("localStorage quota exceeded, cannot save", t, e);
        }
      }
    }),
      (window.loadBgFromStorage = D));
    var z = null;
    var _postsIdbLoaded = false;
    function O() {
      // 空数组且尚未完成 IDB 校验时也重新读取，避免启动竞态读到空默认值
      var needLoad = !z || (Array.isArray(z) && z.length === 0 && !_postsIdbLoaded);
      if (!needLoad) return z;
      // 优先从 IndexedDB 读取（容量大，不受 localStorage 5MB 限制）
      if (window._idbStore && window._idbStore.get) {
        _postsIdbLoaded = true;
        _idbStore.get("akini_posts", function (idbVal) {
          var parsed = null;
          if (idbVal) {
            try { parsed = JSON.parse(idbVal); } catch (e) { parsed = null; }
          }
          if (!parsed) {
            // IDB 无数据则尝试 backup
            _idbStore.get("akini_posts_backup", function (bkVal) {
              if (bkVal) {
                try { parsed = JSON.parse(bkVal); } catch (e) { parsed = null; }
              }
              if (!parsed) {
                // 最后兜底 localStorage
                var ls = localStorage.getItem("akini_posts");
                if (ls) { try { parsed = JSON.parse(ls); } catch (e) { parsed = null; } }
              }
              _applyPosts(parsed);
            });
          } else {
            _applyPosts(parsed);
          }
        });
        // 同步先返回内存/LocalStorage 兜底，避免渲染空
        z = i("akini_posts", []);
      }
      z || (z = []);
      var e = !1;
      z.forEach(function (t) {
        t.id ||
          ((t.id = Date.now() + Math.random().toString(36).slice(2, 9)),
          (e = !0));
      });
      e && R(z);
      return z;
    }
    function _applyPosts(parsed) {
      if (Array.isArray(parsed) && parsed.length) {
        z = parsed;
        if ("function" == typeof window._renderPosts) window._renderPosts();
      }
    }
    function R(t, e) {
      // 加固：若传入数组是过滤副本（如 filter 掉 icity），先合并回内存 z 中的 icity 帖子
      // 防止朋友圈评论/点赞把 iCity 同步到朋友圈的帖子从 akini_posts 中挤掉
      try {
        if (Array.isArray(t) && z && z.length) {
          var hasIcity = !1;
          for (var i = 0; i < t.length; i++)
            if (t[i] && t[i].source === "icity") { hasIcity = !0; break; }
          if (!hasIcity) {
            var idxMap = {};
            t.forEach(function (p) { p && p.id && (idxMap[p.id] = 1); });
            var merged = t.slice();
            z.forEach(function (p) {
              if (p && p.source === "icity" && !idxMap[p.id]) merged.push(p);
            });
            t = merged;
          }
        }
      } catch (err) {}
      z = t || [];
      var n = JSON.stringify(z);
      // 优先写入 IndexedDB（容量大，不受 localStorage 配额限制，彻底解决数据消失）
      _idbStore.set("akini_posts", n);
      _idbStore.set("akini_posts_backup", n);
      // localStorage 作为兜底，配额超限时静默失败不影响 IDB 主存储
      try {
        localStorage.setItem("akini_posts", n);
      } catch (t) {
        console.warn("[Akini] akini_posts 写入 localStorage 失败（配额超限），已存入 IndexedDB", t && t.name);
      }
      (window._idbStore &&
        window._idbStore.backupAll &&
        window._idbStore.backupAll(),
        e &&
          setTimeout(function () {
            e();
          }, 0));
    }
    function __akiniMergeFriendsPostsFromIDB(t) {
      if (!t) return;
      try {
        var e = JSON.parse(t);
        if (!Array.isArray(e)) return;
        var n = O();
        if (!e.length && !n.length) return;
        var i = {};
        n.forEach(function (t) {
          if (t && t.id) i[t.id] = t;
        });
        e.forEach(function (t) {
          if (!t || !t.id) return;
          var e = i[t.id];
          if (!e) {
            i[t.id] = t;
            return;
          }
          // 合并点赞：去重
          var a = e.likes || [],
            o = t.likes || [];
          var r = new Set(a.map(function (x) { return JSON.stringify(x); }));
          o.forEach(function (x) { r.add(JSON.stringify(x)); });
          e.likes = Array.from(r).map(function (x) { try { return JSON.parse(x); } catch (err) { return x; } });
          // 合并评论：按稳定 key 去重，只删除完全相同的备份，保留时间不同的合法重复
          var c = e.comments || [],
            l = t.comments || [];
          var allComments = c.slice();
          var seen = {};
          function _friendCommentKey(c) {
            return (c.author || "") + "|" + (c.replyTo || "") + "|" + (c.text || "").slice(0, 30) + "|" + (c.ts || 0);
          }
          c.forEach(function (c) {
            if (!c || typeof c !== "object") return;
            seen[_friendCommentKey(c)] = !0;
          });
          l.forEach(function (c) {
            if (!c || typeof c !== "object") return;
            if (!c.id) c.id = "c_" + Math.random().toString(36).slice(2) + "_" + (c.ts || Date.now());
            var k = _friendCommentKey(c);
            if (!seen[k]) {
              seen[k] = !0;
              allComments.push(c);
            }
          });
          e.comments = allComments.sort(function (a, b) {
            return (a.ts || 0) - (b.ts || 0);
          });
        });
        var a = Object.values(i);
        a.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
        if (a.length !== n.length || JSON.stringify(a) !== JSON.stringify(n)) {
          R(a);
          if ("function" == typeof window._renderPosts) window._renderPosts();
        }
      } catch (e) {}
    }
    !(function () {
      // 按帖子 id 合并本地与 IDB（评论/点赞也按内容取更全的一方），任何一方帖子都不丢
      function mergePosts(a, b) {
        var map = {};
        function put(p) {
          if (!p || !p.id) return;
          var ex = map[p.id];
          if (!ex) { map[p.id] = p; return; }
          // 评论数多的为准，再把对方独有评论补进来（按稳定 key 去重，只删除完全相同的备份）
          var ac = (ex.comments = ex.comments || []), bc = (p.comments = p.comments || []);
          var seen = {};
          function _postCommentKey(c) { return (c.author || "") + "|" + (c.replyTo || "") + "|" + (c.text || "").slice(0, 30) + "|" + (c.ts || 0); }
          ac.forEach(function (c) { c && c.ts && (seen[_postCommentKey(c)] = 1); });
          bc.forEach(function (c) {
            var k = c && c.ts ? _postCommentKey(c) : "";
            if (c && k && !seen[k]) { ac.push(c); seen[k] = 1; }
          });
          if ((p.likes || []).length > (ex.likes || []).length) ex.likes = p.likes;
          if (p.liked) ex.liked = !0;
        }
        (a || []).forEach(put);
        (b || []).forEach(put);
        var out = Object.keys(map).map(function (k) { return map[k]; });
        out.sort(function (x, y) { return (y.ts || 0) - (x.ts || 0); });
        return out;
      }
      function t(t) {
        if (!t) return !1;
        try {
          var n = JSON.parse(t);
          if (!Array.isArray(n)) return !1;
          if (z && z.length) {
            var merged = mergePosts(z, n);
            if (merged.length > z.length || JSON.stringify(merged) !== JSON.stringify(z)) {
              z = merged;
              return !0;
            }
            return !1;
          }
          z = n;
          return !0;
        } catch (t) {}
        return !1;
      }
      var e = localStorage.getItem("akini_posts");
      if (e) {
        try {
          z = JSON.parse(e);
        } catch (t) {
          z = [];
        }
        (_idbStore.set("akini_posts", e),
          _idbStore.set("akini_posts_backup", e));
        // 本地也对比一次 IDB，把备份里本地没有的帖子找回来
        _idbStore.get("akini_posts", function (idbV) {
          if (idbV && t(idbV)) {
            try { R(z); } catch (err) {}
            if ("function" == typeof window._renderPosts) window._renderPosts();
          } else {
            _idbStore.get("akini_posts_backup", function (idbB) {
              if (idbB && t(idbB)) {
                try { R(z); } catch (err) {}
                if ("function" == typeof window._renderPosts) window._renderPosts();
              }
            });
          }
        });
      } else {
        _idbStore.get("akini_posts", function (e) {
          t(e) ||
            _idbStore.get("akini_posts_backup", function (e) {
              t(e) || z || (z = []);
            });
        });
      }
    })();
    var F = null;
    (window._akiniClearDiaryCache = function () {
      F = null;
    }),
    ((window._akiniGetDiaries = function () {
      try {
        return q();
      } catch (e) {
        return [];
      }
    }),
      (window._akiniSaveDiaries = function (t) {
        try {
          j(t);
        } catch (e) {}
      }),
      window.addEventListener("pagehide", function () {
        try {
          window._akiniSaveDiaries &&
            window._akiniSaveDiaries(window._akiniGetDiaries());
        } catch (e) {}
      }));
    function q() {
      // F 为空时重新读取；空数组且尚未完成 IDB 校验时也重新读取，避免启动竞态读到空默认值
      var needLoad = !F || (Array.isArray(F) && F.length === 0 && !window.__akiniIcityLoaded);
      if (needLoad) {
        window.__akiniIcityLoaded = !0;
        // 优先从 IndexedDB 读取（容量大，不受 localStorage 5MB 限制）
        if (window._idbStore && window._idbStore.get) {
          _idbStore.get("akini_icity_diaries", function (idbVal) {
            var parsed = null;
            if (idbVal) { try { parsed = JSON.parse(idbVal); } catch (e) { parsed = null; } }
            if (!parsed) {
              _idbStore.get("akini_icity_diaries_backup", function (bkVal) {
                if (bkVal) { try { parsed = JSON.parse(bkVal); } catch (e) { parsed = null; } }
                if (!parsed) {
                  var ls = localStorage.getItem("akini_icity_diaries") || localStorage.getItem("akini_icity_diaries_backup");
                  if (ls) { try { parsed = JSON.parse(ls); } catch (e) { parsed = null; } }
                }
                _applyIcityParsed(parsed);
              });
            } else {
              _applyIcityParsed(parsed);
            }
          });
        }
        // 同步先返回内存缓存（akiniStore.memoryGet，IDB 预加载/写入同步），再读 localStorage 兜底
        F = i("akini_icity_diaries", []);
      }
      var e = !1;
      return (
        (F = (F || []).map(function (t) {
          if (!t) return t;
          t.id ||
            ((t.id = Date.now() + "_" + Math.floor(1e3 * Math.random())),
            (e = !0));
          // 评论按稳定 key 去重：优先用 id，无 id 时用 author+replyTo+text+ts；给无 id 评论补 id 防误删
          if (t.comments && t.comments.length > 0) {
            var seen = {},
              deduped = [];
            t.comments.forEach(function (c) {
              if (!c || typeof c !== "object") {
                e = !0;
                return;
              }
              if (!c.id) {
                c.id = "c_" + Math.random().toString(36).slice(2) + "_" + (c.ts || Date.now());
                e = !0;
              }
              var k = c.id || ((c.author || "") + "|" + (c.replyTo || "") + "|" + (c.text || "") + "|" + (c.ts || 0));
              if (!seen[k]) {
                seen[k] = !0;
                deduped.push(c);
              } else {
                e = !0;
              }
            });
            if (deduped.length !== t.comments.length) {
              t.comments = deduped;
              e = !0;
            }
          }
          return t;
        })),
        e && j(F),
        F || []
      );
    }
    // 异步从 IndexedDB 读取到的 iCity 数据，必须走合并逻辑（带评论只增不减不变量），
    // 绝不能直接覆盖内存 F，否则会丢掉用户刚发但尚未写回 IDB 的评论
    function _applyIcityParsed(parsed) {
      if (!Array.isArray(parsed) || !parsed.length) return;
      if (!F || !F.length) {
        F = parsed;
        if ("function" == typeof window._renderIcity) window._renderIcity();
        return;
      }
      // 内存已有数据时合并，保证评论只增不减
      if ($(JSON.stringify(parsed), !0)) {
        if ("function" == typeof window._renderIcity) window._renderIcity();
      }
    }
    function j(t, e) {
      F = t || [];
      var n = JSON.stringify(F);
      // 统一走 akiniStore：同步写入内存缓存（消除刷新后读空导致的闪烁），
      // 并异步落盘 IndexedDB（主存储，容量大）+ localStorage（热备），彻底解决数据消失
      if (window.akiniStore && window.akiniStore.set) {
        window.akiniStore.set("akini_icity_diaries", n);
      } else {
        _idbStore.set("akini_icity_diaries", n);
        _idbStore.set("akini_icity_diaries_backup", n);
        try { localStorage.setItem("akini_icity_diaries", n); } catch (x) {}
      }
      (window._idbStore &&
        window._idbStore.backupAll &&
        window._idbStore.backupAll(),
        e &&
          setTimeout(function () {
            e();
          }, 0));
    }
    function $(t, e) {
      if (!t) return !1;
      try {
        var n = JSON.parse(t);
        if (!Array.isArray(n)) return !1;
        var i = (F && F.length) || 0;
        if (e || n.length > i) {
          // 不变量保护：合并前后评论总数只增不减，任何一侧的评论都不允许丢失
          var _cmtTotal = function (arr) {
            var s = 0;
            (arr || []).forEach(function (d) {
              d && d.comments && (s += d.comments.length);
            });
            return s;
          };
          var fBefore = _cmtTotal(F);
          if (F && F.length) {
            var map = {};
            F.forEach(function (d) {
              if (d && d.id) map[d.id] = d;
            });
            n.forEach(function (d) {
              if (d && d.id && map[d.id]) {
                var old = map[d.id];
                // 合并评论：按稳定 key 去重，只删除完全相同的备份，保留时间不同的合法重复
                var oc = old.comments || [];
                var nc = d.comments || [];
                var allComments = oc.slice();
                var seen = {};
                oc.forEach(function (c) {
                  if (!c || typeof c !== "object") return;
                  if (!c.id) c.id = "c_" + Math.random().toString(36).slice(2) + "_" + (c.ts || Date.now());
                  var k = c.id;
                  seen[k] = !0;
                });
                nc.forEach(function (c) {
                  if (!c || typeof c !== "object") return;
                  if (!c.id) c.id = "c_" + Math.random().toString(36).slice(2) + "_" + (c.ts || Date.now());
                  var k = c.id;
                  if (!seen[k]) {
                    seen[k] = !0;
                    allComments.push(c);
                  }
                });
                d.comments = allComments.sort(function (a, b) {
                  return (a.ts || 0) - (b.ts || 0);
                });
                /* Merge likers by dedup */ var ol = old.likers || [];
                var nl = d.likers || [];
                var lm = {};
                ol.forEach(function (l) {
                  var k =
                    typeof l === "object"
                      ? l.id || l.name || JSON.stringify(l)
                      : l;
                  lm[k] = l;
                });
                nl.forEach(function (l) {
                  var k =
                    typeof l === "object"
                      ? l.id || l.name || JSON.stringify(l)
                      : l;
                  if (!lm[k]) lm[k] = l;
                });
                d.likers = Object.keys(lm).map(function (k) {
                  return lm[k];
                });
                /* Merge likes count - keep max */ if (
                  typeof old.likes === "number" ||
                  typeof d.likes === "number"
                ) {
                  d.likes = Math.max(old.likes || 0, d.likes || 0);
                }
                /* Preserve pinned */ if (old.pinned) d.pinned = old.pinned;
                /* Preserve liked */ if (old.liked) d.liked = old.liked;
              }
            });
          }
          /* Merge local-only diaries */ var newMap = {};
          n.forEach(function (d) {
            if (d && d.id) newMap[d.id] = d;
          });
          if (F && F.length) {
            F.forEach(function (d) {
              if (d && d.id && !newMap[d.id]) {
                n.push(d);
                newMap[d.id] = d;
              }
            });
          }
          F = n;
          // 不变量校验：合并后评论总数不得少于合并前，否则放弃本次合并结果，保留内存 F
          var fAfter = _cmtTotal(F);
          if (fAfter < fBefore) {
            console.warn("[icity merge] 合并后评论数减少 (" + fBefore + " -> " + fAfter + ")，放弃合并保留内存数据");
            return !1;
          }
          try {
            localStorage.setItem("akini_icity_diaries", JSON.stringify(F));
            localStorage.setItem(
              "akini_icity_diaries_backup",
              JSON.stringify(F),
            );
          } catch (t) {}
          try {
            if (window._idbStore && window._idbStore.set) {
              window._idbStore.set("akini_icity_diaries", JSON.stringify(F));
              window._idbStore.set(
                "akini_icity_diaries_backup",
                JSON.stringify(F),
              );
            }
          } catch (t) {}
          return !0;
        }
      } catch (t) {
        console.error("[icity merge] error:", t);
        return !1;
      }
    }
    function W(t, e) {
      var n = JSON.stringify(t || []);
      if (window.akiniStore && window.akiniStore.set) {
        window.akiniStore.set("akini_stickers", n);
        try {
          var i = localStorage.getItem("akini_stickers_idx") || "0";
          window.akiniStore.set("akini_stickers_idx", i);
        } catch (t) {}
      } else {
        try { localStorage.setItem("akini_stickers", n); } catch (t) {}
        _idbStore.set("akini_stickers", n);
        _idbStore.set("akini_stickers_backup", n);
      }
      window._idbStore && window._idbStore.backupAll && window._idbStore.backupAll();
      e && setTimeout(function () { e(); }, 0);
    }
    function J() {
      if (!window.akiniContacts) return null;
      var t = window.akiniContacts.getActiveChatId();
      if (!t) return null;
      var e = window.akiniContacts.getChatTarget(t);
      return e && "contact" === e.type ? e.id : null;
    }
    // 图片读取：依赖全局 FileReader 拦截做统一高质量压缩（1024px / JPEG 0.85），
    // 此处不再二次压缩，避免把头像/图片压到 360px 0.4 导致模糊（参考 milk 头像保留策略）
    function G(t, e) {
      var n = new FileReader();
      n.onload = function (t) {
        e(t.target.result || "");
      };
      n.onerror = function () {
        e("");
      };
      try {
        n.readAsDataURL(t);
      } catch (err) {
        e("");
      }
    }
    (_idbStore.get("akini_icity_diaries", function (t) {
      var e = !1,
        n = null;
      try {
        n = localStorage.getItem("akini_icity_diaries");
      } catch (t) {}
      // localStorage 版本只有在比当前内存 F（可能已含用户新评论）评论更多时才使用，
      // 防止慢速 IDB 回调返回时用旧版 localStorage 覆盖内存中的新评论
      if (n)
        try {
          var i = JSON.parse(n);
          if (Array.isArray(i) && i.length > 0) {
            var fCmtCount = 0;
            if (F && F.length)
              F.forEach(function (d) { d && d.comments && (fCmtCount += d.comments.length); });
            var nCmtCount = 0;
            i.forEach(function (d) { d && d.comments && (nCmtCount += d.comments.length); });
            if (!F || !F.length || nCmtCount > fCmtCount) {
              F = i;
              e = !0;
            }
          }
        } catch (t) {}
      ($(t, !0) && (e = !0),
        F || (F = q()),
        e && "function" == typeof renderIcity && renderIcity());
    }),
      _idbStore.get("akini_icity_diaries_backup", function (t) {
        $(t, !0) && "function" == typeof renderIcity && renderIcity();
      }),
      // 朋友圈/评论从 IDB 兜底恢复，防止 localStorage 清空导致数据丢失
      _idbStore.get("akini_posts", function (t) {
        __akiniMergeFriendsPostsFromIDB(t);
      }),
      _idbStore.get("akini_posts_backup", function (t) {
        __akiniMergeFriendsPostsFromIDB(t);
      }),
      (window.getCurrentStickerContactId = J));
    const U = document.getElementById("chatBody"),
      K = document.getElementById("msgInput"),
      X = document.getElementById("sendBtn");
    var Y = document.getElementById("chatMenuOverlay"),
      Q = document.getElementById("menuBg");
    // ========== 开屏动画：进度条 + 收尾隐藏 ==========
    window.__akiniSplashProgress = 0;
    window.__akiniSplashDone = !1;
    window.__akiniSetSplashProgress = function (p) {
      try {
        if (window.__akiniSplashDone) return;
        window.__akiniSplashProgress = Math.max(window.__akiniSplashProgress, Math.min(100, p));
        var bar = document.getElementById("akiniSplashBar");
        if (bar) bar.style.width = window.__akiniSplashProgress + "%";
        var st = document.getElementById("akiniSplashStatus");
        if (st) st.textContent = window.__akiniSplashProgress >= 100 ? "已准备好" : "正在进入";
        var btn = document.getElementById("akiniSplashEnterBtn");
        if (btn && window.__akiniSplashProgress >= 100) {
          btn.style.display = "inline-block";
          btn.textContent = "进入";
        }
      } catch (e) {}
    };
    window.__akiniHideSplash = function () {
      try {
        if (window.__akiniSplashDone) return;
        window.__akiniSplashDone = !0;
        window.__akiniSetSplashProgress && window.__akiniSetSplashProgress(100);
        var el = document.getElementById("akiniSplash");
        if (!el) return;
        el.style.opacity = "0";
        setTimeout(function () { if (el && el.parentNode) el.parentNode.removeChild(el); }, 420);
      } catch (e) {}
    };
    // 绑定手动进入按钮：加载完成前不隐藏，点击后才进入主界面
    (function bindSplashEnter() {
      var btn = document.getElementById("akiniSplashEnterBtn");
      if (!btn) return;
      btn.addEventListener("click", function () {
        if (window.__akiniHideSplash) window.__akiniHideSplash();
      });
    })();
    function __akiniBootApp(t) {
      if (window.__akiniBooted) return;
      window.__akiniBooted = !0;
      setTimeout(function () {
        window._restoringData = !1;
        window._akiniDataRestored = !0;
        console.log("[Akini] boot complete, data restore gate open");
        // 恢复完成后统一刷新界面，避免多条恢复路径重复 resetCache
        if (window.akiniContacts && window.akiniContacts.resetCache) window.akiniContacts.resetCache();
        // 恢复完成后执行一次联系人迁移，首次使用时会创建默认联系人
        try {
          window.akiniContacts && window.akiniContacts.migrateContacts && window.akiniContacts.migrateContacts();
        } catch (e) {}
        // 强制从已恢复的内存缓存/IDB 重新读取关键数据，避免启动期间 q()/O() 因 F/z 已被 [] 占用而不再读权威数据
        try { F = null; z = null; _postsIdbLoaded = false; } catch (e) {}
        if ("function" == typeof window.renderChatList) window.renderChatList();
        if ("function" == typeof window._renderIcity) window._renderIcity();
        if ("function" == typeof window.updatePreview) window.updatePreview();
        // 开屏动画：加载完成后显示「进入」按钮，由用户手动点击进入，不自动跳转
        window.__akiniSetSplashProgress && window.__akiniSetSplashProgress(100);
        // 不自动调用 __akiniHideSplash，等待用户点击 #akiniSplashEnterBtn
      }, 300);
      if (
        (window.__akiniAvatarCache &&
          ((window.__akiniAvatarCache.my = ""),
          (window.__akiniAvatarCache.ta = "")),
        window.akiniContacts)
      ) {
        (window.akiniContacts.resetCache && window.akiniContacts.resetCache(),
          window.akiniContacts.migrateContacts());
        var e = window.akiniContacts.getActiveChatId();
        if (!e) {
          var n = window.akiniContacts.getContacts(),
            i = n[0];
          i && (window.akiniContacts.setActiveChatId(i.id), (e = i.id));
        }
        U &&
          e &&
          (function (t) {
            if (!window.akiniContacts) return void (t && t(""));
            var e = window.akiniContacts.getActiveChatId();
            if (!e) return void (t && t(""));
            var n = window.akiniContacts.getSession(e) || {},
              i = n.messagesHTML || "",
              a = E[e] || "";
            function o(n) {
              (n && window.akiniContacts.updateSession(e, { messagesHTML: n }),
                t && t(n || ""));
            }
            var lsCrit = "";
            try {
              lsCrit = localStorage.getItem("akini_chat_critical_" + e) || "";
            } catch (e) {}
            var r = tt(i, a, lsCrit, "");
            r && o(r);
            // 优先从 localStorage 恢复（同步写入，最可靠）
            try {
              var lsMain =
                localStorage.getItem("akini_chat_history_" + e) ||
                localStorage.getItem("akini_chat_history_backup_" + e);
              if (lsMain) {
                var best = tt(i, a, lsMain, lsCrit);
                best && best.length > (r ? r.length : 0) && o(best);
              }
            } catch (e) {}
            _idbStore.get("akini_chat_history_" + e, function (t) {
              if (window.akiniContacts.getActiveChatId() !== e) return;
              var n = tt(i, a, t || "", lsCrit);
              n && n.length > (r ? r.length : 0)
                ? o(n)
                : _idbStore.get("akini_chat_history_backup_" + e, function (t) {
                    if (window.akiniContacts.getActiveChatId() !== e) return;
                    (n = tt(i, a, t || "", lsCrit)) && n.length > (r ? r.length : 0)
                      ? o(n)
                      : r || o("");
                  });
            });
          })(function (t) {
            if (t) {
              var clean = __akiniDeduplicateChatHTML(t);
              // 把完整记录存回会话，但只渲染最近一批，避免 DOM 过大崩溃
              if (clean !== t) {
                try {
                  window.akiniContacts.updateSession(e, { messagesHTML: clean });
                  C(e, clean);
                } catch (x) {}
              }
              __akiniRenderChatBody(clean, e);
            }
            requestAnimationFrame(function () {
              __akiniSetupChatMetaObserver();
            });
          });
      }
      ("function" == typeof ot && ot(),
        xt(),
        "function" == typeof renderHomeAvatarContacts &&
          renderHomeAvatarContacts(),
        et(),
        Tn());
      try {
        if (window.akiniContacts && window.akiniContacts.getSessions) {
          var sessions = window.akiniContacts.getSessions();
          for (var sid in sessions)
            if (sessions.hasOwnProperty(sid)) {
              var sess = sessions[sid];
              if (sess && sess.messagesHTML) {
                var clean = __akiniDeduplicateChatHTML(sess.messagesHTML);
                if (clean !== sess.messagesHTML) {
                  window.akiniContacts.updateSession(sid, { messagesHTML: clean });
                  C(sid, clean);
                }
              }
            }
        }
      } catch (t) {}
      try {
        var a = localStorage.getItem("akini_wordbank") || "[]";
        0 === JSON.parse(a).length &&
          window.akiniContacts &&
          window.akiniContacts.restoreFromIDB &&
          window.akiniContacts.restoreFromIDB("akini_wordbank", function (t) {
            if (t && Array.isArray(t) && t.length > 0) {
              try {
                localStorage.setItem("akini_wordbank", JSON.stringify(t));
              } catch (t) {}
              ("function" == typeof renderWordbank && renderWordbank(),
                "function" == typeof renderGroupFilter && renderGroupFilter());
            }
          });
        var o = localStorage.getItem("akini_wb_groups") || "[]";
        0 === JSON.parse(o).length &&
          window.akiniContacts &&
          window.akiniContacts.restoreFromIDB &&
          window.akiniContacts.restoreFromIDB("akini_wb_groups", function (t) {
            if (t && Array.isArray(t) && t.length > 0)
              try {
                localStorage.setItem("akini_wb_groups", JSON.stringify(t));
              } catch (t) {}
          });
      } catch (t) {}
      setTimeout(function () {
        try {
          (et(),
            Tn(),
            "function" == typeof window._renderIcity && window._renderIcity(),
            "function" == typeof window._renderIcityContactProfiles &&
              window._renderIcityContactProfiles(),
            "function" == typeof window._renderPosts && window._renderPosts());
        } catch (t) {}
      }, 300);
    }
    function V() {
      try {
        (A(),
          window._idbStore &&
            window._idbStore.backupAll &&
            window._idbStore.backupAll(),
          localStorage.length > 0 &&
            window._akiniCacheStore &&
            window._akiniCacheStore.backupAll &&
            window._akiniCacheStore.backupAll(),
          window.akiniContacts &&
            window.akiniContacts.backupToIDB &&
            (window.akiniContacts.backupToIDB(
              "akini_contacts",
              window.akiniContacts.getContacts(),
            ),
            window.akiniContacts.backupToIDB(
              "akini_groups",
              window.akiniContacts.getGroups(),
            ),
            window.akiniContacts.backupToIDB(
              "akini_chat_sessions",
              window.akiniContacts.getSessions(),
            )));
      } catch (t) {
        console.warn("forceBackupNow error", t);
      }
    }
    function tt() {
      for (var t = [], e = 0; e < arguments.length; e++) {
        var n = arguments[e];
        n && "string" == typeof n && "" !== n.trim() && t.push(n);
      }
      if (0 === t.length) return "";
      if (1 === t.length) return t[0];
      // 数据量过大时直接返回最长记录
      var longest = t.reduce(function (a, b) {
        return a.length >= b.length ? a : b;
      });
      if (longest.length > 300000 || __akiniCountMsgRows(longest) > 2000) {
        return longest;
      }
      // 聊天记录一条都不能丢：不再跨来源合并去重，直接选择消息行数最多的完整来源
      // 用户连续发送的相同内容消息 outerHTML 完全相同，合并去重会误删为一条
      var best = t[0],
        bestRows = __akiniCountMsgRows(best);
      for (var i = 1; i < t.length; i++) {
        var rows = __akiniCountMsgRows(t[i]);
        if (rows > bestRows) {
          best = t[i];
          bestRows = rows;
        }
      }
      return best;
    }
    // 聊天 HTML 透传：一条都不能丢，不再去重
    function __akiniDeduplicateChatHTML(html) {
      return html || "";
    }
    function et() {
      function t(t) {
        return (
          t &&
          "string" == typeof t &&
          t.trim().length > 0 &&
          "null" !== t.trim() &&
          "undefined" !== t.trim()
        );
      }
      function e() {
        var e = "";
        try {
          e = localStorage.getItem("akini_my_avatar") || "";
        } catch (t) {}
        (t(e) && (u("my", e), Tn()),
          t(e) ||
            _idbStore.get("akini_my_avatar", function (e) {
              if (t(e)) {
                try {
                  localStorage.setItem("akini_my_avatar", e);
                } catch (t) {}
                (u("my", e), Tn());
              }
            }));
      }
      function n() {
        var e = "";
        try {
          e = localStorage.getItem("akini_ta_avatar") || "";
        } catch (t) {}
        (t(e) && (u("ta", e), Tn()),
          t(e) ||
            _idbStore.get("akini_ta_avatar", function (e) {
              if (t(e)) {
                try {
                  localStorage.setItem("akini_ta_avatar", e);
                } catch (t) {}
                (u("ta", e), Tn());
              }
            }));
      }
      (e(), n());
    }
    function nt(t, e) {
      return (
        (e = e || 40),
        (t && "string" == typeof t && t.trim()) || (t = "🐰"),
        0 === t.indexOf("<img")
          ? t
          : 0 === t.indexOf("data:") || 0 === t.indexOf("http")
            ? '<img src="' +
              t.replace(/"/g, "&quot;") +
              '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">'
            : '<span style="font-size:' +
              Math.round(0.55 * e) +
              'px;">' +
              t +
              "</span>"
      );
    }
    function it(t, e) {
      if (((e = e || ""), !t || "string" != typeof t)) return e;
      if (!(t = t.trim())) return e;
      if (0 === t.indexOf("<img")) {
        var n = t.match(/src="([^"]*)"/);
        if (!n || !n[1]) return e;
        t = n[1];
      }
      return 0 === t.indexOf("data:") || 0 === t.indexOf("http")
        ? '<img src="' +
            t.replace(/"/g, "&quot;") +
            '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">'
        : t || e;
    }
    ((window._restoringData = !0),
      // 安全兜底：无论异步恢复链是否正常回调，最多 6 秒后强制打开恢复门，
      // 防止 tryRestoreFromBackup 异常导致 _restoringData 永久卡住、数据无法读写
      setTimeout(function () {
        if (window._restoringData) {
          console.warn("[Akini] restore timeout, force opening data gate");
          __akiniBootApp();
        }
      }, 6000),
      window.__akiniSetSplashProgress && window.__akiniSetSplashProgress(30),
      window._idbStore.restoreAll(function () {
        window.__akiniSetSplashProgress && window.__akiniSetSplashProgress(70);
        window.akiniContacts && window.akiniContacts.tryRestoreFromBackup
          ? window.akiniContacts.tryRestoreFromBackup(__akiniBootApp)
          : __akiniBootApp();
        try {
          window.__csCache = window.__csCache || {};
          if (window.akiniContacts && window.akiniContacts.getContacts) {
            window.akiniContacts.getContacts().forEach(function (c) {
              var k = "akini_stickers_" + c.id;
              if (window._idbStore && window._idbStore.get) {
                window._idbStore.get(k, function (v) {
                  try {
                    window.__csCache[k] = JSON.parse(v || "[]");
                  } catch (e) {
                    window.__csCache[k] = [];
                  }
                });
              }
            });
          }
        } catch (e) {
          console.warn("[Akini] csCache load error", e);
        }
      }),
      setInterval(function () {
        if (document.hidden || window._restoringData) return;
        window._idbStore &&
          window._idbStore.backupAll &&
          window._idbStore.backupAll();
        try {
          for (var t = {}, e = 0; e < localStorage.length; e++) {
            var n = localStorage.key(e);
            n && (t[n] = localStorage.getItem(n));
          }
          window._idbStore &&
            window._idbStore.set &&
            (window._idbStore.set(
              "akini_localstorage_snapshot",
              JSON.stringify(t),
            ),
            window._idbStore.set(
              "akini_localstorage_snapshot_backup",
              JSON.stringify(t),
            ));
        } catch (t) {}
        if (window.akiniContacts && window.akiniContacts.backupToIDB) {
          (window.akiniContacts.backupToIDB(
            "akini_contacts",
            window.akiniContacts.getContacts(),
          ),
            window.akiniContacts.backupToIDB(
              "akini_groups",
              window.akiniContacts.getGroups(),
            ),
            window.akiniContacts.backupToIDB(
              "akini_chat_sessions",
              window.akiniContacts.getSessions(),
            ));
          var _wb = i("akini_wordbank", []);
          window.akiniContacts.backupToIDB("akini_wordbank", _wb);
          var _wbg = i("akini_wb_groups_main", []);
          window.akiniContacts.backupToIDB("akini_wb_groups", _wbg);
        }
      }, 10000));
    function flushAllData() {
      try {
        if (window._restoringData) return;
        try {
          "function" == typeof A && A();
        } catch (e) {}
        if (window._idbStore && window._idbStore.backupAll)
          window._idbStore.backupAll();
        if (
          window._akiniCacheStore &&
          window._akiniCacheStore.backupAll &&
          localStorage.length > 0
        )
          window._akiniCacheStore.backupAll();
        var snapshot = {};
        for (var e = 0; e < localStorage.length; e++) {
          var key = localStorage.key(e);
          key && (snapshot[key] = localStorage.getItem(key));
        }
        if (window._idbStore && window._idbStore.set) {
          window._idbStore.set(
            "akini_localstorage_snapshot",
            JSON.stringify(snapshot),
          );
          window._idbStore.set(
            "akini_localstorage_snapshot_backup",
            JSON.stringify(snapshot),
          );
        }
        if (window.akiniContacts && window.akiniContacts.backupToIDB) {
          window.akiniContacts.backupToIDB(
            "akini_contacts",
            window.akiniContacts.getContacts(),
          );
          window.akiniContacts.backupToIDB(
            "akini_groups",
            window.akiniContacts.getGroups(),
          );
          var sessions = window.akiniContacts.getSessions();
          window.akiniContacts.backupToIDB("akini_chat_sessions", sessions);
          for (var sid in sessions) {
            var sess = sessions[sid];
            if (sess && sess.messagesHTML && "" !== sess.messagesHTML.trim()) {
              try {
                window._idbStore.set(
                  "akini_chat_history_" + sid,
                  sess.messagesHTML,
                );
                window._idbStore.set(
                  "akini_chat_history_backup_" + sid,
                  sess.messagesHTML,
                );
              } catch (e) {}
            }
          }
        }
      } catch (e) {
        console.warn("flushAllData error:", e);
      }
    }
    ((window._flushAllData = flushAllData),
      window.addEventListener("beforeunload", function () {
        V();
        try {
          flushAllData();
        } catch (t) {}
      }),
      window.addEventListener("pagehide", function () {
        try {
          V();
        } catch (t) {}
        try {
          flushAllData();
        } catch (t) {}
      }),
      document.addEventListener("visibilitychange", function () {
        if (document.hidden) {
          try {
            V();
          } catch (t) {}
          try {
            flushAllData();
          } catch (t) {}
        } else if (U && window.akiniContacts) {
          try {
            var e = window.akiniContacts.getActiveChatId();
            if (e && (!U.innerHTML || "" === U.innerHTML.trim())) {
              var sess = window.akiniContacts.getSession(e);
              if (sess && sess.messagesHTML && "" !== sess.messagesHTML.trim()) {
                __akiniRenderChatBody(__akiniDeduplicateChatHTML(sess.messagesHTML), e);
              }
            }
          } catch (t) {}
        }
      }),
      window.addEventListener("pageshow", function (t) {
        if (t.persisted) {
          window._akiniCacheStore &&
            window._akiniCacheStore.restoreAll &&
            window._akiniCacheStore.restoreAll(function () {
              window._idbStore &&
                window._idbStore.restoreAll &&
                window._idbStore.restoreAll(function () {
                  window._akiniRestoreFromSnapshot &&
                    window._akiniRestoreFromSnapshot(function () {
                      window.akiniContacts &&
                        window.akiniContacts.tryRestoreFromBackup &&
                        window.akiniContacts.tryRestoreFromBackup(
                          __akiniBootApp,
                        );
                    });
                });
            });
        }
      }),
      // 定期备份到 IndexedDB：移动端 beforeunload/pagehide 不可靠，靠定时器保证数据落盘
      setInterval(function () {
        try {
          if (window._restoringData || window._restoringChatHistory) return;
          V();
        } catch (t) {}
      }, 15000),
      (window._restoringChatHistory = !0),
      U && (U.innerHTML = ""),
      setTimeout(function () {
        window._restoringChatHistory = !1;
        window._restoringData = !1;
      }, 3000),
      setInterval(function () {
        try {
          if (document.hidden || window._restoringData || window._restoringChatHistory) return;
          if (!U || !window.akiniContacts) return;
          var e = window.akiniContacts.getActiveChatId();
          if (!e) return;
          var sess = window.akiniContacts.getSession(e);
          var fullHtml = (sess && sess.messagesHTML) || "";
          if (fullHtml.trim()) {
            var dedupedHtml = __akiniDeduplicateChatHTML(fullHtml);
            if (dedupedHtml !== fullHtml) {
              fullHtml = dedupedHtml;
              window.akiniContacts.updateSession(e, { messagesHTML: fullHtml });
            }
            if (!window._restoringChatHistory) {
              C(e, fullHtml);
            }
            // 若当前 DOM 为空则渲染最近一批
            if (!U.innerHTML || "" === U.innerHTML.trim()) {
              __akiniRenderChatBody(fullHtml, e);
            }
            return;
          }
          _idbStore.get("akini_chat_history_" + e, function (t) {
            if (!t || "" === t.trim()) return;
            if (window.akiniContacts.getActiveChatId() !== e) return;
            if (window._restoringChatHistory) return;
            if (U.innerHTML && "" !== U.innerHTML.trim()) return;
            __akiniRenderChatBody(__akiniDeduplicateChatHTML(t), e);
            window.akiniContacts.updateSession(e, { messagesHTML: t });
          });
        } catch (e) {}
      }, 10000),
      (window.renderAvatarHtml = nt),
      (window.renderAvatarFill = it));
    var at = null;
    function _akPinGet() {
      try {
        var t = localStorage.getItem("akini_chat_pins");
        return t ? JSON.parse(t) : [];
      } catch (t) {
        return [];
      }
    }
    function _akPinSet(t) {
      if (window.akiniStore && window.akiniStore.setJson) {
        window.akiniStore.setJson("akini_chat_pins", t || []);
      } else {
        try { localStorage.setItem("akini_chat_pins", JSON.stringify(t || [])); } catch (t) {}
      }
    }
    function _akPinRemove(t) {
      var e = _akPinGet();
      if (!e) return !1;
      var n = e.indexOf(t);
      return (n >= 0 && (e.splice(n, 1), _akPinSet(e)), !1);
    }
    function _akPinToggle(t) {
      var e = _akPinGet();
      return e.indexOf(t) >= 0
        ? (e.splice(e.indexOf(t), 1), _akPinSet(e), !1)
        : (e.push(t), _akPinSet(e), !0);
    }
    function _akPinList() {
      return _akPinGet();
    }
    function ot() {
      (at && clearTimeout(at),
        (at = setTimeout(function () {
          ((at = null),
            (function () {
              var t = document.getElementById("chatListBody");
              if (!t || !window.akiniContacts) return;
              var e = window.akiniContacts.getContacts(),
                n = window.akiniContacts.getGroups(),
                i = window.akiniContacts.getSessions(),
                o = "";
              if (0 === e.length && 0 === n.length)
                return void (t.innerHTML =
                  '<div class="chat-list-empty">暂无联系人，去通讯录添加吧</div>');
              function r(t) {
                var e = t.messagesHTML || "",
                  n = t.lastMsg || "";
                if (n && !1 === /(未接来电|拒接来电|取消来电|通话时长)/.test(n))
                  return n;
                if (!e)
                  return /(未接来电|拒接来电|取消来电|通话时长)/.test(n)
                    ? ""
                    : n;
                var i = document.createElement("div");
                i.innerHTML = e;
                for (
                  var a = Array.from(i.querySelectorAll(".msg-row")),
                    o = a.length - 1;
                  o >= 0;
                  o--
                ) {
                  var r = a[o];
                  if (r.classList.contains("system")) {
                    var c = (r.textContent || "").trim();
                    if (/(未接来电|拒接来电|取消来电|通话时长)/.test(c))
                      continue;
                    return c;
                  }
                  var l = r.querySelector(".bubble");
                  if (l) {
                    if (l.querySelector("img") && "" === l.textContent.trim())
                      return "【表情包】";
                    if (
                      l.classList &&
                      l.classList.contains("transfer-bubble")
                    ) {
                      var s = l.querySelector('div[style*="font-weight:700"]');
                      return "【转账】" + (s ? s.textContent.trim() : "");
                    }
                    if ((c = l.textContent.trim())) return c;
                  }
                }
                return "";
              }
              function c(t) {
                if (t.lastSenderName) return t.lastSenderName;
                var e = t.messagesHTML || "";
                if (!e) return "";
                var n = document.createElement("div");
                n.innerHTML = e;
                for (
                  var i = Array.from(n.querySelectorAll(".msg-row")),
                    a = i.length - 1;
                  a >= 0;
                  a--
                ) {
                  var o = i[a];
                  if (o.classList.contains("system")) {
                    var r = (o.textContent || "").trim();
                    if (/(未接来电|拒接来电|取消来电|通话时长)/.test(r))
                      continue;
                    var c = r.match(/^([^\s：:]+)[\s：:]/);
                    return c ? c[1].trim() : "";
                  }
                  var l = o.querySelector(".msg-sender-name");
                  if (l) return l.textContent.trim();
                  var s = o.querySelector(".msg-avatar[data-sender-name]");
                  if (s) return s.getAttribute("data-sender-name") || "";
                }
                return "";
              }
              var l = [];
              (e.forEach(function (t) {
                var e = i[t.id] || {};
                l.push({
                  id: t.id,
                  type: "contact",
                  name: t.name,
                  avatar: t.avatar,
                  lastMsg: r(e),
                  lastSenderName: c(e),
                  lastTime: e.lastTime || 0,
                  unread: e.unread || 0,
                });
              }),
                n.forEach(function (t) {
                  var e = i[t.id] || {},
                    n = t.avatar;
                  l.push({
                    id: t.id,
                    type: "group",
                    name: t.name,
                    avatar: t.avatar,
                    displayAvatar: n,
                    lastMsg: r(e),
                    lastSenderName: c(e),
                    lastTime: e.lastTime || 0,
                    unread: e.unread || 0,
                  });
                }));
              var p = _akPinList();
              (l.forEach(function (t) {
                t.pinned = p.indexOf(t.id) >= 0;
              }),
                l.sort(function (t, e) {
                  return t.pinned && !e.pinned
                    ? -1
                    : !t.pinned && e.pinned
                      ? 1
                      : e.lastTime - t.lastTime;
                }),
                l.forEach(function (t) {
                  var e = t.lastTime
                      ? new Date(t.lastTime).toLocaleTimeString("zh-CN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "",
                    n = t.displayAvatar || t.avatar,
                    i = t.unread
                      ? '<span class="cli-unread-badge">' + t.unread + "</span>"
                      : "",
                    a = t.pinned
                      ? '<span style="display:inline-block;margin-left:4px;font-size:11px;color:#07c160;">📌</span>'
                      : "",
                    r = t.pinned ? "取消置顶" : "置顶";
                  o +=
                    '<div class="chat-list-item" data-id="' +
                    t.id +
                    '" data-type="' +
                    t.type +
                    '" data-pinned="' +
                    t.pinned +
                    '"><div class="chat-list-item-inner"><div class="cli-avatar">' +
                    nt(n, 48) +
                    i +
                    '</div><div class="cli-info"><div class="cli-name">' +
                    rt(t.name) +
                    a +
                    '</div></div><div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;justify-content:center;height:48px;"><div style="font-size:11px;color:#bbb;">' +
                    e +
                    '</div></div></div><div class="chat-list-actions"><button type="button" class="chat-list-pin-btn" data-id="' +
                    t.id +
                    '">' +
                    r +
                    "</button></div></div>";
                }),
                (t.innerHTML = o),
                t.querySelectorAll(".chat-list-item").forEach(function (t) {
                  function e(e) {
                    e && (e.stopPropagation(), e.preventDefault());
                    var n = t.getAttribute("data-id");
                    n && ct(n);
                  }
                  function n(e) {
                    if (!e) return e;
                    var n = t.getAttribute("data-id");
                    if (!n) return e;
                    e.preventDefault();
                    var i = t.querySelector(".chat-list-actions button"),
                      a = _akPinToggle(n);
                    i && (i.textContent = a ? "取消置顶" : "置顶");
                    var r = t.querySelector(".chat-list-item-inner .cli-name");
                    if (r) {
                      var c = r.querySelector("span");
                      c && c.remove();
                      if (a) {
                        var l = document.createElement("span");
                        ((l.style.cssText =
                          "display:inline-block;margin-left:4px;font-size:11px;color:#07c160;"),
                          (l.textContent = "📌"),
                          r.appendChild(l));
                      }
                    }
                    t.classList.remove("show-actions");
                    (document
                      .querySelectorAll(".chat-list-item")
                      .forEach(function (t) {
                        t.classList.remove("show-actions");
                      }),
                      ot());
                  }
                  function i(e) {
                    var n = e.touches[0];
                    ((t._swipeStartX = n.clientX),
                      (t._swipeStartY = n.clientY),
                      (t._swipeMoved = !1));
                  }
                  function r(e) {
                    if (!t._swipeStartX) return;
                    var n = e.touches[0],
                      i = n.clientX - t._swipeStartX,
                      a = n.clientY - t._swipeStartY;
                    (Math.abs(a) > 10 && (t._swipeStartX = null),
                      i > 30 &&
                        Math.abs(i) > Math.abs(a) &&
                        ((t._swipeMoved = !0),
                        document
                          .querySelectorAll(".chat-list-item")
                          .forEach(function (t) {
                            t.classList.remove("show-actions");
                          }),
                        t.classList.add("show-actions")));
                  }
                  function c(e) {
                    ((t._swipeStartX = null),
                      t._swipeMoved && (t._swipeMoved = !1));
                  }
                  t._chatItemBound ||
                    ((t._chatItemBound = !0),
                    a(t, e),
                    t.addEventListener("touchstart", i, { passive: !0 }),
                    t.addEventListener("touchmove", r, { passive: !0 }),
                    t.addEventListener("touchend", c, { passive: !0 }),
                    t.addEventListener("click", function (e) {
                      e.target.closest(".chat-list-actions") ||
                        document
                          .querySelectorAll(".chat-list-item")
                          .forEach(function (t) {
                            t.classList.remove("show-actions");
                          });
                    }));
                  var l = t.querySelector(".chat-list-pin-btn");
                  l &&
                    !l._pinBound &&
                    ((l._pinBound = !0),
                    l.addEventListener("click", function (e) {
                      (e.stopPropagation(), e.preventDefault(), n());
                    }));
                }));
            })());
        }, 100)));
    }
    window.renderChatList = ot;
    function rt(t) {
      return t
        ? t
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
        : "";
    }
    function ct(t, e) {
      if (window.akiniContacts) {
        window._akiniLastChatId = t;
        A();
        if (U) {
          var __rendered = U.getAttribute("data-rendered-chat-id");
          __rendered !== t && (U.innerHTML = "");
          U.querySelectorAll('[id^="typingBubbleRow_"]').forEach(function (el) {
            el.remove();
          });
          U.setAttribute("data-rendered-chat-id", t);
        }
        (window.akiniContacts.setActiveChatId(t),
          window.akiniContacts.updateSession(t, { unread: 0 }));
        if (window.__akiniTypingMap) {
          var __typing = window.__akiniTypingMap[t];
          __typing &&
            (__typing.timer && clearTimeout(__typing.timer),
            delete window.__akiniTypingMap[t]);
        }
        bt();
        // 优先合并内存会话、本地 localStorage 备份和内存缓存，取最长非空聊天记录
        var ls1 = "",
          ls2 = "",
          lsCrit = "";
        try {
          ls1 = localStorage.getItem("akini_chat_history_" + t) || "";
        } catch (e) {}
        try {
          ls2 = localStorage.getItem("akini_chat_history_backup_" + t) || "";
        } catch (e) {}
        try {
          lsCrit = localStorage.getItem("akini_chat_critical_" + t) || "";
        } catch (e) {}
        var r = tt(
          window.akiniContacts.getSession(t).messagesHTML || "",
          E[t] || "",
          ls1,
          ls2,
          lsCrit,
        );
        // 同步源为空时，先保留旧 DOM/内存内容，避免空白闪烁；IDB 恢复后再更新
        var _prevHTML = U ? U.innerHTML : "";
        (r
          ? (window.akiniContacts.updateSession(t, { messagesHTML: r }), l(r))
          : (_prevHTML ? l(_prevHTML) : l("")),
          Tn(),
          _idbStore.get("akini_chat_history_" + t, function (a) {
            if (window.akiniContacts.getActiveChatId() !== t) return;
            var o = tt(U.innerHTML || "", window.akiniContacts.getSession(t).messagesHTML || r, "", a || "", lsCrit);
            if (o && o.length > (r ? r.length : 0))
              return (
                window.akiniContacts.updateSession(t, { messagesHTML: o }),
                void l(o)
              );
            _idbStore.get("akini_chat_history_backup_" + t, function (a) {
              if (window.akiniContacts.getActiveChatId() !== t) return;
              (o = tt(U.innerHTML || "", window.akiniContacts.getSession(t).messagesHTML || r, "", a || "", lsCrit)) &&
                o.length > (r ? r.length : 0) &&
                (window.akiniContacts.updateSession(t, { messagesHTML: o }),
                l(o));
              var c = window.akiniContacts.getSession(t);
              c._seeded = !0;
            });
          }),
          lt(),
          Tn());
        var c = document.getElementById("typingIndicator");
        (c && (c.style.display = "none"), st(t), me(), e || o("chat"));
      }
      function l(t) {
        U &&
          ((window._restoringChatHistory = !0),
          __akiniRenderChatBody(t || "", window.akiniContacts ? window.akiniContacts.getActiveChatId() : ""),
          requestAnimationFrame(function () {
            U.scrollTop = U.scrollHeight;
          }),
          setTimeout(function () {
            window._restoringChatHistory = !1;
            try {
              if (document.getElementById("chatBody")) {
                document
                  .querySelectorAll(".bubble.survey-bubble[data-survey-id]")
                  .forEach(function (b) {
                    var sid = b.getAttribute("data-survey-id");
                    if (window.surveys && Array.isArray(window.surveys)) {
                      var s = window.surveys.find(function (x) {
                        return x.id === sid;
                      });
                      if (s && s.replied) {
                        var st = b.querySelector(".survey-bubble-status");
                        if (st) st.textContent = "已回答";
                      }
                    }
                    if (!b.getAttribute("data-click-bound")) {
                      b.setAttribute("data-click-bound", "1");
                      b.style.cursor = "pointer";
                      b.style.webkitTapHighlightColor = "transparent";
                      b.style.touchAction = "manipulation";
                      b.addEventListener("click", function (e) {
                        e.preventDefault && e.preventDefault();
                        e.stopPropagation && e.stopPropagation();
                        var sid = this.getAttribute("data-survey-id");
                        var mid = this.getAttribute("data-member-id");
                        if (sid && window.__akiniOpenSurveyById) {
                          window.__akiniOpenSurveyById(sid, mid, true);
                        }
                      });
                    }
                  });
              }
            } catch (e) {}
            var cid =
              window.akiniContacts && window.akiniContacts.getActiveChatId();
            if (
              cid &&
              window.__akiniTypingMap &&
              window.__akiniTypingMap[cid]
            ) {
              var cb = document.getElementById("chatBody");
              if (cb) {
                cb.appendChild(window.__akiniTypingMap[cid].row);
                cb.scrollTop = cb.scrollHeight;
              }
            }
          }, 50));
      }
    }
    function lt() {
      if (window.akiniContacts) {
        var t = window.akiniContacts.getChatTarget(
          window.akiniContacts.getActiveChatId(),
        );
        if (t) {
          var e = document.getElementById("chatTaName"),
            n = document.getElementById("chatTaAvatar"),
            i = document.getElementById("taMsgAvatar");
          var _curAv =
            (t.avatar && t.avatar.trim()) ||
            localStorage.getItem("akini_ta_avatar") ||
            localStorage.getItem("akini_icity_ta_avatar") ||
            "";
          /* 无头像时不渲染默认 🐰，用透明占位，避免先闪默认头像 */
          if (!_curAv) {
            n && ((n.style.visibility = "hidden"), (n.innerHTML = ""));
            i && ((i.style.visibility = "hidden"), (i.innerHTML = ""));
          } else {
            n && ((n.style.visibility = ""), (n.innerHTML = nt(_curAv, 38)));
            i && ((i.style.visibility = ""), (i.innerHTML = nt(_curAv, 38)));
          }
          (e && (e.textContent = t.name));
          /* 头像仍为空时异步从 IDB 恢复后重绘 */
          if (!_curAv && window._idbStore && window._idbStore.get) {
            _idbStore.get("akini_ta_avatar", function (_av) {
              if (
                _av &&
                window.akiniContacts.getActiveChatId() === t.id &&
                (localStorage.getItem("akini_ta_avatar") || "") !== _av
              ) {
                try {
                  localStorage.setItem("akini_ta_avatar", _av);
                } catch (_e) {}
                var _n2 = document.getElementById("chatTaAvatar"),
                  _i2 = document.getElementById("taMsgAvatar");
                (_n2 && ((_n2.style.visibility = ""), (_n2.innerHTML = nt(_av, 38))),
                  _i2 && ((_i2.style.visibility = ""), (_i2.innerHTML = nt(_av, 38))));
              }
            });
          }
          try {
            /* 只在 t.avatar 非空时覆盖本地缓存；避免空值把已恢复的头像清掉 */
            (t.avatar && t.avatar.trim()
              ? (localStorage.setItem("akini_ta_avatar", t.avatar),
                u("ta", t.avatar))
              : (localStorage.getItem("akini_ta_avatar") || "") === "" &&
                  localStorage.setItem("akini_ta_avatar", ""),
              t.avatar || "");
          } catch (e) {}
          var a = document.getElementById("inputTaName");
          a && (a.value = t.name);
          var o = document.getElementById("typingIndicator");
          o &&
            ((o.style.display = "none"),
            (o.innerHTML =
              '对方正在输入<span class="typing-dot">.</span><span class="typing-dot">.</span><span class="typing-dot">.</span>'));
        }
      }
    }
    function st(t) {
      const e = document.getElementById("chatBody");
      if (!e || !window.loadBgFromStorage) return;
      window.loadBgFromStorage("akini_chat_bg_" + t, function (n) {
        if (!n) {
          e.style.backgroundImage = "";
          e.style.backgroundSize = "";
          e.style.backgroundPosition = "";
          e.style.backgroundRepeat = "";
          e.setAttribute("data-current-bg", "");
          return;
        }
        // 当前已是同一张背景则不再重置，避免闪烁
        if (e.getAttribute("data-current-bg") === n) return;
        var img = new Image();
        img.onload = function () {
          if (window.akiniContacts && window.akiniContacts.getActiveChatId() !== t) return;
          e.style.backgroundImage = "url(" + n + ")";
          e.style.backgroundSize = "cover";
          e.style.backgroundPosition = "center";
          e.style.backgroundRepeat = "no-repeat";
          e.setAttribute("data-current-bg", n);
        };
        img.onerror = function () {
          e.style.backgroundImage = "";
          e.style.backgroundSize = "";
          e.style.backgroundPosition = "";
          e.style.backgroundRepeat = "";
          e.setAttribute("data-current-bg", "");
        };
        img.src = n;
      });
    }
    ((window.openChat = ct),
      (window.refreshChatHeader = lt),
      (window.applyChatBackground = st));
    var dt = [];
    function ut() {
      var t = document.getElementById("createGroupContactList"),
        e = document.getElementById("createGroupAvatarPreview"),
        n = document.getElementById("createGroupNameInput");
      if (t && window.akiniContacts) {
        ((dt = []),
          e &&
            (setHtmlKeepInput(e, nt("👥", 56)),
            e.setAttribute("data-avatar", "👥")),
          n && (n.value = ""));
        var i = window.akiniContacts.getContacts(),
          o = "";
        (i.forEach(function (t) {
          o +=
            '<div class="group-contact-item" data-id="' +
            t.id +
            '"><div class="gcc-checkbox"></div><div class="gcc-avatar">' +
            nt(t.avatar, 40) +
            '</div><div class="gcc-name">' +
            rt(t.name) +
            "</div></div>";
        }),
          (t.innerHTML = o),
          t.querySelectorAll(".group-contact-item").forEach(function (t) {
            a(t, function (e) {
              e && (e.stopPropagation(), e.preventDefault());
              var n = t.getAttribute("data-id"),
                i = t.querySelector(".gcc-checkbox"),
                a = dt.indexOf(n);
              a >= 0
                ? (dt.splice(a, 1), i && i.classList.remove("checked"))
                : (dt.push(n), i && i.classList.add("checked"));
            });
          }));
      }
    }
    var mt = document.getElementById("fileInputGroupAvatar"),
      ft = document.getElementById("createGroupAvatarPreview");
    ft &&
      mt &&
      mt.addEventListener("change", function () {
        var t = this.files[0];
        if (t) {
          var e = new FileReader();
          ((e.onload = function (t) {
            var e = t.target.result;
            ft &&
              (setHtmlKeepInput(ft, nt(e, 56)),
              ft.setAttribute("data-avatar", e));
          }),
            e.readAsDataURL(t),
            (this.value = ""));
        }
      });
    var gt = document.getElementById("createGroupBackBtn"),
      yt = document.getElementById("createGroupDoneBtn"),
      pt = document.getElementById("chatListBackBtn"),
      vt = document.getElementById("addContactBackBtn"),
      ht = document.getElementById("contactDetailBackBtn");
    (gt &&
      a(gt, function (t) {
        (t && (t.stopPropagation(), t.preventDefault()),
          window.__navBack
            ? window.__navBack() || o("chat-list")
            : o("chat-list"));
      }),
      yt &&
        a(yt, function (t) {
          (t && (t.stopPropagation(), t.preventDefault()),
            (function () {
              if (window.akiniContacts) {
                var t = document.getElementById("createGroupNameInput"),
                  e = document.getElementById("createGroupAvatarPreview"),
                  n = t ? t.value.trim() : "",
                  i = (e && e.getAttribute("data-avatar")) || "👥";
                dt.length < 2
                  ? alert("请至少选择 2 个联系人")
                  : n
                    ? (window.akiniContacts.addGroup(n, i, dt.slice()),
                      o("chat-list"))
                    : alert("请输入群聊名称");
              }
            })());
        }),
      pt &&
        a(pt, function (t) {
          (t && (t.stopPropagation(), t.preventDefault()),
            window.__navBack() || o(""));
        }),
      vt &&
        a(vt, function (t) {
          (t && (t.stopPropagation(), t.preventDefault()),
            window.__navBack() || o("chat-list"),
            _t("contacts"));
        }),
      ht &&
        a(ht, function (t) {
          (t && (t.stopPropagation(), t.preventDefault()),
            window.__navBack() || o("chat-list"),
            _t("contacts"));
        }));
    var wt = document.getElementById("chatListAddBtn");
    wt &&
      wt.addEventListener("click", function (t) {
        (t.stopPropagation(),
          o("contacts" === kt ? "add-contact" : "create-group"));
      });
    var kt = "wechat";
    function _t(t) {
      kt = t;
      var e = document.getElementById("wechatTabPanel"),
        n = document.getElementById("contactsTabPanel");
      (document.querySelectorAll(".chat-list-tab").forEach(function (e) {
        var n = e.getAttribute("data-tab") === t;
        e.classList.toggle("active", n);
        var i = e.querySelector(".chat-list-tab-label");
        (i && (i.style.color = n ? "#07c160" : "#666"),
          i && (i.style.fontWeight = n ? "600" : "400"));
      }),
        e && (e.style.display = "wechat" === t ? "flex" : "none"),
        n && (n.style.display = "contacts" === t ? "flex" : "none"));
      var i = document.getElementById("chatListTitle");
      (i && ("wechat" === t ? bt() : (i.textContent = "通讯录")),
        "wechat" === t && ot(),
        "contacts" === t && xt());
    }
    function bt() {
      var t = document.getElementById("chatListTitle");
      if (t && window.akiniContacts) {
        var e = window.akiniContacts.getSessions(),
          n = 0;
        (Object.keys(e).forEach(function (t) {
          n += e[t].unread || 0;
        }),
          (t.textContent = "微信" + (n > 0 ? "（" + n + "）" : "")));
      }
    }
    ((window.switchChatTab = _t),
      document.querySelectorAll(".chat-list-tab").forEach(function (t) {
        t.addEventListener("click", function () {
          _t(this.getAttribute("data-tab"));
        });
      }));
    var It = ot;
    function xt() {
      var t = document.getElementById("contactsListBody");
      if (t && window.akiniContacts) {
        var e = window.akiniContacts.getContacts(),
          n = "";
        (0 === e.length
          ? (n += '<div class="chat-list-empty">暂无联系人</div>')
          : ((n +=
              '<div style="background:#fff; border-radius:14px; overflow:hidden; margin:0 16px;">'),
            e.forEach(function (t) {
              n +=
                '<div class="contact-list-item" data-id="' +
                t.id +
                '"><div class="contact-avatar">' +
                nt(t.avatar, 40) +
                '</div><div class="contact-name">' +
                rt(t.name) +
                "</div></div>";
            }),
            (n += "</div>")),
          (t.innerHTML = n),
          t.querySelectorAll(".contact-list-item").forEach(function (t) {
            a(t, function (e) {
              (e && (e.stopPropagation(), e.preventDefault()),
                (function (t) {
                  if (!window.akiniContacts) return;
                  var e = window.akiniContacts.getContactById(t);
                  if (!e) return;
                  Et = t;
                  var n = document.getElementById("contactDetailAvatar"),
                    i = document.getElementById("contactDetailNameInput");
                  n &&
                    (setHtmlKeepInput(n, nt(e.avatar, 80)),
                    n.setAttribute("data-avatar", e.avatar));
                  i && (i.value = e.name);
                  o("contact-detail");
                })(t.getAttribute("data-id")));
            });
          }));
      }
    }
    ot = function () {
      (It(), bt());
    };
    var Et = null;
    var St = document.getElementById("contactDetailAvatar"),
      At = document.getElementById("fileInputContactDetailAvatar");
    St &&
      At &&
      At.addEventListener("change", function () {
        var t = this.files[0];
        t &&
          Et &&
          (G(t, function (t) {
            window.akiniContacts.updateContact(Et, { avatar: t });
            var e = document.getElementById("contactDetailAvatar");
            (e &&
              (setHtmlKeepInput(e, nt(t, 80)),
              e.setAttribute("data-avatar", t)),
              xt(),
              ot(),
              Tn(),
              "function" == typeof renderHomeAvatarContacts &&
                renderHomeAvatarContacts(),
              ut(),
              "function" == typeof window._renderIcity &&
                window._renderIcity());
          }),
          (this.value = ""));
      });
    var Ct = document.getElementById("contactDetailNameInput");
    Ct &&
      Ct.addEventListener("change", function () {
        if (Et) {
          var t,
            e,
            n = this.value.trim();
          if (n)
            (window.akiniContacts.updateContact(Et, { name: n }),
              window.akiniContacts.updateSession(Et, {
                lastMsg:
                  ((t = Et),
                  (e = window.akiniContacts.getSession(t)),
                  e.lastMsg || ""),
              }),
              xt(),
              ot(),
              Tn(),
              "function" == typeof renderHomeAvatarContacts &&
                renderHomeAvatarContacts(),
              ut(),
              "function" == typeof window._renderIcity &&
                window._renderIcity());
        }
      });
    var Bt = document.getElementById("contactDetailDeleteBtn");
    if (Bt) {
      function Tt(t) {
        (t && (t.stopPropagation(), t.preventDefault()),
          Et &&
            confirm("确定删除该联系人吗？相关聊天记录也会被删除。") &&
            window.akiniContacts.deleteContact(Et) &&
            ((Et = null),
            "function" == typeof renderHomeAvatarContacts &&
              renderHomeAvatarContacts(),
            "function" == typeof window._renderIcity && window._renderIcity(),
            Nt()));
      }
      (Bt.addEventListener("click", Tt),
        Bt.addEventListener("touchend", Tt, { passive: !1 }));
    }
    var Mt = "🐰",
      Lt = document.getElementById("addContactAvatarPreview"),
      Dt = document.getElementById("fileInputAddContactAvatar");
    function Nt() {
      try {
        if (typeof closeSurveyList === "function") closeSurveyList();
        if (typeof closeSurveyCreate === "function") closeSurveyCreate();
        if (typeof closeSurveyCreatedList === "function")
          closeSurveyCreatedList();
      } catch (e) {}
      (o("chat-list"), _t("contacts"));
    }
    (Lt &&
      Dt &&
      Dt.addEventListener("change", function () {
        var t = this.files[0];
        if (t) {
          var e = new FileReader();
          ((e.onload = function (t) {
            ((Mt = t.target.result),
              Lt &&
                (setHtmlKeepInput(Lt, nt(Mt, 80)),
                Lt.setAttribute("data-avatar", Mt)));
          }),
            e.readAsDataURL(t),
            (this.value = ""));
        }
      }),
      (window.backToContacts = Nt));
    var Pt = document.getElementById("addContactConfirmBtn");
    if (Pt) {
      a(Pt, function (t) {
        t && (t.stopPropagation(), t.preventDefault());
        var e = document.getElementById("addContactNameInput"),
          n = e ? e.value.trim() : "";
        if (n) {
          var a = Mt,
            o = window.akiniContacts.addContact(n, a);
          try {
            var r = i("akini_contact_stickers", {});
            ((r[o.id] = []),
              localStorage.setItem(
                "akini_contact_stickers",
                JSON.stringify(r),
              ));
          } catch (t) {}
          (e && (e.value = ""),
            (Mt = "🐰"),
            Lt &&
              (setHtmlKeepInput(Lt, nt("🐰", 80)),
              Lt.setAttribute("data-avatar", "🐰")),
            xt(),
            ot(),
            renderHomeAvatarContacts(),
            "function" == typeof window._renderIcity && window._renderIcity(),
            Nt());
        } else alert("请输入名字");
      });
    }
    var Ht = document.getElementById("chatBackBtn");
    Ht &&
      a(Ht, function (t) {
        t && (t.stopPropagation(), t.preventDefault());
        try {
          if (typeof closeSurveyList === "function") closeSurveyList();
          if (typeof closeSurveyCreate === "function") closeSurveyCreate();
          if (typeof closeSurveyCreatedList === "function")
            closeSurveyCreatedList();
        } catch (e) {}
        A();
        try {
          window.__navBack
            ? window.__navBack() || o("chat-list")
            : o("chat-list");
        } catch (e) {
          o("chat-list");
        }
      });
    const zt = document.getElementById("chatQuoteBar"),
      Ot = document.getElementById("quoteCloseBtn");
    (Ot &&
      Ot.addEventListener("click", function (t) {
        (t.stopPropagation(),
          K &&
            (K.removeAttribute("data-quote"), (K.placeholder = "输入消息...")),
          zt && zt.classList.remove("show"));
      }),
      X &&
        X.addEventListener("click", function () {
          (hideEmojiPanel(), k());
        }),
      K &&
        (K.addEventListener("keydown", function (t) {
          "Enter" === t.key && (t.preventDefault(), hideEmojiPanel(), k());
        }),
        K.addEventListener("blur", function () {
          setTimeout(function () {
            ((document.documentElement.scrollTop = 0),
              (document.body.scrollTop = 0));
            try {
              window.scrollTo({ top: 0, left: 0, behavior: "instant" });
            } catch (t) {
              window.scrollTo(0, 0);
            }
          }, 100);
        })),
      (function () {
        var t = document.getElementById("groupMentionPopup"),
          e = document.getElementById("groupMentionList");
        if (false && t && e && K) {
          var n = "";
          (K.addEventListener("input", function () {
            a();
          }),
            K.addEventListener("click", function () {
              a();
            }),
            K.addEventListener("keyup", function () {
              a();
            }),
            document.addEventListener("click", function (e) {
              t.contains(e.target) ||
                e.target === K ||
                (t.style.display = "none");
            }));
        }
        function i() {
          var i = (function () {
            var t = window.akiniContacts
              ? window.akiniContacts.getChatTarget(
                  window.akiniContacts.getActiveChatId(),
                )
              : null;
            if (!t || "group" !== t.type) return [];
            var e = [{ id: "all", name: "全体成员", avatar: "👥" }];
            return (
              (t.memberIds || []).forEach(function (t) {
                var n = window.akiniContacts.getChatTarget(t);
                n && e.push({ id: n.id, name: n.name, avatar: n.avatar });
              }),
              e
            );
          })();
          if (n) {
            var a = n.toLowerCase();
            i = i.filter(function (t) {
              return t.name.toLowerCase().indexOf(a) >= 0;
            });
          }
          0 !== i.length
            ? ((e.innerHTML = ""),
              i.forEach(function (n) {
                var i = document.createElement("div");
                ((i.style.cssText =
                  "display:flex;align-items:center;gap:10px;padding:12px 14px;cursor:pointer;border-bottom:1px solid #f0f0f0;"),
                  (i.innerHTML =
                    '<div style="width:32px;height:32px;border-radius:50%;background:#e8e8e8;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:14px;">' +
                    nt(n.avatar, 32) +
                    '</div><div style="font-size:14px;color:#222;flex:1;">' +
                    rt(n.name) +
                    "</div>"),
                  i.addEventListener("click", function () {
                    var e = K.selectionStart || 0,
                      i = K.selectionEnd || 0,
                      a = K.value,
                      o = a.lastIndexOf("@", e - 1),
                      r = a.slice(0, o),
                      c = a.slice(i),
                      l = "@" + n.name + " ";
                    K.value = r + l + c;
                    var s = r.length + l.length;
                    (K.setSelectionRange(s, s),
                      (t.style.display = "none"),
                      K.focus());
                  }),
                  e.appendChild(i));
              }),
              (t.style.display = "flex"))
            : (t.style.display = "none");
        }
        function a() {
          var e = window.akiniContacts
            ? window.akiniContacts.getChatTarget(
                window.akiniContacts.getActiveChatId(),
              )
            : null;
          if (e && "group" === e.type) {
            for (
              var a = K.value, o = K.selectionStart || 0, r = o - 1;
              r >= 0 && " " !== a[r] && "\n" !== a[r];
            )
              r--;
            var c = a.slice(r + 1, o);
            0 === c.indexOf("@")
              ? ((n = c.slice(1)), i())
              : (t.style.display = "none");
          } else t.style.display = "none";
        }
      })());
    (function () {
      if (U && K) {
        var lastTap = 0;
        function triggerGroupAvatarPat(a) {
          var o = a.target.closest ? a.target.closest(".msg-avatar") : null;
          if (!o) return;
          var r = o.closest(".msg-row");
          if (!r || !r.classList.contains("group")) return;
          var c = window.akiniContacts
            ? window.akiniContacts.getChatTarget(
                window.akiniContacts.getActiveChatId(),
              )
            : null;
          if (!c || "group" !== c.type) return;
          var t = o.getAttribute("data-sender-name") || "";
          if (!t) {
            var e = o.closest(".msg-content-line");
            if (e) {
              var n = e.querySelector(".msg-sender-name");
              n && (t = n.textContent || "");
            }
          }
          if (!t) return;
          a.preventDefault && a.preventDefault();
          var activeId = window.akiniContacts.getActiveChatId();
          window.taPokeWithText && window.taPokeWithText(activeId, "拍了拍你", t);
        }
        U.addEventListener("dblclick", triggerGroupAvatarPat);
        U.addEventListener("touchend", function (a) {
          var now = Date.now();
          if (now - lastTap < 350) {
            triggerGroupAvatarPat(a);
            lastTap = 0;
          } else {
            lastTap = now;
          }
        }, { passive: !1 });
      }
    })();
    document.getElementById("imageSendBtn");
    const Rt =
      document.getElementById("fileInputImageSend") ||
      (function () {
        const t = document.createElement("input");
        return (
          (t.type = "file"),
          (t.accept = "image/*"),
          (t.multiple = !0),
          (t.style.display = "none"),
          (t.id = "fileInputImageSend"),
          document.body.appendChild(t),
          t
        );
      })();
    ((Rt.multiple = !0),
      Rt.addEventListener("change", function () {
        const t = Array.from(this.files);
        t.length &&
          (t.forEach(function (t) {
            const e = new FileReader();
            ((e.onload = function (t) {
              h();
              const e = document.createElement("div");
              ((e.className = "msg-row me"),
                (e.innerHTML = `<div class="msg-content-line"><div class="bubble sticker-bubble" style="background:transparent;padding:0;box-shadow:none;"><img src="${t.target.result}" style="max-width:160px;max-height:200px;border-radius:10px;display:block;"></div><div class="msg-avatar">${f()}</div></div>${d("right")}`),
                U.appendChild(e),
                (U.scrollTop = U.scrollHeight),
                S());
            }),
              e.readAsDataURL(t));
          }),
          (this.value = ""),
          b());
      }));
    const Ft = document.getElementById("chatMoreBtn"),
      qt = document.getElementById("dismissGroupBtn"),
      jt = document.getElementById("changeGroupAvatarBtn");
    (Ft &&
      Y &&
      a(Ft, function () {
        ((Y.style.display = "flex"), (Y.style.pointerEvents = "auto"));
        var t = window.akiniContacts
          ? window.akiniContacts.getChatTarget(
              window.akiniContacts.getActiveChatId(),
            )
          : null;
        (qt && (qt.style.display = t && "group" === t.type ? "flex" : "none"),
          jt && (jt.style.display = t && "group" === t.type ? "flex" : "none"));
      }),
      Q &&
        Q.addEventListener("click", function () {
          Y && ((Y.style.display = "none"), (Y.style.pointerEvents = "none"));
        }));
    const $t = document.getElementById("changeTaAvatarBtn"),
      Wt_avatar = document.getElementById("fileInputChangeTaAvatar");
    $t &&
      Wt_avatar &&
      Wt_avatar.addEventListener("change", function () {
        const t = this.files[0];
        t &&
          (G(t, function (t) {
            if (window.akiniContacts) {
              var e = window.akiniContacts.getActiveChatId();
              e && window.akiniContacts.updateContact(e, { avatar: t });
            }
            (Tn(),
              window.renderBeautifyContacts && window.renderBeautifyContacts(),
              window.renderHomeAvatarContacts &&
                window.renderHomeAvatarContacts(),
              Y &&
                ((Y.style.display = "none"), (Y.style.pointerEvents = "none")),
              "function" == typeof window._renderIcity &&
                window._renderIcity());
          }),
          (this.value = ""));
      });
    const Jt = document.getElementById("changeMyAvatarBtn"),
      Gt = document.getElementById("fileInputChangeMyAvatar");
    Jt &&
      Gt &&
      Gt.addEventListener("change", function () {
        const t = this.files[0];
        t &&
          (G(t, function (t) {
            (u("my", t),
              L("akini_my_avatar", t),
              Tn(t),
              Y &&
                ((Y.style.display = "none"), (Y.style.pointerEvents = "none")),
              "function" == typeof window._renderIcity &&
                window._renderIcity());
          }),
          (this.value = ""));
      });
    /* iCity 我的主页/编辑页 头像直接更换（icityMyAvatarInput 可能存在多个） */
    document
      .querySelectorAll('input[type="file"]#icityMyAvatarInput')
      .forEach(function (input) {
        input.addEventListener("change", function () {
          const t = this.files[0];
          t &&
            (G(t, function (t) {
              (u("my", t),
                L("akini_my_avatar", t),
                Tn(t),
                Y &&
                  ((Y.style.display = "none"),
                  (Y.style.pointerEvents = "none")),
                "function" == typeof window._renderIcity &&
                  window._renderIcity());
            }),
            (this.value = ""));
        });
      });
    const Ut = document.getElementById("fileInputChangeGroupAvatar");
    jt &&
      Ut &&
      Ut.addEventListener("change", function () {
        const t = this.files[0];
        t &&
          (G(t, function (t) {
            var e = window.akiniContacts
                ? window.akiniContacts.getActiveChatId()
                : null,
              n = e ? window.akiniContacts.getChatTarget(e) : null;
            (n &&
              "group" === n.type &&
              window.akiniContacts.updateGroup(e, { avatar: t }),
              Tn(),
              window.renderChatList && window.renderChatList(),
              Y &&
                ((Y.style.display = "none"), (Y.style.pointerEvents = "none")));
          }),
          (this.value = ""));
      });
    const Zt = document.getElementById("inputTaName"),
      Vt = document.getElementById("inputMyName");
    (Zt &&
      ((Zt.value = localStorage.getItem("akini_ta_name") || "哥哥"),
      (Zt.__akiniInputTimer = null),
      Zt.addEventListener("input", function () {
        Zt.dataset.userEdited = "1";
        var val = this.value;
        clearTimeout(Zt.__akiniInputTimer);
        Zt.__akiniInputTimer = setTimeout(function () {
          if (window.akiniContacts) {
            var t = window.akiniContacts.getActiveChatId();
            t && window.akiniContacts.updateContact(t, { name: val });
            try {
              localStorage.setItem("akini_ta_name", val);
            } catch (e) {}
          }
          Tn();
          window.renderBeautifyContacts && window.renderBeautifyContacts();
          window.renderHomeAvatarContacts && window.renderHomeAvatarContacts();
          "function" == typeof window._renderIcity && window._renderIcity();
        }, 300);
      })),
      Vt &&
        ((Vt.value = localStorage.getItem("akini_my_name") || "我"),
        (Vt.__akiniInputTimer = null),
        Vt.addEventListener("input", function () {
          Vt.dataset.userEdited = "1";
          var val = this.value;
          clearTimeout(Vt.__akiniInputTimer);
          Vt.__akiniInputTimer = setTimeout(function () {
            localStorage.setItem("akini_my_name", val);
            Tn();
          }, 300);
        })));
    const te = document.getElementById("inputMyNameBeautify");
    te &&
      ((te.value = localStorage.getItem("akini_my_name") || "我"),
      (te.__akiniInputTimer = null),
      te.addEventListener("input", function () {
        te.dataset.userEdited = "1";
        var val = this.value;
        clearTimeout(te.__akiniInputTimer);
        te.__akiniInputTimer = setTimeout(function () {
          Vt && ((Vt.value = val), (Vt.dataset.userEdited = "1"));
          localStorage.setItem("akini_my_name", val);
          Tn();
        }, 300);
      }));
    const ee = document.getElementById("fileInputChangeMyAvatarBeautify");
    ee
      ? (console.log("[avatar] 美化页头像输入框已绑定"),
        ee.addEventListener("change", function () {
          const t = this.files[0];
          if (t) {
            try {
              G(t, function (t) {
                t
                  ? (u("my", t),
                    L("akini_my_avatar", t),
                    Tn(t),
                    "function" == typeof window._renderIcity &&
                      window._renderIcity())
                  : alert("头像压缩失败，请换一张图片试试");
              });
            } catch (t) {
              (console.error("[avatar] 压缩异常", t), alert("压缩头像时出错"));
            }
            this.value = "";
          }
        }))
      : console.warn("[avatar] 美化页头像输入框未找到");
    const ne = document.getElementById("manageCloseBtn"),
      ie = document.getElementById("manageBg");
    function ae() {
      const t = document.getElementById("manageGrid");
      if (t) {
        var e = J();
        N(e, function (n) {
          ((t.innerHTML = ""),
            0 === n.length &&
              (t.innerHTML =
                '<div style="width:100%; text-align:center; color:#999; font-size:13px; padding:20px;">暂无表情包，点击添加</div>'),
            n.forEach(function (n, i) {
              const a = document.createElement("div");
              a.style.cssText = "position:relative;width:64px;height:64px;";
              const o = document.createElement("img");
              ((o.src = n),
                (o.style.cssText =
                  "width:64px;height:64px;object-fit:cover;border-radius:8px;"));
              const r = document.createElement("button");
              ((r.textContent = "✕"),
                (r.style.cssText =
                  "position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:#ff3b30;color:#fff;border:none;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;"),
                r.addEventListener("click", function () {
                  N(e, function (t) {
                    (t.splice(i, 1),
                      P(e, t, function () {
                        (ae(), me());
                      }));
                  });
                }),
                a.appendChild(o),
                a.appendChild(r),
                t.appendChild(a));
            }));
        });
      }
    }
    (ne &&
      ne.addEventListener("click", function () {
        const t = document.getElementById("stickerManagerOverlay");
        t && (t.style.display = "none");
      }),
      ie &&
        ie.addEventListener("click", function () {
          const t = document.getElementById("stickerManagerOverlay");
          t && (t.style.display = "none");
        }));
    const oe = document.getElementById("emojiToggleBtn"),
      re = document.getElementById("emojiPanel");
    function hideEmojiPanel() {
      re &&
        ((re.style.display = "none"),
        (re.style.visibility = "hidden"),
        (re.style.pointerEvents = "none"));
    }
    function showEmojiPanel() {
      re &&
        (me(),
        (re.style.display = "flex"),
        (re.style.visibility = "visible"),
        (re.style.pointerEvents = "auto"));
    }
    oe &&
      re &&
      a(oe, function () {
        "flex" === re.style.display
          ? hideEmojiPanel()
          : (showEmojiPanel(), hidePlusMenu());
      });
    const plusMenuBtn = document.getElementById("plusMenuBtn"),
      plusMenu = document.getElementById("plusMenu");
    function hidePlusMenu() {
      plusMenu &&
        ((plusMenu.style.display = "none"), plusMenu.classList.remove("show"));
    }
    function showPlusMenu() {
      plusMenu &&
        ((plusMenu.style.display = "flex"), plusMenu.classList.add("show"));
    }
    (plusMenuBtn &&
      plusMenu &&
      (plusMenuBtn.style.touchAction === "" &&
        (plusMenuBtn.style.touchAction = "manipulation"),
      plusMenuBtn.addEventListener("click", function (t) {
        if (plusMenuBtn.getAttribute("data-bound") === "1") return;
        t && t.stopPropagation && t.stopPropagation();
        "flex" === plusMenu.style.display ? hidePlusMenu() : showPlusMenu();
      }),
      plusMenu.addEventListener("click", function (t) {
        var e = t.target.closest("[data-action]");
        if (e) {
          var n = e.getAttribute("data-action");
          if ("call" === n) {
            var cb = document.getElementById("callBtn");
            cb && cb.click();
          } else if ("transfer" === n) {
            var tb = document.getElementById("transferBtn");
            tb && tb.click();
          } else if ("image" === n) {
            var ib = document.getElementById("fileInputImageSend");
            ib && ib.click();
          } else if ("survey" === n) {
            if (window._openSurveyList) {
              window._openSurveyList();
            } else {
              var _sm = document.getElementById("surveyListModal");
              if (_sm) {
                _sm.style.display = "flex";
                _sm.style.zIndex = "1000001";
                if (typeof window.renderSurveyList === "function") window.renderSurveyList();
              }
            }
          }
          hidePlusMenu();
        }
      })));
    document.addEventListener("click", function (t) {
      plusMenu &&
        "flex" === plusMenu.style.display &&
        plusMenuBtn &&
        !plusMenu.contains(t.target) &&
        !plusMenuBtn.contains(t.target) &&
        hidePlusMenu();
      re &&
        "flex" === re.style.display &&
        oe &&
        !re.contains(t.target) &&
        !oe.contains(t.target) &&
        hideEmojiPanel();
    });
    const ce = document.getElementById("addStickerBtn"),
      le = document.getElementById("fileInputAddSticker");
    ce &&
      le &&
      le.addEventListener("change", function () {
        const t = Array.from(this.files);
        if (!t.length) return;
        var e = J();
        let n = 0,
          i = [];
        (t.forEach(function (a) {
          const o = new FileReader();
          ((o.onload = function (a) {
            (i.push(a.target.result),
              n++,
              n === t.length &&
                N(e, function (n) {
                  ((n = n.concat(i)),
                    P(e, n, function () {
                      me();
                      window.__akiniCenterModal && window.__akiniCenterModal("导入成功", "成功导入 " + t.length + " 张表情包");
                      var e = window.akiniContacts
                          ? window.akiniContacts.getChatTarget(
                              window.akiniContacts.getActiveChatId(),
                            )
                          : null,
                        n = e ? e.name : "当前联系人";
                      void 0;
                    }));
                }));
          }),
            o.readAsDataURL(a));
        }),
          (this.value = ""));
      });
    const se = document.getElementById("deleteStickerBtn");
    se &&
      a(se, function () {
        ((Y.style.display = "none"), (Y.style.pointerEvents = "none"));
        const t = document.getElementById("stickerManagerOverlay");
        t && ((t.style.display = "flex"), ae());
      });
    const de = document.getElementById("changeChatWallpaperBtn"),
      ue = document.getElementById("fileInputChatWallpaper");
    function me() {
      const t = document.getElementById("emojiPanel");
      t &&
        N(J(), function (e) {
          if (
            (t.querySelectorAll(".sticker-img-btn").forEach((t) => t.remove()),
            0 === e.length)
          ) {
            const e = document.createElement("div");
            ((e.className = "sticker-img-btn"),
              (e.style.cssText =
                "width:100%; text-align:center; color:#999; font-size:13px; padding:12px 0;"),
              (e.textContent = "暂无表情包，点击右上角菜单添加"),
              t.appendChild(e));
          }
          e.forEach((e, n) => {
            const i = document.createElement("button");
            ((i.className = "sticker-img-btn"),
              (i.style.cssText =
                "background:none;border:none;padding:2px;cursor:pointer;"),
              (i.innerHTML = `<img src="${e}" style="width:52px;height:52px;object-fit:cover;border-radius:6px;">`),
              i.addEventListener("click", function (t) {
                !(function (t) {
                  if (!U || !window.akiniContacts) return;
                  h();
                  const e = document.createElement("div");
                  ((e.className = "msg-row me"),
                    (e.innerHTML =
                      `<div class="msg-content-line"><div class="bubble sticker-bubble" style="background:transparent;box-shadow:none;padding:0;"><img src="${t}" style="max-width:120px;max-height:120px;border-radius:8px;"></div><div class="msg-avatar">${f()}</div></div>` +
                      d("right")),
                    U.appendChild(e));
                  var n = window.akiniContacts.getActiveChatId();
                  (window.akiniContacts.updateSession(n, {
                    lastMsg: "【表情包】",
                    lastTime: Date.now(),
                    lastSenderAvatar: f() || "👤",
                    lastSenderName: g() || "我",
                  }),
                    S(),
                    V(),
                    (U.scrollTop = U.scrollHeight));
                  const i = document.getElementById("emojiPanel");
                  document.getElementById("emojiToggleBtn");
                  i &&
                    ((i.style.display = "none"),
                    (i.style.visibility = "hidden"),
                    (i.style.pointerEvents = "none"));
                  b();
                  window.akiniTriggerReply && window.akiniTriggerReply(n);
                })(e);
              }),
              t.appendChild(i));
          });
        });
    }
    (de &&
      ue &&
      ue.addEventListener("change", function () {
        const t = this.files[0];
        if (!t) return;
        const e = window.akiniContacts
            ? window.akiniContacts.getActiveChatId()
            : null,
          n = new FileReader();
        ((n.onload = function (t) {
          const n = document.getElementById("chatBody");
          (n &&
            ((n.style.backgroundImage = `url(${t.target.result})`),
            (n.style.backgroundSize = "cover"),
            (n.style.backgroundPosition = "center"),
            (n.style.backgroundRepeat = "no-repeat")),
            e && L("akini_chat_bg_" + e, t.target.result),
            Y &&
              ((Y.style.display = "none"), (Y.style.pointerEvents = "none")));
        }),
          n.readAsDataURL(t),
          (this.value = ""));
      }),
      qt &&
        a(qt, function () {
          var t = window.akiniContacts
              ? window.akiniContacts.getActiveChatId()
              : null,
            e = t ? window.akiniContacts.getChatTarget(t) : null;
          e &&
            "group" === e.type &&
            confirm("确定解散群聊“" + e.name + "”吗？群聊记录也会被删除。") &&
            (window.akiniContacts.deleteGroup(t),
            (Y.style.display = "none"),
            (Y.style.pointerEvents = "none"),
            o("chat-list"),
            ot());
        }));
    (me(),
      (function () {
        let t = "main",
          e = "",
          n = "",
          r = !1,
          c = new Set();
        function l() {
          return i("akini_wordbank", []);
        }
        function s(t) {
          if (window.akiniStore && window.akiniStore.setJson) {
            window.akiniStore.setJson("akini_wordbank", t);
          } else {
            try { localStorage.setItem("akini_wordbank", JSON.stringify(t)); } catch (e) {}
            window.akiniContacts && window.akiniContacts.backupToIDB &&
              window.akiniContacts.backupToIDB("akini_wordbank", t);
          }
        }
        function d() {
          return i("akini_wb_groups_" + t, []);
        }
        function u(g) {
          var k = "akini_wb_groups_" + t;
          if (window.akiniStore && window.akiniStore.setJson) {
            window.akiniStore.setJson(k, g);
          } else {
            try { localStorage.setItem(k, JSON.stringify(g)); } catch (e) {}
            window.akiniContacts && window.akiniContacts.backupToIDB &&
              window.akiniContacts.backupToIDB(k, g);
          }
        }
        function m() {
          const e = document.getElementById("wbGroupFilter");
          if (!e) return;
          const i = d();
          if (0 === i.length) return void (e.style.display = "none");
          ((e.style.display = "block"), (e.innerHTML = ""));
          const a = document.createElement("button");
          ((a.className = "wb-gf-btn" + ("" === n ? " active" : "")),
            (a.dataset.gid = ""),
            (a.textContent = "全部"),
            e.appendChild(a));
          const ug = document.createElement("button");
          ((ug.className =
            "wb-gf-btn" + ("__ungrouped__" === n ? " active" : "")),
            (ug.dataset.gid = "__ungrouped__"),
            (ug.textContent = "未分组"),
            e.appendChild(ug),
            i.forEach((i) => {
              const a = document.createElement("button");
              ((a.className =
                "wb-gf-btn" + (String(n) === String(i.id) ? " active" : "")),
                (a.dataset.gid = i.id));
              const o = l().filter(
                (e) =>
                  String(e.gid || "") === String(i.id) &&
                  (e.tab || "main") === t,
              ).length;
              ((a.textContent = `${i.name}(${o})`), e.appendChild(a));
            }));
        }
        function f() {
          const i = document.getElementById("wbContent");
          if (!i) return;
          let a = l()
            .map((t, e) => ({ item: t, idx: e }))
            .filter(({ item: e }) => (e.tab || "main") === t);
          if ("" !== n) {
            if ("__ungrouped__" === n) a = a.filter(({ item: t }) => !t.gid);
            else
              a = a.filter(({ item: t }) => String(t.gid || "") === String(n));
          }
          if (e) {
            const t = e.toLowerCase();
            a = a.filter(({ item: e }) =>
              (e.text || e.content || "").toLowerCase().includes(t),
            );
          }
          if (0 === a.length) {
            return (
              (i.innerHTML =
                '<div class="empty-text" style="text-align:center;color:#bbb;padding:40px 0;">' +
                (e ? "没有匹配的字卡" : "列表空空如也") +
                "</div>"),
              void g()
            );
          }
          ((i.innerHTML = ""),
            a.forEach(({ item: t, idx: e }) => {
              const n = document.createElement("div");
              ((n.className = "wb-word-item" + (c.has(e) ? " selected" : "")),
                (n.dataset.idx = e));
              const a = (function (t) {
                if (!t) return "";
                const e = d().find((e) => String(e.id) === String(t));
                return e ? e.name : "";
              })(t.gid);
              ((n.innerHTML = `\n                    ${r ? `<div class="wb-word-check">${c.has(e) ? "✓" : ""}</div>` : ""}\n                    <span class="wb-word-text">${t.text || t.content || ""}</span>\n                    ${a ? `<span class="wb-word-group">${a}</span>` : ""}\n                    ${r ? "" : `<button type="button" class="wb-word-del" data-idx="${e}">✕</button>`}\n                `),
                i.appendChild(n));
            }),
            g());
        }
        function g() {
          const t = document.getElementById("wbSelectActions");
          if (t)
            if (r) {
              t.style.display = "flex";
              const e = document.getElementById("wbSelectDeleteBtn");
              e && (e.textContent = `删除(${c.size})`);
            } else t.style.display = "none";
        }
        !(function () {
          const t = document.getElementById("wbGroupFilter");
          t &&
            a(t, function (t) {
              var e = t.target.closest ? t.target.closest(".wb-gf-btn") : null;
              e && ((n = e.dataset.gid || ""), c.clear(), f(), m());
            });
        })();
        (function () {
          const t = document.getElementById("wbContent");
          t &&
            (function (t, e, n) {
              if (t) {
                var i = 0,
                  a = 0,
                  o = !1,
                  r = !1;
                (t.addEventListener(
                  "touchstart",
                  function (t) {
                    t.touches &&
                      t.touches[0] &&
                      ((a = t.touches[0].clientX),
                      (i = t.touches[0].clientY),
                      (o = !0),
                      (r = !1));
                  },
                  { passive: !0 },
                ),
                  t.addEventListener(
                    "touchend",
                    function (t) {
                      if (o) {
                        o = !1;
                        var c = t.changedTouches && t.changedTouches[0];
                        if (
                          c &&
                          !(
                            Math.abs(c.clientX - a) > 10 ||
                            Math.abs(c.clientY - i) > 10
                          )
                        ) {
                          var l = t.target.closest ? t.target.closest(e) : null;
                          l && ((r = !0), n(t, l));
                          try {
                            t.preventDefault();
                          } catch (t) {}
                        }
                      }
                    },
                    { passive: !1 },
                  ),
                  t.addEventListener("click", function (t) {
                    if (r) r = !1;
                    else {
                      var i = t.target.closest ? t.target.closest(e) : null;
                      i && n(t, i);
                    }
                  }));
              }
            })(t, ".wb-word-item", function (t, e) {
              t && (t.preventDefault(), t.stopPropagation());
              const n = parseInt(e.dataset.idx);
              if (isNaN(n)) return;
              if (t.target.closest ? t.target.closest(".wb-word-del") : null) {
                const t = l();
                (t.splice(n, 1), s(t), c.clear(), f(), m());
              } else if (r) (c.has(n) ? c.delete(n) : c.add(n), f(), m());
              else {
                const i = e.dataset.idx;
                const wt = e.querySelector(".wb-word-text"),
                  n = wt ? wt.textContent : "";
                if (n) {
                  if ("pat" === t) {
                    const t =
                      window.akiniContacts &&
                      window.akiniContacts.getActiveChatId();
                    if (t) {
                      window.taPokeWithText && window.taPokeWithText(t, n);
                      const e = document.getElementById("wordbankOverlay");
                      e && (e.style.display = "none");
                    }
                  } else {
                    const t = document.getElementById("msgInput");
                    t && ((t.value = n), t.focus());
                  }
                }
              }
            });
        })();
        const y = document.querySelector(".wb-tabs");
        y &&
          a(y, function (i) {
            const a = i.target.closest
              ? i.target.closest(".wb-tabs .tab")
              : null;
            if (!a) return;
            ((t = a.dataset.tab || "main"),
              (n = ""),
              (e = ""),
              c.clear(),
              y
                .querySelectorAll(".tab")
                .forEach((t) => t.classList.remove("active")),
              a.classList.add("active"));
            const o = document.getElementById("wbSearchBar");
            o && (o.style.display = "none");
            const r = document.getElementById("wbSearchInput");
            (r && (r.value = ""), m(), f());
          });
        const p = document.getElementById("searchBtn"),
          v = document.getElementById("wbSearchBar"),
          h = document.getElementById("wbSearchInput"),
          w = document.getElementById("wbSearchClose");
        (p &&
          a(p, function () {
            if (!v) return;
            const t = "none" !== v.style.display && "" !== v.style.display;
            ((v.style.display = t ? "none" : "flex"),
              !t && h && h.focus(),
              t && ((e = ""), f()));
          }),
          h &&
            h.addEventListener("input", function () {
              ((e = this.value.trim()), f());
            }),
          w &&
            a(w, function () {
              ((e = ""),
                h && (h.value = ""),
                v && (v.style.display = "none"),
                f());
            }));
        const k = document.getElementById("groupBtn"),
          _ = document.getElementById("groupModal"),
          b = document.getElementById("closeGroupModal"),
          I = document.getElementById("createGroupBtn");
        function x() {
          const e = d(),
            n = document.getElementById("groupList"),
            i = document.getElementById("emptyGroupTip");
          n &&
            (0 === e.length
              ? ((n.style.display = "none"), i && (i.style.display = "block"))
              : ((n.style.display = "flex"),
                i && (i.style.display = "none"),
                (n.innerHTML = ""),
                e.forEach((e, i) => {
                  const a = l().filter(
                      (n) =>
                        String(n.gid || "") === String(e.id) &&
                        (n.tab || "main") === t,
                    ).length,
                    o = document.createElement("div");
                  ((o.style.cssText =
                    "display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#f8f8f8;border-radius:10px;margin-bottom:8px;"),
                    (o.innerHTML = `\n                        <div style="display:flex;align-items:center;gap:8px;">\n                            <span style="width:10px;height:10px;border-radius:50%;background:${e.color || "#a0a0a0"};display:inline-block;flex-shrink:0;"></span>\n                            <span style="font-size:14px;color:#333;font-weight:500;">${e.name}</span>\n                            <span style="font-size:12px;color:#aaa;">${a}条</span>\n                        </div>\n                        <button type="button" data-gi="${i}" style="background:none;border:none;color:#ff6b6b;font-size:16px;cursor:pointer;padding:0;" class="del-group-btn">✕</button>\n                    `),
                    n.appendChild(o));
                })),
            P());
        }
        (!(function () {
          const t = document.getElementById("groupList");
          t &&
            a(t, function (t) {
              var e = t.target.closest
                ? t.target.closest(".del-group-btn")
                : null;
              if (!e) return;
              const n = parseInt(e.dataset.gi);
              if (isNaN(n)) return;
              const i = d();
              if (n < 0 || n >= i.length) return;
              const a = i[n].id;
              (i.splice(n, 1), u(i));
              const o = l();
              (o.forEach((t) => {
                String(t.gid || "") === String(a) && delete t.gid;
              }),
                s(o),
                x(),
                m(),
                f());
            });
        })(),
          k &&
            a(k, function () {
              (x(),
                _ &&
                  ((_.style.display = "flex"),
                  (_.style.pointerEvents = "auto")));
            }),
          b &&
            a(b, function () {
              _ && (_.style.display = "none");
            }),
          I &&
            a(I, function () {
              const t = prompt("请输入分组名称：");
              if (!t || !t.trim()) return;
              const e = d(),
                n = [
                  "#38D9A9",
                  "#74C0FC",
                  "#FFA94D",
                  "#F783AC",
                  "#A9E34B",
                  "#9775FA",
                  "#63E6BE",
                  "#FFD43B",
                ];
              (e.push({
                id: Date.now(),
                name: t.trim(),
                color: n[e.length % n.length],
              }),
                u(e),
                x(),
                m());
            }));
        const E = document.getElementById("dedupBtn");
        E &&
          a(E, function () {
            const t = l(),
              e = new Set(),
              n = [];
            t.forEach((t) => {
              const i = (t.text || t.content || "").trim();
              i && !e.has(i) && (e.add(i), n.push(t));
            });
            const removed = t.length - n.length;
            alert(
              removed > 0
                ? "成功去重 " + removed + " 条字卡"
                : "没有重复字卡",
            );
            (s(n), c.clear(), f(), m());
          });
        document.getElementById("wbImportBtn");
        const S = document.getElementById("wbImportInput");
        S &&
          (S.addEventListener("click", function () {
            this.value = "";
          }),
          S.addEventListener("change", function () {
            const i = this.files[0];
            if (!i) return;
            const a = new FileReader();
            ((a.onload = function (i) {
              try {
                const p = (i.target.result || "").trim();
                if (!p) return void (window.__akiniCenterModal && window.__akiniCenterModal("导入失败", "文件内容为空"));
                let v = 0,
                  h = 0,
                  existingDupCount = 0,
                  importDupCount = 0;
                const w = { main: 0, emoji: 0, pat: 0 },
                  k = l(),
                  _existing = new Set(k.map((t) => (t.text || t.content || "").trim())),
                  _seen = new Set(),
                  b = d();
                function a(t, e) {
                  e = e || {};
                  var n,
                    i = "";
                  if ("string" == typeof t) i = t.trim();
                  else if (t && "object" == typeof t) {
                    var _f =
                      t.text ||
                      t.content ||
                      t.value ||
                      t.word ||
                      t.name ||
                      t.reply ||
                      t.answer ||
                      t.msg ||
                      t.message ||
                      t.body ||
                      t.title ||
                      t.note ||
                      t.sentence ||
                      t.phrase ||
                      t.q ||
                      t.question ||
                      t.prompt ||
                      t.keyword ||
                      t.trigger ||
                      t.input ||
                      t.txt ||
                      t.str ||
                      t.msg2 ||
                      t.text2 ||
                      t.text1 ||
                      t.label ||
                      t.key ||
                      "";
                    i = Array.isArray(_f)
                      ? _f
                          .map(function (x) {
                            return String(x);
                          })
                          .filter(Boolean)
                          .join(" ")
                      : String(_f);
                    i = i.trim();
                  }
                  if (i) {
                    if (_existing.has(i)) {
                      existingDupCount++;
                    } else if (_seen.has(i)) {
                      importDupCount++;
                    } else {
                      "string" == typeof t
                        ? ((n = { text: i, tab: e.tab || "main" }),
                          e.gid && (n.gid = e.gid))
                        : (((n = Object.assign({}, t)).text = i),
                          e.tab && (n.tab = e.tab),
                          n.tab || (n.tab = "main"),
                          e.gid && (n.gid = e.gid));
                      k.push(n);
                      _seen.add(i);
                      v++;
                      w[n.tab] = (w[n.tab] || 0) + 1;
                    }
                  }
                }
                const I = p.startsWith("{") || p.startsWith("[");
                let x = null;
                if (I)
                  try {
                    x = JSON.parse(p);
                  } catch (C) {
                    return void (window.__akiniCenterModal && window.__akiniCenterModal("导入失败", "JSON 解析失败：" + C.message));
                  }
                if (Array.isArray(x)) x.forEach((t) => a(t, { tab: "main" }));
                else if (x && "object" == typeof x) {
                  (function () {
                    var _gf = [
                      "customReplyGroups",
                      "groups",
                      "分组",
                      "categories",
                      "wb_groups",
                      "replyGroups",
                      "groupList",
                      "replyGroup",
                      "reply_groups",
                      "group",
                    ];
                    for (var gi = 0; gi < _gf.length; gi++) {
                      var _gk = _gf[gi];
                      if (
                        "customReplyGroups" !== _gk &&
                        Array.isArray(x[_gk])
                      ) {
                        Array.isArray(x.customReplyGroups) ||
                          (x.customReplyGroups = []);
                        x[_gk].forEach(function (gr) {
                          x.customReplyGroups.push(gr);
                        });
                      }
                    }
                  })();
                  if (
                    (Array.isArray(x.customReplyGroups) &&
                      x.customReplyGroups.forEach((t) => {
                        if (!t || !t.name) return;
                        var e;
                        var existingGroup = b.find(function (g) {
                          return g.name === t.name;
                        });
                        if (existingGroup) {
                          e = existingGroup.id;
                        } else {
                          e = Date.now() + Math.floor(1e6 * Math.random());
                          const n = [
                            "#38D9A9",
                            "#74C0FC",
                            "#FFA94D",
                            "#F783AC",
                            "#A9E34B",
                            "#9775FA",
                            "#63E6BE",
                            "#FFD43B",
                          ];
                          b.push({
                            id: e,
                            name: t.name,
                            color: t.color || n[b.length % n.length],
                          });
                          h++;
                        }
                        (function () {
                          for (
                            var _i = 0,
                              _ka = [
                                "items",
                                "replies",
                                "cards",
                                "words",
                                "list",
                                "data",
                                "wordbank",
                                "main",
                                "customReplies",
                                "customPokes",
                                "customEmojis",
                              ];
                            _i < _ka.length;
                            _i++
                          ) {
                            if (Array.isArray(t[_ka[_i]]))
                              return t[_ka[_i]];
                          }
                          return [];
                        })().forEach((t) =>
                          a(t, { tab: "main", gid: e }),
                        );
                      }),
                    Array.isArray(x.customReplies) &&
                      x.customReplies.forEach((t) => a(t, { tab: "main" })),
                    Array.isArray(x.customPokes) &&
                      x.customPokes.forEach((t) => a(t, { tab: "pat" })),
                    Array.isArray(x.customEmojis) &&
                      x.customEmojis.forEach((t) => a(t, { tab: "emoji" })),
                    0 === v && 0 === h)
                  ) {
                    if (x.ls) {
                      var o = x.ls.akini_wordbank;
                      if ("string" == typeof o)
                        try {
                          o = JSON.parse(o);
                        } catch (B) {}
                      Array.isArray(o) &&
                        o.forEach((t) => a(t, { tab: "main" }));
                    }
                    if (0 === v && x.idb) {
                      var r = x.idb.akini_wordbank;
                      if ("string" == typeof r)
                        try {
                          r = JSON.parse(r);
                        } catch (T) {}
                      Array.isArray(r) &&
                        r.forEach((t) => a(t, { tab: "main" }));
                    }
                    if (0 === v) {
                      var g = (function t(e, n) {
                        if (n <= 0) return null;
                        if (Array.isArray(e))
                          return e.some(function (t) {
                            return (
                              "string" == typeof t
                                ? t.trim()
                                : t &&
                                  (t.text ||
                                    t.content ||
                                    t.value ||
                                    t.word ||
                                    t.name ||
                                    t.reply ||
                                    t.answer ||
                                    t.msg ||
                                    t.message ||
                                    t.body ||
                                    t.title ||
                                    t.note ||
                                    t.sentence ||
                                    t.phrase ||
                                    "")
                            ).trim();
                          })
                            ? e
                            : null;
                        if (e && "object" == typeof e)
                          for (var i in e)
                            if (e.hasOwnProperty(i)) {
                              var a = t(e[i], n - 1);
                              if (a) return a;
                            }
                        return null;
                      })(x, 4);
                      g && g.forEach((t) => a(t, { tab: "main" }));
                    }
                    0 === v &&
                      "string" == typeof x.text &&
                      x.text.split("\n").forEach((t) => a(t, { tab: "main" }));
                  }
                  0 === v &&
                    [
                      "items",
                      "replies",
                      "words",
                      "list",
                      "data",
                      "wordbank",
                      "cards",
                      "main",
                    ].forEach((t) => {
                      Array.isArray(x[t]) &&
                        x[t].forEach((t) => a(t, { tab: "main" }));
                    });
                } else p.split("\n").forEach((t) => a(t, { tab: "main" }));
                (h > 0 && u(b), s(k), c.clear());
                let E = "main";
                console.log("[wordbank] 导入完成：新增" + v + "条，分组" + h + "个，当前总数" + k.length + "，切换到tab=" + (v > 0 ? E : t));
                if (v > 0) {
                  let M = 0;
                  ["main", "emoji", "pat"].forEach(function (t) {
                    w[t] > M && ((M = w[t]), (E = t));
                  });
                }
                if (((t = E), (n = ""), (e = ""), y)) {
                  y.querySelectorAll(".tab").forEach((t) =>
                    t.classList.remove("active"),
                  );
                  const L = y.querySelector('[data-tab="' + E + '"]');
                  L && L.classList.add("active");
                }
                const S = document.getElementById("wbSearchBar");
                S && (S.style.display = "none");
                const A = document.getElementById("wbSearchInput");
                if (v > 0 || h > 0) {
                  var importParts = [];
                  if (w.main > 0) importParts.push("字卡：" + w.main + " 张");
                  if (w.emoji > 0) importParts.push("emoji：" + w.emoji + " 个");
                  if (w.pat > 0) importParts.push("拍一拍：" + w.pat + " 个");
                  if (h > 0) importParts.push("分组：" + h + " 个");
                  window.__akiniCenterModal &&
                    window.__akiniCenterModal(
                      "导入成功",
                      "成功导入" +
                        (importParts.length ? "\n" + importParts.join("\n") : ""),
                    );
                }
                (A && (A.value = ""), m(), f(), void 0);
              } catch (D) {
                window.__akiniCenterModal
                  ? window.__akiniCenterModal("导入失败", "导入失败：" + D.message)
                  : alert("导入失败：" + D.message);
              }
            }),
              a.readAsText(i, "UTF-8"),
              (this.value = ""));
          }));
        const A = document.getElementById("selectBtn");
        A &&
          a(A, function () {
            ((r = !r),
              c.clear(),
              (A.style.background = r ? "#a0a0a0" : ""),
              (A.style.color = r ? "#fff" : ""),
              f());
          });
        const C = document.getElementById("wbSelectAllBtn");
        C &&
          a(C, function () {
            let i = l()
              .map((t, e) => ({ item: t, idx: e }))
              .filter(({ item: e }) => (e.tab || "main") === t);
            if (
              ("" !== n &&
                (i = i.filter(
                  ({ item: t }) => String(t.gid || "") === String(n),
                )),
              e)
            ) {
              const t = e.toLowerCase();
              i = i.filter(({ item: e }) =>
                (e.text || e.content || "").toLowerCase().includes(t),
              );
            }
            (i.forEach(({ idx: t }) => c.add(t)), f(), m());
          });
        const B = document.getElementById("wbSelectDeleteBtn");
        B &&
          a(B, function () {
            if (0 === c.size) return void alert("请先选择字卡");
            if (!confirm(`确定删除选中的 ${c.size} 条字卡？`)) return;
            const t = l();
            (Array.from(c)
              .sort((t, e) => e - t)
              .forEach((e) => t.splice(e, 1)),
              s(t),
              c.clear(),
              f(),
              m());
          });
        const T = document.getElementById("wbSelectGroupBtn"),
          M = document.getElementById("wbPickGroupModal"),
          L = document.getElementById("wbPickGroupList"),
          D = document.getElementById("wbPickGroupCancel");
        (T &&
          a(T, function () {
            if (0 === c.size) return void alert("请先选择字卡");
            const t = d();
            0 !== t.length
              ? L &&
                ((L.innerHTML = ""),
                t.forEach((t) => {
                  const e = document.createElement("button");
                  ((e.className = "wb-pick-group-btn"),
                    (e.dataset.gid = t.id),
                    (e.style.cssText =
                      "padding:10px 14px;background:#f5f5f5;border:none;border-radius:10px;font-size:14px;cursor:pointer;text-align:left;display:flex;align-items:center;gap:8px;"),
                    (e.innerHTML = `<span style="width:10px;height:10px;border-radius:50%;background:${t.color || "#a0a0a0"};display:inline-block;"></span>${t.name}`),
                    L.appendChild(e));
                }),
                M &&
                  ((M.style.display = "flex"),
                  (M.style.pointerEvents = "auto")))
              : alert("请先创建分组");
          }),
          L &&
            a(L, function (t) {
              var e = t.target.closest
                ? t.target.closest(".wb-pick-group-btn")
                : null;
              if (!e) return;
              const n = e.dataset.gid,
                i = l();
              (c.forEach((t) => {
                i[t] && (i[t].gid = n);
              }),
                s(i),
                c.clear(),
                M && (M.style.display = "none"),
                f(),
                m());
            }),
          D &&
            a(D, function () {
              M && (M.style.display = "none");
            }));
        const N = document.getElementById("wbSelectCancelBtn");
        function P() {
          const t = document.getElementById("groupSelect");
          if (!t) return;
          const e = d();
          ((t.innerHTML = '<option value="">-- 不分组 --</option>'),
            e.forEach((e) => {
              const n = document.createElement("option");
              ((n.value = e.id), (n.textContent = e.name), t.appendChild(n));
            }));
        }
        N &&
          a(N, function () {
            ((r = !1), c.clear());
            const t = document.getElementById("selectBtn");
            (t && ((t.style.background = ""), (t.style.color = "")), f());
          });
        const H = document.getElementById("addWordBtn"),
          z = document.getElementById("addModal"),
          O = document.getElementById("batchInput"),
          R = document.getElementById("lineCount"),
          F = document.getElementById("confirmAdd"),
          q = document.getElementById("cancelAdd"),
          j = document.getElementById("closeWordBank"),
          $ = document.getElementById("wordbankOverlay");
        (j &&
          a(j, function () {
            ($ && (($.style.display = "none"), $.classList.remove("show")),
              o(""));
          }),
          H &&
            a(H, function () {
              (P(),
                z && ((z.style.display = "flex"), z.classList.add("show")),
                O && (O.value = ""),
                R && (R.textContent = "0"));
            }),
          O &&
            R &&
            O.addEventListener("input", function () {
              R.textContent = this.value
                .split("\n")
                .filter((t) => t.trim()).length;
            }),
          F &&
            a(F, function () {
              if (!O) return;
              const e = O.value
                  .split("\n")
                  .map((t) => t.trim())
                  .filter(Boolean),
                n = l(),
                i = n.map((t) => (t.text || t.content || "").trim()),
                a = document.getElementById("groupSelect"),
                o = a ? a.value : "";
              (e.forEach((e) => {
                if (i.includes(e)) return;
                const a = { text: e, tab: t };
                (o && (a.gid = o), n.push(a), i.push(e));
              }),
                s(n),
                z && ((z.style.display = "none"), z.classList.remove("show")),
                f(),
                m());
            }),
          q &&
            a(q, function () {
              z && ((z.style.display = "none"), z.classList.remove("show"));
            }),
          m(),
          f(),
          (window.renderWordbank = f),
          (window.renderGroupFilter = m));
      })());
    (function () {
      function t() {
        const e = document.getElementById("postList"),
          n = document.getElementById("emptyTip");
        if (!e) return;
        var _commentModal = document.getElementById("friendsCommentInputModal"),
          _commentInput = document.getElementById("friendsCommentInput"),
          _commentCancel = document.getElementById("friendsCommentCancel"),
          _commentSubmit = document.getElementById("friendsCommentSubmit");
        var _commentPidx = null,
          _commentReplyTo = null,
          _commentReplyIdx = null,
          _commentCommentIdx = null;
        function openCommentModal(pidx, replyTo, replyIdx, commentIdx) {
          _commentPidx = pidx;
          _commentReplyTo = replyTo || null;
          _commentReplyIdx = replyIdx !== undefined ? replyIdx : null;
          _commentCommentIdx = commentIdx !== undefined ? commentIdx : null;
          if (!_commentModal || !_commentInput) return;
          if (replyTo) {
            _commentInput.placeholder = "回复 " + replyTo + "：";
          } else {
            _commentInput.placeholder = "写下你的评论...";
          }
          _commentInput.value = "";
          _commentModal.style.display = "flex";
          setTimeout(function () {
            _commentInput.focus();
          }, 100);
        }
        function closeCommentModal() {
          if (_commentModal) _commentModal.style.display = "none";
          _commentPidx = null;
          _commentReplyTo = null;
          _commentReplyIdx = null;
          _commentCommentIdx = null;
        }
        function submitComment() {
          if (!_commentInput) return;
          var text = _commentInput.value.trim();
          if (!text) {
            closeCommentModal();
            return;
          }
          var r = O().filter(function (t) {
            return "icity" !== t.source;
          });
          r.sort(function (t, e) {
            return (e.ts || 0) - (t.ts || 0);
          });
          var a = localStorage.getItem("akini_my_name") || "我",
            o = localStorage.getItem("akini_ta_name") || "对方";
          var _triggerContactReply = function (momentId, targetName) {
            try {
              if (window.akiniOnMomentUserReply) {
                window.akiniOnMomentUserReply(momentId, targetName, "friends");
              }
            } catch (_e) {}
          };
          if (_commentReplyIdx !== null && _commentCommentIdx !== null) {
            var c = r[_commentReplyIdx];
            if (!c) return closeCommentModal();
            var l = (c.comments || [])[_commentCommentIdx];
            if (!l) return closeCommentModal();
            c.comments = c.comments || [];
            c.comments.push({
              id: "c_" + Math.random().toString(36).slice(2) + "_" + Date.now(),
              author: a,
              text: text,
              replyTo: l.author,
              ts: Date.now(),
            });
            l.repliedByMe = !0;
            try {
              R(r);
            } catch (_e) {}
            // 通知朋友圈引擎：用户回复了某联系人，该联系人将再回复一条
            _triggerContactReply(c.ts, l.author);
          } else if (_commentPidx !== null) {
            var e = r[_commentPidx];
            if (!e) return closeCommentModal();
            e.comments = e.comments || [];
            e.comments.push({ id: "c_" + Math.random().toString(36).slice(2) + "_" + Date.now(), author: a, text: text, ts: Date.now() });
            try {
              R(r);
              if (window._idbStore && window._idbStore.set) {
                var _pc = JSON.stringify(r);
                window._idbStore.set("akini_posts", _pc);
                window._idbStore.set("akini_posts_backup", _pc);
              }
            } catch (e) {}
            // 用户评论朋友圈（含自己动态）都触发联系人再回复：优先回复者为动态作者，否则随机联系人
            var postAuthor = e.author || o;
            _triggerContactReply(e.ts, postAuthor);
          }
          (R(r),
            window._renderPosts && window._renderPosts(),
            closeCommentModal());
        }
        if (_commentCancel)
          _commentCancel.addEventListener("click", closeCommentModal);
        if (_commentSubmit)
          _commentSubmit.addEventListener("click", submitComment);
        if (_commentInput)
          _commentInput.addEventListener("keydown", function (e) {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submitComment();
            }
          });
        if (_commentModal)
          _commentModal.addEventListener("click", function (e) {
            if (e.target === _commentModal) closeCommentModal();
          });
        const i = O().filter((t) => "icity" !== t.source);
        if (
          (i.sort((t, e) => (e.ts || 0) - (t.ts || 0)),
          (e.innerHTML = ""),
          0 === i.length)
        )
          return void (n && (n.style.display = "flex"));
        n && (n.style.display = "none");
        const a = localStorage.getItem("akini_my_name") || "我";
        localStorage.getItem("akini_ta_name");
        (i.forEach((t, n) => {
          !t.author || t.author;
          const i = (function (t) {
              if (!t.author || t.author === a)
                return (
                localStorage.getItem("akini_my_avatar") ||
                (window.__akiniAvatarCache && window.__akiniAvatarCache.my) ||
                "🐱"
              );
              if (window.akiniContacts) {
                if (t.authorId) {
                  var e = window.akiniContacts.getContactById(t.authorId);
                  if (e) return e.avatar;
                }
                var n = window.akiniContacts.getContacts().find(function (e) {
                  return e.name === t.author;
                });
                if (n) return n.avatar;
              }
              return localStorage.getItem("akini_ta_avatar") || "🐰";
            })(t),
            o = t.author || a,
            r = nt(i, 36);
          const c = t.likes || [],
            l = t.comments || [],
            s = c.includes(a);
          let d = "";
          if (c.length || l.length) {
            const validLikes = c.filter(function (n) {
              return n && String(n).trim();
            });
            let t = validLikes.length
                ? '<div style="font-size:12px;color:#333;">♡ ' +
                  validLikes.join("、") +
                  "</div>"
                : "",
              e = l
                .map((t, e) => {
                  var cAuthor = t.author || "对方";
                  var cReplyTo = t.replyTo || "";
                  const i = cReplyTo
                      ? '<span style="font-weight:600;color:#333;">' +
                        cReplyTo +
                        '</span><span style="color:#333;">：</span>'
                      : "",
                    a = cReplyTo
                      ? '<span style="font-weight:600;color:#333;">' +
                        cAuthor +
                        '</span><span style="color:#999;"> 回复 </span>' +
                        i
                      : '<span style="font-weight:600;color:#333;">' +
                        cAuthor +
                        "：</span>";
                  return (
                    '<div style="font-size:12px;line-height:1.5;padding:1px 0;cursor:pointer;" data-reply-idx="' +
                    n +
                    '" data-comment-idx="' +
                    e +
                    '">' +
                    a +
                    '<span style="color:#333;">' +
                    (t.text || "") +
                    "</span></div>"
                  );
                })
                .join("");
            d =
              '<div style="margin-top:6px;padding:4px 8px;display:block;width:calc(100% - 44px);background:#f7f7f7;border-radius:6px;">' +
              t +
              (t && e
                ? '<div style="height:1px;background:#e0e0e0;margin:4px 0;"></div>'
                : "") +
              e +
              "</div>";
          }
          const u = document.createElement("div");
          ((u.className = "post-item"),
            (u.dataset.idx = n),
            (u.innerHTML =
              '<div style="display:flex;align-items:flex-start;gap:10px;"><div class="post-avatar" style="width:40px;height:40px;border-radius:50%;flex-shrink:0;">' +
              r +
              '</div><div style="flex:1;min-width:0;"><div style="font-size:14px;font-weight:600;color:#333;margin-bottom:4px;">' +
              o +
              '</div><div class="post-content">' +
              (t.text || "") +
              "</div>" +
              (t.img
                ? '<div class="post-image"><img src="' +
                  t.img +
                  '" alt="" style="max-height:200px;"></div>'
                : "") +
              '<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-top:8px;"><div class="post-time">' +
              (function (t) {
                if (!t) return "";
                var e = new Date(t.replace(/\//g, "-"));
                if (isNaN(e.getTime())) return t;
                var n = Math.floor((Date.now() - e.getTime()) / 1e3);
                return n < 60
                  ? "刚刚"
                  : n < 3600
                    ? Math.floor(n / 60) + "分钟前"
                    : n < 86400
                      ? Math.floor(n / 3600) + "小时前"
                      : n < 2592e3
                        ? Math.floor(n / 86400) + "天前"
                        : Math.floor(n / 86400 / 30) + "个月前";
              })(t.date || __akiniFormatDateTime(new Date(t.ts))) +
              '</div><div style="display:flex;align-items:center;gap:10px;flex-shrink:0;position:relative;"><button type="button" class="post-dots-trigger" data-pidx="' +
              n +
              '" style="background:#f0f0f0;border:none;border-radius:10px;padding:6px 9px;display:flex;align-items:center;gap:3px;cursor:pointer;outline:none;-webkit-tap-highlight-color:transparent;"><span style="width:4px;height:4px;border-radius:50%;background:#333;"></span><span style="width:4px;height:4px;border-radius:50%;background:#333;"></span></button><div class="post-action-popup" data-pidx="' +
              n +
              '" style="display:none;position:absolute;bottom:calc(100% + 6px);right:0;background:#f0f0f0;border-radius:12px;padding:8px 12px;box-shadow:0 -4px 20px rgba(0,0,0,.12);z-index:100;gap:10px;align-items:center;white-space:nowrap;"><button type="button" data-action="like" data-pidx="' +
              n +
              '" style="background:none;border:none;padding:0;cursor:pointer;font-size:20px;color:#333;outline:none;">♡</button><div style="width:1px;height:18px;background:#000;"></div><button type="button" data-action="comment" data-pidx="' +
              n +
              '" style="background:none;border:none;padding:0;cursor:pointer;font-size:18px;color:#333;outline:none;display:flex;align-items:center;justify-content:center;"><svg viewBox="0 0 24 24" fill=none stroke=currentColor stroke-width=2 stroke-linecap=round stroke-linejoin=round style="width:20px;height:20px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></button></div></div></div>' +
              d),
            e.appendChild(u));
        }),
          (e.onclick = function (e) {
            const dotsTrigger = e.target.closest(".post-dots-trigger");
            if (dotsTrigger) {
              const pidx = dotsTrigger.dataset.pidx,
                popup =
                  dotsTrigger.parentElement.querySelector(".post-action-popup"),
                wasOpen = popup && popup.style.display === "flex";
              document.querySelectorAll(".post-action-popup").forEach((p) => {
                p.style.display = "none";
              });
              if (popup && popup.dataset.pidx === pidx) {
                popup.style.display = wasOpen ? "none" : "flex";
              }
              return;
            }
            const n = e.target.closest("[data-action]"),
              i = e.target.closest("[data-reply-idx]"),
              a = localStorage.getItem("akini_my_name") || "我",
              o = localStorage.getItem("akini_ta_name") || "对方",
              r = O().filter((t) => "icity" !== t.source);
            if ((r.sort((t, e) => (e.ts || 0) - (t.ts || 0)), n)) {
              const e = r[parseInt(n.dataset.pidx)];
              if (!e) return;
              if ("like" === n.dataset.action) {
                document.querySelectorAll(".post-action-popup").forEach((p) => {
                  p.style.display = "none";
                });
                e.likes = e.likes || [];
                const n = e.likes.indexOf(a);
                (n >= 0 ? e.likes.splice(n, 1) : e.likes.push(a), R(r), t());
              } else if ("comment" === n.dataset.action) {
                document.querySelectorAll(".post-action-popup").forEach((p) => {
                  p.style.display = "none";
                });
                openCommentModal(parseInt(n.dataset.pidx));
              }
            } else if (i) {
              const e = parseInt(i.dataset.replyIdx),
                n = parseInt(i.dataset.commentIdx),
                c = r[e];
              if (!c) return;
              const l = (c.comments || [])[n];
              if (!l) return;
              openCommentModal(
                e,
                void 0,
                parseInt(i.dataset.replyIdx),
                parseInt(i.dataset.commentIdx),
              );
            }
          }));
      }
      const e = document.getElementById("friendsFabPublish"),
        n = document.getElementById("publishModal"),
        i = document.getElementById("closePublishBtn"),
        o = document.getElementById("submitPostBtn"),
        r = document.getElementById("publishInput"),
        c = document.getElementById("addImageBtn");
      let l = document.getElementById("fileInputFriendsPost");
      l ||
        ((l = document.createElement("input")),
        (l.type = "file"),
        (l.accept = "image/*"),
        (l.id = "fileInputFriendsPost"),
        (l.style.display = "none"),
        document.body.appendChild(l));
      let s = null;
      (l.addEventListener("change", function () {
        const t = this.files[0];
        if (!t) return;
        const e = new FileReader();
        ((e.onload = function (t) {
          ((s = t.target.result),
            c &&
              setHtmlKeepInput(
                c,
                `<img src="${s}" style="height:60px;border-radius:8px;object-fit:cover;"> <span style="font-size:12px;color:#999;margin-left:8px;">已选择</span>`,
              ));
        }),
          e.readAsDataURL(t));
      }),
        a(e, function () {
          n &&
            ((n.style.display = "flex"),
            r && (r.value = ""),
            (s = null),
            c &&
              setHtmlKeepInput(
                c,
                '<div style="font-size:14px;color:#666;">添加图片</div>',
              ));
        }),
        a(i, function () {
          n && ((n.style.display = "none"), n.classList.remove("show"));
        }),
        a(o, function () {
          const e = r ? r.value.trim() : "";
          if (!e && !s) return void alert("请输入内容或选择图片");
          const i = O(),
            a = localStorage.getItem("akini_my_name") || "我",
            o = {
              text: e,
              img: s || null,
              date: __akiniFormatDateTime(new Date()),
              ts: Date.now(),
              author: a,
              id: Date.now() + Math.random().toString(36).slice(2, 9),
            };
          (i.push(o),
            R(i),
            n && ((n.style.display = "none"), n.classList.remove("show")),
            t());
          // TA的手机：按概率自动收藏用户发布的朋友圈
          try {
            if (window.akiniTaPhoneCollectMoment) {
              var _cid = window.akiniContacts && window.akiniContacts.getActiveChatId ? window.akiniContacts.getActiveChatId() : null;
              window.akiniTaPhoneCollectMoment(_cid, e, o.ts);
            }
          } catch (e2) {}
          // syy 风格：发布后延迟随机时间，多联系人按概率自动评论 + 自动点赞
          try {
            if (window.akiniTriggerMomentAutoReply) {
              var _delay = window.akiniGetMomentReplyDelay ? window.akiniGetMomentReplyDelay() : (2000 + Math.random() * 5000);
              setTimeout(function () {
                window.akiniTriggerMomentAutoReply(o.id, "friends");
              }, _delay);
            }
          } catch (e3) {}
        }));
      const u = document.getElementById("friendsHeader");
      (D("akini_friends_bg", function (t) {
        t &&
          u &&
          ((u.style.backgroundImage = "url(" + t + ")"),
          (u.style.backgroundSize = "cover"),
          (u.style.backgroundPosition = "center"));
      }),
        t(),
        (window._renderPosts = t),
        (window.__akiniGetPosts = O),
        (window.__akiniSavePosts = R),
        (function () {
          var e = document.createElement("div");
          ((e.id = "postDeleteConfirm"),
            (e.style.cssText =
              "display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.45);z-index:9100;align-items:center;justify-content:center;"),
            (e.innerHTML =
              '<div style="background:#fff;border-radius:16px;width:260px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.18);">  <div id="postDeleteTitle" style="padding:20px 16px 12px;text-align:center;font-size:15px;color:#222;font-weight:600;">删除这条动态？</div>  <div style="padding:0 16px 16px;text-align:center;font-size:13px;color:#888;">删除后无法恢复</div>  <div style="display:flex;border-top:1px solid #eee;">    <button type="button" id="postDeleteCancel" style="flex:1;padding:13px;background:none;border:none;border-right:1px solid #eee;font-size:15px;color:#666;cursor:pointer;">取消</button>    <button type="button" id="postDeleteOk"     style="flex:1;padding:13px;background:none;border:none;font-size:15px;color:#e04040;font-weight:600;cursor:pointer;">删除</button>  </div></div>'));
          var n = document.getElementById("app-friends");
          n ? n.appendChild(e) : document.body.appendChild(e);
          var i = -1,
            a = "";
          (document
            .getElementById("postDeleteCancel")
            .addEventListener("click", function () {
              ((e.style.display = "none"), (i = -1));
            }),
            document
              .getElementById("postDeleteOk")
              .addEventListener("click", function () {
                if (!(i < 0)) {
                  var n = O().filter(function (t) {
                    return "icity" !== t.source;
                  });
                  n.sort(function (t, e) {
                    return (e.ts || 0) - (t.ts || 0);
                  });
                  var a = n[i];
                  if (!a) return ((e.style.display = "none"), void (i = -1));
                  var o = O(),
                    r = o.indexOf(a);
                  (r >= 0 && o.splice(r, 1),
                    R(o),
                    (e.style.display = "none"),
                    (i = -1),
                    t());
                }
              }),
            e.addEventListener("click", function (t) {
              t.target === e && ((e.style.display = "none"), (i = -1));
            }));
          var o = document.getElementById("postList");
          if (o) {
            var r = null;
            (o.addEventListener(
              "touchstart",
              function (t) {
                var n = t.target.closest(".post-item");
                if (n) {
                  var o = parseInt(n.dataset.idx);
                  if (!isNaN(o)) {
                    var c = O().filter(function (t) {
                      return "icity" !== t.source;
                    });
                    c.sort(function (t, e) {
                      return (e.ts || 0) - (t.ts || 0);
                    });
                    var l = c[o];
                    if (l) {
                      var s = localStorage.getItem("akini_my_name") || "我",
                        d = localStorage.getItem("akini_ta_name") || "对方";
                      (l.author && l.author !== s && l.author !== d) ||
                        (r = setTimeout(function () {
                          !(function (t, n) {
                            ((i = t), (a = n || ""));
                            var o = document.getElementById("postDeleteTitle"),
                              r = localStorage.getItem("akini_my_name") || "我";
                            (o &&
                              (o.textContent =
                                a === r
                                  ? "删除这条动态？"
                                  : "删除对方的动态？"),
                              (e.style.display = "flex"));
                          })(o, l.author || s);
                        }, 600));
                    }
                  }
                }
              },
              { passive: !0 },
            ),
              o.addEventListener("touchend", function () {
                clearTimeout(r);
              }),
              o.addEventListener("touchmove", function () {
                clearTimeout(r);
              }));
          }
        })());
    })();
    (function () {
      const t = document.getElementById("coverAreaMain");
      t &&
        D("akini_cover_img", function (e) {
          if (e) {
            ((t.style.backgroundImage = `url(${e})`),
              (t.style.backgroundSize = "cover"),
              (t.style.backgroundPosition = "center"),
              (t.textContent = ""));
          }
        });
      const n = document.getElementById("bgArea");
      n &&
        D("akini_bg_img", function (t) {
          t &&
            ((n.style.backgroundImage = `url(${t})`),
            (n.style.backgroundSize = "cover"),
            (n.style.backgroundPosition = "center"));
        });
    })();
    const ge = document.getElementById("callMiniWindow"),
      ye = document.getElementById("callMinimizeBtn"),
      pe = document.getElementById("callHangupBtn"),
      ve = document.getElementById("callAnswerBtn"),
      he = document.getElementById("callStatus");
    !(function () {
      var t = document.getElementById("phoneAppBtn");
      if (t) {
        var e = document.createElement("div");
        ((e.id = "phoneDialModal"),
          (e.style.cssText =
            "display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.45);z-index:9050;align-items:center;justify-content:center;"),
          (e.innerHTML =
            '<div style="background:#fff;border-radius:24px;width:280px;padding:28px 20px 20px;text-align:center;box-shadow:0 12px 40px rgba(0,0,0,0.18);">  <div id="phoneDialAvatar" style="width:72px;height:72px;border-radius:50%;background:#e8e8e8;margin:0 auto 10px;display:flex;align-items:center;justify-content:center;font-size:36px;overflow:hidden;"></div>  <div id="phoneDialName" style="font-size:18px;font-weight:600;color:#222;margin-bottom:4px;"></div>  <div style="font-size:13px;color:#aaa;margin-bottom:24px;">移动电话</div>  <div style="display:flex;gap:16px;justify-content:center;">    <button type="button" id="phoneDialCancel" style="flex:1;padding:12px;border-radius:50px;background:#f2f2f2;border:none;font-size:15px;color:#555;cursor:pointer;">取消</button>    <button type="button" id="phoneDialCall"   style="flex:1;padding:12px;border-radius:50px;background:#2dc84d;border:none;font-size:15px;color:#fff;font-weight:600;cursor:pointer;">拨打</button>  </div></div>'),
          document.body.appendChild(e),
          document
            .getElementById("phoneDialCancel")
            .addEventListener("click", function () {
              e.style.display = "none";
            }),
          e.addEventListener("click", function (t) {
            t.target === e && (e.style.display = "none");
          }),
          document
            .getElementById("phoneDialCall")
            .addEventListener("click", function () {
              e.style.display = "none";
              var t = window.akiniContacts
                  ? window.akiniContacts.getActiveChatId()
                  : null,
                n = t ? window.akiniContacts.getChatTarget(t) : null,
                i =
                  (n ? n.name : null) ||
                  localStorage.getItem("akini_ta_name") ||
                  "对方",
                a =
                  (n ? n.avatar : null) ||
                  localStorage.getItem("akini_ta_avatar") ||
                  "🐰";
              window.startCall && window.startCall(i, a);
            }),
          t.addEventListener("click", function () {
            var n = window.akiniContacts
                ? window.akiniContacts.getActiveChatId()
                : null,
              i = n ? window.akiniContacts.getChatTarget(n) : null,
              a =
                (i ? i.name : null) ||
                localStorage.getItem("akini_ta_name") ||
                "对方",
              r =
                (i ? i.avatar : null) ||
                localStorage.getItem("akini_ta_avatar") ||
                "🐰",
              c = document.getElementById("phoneDialAvatar"),
              l = document.getElementById("phoneDialName");
            (l && (l.textContent = a),
              c && (c.innerHTML = nt(r, 80)),
              (e.style.display = "flex"));
          }));
      }
    })();
    let we = {
      active: !1,
      answered: !1,
      isMinimized: !1,
      isMyCalling: !1,
      selectedMembers: [],
      isGroupCall: !1,
      targetId: null,
      groupName: "",
      groupAvatar: null,
      callerName: "",
      callerAvatar: "",
      activeMember: null,
    };
    window._callState = we;
    let ke = null;
    const _e = "akini_call_state";
    function be() {
      try {
        var t = {
          active: we.active,
          answered: we.answered,
          isMinimized: we.isMinimized,
          isMyCalling: we.isMyCalling,
          isGroupCall: we.isGroupCall,
          targetId: we.targetId,
          groupName: we.groupName || "",
          groupAvatar: we.groupAvatar || null,
          callerName: we.callerName || "",
          callerAvatar: we.callerAvatar || "",
          activeMember: we.activeMember || null,
          selectedMembers: (we.selectedMembers || []).map(function (t) {
            return {
              id: t.id || null,
              name: t.name || "",
              avatar: t.avatar || "",
              answered: !!t.answered,
            };
          }),
          callStartTime: xe || null,
          sessionId: window.__akiniCallSessionId || "",
          savedAt: Date.now(),
        };
        localStorage.setItem(_e, JSON.stringify(t));
      } catch (t) {}
    }
    function Ie() {
      try {
        localStorage.removeItem(_e);
      } catch (t) {}
    }
    let xe = 0,
      Ee = null;
    function Se(t) {
      (clearInterval(ke), (ke = null), clearTimeout(Ee), (Ee = null));
      try {
        sessionStorage.removeItem("akini_call_session_id");
      } catch (t) {}
      window.__akiniCallSessionId = null;
      const e = we.active,
        n = we.answered,
        i = we.isMyCalling,
        a = we.isGroupCall,
        o = (we.selectedMembers, we.callerName, we.targetId);
      ((we = {
        active: !1,
        answered: !1,
        isMinimized: !1,
        isMyCalling: !1,
        selectedMembers: [],
        isGroupCall: !1,
        targetId: null,
        groupAvatar: null,
        callerName: "",
        callerAvatar: "",
      }),
        (window._callState = we),
        Ie(),
        ge.classList.remove("call-mini-shrunk"),
        (ge.style.display = "none"));
      const r = document.getElementById("app-call");
      (r && (r.style.display = "none"),
        Be(!1),
        Ae(!1),
        ye && (ye.style.display = "block"),
        ve && (ve.style.display = "block"),
        pe && (pe.style.display = "block"),
        he && (he.innerText = "来电中..."));
      const c = document.getElementById("callTimeDisplay");
      if ((c && (c.innerText = "00:00"), !e)) return;
      const l =
          (document.getElementById("chatTaName") || {}).innerText || "对方",
        s =
          localStorage.getItem("akini_my_name") ||
          (document.getElementById("inputMyName") || {}).value ||
          "我";
      let d = [];
      if (a) {
        if (n) {
          const t = Date.now() - xe,
            e = Math.floor(t / 6e4),
            n = Math.floor((t % 6e4) / 1e3);
          d.push(
            `通话时长 ${String(e).padStart(2, "0")}:${String(n).padStart(2, "0")}`,
          );
        }
      } else if ("timeout" === t) d.push(s + " 未接来电");
      else if ("ta_reject" === t) d.push(`${l} 拒接来电`);
      else if ("me_reject" === t) d.push(`${s} 拒接来电`);
      else if ("cancel" === t) d.push(`${s} 取消来电`);
      else if (n) {
        const t = Date.now() - xe,
          e = Math.floor(t / 6e4),
          n = Math.floor((t % 6e4) / 1e3);
        d.push(
          `通话时长 ${String(e).padStart(2, "0")}:${String(n).padStart(2, "0")}`,
        );
      } else n || i || d.push(s + " 未接来电");
      d.forEach(function (t) {
        Me(o, t);
      });
    }
    function Ae(t) {
      U &&
        (t
          ? U.classList.add("call-expanded")
          : U.classList.remove("call-expanded"));
    }
    function Ce() {
      ((we.isMinimized = !1), be());
      const t = document.getElementById("app-call");
      (t && ((t.style.display = "flex"), (t.style.zIndex = "99999999")),
        (ge.style.display = "none"),
        ge.classList.add("call-mini-shrunk"),
        (function () {
          var t = document.getElementById("callAvatarStack");
          if (t) {
            t.innerHTML = "";
            var e = we.isMyCalling,
              n = we.selectedMembers || [],
              ceAvatar =
                we.isGroupCall && we.answered && we.activeMember
                  ? we.activeMember.avatar || we.callerAvatar
                  : we.callerAvatar || "";
            if (e)
              n.forEach(function (e) {
                if (!1 !== e.answered) {
                  var n = document.createElement("div");
                  ((n.className = "call-avatar"),
                    n.setAttribute("data-call-member-id", e.id || ""),
                    (n.style.cssText =
                      "width:80px;height:80px;border-radius:50%;background:rgba(0,0,0,0.05);display:flex;align-items:center;justify-content:center;font-size:40px;border:2px solid rgba(0,0,0,0.08);overflow:hidden;"),
                    (n.innerHTML = nt(e.avatar, 80)),
                    t.appendChild(n));
                }
              });
            else if (we.isGroupCall && we.answered) {
              var a = document.getElementById("callNameFull");
              a &&
                (a.innerText = we.groupName || we.callerName || "群聊");
              n.forEach(function (e) {
                if (!1 !== e.answered) {
                  var n = document.createElement("div");
                  ((n.className = "call-avatar"),
                    n.setAttribute("data-call-member-id", e.id || ""),
                    (n.style.cssText =
                      "width:80px;height:80px;border-radius:50%;background:rgba(0,0,0,0.05);display:flex;align-items:center;justify-content:center;font-size:40px;border:2px solid rgba(0,0,0,0.08);overflow:hidden;"),
                    (n.innerHTML = nt(e.avatar, 80)),
                    t.appendChild(n));
                }
              });
            } else {
              var r = document.createElement("div");
              ((r.className = "call-avatar"),
                (r.style.cssText =
                  "width:100px;height:100px;border-radius:50%;background:rgba(0,0,0,0.05);display:flex;align-items:center;justify-content:center;font-size:50px;border:2px solid rgba(0,0,0,0.08);overflow:hidden;"),
                (r.innerHTML = nt(ceAvatar, 100)),
                t.appendChild(r));
            }
          }
        })(),
        Ae(!0));
    }
    function Be(t) {
      var e = "callBlockOverlay",
        n = document.getElementById(e);
      t
        ? (n ||
            (((n = document.createElement("div")).id = e),
            (n.style.cssText =
              "position:fixed;inset:0;background:transparent;z-index:99999998;pointer-events:auto;touch-action:none;"),
            document.body.appendChild(n)),
          (n.style.display = "block"))
        : n && (n.style.display = "none");
    }
    function Te(t, e, n) {
      if (((n = n || {}), we.active)) {
        if (!e && n.targetId && window.akiniContacts && typeof Me === "function") {
          var busyName = n.callerName || t || "对方";
          Me(n.targetId, busyName + "正忙");
        }
        return;
      }
      if (n.targetId && window.akiniContacts) {
        var profile = window.akiniContacts.getChatTarget(n.targetId);
        profile && profile.avatar && (n.callerAvatar = profile.avatar);
      }
      const i = n.selectedMembers || [
          {
            id: null,
            name: t,
            avatar:
              n.callerAvatar || localStorage.getItem("akini_ta_avatar") || "",
          },
        ],
        a = n.callerName || t,
        o = n.callerAvatar || i[0].avatar,
        r = e ? t : n.groupName || a,
        c = document.getElementById("callName"),
        l = document.getElementById("callAvatar");
      c && r && (c.innerText = r);
      const s = document.getElementById("app-call"),
        d = document.getElementById("callNameFull"),
        u = document.getElementById("callAvatarStack"),
        m = document.getElementById("callMemberStatus");
      if ((d && r && (d.innerText = r), m && (m.innerText = ""), u))
        if (((u.innerHTML = ""), e))
          i.forEach(function (t) {
            var e = document.createElement("div");
            ((e.className = "call-avatar"),
              e.setAttribute("data-call-member-id", t.id || ""),
              (e.style.cssText =
                "width:80px;height:80px;border-radius:50%;background:rgba(0,0,0,0.05);display:flex;align-items:center;justify-content:center;font-size:40px;border:2px solid rgba(0,0,0,0.08);overflow:hidden;"),
              (e.innerHTML = nt(t.avatar, 80)),
              u.appendChild(e));
          });
        else if (n.groupAvatar) {
          var f = document.createElement("div");
          ((f.className = "call-avatar"),
            (f.style.cssText =
              "width:100px;height:100px;border-radius:50%;background:rgba(0,0,0,0.05);display:flex;align-items:center;justify-content:center;font-size:50px;border:2px solid rgba(0,0,0,0.08);overflow:hidden;"),
            (f.innerHTML = nt(n.groupAvatar, 100)),
            u.appendChild(f));
        } else {
          var singleAvatar = document.createElement("div");
          ((singleAvatar.className = "call-avatar"),
            (singleAvatar.style.cssText =
              "width:100px;height:100px;border-radius:50%;background:rgba(0,0,0,0.05);display:flex;align-items:center;justify-content:center;font-size:50px;border:2px solid rgba(0,0,0,0.08);overflow:hidden;"),
            (singleAvatar.innerHTML = nt(o, 100)),
            u.appendChild(singleAvatar));
        }
      (l &&
        (n.groupAvatar
          ? (l.innerHTML = nt(n.groupAvatar, 58))
          : e && i[0]
            ? (l.innerHTML = nt(i[0].avatar, 58))
            : (l.innerHTML = nt(o, 58))),
        (we.active = !0),
        (we.answered = !1),
        (we.isMinimized = !1),
        (we.isMyCalling = e),
        (we.selectedMembers = i),
        (we.isGroupCall = n.isGroupCall || !1),
        (we.targetId =
          n.targetId ||
          (window.akiniContacts
            ? window.akiniContacts.getActiveChatId()
            : null)),
        (we.groupName = n.groupName || ""),
        (we.groupAvatar = n.groupAvatar || null),
        (we.activeMember =
          n.isGroupCall && n.selectedMembers && n.selectedMembers[0]
            ? {
                id: n.selectedMembers[0].id || null,
                name: n.selectedMembers[0].name || "",
                avatar: n.selectedMembers[0].avatar || "",
              }
            : null),
        (we.answeredMembers = []),
        (we.callerName = a),
        (we.callerAvatar = o),
        (window.__akiniCallSessionId =
          Date.now().toString(36) + Math.random().toString(36).slice(2)));
      try {
        sessionStorage.setItem(
          "akini_call_session_id",
          window.__akiniCallSessionId,
        );
      } catch (t) {}
      be();
      const g = document.getElementById("callTimeDisplay"),
        y = document.getElementById("callTimeDisplayFull");
      (g && (g.innerText = "00:00"),
        y && (y.innerText = "00:00"),
        ge.classList.remove("call-mini-shrunk"),
        (ge.style.display = "none"),
        s &&
          ((s.style.zIndex = "99999999"),
          document.body.insertBefore(s, document.body.firstChild),
          (s.style.display = "flex")));
      const inviteBtnDisplay = document.getElementById("callInviteBtn");
      inviteBtnDisplay &&
        (inviteBtnDisplay.style.display = we.isGroupCall ? "flex" : "none");
      Ae(!0);
      const p = document.getElementById("callStatusFull"),
        v = document.getElementById("callMinimizeBtnFull"),
        h = document.getElementById("callAnswerBtnFull"),
        w = document.getElementById("callHangupBtnFull");
      e
        ? (he && (he.innerText = "呼叫中..."),
          p && (p.innerText = "呼叫中..."),
          ye && (ye.style.display = "none"),
          v && (v.style.display = "none"),
          ve && (ve.style.display = "none"),
          h && (h.style.display = "none"),
          pe && (pe.style.display = "block"),
          w && (w.style.display = "block"),
          we.isGroupCall
            ? (function (t) {
                if (!t || 0 === t.length) return;
                var e = !1,
                  n = t.length,
                  answeredMembers = [];
                var answerProb =
                    window.AKR && window.AKR.getProb
                      ? window.AKR.getProb("answerCall")
                      : 0.85,
                  missProb =
                    window.AKR && window.AKR.getProb
                      ? window.AKR.getProb("missCall")
                      : 0.15,
                  rejectProb = 1 - answerProb - missProb;
                if (rejectProb < 0) rejectProb = 0;
                var i = setTimeout(function () {
                  we.active && !we.answered && Se("timeout");
                }, 15e3);
                t.forEach(function (t, a) {
                  var o = 1e3 * (1 + 3 * Math.random()) + 800 * a;
                  setTimeout(function () {
                    if (we.active) {
                      var r = Math.random();
                      if (r < answerProb) {
                        ((t.answered = !0), (e = !0), answeredMembers.push(t));
                        if (!we.answered) {
                          ((we.answered = !0),
                            (xe = Date.now()),
                            clearTimeout(i),
                            Le(),
                            be());
                          var c = document.getElementById("callMemberStatus");
                          (c && (c.innerText = ""),
                            (ke = setInterval(function () {
                              const t = Date.now() - xe,
                                e = Math.floor(t / 6e4),
                                n = Math.floor((t % 6e4) / 1e3),
                                i =
                                  String(e).padStart(2, "0") +
                                  ":" +
                                  String(n).padStart(2, "0"),
                                a = document.getElementById("callTimeDisplay");
                              a && (a.innerText = i);
                              const o = document.getElementById(
                                "callTimeDisplayFull",
                              );
                              o &&
                                ((o.innerText = i),
                                (o.style.display = "block"));
                            }, 1e3)));
                        }
                      } else {
                        t.answered = !1;
                        var l =
                          t.name +
                          (r >= answerProb + missProb
                            ? " 拒接来电"
                            : " 未接来电");
                        we.targetId && Me(we.targetId, l);
                        var s = document.querySelector(
                          '#callAvatarStack [data-call-member-id="' +
                            (t.id || "") +
                            '"]',
                        );
                        s &&
                          ((s.style.transition = "opacity 0.3s"),
                          (s.style.opacity = "0.3"),
                          setTimeout(function () {
                            if (s) {
                              s.style.opacity = "0";
                              setTimeout(function () {
                                s.style.display = "none";
                              }, 300);
                            }
                          }, 2e3));
                      }
                      0 === --n &&
                        we.active &&
                        (clearTimeout(i), e || Se("timeout"));
                    }
                  }, o);
                });
              })(i)
            : (Ee = setTimeout(function () {
                we.active && !we.answered && Se("timeout");
              }, 1e4)))
        : (he && (he.innerText = "来电中..."),
          p && (p.innerText = "来电中..."),
          ye && (ye.style.display = "none"),
          v && (v.style.display = "none"),
          ve && (ve.style.display = "block"),
          h && (h.style.display = "block"),
          pe && (pe.style.display = "block"),
          w && (w.style.display = "block"),
          Be(!0),
          (Ee = setTimeout(function () {
            we.active && !we.answered && Se("timeout");
          }, 1e4)));
    }
    function Me(t, e) {
      if (window.akiniContacts) {
        if (!t) {
          var n = window.akiniContacts.getContacts();
          n && n.length > 0 && (t = n[0].id);
        }
        if (t) {
          var msgText = rt(e) || "";
          var i =
            '<div class="msg-row system"><div class="bubble">' +
            msgText +
            "</div></div>";
          var session = window.akiniContacts.getSession(t);
          var prevHTML = session.messagesHTML || "";
          // 避免消息历史中连续重复的系统提示（按最近一条系统消息内容去重）
          var prevSystemText = "";
          try {
            var tmpDiv = document.createElement("div");
            tmpDiv.innerHTML = prevHTML;
            var sysRows = tmpDiv.querySelectorAll(".msg-row.system");
            if (sysRows.length > 0) {
              var lastSys = sysRows[sysRows.length - 1];
              var lastBubble = lastSys.querySelector(".bubble");
              prevSystemText = (lastBubble ? lastBubble.textContent : lastSys.textContent) || "";
              prevSystemText = prevSystemText.trim();
            }
          } catch (err) {}
          if (prevSystemText !== msgText) {
            var a = prevHTML + i;
            window.akiniContacts.updateSession(t, {
              messagesHTML: a,
              lastTime: Date.now(),
            });
            C(t, a);
          }
          V();
          if (U && window.akiniContacts.getActiveChatId() === t) {
            var last = U.lastElementChild;
            if (
              !last ||
              !last.classList.contains("system") ||
              (last.textContent || "").trim() !== msgText
            ) {
              var o = document.createElement("div");
              (o.className = "msg-row system"),
                (o.innerHTML = '<div class="bubble">' + msgText + "</div>"),
                U.appendChild(o),
                (U.scrollTop = U.scrollHeight);
            }
          }
          "function" == typeof ot && ot();
        }
      }
    }
    function Le() {
      he && (he.innerText = "通话中");
      const t = document.getElementById("callStatusFull");
      t && (t.innerText = "通话中");
      if (we.isGroupCall && we.selectedMembers) {
        var answered = we.selectedMembers.filter(function (m) {
          return m.answered;
        });
        if (answered.length > 0) {
          const e = document.getElementById("callNameFull"),
            n = document.getElementById("callAvatarStack");
          e && (e.innerText = we.groupName || we.callerName || "群聊");
          if (n) {
            n.innerHTML = "";
            answered.forEach(function (m) {
              var d = document.createElement("div");
              ((d.className = "call-avatar"),
                d.setAttribute("data-call-member-id", m.id || ""),
                (d.style.cssText =
                  "width:80px;height:80px;border-radius:50%;background:rgba(0,0,0,0.05);display:flex;align-items:center;justify-content:center;font-size:40px;border:2px solid rgba(0,0,0,0.08);overflow:hidden;"),
                (d.innerHTML = nt(m.avatar, 80)),
                n.appendChild(d));
            });
            if (we.groupAvatar && answered.length > 1) {
              var mainDiv = document.createElement("div");
              ((mainDiv.className = "call-avatar"),
                (mainDiv.style.cssText =
                  "width:100px;height:100px;border-radius:50%;background:rgba(0,0,0,0.05);display:flex;align-items:center;justify-content:center;font-size:50px;border:2px solid rgba(0,0,0,0.08);overflow:hidden;"),
                (mainDiv.innerHTML = nt(we.groupAvatar, 100)),
                n.insertBefore(mainDiv, n.firstChild));
            }
          }
        } else if (we.activeMember) {
          const e = document.getElementById("callNameFull"),
            n = document.getElementById("callAvatarStack");
          e && (e.innerText = we.activeMember.name || we.callerName || "群聊");
          if (n) {
            n.innerHTML = "";
            var leAvatarDiv = document.createElement("div");
            ((leAvatarDiv.className = "call-avatar"),
              (leAvatarDiv.style.cssText =
                "width:100px;height:100px;border-radius:50%;background:rgba(0,0,0,0.05);display:flex;align-items:center;justify-content:center;font-size:50px;border:2px solid rgba(0,0,0,0.08);overflow:hidden;"),
              (leAvatarDiv.innerHTML = nt(we.activeMember.avatar, 100)),
              n.appendChild(leAvatarDiv));
          }
        }
      }
      const e = document.getElementById("callAnswerBtnFull");
      (e && (e.style.display = "none"), ve && (ve.style.display = "none"));
      const n = document.getElementById("callMinimizeBtnFull");
      (n && (n.style.display = "block"), ye && (ye.style.display = "block"));
      const i = document.getElementById("callHangupBtnFull");
      (i && (i.style.display = "block"), pe && (pe.style.display = "block"));
      const a = document.getElementById("callTimeDisplayFull");
      (a && (a.style.display = "block"), Be(!1));
    }
    window.startCall = function (t, e) {
      Te(t, !0, { callerAvatar: e });
    };
    window.startCall;
    function De(t) {
      var e = null;
      try {
        var n = localStorage.getItem(Fe);
        n && (e = JSON.parse(n));
      } catch (t) {}
      e && "number" == typeof e.top && "number" == typeof e.left
        ? t && t(e)
        : window._idbStore && window._idbStore.get
          ? window._idbStore.get(Fe, function (e) {
              var n = null;
              try {
                e && (n = JSON.parse(e));
              } catch (t) {}
              t && t(n);
            })
          : t && t(null);
    }
    function Ne() {
      if (!we.active) return;
      ((we.isMinimized = !0), be());
      const t = document.getElementById("app-call");
      (t && (t.style.display = "none"),
        (ge.style.zIndex = "2147483647"),
        document.body.insertBefore(ge, document.body.firstChild),
        De(function (t) {
          t && "number" == typeof t.top && "number" == typeof t.left
            ? (ge.style.cssText =
                "display:flex; position:fixed; top:" +
                t.top +
                "px; left:" +
                t.left +
                "px; right:auto; transform:none; z-index:2147483647;")
            : (ge.style.cssText =
                "display:flex; position:fixed; top:60px; left:50%; right:auto; transform:translateX(-50%); z-index:2147483647;");
        }),
        ge.classList.add("call-mini-shrunk"));
      var e = document.getElementById("callAvatar"),
        n = document.getElementById("callName");
      (e &&
        we.isGroupCall &&
        we.groupAvatar &&
        (e.innerHTML = nt(we.groupAvatar, 58)),
        n &&
          we.isGroupCall &&
          (n.innerText = we.groupName || we.callerName || "群聊"));
      const timeDisplayEl = document.getElementById("callTimeDisplay");
      if (n && xe) {
        const t = Math.max(0, Date.now() - xe),
          e = Math.floor(t / 6e4),
          i = Math.floor((t % 6e4) / 1e3);
        n.innerText =
          String(e).padStart(2, "0") + ":" + String(i).padStart(2, "0");
      }
      Ae(!1);
    }
    ((window.startCall = function (t) {
      Te(t, !0);
      const e = Math.random(),
        n = 1e3 * (2 + 3 * Math.random()),
        i = 1e3 * (3 + 4 * Math.random());
      e < 0.85
        ? setTimeout(function () {
            we.active &&
              !we.answered &&
              (clearTimeout(Ee),
              (Ee = null),
              (we.answered = !0),
              (xe = Date.now()),
              be(),
              Le(),
              (ke = setInterval(function () {
                const t = Date.now() - xe,
                  e = Math.floor(t / 6e4),
                  n = Math.floor((t % 6e4) / 1e3),
                  i =
                    String(e).padStart(2, "0") +
                    ":" +
                    String(n).padStart(2, "0"),
                  a = document.getElementById("callTimeDisplay");
                a && (a.innerText = i);
                const o = document.getElementById("callTimeDisplayFull");
                o && ((o.innerText = i), (o.style.display = "block"));
              }, 1e3)));
          }, n)
        : setTimeout(function () {
            we.active &&
              !we.answered &&
              (clearTimeout(Ee), (Ee = null), Se("ta_reject"));
          }, i);
    }),
      a(ye, Ne));
    const Pe = document.getElementById("callMinimizeBtnFull");
    (Pe && a(Pe, Ne),
      a(pe, function () {
        if (!we.active) return;
        let t = null;
        (we.answered || (t = we.isMyCalling ? "cancel" : "me_reject"), Se(t));
      }));
    const He = document.getElementById("callHangupBtnFull");
    (He &&
      a(He, function () {
        if (!we.active) return;
        let t = null;
        (we.answered || (t = we.isMyCalling ? "cancel" : "me_reject"), Se(t));
      }),
      a(ve, function () {
        we.active &&
          (clearTimeout(Ee),
          (Ee = null),
          (we.answered = !0),
          (xe = Date.now()),
          be(),
          Le(),
          (ke = setInterval(function () {
            const t = Date.now() - xe,
              e = Math.floor(t / 6e4),
              n = Math.floor((t % 6e4) / 1e3),
              i = String(e).padStart(2, "0") + ":" + String(n).padStart(2, "0"),
              a = document.getElementById("callTimeDisplay");
            a && (a.innerText = i);
            const o = document.getElementById("callTimeDisplayFull");
            o && ((o.innerText = i), (o.style.display = "block"));
          }, 1e3)));
      }));
    const ze = document.getElementById("callAnswerBtnFull");
    if (
      (ze &&
        a(ze, function () {
          we.active &&
            (clearTimeout(Ee),
            (Ee = null),
            (we.answered = !0),
            (xe = Date.now()),
            be(),
            Le(),
            (ke = setInterval(function () {
              const t = Date.now() - xe,
                e = Math.floor(t / 6e4),
                n = Math.floor((t % 6e4) / 1e3),
                i =
                  String(e).padStart(2, "0") + ":" + String(n).padStart(2, "0"),
                a = document.getElementById("callTimeDisplay");
              a && (a.innerText = i);
              const o = document.getElementById("callTimeDisplayFull");
              o && ((o.innerText = i), (o.style.display = "block"));
            }, 1e3)));
        }),
      ge)
    ) {
      function Oe(t) {
        we.isMinimized &&
          (ge._didDrag
            ? (ge._didDrag = !1)
            : t.target.closest("button") ||
              (t.cancelable && (t.preventDefault(), t.stopPropagation()),
              Ce()));
      }
      (ge.addEventListener("touchend", Oe, { passive: !1 }),
        ge.addEventListener("click", Oe));
    }
    function Re(t, e) {
      if (!t) return;
      let n,
        i,
        a,
        o,
        r = !1;
      function c(t) {
        return t.touches && t.touches.length
          ? t.touches[0]
          : t.changedTouches && t.changedTouches.length
            ? t.changedTouches[0]
            : t;
      }
      function l(e) {
        if (e.target.closest("button")) return;
        ((r = !0), (t._didDrag = !1));
        const l = c(e);
        ((n = l.clientX), (i = l.clientY));
        const s = t.getBoundingClientRect();
        ((a = s.left),
          (o = s.top),
          (t.style.transform = "none"),
          (t.style.left = a + "px"),
          (t.style.top = o + "px"),
          (t.style.right = "auto"));
      }
      function s(e) {
        if (!r) return;
        const l = c(e),
          s = l.clientX - n,
          d = l.clientY - i;
        (Math.abs(s) > 3 || Math.abs(d) > 3) && (t._didDrag = !0);
        const u = window.innerWidth,
          m = window.innerHeight,
          f = t.getBoundingClientRect(),
          g = f.width,
          y = f.height,
          p = Math.min(Math.max(a + s, 0), u - g),
          v = Math.min(Math.max(o + d, 0), m - y);
        ((t.style.left = p + "px"), (t.style.top = v + "px"));
      }
      function d() {
        if (r && ((r = !1), e))
          try {
            var n = t.getBoundingClientRect(),
              i = JSON.stringify({
                top: n.top,
                left: n.left,
                savedAt: Date.now(),
              });
            (localStorage.setItem(e, i),
              window._idbStore &&
                window._idbStore.set &&
                window._idbStore.set(e, i));
          } catch (t) {}
      }
      (t.addEventListener("touchstart", l, { passive: !0 }),
        t.addEventListener(
          "touchmove",
          function (t) {
            r && (t.preventDefault(), s(t));
          },
          { passive: !1 },
        ),
        t.addEventListener("touchend", d, { passive: !0 }),
        t.addEventListener("mousedown", l),
        t.addEventListener("mousemove", function (t) {
          r && (t.preventDefault(), s(t));
        }),
        t.addEventListener("mouseup", d),
        t.addEventListener("mouseleave", d));
    }
    const Fe = "akini_call_mini_pos";
    (Re(ge, Fe),
      Re(document.getElementById("app-call"), "akini_call_full_pos"));
    a(document.getElementById("callBtn"), function () {
      const t = window.akiniContacts
          ? window.akiniContacts.getActiveChatId()
          : null,
        e = t ? window.akiniContacts.getChatTarget(t) : null;
      if (e && "group" === e.type)
        !(function (t) {
          if (!qe || !je) return;
          var e = window.akiniContacts
            ? window.akiniContacts.getChatTarget(t)
            : null;
          if (!e || "group" !== e.type) return;
          ((Ge = t),
            (Ue = []),
            (je.innerHTML = ""),
            (e.memberIds || []).forEach(function (t) {
              var e = window.akiniContacts.getChatTarget(t);
              e &&
                Ue.push({
                  id: t,
                  name: e.name,
                  avatar: e.avatar,
                  selected: !0,
                });
            }),
            Ke(),
            (qe.style.display = "flex"));
        })(t);
      else {
        const t =
            e && e.name
              ? e.name
              : (document.getElementById("chatTaName") || {}).innerText ||
                "哥哥",
          n =
            e && e.avatar
              ? e.avatar
              : localStorage.getItem("akini_ta_avatar") || "🐰";
        window.startCall && window.startCall(t, n);
      }
    });
    const inviteBtn = document.getElementById("callInviteBtn");
    inviteBtn && a(inviteBtn, openInvitePicker);
    const qe = document.getElementById("callMemberPicker"),
      je = document.getElementById("callMemberPickerList"),
      $e = document.getElementById("callMemberPickerClose"),
      We = document.getElementById("callMemberPickerCancel"),
      Je = document.getElementById("callMemberPickerCall");
    var Ge = null,
      Ue = [];
    function Ke() {
      je &&
        ((je.innerHTML = ""),
        Ue.forEach(function (t, e) {
          var n = document.createElement("div");
          ((n.style.cssText =
            "display:flex;align-items:center;gap:12px;padding:12px 20px;cursor:pointer;border-bottom:1px solid #f5f5f5;"),
            (n.innerHTML =
              '<div style="width:22px;height:22px;border-radius:6px;border:2px solid #34c759;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
              (t.selected
                ? '<div style="width:14px;height:14px;background:#34c759;border-radius:3px;"></div>'
                : "") +
              '</div><div style="width:40px;height:40px;border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#e8e8e8;">' +
              nt(t.avatar, 40) +
              '</div><div style="font-size:15px;color:#222;flex:1;">' +
              rt(t.name) +
              "</div>"),
            n.addEventListener("click", function () {
              ((t.selected = !t.selected), Ke());
            }),
            je.appendChild(n));
        }));
    }
    function Xe() {
      (qe && (qe.style.display = "none"), (Ge = null), (Ue = []));
    }
    ($e && $e.addEventListener("click", Xe),
      We && We.addEventListener("click", Xe),
      Je &&
        Je.addEventListener("click", function () {
          var t = Ue.filter(function (t) {
            return t.selected;
          });
          if (0 !== t.length) {
            var e = Ge,
              n = e ? window.akiniContacts.getChatTarget(e) : null,
              i = n ? n.name : "群聊",
              a = n ? n.avatar : "";
            Xe();
            var o = t[0];
            Te(i, !0, {
              isGroupCall: !0,
              targetId: e,
              groupName: i,
              groupAvatar: a,
              callerName: i,
              callerAvatar: a,
              selectedMembers: t,
            });
          } else alert("请选择至少一位联系人");
        }));
    const iep = document.getElementById("callInvitePicker"),
      iel = document.getElementById("callInvitePickerList"),
      iepc = document.getElementById("callInvitePickerClose"),
      iepCancel = document.getElementById("callInvitePickerCancel"),
      iepConfirm = document.getElementById("callInvitePickerConfirm");
    var inviteCandidates = [];
    function openInvitePicker() {
      if (!we.active || !we.isGroupCall) return;
      if (!window.akiniContacts) return;
      inviteCandidates = [];
      var currentIds = (we.selectedMembers || []).map(function (m) {
        return m.id;
      });
      var contacts = window.akiniContacts.getContacts();
      contacts.forEach(function (c) {
        if (currentIds.indexOf(c.id) < 0 && c.id !== "me") {
          inviteCandidates.push({
            id: c.id,
            name: c.name,
            avatar: c.avatar,
            selected: false,
          });
        }
      });
      if (inviteCandidates.length === 0) {
        alert("没有可邀请的联系人");
        return;
      }
      renderInviteCandidates();
      iep.style.display = "flex";
    }
    function renderInviteCandidates() {
      iel &&
        ((iel.innerHTML = ""),
        inviteCandidates.forEach(function (t, e) {
          var n = document.createElement("div");
          n.style.cssText =
            "display:flex;align-items:center;gap:12px;padding:12px 20px;cursor:pointer;border-bottom:1px solid #f5f5f5;";
          n.innerHTML =
            '<div style="width:22px;height:22px;border-radius:6px;border:2px solid #34c759;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
            (t.selected
              ? '<div style="width:14px;height:14px;background:#34c759;border-radius:3px;"></div>'
              : "") +
            '</div><div style="width:40px;height:40px;border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#e8e8e8;">' +
            nt(t.avatar, 40) +
            '</div><div style="font-size:15px;color:#222;flex:1;">' +
            rt(t.name) +
            "</div>";
          n.addEventListener("click", function () {
            ((t.selected = !t.selected), renderInviteCandidates());
          });
          iel.appendChild(n);
        }));
    }
    function closeInvitePicker() {
      iep && (iep.style.display = "none");
      inviteCandidates = [];
    }
    function confirmInvite() {
      if (!we.active || !we.isGroupCall) return closeInvitePicker();
      var selected = inviteCandidates.filter(function (t) {
        return t.selected;
      });
      if (selected.length === 0) return closeInvitePicker();
      var answerProb =
          window.AKR && window.AKR.getProb
            ? window.AKR.getProb("answerCall")
            : 0.85,
        missProb =
          window.AKR && window.AKR.getProb
            ? window.AKR.getProb("missCall")
            : 0.15,
        rejectProb = 1 - answerProb - missProb;
      if (rejectProb < 0) rejectProb = 0;
      selected.forEach(function (t, a) {
        we.selectedMembers.push(t);
        var delay = 1e3 * (1 + 3 * Math.random()) + 800 * a;
        setTimeout(function () {
          if (we.active) {
            var r = Math.random();
            if (r < answerProb) {
              t.answered = true;
              we.selectedMembers.forEach(function (m) {
                if (m.id === t.id) m.answered = true;
              });
              if (!we.answered) {
                we.answered = true;
                xe = Date.now();
                Le();
                be();
                ke = setInterval(function () {
                  const t = Date.now() - xe,
                    e = Math.floor(t / 6e4),
                    n = Math.floor((t % 6e4) / 1e3),
                    i =
                      String(e).padStart(2, "0") +
                      ":" +
                      String(n).padStart(2, "0"),
                    a = document.getElementById("callTimeDisplay");
                  a && (a.innerText = i);
                  const o = document.getElementById("callTimeDisplayFull");
                  o && ((o.innerText = i), (o.style.display = "block"));
                }, 1e3);
              } else {
                Le();
                var c = document.getElementById("callMemberStatus");
                c && (c.innerText = "");
              }
            } else {
              t.answered = false;
              var l =
                t.name +
                (r >= answerProb + missProb ? " 拒接来电" : " 未接来电");
              we.targetId && Me(we.targetId, l);
              var s = document.querySelector(
                '#callAvatarStack [data-call-member-id="' + (t.id || "") + '"]',
              );
              s &&
                ((s.style.transition = "opacity 0.3s"),
                (s.style.opacity = "0.3"),
                setTimeout(function () {
                  if (s) {
                    s.style.opacity = "0";
                    setTimeout(function () {
                      s.style.display = "none";
                    }, 300);
                  }
                }, 2e3));
            }
          }
        }, delay);
      });
      closeInvitePicker();
    }
    (iepc && iepc.addEventListener("click", closeInvitePicker),
      iepCancel && iepCancel.addEventListener("click", closeInvitePicker),
      iepConfirm && iepConfirm.addEventListener("click", confirmInvite));
    const Ye = document.getElementById("chatTaAvatar"),
      Qe = document.getElementById("chatTaName");
    function Ze() {
      const t = document.getElementById("replyDelayMin"),
        e = document.getElementById("replyDelayMax"),
        n = 1e3 * parseFloat((t && t.value) || 2),
        i = 1e3 * parseFloat((e && e.value) || 5),
        a = n + Math.random() * Math.max(0, i - n);
      setTimeout(function () {
        window.triggerTaReplyOnce && window.triggerTaReplyOnce();
      }, a);
    }
    (Ye && Ye.addEventListener("dblclick", Ze),
      Qe && Qe.addEventListener("dblclick", Ze),
      [Ye, Qe].forEach(function (t) {
        if (t) {
          var e = 0;
          t.addEventListener(
            "touchend",
            function (t) {
              var n = Date.now();
              (n - e < 350 && Ze(), (e = n));
            },
            { passive: !0 },
          );
        }
      }),
      (function t() {
        const e = 1e3 * (300 + 300 * Math.random());
        setTimeout(function () {
          if (
            !we.active &&
            Math.random() < window.AKR.getProb("incomingCall") &&
            window.AKR.isInTimeRange("reply")
          ) {
            const t = window.akiniContacts
                ? window.akiniContacts.getActiveChatId()
                : null,
              o = t ? window.akiniContacts.getChatTarget(t) : null;
            var e =
                (document.getElementById("chatTaName") || {}).innerText ||
                "哥哥",
              n =
                o && o.avatar
                  ? o.avatar
                  : localStorage.getItem("akini_ta_avatar") || "🐰";
            if (
              o &&
              "group" === o.type &&
              o.memberIds &&
              o.memberIds.length > 0
            ) {
              var i = o.memberIds
                .map(function (t) {
                  return window.akiniContacts.getChatTarget(t);
                })
                .filter(Boolean);
              if (i.length > 0) {
                Te(o.name || e, !1, {
                  isGroupCall: !0,
                  targetId: t,
                  groupName: o.name || e,
                  groupAvatar: o.avatar || n,
                  callerName: o.name || e,
                  callerAvatar: o.avatar || n,
                  selectedMembers: i,
                });
              }
            } else
              (Te(e, !1, { callerName: e, callerAvatar: n, targetId: t }),
                "function" == typeof window.showInAppNotif &&
                  window.showInAppNotif({
                    app: "电话",
                    appIcon: "📞",
                    avatar: n,
                    name: e,
                    msg: "正在来电",
                    onTap: function () {},
                  }));
          }
          t();
        }, e);
      })());
    ((function () {
      if (
        (function () {
          try {
            var t = localStorage.getItem(_e);
            if (!t) return !1;
            var e = JSON.parse(t);
            if (!e || !e.active) return !1;
            Se();
            return !1;
          } catch (t) {
            return (Ie(), !1);
          }
        })()
      )
        if (we.isMinimized) {
          (De(function (t) {
            t && "number" == typeof t.top && "number" == typeof t.left
              ? (ge.style.cssText =
                  "display:flex; position:fixed; top:" +
                  t.top +
                  "px; left:" +
                  t.left +
                  "px; right:auto; transform:none; z-index:2147483647;")
              : (ge.style.cssText =
                  "display:flex; position:fixed; top:60px; left:50%; right:auto; transform:translateX(-50%); z-index:2147483647;");
          }),
            ge.classList.add("call-mini-shrunk"));
          const t = document.getElementById("callName"),
            e = document.getElementById("callAvatar");
          (t &&
            (t.innerText = we.isGroupCall
              ? we.callerName || "群聊"
              : we.callerName || we.selectedMembers[0].name || "来电"),
            e &&
              (e.innerHTML = nt(
                we.isGroupCall && we.groupAvatar
                  ? we.groupAvatar
                  : we.callerAvatar || we.selectedMembers[0].avatar || "",
                58,
              )),
            we.answered && xe
              ? (he && (he.innerText = "通话中"),
                (ke = setInterval(function () {
                  const t = Math.max(0, Date.now() - xe),
                    e = Math.floor(t / 6e4),
                    n = Math.floor((t % 6e4) / 1e3),
                    i =
                      String(e).padStart(2, "0") +
                      ":" +
                      String(n).padStart(2, "0"),
                    a = document.getElementById("callTimeDisplay");
                  a && (a.innerText = i);
                  const o = document.getElementById("callTimeDisplayFull");
                  o && (o.innerText = i);
                }, 1e3)))
              : (we.isMyCalling
                  ? (he && (he.innerText = "呼叫中..."),
                    ye && (ye.style.display = "none"),
                    ve && (ve.style.display = "none"),
                    pe && (pe.style.display = "block"))
                  : (he && (he.innerText = "来电中..."),
                    ye && (ye.style.display = "none"),
                    ve && (ve.style.display = "block"),
                    pe && (pe.style.display = "block")),
                (Ee = setTimeout(function () {
                  we.active && !we.answered && Se("timeout");
                }, 1e4))));
        } else {
          const t = document.getElementById("app-call");
          t && ((t.style.zIndex = "99999999"), (t.style.display = "flex"));
          const cstatus = document.getElementById("callStatusFull");
          const abtn = document.getElementById("callAnswerBtnFull");
          const hbtn = document.getElementById("callHangupBtnFull");
          const mbtn = document.getElementById("callMinimizeBtnFull");
          we.answered
            ? Le()
            : (we.isMyCalling
                ? (cstatus && (cstatus.innerText = "正在呼叫..."),
                  abtn && (abtn.style.display = "none"),
                  mbtn && (mbtn.style.display = "none"),
                  hbtn && (hbtn.style.display = "block"),
                  pe && (pe.style.display = "block"),
                  ye && (ye.style.display = "none"),
                  ve && (ve.style.display = "none"),
                  he && (he.innerText = "呼叫中..."))
                : (cstatus && (cstatus.innerText = "来电中..."),
                  abtn && (abtn.style.display = "block"),
                  mbtn && (mbtn.style.display = "none"),
                  hbtn && (hbtn.style.display = "block"),
                  pe && (pe.style.display = "block"),
                  ye && (ye.style.display = "none"),
                  ve && (ve.style.display = "block"),
                  he && (he.innerText = "来电中...")),
              Be(!0));
          we.answered && xe
            ? (ke = setInterval(function () {
                const t = Math.max(0, Date.now() - xe),
                  e = Math.floor(t / 6e4),
                  n = Math.floor((t % 6e4) / 1e3),
                  i =
                    String(e).padStart(2, "0") +
                    ":" +
                    String(n).padStart(2, "0"),
                  a = document.getElementById("callTimeDisplay");
                a && (a.innerText = i);
                const o = document.getElementById("callTimeDisplayFull");
                o && (o.innerText = i);
              }, 1e3))
            : (Ee = setTimeout(function () {
                we.active && !we.answered && Se("timeout");
              }, 1e4));
        }
    })(),
      document.addEventListener("visibilitychange", function () {
        document.hidden && A();
      }),
      document.addEventListener("visibilitychange", function () {
        if (!document.hidden && we.active)
          if ((be(), we.isMinimized))
            (De(function (t) {
              t && "number" == typeof t.top && "number" == typeof t.left
                ? (ge.style.cssText =
                    "display:flex; position:fixed; top:" +
                    t.top +
                    "px; left:" +
                    t.left +
                    "px; right:auto; transform:none; z-index:2147483647;")
                : (ge.style.cssText =
                    "display:flex; position:fixed; top:60px; left:50%; right:auto; transform:translateX(-50%); z-index:2147483647;");
            }),
              ge.classList.add("call-mini-shrunk"));
          else {
            const t = document.getElementById("app-call");
            t && ((t.style.zIndex = "99999999"), (t.style.display = "flex"));
          }
      }));
    const Ve = document.getElementById("transferBtn"),
      tn = document.getElementById("transferModal");
    function en(t) {
      const e = document.getElementById("transferAmountPicker"),
        n = document.getElementById("transferWordcardPicker"),
        i = document.getElementById("transferAmountInput"),
        a = document.getElementById("transferNoteInput"),
        o = a ? a.previousElementSibling : null;
      (e && (e.style.display = t ? "none" : "flex"),
        n && (n.style.display = "none"),
        i && (i.value = ""),
        a && ((a.style.display = "block"), (a.value = "")),
        o && (o.style.display = "block"),
        document.querySelectorAll(".transfer-preset").forEach(function (t) {
          t.classList.remove("active");
        }));
    }
    ((window.openTaTransferModal = function () {
      if (!tn) return;
      en(!1);
      ((function () {
        const s = document.getElementById("transferRecipientSection"),
          sel = document.getElementById("transferRecipientSelect");
        if (!s || !sel) return;
        const a = window.akiniContacts
            ? window.akiniContacts.getActiveChatId()
            : null,
          o = a ? window.akiniContacts.getChatTarget(a) : null;
        if (o && "group" === o.type) {
          s.style.display = "block";
          sel.innerHTML = "";
          const mids = (o.memberIds || []).filter(function (id) {
            return id !== "me";
          });
          mids.forEach(function (id) {
            const m = window.akiniContacts.getChatTarget(id);
            if (!m) return;
            const opt = document.createElement("option");
            opt.value = id;
            opt.textContent = m.name;
            sel.appendChild(opt);
          });
          if (sel.options.length === 0) {
            const opt = document.createElement("option");
            opt.value = "";
            opt.textContent = "无群成员";
            sel.appendChild(opt);
          }
        } else {
          s.style.display = "none";
        }
      })(),
        (function () {
          const t = document.getElementById("transferWordcardPicker");
          if (!t) return;
          const e = i("akini_wordbank", []).filter(
            (t) => !t.tab || "main" === t.tab,
          );
          if (0 === e.length) return void (t.style.display = "none");
          ((t.style.display = "flex"),
            (t.innerHTML = ""),
            e.slice(0, 20).forEach(function (e) {
              const n = (e.text || e.content || "").trim();
              if (!n) return;
              const i = document.createElement("span");
              ((i.className = "transfer-preset"),
                (i.textContent = n.length > 8 ? n.slice(0, 8) + "…" : n),
                (i.title = n),
                i.addEventListener("click", function () {
                  ((document.getElementById("transferNoteInput").value = n),
                    document
                      .querySelectorAll(
                        "#transferWordcardPicker .transfer-preset",
                      )
                      .forEach(function (t) {
                        t.classList.remove("active");
                      }),
                    this.classList.add("active"));
                }),
                t.appendChild(i));
            }));
        })());
      const t = document.getElementById("transferWordcardPicker");
      (t && (t.style.display = "flex"),
        (tn.style.zIndex = "99999999"),
        document.body.insertBefore(tn, document.body.firstChild),
        (tn.style.display = "flex"));
    }),
      a(Ve, function () {
        if (!tn) return;
        en(!0);
        const t = window.akiniContacts
            ? window.akiniContacts.getActiveChatId()
            : null,
          e = t ? window.akiniContacts.getChatTarget(t) : null,
          n = document.getElementById("transferRecipientSection"),
          i = document.getElementById("transferRecipientSelect");
        (n &&
          i &&
          (e && "group" === e.type
            ? ((n.style.display = "block"),
              (i.innerHTML = ""),
              (e.memberIds || []).forEach(function (t) {
                var e = window.akiniContacts.getChatTarget(t);
                if (e) {
                  var n = document.createElement("option");
                  ((n.value = t), (n.textContent = e.name), i.appendChild(n));
                }
              }),
              (i.value = i.options[0] ? i.options[0].value : ""))
            : (n.style.display = "none")),
          (tn.style.zIndex = "99999999"),
          document.body.insertBefore(tn, document.body.firstChild),
          (tn.style.display = "flex"));
      }),
      document.querySelectorAll(".transfer-preset").forEach(function (t) {
        t.addEventListener("click", function () {
          ((document.getElementById("transferAmountInput").value =
            this.dataset.amount),
            document.querySelectorAll(".transfer-preset").forEach(function (t) {
              t.classList.remove("active");
            }),
            this.classList.add("active"));
        });
      }));
    a(document.getElementById("transferConfirmBtn"), function () {
      const t = (
          document.getElementById("transferNoteInput").value || ""
        ).trim(),
        e =
          parseFloat(document.getElementById("transferAmountInput").value) || 0;
      if (e <= 0) return void alert("请输入转账金额");
      tn.style.display = "none";
      const n = document.getElementById("transferAmountPicker"),
        i = !n || "none" === n.style.display,
        a = window.akiniContacts
          ? window.akiniContacts.getActiveChatId()
          : null,
        o = a ? window.akiniContacts.getChatTarget(a) : null;
      let r = null;
      if (i && o && "group" === o.type) {
        const t = document.getElementById("transferRecipientSelect");
        r = t ? t.value : "me";
      }
      an(i ? "me" : "ta", e, t, null, r);
      window.akiniTriggerReply && window.akiniTriggerReply();
    });
    function nn(t) {
      t &&
        (t.style.setProperty("background", "#b0b0b0", "important"),
        t.classList.remove("me-tr", "ta-tr"),
        t.classList.add("tr-finished"));
    }
    function an(t, e, n, i, a) {
      const o = window.akiniContacts
          ? window.akiniContacts.getActiveChatId()
          : null,
        r = o ? window.akiniContacts.getChatTarget(o) : null,
        c = !(!r || "group" !== r.type),
        l = (document.getElementById("chatTaName") || {}).innerText || "对方";
      let s = null;
      if ("me" !== t && i && c) {
        var u = (r.memberIds || [])
          .map(function (t) {
            return window.akiniContacts.getChatTarget(t);
          })
          .filter(Boolean);
        s =
          u.find(function (t) {
            return t.name === i;
          }) ||
          u[0] ||
          null;
      }
      let m = a;
      !m && c && "me" !== t && (m = "me");
      const p = document.createElement("div");
      p.className =
        "msg-row " + ("me" === t ? "me" : "other") + (c ? " group" : "");
      const v = "tr_" + Date.now() + "_" + Math.random().toString(36).slice(2);
      let h;
      h =
        "me" === t
          ? `<div class="msg-avatar">${f()}</div>`
          : s
            ? `<div class="msg-avatar" data-sender-name="${rt(s.name)}">${nt(s.avatar, 36)}</div>`
            : `<div class="msg-avatar">${y()}</div>`;
      const w = v + "_status",
        k = v + "_bubble",
        _ = (n || "")
          .replace(/&/g, "&amp;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;"),
        I = __akiniFormatDateTime(new Date()),
        x =
          "me" === m
            ? g() || "我"
            : (window.akiniContacts.getChatTarget(m) || {}).name || "指定成员",
        E =
          c && m
            ? `<div class="tr-claim-tip" style="font-size:11px;opacity:0.75;margin-top:2px;">仅 ${rt(x)} 可领取</div>`
            : "",
        A = `<div class="bubble transfer-bubble ${"me" === t ? "me-tr" : "ta-tr"}" id="${k}"\n            data-tr-uid="${v}" data-tr-who="${t}" data-tr-amount="${e}" data-tr-note="${_}" data-tr-status="${w}" data-tr-recipient="${rt(m || "")}"\n            onclick="(function(el){ if(typeof window._openTransferDetailFromBubble===&#39;function&#39;) window._openTransferDetailFromBubble(el.dataset.trUid); })(this)">\n            <div style="font-size:20px;font-weight:700;color:#fff;">¥${parseFloat(e).toFixed(2)}</div>\n            <div class="tr-note" id="${v}_note">${n || ""}</div>\n            ${E}\n            <div style="height:1px;background:rgba(255,255,255,0.25);margin:6px 0 4px;"></div>\n            <div style="display:flex;justify-content:flex-end;">\n                <span class="tr-status" id="${w}">待收款</span>\n            </div>\n        </div>`;
      if (
        ((p.innerHTML =
          c && s
            ? '<div class="msg-content-line"><div class="msg-bubble-wrap"><div class="msg-sender-name">' +
              rt(s.name) +
              '</div><div class="msg-bubble-row">' +
              h +
              A +
              "</div></div>" +
              ""
            : "me" === t
              ? `<div class="msg-content-line">${A}${h}</div>${d("right")}`
              : `<div class="msg-content-line">${h}${A}</div>${d("left")}`),
        U.appendChild(p),
        (window._transferStates[v] = {
          uid: v,
          who: t,
          amount: e,
          note: n,
          status: "待收款",
          time: I,
          refunded: !1,
          senderName: i || "",
          senderId: (s && s.id) || "",
          recipientId: m || "",
          targetId: o,
        }),
        S(),
        (U.scrollTop = U.scrollHeight),
        b(o),
        "me" === t)
      )
        if (c && m && "me" !== m) {
          const t = 1e3 * (3 + 7 * Math.random()),
            e = Math.random() < window.AKR.getProb("refundTransfer");
          setTimeout(function () {
            const t = window._transferStates[v];
            if (!t) return;
            const n = document.getElementById(w),
              i = document.getElementById(k),
              a = e ? "已退回" : "已收款";
            ((t.status = a), n && (n.textContent = a), i && nn(i));
            const o = document.createElement("div");
            ((o.className = "msg-row system"),
              (o.innerHTML = `<div class="bubble">${rt(x)}${e ? "已退回转账" : "已收款"}</div>`),
              U.appendChild(o),
              S(),
              (U.scrollTop = U.scrollHeight),
              b(),
              window.akiniTriggerReply && window.akiniTriggerReply());
          }, t);
        } else {
          const t = 1e3 * (3 + 7 * Math.random()),
            e = Math.random() < window.AKR.getProb("refundTransfer");
          setTimeout(function () {
            const t = window._transferStates[v];
            if (!t) return;
            const n = document.getElementById(w),
              i = document.getElementById(k),
              a = e ? "已退回" : "已收款";
            ((t.status = a), n && (n.textContent = a), i && nn(i));
            const o = document.createElement("div");
            ((o.className = "msg-row system"),
              (o.innerHTML = `<div class="bubble">${e ? l + "已退回转账" : l + "已收款"}</div>`),
              U.appendChild(o),
              S(),
              (U.scrollTop = U.scrollHeight),
              b(),
              window.akiniTriggerReply && window.akiniTriggerReply());
          }, t);
        }
      else if (c && m && "me" !== m) {
        const t = 1e3 * (3 + 7 * Math.random()),
          e = Math.random() < window.AKR.getProb("refundTransfer");
        setTimeout(function () {
          const t = window._transferStates[v];
          if (!t) return;
          const n = document.getElementById(w),
            i = document.getElementById(k),
            a = e ? "已退回" : "已收款";
          ((t.status = a), n && (n.textContent = a), i && nn(i));
          const o = document.createElement("div");
          ((o.className = "msg-row system"),
            (o.innerHTML = `<div class="bubble">${rt(x)}${e ? "已退回转账" : "已收款"}</div>`),
            U.appendChild(o),
            S(),
            (U.scrollTop = U.scrollHeight),
            b(),
            window.akiniTriggerReply && window.akiniTriggerReply());
        }, t);
      }
      return v;
    }
    (a(document.getElementById("transferCancelBtn"), function () {
      tn && (tn.style.display = "none");
    }),
      (window._transferStates = window._transferStates || {}),
      (window._openTransferDetailFromBubble = function (t) {
        if (!window._transferStates[t]) {
          var e = document.getElementById(t + "_bubble");
          e &&
            e.dataset &&
            (window._transferStates[t] = {
              uid: t,
              who: e.dataset.trWho || "ta",
              amount: e.dataset.trAmount || "0",
              note: e.dataset.trNote || "",
              status:
                (document.getElementById(t + "_status") || {}).textContent ||
                "待收款",
              time: __akiniFormatDateTime(new Date()),
              refunded: !1,
              recipientId: e.dataset.trRecipient || "",
              targetId: window.akiniContacts
                ? window.akiniContacts.getActiveChatId()
                : null,
            });
        }
        !(function (t) {
          const e = window._transferStates[t];
          if (!e) return;
          const n = document.getElementById("tdModal"),
            i = document.getElementById("tdAmount"),
            a = document.getElementById("tdNote"),
            o = document.getElementById("tdTime"),
            r = document.getElementById("tdStatus"),
            c = document.getElementById("tdActionBtn"),
            l = document.getElementById("tdReturnBtn"),
            s = document.getElementById("tdClose");
          if (!n || !i) return;
          ((i.textContent = "¥" + parseFloat(e.amount).toFixed(2)),
            (a.textContent = e.note || "（无备注）"),
            (o.textContent = e.time || __akiniFormatDateTime(new Date())),
            (r.textContent = "待收款" === e.status ? "待收款" : e.status),
            (c.style.display = "block"),
            l && (l.style.display = "none"));
          const d = e.recipientId || "",
            u =
              "me" === d
                ? g() || "我"
                : (window.akiniContacts.getChatTarget(d) || {}).name ||
                  "指定成员",
            m = !(
              !e.targetId ||
              "group" !==
                (window.akiniContacts.getChatTarget(e.targetId) || {}).type
            ),
            f = "me" !== e.who && (!d || "me" === d);
          ("me" === e.who
            ? m && d && "me" !== d
              ? ((c.textContent =
                  "待收款" === e.status ? "待" + u + "领取" : e.status),
                (c.onclick = function () {
                  n.style.display = "none";
                }))
              : ((c.textContent = e.status),
                (c.onclick = function () {
                  n.style.display = "none";
                }))
            : "待收款" === e.status && f
              ? ((c.textContent = "收款"),
                (c.onclick = function () {
                  (confirmCollect(t), (n.style.display = "none"));
                }),
                l &&
                  ((l.style.display = "block"),
                  (l.onclick = function () {
                    (refundTransfer(t), (n.style.display = "none"));
                  })))
              : "待收款" === e.status
                ? ((c.textContent = "仅" + u + "可领取"),
                  (c.onclick = function () {
                    n.style.display = "none";
                  }))
                : "已退回" === e.status
                  ? ((c.textContent = "已退回"),
                    (c.onclick = function () {
                      n.style.display = "none";
                    }))
                  : ((c.textContent = e.status),
                    (c.onclick = function () {
                      n.style.display = "none";
                    })),
            s &&
              (s.onclick = function () {
                n.style.display = "none";
              }),
            document.body.insertBefore(n, document.body.firstChild),
            (n.style.display = "flex"));
        })(t);
      }),
      (window._showTransferDetail = function (t, e, n, i, a) {
        i && 0 === String(i).indexOf("tr_")
          ? window._openTransferDetailFromBubble(i)
          : t &&
            0 === String(t).indexOf("tr_") &&
            window._openTransferDetailFromBubble(t);
      }),
      (window.confirmCollect = function (t) {
        const e = window._transferStates[t];
        if (!e || "ta" !== e.who) return;
        e.status = "已收款";
        const n = document.getElementById(t + "_status"),
          i = document.getElementById(t + "_bubble");
        (n && (n.textContent = "已收款"), i && nn(i));
        const a = document.createElement("div");
        ((a.className = "msg-row system"),
          (a.innerHTML = '<div class="bubble">你已收款</div>'),
          U.appendChild(a),
          S(),
          (U.scrollTop = U.scrollHeight));
        window.akiniTriggerReply && window.akiniTriggerReply();
      }),
      (window.refundTransfer = function (t) {
        const e = window._transferStates[t];
        if (!e || "ta" !== e.who) return;
        ((e.status = "已退回"), (e.refunded = !0));
        const n = document.getElementById(t + "_status"),
          i = document.getElementById(t + "_bubble");
        (n && (n.textContent = "已退回"), i && nn(i));
        const a = document.createElement("div");
        ((a.className = "msg-row system"),
          (a.innerHTML = '<div class="bubble">你已退回转账</div>'),
          U.appendChild(a),
          S(),
          (U.scrollTop = U.scrollHeight));
        window.akiniTriggerReply && window.akiniTriggerReply();
      }),
      (window.taInitiateTransfer = function (t, e) {
        (t || (t = 1 * (99 * Math.random() + 1).toFixed(2)),
          e || (e = "给你的"),
          an("ta", t, e));
      }),
      (function () {
        const t = document.getElementById("tdModal");
        t &&
          (t.addEventListener("touchend", function (e) {
            e.target === t && (t.style.display = "none");
          }),
          t.addEventListener("click", function (e) {
            e.target === t && (t.style.display = "none");
          }));
      })());
    (function () {
      const t = document.getElementById("msgContextMenu"),
        e = document.getElementById("msgContextMenuOverlay");
      if (!t || !e) return;
      let n = null;
      function i(i, a, o) {
        n = o;
        const r = o.classList.contains("me"),
          c = document.getElementById("ctxRevoke");
        c && (c.style.display = r ? "flex" : "none");
        const l = c ? c.previousElementSibling : null;
        (l &&
          l.classList.contains("ctx-sep") &&
          (l.style.display = r ? "" : "none"),
          (t.style.display = "block"),
          (e.style.display = "block"),
          (e.style.pointerEvents = "auto"));
        let s = i,
          d = a;
        (s + 150 > window.innerWidth && (s = window.innerWidth - 150 - 8),
          d + 170 > window.innerHeight && (d = a - 170 - 8),
          s < 8 && (s = 8),
          d < 8 && (d = 8),
          (t.style.left = s + "px"),
          (t.style.top = d + "px"));
      }
      function a() {
        ((t.style.display = "none"),
          (e.style.display = "none"),
          (e.style.pointerEvents = "none"),
          (n = null));
      }
      e.addEventListener("click", a);
      let o = null;
      (document.addEventListener(
        "touchstart",
        function (t) {
          const e = t.target.closest(".bubble");
          if (!e) return;
          const n = e.closest(".msg-row");
          if (!n || n.classList.contains("system")) return;
          const a = t.touches[0];
          o = setTimeout(function () {
            (t.preventDefault(), i(a.clientX, a.clientY, n));
          }, 500);
        },
        { passive: !0 },
      ),
        document.addEventListener("touchend", function () {
          clearTimeout(o);
        }),
        document.addEventListener("touchmove", function () {
          clearTimeout(o);
        }),
        document.addEventListener("contextmenu", function (t) {
          const e = t.target.closest(".bubble");
          if (!e) return;
          const n = e.closest(".msg-row");
          n &&
            !n.classList.contains("system") &&
            (t.preventDefault(), i(t.clientX, t.clientY, n));
        }),
        document
          .getElementById("ctxCopy")
          .addEventListener("click", function () {
            if (!n) return void a();
            const t = n.querySelector(".bubble"),
              e = t ? t.innerText : "";
            if (navigator.clipboard)
              navigator.clipboard.writeText(e).catch(function () {});
            else {
              const t = document.createElement("textarea");
              ((t.value = e),
                document.body.appendChild(t),
                t.select(),
                document.execCommand("copy"),
                document.body.removeChild(t));
            }
            a();
          }),
        document
          .getElementById("ctxQuote")
          .addEventListener("click", function () {
            if (!n) return void a();
            const t = n.querySelector(".bubble");
            let e = "";
            if (t) {
              if (t.querySelector("img") && !(t.innerText || "").trim()) {
                e = "【表情包】";
              } else {
                const n = t.querySelector(".quote-bubble");
                let i = t.innerText || "";
                (n && (i = i.replace(n.innerText || "", "").trim()),
                  (e = i.slice(0, 60)));
              }
            }
            const i = n.classList.contains("me"),
              o = localStorage.getItem("akini_my_name") || "我",
              r = localStorage.getItem("akini_ta_name") || "对方",
              c = i
                ? o
                : n.classList.contains("group")
                  ? (function () {
                      var qn = n.querySelector(".msg-sender-name");
                      if (qn) return qn.textContent.trim();
                      var qa = n.querySelector(".msg-avatar[data-sender-name]");
                      if (qa) return qa.getAttribute("data-sender-name") || "";
                    })()
                  : r,
              l = [o + "：", r + "：", o + ":", r + ":", "我：", "对方："];
            let s = e;
            for (let t = 0; t < l.length; t++)
              if (0 === s.indexOf(l[t])) {
                s = s.substring(l[t].length);
                break;
              }
            const d = c + "：" + s,
              u = document.getElementById("msgInput"),
              m = document.getElementById("chatQuoteBar"),
              f = document.getElementById("quoteText");
            (u &&
              (u.setAttribute("data-quote", d),
              (u.placeholder = "回复 " + c),
              u.focus()),
              m && f && ((f.textContent = d), m.classList.add("show")),
              a());
          }),
        document.getElementById("ctxDelete").addEventListener("click", function () {
            if (!n) return void a();
            // 先从内存完整历史中按消息特征精确移除，绝不能用截断后的 DOM HTML 覆盖
            try {
              var activeId = window.akiniContacts ? window.akiniContacts.getActiveChatId() : null;
              if (activeId) {
                var sess = window.akiniContacts.getSession(activeId) || {};
                var fullHTML = sess.messagesHTML || E[activeId] || "";
                if (fullHTML) {
                  var rowOpen = n.outerHTML;
                  var at = fullHTML.indexOf(rowOpen);
                  if (at >= 0) {
                    fullHTML = fullHTML.slice(0, at) + fullHTML.slice(at + rowOpen.length);
                  } else {
                    // 兜底：按消息内容摘要定位
                    var bubble = n.querySelector(".bubble");
                    var key = bubble ? (bubble.innerText || "").trim().slice(0, 30) : "";
                    if (key) {
                      var tmp = document.createElement("div");
                      tmp.innerHTML = fullHTML;
                      var rows = tmp.querySelectorAll(".msg-row");
                      var removed = !1;
                      rows.forEach(function (r) {
                        if (!removed && r.textContent && r.textContent.indexOf(key) >= 0) {
                          r.remove();
                          removed = !0;
                        }
                      });
                      if (removed) fullHTML = tmp.innerHTML;
                    }
                  }
                  window.akiniContacts.updateSession(activeId, { messagesHTML: fullHTML });
                  E[activeId] = fullHTML;
                  if (typeof C === "function") C(activeId, fullHTML);
                  try { _idbStore.set("akini_chat_history", fullHTML); } catch (e) {}
                }
              }
            } catch (e) {}
            n.remove();
            a();
          }));
    })();
    (function () {
      const t = {
          friendsBackBtn: { action: "back", fallback: "home" },
          mailBackBtn: { action: "back", fallback: "home" },
          settingsBackBtn: {
            action: "back",
            fallback: "hideAndHome",
            containerId: "settingsArea",
          },
          beautifyBackBtn: {
            action: "back",
            fallback: "hideAndHome",
            containerId: "beautifyArea",
          },
          icityBackBtn: {
            action: "back",
            fallback: "hideAndHome",
            containerId: "icityArea",
          },
          rpCloseBtn: { action: "hide", containerId: "redpacketModal" },
          transferCancelBtn: { action: "hide", containerId: "transferModal" },
          closeGroupModal: { action: "hide", containerId: "groupModal" },
          manageCloseBtn: {
            action: "hide",
            containerId: "stickerManagerOverlay",
          },
          cancelAdd: { action: "hide", containerId: "addModal" },
          closePublishBtn: { action: "hide", containerId: "publishModal" },
          menuBg: { action: "hide", containerId: "chatMenuOverlay" },
          mailComposeClose: { action: "hide", containerId: "mailComposeModal" },
        },
        e = [
          "transferModal",
          "redpacketModal",
          "groupModal",
          "publishModal",
          "mailComposeModal",
          "chatMenuOverlay",
        ];
      function n() {
        (o(""),
          [
            "settingsArea",
            "beautifyArea",
            "icityArea",
            "wordbankOverlay",
          ].forEach(function (t) {
            var e = document.getElementById(t);
            e && (e.style.display = "none");
          }));
      }
      function i(i) {
        const a = i.target;
        let r = null;
        for (const e of Object.keys(t))
          if (a.id === e || a.closest("#" + e)) {
            r = e;
            break;
          }
        if (r)
          return (
            i.preventDefault(),
            i.stopPropagation(),
            void (function (t) {
              if ("home" === t.action) n();
              else if ("hideAndHome" === t.action) {
                const e = document.getElementById(t.containerId);
                (e && ((e.style.display = "none"), e.classList.remove("show")),
                  n());
              } else if ("hide" === t.action) {
                const e = document.getElementById(t.containerId);
                e && ((e.style.display = "none"), e.classList.remove("show"));
              } else if ("page" === t.action) {
                const e = document.getElementById(t.pageId);
                e && ((e.style.display = "flex"), e.classList.add("show"));
              } else if ("back" === t.action) {
                if (!window.__navBack()) {
                  if ("home" === t.fallback) n();
                  else if ("hideAndHome" === t.fallback) {
                    const e = document.getElementById(t.containerId);
                    (e &&
                      ((e.style.display = "none"), e.classList.remove("show")),
                      n());
                  }
                }
              } else "showPage" === t.action && o(t.pageName || "");
            })(t[r])
          );
        e.includes(a.id) &&
          (i.preventDefault(),
          i.stopPropagation(),
          (a.style.display = "none"),
          a.classList.remove("show"));
      }
      (document.addEventListener("click", i),
        document.addEventListener("touchend", i, !0));
    })();
    (function () {
      function t() {
        !(function () {
          var t =
              localStorage.getItem("akini_my_avatar") ||
              localStorage.getItem("akini_icity_my_avatar") ||
              (window.__akiniAvatarCache &&
                window.__akiniAvatarCache.my) ||
              "🐱",
            e =
              localStorage.getItem("akini_icity_my_nick") ||
              localStorage.getItem("akini_my_name") ||
              "我",
            n = localStorage.getItem("akini_icity_my_handle") || e;
          [
            "icityMyAvatar2",
            "icityMyAvatar3",
            "icityEditMyAvatarPreview",
          ].forEach(function (e) {
            var n = document.getElementById(e);
            n && setHtmlKeepInput(n, nt(t, Math.min(n.clientWidth || 36, 76)));
          });
          var i = document.getElementById("icityMyNameDisplay");
          i && (i.textContent = e);
          var a = document.getElementById("icityMyHandleDisplay");
          a && (a.textContent = "@" + n);
        })();
        var t =
            localStorage.getItem("akini_my_avatar") ||
            (window.__akiniAvatarCache && window.__akiniAvatarCache.my) ||
            "🐱",
          i = localStorage.getItem("akini_ta_avatar") || "🐰",
          a = localStorage.getItem("akini_icity_my_nick") || "我",
          o = localStorage.getItem("akini_icity_my_handle") || a,
          r = localStorage.getItem("akini_icity_ta_nick") || "对方",
          c = localStorage.getItem("akini_icity_ta_handle") || r,
          l = document.getElementById("icityMyNameDisplay"),
          s = document.getElementById("icityMyHandleDisplay"),
          d = document.getElementById("icityMyBioDisplay"),
          u = localStorage.getItem("akini_icity_my_bio") || "";
        (l && (l.textContent = a),
          s && (s.textContent = "@" + o),
          d && (d.textContent = u),
          D("akini_icity_my_bg", function (t) {
            var e = document.getElementById("icityMyBgArea");
            e &&
              (t
                ? ((e.style.backgroundImage = "url(" + t + ")"),
                  (e.style.backgroundSize = "cover"),
                  (e.style.backgroundPosition = "center"))
                : ((e.style.backgroundImage = ""),
                  (e.style.background =
                    "linear-gradient(135deg,#fdfbf7 0%,#f5efe6 40%,#e8dfd3 75%,#dcd0bf 100%)")));
          }),
          D("akini_icity_ta_bg", function (t) {
            var e = document.querySelector(".icity-ta-bg-div");
            if (!e) return;
            if (!t) {
              try {
                t = localStorage.getItem("akini_icity_my_bg");
              } catch (e) {}
            }
            t
              ? ((e.style.backgroundImage = "url(" + t + ")"),
                (e.style.backgroundSize = "cover"),
                (e.style.backgroundPosition = "center"))
              : ((e.style.backgroundImage = ""),
                (e.style.background =
                  "linear-gradient(135deg,#fdfbf7 0%,#f5efe6 40%,#e8dfd3 75%,#dcd0bf 100%)"));
          }));
        var m = q(),
          f = document.getElementById("icityDiaryList"),
          g = document.getElementById("icityEmptyTip");
        if (f) {
          Array.from(f.children).forEach(function (t) {
            "icityEmptyTip" !== t.id && t.remove();
          });
          var y = m.filter(function (t) {
            return !0;
          });
          (0 === y.length
            ? g && (g.style.display = "")
            : g && (g.style.display = "none"),
            y
              .slice()
              .sort(function (t, e) {
                return (e.ts || 0) - (t.ts || 0);
              })
              .forEach(function (e) {
                var n,
                  l,
                  s,
                  d = "me" === e.author || "me" === e.who;
                if (d) ((n = t), (l = a), (s = o));
                else if (e.authorId && window.akiniContacts) {
                  var u = w(e.authorId);
                  ((n = u.avatar || "🐰"), (l = u.name), (s = u.handle));
                } else ((n = i), (l = r), (s = c));
                var m = nt(n, 40),
                  g = document.createElement("div");
                g.className = "icity-diary-card";
                var y = new Date(e.ts || Date.now()),
                  p =
                    y.toLocaleDateString("zh-CN", {
                      month: "numeric",
                      day: "numeric",
                    }) +
                    " · " +
                    y.toLocaleDateString("zh-CN", { weekday: "short" }),
                  v = String(y.getFullYear()),
                  h =
                    String(y.getHours()).padStart(2, "0") +
                    ":" +
                    String(y.getMinutes()).padStart(2, "0"),
                  k = "",
                  _ = d
                    ? ""
                    : " onclick=\"var cid=this.getAttribute('data-contact-id'); if(cid==='ta'){var first=window.akiniContacts?window.akiniContacts.getContacts()[0]:null; cid=first?first.id:null;} if(window.showIcityTaProfile&amp;&amp;cid){window.showIcityTaProfile(cid);}\"";
                g.innerHTML =
                  '<div class="icity-diary-header">  <div class="icity-diary-avatar" data-contact-id="' +
                  (e.authorId || (d ? "me" : "ta")) +
                  '"' +
                  _ +
                  ">" +
                  m +
                  '</div>  <div class="icity-diary-meta">    <div class="icity-diary-name">' +
                  l +
                  k +
                  '</div>    <div class="icity-diary-handle">@' +
                  s +
                  '</div>  </div>  <div class="icity-diary-date">    <div>' +
                  p +
                  "</div>    <div>" +
                  v +
                  '</div>  </div></div><div class="icity-diary-text">' +
                  e.text +
                  '</div><div class="icity-diary-footer">  <span class="icity-diary-time">' +
                  h +
                  '</span>  <button type="button" class="icity-more-btn" data-id="' +
                  e.id +
                  '" style="background:none;border:none;font-size:18px;color:#bbb;cursor:pointer;padding:4px;">⋮</button></div>';
                var b = g.querySelector(".icity-more-btn");
                (b &&
                  b.addEventListener("click", function (t) {
                    t.stopPropagation();
                    var e = this.getAttribute("data-id"),
                      n = document.getElementById("icityActionSheet");
                    if (n) {
                      ((n.style.display = "flex"),
                        (n._currentId = e),
                        (n._isMe = d));
                      var i = document.getElementById("icityActionButtonsWrap");
                      i && (i.style.display = "block");
                      var a = document.getElementById("icityActionDelete");
                      a && (a.style.display = d ? "flex" : "none");
                      var o = document.getElementById("icityActionPin");
                      if (o) {
                        var r = q().find(function (t) {
                          return t.id == e;
                        });
                        o.textContent = r && r.pinned ? "取消置顶" : "置顶日记";
                      }
                    }
                  }),
                  g.addEventListener("click", function (t) {
                    t.target.closest(".icity-more-btn") || openIcityDetail(e);
                  }),
                  f.appendChild(g));
              }));
          var p = document.getElementById("icityMyDiaryCount");
          p &&
            (p.textContent = m.filter(function (t) {
              return "me" === t.author || "me" === t.who;
            }).length);
          var v = document.getElementById("icityTaDiaryCount");
          if (v) {
            var h = 0;
            (window.akiniContacts
              ? window.akiniContacts.getContacts().forEach(function (t) {
                  h += m.filter(function (e) {
                    return (
                      e.authorId === t.id ||
                      (e.author === t.name && !e.authorId)
                    );
                  }).length;
                })
              : (h = m.filter(function (t) {
                  return "ta" === t.author || "ta" === t.who;
                }).length),
              (v.textContent = h));
          }
          n("icityMyProfileDiaries", "me");
          var k = window.akiniContacts
            ? window.akiniContacts.getContacts()[0]
            : null;
          (n("icityTaProfileDiaries", k ? k.id : "ta"), e());
        }
      }
      function e() {
        try {
          var t = document.getElementById("icityContactProfiles");
          if (!t) return void console.warn("[icity] 联系人入口容器不存在");
          if (!window.akiniContacts)
            return void console.warn("[icity] akiniContacts 未就绪");
          var e = window.akiniContacts.getContacts();
          (console.log("[icity] 渲染联系人入口，共", e.length, "个联系人"),
            e.sort(function (t, e) {
              return t.isDefault && !e.isDefault
                ? -1
                : !t.isDefault && e.isDefault
                  ? 1
                  : (t.createdAt || 0) - (e.createdAt || 0);
            }));
          var n = "";
          (e.forEach(function (t) {
            var e = nt(t.avatar, 48),
              i = rt(w(t.id).name || t.name || "对方").replace(/"/g, "&quot;");
            n +=
              '<div class="icity-contact-card" data-contact-id="' +
              t.id +
              '" onclick="var cid=this.getAttribute(&#39;data-contact-id&#39;); console.log(&#39;[icity] 点击联系人入口&#39;, cid); if(cid&&window.showIcityTaProfile){window.showIcityTaProfile(cid);}else{alert(&#39;暂无联系人&#39;);}" style="background:#fff;border-radius:14px;padding:14px;box-shadow:0 1px 6px rgba(0,0,0,0.06);display:flex;align-items:center;gap:12px;cursor:pointer;-webkit-tap-highlight-color:transparent;pointer-events:auto;"><div style="width:48px;height:48px;border-radius:50%;background:#e8e8e8;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0;pointer-events:none;">' +
              e +
              '</div><div style="flex:1;min-width:0;pointer-events:none;"><div style="font-size:15px;font-weight:600;color:#222;margin-bottom:2px;">' +
              i +
              '</div><div style="font-size:13px;color:#999;">查看 TA 的主页 →</div></div></div>';
          }),
            n
              ? ((t.innerHTML = n), (t.style.display = "flex"))
              : ((t.innerHTML =
                  '<div class="icity-contact-card" data-contact-id="" onclick="console.log(&#39;[icity] 点击兜底联系人入口&#39;); if(window.showIcityTaProfile){window.showIcityTaProfile();}else{alert(&#39;暂无联系人&#39;);}" style="background:#fff;border-radius:14px;padding:14px;box-shadow:0 1px 6px rgba(0,0,0,0.06);display:flex;align-items:center;gap:12px;cursor:pointer;-webkit-tap-highlight-color:transparent;pointer-events:auto;"><div style="width:48px;height:48px;border-radius:50%;background:#e8e8e8;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0;pointer-events:none;">🐰</div><div style="flex:1;min-width:0;pointer-events:none;"><div style="font-size:15px;font-weight:600;color:#222;margin-bottom:2px;">对方</div><div style="font-size:13px;color:#999;">查看 TA 的主页 →</div></div></div>'),
                (t.style.display = "flex")),
            t.querySelectorAll(".icity-contact-card").forEach(function (t) {
              t.addEventListener("click", function (e) {
                (e.stopPropagation(),
                  console.log(
                    "[icity] click 事件触发",
                    t.getAttribute("data-contact-id"),
                  ));
                var n = t.getAttribute("data-contact-id");
                n && window.showIcityTaProfile && window.showIcityTaProfile(n);
              });
            }),
            t.addEventListener("click", function (t) {
              var e = t.target.closest(".icity-contact-card");
              if (e) {
                var n = e.getAttribute("data-contact-id");
                (console.log("[icity] 事件委托捕获", n),
                  n &&
                    window.showIcityTaProfile &&
                    window.showIcityTaProfile(n));
              }
            }));
        } catch (t) {
          console.warn("renderIcity 联系人入口渲染失败", t);
        }
      }
      function n(t, e) {
        var n = document.getElementById(t);
        if (n) {
          n.innerHTML = "";
          var i = "me" === e,
            a = q().filter(function (t) {
              return i
                ? "me" === t.author || "me" === t.who
                : t.authorId === e || t.who === e || t.author === e;
            });
          if (0 !== a.length) {
            var o = localStorage.getItem("akini_icity_my_nick") || "我",
              r = localStorage.getItem("akini_icity_my_handle") || o,
              c =
                localStorage.getItem("akini_my_avatar") ||
                (window.__akiniAvatarCache && window.__akiniAvatarCache.my) ||
                "";
            a.slice()
              .sort(function (t, e) {
                return t.pinned && !e.pinned
                  ? -1
                  : !t.pinned && e.pinned
                    ? 1
                    : (e.ts || 0) - (t.ts || 0);
              })
              .forEach(function (t) {
                var i =
                    "me" === t.author || "me" === t.who
                      ? null
                      : w(t.authorId || e),
                  a = i
                    ? i.name
                    : localStorage.getItem("akini_icity_ta_nick") || "对方",
                  l = i
                    ? i.handle
                    : localStorage.getItem("akini_icity_ta_handle") || a,
                  s = i
                    ? i.avatar
                    : localStorage.getItem("akini_ta_avatar") || "";
                n.appendChild(
                  (function (t, e, n, i, a, o, r) {
                    var c = "me" === t.author || "me" === t.who,
                      l = c ? o : r,
                      s = c ? e : i,
                      d = c ? n : a,
                      u =
                        l && (l.startsWith("data:") || l.startsWith("http"))
                          ? '<img src="' +
                            l +
                            '" style="width:100%;height:100%;object-fit:cover;">'
                          : l || (c ? "🐱" : "🐰"),
                      m = new Date(t.ts || Date.now()),
                      f =
                        String(m.getHours()).padStart(2, "0") +
                        ":" +
                        String(m.getMinutes()).padStart(2, "0"),
                      g = t.pinned
                        ? '<span style="display:inline-block;margin-left:4px;padding:1px 6px;background:rgba(0,0,0,0.06);color:#888;font-size:11px;border-radius:8px;vertical-align:middle;">置顶</span>'
                        : "",
                      y = document.createElement("div");
                    return (
                      (y.className = "icity-profile-diary-card"),
                      (y.style.cssText =
                        "background:#fff;border-radius:14px;padding:14px 16px;margin-bottom:10px;box-shadow:0 1px 4px rgba(0,0,0,0.04);cursor:pointer;"),
                      (y.innerHTML =
                        '<div style="display:flex;align-items:center;margin-bottom:10px;">  <div style="width:36px;height:36px;border-radius:50%;overflow:hidden;background:#f2f2f2;flex-shrink:0;margin-right:10px;display:flex;align-items:center;justify-content:center;">' +
                        u +
                        '</div>  <div style="flex:1;min-width:0;">    <div style="font-size:15px;font-weight:600;color:#222;line-height:1.3;">' +
                        s +
                        g +
                        '</div>    <div style="font-size:12px;color:#999;line-height:1.3;">@' +
                        d +
                        '</div>  </div></div><div style="font-size:16px;color:#333;line-height:1.75;word-break:break-all;white-space:normal;margin-bottom:10px;">' +
                        t.text +
                        '</div><div style="display:flex;justify-content:flex-end;font-size:12px;color:#bbb;">' +
                        f +
                        "</div>"),
                      y.addEventListener("click", function () {
                        openIcityDetail(t);
                      }),
                      y
                    );
                  })(t, o, r, a, l, c, s),
                );
              });
          } else
            n.innerHTML =
              '<div style="text-align:center;color:#bbb;padding:40px 0;font-size:14px;">' +
              (i ? "还没有日记，快去写一篇吧" : "TA还没有日记") +
              "</div>";
        }
      }
      function o(t) {
        var e = localStorage.getItem("akini_icity_my_nick") || "我",
          n = t.likers || [],
          i = t.liked || n.indexOf(e) >= 0,
          a = document.getElementById("icityDetailLikeBtn");
        a &&
          ((a.innerHTML = '<span style="font-size:16px;color:#000;">♡</span>'),
          (a.style.color = i ? "#e04040" : "#888"));
        var o = document.getElementById("icityDetailLikers");
        o &&
          (n.length
            ? ((o.style.display = "block"),
              (o.innerHTML =
                '<div style="font-size:13px;color:#333;line-height:1.6;"><span style="font-size:13px;margin-right:4px;color:#000;">♡</span>' +
                n.join("、") +
                "</div>"))
            : ((o.style.display = "none"), (o.innerHTML = "")));
        var r = document.getElementById("icityDetailLikersCommentsDivider");
        r &&
          (r.style.display =
            n.length && t.comments && t.comments.length ? "block" : "none");
        var c = document.getElementById("icityDetailComments");
        if (c) {
          // 评论按时间顺序渲染，q/$ 已完成去重，这里只过滤非对象
          var l = (t.comments || []).filter(function (c) {
            return c && typeof c === "object";
          }).sort(function (a, b) {
            return (a.ts || 0) - (b.ts || 0);
          });
          var s =
              localStorage.getItem("akini_icity_my_nick") ||
              localStorage.getItem("akini_my_name") ||
              "我",
            d = localStorage.getItem("akini_icity_ta_nick") || "对方",
            u =
              localStorage.getItem("akini_my_avatar") ||
              (window.__akiniAvatarCache && window.__akiniAvatarCache.my) ||
              "🐱",
            m = localStorage.getItem("akini_ta_avatar") || "🐰",
            f = function (t) {
              if (!t) return "🐰";
              if (t.avatar) return t.avatar;
              if (t.authorId && t.authorId !== "me") {
                var e = window.getIcityContactProfile
                  ? window.getIcityContactProfile(t.authorId)
                  : null;
                if (e && e.avatar) return e.avatar;
                if (window.akiniContacts) {
                  var n = window.akiniContacts.getChatTarget(t.authorId);
                  if (n && n.avatar) return n.avatar;
                }
              }
              var a = t.author || t;
              if (a === s || a === "我") return u;
              if (a === d || a === "对方") return m;
              if (window.akiniContacts) {
                var i = window.akiniContacts.getContacts();
                for (var o = 0; o < i.length; o++)
                  if (i[o].name === a) return i[o].avatar || "🐰";
              }
              return "🐰";
            },
            h = function (t) {
              if (!t) return "";
              if (t.authorId && t.authorId !== "me") {
                var e = window.getIcityContactProfile
                  ? window.getIcityContactProfile(t.authorId)
                  : null;
                if (e && e.name) return e.name;
              }
              var n = t.author || t;
              if (n === s || n === "我") return s;
              if (n === d || n === "对方") return d;
              if (window.akiniContacts) {
                var i = window.akiniContacts.getContacts();
                for (var a = 0; a < i.length; a++)
                  if (i[a].name === n) {
                    var o = window.getIcityContactProfile
                      ? window.getIcityContactProfile(i[a].id)
                      : null;
                    if (o && o.name) return o.name;
                  }
              }
              return n;
            },
            g = function (t) {
              if (!t) return "";
              var e = Date.now() - t;
              return e < 6e4
                ? "刚刚"
                : e < 36e5
                  ? Math.floor(e / 6e4) + "分钟前"
                  : e < 864e5
                    ? Math.floor(e / 36e5) + "小时前"
                    : e < 2592e6
                      ? Math.floor(e / 864e5) + "天前"
                      : "很久以前";
            };
          0 === l.length
            ? (c.innerHTML =
                '<div style="font-size:13px;color:#aaa;text-align:center;padding:18px 0;">暂无评论</div>')
            : ((c.innerHTML = l
                .map(function (t, e) {
                  var n = nt(f(t), 36),
                    i = t.replyTo
                      ? '<span style="font-weight:600;color:#333;">' +
                        h(t) +
                        '</span><span style="color:#999;"> 回复 </span><span style="font-weight:600;color:#333;">' +
                        h({ author: t.replyTo }) +
                        "</span>"
                      : '<span style="font-weight:600;color:#333;">' +
                        h(t) +
                        "</span>",
                    a = g(t.ts);
                  return (
                    '<div class="icity-detail-comment" data-idx="' +
                    e +
                    '" style="display:flex;gap:10px;padding:10px 0;cursor:pointer;align-items:flex-start;"><div style="width:36px;height:36px;border-radius:50%;background:#e8e8e8;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">' +
                    n +
                    '</div><div style="flex:1;min-width:0;"><div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;line-height:1.4;"><div>' +
                    i +
                    '</div><div style="font-size:11px;color:#bbb;flex-shrink:0;margin-left:8px;">' +
                    a +
                    '</div></div><div style="font-size:13px;color:#333;line-height:1.5;margin-top:2px;word-break:break-word;">' +
                    t.text +
                    "</div></div></div>"
                  );
                })
                .join("")),
              c.querySelectorAll(".icity-detail-comment").forEach(function (e) {
                e.addEventListener("click", function () {
                  var e = document.getElementById("icityDetailModal"),
                    n = parseInt(this.getAttribute("data-idx"), 10),
                    i = (t.comments || [])[n];
                  if (i && e) {
                    e._replyTo = i.author;
                    var a = document.getElementById("icityDetailCommentInput");
                    a &&
                      ((a.placeholder = "回复 " + e._replyTo + "："),
                      a.focus());
                  }
                });
              }));
        }
      }
      ((window._renderIcityContactProfiles = e),
        (window._renderIcity = t),
        (window.__akiniGetIcity = q),
        (window.__akiniSaveIcity = j),
        (window.renderIcityProfileDiaries = n),
        (window.togglePinDiary = function (t) {
          var e = q(),
            n = !1;
          (e.forEach(function (e) {
            e.id === t && ((e.pinned = !e.pinned), (n = !0));
          }),
            n && (j(e), window._renderIcity && window._renderIcity()));
        }),
        (window.deleteDiary = function (t) {
          var e = q(),
            n = e.length;
          (e = e.filter(function (e) {
            return e.id !== t;
          })).length !== n &&
            (j(e), window._renderIcity && window._renderIcity());
        }),
        (window.openIcityDetail = function (t) {
          var e = document.getElementById("icityDetailModal");
          if (e && t) {
            ((e._currentDiaryId = t.id),
              (e._currentWho = t.who || t.author || "me"),
              (e._replyTo = ""));
            var n,
              i,
              a,
              r = "me" === t.author || "me" === t.who,
              c = localStorage.getItem("akini_icity_my_nick") || "我",
              l = localStorage.getItem("akini_icity_my_handle") || c;
            if (r)
              ((n = c),
                (i = l),
                (a =
                  localStorage.getItem("akini_my_avatar") ||
                  (window.__akiniAvatarCache &&
                    window.__akiniAvatarCache.my) ||
                  "🐱"));
            else if (t.authorId && window.akiniContacts) {
              var s = w(t.authorId);
              ((n = s.name), (i = s.handle), (a = s.avatar || "🐰"));
            } else
              ((n = localStorage.getItem("akini_icity_ta_nick") || "对方"),
                (i = localStorage.getItem("akini_icity_ta_handle") || n),
                (a = localStorage.getItem("akini_ta_avatar") || "🐰"));
            var d = nt(a, 48),
              u = document.getElementById("icityDetailAuthor");
            u && (u.textContent = n + " · 日记");
            var m = document.getElementById("icityDetailAvatar");
            m && (m.innerHTML = d);
            var f = document.getElementById("icityDetailName");
            f && (f.textContent = n);
            var g = document.getElementById("icityDetailHandle");
            g && (g.textContent = "@" + i);
            var y = document.getElementById("icityDetailContent");
            y && (y.textContent = t.text);
            var p = new Date(t.ts || Date.now()),
              v = document.getElementById("icityDetailMeta");
            (v && (v.textContent = __akiniFormatDateTime(p)), o(t));
            var h = document.getElementById("icityDetailCommentInput");
            (h && ((h.value = ""), (h.placeholder = "我要评论")),
              (e.style.display = "flex"));
            var k = document.getElementById("icityDetailScroll");
            k && (k.scrollTop = 0);
          }
        }),
        (function () {
          var e = document.getElementById("icityDetailModal"),
            i = document.getElementById("icityDetailBack"),
            r = document.getElementById("icityDetailLikeBtn"),
            c = document.getElementById("icityDetailCommentBtn"),
            l = document.getElementById("icityDetailSaveBtn"),
            s = document.getElementById("icityDetailMoreBtn"),
            d = document.getElementById("icityDetailCommentSend"),
            u = document.getElementById("icityDetailCommentInput"),
            m = document.getElementById("icityActionSheet"),
            f = document.getElementById("icityActionPin");
          if (i) {
            function g(t) {
              (t && (t.preventDefault(), t.stopPropagation()),
                e && (e.style.display = "none"));
            }
            (i.addEventListener(
              "touchend",
              function (t) {
                g(t);
              },
              { passive: !1 },
            ),
              i.addEventListener("click", function (t) {
                g(t);
              }));
          }
          function y() {
            if (e && e._currentDiaryId && u) {
              var now = Date.now();
              if (y.__lock && now - y.__lock < 600) return;
              y.__lock = now;
              var i = u.value.trim();
              if (i) {
                var a = q(),
                  r = a.findIndex(function (t) {
                    return t.id == e._currentDiaryId;
                  });
                if (!(r < 0)) {
                  var c =
                    localStorage.getItem("akini_icity_my_nick") ||
                    localStorage.getItem("akini_my_name") ||
                    "我";
                  var av =
                    localStorage.getItem("akini_my_avatar") ||
                    (window.__akiniAvatarCache && window.__akiniAvatarCache.my) ||
                    "🐱";
                  a[r].comments = a[r].comments || [];
                  var l = {
                    id: "c_" + Math.random().toString(36).slice(2) + "_" + Date.now(),
                    author: c,
                    authorId: "me",
                    text: i,
                    avatar: av,
                    ts: Date.now(),
                  };
                  (e._replyTo && (l.replyTo = e._replyTo),
                    a[r].comments.push(l),
                    j(a),
                    (u.value = ""),
                    (e._replyTo = ""),
                    (u.placeholder = "我要评论"),
                    t(),
                    n("icityMyProfileDiaries", "me"),
                    n("icityTaProfileDiaries", "ta"),
                    o(a[r]));
                  // 用户评论/回复 iCity 都触发联系人再回复：优先回复被回复者，否则该日记作者
                  var _icityReplyTarget = l.replyTo;
                  if (!_icityReplyTarget) {
                    _icityReplyTarget = a[r].author || localStorage.getItem("akini_icity_ta_nick") || "对方";
                  }
                  var s = localStorage.getItem("akini_icity_ta_nick") || "对方";
                  if (l.replyTo === s) {
                    delete _taPending["cmt_" + e._currentDiaryId];
                    delete _taPending["reply_" + e._currentDiaryId];
                  }
                  window.akiniOnMomentUserReply &&
                    window.akiniOnMomentUserReply(e._currentDiaryId, _icityReplyTarget, "icity");
                }
              }
            }
          }
          (r &&
            a(r, function () {
              if (e && e._currentDiaryId) {
                var i = q(),
                  a = i.findIndex(function (t) {
                    return t.id == e._currentDiaryId;
                  });
                if (!(a < 0)) {
                  var r = localStorage.getItem("akini_icity_my_nick") || "我";
                  i[a].likers = i[a].likers || [];
                  var c = i[a].likers.indexOf(r);
                  (c >= 0
                    ? (i[a].likers.splice(c, 1),
                      (i[a].likes = Math.max(0, (i[a].likes || 1) - 1)),
                      (i[a].liked = !1))
                    : (i[a].likers.push(r),
                      (i[a].likes = (i[a].likes || 0) + 1),
                      (i[a].liked = !0)),
                    j(i),
                    t(),
                    n("icityMyProfileDiaries", "me"),
                    n("icityTaProfileDiaries", "ta"),
                    o(i[a]));
                }
              }
            }),
            c &&
              u &&
              a(c, function () {
                u.focus();
              }),
            l &&
              a(l, function () {
                if (e && e._currentDiaryId) {
                  var t = q(),
                    n = t.findIndex(function (t) {
                      return t.id == e._currentDiaryId;
                    });
                  n < 0 || openIcitySaveModal(t[n]);
                }
              }),
            s &&
              m &&
              a(s, function () {
                if (e && e._currentDiaryId) {
                  var t = document.getElementById("icityActionButtonsWrap"),
                    n = "me" === e._currentWho || "my" === e._currentWho;
                  t && (t.style.display = "block");
                  var i = document.getElementById("icityActionDelete");
                  if (
                    (i && (i.style.display = "flex"),
                    (m.style.display = "flex"),
                    (m._currentId = e._currentDiaryId),
                    (m._isMe = n),
                    f)
                  ) {
                    var a = q().find(function (t) {
                      return t.id == e._currentDiaryId;
                    });
                    ((f.style.display = "flex"),
                      (f.textContent =
                        a && a.pinned ? "取消置顶" : "置顶日记"));
                  }
                }
              }),
            d && a(d, y),
            u &&
              u.addEventListener("keypress", function (t) {
                "Enter" === t.key && y();
              }));
        })());
      ((function () {
        var t = document.getElementById("icitySaveStyleModal"),
          e = document.getElementById("icitySaveStyleBack"),
          n = document.getElementById("icitySaveStyleList"),
          i = document.getElementById("icitySaveImageBtn"),
          a = document.getElementById("icitySaveCard"),
          o = document.getElementById("icitySaveResultModal"),
          r = document.getElementById("icitySaveResultClose"),
          c = document.getElementById("icitySaveResultImageWrap");
        if (t) {
          var l = null,
            s = 0,
            d = null,
            u = null,
            m = [
              {
                key: "classic",
                label: "icity",
                outer: "#f5f5f5",
                outerFrom: "#f5f5f5",
                outerTo: "#f5f5f5",
                outerSolid: "#f5f5f5",
                card: "#ffffff",
                accent: "#111111",
                text: "#222222",
                pattern: "none",
                layout: "classic",
              },
              {
                key: "pink",
                label: "爱心",
                outer: "linear-gradient(145deg,#f9ccd4,#e8a0b0)",
                outerFrom: "#f9ccd4",
                outerTo: "#e8a0b0",
                outerSolid: "#e8a0b0",
                card: "#ffffff",
                accent: "#c45a7c",
                text: "#3a2a30",
                pattern: "dots",
                layout: "dateTop",
              },
              {
                key: "blue",
                label: "天空",
                outer: "linear-gradient(145deg,#b8e0f8,#8cc8ec)",
                outerFrom: "#b8e0f8",
                outerTo: "#8cc8ec",
                outerSolid: "#8cc8ec",
                card: "#ffffff",
                accent: "#7a9ab0",
                text: "#2a3a48",
                pattern: "dots",
                layout: "dateTop",
              },
            ],
            f = {};
          ((window.openIcitySaveModal = function (e) {
            ((l = e),
              (s = 0),
              (function (t) {
                if (
                  ((d = null),
                  (u = null),
                  t.avatar &&
                    (t.avatar.startsWith("data:") ||
                      t.avatar.startsWith("http")))
                ) {
                  var e = new Image();
                  (t.avatar.startsWith("http") && (e.crossOrigin = "anonymous"),
                    (e.onload = function () {
                      d = e;
                      try {
                        var t = document.createElement("canvas");
                        ((t.width = e.naturalWidth || 100),
                          (t.height = e.naturalHeight || 100),
                          t.getContext("2d").drawImage(e, 0, 0),
                          (u = t.toDataURL("image/png")));
                      } catch (t) {
                        u = null;
                      }
                    }),
                    (e.onerror = function () {
                      ((d = null), (u = null));
                    }),
                    (e.src = t.avatar));
                }
              })(y(e)),
              h(),
              v(e, 0),
              (t.style.display = "flex"));
          }),
            e &&
              e.addEventListener("click", function () {
                t.style.display = "none";
              }),
            r &&
              o &&
              (r.addEventListener("click", function () {
                o.style.display = "none";
              }),
              o.addEventListener("click", function (t) {
                t.target === o && (o.style.display = "none");
              })),
            i &&
              i.addEventListener("click", function () {
                var t, e;
                l &&
                  (function (t, e, n) {
                    if (a && window.html2canvas) {
                      m[e];
                      var i = a.style.width || "",
                        o = (a.parentNode && a.parentNode.style.maxWidth) || "";
                      ((a.style.width = "360px"),
                        a.parentNode && (a.parentNode.style.maxWidth = "none"),
                        v(t, e),
                        setTimeout(function () {
                          a.getBoundingClientRect();
                          var r = a.querySelectorAll("img"),
                            c = [];
                          (r.forEach(function (t, e) {
                            ((c[e] = t.src),
                              u
                                ? (t.src = u)
                                : t.src.startsWith("data:") ||
                                  (t.crossOrigin = "anonymous"));
                          }),
                            window
                              .html2canvas(a, {
                                scale: 3,
                                useCORS: !0,
                                allowTaint: !1,
                                backgroundColor: null,
                                logging: !1,
                              })
                              .then(function (t) {
                                try {
                                  n(null, t.toDataURL("image/png"));
                                } catch (t) {
                                  n(t);
                                }
                              })
                              .catch(function (t) {
                                n(t);
                              })
                              .then(
                                function () {
                                  k(a, i, o, t, e, r, c);
                                },
                                function () {
                                  k(a, i, o, t, e, r, c);
                                },
                              ));
                        }, 120));
                    } else n(new Error("html2canvas unavailable"));
                  })((t = l), (e = s), function (n, i) {
                    n || !i
                      ? (function (t, e, n) {
                          if (a) {
                            var i = a.style.width || "",
                              o = "";
                            (a.parentNode &&
                              (o = a.parentNode.style.maxWidth || ""),
                              (a.style.width = "360px"),
                              a.parentNode &&
                                (a.parentNode.style.maxWidth = "none"),
                              v(t, e),
                              setTimeout(function () {
                                var r = a.getBoundingClientRect(),
                                  c = Math.round(r.width),
                                  l = Math.round(r.height);
                                try {
                                  var s = a.cloneNode(!0);
                                  ((s.style.width = c + "px"),
                                    (s.style.height = l + "px"),
                                    (s.style.boxSizing = "border-box"),
                                    (s.style.overflow = "visible"),
                                    (s.style.boxShadow = "none"),
                                    u &&
                                      s
                                        .querySelectorAll("img")
                                        .forEach(function (t) {
                                          (t.closest(".icity-diary-avatar") ||
                                            t.width < 120) &&
                                            ((t.src = u),
                                            (t.crossOrigin = "anonymous"));
                                        }));
                                  var d = "http://www.w3.org/1999/xhtml",
                                    m = new XMLSerializer(),
                                    f = document.createElement("div");
                                  (f.setAttribute("xmlns", d),
                                    (f.style.cssText =
                                      "width:" +
                                      c +
                                      "px;height:" +
                                      l +
                                      "px;margin:0;padding:0;position:relative;"),
                                    f.appendChild(s));
                                  var g =
                                      '<svg xmlns="http://www.w3.org/2000/svg" width="' +
                                      c +
                                      '" height="' +
                                      l +
                                      '"><foreignObject width="100%" height="100%" x="0" y="0">' +
                                      m.serializeToString(f) +
                                      "</foreignObject></svg>",
                                    y =
                                      "data:image/svg+xml;charset=utf-8," +
                                      encodeURIComponent(g),
                                    p = new Image(),
                                    h = document.createElement("canvas");
                                  ((h.width = 3 * c), (h.height = 3 * l));
                                  var w = h.getContext("2d");
                                  ((p.onload = function () {
                                    w.drawImage(p, 0, 0, h.width, h.height);
                                    try {
                                      n(null, h.toDataURL("image/png"));
                                    } catch (t) {
                                      n(t);
                                    }
                                  }),
                                    (p.onerror = function () {
                                      n(new Error("svg render failed"));
                                    }),
                                    (p.src = y));
                                } catch (t) {
                                  n(t);
                                } finally {
                                  ((a.style.width = i),
                                    a.parentNode &&
                                      (a.parentNode.style.maxWidth = o),
                                    v(t, e));
                                }
                              }, 100));
                          } else n(new Error("no preview"));
                        })(t, e, function (n, i) {
                          if (n || !i)
                            try {
                              w(
                                (function (t, e) {
                                  var n = m[e],
                                    i = y(t),
                                    a = g(t),
                                    o = 360,
                                    r = 3,
                                    c = 28,
                                    l = 18,
                                    s = o - 2 * c,
                                    u = s - 2 * l,
                                    f = "classic" === n.layout ? 70 : c,
                                    p = document
                                      .createElement("canvas")
                                      .getContext("2d");
                                  p.font = "17px sans-serif";
                                  var v = (function (t, e, n) {
                                      var i = [];
                                      return (
                                        (e || "")
                                          .split("\n")
                                          .forEach(function (e) {
                                            if (e) {
                                              for (
                                                var a = "", o = 0;
                                                o < e.length;
                                                o++
                                              ) {
                                                var r = a + e[o];
                                                t.measureText(r).width > n && a
                                                  ? (i.push(a), (a = e[o]))
                                                  : (a = r);
                                              }
                                              a && i.push(a);
                                            } else i.push("");
                                          }),
                                        i
                                      );
                                    })(p, t.text, u),
                                    h = "dateTop" === n.layout ? 44 : 0,
                                    w = 58,
                                    k = 30 * v.length + 12,
                                    _ = h + w + k + 28 + 2 * l,
                                    b = _ + f + c,
                                    I = document.createElement("canvas");
                                  ((I.width = o * r), (I.height = b * r));
                                  var x = I.getContext("2d");
                                  x.scale(r, r);
                                  var E = x.createLinearGradient(0, 0, o, b);
                                  (E.addColorStop(0, n.outerFrom),
                                    E.addColorStop(1, n.outerTo),
                                    (x.fillStyle = E),
                                    x.fillRect(0, 0, o, b),
                                    (function (t, e, n, i) {
                                      if ("dots" === e.pattern) {
                                        var a = 60;
                                        t.fillStyle = "rgba(255,255,255,0.55)";
                                        for (var o = -60; o < i + a;) {
                                          for (
                                            var r =
                                              (Math.round(o / a) % 2 == 0
                                                ? 0
                                                : 30) - 60;
                                            r < n + a;
                                          )
                                            (t.beginPath(),
                                              t.arc(r, o, 8, 0, 2 * Math.PI),
                                              t.fill(),
                                              (r += a));
                                          o += a;
                                        }
                                      }
                                    })(x, n, o, b),
                                    "classic" === n.layout &&
                                      ((x.font = "bold 21px sans-serif"),
                                      (x.fillStyle = n.accent),
                                      (x.textAlign = "left"),
                                      (x.textBaseline = "alphabetic"),
                                      x.fillText(
                                        "icity · 我的日记",
                                        c + l,
                                        c + 34,
                                      )));
                                  var S = f;
                                  ((x.fillStyle = n.card),
                                    x.fillRect(c, S, s, _));
                                  var A = S + l;
                                  if (
                                    ((function (t, e, n, i, a) {
                                      if (
                                        (t.save(),
                                        t.beginPath(),
                                        t.arc(
                                          e + i / 2,
                                          n + i / 2,
                                          i / 2,
                                          0,
                                          2 * Math.PI,
                                        ),
                                        t.clip(),
                                        (t.fillStyle = "#f2f2f2"),
                                        t.fill(),
                                        d && d.complete && d.naturalWidth > 0)
                                      )
                                        try {
                                          t.drawImage(d, e, n, i, i);
                                        } catch (o) {
                                          ((t.font =
                                            0.55 * i + "px sans-serif"),
                                            (t.textAlign = "center"),
                                            (t.textBaseline = "middle"),
                                            t.fillText(
                                              a.avatar ||
                                                (a.isMe ? "🐱" : "🐰"),
                                              e + i / 2,
                                              n + i / 2,
                                            ));
                                        }
                                      else
                                        ((t.font = 0.55 * i + "px sans-serif"),
                                          (t.textAlign = "center"),
                                          (t.textBaseline = "middle"),
                                          t.fillText(
                                            a.avatar || (a.isMe ? "🐱" : "🐰"),
                                            e + i / 2,
                                            n + i / 2,
                                          ));
                                      t.restore();
                                    })(x, c + l, A + 4, 40, i),
                                    (x.font = "bold 15px sans-serif"),
                                    (x.fillStyle = n.accent),
                                    (x.textBaseline = "alphabetic"),
                                    (x.textAlign = "left"),
                                    x.fillText(i.name, c + l + 52, A + 18),
                                    (x.font = "12px sans-serif"),
                                    (x.fillStyle = "#999"),
                                    x.fillText(
                                      "@" + i.handle,
                                      c + l + 52,
                                      A + 36,
                                    ),
                                    "classic" === n.layout)
                                  ) {
                                    var C = a.cn.split("<br>");
                                    ((x.font = "11px sans-serif"),
                                      (x.fillStyle = "#bbb"),
                                      (x.textAlign = "right"),
                                      x.fillText(C[0], c + s - l, A + 14),
                                      x.fillText(C[1] || "", c + s - l, A + 29),
                                      (x.textAlign = "left"));
                                  }
                                  return (
                                    (A += w),
                                    "dateTop" === n.layout &&
                                      ((x.font = "bold 24px sans-serif"),
                                      (x.fillStyle = n.accent),
                                      (x.textAlign = "left"),
                                      (x.textBaseline = "alphabetic"),
                                      x.fillText(a.ymd, c + l, A + 24),
                                      (A += h)),
                                    (x.font = "17px sans-serif"),
                                    (x.fillStyle = n.text),
                                    (x.textBaseline = "alphabetic"),
                                    (x.textAlign = "left"),
                                    v.forEach(function (t) {
                                      "" !== t
                                        ? (x.fillText(t, c + l, A), (A += 30))
                                        : (A += 15);
                                    }),
                                    (A += 12),
                                    (x.textAlign = "left"),
                                    (x.font = "12px sans-serif"),
                                    (x.fillStyle = "#bbb"),
                                    (x.textBaseline = "alphabetic"),
                                    x.fillText(a.time, c + l, A + 10),
                                    (x.textAlign = "right"),
                                    (x.font = "12px sans-serif"),
                                    x.fillText(
                                      "Created from iCity | 我的日记",
                                      c + s - l,
                                      A + 10,
                                    ),
                                    (x.textAlign = "left"),
                                    I.toDataURL("image/png")
                                  );
                                })(t, e),
                              );
                            } catch (t) {
                              alert(
                                "生成图片失败，可能是头像图片跨域导致的。请尝试更换成emoji头像后重试。",
                              );
                            }
                          else w(i);
                        })
                      : w(i);
                  });
              }));
        }
        function g(t) {
          var e = new Date(t.ts || Date.now()),
            n = e.getMonth() + 1,
            i = e.getDate(),
            a = e.getFullYear();
          return {
            cn:
              n +
              "月" +
              i +
              "日 · 星期" +
              ["日", "一", "二", "三", "四", "五", "六"][e.getDay()] +
              "<br>" +
              a,
            ymd:
              a +
              "." +
              String(n).padStart(2, "0") +
              "." +
              String(i).padStart(2, "0"),
            time:
              String(e.getHours()).padStart(2, "0") +
              ":" +
              String(e.getMinutes()).padStart(2, "0"),
          };
        }
        function y(t) {
          var e = "me" === t.author || "me" === t.who,
            n = localStorage.getItem("akini_icity_my_nick") || "我",
            i = localStorage.getItem("akini_icity_my_handle") || n,
            a = localStorage.getItem("akini_icity_ta_nick") || "对方",
            o = localStorage.getItem("akini_icity_ta_handle") || a;
          return {
            isMe: e,
            name: e ? n : a,
            handle: e ? i : o,
            avatar: e
              ? localStorage.getItem("akini_my_avatar") ||
                (window.__akiniAvatarCache && window.__akiniAvatarCache.my) ||
                ""
              : localStorage.getItem("akini_ta_avatar") || "",
          };
        }
        function p(t) {
          if ("dots" === t.pattern) {
            var e = (function (t, e, n) {
              var i = t + "|" + e + "|" + n;
              if (f[i]) return f[i];
              var a = document.createElement("canvas");
              ((a.width = 2 * e * 3), (a.height = 2 * e * 3));
              var o = a.getContext("2d");
              (o.scale(3, 3), (o.fillStyle = t));
              for (var r = 0; r < 5; r++)
                for (
                  var c = r * e * 0.5, l = r % 2 == 0 ? 0 : 0.5 * e, s = -1;
                  s < 5;
                  s++
                ) {
                  var d = s * e + l;
                  (o.beginPath(), o.arc(d, c, n, 0, 2 * Math.PI), o.fill());
                }
              return ((f[i] = a.toDataURL("image/png")), f[i]);
            })("rgba(255,255,255,0.55)", 60, 8);
            return (
              '<div style="position:absolute;inset:0;overflow:hidden;pointer-events:none;background-image:url(' +
              e +
              ');background-size:60px 60px;"></div>'
            );
          }
          return "";
        }
        function v(t, e) {
          if (t && a) {
            var n = m[e],
              i = y(t),
              o = g(t),
              r = (function (t) {
                return nt(t.avatar, 48);
              })(i),
              c = p(n),
              l = "28px",
              s = "",
              d = l;
            "classic" === n.layout &&
              ((s =
                '<div style="position:absolute;top:24px;left:28px;font-size:21px;font-weight:800;color:#111;font-family:sans-serif;letter-spacing:-0.5px;z-index:2;">icity · 我的日记</div>'),
              (d = "70px"));
            var u = "";
            "dateTop" === n.layout &&
              (u =
                '<div style="font-size:24px;font-weight:800;color:' +
                n.accent +
                ';margin-bottom:14px;letter-spacing:1px;">' +
                o.ymd +
                "</div>");
            var f = "";
            "classic" === n.layout &&
              (f =
                '<div style="font-size:11px;color:#bbb;text-align:right;line-height:1.5;flex-shrink:0;">' +
                o.cn +
                "</div>");
            var v =
                '<div style="display:flex;align-items:center;margin-bottom:16px;">  <div style="width:42px;height:42px;border-radius:50%;overflow:hidden;background:#f2f2f2;flex-shrink:0;display:flex;align-items:center;justify-content:center;margin-right:12px;">' +
                r +
                '</div>  <div style="flex:1;min-width:0;">    <div style="font-size:15px;font-weight:700;color:' +
                n.accent +
                ';line-height:1.3;">' +
                i.name +
                '</div>    <div style="font-size:12px;color:#999;line-height:1.3;">@' +
                i.handle +
                "</div>  </div>" +
                f +
                "</div>",
              h = "classic" === n.layout ? v : v + u;
            ((a.style.background = n.outer),
              (a.style.position = "relative"),
              (a.innerHTML =
                c +
                s +
                '<div style="position:relative;background:' +
                n.card +
                ";padding:18px;margin:0 " +
                l +
                " " +
                l +
                " " +
                l +
                ";margin-top:" +
                d +
                ';">' +
                h +
                '<div style="font-size:17px;color:' +
                n.text +
                ';line-height:1.7;word-break:break-all;white-space:normal;margin-bottom:18px;">' +
                t.text +
                '</div><div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;color:#bbb;">  <span>' +
                o.time +
                "</span>  <span>Created from iCity | 我的日记</span></div></div>"));
          }
        }
        function h() {
          n &&
            ((n.innerHTML = ""),
            m.forEach(function (t, e) {
              var i = document.createElement("button"),
                a = e === s;
              i.style.cssText =
                "width:72px;border-radius:12px;border:2px solid " +
                (a ? "#4a90e2" : "transparent") +
                ";background:#fff;cursor:pointer;flex-shrink:0;position:relative;overflow:hidden;padding:3px;box-shadow:0 1px 4px rgba(0,0,0,0.08);";
              var o =
                '<div style="width:100%;aspect-ratio:1;border-radius:9px;background:' +
                ("classic" === t.key ? "#222" : t.outer) +
                ';position:relative;overflow:hidden;">';
              ("classic" === t.key
                ? ((o +=
                    '<div style="position:absolute;top:4px;left:4px;right:4px;height:18px;background:#fff;border-radius:3px;opacity:0.9;"></div>'),
                  (o +=
                    '<div style="position:absolute;bottom:4px;left:4px;right:4px;height:34px;background:#fff;border-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,0.15);"></div>'))
                : "pink" === t.key
                  ? ((o +=
                      '<div style="position:absolute;inset:0;background-image:radial-gradient(circle,rgba(255,255,255,0.35) 2px,transparent 2px),radial-gradient(circle,rgba(255,255,255,0.35) 2px,transparent 2px);background-size:10px 10px;background-position:0 0, 5px 5px;"></div>'),
                    (o +=
                      '<div style="position:absolute;bottom:4px;left:4px;right:4px;height:32px;background:#fff;border-radius:4px;"></div>'))
                  : "blue" === t.key &&
                    ((o +=
                      '<div style="position:absolute;inset:0;background-image:radial-gradient(circle,rgba(255,255,255,0.55) 2px,transparent 2px),radial-gradient(circle,rgba(255,255,255,0.55) 2px,transparent 2px);background-size:10px 10px;background-position:0 0, 5px 5px;"></div>'),
                    (o +=
                      '<div style="position:absolute;bottom:4px;left:4px;right:4px;height:32px;background:#fff;border-radius:4px;"></div>')),
                (o += "</div>"),
                a &&
                  (o +=
                    '<div style="position:absolute;top:4px;right:4px;width:18px;height:18px;background:#4a90e2;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;line-height:1;">✓</div>'),
                (o +=
                  '<div style="margin-top:5px;font-size:12px;color:' +
                  (a ? "#4a90e2" : "#888") +
                  ";font-weight:" +
                  (a ? "600" : "400") +
                  ';">' +
                  t.label +
                  "</div>"),
                (i.innerHTML =
                  '<div style="display:flex;flex-direction:column;align-items:center;">' +
                  o +
                  "</div>"),
                i.addEventListener("click", function () {
                  ((s = e), h(), v(l, s));
                }),
                n.appendChild(i));
            }));
        }
        function w(t) {
          if (o && c)
            ((c.innerHTML =
              '<img src="' +
              t +
              '" style="width:100%;display:block;" alt="日记图片">'),
              (o.style.display = "flex"));
          else {
            var e = document.createElement("a");
            ((e.href = t),
              (e.download = "diary_" + Date.now() + ".png"),
              document.body.appendChild(e),
              e.click(),
              document.body.removeChild(e));
          }
        }
        function k(t, e, n, i, a, o, r) {
          (o &&
            o.forEach(function (t, e) {
              void 0 !== r[e] && (t.src = r[e]);
            }),
            (t.style.width = e),
            t.parentNode && (t.parentNode.style.maxWidth = n),
            v(i, a));
        }
      })(),
        document.querySelectorAll(".icity-nav-btn").forEach(function (n) {
          a(n, function () {
            window.akiniGoIcityTab(n.getAttribute("data-tab"));
          });
        }));
      window.akiniGoIcityTab = function (i) {
        i = String(i);
        ([1, 2, 3].forEach(function (t) {
          var e = document.getElementById("icityTab" + t);
          e && (e.style.display = t == i ? "flex" : "none");
        }),
          document.querySelectorAll(".icity-nav-btn").forEach(function (t) {
            var e = t.querySelector("span");
            if (e) {
              var n = t.getAttribute("data-tab") == i;
              ((e.style.color = n ? "#4a90e2" : "#aaa"),
                (e.style.fontWeight = n ? "600" : "400"));
            }
          }));
        var a = document.getElementById("icityTabTitle");
        a &&
          (a.textContent =
            "1" == i ? "我的日记" : "2" == i ? "发布" : "我的主页");
        var o = document.getElementById("icityEditProfileBtn");
        (o && (o.style.display = "3" == i ? "" : "none"),
          t(),
          "2" === i && (e(), setTimeout(e, 100)));
      };
      var r = document.getElementById("icityPublishBtn"),
        c = document.getElementById("icityWriteInput");
      a(r, function () {
        var e = c ? c.value.trim() : "";
        if (e) {
          var n = q(),
            i =
              (localStorage.getItem("akini_icity_my_nick"),
              localStorage.getItem("akini_icity_ta_nick"),
              localStorage.getItem("akini_icity_ta_avatar") ||
                localStorage.getItem("akini_ta_avatar"),
              {
                id: Date.now() + "",
                author: "me",
                who: "me",
                text: e,
                ts: Date.now(),
                likes: 0,
                liked: !1,
                comments: [],
                likers: [],
              });
          (n.push(i),
            j(n),
            (function(){ try { if (window.akiniTaPhoneCollectIcity) { var _icid = window.akiniContacts && window.akiniContacts.getActiveChatId ? window.akiniContacts.getActiveChatId() : null; window.akiniTaPhoneCollectIcity(_icid, e, i.ts); } } catch (_e) {} })(),
            window.scheduleTaLikeSoon && window.scheduleTaLikeSoon(i.id),
            // 联系人主动评论用户发布的日记（replyToMyComment 仅回复用户已有评论，发布新日记时无评论故改用主动评论）
            window.scheduleTaCommentSoon && window.scheduleTaCommentSoon(i.id),
            // syy 风格：发布后延迟随机时间，多联系人按概率自动评论 + 自动点赞
            (function(){
              try {
                if (window.akiniTriggerMomentAutoReply) {
                  var _delay = window.akiniGetMomentReplyDelay ? window.akiniGetMomentReplyDelay() : (2000 + Math.random() * 5000);
                  setTimeout(function () {
                    window.akiniTriggerMomentAutoReply(i.id, "icity");
                  }, _delay);
                }
              } catch (_e) {}
            })(),
            c && (c.value = ""));
          var a = document.getElementById("icityTab1"),
            o = document.getElementById("icityTab2"),
            r = document.getElementById("icityTab3");
          (a && (a.style.display = "flex"),
            o && (o.style.display = "none"),
            r && (r.style.display = "none"),
            document.querySelectorAll(".icity-nav-btn").forEach(function (t) {
              var e = t.querySelector("span");
              e &&
                ((e.style.color =
                  "1" == t.getAttribute("data-tab") ? "#4a90e2" : "#aaa"),
                (e.style.fontWeight =
                  "1" == t.getAttribute("data-tab") ? "600" : "400"));
            }));
          var l = document.getElementById("icityTabTitle");
          (l && (l.textContent = "我的日记"), t());
        } else alert("请输入日记内容");
      });
      var l = document.getElementById("icityActionSheet"),
        s = document.getElementById("icityActionDelete"),
        d = document.getElementById("icityActionPin"),
        u = document.getElementById("icityActionCancel");
      if (
        (l &&
          (l.addEventListener("click", function (t) {
            t.target === l &&
              (t.preventDefault(),
              t.stopPropagation(),
              (l.style.display = "none"));
          }),
          l.addEventListener(
            "touchend",
            function (t) {
              t.target === l &&
                (t.preventDefault(),
                t.stopPropagation(),
                (l.style.display = "none"));
            },
            { passive: !1 },
          )),
        u)
      ) {
        function m(t) {
          (t && (t.preventDefault(), t.stopPropagation()),
            l && (l.style.display = "none"));
        }
        (u.addEventListener(
          "touchend",
          function (t) {
            m(t);
          },
          { passive: !1 },
        ),
          u.addEventListener("click", function (t) {
            m(t);
          }));
      }
      if (s) {
        function f(e) {
          e && (e.preventDefault(), e.stopPropagation());
          var n = l._currentId;
          (j(
            q().filter(function (t) {
              return t.id != n;
            }),
          ),
            (l.style.display = "none"),
            t());
          var i = document.getElementById("icityDetailModal");
          i && i._currentDiaryId == n && (i.style.display = "none");
        }
        (s.addEventListener(
          "touchend",
          function (t) {
            f(t);
          },
          { passive: !1 },
        ),
          s.addEventListener("click", function (t) {
            f(t);
          }));
      }
      if (d) {
        function g(e) {
          e && (e.preventDefault(), e.stopPropagation());
          var n = l._currentId,
            i = q(),
            a = i.findIndex(function (t) {
              return t.id == n;
            });
          (a >= 0 && ((i[a].pinned = !i[a].pinned), j(i)),
            (l.style.display = "none"),
            t());
        }
        (d.addEventListener(
          "touchend",
          function (t) {
            g(t);
          },
          { passive: !1 },
        ),
          d.addEventListener("click", function (t) {
            g(t);
          }));
      }
      var y = document.getElementById("icityEditProfileBtn"),
        p = document.getElementById("icityProfileEditModal"),
        v = document.getElementById("icityProfileEditBack"),
        h = document.getElementById("icityProfileEditDone"),
        taBack = document.getElementById("icityTaProfileBack");
      function w(t) {
        var e = i("akini_icity_profile_" + t, null),
          n = window.akiniContacts
            ? window.akiniContacts.getContactById(t)
            : null,
          a = localStorage.getItem("akini_icity_ta_nick") || "",
          o = localStorage.getItem("akini_icity_ta_handle") || a,
          r = !1;
        if (n && window.akiniContacts) {
          var c = window.akiniContacts.getContacts();
          r = n.isDefault || (c.length > 0 && c[0].id === n.id);
        }
        var d = {
          name: (e && e.name) || (r && a) || (n && n.name) || a || "对方",
          handle:
            (e && e.handle) || (r && o) || (n && n.name) || o || a || "对方",
          avatar: (e && e.avatar) || (n && n.avatar) || "",
          bio: (e && e.bio) || "",
        };
        return d;
      }
      ((window.getIcityContactProfile = w),
        (window._currentIcityContactId = null),
        (window.showIcityTaProfile = function (t) {
          if (window.akiniContacts) {
            if (!t) {
              var e = window.akiniContacts.getContacts();
              t = (e[0] || {}).id;
            }
            if (t) {
              window._currentIcityContactId = t;
              var i = w(t),
                a = document.getElementById("icityTaProfileModal");
              if (a) {
                var o = document.getElementById("icityTaProfileEditBtn");
                o && (o.style.display = "none");
                var r = document.getElementById("icityTaAvatar3");
                r &&
                  (i.avatar &&
                  (i.avatar.startsWith("data:") || i.avatar.startsWith("http"))
                    ? (r.innerHTML =
                        '<img src="' +
                        i.avatar +
                        '" style="width:100%;height:100%;object-fit:cover;">')
                    : (r.textContent = i.avatar || "🐰"));
                var c = document.getElementById("icityTaNameDisplay");
                c && (c.textContent = i.name);
                var l = document.getElementById("icityTaHandleDisplay");
                l && (l.textContent = "@" + i.handle);
                var s = document.getElementById("icityTaBioDisplay");
                (s && (s.textContent = i.bio),
                  D("akini_icity_ta_bg_" + t, function (t) {
                    var e = a.querySelector(".icity-ta-bg-div");
                    e && t
                      ? ((e.style.backgroundImage = "url(" + t + ")"),
                        e.style.setProperty("background-size", "cover", "important"),
                        e.style.setProperty("background-position", "center center", "important"),
                        e.style.setProperty("background-repeat", "no-repeat", "important"))
                      : e &&
                        ((e.style.backgroundImage = ""),
                          (e.style.background =
                            "linear-gradient(135deg,#f4f7fa 0%,#e9eef3 40%,#dde5ec 75%,#cfd9e3 100%)"));
                  }));
                var d = q().filter(function (e) {
                    return (
                      e.authorId === t || (e.author === i.name && !e.authorId)
                    );
                  }).length,
                  u = document.getElementById("icityTaDiaryCount");
                (u && (u.textContent = d),
                  n("icityTaProfileDiaries", t),
                  (a.style.display = "flex"),
                  requestAnimationFrame(function () {
                    a.classList.add("show");
                  }));
              }
            }
          }
        }));
      var k,
        _,
        b,
        I,
        x,
        E,
        S = document.getElementById("icityTaProfileEditBtn");
      function A(t, e) {
        var n = document.getElementById(t);
        n &&
          (e && (e.startsWith("data:") || e.startsWith("http"))
            ? (n.innerHTML =
                '<img src="' +
                e +
                '" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">')
            : (n.textContent = e || ""));
      }
      function C() {
        var t = document.getElementById("icityContactSelector");
        if (t && window.akiniContacts) {
          var e = window.akiniContacts.getContacts();
          if (0 !== e.length) {
            var n = "";
            (e.forEach(function (t) {
              var e =
                  t.id === window._icityEditContactId
                    ? "border:2px solid #4a90e2;"
                    : "border:2px solid transparent;",
                i = w(t.id).name || t.name || "对方";
              n +=
                '<div style="display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;flex-shrink:0;min-width:58px;" data-icity-edit-contact="' +
                t.id +
                '"><div style="width:44px;height:44px;border-radius:50%;background:#e8e8e8;overflow:hidden;display:flex;align-items:center;justify-content:center;' +
                e +
                '">' +
                nt(t.avatar, 44) +
                '</div><div style="font-size:11px;color:#555;max-width:58px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
                rt(i) +
                "</div></div>";
            }),
              (t.innerHTML = n),
              t
                .querySelectorAll("[data-icity-edit-contact]")
                .forEach(function (t) {
                  t.addEventListener("click", function () {
                    (B(),
                      (window._icityEditContactId = this.getAttribute(
                        "data-icity-edit-contact",
                      )),
                      T(window._icityEditContactId),
                      C());
                  });
                }));
          } else
            t.innerHTML =
              '<div style="font-size:13px;color:#999;">暂无联系人</div>';
        }
      }
      function B() {
        var t = window._icityEditContactId;
        if (t) {
          var e = "akini_icity_profile_" + t,
            n = i(e, {}),
            a = document.getElementById("icityTaNickInput"),
            o = document.getElementById("icityTaHandleInput"),
            r = document.getElementById("icityTaBioInput");
          (a && (n.name = a.value.trim()),
            o && (n.handle = o.value.trim()),
            r && (n.bio = r.value.trim()));
          var c = JSON.stringify(n);
          try {
            localStorage.setItem(e, c);
          } catch (t) {}
          _idbStore.set(e, c);
        }
      }
      function T(t) {
        var e = w(t),
          n = document.getElementById("icityTaNickInput"),
          i = document.getElementById("icityTaHandleInput"),
          a = document.getElementById("icityTaBioInput");
        (n && (n.value = e.name),
          i && (i.value = e.handle),
          a && (a.value = e.bio),
          window.fillPreview("icityEditTaAvatarPreview", e.avatar || "🐰"));
        var o = document.getElementById("icityEditTaBgPreview");
        D("akini_icity_ta_bg_" + t, function (t) {
          o && t
            ? ((o.style.backgroundImage = "url(" + t + ")"),
              (o.style.backgroundSize = "cover"))
            : o &&
              ((o.style.backgroundImage = ""),
                (o.style.background =
                  "linear-gradient(135deg,#f4f7fa 0%,#e9eef3 40%,#dde5ec 75%,#cfd9e3 100%)"));
        });
      }
      (S &&
        a(S, function (t) {
          if (
            (t && (t.stopPropagation(), t.preventDefault()),
            (window._icityEditFromMyProfile = !1),
            window._currentIcityContactId && p)
          ) {
            ((window._icityEditContactId = window._currentIcityContactId),
              C(),
              T(window._icityEditContactId));
            var e = localStorage.getItem("akini_icity_my_nick") || "",
              n = localStorage.getItem("akini_icity_my_handle") || e,
              i = localStorage.getItem("akini_icity_my_bio") || "",
              a = document.getElementById("icityMyNickInput"),
              o = document.getElementById("icityMyHandleInput"),
              r = document.getElementById("icityMyBioInput");
            (a && (a.value = e),
              o && (o.value = n),
              r && (r.value = i),
              A(
                "icityEditMyAvatarPreview",
                localStorage.getItem("akini_my_avatar") ||
                  localStorage.getItem("akini_icity_my_avatar") ||
                  "🐱",
              ));
            var c = document.getElementById("icityEditMyBgPreview");
            (D("akini_icity_my_bg", function (t) {
              c &&
                (t
                  ? ((c.style.backgroundImage = "url(" + t + ")"),
                    (c.style.backgroundSize = "cover"))
                  : ((c.style.backgroundImage = ""),
                    (c.style.background =
                      "linear-gradient(135deg,#fdfbf7 0%,#f5efe6 40%,#e8dfd3 75%,#dcd0bf 100%)")));
            }),
              p &&
                ((p.style.display = "flex"), (p.style.visibility = "visible")));
          }
        }),
        (window.fillPreview = A),
        (window._icityEditContactId = null),
        y &&
          a(y, function () {
            if (((window._icityEditFromMyProfile = !0), p)) {
              var t =
                  localStorage.getItem("akini_icity_my_nick") ||
                  localStorage.getItem("akini_my_name") ||
                  "",
                e = localStorage.getItem("akini_icity_my_handle") || t,
                n = localStorage.getItem("akini_icity_my_bio") || "",
                i = document.getElementById("icityMyNickInput"),
                a = document.getElementById("icityMyHandleInput"),
                o = document.getElementById("icityMyBioInput");
              (i && (i.value = t),
                a && (a.value = e || ""),
                o && (o.value = n),
                window.fillPreview(
                  "icityEditMyAvatarPreview",
                  localStorage.getItem("akini_my_avatar") ||
                    localStorage.getItem("akini_icity_my_avatar") ||
                    "🐱",
                ));
              var r = document.getElementById("icityEditMyBgPreview");
              D("akini_icity_my_bg", function (t) {
                r &&
                  (t
                    ? ((r.style.backgroundImage = "url(" + t + ")"),
                      (r.style.backgroundSize = "cover"))
                    : ((r.style.backgroundImage = ""),
                      (r.style.background =
                        "linear-gradient(135deg,#fdfbf7 0%,#f5efe6 40%,#e8dfd3 75%,#dcd0bf 100%)")));
              });
              var c = window.akiniContacts
                ? window.akiniContacts.getContacts()
                : [];
              ((window._icityEditContactId = c.length ? c[0].id : null),
                C(),
                window._icityEditContactId && T(window._icityEditContactId),
                p &&
                  ((p.style.display = "flex"),
                  (p.style.visibility = "visible")));
            }
          }),
        v &&
          a(v, function (t) {
            (p && ((p.style.display = "none"), (p.style.visibility = "hidden")),
              (window._icityEditFromMyProfile = !1),
              (window._icityEditContactId = null));
          }),
        taBack &&
          a(taBack, function (t) {
            var e = document.getElementById("icityTaProfileModal");
            e &&
              ((e.style.display = "none"),
                e.classList.remove("show"),
                (window._currentIcityContactId = null));
          }),
        h &&
          a(h, function (e) {
            try {
              var n = document.getElementById("icityMyNickInput"),
                i = document.getElementById("icityMyHandleInput"),
                a = document.getElementById("icityMyBioInput");
              (n && n.value.trim() && L("akini_icity_my_nick", n.value.trim()),
                i && L("akini_icity_my_handle", i.value.trim()),
                a && L("akini_icity_my_bio", a.value.trim()),
                B(),
                t(),
                p &&
                  ((p.style.display = "none"), (p.style.visibility = "hidden")),
                (window._icityEditFromMyProfile = !1),
                (window._icityEditContactId = null),
                window._renderIcity && window._renderIcity());
            } catch (t) {
              (console.error("icity 个人设置保存失败", t),
                alert("保存失败，请稍后重试"));
            }
          }),
        (k = "icityEditMyBgBtn"),
        (_ = "icityMyBgInput"),
        (b = "akini_icity_my_bg"),
        (I = "icityEditMyBgPreview"),
        (x = document.getElementById(k)),
        (E = document.getElementById(_)),
        x &&
          E &&
          E.addEventListener("change", function () {
            var t = this.files[0];
            if (t) {
              var e = new FileReader();
              ((e.onload = function (t) {
                _idbStore.set(b, t.target.result, function () {
                  try {
                    localStorage.removeItem(b);
                  } catch (t) {}
                });
                var e = document.getElementById(I);
                if (
                  (e &&
                    (b.indexOf("_bg") >= 0
                      ? ((e.style.backgroundImage =
                          "url(" + t.target.result + ")"),
                        (e.style.backgroundSize = "cover"))
                      : (e.innerHTML =
                          '<img src="' +
                          t.target.result +
                          '" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">')),
                  "akini_icity_my_bg" === b)
                ) {
                  var n = document.getElementById("icityMyBgArea");
                  n &&
                    ((n.style.backgroundImage = "url(" + t.target.result + ")"),
                    (n.style.backgroundSize = "cover"),
                    (n.style.backgroundPosition = "center"));
                }
                if ("akini_icity_ta_bg" === b) {
                  var i = document.querySelector(".icity-ta-bg-div");
                  i &&
                    ((i.style.backgroundImage = "url(" + t.target.result + ")"),
                    (i.style.backgroundSize = "cover"),
                    (i.style.backgroundPosition = "center"));
                }
              }),
                e.readAsDataURL(t));
            }
          }));
      var M = document.getElementById("icityEditTaBgBtn"),
        N = document.getElementById("icityTaBgInput");
      M &&
        N &&
        N.addEventListener("change", function () {
          var t = this.files[0];
          if (t && window._icityEditContactId) {
            var e = new FileReader();
            ((e.onload = function (t) {
              var e = "akini_icity_ta_bg_" + window._icityEditContactId;
              _idbStore.set(e, t.target.result);
              var n = document.getElementById("icityEditTaBgPreview");
              n &&
                ((n.style.backgroundImage = "url(" + t.target.result + ")"),
                (n.style.backgroundSize = "cover"));
            }),
              e.readAsDataURL(t));
          }
        });
      var P = document.getElementById("icityEditTaAvatarBtn"),
        H = document.getElementById("icityTaAvatarInput");
      (P &&
        H &&
        H.addEventListener("change", function () {
          var t = this.files[0];
          t &&
            window._icityEditContactId &&
            G(t, function (t) {
              if (t) {
                var e = window._icityEditContactId,
                  n = "akini_icity_profile_" + e,
                  a = i(n, {});
                a.avatar = t;
                var c = JSON.stringify(a);
                try {
                  localStorage.setItem(n, c);
                } catch (t) {}
                (_idbStore.set(n, c),
                  window.akiniContacts &&
                    window.akiniContacts.updateContact &&
                    window.akiniContacts.updateContact(e, { avatar: t }));
                var o = document.getElementById("icityEditTaAvatarPreview");
                (o &&
                  (o.innerHTML =
                    '<img src="' +
                    t +
                    '" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">'),
                  C(),
                  window._renderIcity && window._renderIcity(),
                  "function" == typeof window._renderIcityContactProfiles &&
                    window._renderIcityContactProfiles());
              }
            });
        }),
        t());
    })();
    window._akiniSetupBackup && window._akiniSetupBackup();
    const ln = document.getElementById("mailTabSent"),
      sn = document.getElementById("mailTabReceived"),
      dn = document.getElementById("mailContentArea"),
      un = document.getElementById("mailComposeFab"),
      mn = document.getElementById("mailComposeModal"),
      fn = document.getElementById("mailSendBtn"),
      gn = document.getElementById("mailWriteInput"),
      yn = document.getElementById("mailDetailModal"),
      pn = document.getElementById("mailDetailClose"),
      vn = document.getElementById("mailCancelBtn"),
      hn = document.getElementById("mailRecipientPickerModal"),
      wn = document.getElementById("mailRecipientPickerClose");
    let kn = "sent";
    window.__renderMail = function () {
      _n(kn);
    };
    window.__renderMail();
    function _n(t) {
      if (!dn) return;
      const e = "sent" === t ? "akini_mail_sent" : "akini_mail_received";
      function loadRaw(v) {
        try {
          var arr = JSON.parse(v || "[]");
          if (Array.isArray(arr) && arr.length === 0) return false;
        } catch (e) {
          return false;
        }
        return true;
      }
      D(e, function (v) {
        if (v && loadRaw(v)) {
          _renderMailList(t, v);
        } else {
          D(e + "_backup", function (vb) {
            if (vb) {
              try {
                localStorage.setItem(e, vb);
              } catch (e) {}
              _renderMailList(t, vb);
            } else {
              _renderMailList(t, "[]");
            }
          });
        }
      });
    }
    function _renderMailList(t, raw) {
      var n = [];
      try {
        n = JSON.parse(raw || "[]");
      } catch (e) {
        n = [];
      }
      if (((dn.innerHTML = ""), 0 === n.length)) {
        const e = document.createElement("div");
        return (
          (e.style.cssText =
            "color:#666;text-align:center;padding:60px 20px;font-size:14px;"),
          (e.textContent =
            "sent" === t
              ? "还没有寄出过信，写下你的第一封信吧"
              : "还没有收到信，耐心等待吧"),
          void dn.appendChild(e)
        );
      }
      const a = localStorage.getItem("akini_my_name") || "我";
      n.slice()
        .reverse()
        .forEach(function (e) {
          const n = document.createElement("div");
          let o = "",
            r = "",
            c = "";
          ((function () {
            var __contentPreview = (e.content || "")
              .replace(/\n/g, " ")
              .replace(/[\u2261\u2630\u2631\u2632\u2633]/g, "");
            var __c =
              __contentPreview.slice(0, 36) +
              (__contentPreview.length > 36 ? "…" : "");
            "sent" === t
              ? "reply" === e.subtype
                ? ((o =
                    '<span style="font-size:11px;background:#e8f4e8;color:#5a9e5a;border-radius:8px;padding:2px 8px;">回复</span>'),
                  (r = a + "回复了" + (e.to || "对方")),
                  (c = __c))
                : ((o =
                    '<span style="font-size:11px;background:#e8e8e8;color:#666;border-radius:8px;padding:2px 8px;">已寄出</span>'),
                  (r = a + "寄给" + (e.to || "对方")),
                  (c = __c))
              : "reply" === e.subtype
                ? ((o =
                    '<span style="font-size:11px;background:#e8f4e8;color:#5a9e5a;border-radius:8px;padding:2px 8px;">回复</span>'),
                  (r = (e.from || "对方") + "回复了" + a),
                  (c = __c))
                : ((o =
                    '<span style="font-size:11px;background:#fce8e8;color:#c05050;border-radius:8px;padding:2px 8px;">来信</span>'),
                  (r = (e.from || "对方") + "寄给" + a),
                  (c = __c));
          })(),
            (n.style.cssText =
              "background:#f2f2f2;border-radius:14px;padding:14px 16px;border:1px solid #e8e8e8;cursor:pointer;"),
            (n.innerHTML =
              '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;"><div style="font-size:13px;color:#222;font-weight:500;">' +
              r +
              "</div>" +
              o +
              "</div>" +
              (c
                ? '<div style="font-size:14px;color:#111;line-height:1.6;margin-bottom:6px;">' +
                  c +
                  "</div>"
                : "") +
              (function(){
                function formatMailDate(d){
                  if (!d) return "";
                  try {
                    var dt = new Date(d);
                    if (isNaN(dt.getTime())) return d;
                    var yyyy = dt.getFullYear();
                    var mo = String(dt.getMonth()+1).padStart(2,"0");
                    var dd = String(dt.getDate()).padStart(2,"0");
                    var hh = String(dt.getHours()).padStart(2,"0");
                    var mm = String(dt.getMinutes()).padStart(2,"0");
                    return yyyy + "-" + mo + "-" + dd + " " + hh + ":" + mm;
                  } catch(err) { return d; }
                }
                return '<div style="font-size:12px;color:#888;">' + formatMailDate(e.date || "") + "</div>";
              })()),
            n.addEventListener("click", function () {
              Date.now() - An < 500 ||
                (function (t, e) {
                  var originalLetter = t;
                  if (!yn) return;
                  function formatMailDate(d) {
                    if (!d) return "";
                    try {
                      var dt = new Date(d);
                      if (isNaN(dt.getTime())) return d;
                      var yyyy = dt.getFullYear();
                      var mo = String(dt.getMonth() + 1).padStart(2, "0");
                      var dd = String(dt.getDate()).padStart(2, "0");
                      var hh = String(dt.getHours()).padStart(2, "0");
                      var mm = String(dt.getMinutes()).padStart(2, "0");
                      return yyyy + "-" + mo + "-" + dd + " " + hh + ":" + mm;
                    } catch (e) {
                      return d;
                    }
                  }
                  const n = localStorage.getItem("akini_my_name") || "我",
                    a =
                      t.from ||
                      t.to ||
                      localStorage.getItem("akini_ta_name") ||
                      "对方",
                    o = document.getElementById("mailDetailFrom"),
                    r = document.getElementById("mailDetailDate"),
                    c = document.getElementById("mailDetailContent"),
                    avatarEl = document.getElementById("mailDetailAvatar"),
                    nameEl = document.getElementById("mailDetailName");
                  var otherId = "sent" === e ? t.toId : t.fromId;
                  var otherContact = otherId && window.akiniContacts && window.akiniContacts.getContactById ? window.akiniContacts.getContactById(otherId) : null;
                  // 如果按ID找不到，再用名字（to/from）匹配一次联系人
                  if (!otherContact && window.akiniContacts && window.akiniContacts.getContacts) {
                    var searchName = "sent" === e ? (t.to || a) : (t.from || a);
                    if (searchName && searchName !== "我" && searchName !== "对方") {
                      var contacts = window.akiniContacts.getContacts();
                      otherContact = contacts.find(function(c){ return c && (c.name === searchName || c.id === searchName); }) || null;
                    }
                  }
                  if (!otherContact && window.akiniContacts && window.akiniContacts.getChatTarget) {
                    var activeChatId = window.akiniContacts.getActiveChatId ? window.akiniContacts.getActiveChatId() : null;
                    var fallbackTarget = activeChatId ? window.akiniContacts.getChatTarget(activeChatId) : null;
                    if (fallbackTarget) otherContact = fallbackTarget;
                  }
                  // 信件详情：我寄/回显示我的头像，联系人寄/回显示联系人的头像；姓名始终显示联系人
                  var senderAvatar;
                  if ("sent" === e) {
                    senderAvatar = localStorage.getItem("akini_my_avatar") || "🐱";
                  } else {
                    senderAvatar = otherContact ? (otherContact.avatar || "🐰") : (localStorage.getItem("akini_ta_avatar") || "🐰");
                  }
                  if (avatarEl) {
                    avatarEl.innerHTML = "";
                    avatarEl.innerHTML = nt(senderAvatar, 44);
                    if (!avatarEl.innerHTML.trim()) avatarEl.innerHTML = "🐰";
                  }
                  if (nameEl) {
                    nameEl.textContent = a;
                  }
                  (o &&
                    ("sent" === e
                      ? "reply" === t.subtype
                        ? (o.textContent = n + "回复了" + (t.to || a))
                        : (o.textContent = n + "寄给" + (t.to || a))
                      : "reply" === t.subtype
                        ? (o.textContent = a + "回复了" + n)
                        : (o.textContent = a + "寄给" + n)),
                    r && (r.textContent = formatMailDate(t.date || "")),
                    c &&
                      ("reply" === t.subtype && t.originalContent
                        ? (function () {
                            var __oc = (t.originalContent || "")
                              .replace(/[\u2261\u2630\u2631\u2632\u2633]/g, "")
                              .trim();
                            var __short =
                              __oc.length > 50 ? __oc.slice(0, 30) + "…" : __oc;
                            var __uid = "mailOrig_" + Date.now();
                            c.innerHTML =
                              '<div style="color:#888;font-size:13px;margin-bottom:6px;">原信内容：</div><div style="color:#555;font-size:14px;line-height:1.6;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #f0f0f0;"><span id="' +
                              __uid +
                              '_t">' +
                              __short +
                              "</span>" +
                              (__oc.length > 50
                                ? '<button type="button" id="' +
                                  __uid +
                                  '_btn" style="margin-left:6px;background:transparent;border:none;color:#4f7cff;font-size:13px;cursor:pointer;padding:0;">展开</button>'
                                : "") +
                              '</div><div style="color:#888;font-size:13px;margin-bottom:6px;">回信内容：</div><div style="color:#333;font-size:14px;line-height:1.6;">' +
                              (t.content || "")
                                .replace(
                                  /[\u2261\u2630\u2631\u2632\u2633]/g,
                                  "",
                                )
                                .trim() +
                              "</div>";
                            if (__oc.length > 50) {
                              var __btn = document.getElementById(
                                __uid + "_btn",
                              );
                              __btn &&
                                __btn.addEventListener("click", function () {
                                  var __expanded =
                                      this.getAttribute("data-expanded") ===
                                      "true",
                                    __txt = document.getElementById(
                                      __uid + "_t",
                                    );
                                  this.setAttribute(
                                    "data-expanded",
                                    !__expanded,
                                  );
                                  __txt &&
                                    (__txt.textContent = __expanded
                                      ? __short
                                      : __oc);
                                  this.textContent = __expanded
                                    ? "展开"
                                    : "收起";
                                });
                            }
                          })()
                        : (c.textContent = (t.content || "")
                            .replace(/[\u2261\u2630\u2631\u2632\u2633]/g, "")
                            .trim())));
                  var l = document.getElementById("mailDetailReplyArea");
                  if (
                    (l ||
                      (((l = document.createElement("div")).id =
                        "mailDetailReplyArea"),
                      (l.style.cssText =
                        "margin-top:16px;border-top:1px solid #f0f0f0;padding-top:12px;"),
                      yn.querySelector("div > div").appendChild(l)),
                    "received" === e && "reply" !== t.subtype && !t.repliedByMe)
                  ) {
                    l.innerHTML =
                      '<textarea id="mailDetailReplyInput" placeholder="回复这封信…" style="width:100%;min-height:70px;border:1px solid #e8e8e8;border-radius:10px;padding:8px 12px;font-size:14px;font-family:inherit;resize:none;outline:none;color:#333;box-sizing:border-box;"></textarea><button type="button" id="mailDetailReplyBtn" style="margin-top:8px;width:100%;padding:10px;background:#333;color:#fff;border:none;border-radius:10px;font-size:14px;cursor:pointer;font-family:inherit;">发送回复</button>';
                    var s = document.getElementById("mailDetailReplyBtn");
                    s &&
                      (s.onclick = function () {
                        var replyInput = document.getElementById(
                            "mailDetailReplyInput",
                          ),
                          e = replyInput ? replyInput.value.trim() : "";
                        if (e) {
                          var a = i("akini_mail_sent", []);
                          (a.push({
                            content: e,
                            date: new Date().toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }),
                            from: n,
                            to: originalLetter.from,
                            toId: originalLetter.fromId,
                            subtype: "reply",
                            originalContent: originalLetter.content,
                            repliedByTa: !0,
                          }),
                            saveMailSent(a));
                          const recv = i("akini_mail_received", []);
                          for (var ri = 0; ri < recv.length; ri++) {
                            if (
                              recv[ri].date === originalLetter.date &&
                              recv[ri].content === originalLetter.content &&
                              recv[ri].fromId === originalLetter.fromId
                            ) {
                              recv[ri].repliedByMe = !0;
                              saveMailReceived(recv);
                              break;
                            }
                          }
                          (replyInput && (replyInput.value = ""),
                            yn && (yn.style.display = "none"),
                            "sent" === kn && _n("sent"));
                        } else alert("请写点什么再发送~");
                      });
                  } else l.innerHTML = "";
                  yn.style.display = "flex";
                })(e, t);
            }),
            dn.appendChild(n));
        });
    }
    function saveMailSent(t) {
      var e = JSON.stringify(t || []);
      if (window.akiniStore && window.akiniStore.set) {
        window.akiniStore.set("akini_mail_sent", e);
      } else {
        try { localStorage.setItem("akini_mail_sent", e); } catch (t) {}
        window._idbStore && window._idbStore.set &&
          (window._idbStore.set("akini_mail_sent", e),
          window._idbStore.set("akini_mail_sent_backup", e));
      }
    }
    function saveMailReceived(t) {
      var e = JSON.stringify(t || []);
      if (window.akiniStore && window.akiniStore.set) {
        window.akiniStore.set("akini_mail_received", e);
      } else {
        try { localStorage.setItem("akini_mail_received", e); } catch (t) {}
        window._idbStore && window._idbStore.set &&
          (window._idbStore.set("akini_mail_received", e),
          window._idbStore.set("akini_mail_received_backup", e));
      }
    }
    function bn(t) {
      kn = t;
      const e = "sent" === t;
      (ln &&
        (ln.classList.toggle("active", e),
        (ln.style.background = e ? "#333" : "#fff"),
        (ln.style.color = e ? "#fff" : "#333"),
        (ln.style.borderColor = e ? "#333" : "#e0e0e0")),
        sn &&
          (sn.classList.toggle("active", !e),
          (sn.style.background = e ? "#fff" : "#333"),
          (sn.style.color = e ? "#333" : "#fff"),
          (sn.style.borderColor = e ? "#e0e0e0" : "#333")),
        _n(t));
    }
    (a(ln, function () {
      bn("sent");
    }),
      a(sn, function () {
        bn("received");
      }));
    var In = null;
    function xn() {
      const t = document.getElementById("mailRecipientSelected");
      t &&
        (t.innerHTML = In
          ? '<div style="width:22px;height:22px;border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#eee;">' +
            nt(In.avatar, 22) +
            '</div><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
            rt(In.name || "未命名") +
            "</span>"
          : "<span>请选择联系人</span>");
    }
    function En() {
      const t = document.getElementById("mailRecipientPickerList");
      if (!t) return;
      const e = window.akiniContacts ? window.akiniContacts.getContacts() : [];
      let n = "";
      (0 === e.length
        ? (n =
            '<div style="padding:16px 12px;text-align:center;color:#999;font-size:14px;">暂无联系人，请先添加联系人</div>')
        : e.forEach(function (t) {
            n +=
              '<div class="mail-picker-option" data-id="' +
              (t.id || "") +
              '" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid #f0f0f0;cursor:pointer;"><div style="width:36px;height:36px;border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#eee;">' +
              nt(t.avatar, 36) +
              '</div><span style="font-size:14px;color:#333;flex:1;min-width:0;">' +
              rt(t.name || "未命名") +
              "</span></div>";
          }),
        (t.innerHTML = n),
        t.querySelectorAll(".mail-picker-option").forEach(function (t) {
          a(t, function () {
            const e = t.getAttribute("data-id");
            ((In = window.akiniContacts
              ? window.akiniContacts.getChatTarget(e)
              : null),
              xn(),
              hn && (hn.style.display = "none"),
              mn && (mn.style.display = "flex"));
          });
        }));
    }
    (wn &&
      a(wn, function () {
        hn && (hn.style.display = "none");
      }),
      a(un, function () {
        (gn && (gn.value = ""),
          (In = null),
          xn(),
          mn && (mn.style.display = "none"),
          En(),
          hn && (hn.style.display = "flex"));
      }),
      a(vn, function () {
        mn && (mn.style.display = "none");
      }));
    const Sn = document.getElementById("mailRecipientSelected");
    (Sn &&
      a(Sn, function () {
        (En(), hn && (hn.style.display = "flex"));
      }),
      a(fn, function () {
        const t = gn ? gn.value.trim() : "";
        if (!In) return void alert("请先选择收件人~");
        if (!t) return void alert("请先写点什么~");
        const e = localStorage.getItem("akini_my_name") || "我",
          n = In,
          a = i("akini_mail_sent", []);
        const sentDate = new Date().toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
        (a.push({
          content: t,
          date: sentDate,
          from: e,
          to: n.name,
          toId: n.id,
        }),
          saveMailSent(a),
          gn && (gn.value = ""),
          mn && (mn.style.display = "none"),
          "sent" === kn && _n("sent"));
        const r = Dn();
        if (r) {
          const minD = parseFloat(
              localStorage.getItem("akini_num_mailDelayMin") || "1",
            ),
            maxD = parseFloat(
              localStorage.getItem("akini_num_mailDelayMax") || "3",
            ),
            delayMs = 60 * (minD + Math.random() * (maxD - minD) || 1) * 1e3;
          // syy envelope 模式：把回信预约时间持久化到 sent，
          // 即使离线/刷新，下次启动 checkMailStatus 也会按时投递回信
          const replyTime = Date.now() + delayMs;
          const sentArr = i("akini_mail_sent", []);
          for (var si = 0; si < sentArr.length; si++) {
            if (
              sentArr[si].date === sentDate &&
              sentArr[si].content === t &&
              !sentArr[si].replyTime
            ) {
              sentArr[si].replyTime = replyTime;
              sentArr[si].replyContent = r;
              sentArr[si].replyFromId = n.id;
              sentArr[si].replyFromName = n.name;
              sentArr[si].replyAvatar = n.avatar;
              saveMailSent(sentArr);
              break;
            }
          }
          // 应用保持打开时也立即检查一次，及时投递
          if (window.akiniMailEngine && window.akiniMailEngine.checkStatus) {
            window.akiniMailEngine.checkStatus();
          }
        }
      }));
    var An = 0;
    (pn &&
      (pn.addEventListener(
        "touchend",
        function (t) {
          (t && (t.preventDefault(), t.stopPropagation()),
            (An = Date.now()),
            yn && (yn.style.display = "none"));
        },
        { passive: !1 },
      ),
      pn.addEventListener("click", function (t) {
        (t && (t.preventDefault(), t.stopPropagation()),
          Date.now() - An < 500 || (yn && (yn.style.display = "none")));
      })),
      bn("sent"));
    var Cn = null,
      Bn = void 0;
    function Tn(t) {
      ((Bn = t),
        Cn && clearTimeout(Cn),
        (Cn = setTimeout(function () {
          ((Cn = null),
            (function (t) {
              window.__akiniSyncingAvatars = !0;
              const e =
                  (document.getElementById("inputMyName") || {}).value ||
                  localStorage.getItem("akini_my_name") ||
                  "我",
                __lsMy =
                  localStorage.getItem("akini_my_avatar") ||
                  localStorage.getItem("akini_icity_my_avatar") ||
                  "";
              var __myAv =
                t ||
                __lsMy ||
                (window.__akiniAvatarCache && window.__akiniAvatarCache.my) ||
                "";
              /* localStorage/缓存 均无头像时，尝试从 IDB 自愈恢复（配额溢出场景） */
              if (
                !t &&
                (!__myAv ||
                  !__myAv.trim() ||
                  "null" === __myAv.trim() ||
                  "undefined" === __myAv.trim() ||
                  "🐱" === __myAv.trim()) &&
                !window.__akiniAvatarRestoreTried
              ) {
                window.__akiniAvatarRestoreTried = !0;
                try {
                  "function" == typeof m &&
                    m("my", "akini_my_avatar", "akini_icity_my_avatar");
                } catch (e2) {}
                try {
                  "function" == typeof et && et();
                } catch (e2) {}
              }
              const n = it(__myAv, "🐱");
              var i = null;
              window.akiniContacts &&
                (i = window.akiniContacts.getChatTarget(
                  window.akiniContacts.getActiveChatId(),
                ));
              var a = i
                  ? i.name
                  : localStorage.getItem("akini_ta_name") || "哥哥",
                o = it(
                  i ? i.avatar : localStorage.getItem("akini_ta_avatar"),
                  "🐰",
                ),
                /* “我”的头像永远以 localStorage/缓存为准（左位固定是我），禁止被联系人头像覆盖 */
                r = { name: e, avatar: n },
                c = { name: a, avatar: o };
              if (window.akiniContacts) {
                var l = window.akiniContacts.getHomeAvatars(),
                  d = window.akiniContacts.getChatTarget(l.right);
                d && (c = { name: d.name, avatar: it(d.avatar, "🐰") });
              }
              var u = r,
                ta = c;
              var __homeSwapped = "function" == typeof window.isSwapped && window.isSwapped();
              const f = document.getElementById("callAvatar"),
                g = document.getElementById("callName");
              (!f ||
                (window._callState && window._callState.active) ||
                (f.innerHTML = o),
                !g ||
                  (window._callState && window._callState.active) ||
                  (g.textContent = a));
              const y = document.getElementById("inputTaName"),
                p = document.getElementById("inputMyName");
              (y && !y.dataset.userEdited && (y.value = a),
                p && !p.dataset.userEdited && (p.value = e));
              const v = document.getElementById("inputMyNameBeautify");
              v && !v.dataset.userEdited && (v.value = e);
              const h = document.getElementById("myAvatarPreviewBeautify");
              (h && (h.innerHTML = n),
                ["chatTaName"].forEach((t) => {
                  const e = document.getElementById(t);
                  e && (e.innerText = a);
                }));
              const w = document.getElementById("callAvatarFull"),
                k = document.getElementById("callNameFull");
              (!w ||
                (window._callState && window._callState.active) ||
                (w.innerHTML = o),
                !k ||
                  (window._callState && window._callState.active) ||
                  (k.textContent = a));
              const _ = document.getElementById("chatTaAvatar");
              _ && (_.innerHTML = o);
              const b = document.getElementById("avatarLeft"),
                I = document.getElementById("avatarRight");
              (b && setHtmlKeepInput(b, u.avatar),
                I && setHtmlKeepInput(I, ta.avatar));
              const mpL = document.getElementById("musicPlayerLeftAvatar"),
                mpR = document.getElementById("musicPlayerRightAvatar");
              (mpL && setHtmlKeepInput(mpL, u.avatar),
                mpR && setHtmlKeepInput(mpR, ta.avatar));
              const x = document.getElementById("bgAvatarDisplay");
              x && (x.innerHTML = n);
              const E = document.getElementById("friendsProfileName");
              E && (E.textContent = e);
              const S = document.getElementById("myMsgAvatar");
              S && (S.innerHTML = n);
              const A = document.getElementById("taMsgAvatar");
              A && (A.innerHTML = o);
              window.renderHomeAvatarPreviews &&
                window.renderHomeAvatarPreviews();
              const C = document.getElementById("chatBody");
              (C &&
                (C.querySelectorAll(".msg-row.me .msg-avatar").forEach(
                  function (t) {
                    t.innerHTML = n;
                  },
                ),
                (i && "group" === i.type) ||
                  C.querySelectorAll(".msg-row.other .msg-avatar").forEach(
                    function (t) {
                      t.innerHTML = o;
                    },
                  )),
                [
                  "icityMyAvatar2",
                  "icityMyAvatar3",
                  "icityEditMyAvatarPreview",
                ].forEach(function (t) {
                  var e = document.getElementById(t);
                  if (e) {
                    var i = e.querySelector('input[type="file"]');
                    (i && i.remove(),
                      0 === n.indexOf("<img")
                        ? (e.innerHTML = n)
                        : (e.textContent = n),
                      i && e.appendChild(i));
                  }
                }),
                ["icityTaAvatar3", "icityEditTaAvatarPreview"].forEach(
                  function (t) {
                    var e = document.getElementById(t);
                    if (e) {
                      var n = e.querySelector('input[type="file"]');
                      (n && n.remove(),
                        0 === o.indexOf("<img")
                          ? (e.innerHTML = o)
                          : (e.textContent = o),
                        n && e.appendChild(n));
                    }
                  },
                ),
                "function" == typeof window._renderIcity &&
                  window._renderIcity(),
                "function" == typeof window._renderPosts &&
                  window._renderPosts(),
                "function" == typeof window.renderIcityProfileDiaries &&
                  (window.renderIcityProfileDiaries(
                    "icityMyProfileDiaries",
                    "me",
                  ),
                  window.renderIcityProfileDiaries(
                    "icityTaProfileDiaries",
                    "ta",
                  )),
                "function" == typeof renderIcityContactSelector &&
                  renderIcityContactSelector(),
                "function" == typeof renderIcityContactProfiles &&
                  renderIcityContactProfiles(),
                "function" == typeof window.renderHomeAvatarContacts &&
                  window.renderHomeAvatarContacts(),
                "function" == typeof window.renderBeautifyContacts &&
                  window.renderBeautifyContacts(),
                xt(),
                "function" == typeof ot && ot(),
                "function" == typeof window._akiniApplyPreview &&
                  window._akiniApplyPreview());
              const B = document.getElementById("settingsMyAvatar");
              B && (B.innerHTML = n);
              const T = document.getElementById("settingsTaAvatar");
              (T && (T.innerHTML = o),
                "function" == typeof window.syncAvatars &&
                  window.syncAvatars(t),
                (window.__akiniSyncingAvatars = !1));
              if (window.__akiniAvatarNeedsRefresh) {
                window.__akiniAvatarNeedsRefresh = !1;
                Tn();
              }
            })(Bn),
            (Bn = void 0));
        }, 16)));
    }
    const Mn = document.getElementById("inputTaName"),
      Ln = document.getElementById("inputMyName");
    function Dn(count) {
      count = parseInt(count, 10);
      if (isNaN(count) || count < 1) count = Math.floor(Math.random() * 5) + 1;
      const raw = window.pickWordCards(count);
      if (!raw) return "";
      return raw
        .split("\n")
        .filter(function (s) {
          return s && s.trim();
        })
        .join(" ");
    }
    (Mn,
      Ln,
      Tn(),
      (function () {
        let t = 0,
          e = !1;
        function n(n) {
          const i = Date.now();
          if (i - t < 350) {
            if ((n.preventDefault(), e)) return;
            ((e = !0),
              setTimeout(function () {
                e = !1;
              }, 600));
            (!(function (t, e) {
              const n = document.createElement("div");
              ((n.className = "msg-row system"),
                (n.innerHTML = `<div class="bubble">${e}拍了拍${t}</div>`),
                U && (U.appendChild(n), (U.scrollTop = U.scrollHeight), S()),
                b());
            })(
              (document.getElementById("chatTaName") || {}).innerText || "对方",
              localStorage.getItem("akini_my_name") || "我",
            ),
              (t = 0));
          } else t = i;
        }
        ["chatTaAvatar", "chatTaName"].forEach(function (t) {
          const e = document.getElementById(t);
          e &&
            (e.addEventListener("touchend", n, { passive: !1 }),
            e.addEventListener("dblclick", n));
        });
      })(),
      (window.taPokeWithText = function (t, e, memberName) {
        if (!window.akiniContacts) return;
        t = t || window.akiniContacts.getActiveChatId();
        const n = window.akiniContacts.getChatTarget(t);
        if (!n) return;
        var a = memberName || n.name;
        const r =
          "<div class=bubble>" + (a + (e || "拍了拍你")) + "</div>";
        if (t === window.akiniContacts.getActiveChatId() && U) {
          __akiniAppendMessageHTML(t, '<div class="msg-row system">' + r + "</div>", {
            lastMsg: a + (e || "拍了拍你"),
            lastSenderAvatar: n.avatar,
            lastSenderName: n.name,
          });
          S();
        } else {
          var c = window.akiniContacts.getSession(t),
            l =
              (c.messagesHTML || "") +
              '<div class="msg-row system">' +
              r +
              "</div>",
            s = (c.unread || 0) + 1;
          window.akiniContacts.updateSession(t, {
            messagesHTML: l,
            lastMsg: a + (e || "拍了拍你"),
            lastTime: Date.now(),
            unread: s,
            lastSenderAvatar: n.avatar,
            lastSenderName: n.name,
          });
        }
        V();
        const d = nt(n.avatar, 38);
        if ("function" == typeof window.showInAppNotif) {
          var u = {
            app: "微信",
            appIcon: "💬",
            avatar: d,
            name: a,
            msg: a + (e || "拍了拍你"),
            chatId: t,
            onTap: function () {
              ct(t);
            },
          };
          ("group" === n.type && (u.groupName = n.name),
            window.showInAppNotif(u));
        }
        b(t);
      }),
      (window.taPoke = function (t) {
        if (!window.akiniContacts) return;
        t = t || window.akiniContacts.getActiveChatId();
        const e = window.akiniContacts.getChatTarget(t);
        if (!e) return;
        var n = e;
        if ("group" === e.type) {
          var a = e.memberIds || [];
          if (a.length > 0) {
            var o = a[Math.floor(Math.random() * a.length)],
              r = window.akiniContacts.getChatTarget(o);
            r && (n = r);
          }
        }
        const c = n.name;
        try {
          const a = i("akini_wordbank", []).filter(
              (t) => "pat" === t.tab || "pat" === t.type,
            ),
            o =
              a.length > 0
                ? a[Math.floor(Math.random() * a.length)]
                : { text: "拍了拍你" },
            r = c + " " + (o.text || o.content || "拍了拍你"),
            m = `<div class="bubble">${r}</div>`;
          if (t === window.akiniContacts.getActiveChatId() && U) {
            const __chatId = t,
              __row = document.createElement("div");
            ((__row.className = "msg-row system"),
              (__row.innerHTML = m),
              U.appendChild(__row),
              (U.scrollTop = U.scrollHeight),
              S());
            var __fullHTML = (window.akiniContacts.getSession(__chatId).messagesHTML || "") + __row.outerHTML;
            window.akiniContacts.updateSession(__chatId, {
              messagesHTML: __fullHTML,
              lastMsg: r,
              lastTime: Date.now(),
              lastSenderAvatar: n.avatar,
              lastSenderName: n.name,
            });
          } else {
            var l = window.akiniContacts.getSession(t),
              s =
                (l.messagesHTML || "") +
                '<div class="msg-row system">' +
                m +
                "</div>",
              d = (l.unread || 0) + 1;
            window.akiniContacts.updateSession(t, {
              messagesHTML: s,
              lastMsg: r,
              lastTime: Date.now(),
              unread: d,
              lastSenderAvatar: n.avatar,
              lastSenderName: n.name,
            });
          }
          V();
          const f = nt(n.avatar, 38);
          if ("function" == typeof window.showInAppNotif) {
            var u = {
              app: "微信",
              appIcon: "💬",
              avatar: f,
              name: c,
              msg: r,
              chatId: t,
              onTap: function () {
                ct(t);
              },
            };
            ("group" === e.type && (u.groupName = e.name),
              window.showInAppNotif(u),
              b(t));
          }
        } catch (t) {}
      }),
      (function () {
        function t(t) {
          ((t = t || "pink"),
            document.body.classList.remove(
              "bubble-gray",
              "bubble-pink",
              "bubble-blue",
              "bubble-green",
              "bubble-black",
            ),
            document.body.classList.add("bubble-" + t),
            localStorage.setItem("akini_bubble_color", t),
            document
              .querySelectorAll(".bubble-color-option")
              .forEach(function (e) {
                e.classList.toggle("active", e.dataset.color === t);
              }));
        }
        (document
          .querySelectorAll(".bubble-color-option")
          .forEach(function (e) {
            e.addEventListener("click", function (ev) {
              if (ev) {
                ev.stopPropagation();
                ev.preventDefault();
              }
              t(this.dataset.color);
              window.__akiniBubbleJustChanged = true;
              setTimeout(function () {
                window.__akiniBubbleJustChanged = false;
              }, 1000);
            });
          }),
          t(localStorage.getItem("akini_bubble_color")));
        const e = document.getElementById("inputSignature");
        function n(t) {
          ([
            "desktopSignature",
            "homeSignature",
            "mainSignature",
            "subtitleText",
          ].forEach((e) => {
            const n = document.getElementById(e);
            n && (n.innerText = t);
          }),
            localStorage.setItem("akini_signature", t));
        }
        if (e) {
          e.addEventListener("input", function () {
            n(this.value);
          });
          const t = localStorage.getItem("akini_signature");
          t && ((e.value = t), n(t));
        }
        const i = document.getElementById("inputFriendsSignature");
        function a(t) {
          const e = document.getElementById("friendsProfileSignature");
          (e && (e.innerText = t),
            localStorage.setItem("akini_friends_signature", t));
        }
        if (i) {
          i.addEventListener("input", function () {
            a(this.value);
          });
          const t = localStorage.getItem("akini_friends_signature");
          t && ((i.value = t), a(t));
        }
        const o = document.getElementById("inputDayLabelBeautify");
        function r(t) {
          const e = document.getElementById("dayLabel");
          (e && (e.innerText = t), localStorage.setItem("akini_day_label", t));
        }
        if (o) {
          o.addEventListener("input", function () {
            r(this.value);
          });
          const t = localStorage.getItem("akini_day_label");
          t && ((o.value = t), r(t));
        }
        const c = document.getElementById("inputStartDateBeautify");
        function l(t) {
          if (!t) return;
          const e = new Date(t),
            n = new Date(),
            i = Math.floor((n - e) / 864e5),
            a = document.getElementById("dayNumber");
          (a && (a.innerText = i >= 0 ? i : 0),
            localStorage.setItem("akini_start_date", t));
        }
        if (c) {
          c.addEventListener("input", function () {
            l(this.value);
          });
          const t = localStorage.getItem("akini_start_date");
          t && ((c.value = t), l(t));
        }
        const s = document.getElementById("fileInputHomeBg");
        s &&
          (s.addEventListener("change", function () {
            const t = this.files[0];
            if (!t) return;
            const e = new FileReader();
            ((e.onload = function (t) {
              const e = document.getElementById("phoneFrame");
              (e &&
                ((e.style.backgroundImage = `url(${t.target.result})`),
                (e.style.backgroundSize = "cover"),
                (e.style.backgroundPosition = "center"),
                (e.style.backgroundRepeat = "no-repeat"),
                e.classList.add("has-custom-bg")),
                L("akini_home_bg", t.target.result));
            }),
              e.readAsDataURL(t));
          }),
          D("akini_home_bg", function (t) {
            if (t) {
              const e = document.getElementById("phoneFrame");
              e &&
                ((e.style.backgroundImage = `url(${t})`),
                (e.style.backgroundSize = "cover"),
                (e.style.backgroundPosition = "center"),
                (e.style.backgroundRepeat = "no-repeat"),
                e.classList.add("has-custom-bg"));
            }
          }));
        const d = document.getElementById("fileInputMusicBg");
        d &&
          (d.addEventListener("change", function () {
            const t = this.files[0];
            if (!t) return;
            const e = new FileReader();
            ((e.onload = function (t) {
              L("akini_music_bg", t.target.result);
              const e = document.getElementById("musicBgLayer");
              e &&
                ((e.style.backgroundImage = `url(${t.target.result})`),
                (e.style.backgroundSize = "cover"),
                (e.style.backgroundPosition = "center"),
                (e.style.backgroundRepeat = "no-repeat"),
                (e.style.display = "block"));
            }),
              e.readAsDataURL(t),
              (this.value = ""));
          }),
          D("akini_music_bg", function (t) {
            if (t) {
              const e = document.getElementById("musicBgLayer");
              e &&
                ((e.style.backgroundImage = `url(${t})`),
                (e.style.backgroundSize = "cover"),
                (e.style.backgroundPosition = "center"),
                (e.style.backgroundRepeat = "no-repeat"),
                (e.style.display = "block"));
            }
          }));
        const u = document.getElementById("fileInputDayBgBeautify");
        u &&
          u.addEventListener("change", function () {
            const t = this.files[0];
            if (!t) return;
            const e = new FileReader();
            ((e.onload = function (t) {
              const e = t.target.result,
                n = document.getElementById("bgArea");
              (n &&
                ((n.style.backgroundImage = `url(${e})`),
                (n.style.backgroundSize = "cover"),
                (n.style.backgroundPosition = "center")),
                L("akini_bg_img", e));
            }),
              e.readAsDataURL(t),
              (this.value = ""));
          });
        const cv = document.getElementById("fileInputCoverBg");
        cv &&
          cv.addEventListener("change", function () {
            const t = this.files[0];
            if (!t) return;
            const e = new FileReader();
            ((e.onload = function (t) {
              const e = t.target.result,
                n = document.getElementById("coverAreaMain");
              (n &&
                ((n.style.backgroundImage = `url(${e})`),
                (n.style.backgroundSize = "cover"),
                (n.style.backgroundPosition = "center"),
                (n.textContent = "")),
                L("akini_cover_img", e));
            }),
              e.readAsDataURL(t),
              (this.value = ""));
          });
        const fb = document.getElementById("fileInputFriendsBgBeautify");
        fb &&
          fb.addEventListener("change", function () {
            const t = this.files[0];
            if (!t) return;
            const e = new FileReader();
            ((e.onload = function (t) {
              const e = t.target.result,
                n = document.getElementById("friendsHeader");
              (n &&
                ((n.style.backgroundImage = `url(${e})`),
                (n.style.backgroundSize = "cover"),
                (n.style.backgroundPosition = "center")),
                L("akini_friends_bg", e));
            }),
              e.readAsDataURL(t),
              (this.value = ""));
          });
      })(),
      (window.pickWordCards = function (t) {
        var e = i("akini_wordbank", []).filter(function (t) {
          var e = (t.tab || "").toLowerCase(),
            n = (t.type || "").toLowerCase();
          return "pat" !== e && "pat" !== n;
        });
        if (!e.length) {
          var def = [
            "今天天气真好，心情不错~",
            "刚看完一部超好看的电影！",
            "周末去了一家很棒的咖啡馆",
            "最近在学做饭，感觉还不错",
            "今天工作好忙啊，终于结束了",
            "晚安，做个好梦🌙",
            "刚跑完步，感觉整个人都轻松了",
            "今天的晚霞太美了！",
          ];
          return def[Math.floor(Math.random() * def.length)];
        }
        var n = e.slice().sort(function () {
            return Math.random() - 0.5;
          }),
          a = Math.min(t, n.length);
        return n
          .slice(0, a)
          .map(function (t) {
            return t.text || t.content || "";
          })
          .filter(Boolean)
          .join("\n");
      }),
      (function () {
        if (
          "1" === localStorage.getItem("akini_toggle_darkModeToggle") &&
          false
        ) {
          document.body.classList.add("dark-mode");
          const t = document.getElementById("darkModeToggle");
          t && t.classList.add("on");
        }
        let t = null,
          e = "",
          n = 0,
          a = Date.now() + 3e3;
        function r() {
          if (!window.akiniContacts) return null;
          var t = window.akiniContacts.getContacts();
          return 0 === t.length
            ? null
            : t[Math.floor(Math.random() * t.length)];
        }
        // 联系人发朋友圈/iCity/信件的内容只能从用户字卡库取，绝无兜底内容
        function c(t) {
          var e = i("akini_wordbank", []).filter(function (t) {
            var e = (t.tab || "").toLowerCase(),
              n = (t.type || "").toLowerCase();
            return "pat" !== e && "pat" !== n;
          });
          if (0 === e.length) return "";
          var n = e.slice().sort(function () {
              return Math.random() - 0.5;
            }),
            a = Math.min(t, n.length);
          return n
            .slice(0, a)
            .map(function (t) {
              return t.text || t.content || "";
            })
            .filter(Boolean)
            .join("\n");
        }
        (document.addEventListener("visibilitychange", function () {}),
          (window.showInAppNotif = function (i) {
            var mp = document.getElementById("msgPopupToggle");
            if (mp && !mp.classList.contains("on")) return;
            if (
              i.app === "网易云" &&
              (function () {
                var m = document.getElementById("app-music");
                return m && m.style.display !== "none";
              })()
            )
              return;
            var r = document.getElementById("inAppNotifBanner");
            if (!r) {
              r = document.createElement("div");
              r.id = "inAppNotifBanner";
              r.style.cssText =
                "display:none;position:fixed;top:12px;left:50%;transform:translateX(-50%);width:auto;max-width:min(360px,92vw);z-index:999999999;cursor:pointer;";
              r.innerHTML =
                '<div class=notif-inner id=notifInner><div class=notif-body style="display:flex;align-items:center;gap:12px;"><div class=notif-avatar id=notifAvatar></div><div class=notif-text style="flex:1;min-width:0;"><div class=notif-top-row><div class=notif-name id=notifName></div><div class=notif-time id=notifTime>刚刚</div></div><div class=notif-msg id=notifMsg></div></div></div></div>';
              document.body.appendChild(r);
            }
            if (
              i.chatId &&
              window.akiniContacts &&
              i.chatId === window.akiniContacts.getActiveChatId() &&
              (function () {
                var c = document.getElementById("app-chat");
                return c && c.style.display !== "none";
              })()
            )
              return;
            r.parentNode !== document.body && document.body.appendChild(r);
            const y = document.getElementById("notifName"),
              p = document.getElementById("notifMsg"),
              h = document.getElementById("notifInner"),
              tm = document.getElementById("notifTime"),
              w = i.app || "微信";
            y && (y.textContent = i.name ? w + " · " + i.name : w);
            let k = (i.msg || "").trim();
            const _ = !1 !== i.fullContent;
            (p && ((p.textContent = k), p.classList.toggle("full", _)),
              h && h.classList.toggle("full", _));
            if (tm) {
              var n = Date.now(),
                diff = Math.floor((n - (i.ts || n)) / 1e3);
              tm.textContent =
                diff < 60
                  ? "刚刚"
                  : diff < 3600
                    ? Math.floor(diff / 60) + "分钟前"
                    : diff < 86400
                      ? Math.floor(diff / 3600) + "小时前"
                      : Math.floor(diff / 86400) + "天前";
            }
            var ava = document.getElementById("notifAvatar");
            if (ava) {
              var nameInitial = "";
              try {
                nameInitial = ((i.name || "").trim() || "🐰").charAt(0);
              } catch (e) {
                nameInitial = "🐰";
              }
              var ic = (i.avatar || i.appIcon || nameInitial) + "";
              if (!ic || ic === "null" || ic === "undefined") {
                ic = nameInitial || "🐰";
              }
              if (!ic || ic === "🐰") {
                try {
                  var _ct = i.chatId;
                  if (_ct && window.akiniContacts) {
                    var _targ = window.akiniContacts.getChatTarget(_ct);
                    if (
                      _targ &&
                      _targ.avatar &&
                      String(_targ.avatar).trim() &&
                      String(_targ.avatar).trim() !== "null" &&
                      String(_targ.avatar).trim() !== "undefined"
                    )
                      ic = String(_targ.avatar).trim();
                    else ic = "🐰";
                  }
                } catch (e) {}
              }
              if (ic.indexOf("<img") === 0) {
                var _m = ic.match(/src="([^"]*)"/);
                ic = _m && _m[1] ? _m[1] : ic;
              } else if (ic.indexOf("<span") === 0) {
                var _sm = ic.match(/>([^<]*)</);
                ic = _sm && _sm[1] ? _sm[1].trim() : ic;
              }
              if (typeof window.renderAvatarHtml === "function") {
                ava.innerHTML = window.renderAvatarHtml(ic, 40);
                var _img = ava.querySelector("img");
                if (_img) {
                  _img.onerror = function () {
                    _img.style.display = "none";
                    ava.innerHTML =
                      '<span style="font-size:20px;display:flex;align-items:center;justify-content:center;width:100%;height:100%;">' +
                      (nameInitial || "🐰") +
                      "</span>";
                  };
                }
              } else if (/^https?:\/\//.test(ic) || /^data:image\//.test(ic)) {
                ava.innerHTML =
                  '<img src="' +
                  ic.replace(/"/g, "&quot;") +
                  '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;">';
              } else {
                ava.innerHTML =
                  '<span style="font-size:20px;display:flex;align-items:center;justify-content:center;width:100%;height:100%;">' +
                  ic +
                  "</span>";
              }
            }
            ((r.style.display = "block"),
              (r.style.animation = "none"),
              r.offsetWidth,
              (r.style.animation =
                "notifSlideDown 0.35s cubic-bezier(0.34,1.56,0.64,1)"),
              clearTimeout(t),
              (t = setTimeout(function () {
                r.style.display = "none";
              }, 5e3)),
              (r.ontouchstart = function (e) {
                var sy = e.touches[0].clientY;
                ((r.dataset.startY = String(sy)), (r.dataset.swiping = "1"));
              }),
              (r.ontouchmove = function (e) {
                if ("1" !== r.dataset.swiping) return;
                var sy = parseFloat(r.dataset.startY || "0"),
                  cy = e.touches[0].clientY,
                  diff = cy - sy;
                if (diff < 0) {
                  r.style.transform =
                    "translateX(-50%) translateY(" + diff + "px)";
                  r.style.transition = "none";
                }
                e.preventDefault();
              }),
              (r.ontouchend = function (e) {
                if ("1" !== r.dataset.swiping) return;
                r.dataset.swiping = "0";
                r.style.transition = "transform .2s ease";
                var sy = parseFloat(r.dataset.startY || "0"),
                  cy = e.changedTouches[0].clientY,
                  diff = cy - sy;
                if (diff < -60) {
                  r.style.transform = "translateX(-50%) translateY(-200px)";
                  setTimeout(function () {
                    r.style.display = "none";
                    r.style.transform = "";
                  }, 200);
                } else {
                  r.style.transform = "translateX(-50%)";
                }
              }),
              (r.onclick = function () {
                r.style.display = "none";
                try {
                  S();
                } catch (t) {}
                if (i.onTap)
                  try {
                    i.onTap();
                  } catch (t) {
                    console.error("通知点击回调失败", t);
                  }
              }));
          }),
          (window.__akiniLastActive = Date.now()));
        ["pointerdown", "click", "touchstart", "keydown", "scroll"].forEach(
          function (ev) {
            document.addEventListener(
              ev,
              function () {
                window.__akiniLastActive = Date.now();
              },
              { passive: !0 },
            );
          },
        );
        document.addEventListener("visibilitychange", function () {
          document.hidden || (window.__akiniLastActive = Date.now());
        });
        window.AKR.isUserPresent = function () {
          return Date.now() - (window.__akiniLastActive || 0) < 6e5;
        };
        window.AKR.isAppActive = function () {
          return !document.hidden;
        };
        ((window._pickWordCardsForFriends = c),
          (function t(isFirst) {
            const e = parseFloat(
                localStorage.getItem("akini_num_friendsPostMin") || "30",
              ),
              n = parseFloat(
                localStorage.getItem("akini_num_friendsPostMax") || "60",
              );
            // 首次触发使用最小间隔，之后按随机范围
            var delay = isFirst ? e : (e + Math.random() * Math.max(0, n - e));
            var i = 60 * delay * 1e3;
            console.log("[Akini 朋友圈] 下次调度：", delay.toFixed(1), "分钟后触发");
            function friendsPostAction() {
              // 防止短时间内多次发朋友圈
              var _minGap = Math.max(1, e) * 60 * 1000 * 0.8;
              var _lastRun = parseFloat(localStorage.getItem("akini_last_friendsPost_run") || "0");
              if (_lastRun > 0 && Date.now() - _lastRun < _minGap) {
                console.log("[Akini 朋友圈] 距上次执行太近，跳过本次，间隔不足", e.toFixed(1), "分钟");
                t(false); return;
              }
              localStorage.setItem("akini_last_friendsPost_run", String(Date.now()));
              if (!window.AKR.isInTimeRange("friends")) {
                t(false);
                return;
              }
              if ("1" !== localStorage.getItem("akini_toggle_contactFriendsToggle")) {
                t(false);
                return;
              }
              const e = r();
              if (!e) return void t(false);
              const n = e.name,
                i = nt(e.avatar, 40),
                a = c(Math.floor(Math.random() * 5) + 1);
              if (a) {
                var l = O();
                var post = {
                  author: n,
                  authorId: e.id,
                  text: a,
                  date: __akiniFormatDateTime(new Date()),
                  ts: Date.now(),
                  likes: [],
                  comments: [],
                };
                // 联系人发朋友圈时，8% 概率附带用户给该联系人添加的表情包
                if (Math.random() < 0.08) {
                  var stickers = window.getContactStickersSync
                    ? window.getContactStickersSync(e.id)
                    : [];
                  if (stickers.length > 0) {
                    post.img = stickers[Math.floor(Math.random() * stickers.length)];
                  }
                  // 无表情包则不带图，绝不私自添加任何图片
                }
                (l.unshift(post),
                  R(l),
                  window._renderPosts && window._renderPosts(),
                  window.showInAppNotif({
                    app: "朋友圈",
                    avatar: i,
                    name: n,
                    fullContent: !0,
                    msg: post.img ? "[图片]" : a,
                    onTap: function () {
                      o("friends");
                    },
                  }),
                  t(false));
              } else t(false);
            }
            window._akiniFriendsPostAction = friendsPostAction;
            window._akiniRescheduleFriendsPost = function () { t(false); };
            window._akiniTimer.schedule("friendsPost", friendsPostAction, i);
          })(true),
          (function t() {
            /* 互动检查间隔：按消息回复延迟配置，确保联系人在设定时间后互动 */
            function getFriendsReplyDelayMs() {
              var min = parseFloat(localStorage.getItem("akini_num_replyDelayMin") || "2");
              var max = parseFloat(localStorage.getItem("akini_num_replyDelayMax") || "5");
              if (isNaN(min)) min = 2;
              if (isNaN(max) || max < min) max = min;
              return Math.floor(1e3 * (min + Math.random() * Math.max(0, max - min)));
            }
            var e = getFriendsReplyDelayMs();
            function friendsInteractAction() {
              if ("1" !== localStorage.getItem("akini_toggle_contactFriendsToggle")) {
                t();
                return;
              }
              const n = r().name,
                i = nt(r().avatar, 40),
                a = localStorage.getItem("akini_my_name") || "我",
                myId = r().id;
              let l = O();
              var now = Date.now(),
                replyMin = parseFloat(localStorage.getItem("akini_num_replyDelayMin") || "2"),
                replyMax = parseFloat(localStorage.getItem("akini_num_replyDelayMax") || "5");
              isNaN(replyMin) && (replyMin = 2);
              (isNaN(replyMax) || replyMax < replyMin) && (replyMax = replyMin);
              var replyDelayMs = 1e3 * (replyMin + Math.random() * Math.max(0, replyMax - replyMin));
              var s = !1,
                d = window._pendingFriendsReplies || [];
              if (d.length > 0) {
                var t = d.shift();
                var e = l.find(function (e) {
                  return e.ts === t.ts;
                });
                if (e && now - (e.ts || 0) >= replyDelayMs) {
                  var r = (e.comments || [])
                    .slice()
                    .reverse()
                    .find(function (t) {
                      return t.author === n;
                    });
                  if (r) {
                    var c = (e.comments || []).indexOf(r);
                    if (
                      !(e.comments || []).some(function (t, e) {
                        return t.author === a && t.replyTo === n && e > c;
                      })
                    ) {
                      d.unshift(t);
                    } else {
                      ((e.comments = e.comments || []),
                        e.comments.push({
                          id: "c_" + Math.random().toString(36).slice(2) + "_" + Date.now(),
                          author: n,
                          text: t.text,
                          replyTo: t.replyTo || a,
                          ts: Date.now(),
                        }),
                        (s = !0));
                      var dmsg = t.replyTo
                        ? "回复了你的评论：" + t.text.slice(0, 20)
                        : "评论了你的动态：" + t.text.slice(0, 20);
                      window.showInAppNotif({
                        app: "朋友圈",
                        avatar: i,
                        name: n,
                        fullContent: !0,
                        msg: dmsg,
                        onTap: function () {
                          o("friends");
                        },
                      });
                    }
                  } else {
                    ((e.comments = e.comments || []),
                      e.comments.push({
                        id: "c_" + Math.random().toString(36).slice(2) + "_" + Date.now(),
                        author: n,
                        text: t.text,
                        replyTo: t.replyTo || a,
                        ts: Date.now(),
                      }),
                      (s = !0));
                    var dmsg = t.replyTo
                      ? "回复了你的评论：" + t.text.slice(0, 20)
                      : "评论了你的动态：" + t.text.slice(0, 20);
                    window.showInAppNotif({
                      app: "朋友圈",
                      avatar: i,
                      name: n,
                      fullContent: !0,
                      msg: dmsg,
                      onTap: function () {
                        o("friends");
                      },
                    });
                  }
                } else if (e && now - (e.ts || 0) < replyDelayMs) {
                  // 还未到消息回复延迟时间，先把该回复放回队列前端，下次再处理
                  d.unshift(t);
                }
                if (s) {
                  R(l);
                  window._renderPosts && window._renderPosts();
                }
                window._akiniTimer.schedule(
                  "friendsInteract",
                  friendsInteractAction,
                  replyDelayMs,
                );
                return;
              }

              // 用户自己的动态由 akini-moments-engine.js 统一处理（100% 全联系人点赞/评论）
              // 此处只保留联系人自己的动态回复逻辑
              const userPosts = [];
              var likeCandidates = [],
                replyOnUserPosts = [],
                initCommentOnUserPosts = [];

              // 2. 联系人自己的动态：用户评论后，联系人在消息回复延迟后回复；用户未评论则绝对不主动评论
              const contactPosts = l.filter(function (t) {
                if (!t.authorId) return !1;
                if (t.authorId !== myId) return !1;
                var postTs = t.ts || 0;
                var age = now - postTs;
                return age >= replyDelayMs && age <= replyDelayMs + 60 * 1e3;
              });
              var replyOnContactPosts = contactPosts.filter(function (t) {
                var userComments = (t.comments || []).filter(function (c) {
                  return c.author === a;
                });
                if (userComments.length === 0) return !1;
                var lastContactComment = (t.comments || [])
                  .slice()
                  .reverse()
                  .find(function (c) {
                    return c.author === n;
                  });
                if (!lastContactComment) return !0;
                var lastContactIdx = (t.comments || []).indexOf(lastContactComment);
                return (t.comments || []).some(function (c, idx) {
                  return c.author === a && idx > lastContactIdx;
                });
              });

              // 点赞用户动态已由朋友圈引擎处理，此处跳过
              // 评论用户动态已由朋友圈引擎处理，此处跳过

              // 回复用户在自己动态下的评论（必须由用户触发，不能自己继续）
              if (replyOnContactPosts.length > 0) {
                var y = c(1);
                if (y) {
                  var p = replyOnContactPosts[Math.floor(Math.random() * replyOnContactPosts.length)],
                    v = l.indexOf(p);
                  if (v >= 0) {
                    l[v].comments = l[v].comments || [];
                    l[v].comments.push({
                      id: "c_" + Math.random().toString(36).slice(2) + "_" + Date.now(),
                      author: n,
                      text: y,
                      replyTo: a,
                      ts: Date.now(),
                    });
                    s = !0;
                    window.showInAppNotif({
                      app: "朋友圈",
                      avatar: i,
                      name: n,
                      fullContent: !0,
                      msg: "回复了你的评论：" + y,
                      onTap: function () {
                        o("friends");
                      },
                    });
                  }
                }
              }

              (s && (R(l), window._renderPosts && window._renderPosts()), t());
            }
            window._akiniFriendsInteractAction = friendsInteractAction;
            window._akiniTimer.schedule(
              "friendsInteract",
              friendsInteractAction,
              e,
            );
          })());
        ((function () {
          function t(t, e) {
            if (!t) return !1;
            try {
              var n = JSON.parse(t);
              if (Array.isArray(n) && n.length > 0) {
                try {
                  localStorage.setItem(e, t);
                } catch (t) {}
                return !0;
              }
            } catch (t) {}
            return !1;
          }
          var e = localStorage.getItem("akini_mail_sent"),
            n = localStorage.getItem("akini_mail_received");
          (e ||
            _idbStore.get("akini_mail_sent", function (e) {
              t(e, "akini_mail_sent") ||
                _idbStore.get("akini_mail_sent_backup", function (e) {
                  t(e, "akini_mail_sent");
                });
            }),
            n ||
              _idbStore.get("akini_mail_received", function (e) {
                t(e, "akini_mail_received") ||
                  _idbStore.get("akini_mail_received_backup", function (e) {
                    t(e, "akini_mail_received");
                  });
              }));
        })(),
          (function t(isFirst) {
            const e = window.akiniContacts
                ? window.akiniContacts.getContacts()
                : [],
              n = JSON.parse(localStorage.getItem("akini_mail_sent") || "[]"),
              a = JSON.parse(
                localStorage.getItem("akini_mail_received") || "[]",
              ),
              r = n.filter(function (t) {
                return !t.repliedByTa;
              }),
              l = r.length > 0;
            var s, d, u;
            (l
              ? ((s = parseFloat(
                  localStorage.getItem("akini_num_mailDelayMin") || "1",
                )),
                (d = parseFloat(
                  localStorage.getItem("akini_num_mailDelayMax") || "3",
                )),
                (u = !1))
              : ((s = parseFloat(
                  localStorage.getItem("akini_num_activeMailMin") || "3",
                )),
                (d = parseFloat(
                  localStorage.getItem("akini_num_activeMailMax") || "6",
                )),
                (u = !0)),
              (isNaN(s) || s <= 0) && (s = 1),
              (isNaN(d) || d < s) && (d = s));
            // 首次触发使用最小间隔，之后按随机范围；便于用户验证设置已生效
            var delay = isFirst ? s : (s + Math.random() * (d - s));
            var m = delay * 3600 * 1000;
            console.log("[Akini 信箱] 下次调度：", (u ? "主动写信" : "回信"), delay.toFixed(1), "小时后触发");
            function mailAction() {
              // 防止短时间内多次执行：距上次实际执行不足最小间隔则跳过
              var _minGap = s * 3600 * 1000 * 0.9;
              var _lastRun = parseFloat(localStorage.getItem("akini_last_mail_run") || "0");
              if (_lastRun > 0 && Date.now() - _lastRun < _minGap) {
                console.log("[Akini 信箱] 距上次执行太近，跳过本次，间隔不足", s.toFixed(1), "小时");
                t(false); return;
              }
              localStorage.setItem("akini_last_mail_run", String(Date.now()));
              // 主动写信/回信必须重新调度，无论本次是否执行成功
              var __willRecurse = true;
              function __recurse() {
                if (!__willRecurse) return;
                __willRecurse = !1;
                t(false);
              }
              if (!window.AKR.isInTimeRange("mail")) {
                return __recurse();
              }
              if ("1" !== localStorage.getItem("akini_toggle_contactMailToggle")) {
                return __recurse();
              }
              // 每次执行时实时读取联系人，避免闭包捕获到空列表导致永远不写信
              const liveContacts = window.akiniContacts
                ? window.akiniContacts.getContacts()
                : e;
              const wc = c(Math.floor(Math.random() * 8) + 8);
              if (!wc) return __recurse();
              var s = "",
                d = null;
              if (l) {
                var u = r[r.length - 1];
                var freshSent = JSON.parse(
                  localStorage.getItem("akini_mail_sent") || "[]",
                );
                var freshItem = null;
                for (var fi = 0; fi < freshSent.length; fi++) {
                  if (
                    freshSent[fi].date === u.date &&
                    freshSent[fi].content === u.content
                  ) {
                    freshItem = freshSent[fi];
                    break;
                  }
                }
                if (freshItem) {
                  freshItem.repliedByTa = !0;
                }
                ((s = u.content || ""),
                  saveMailSent(freshSent),
                  (d =
                    liveContacts.find(function (t) {
                      return t.id === u.toId;
                    }) ||
                    liveContacts[0] ||
                    null));
              } else
                d = liveContacts.length ? liveContacts[Math.floor(Math.random() * liveContacts.length)] : null;
              if (!d) return __recurse();
              var freshRecv = JSON.parse(
                localStorage.getItem("akini_mail_received") || "[]",
              );
              (freshRecv.push({
                content: wc,
                originalContent: s,
                date: new Date().toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }),
                from: d.name,
                fromId: d.id,
                subtype: l ? "reply" : "active",
              }),
                saveMailReceived(freshRecv));
              const m = nt(d.avatar, 40);
              (window.showInAppNotif({
                app: "信箱",
                avatar: m,
                name: d.name,
                msg: d.name + (l ? "回复了你的信件" : "给你寄来了一封信"),
                onTap: function () {
                  o("mail");
                },
              }),
                __recurse());
            }
            window._akiniMailAction = mailAction;
            window._akiniRescheduleMail = function () { t(false); };
            window._akiniTimer.schedule("mail", mailAction, m);
          })(true));
      })());
    ((function () {
      // 版本迁移：20260913 修复评论去重/回复延迟/聊天背景/字卡兜底
      (function () {
        try {
          var ver = localStorage.getItem("akini_app_version");
          if (ver !== "20260913") {
            localStorage.setItem("akini_app_version", "20260913");
            // 不再删除用户显式设置过的开关（readReceiptToggle/timestampToggle 等），避免刷新后消失
            localStorage.removeItem("akini_toggle_contactPokeToggle");
            localStorage.removeItem("akini_toggle_contactFriendsToggle");
            localStorage.removeItem("akini_toggle_contactIcityToggle");
            localStorage.removeItem("akini_toggle_contactMailToggle");
            // emoji 融入消息默认关闭（旧版本误设为开启则重置）
            localStorage.setItem("akini_toggle_emojiMixToggle", "0");
            // 朋友圈/iCity 默认改为 30-60 分钟；任何一项异常（<=3、>=1000、乱填、min>max）都重置为新默认
            var _resetPostRange = function (minKey, maxKey) {
              var mn = parseFloat(localStorage.getItem(minKey) || "");
              var mx = parseFloat(localStorage.getItem(maxKey) || "");
              if (
                isNaN(mn) || isNaN(mx) ||
                mn <= 3 || mx <= 3 ||
                mn >= 1000 || mx >= 1000 ||
                mn > mx
              ) {
                localStorage.setItem(minKey, "30");
                localStorage.setItem(maxKey, "60");
              }
            };
            _resetPostRange(
              "akini_num_friendsPostMin",
              "akini_num_friendsPostMax",
            );
            _resetPostRange("akini_num_icityPostMin", "akini_num_icityPostMax");
            // 主动写信默认改为 3-6 小时，任何异常都重置为 3-6
            var _resetActiveMailRange = function (minKey, maxKey) {
              var mn = parseFloat(localStorage.getItem(minKey) || "");
              var mx = parseFloat(localStorage.getItem(maxKey) || "");
              if (
                isNaN(mn) || isNaN(mx) ||
                mn <= 0 || mx <= 0 ||
                mn >= 1000 || mx >= 1000 ||
                mn > mx
              ) {
                localStorage.setItem(minKey, "3");
                localStorage.setItem(maxKey, "6");
              }
            };
            _resetActiveMailRange("akini_num_activeMailMin", "akini_num_activeMailMax");
            // 主动发消息默认改为 3-6 小时；旧版本均为分钟单位，统一按小时重置
            var _resetActiveMsgRange = function (minKey, maxKey) {
              var mn = parseFloat(localStorage.getItem(minKey) || "");
              var mx = parseFloat(localStorage.getItem(maxKey) || "");
              // 只要存在旧值（无论 3/10 分钟还是 180/360 分钟），都重置为 3-6 小时
              if (!isNaN(mn) || !isNaN(mx)) {
                localStorage.setItem(minKey, "3");
                localStorage.setItem(maxKey, "6");
                return;
              }
              localStorage.setItem(minKey, "3");
              localStorage.setItem(maxKey, "6");
            };
            _resetActiveMsgRange("akini_num_activeMsgMin", "akini_num_activeMsgMax");
            // 主动写信/发消息 之前按“分钟”单位存储，现在改为按“小时”读取，需要把旧值除以 60。
            // 朋友圈/iCity 本来就是按“分钟”读取，不参与此次转换，避免 30 分钟被误转成 1 分钟。
            [
              "akini_num_activeMailMin",
              "akini_num_activeMailMax",
              "akini_num_activeMsgMin",
              "akini_num_activeMsgMax",
            ].forEach(function (k) {
              var v = localStorage.getItem(k);
              if (v) {
                var fv = parseFloat(v);
                // 旧值 > 10 时认为是按分钟误存，转换为小时；小数值保留用户设置
                if (!isNaN(fv) && fv > 10) {
                  localStorage.setItem(k, String(Math.max(1, Math.round(fv / 60))));
                }
              }
            });
            // 朋友圈/iCity 统一做一次兜底：若仍因历史 bug 变成 <=3 分钟，则恢复为 30-60 分钟
            ["akini_num_friendsPost", "akini_num_icityPost"].forEach(function (prefix) {
              var mn = parseFloat(localStorage.getItem(prefix + "Min") || "");
              var mx = parseFloat(localStorage.getItem(prefix + "Max") || "");
              if (isNaN(mn) || isNaN(mx) || mn <= 3 || mn > mx || mx > 1000) {
                localStorage.setItem(prefix + "Min", "30");
                localStorage.setItem(prefix + "Max", "60");
              }
            });
          }
        } catch (e) {}
      })();
      function t(t, e) {
        const n = document.getElementById(t);
        if (!n) {
          const i = localStorage.getItem("akini_toggle_" + t);
          if (null === i) {
            localStorage.setItem("akini_toggle_" + t, e ? "1" : "0");
          }
          return;
        }
        const i = localStorage.getItem("akini_toggle_" + t);
        if (null !== i) {
          "1" === i ? n.classList.add("on") : n.classList.remove("on");
        } else {
          // 默认值写入 localStorage，保证 __akiniToggleOn 能正确读取
          localStorage.setItem("akini_toggle_" + t, e ? "1" : "0");
          e ? n.classList.add("on") : n.classList.remove("on");
        }
        n.addEventListener("click", function (e) {
            e.stopPropagation();
            const i = n.classList.toggle("on");
            localStorage.setItem("akini_toggle_" + t, i ? "1" : "0");
            "darkModeToggle" === t &&
              document.body.classList.toggle("dark-mode", i);
            ("timestampToggle" === t || "readReceiptToggle" === t) &&
              "function" == typeof window.__akiniRefreshChatMeta &&
              window.__akiniRefreshChatMeta();
          });
      }
      (t("keepAliveToggle", !1),
        t("pushNotifyToggle", !1),
        t("msgPopupToggle", !1));
      var e = null;
      async function n() {
        if ("wakeLock" in navigator)
          try {
            (e = await navigator.wakeLock.request("screen")).addEventListener(
              "release",
              function () {
                e = null;
              },
            );
          } catch (t) {}
      }
      async function i() {
        if (e) {
          try {
            await e.release();
          } catch (t) {}
          e = null;
        }
      }
      ((window.requestWakeLock = n),
        (window.releaseWakeLock = i),
        document.addEventListener("visibilitychange", function () {
          var t = document.getElementById("keepAliveToggle");
          "visible" === document.visibilityState &&
            t &&
            t.classList.contains("on") &&
            n();
        }),
        document
          .getElementById("keepAliveToggle")
          .addEventListener("click", function () {
            this.classList.contains("on")
              ? (n(),
                "function" == typeof startKeepAliveIsland &&
                  startKeepAliveIsland())
              : (i(),
                "function" == typeof stopKeepAliveIsland &&
                  stopKeepAliveIsland());
          }),
        document
          .getElementById("pushNotifyToggle")
          .addEventListener("click", function () {
            if (this.classList.contains("on"))
              if ("Notification" in window) {
                if ("default" === Notification.permission)
                  Notification.requestPermission().then(function (t) {
                    if ("granted" !== t) {
                      var e = document.getElementById("pushNotifyToggle");
                      (e &&
                        (e.classList.remove("on"),
                        localStorage.setItem(
                          "akini_toggle_pushNotifyToggle",
                          "0",
                        )),
                        alert("请在浏览器设置中允许通知权限"));
                    }
                  });
                else if ("denied" === Notification.permission) {
                  var t = document.getElementById("pushNotifyToggle");
                  (t &&
                    (t.classList.remove("on"),
                    localStorage.setItem("akini_toggle_pushNotifyToggle", "0")),
                    alert("通知权限已被拒绝，请在浏览器设置中手动开启"));
                }
              } else alert("此浏览器不支持通知功能");
          }));
      var o = window.showInAppNotif,
        r = Date.now();
      ((window.showInAppNotif = function (t) {
        if (!t) return;
        var rawMsg = String(t.msg || "").trim();
        var title = String(t.name || t.app || "Akini").trim();
        var body = rawMsg.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        if (!body) {
          if (t.app === "mail" && t.name) body = "你收到一封信";
          else if (t.app === "friends") body = "新的朋友圈动态";
          else if (t.app === "icity") body = "新的日记";
          else body = "新消息";
        }
        var sanitized = { app: t.app || "Akini", name: title, msg: body, onTap: t.onTap, groupName: t.groupName, avatar: t.avatar || t.appIcon || "", appIcon: t.appIcon || "", chatId: t.chatId || "", ts: t.ts || Date.now(), fullContent: t.fullContent };
        o && o(sanitized);
        var e = document.getElementById("pushNotifyToggle"),
          n =
            e &&
            e.classList.contains("on") &&
            "Notification" in window &&
            "granted" === Notification.permission &&
            document.hidden;
        if (n)
          try {
            var i = sanitized.app || "Akini";
            sanitized.groupName && sanitized.name
              ? (i += " · " + sanitized.groupName + "·" + sanitized.name)
              : sanitized.name
                ? (i += " · " + sanitized.name)
                : sanitized.groupName && (i += " · " + sanitized.groupName);
            var d = new Notification(i, { body: body, icon: "./favicon.png" });
            d.onclick = function () {
              (window.focus && window.focus(), d.close(), t.onTap && t.onTap());
            };
          } catch (t) {}
      }),
        (window._requestNotificationPermission = function () {
          "Notification" in window &&
            "default" === Notification.permission &&
            Notification.requestPermission()
              .then(function (t) {
                "granted" === t
                  ? console.log("[Akini] 通知权限已获取")
                  : console.log("[Akini] 通知权限被拒绝");
              })
              .catch(function (t) {
                console.warn("[Akini] 通知权限请求失败", t);
              });
        }),
        window._requestNotificationPermission(),
        t("quoteReplyToggle", !1),
        t("readReceiptToggle", !1),
        t("readNoReplyToggle", !1),
        t("emojiMixToggle", !1),
        t("contactEmojiToggle", !1),
        t("contactPokeToggle", !0),
        t("contactTransferToggle", !1),
        (function(){
          try {
            localStorage.setItem("akini_toggle_contactReplyToggle", "1");
          } catch(e){}
        })(),
        t("contactReplyToggle", !0),
        t("contactMailToggle", !0),
        t("contactActiveMsgToggle", !1),
        t("contactShopToggle", !1),
        t("contactFriendsToggle", !0),
        t("contactIcityToggle", !0),
        t("timestampToggle", !1),
        t("darkModeToggle", !1),
        document.querySelectorAll(".style-btn").forEach((t) => {
          a(t, function () {
            (document
              .querySelectorAll(".style-btn")
              .forEach((t) => t.classList.remove("active")),
              t.classList.add("active"));
          });
        }));
      ([
        { id: "replyDelayMin", key: "akini_num_replyDelayMin", def: "2" },
        { id: "replyDelayMax", key: "akini_num_replyDelayMax", def: "5" },
        { id: "replyCardCountMin", key: "akini_num_replyCardCountMin", def: "1" },
        { id: "replyCardCountMax", key: "akini_num_replyCardCountMax", def: "3" },
        { id: "replyCardCountGroupMin", key: "akini_num_replyCardCountGroupMin", def: "1" },
        { id: "replyCardCountGroupMax", key: "akini_num_replyCardCountGroupMax", def: "3" },
        { id: "mailDelayMin", key: "akini_num_mailDelayMin", def: "1" },
        { id: "mailDelayMax", key: "akini_num_mailDelayMax", def: "3" },
        { id: "activeMsgMin", key: "akini_num_activeMsgMin", def: "3" },
        { id: "activeMsgMax", key: "akini_num_activeMsgMax", def: "10" },
        { id: "activeMailMin", key: "akini_num_activeMailMin", def: "3" },
        { id: "activeMailMax", key: "akini_num_activeMailMax", def: "6" },
        { id: "friendsPostMin", key: "akini_num_friendsPostMin", def: "30" },
        { id: "friendsPostMax", key: "akini_num_friendsPostMax", def: "60" },
        { id: "icityPostMin", key: "akini_num_icityPostMin", def: "30" },
        { id: "icityPostMax", key: "akini_num_icityPostMax", def: "60" },
        {
          id: "meaningfulNumbersInput",
          key: "akini_meaningful_numbers",
          def: "520,1314,9999",
        },
      ].forEach(function (t) {
        const e = document.getElementById(t.id);
        if (!e) return;
        const n = localStorage.getItem(t.key);
        (null !== n && (e.value = n),
          e.addEventListener("change", function () {
            localStorage.setItem(t.key, this.value);
            // 主动写信/发消息/朋友圈/iCity 间隔变化时立即重新调度，避免旧延迟导致长时间不触发
            if (t.key === "akini_num_activeMailMin" || t.key === "akini_num_activeMailMax" || t.key === "akini_num_activeMsgMin" || t.key === "akini_num_activeMsgMax" || t.key === "akini_num_friendsPostMin" || t.key === "akini_num_friendsPostMax" || t.key === "akini_num_icityPostMin" || t.key === "akini_num_icityPostMax") {
              // 设置变更时用对应任务自身的随机间隔重新调度，避免 1 秒后集中到期导致连发
              if (typeof window._akiniRescheduleMail === "function") {
                try { window._akiniRescheduleMail(); } catch (e) {}
              }
              if (typeof window._akiniRescheduleActiveMsg === "function") {
                try { window._akiniRescheduleActiveMsg(); } catch (e) {}
              }
              if (typeof window._akiniRescheduleFriendsPost === "function") {
                try { window._akiniRescheduleFriendsPost(); } catch (e) {}
              }
              if (typeof window._akiniRescheduleIcityPost === "function") {
                try { window._akiniRescheduleIcityPost(); } catch (e) {}
              }
            }
          }),
          e.addEventListener("blur", function () {
            localStorage.setItem(t.key, this.value);
          }));
      }),
        [
          "inputSignature",
          "inputFriendsSignature",
          "inputDayLabelBeautify",
          "inputStartDateBeautify",
        ].forEach(function (t) {
          const e = document.getElementById(t);
          e &&
            e.addEventListener("change", function () {
              e.dispatchEvent(new Event("input"));
            });
        }),
        (function () {
          var t = document.getElementById("dualAvatarWrap"),
            m = document.getElementById("musicPlayerDualAvatar"),
            e = document.getElementById("swapAvatarPosToggle"),
            n = document.getElementById("swapAvatarRow"),
            i = "akini_swap_avatar_pos";
          function a(n) {
            (e &&
              (n
                ? (e.classList.add("on"),
                  e.setAttribute("aria-pressed", "true"))
                : (e.classList.remove("on"),
                  e.setAttribute("aria-pressed", "false"))),
              t && t.classList.toggle("swapped", n),
              m && m.classList.toggle("swapped", n),
              localStorage.setItem(i, n ? "1" : "0"),
              "function" == typeof syncAvatars && syncAvatars(),
              Tn(),
              "function" == typeof window.updateChatPreview &&
                window.updateChatPreview());
          }
          function o(t) {
            (t && t.stopPropagation(), a(!e.classList.contains("on")));
          }
          ((window.reapplyAvatarSwap = function () {
            var t = localStorage.getItem(i);
            a("1" === t || "true" === t);
          }),
            window.reapplyAvatarSwap(),
            document.addEventListener("visibilitychange", function () {
              document.hidden || Tn();
            }),
            e && e.addEventListener("click", o),
            n &&
              n.addEventListener("click", function (t) {
                t.target !== e && o(t);
              }));
        })());
      (function () {
        var t = document.getElementById("homeAvatarLeftPreview"),
          e = document.getElementById("homeAvatarRightPreview"),
          n = document.getElementById("homeAvatarLeftLabel"),
          i = document.getElementById("homeAvatarRightLabel"),
          a = document.getElementById("homeAvatarContactList"),
          o = null;
        function r() {
          if (a && window.akiniContacts) {
            var t = window.akiniContacts.getContacts(),
              e = window.akiniContacts.getHomeAvatars(),
              n =
                '<div style="font-size:12px;color:#999;width:100%;margin-bottom:4px;">点击选择显示在主页的联系人</div>';
            t.forEach(function (t) {
              var i =
                e.right === t.id
                  ? "border:2px solid #007aff;"
                  : "border:2px solid transparent;";
              n +=
                '<div style="display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;" data-slot-contact="' +
                t.id +
                '"><div style="width:42px;height:42px;border-radius:50%;background:#e8e8e8;overflow:hidden;display:flex;align-items:center;justify-content:center;' +
                i +
                '">' +
                nt(t.avatar, 42) +
                '</div><div style="font-size:11px;color:#666;max-width:50px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
                rt(t.name) +
                "</div></div>";
            });
            (a.innerHTML = n),
              a.querySelectorAll("[data-slot-contact]").forEach(function (t) {
                t.addEventListener("click", function () {
                  var t = this.getAttribute("data-slot-contact"),
                    e = window.akiniContacts.getHomeAvatars();
                  // 左侧固定为“我”，只能选右侧联系人
                  e.right = t;
                  window.akiniContacts.setHomeAvatars(e.left, e.right),
                    c(),
                    r(),
                    Tn(),
                    (o = null);
                });
              });
          }
          window.renderMusicPlayerContacts && window.renderMusicPlayerContacts();
        }
        function c() {
          if (window.akiniContacts) {
            var a = window.akiniContacts.getHomeAvatars(),
              o = window.akiniContacts.getChatTarget(a.left),
              r = window.akiniContacts.getChatTarget(a.right);
            // 左侧固定为“我”
            t && (t.innerHTML = nt(window.getMyAvatar ? window.getMyAvatar() : "🐱", 56));
            r && e && (e.innerHTML = nt(r.avatar, 56));
            n && (n.textContent = "我");
            r && i && (i.textContent = r.name);
          }
        }
        function l() {
          r();
          c();
        }
        (e &&
            e.addEventListener("click", function () {
              ((o = "right"), r());
            }),
          l(),
          r(),
          c(),
          (window.renderBeautifyContacts = l),
          (window.renderHomeAvatarContacts = r),
          (window.renderHomeAvatarPreviews = c));
      })();
    })(),
      (window.getWordCards = function () {
        return i("akini_wordbank", []);
      }),
      (window.triggerTaReplyOnce = function (t, delay) {
        if (!we || we.active) return;
        if (!window.akiniContacts) return;
        t = t || window.akiniContacts.getActiveChatId();
        const e = window.akiniContacts.getChatTarget(t);
        if (!e) return;
        const n = _();
        if ("none" === n.type) return;
        n.cardCount =
          window.AKR && window.AKR.getCardCount
            ? window.AKR.getCardCount(e.type === "group" ? "group" : "private")
            : 1;
        const i = document.getElementById("typingIndicator"),
          a = t === window.akiniContacts.getActiveChatId();
        a &&
          i &&
          showTypingBubble(
            t,
            "group" === e.type ? (e.memberIds || [])[0] : null,
          );
        var s = 1e3;
        if ("number" == typeof delay) s = delay;
        else {
          const o = parseFloat(
              localStorage.getItem("akini_num_activeMsgMin") || "3",
            ),
            r = parseFloat(
              localStorage.getItem("akini_num_activeMsgMax") || "6",
            ),
            c = 3600 * o * 1e3,
            l = 3600 * r * 1e3;
          s = c + Math.random() * Math.max(0, l - c);
        }
        window._akiniTimer.schedule("activeMsgReply", function () {
          I(t, e, n);
        }, s);
      }),
      (window.getContactStickersSync = function (t) {
        var e = "akini_stickers_" + t;
        if (window.__csCache && window.__csCache[e]) return window.__csCache[e];
        var n = localStorage.getItem(e);
        if (n)
          try {
            var p = JSON.parse(n);
            ((window.__csCache = window.__csCache || {}),
              (window.__csCache[e] = p));
            return p;
          } catch (t) {
            return [];
          }
        return [];
      }));
    !(function __amt(isFirst) {
      const e = parseFloat(
          localStorage.getItem("akini_num_activeMsgMin") || "3",
        ),
        n = parseFloat(localStorage.getItem("akini_num_activeMsgMax") || "6");
      // 首次触发使用最小间隔，之后按随机范围
      var delayMin = 3600 * e * 1e3,
        delayMax = 3600 * n * 1e3,
        o = isFirst
          ? delayMin
          : delayMin + Math.random() * Math.max(0, delayMax - delayMin);
      console.log("[Akini 主动发消息] 下次调度：", (o / 36e5).toFixed(1), "小时后触发");
      function __amtAction() {
        try {
          // 防止短时间内多次主动发消息
          var _minGap = Math.max(1, e) * 3600 * 1000 * 0.8;
          var _lastRun = parseFloat(localStorage.getItem("akini_last_activeMsg_run") || "0");
          if (_lastRun > 0 && Date.now() - _lastRun < _minGap) {
            console.log("[Akini 主动发消息] 距上次执行太近，跳过本次，间隔不足", e.toFixed(1), "小时");
            __amt(false); return;
          }
          localStorage.setItem("akini_last_activeMsg_run", String(Date.now()));
          if (!window.AKR || "function" != typeof window.AKR.isInTimeRange) {
            __amt(false);
            return;
          }
          if (!window.AKR.isInTimeRange("activeMsg")) {
            __amt(false);
            return;
          }
          if (!we.active) {
            if (
              !window.akiniContacts ||
              "function" != typeof window.akiniContacts.getContacts
            ) {
              __amt(false);
              return;
            }
            var e = (function () {
              var t = window.akiniContacts.getContacts(),
                e = window.akiniContacts.getGroups(),
                n = t.concat(e);
              return 0 === n.length
                ? null
                : n[Math.floor(Math.random() * n.length)].id;
            })();
            if (!e) return void __amt(false);
            var n = window.akiniContacts.getChatTarget(e);
            if ("1" !== localStorage.getItem("akini_toggle_contactActiveMsgToggle")) {
              __amt(false);
              return;
            }
            if (Math.random() < window.AKR.getProb("groupCall") && n) {
              var i = { targetId: e };
              if ("group" === n.type) {
                ((i.isGroupCall = !0),
                  (i.groupName = n.name),
                  (i.groupAvatar = n.avatar));
                var a = n.memberIds || [],
                  o =
                    a.length > 0
                      ? a[Math.floor(Math.random() * a.length)]
                      : null,
                  r = o ? window.akiniContacts.getChatTarget(o) : null;
                r
                  ? ((i.callerName = r.name), (i.callerAvatar = r.avatar))
                  : ((i.callerName = n.name), (i.callerAvatar = n.avatar));
                i.selectedMembers = a
                  .map(function (mid) {
                    var m = window.akiniContacts.getChatTarget(mid);
                    return m
                      ? { id: m.id, name: m.name, avatar: m.avatar }
                      : { id: mid, name: mid, avatar: "" };
                  })
                  .filter(function (m) {
                    return m.id !== o;
                  });
              } else ((i.callerName = n.name), (i.callerAvatar = n.avatar));
              Te(n.name, !1, i);
            } else if ("function" == typeof window.triggerTaReplyOnce)
              window.triggerTaReplyOnce(e);
          }
          __amt(false);
        } catch (err) {
          console.warn("[__amt] error", err);
          __amt(false);
        }
      }
      window._akiniActiveMsgAction = __amtAction;
      window._akiniRescheduleActiveMsg = function () { __amt(false); };
      window._akiniTimer.schedule("activeMsg", __amtAction, o);
    })(true);
    (function () {
      !(function t(isFirst) {
        const e = parseFloat(
            localStorage.getItem("akini_num_icityPostMin") || "30",
          ),
          n = parseFloat(
            localStorage.getItem("akini_num_icityPostMax") || "60",
          );
        // 首次触发使用最小间隔，之后按随机范围
        var delay = isFirst ? e : (e + Math.random() * Math.max(0, n - e));
        var i = 60 * delay * 1e3;
        console.log("[Akini iCity] 下次调度：", delay.toFixed(1), "分钟后触发");
        function icityPostAction() {
          // 防止短时间内多次发 iCity
          var _minGap = Math.max(1, e) * 60 * 1000 * 0.8;
          var _lastRun = parseFloat(localStorage.getItem("akini_last_icityPost_run") || "0");
          if (_lastRun > 0 && Date.now() - _lastRun < _minGap) {
            console.log("[Akini iCity] 距上次执行太近，跳过本次，间隔不足", e.toFixed(1), "分钟");
            t(false); return;
          }
          localStorage.setItem("akini_last_icityPost_run", String(Date.now()));
          if (!window.AKR.isInTimeRange("icity")) {
            t(false);
            return;
          }
          if ("1" !== localStorage.getItem("akini_toggle_contactIcityToggle")) {
            t(false);
            return;
          }
          var e = Dn(0);
          if ((e && (e = e.replace(/\n/g, " ")), e)) {
            var n = window.akiniContacts
                ? window.akiniContacts.getContacts()
                : [],
              i = n.length ? n[Math.floor(Math.random() * n.length)] : null;
            if (!i) {
              t(false);
              return;
            }
            var a = i.id,
              o = getIcityContactProfile(i.id),
              c = o && o.name ? o.name : i.name,
              l = o && o.avatar ? o.avatar : i.avatar,
              s = q();
            (s.push({
              id: Date.now() + "_" + Math.floor(1e3 * Math.random()),
              who: a,
              author: c,
              authorId: a,
              text: e,
              ts: Date.now(),
              likes: 0,
              likers: [],
              comments: [],
              liked: !1,
            }),
              j(s),
              window._renderIcity && window._renderIcity(),
              window.renderIcityProfileDiaries &&
                window.renderIcityProfileDiaries(
                  "icityTaProfileDiaries",
                  i.id,
                ),
              "function" == typeof window.showInAppNotif &&
                window.showInAppNotif({
                  app: "icity",
                  avatar: l,
                  name: c,
                  fullContent: !0,
                  msg: e,
                  onTap: function () {
                    r("icityArea");
                  },
                }),
              t(false));
          } else t(false);
        }
        window._akiniIcityPostAction = icityPostAction;
        window._akiniRescheduleIcityPost = function () { t(false); };
        window._akiniTimer.schedule("icityPost", icityPostAction, i);
      })(true);
      var t = {};
      function e(t, e) {
        return Math.floor(Math.random() * (e - t + 1)) + t;
      }
      function getReplyDelayMs() {
        var min = parseFloat(localStorage.getItem("akini_num_replyDelayMin") || "2");
        var max = parseFloat(localStorage.getItem("akini_num_replyDelayMax") || "5");
        if (isNaN(min)) min = 2;
        if (isNaN(max) || max < min) max = min;
        return Math.floor(1e3 * (min + Math.random() * Math.max(0, max - min)));
      }
      function n() {
        return (
          localStorage.getItem("akini_icity_ta_nick") ||
          localStorage.getItem("akini_ta_name") ||
          "对方"
        );
      }
      function i() {
        return localStorage.getItem("akini_icity_my_nick") || "我";
      }
      function _pickIcityInteractor() {
        if (!window.akiniContacts) return null;
        var t = window.akiniContacts.getContacts();
        if (!t.length) return null;
        var e = t[Math.floor(Math.random() * t.length)],
          n = getIcityContactProfile(e.id);
        return {
          id: e.id,
          name: (n && n.name) || e.name || "对方",
          avatar: (n && n.avatar) || e.avatar || "🐰",
        };
      }
      function a(t) {
        for (
          var e = (function () {
              var t = i(),
                e = [];
              // 把我给每个联系人设置的 iCity 昵称都纳入“TA”，避免评论循环判断失效
              if (window.akiniContacts) {
                window.akiniContacts.getContacts().forEach(function (n) {
                  var i = getIcityContactProfile(n.id);
                  i && i.name && e.push(i.name);
                  n.name && e.push(n.name);
                });
              }
              return (
                e.push(localStorage.getItem("akini_icity_ta_nick") || "对方"),
                { myName: t, taNames: e }
              );
            })(),
            a = e.myName,
            o = e.taNames,
            r = t.comments || [],
            c = -1,
            l = r.length - 1,
            hasUserComment = !1;
          l >= 0;
          l--
        ) {
          if (o.indexOf(r[l].author) >= 0) {
            c = l;
          }
          if (r[l].author === a) hasUserComment = !0;
        }
        if (!hasUserComment) return c < 0;
        if (c < 0) return !0;
        var s = r[c].author;
        for (l = c + 1; l < r.length; l++)
          if (r[l].author === a && r[l].replyTo === s) return !0;
        return !1;
      }
      function _isIcityContactAuthor(t) {
        if (!t || !t.authorId) return !1;
        if (!window.akiniContacts) return !1;
        var e = window.akiniContacts.getContactById(t.authorId);
        return !!e;
      }
      function _isIcityUserAuthor(t) {
        return !t || !t.authorId || !_isIcityContactAuthor(t);
      }
      function o(t) {
        if (t && t.authorId) {
          var e = getIcityContactProfile(t.authorId);
          if (e && e.name) return { name: e.name, avatar: e.avatar || y() };
        }
        return {
          name: n(),
          avatar:
            localStorage.getItem("akini_icity_ta_avatar") ||
            localStorage.getItem("akini_ta_avatar") ||
            "🐰",
        };
      }
      function c(n) {
        var i = "like_" + n;
        t[i] ||
          ((t[i] = !0),
          setTimeout(
            function () {
              !(function (t) {
                var e = q(),
                  n = e.find(function (e) {
                    return e.id == t;
                  });
                if (n && _isIcityUserAuthor(n)) {
                  var interactor = _pickIcityInteractor();
                  if (!interactor) return;
                  var a = interactor.name,
                    c = interactor.avatar;
                  ((n.likers = n.likers || []),
                    n.likers.indexOf(a) < 0 &&
                      (n.likers.push(a),
                      (n.likes = (n.likes || 0) + 1),
                      j(e),
                      window._renderIcity && window._renderIcity(),
                      window.renderIcityProfileDiaries &&
                        (window.renderIcityProfileDiaries(
                          "icityMyProfileDiaries",
                          "me",
                        ),
                        n.authorId
                          ? window.renderIcityProfileDiaries(
                              "icityTaProfileDiaries",
                              n.authorId,
                            )
                          : window.renderIcityProfileDiaries(
                              "icityTaProfileDiaries",
                              "ta",
                            )),
                      "function" == typeof window.showInAppNotif &&
                        window.showInAppNotif({
                          app: "icity",
                          avatar: c,
                          name: a,
                          fullContent: !0,
                          msg: "喜欢了你的日记",
                          onTap: function () {
                            r("icityArea");
                          },
                        })));
                }
              })(n);
            },
            e(0, 0),
          ));
      }
      function l(n) {
        var i = "cmt_" + n;
        t[i] ||
          ((t[i] = !0),
          setTimeout(
            function () {
              !(function (t) {
                var e = q(),
                  n = e.find(function (e) {
                    return e.id == t;
                  });
                if (n && _isIcityUserAuthor(n) && a(n)) {
                  var i = "";
                  try {
                    i = Dn(1);
                  } catch (t) {}
                  if (i) {
                    var interactor = _pickIcityInteractor();
                    if (!interactor) return;
                    var l = interactor.name,
                      s = interactor.avatar;
                    ((n.comments = n.comments || []),
                      n.comments.push({
                        author: l,
                        authorId: interactor.id,
                        text: i,
                        avatar: s,
                        ts: Date.now(),
                      }),
                      j(e),
                      window._renderIcity && window._renderIcity(),
                      window.renderIcityProfileDiaries &&
                        (window.renderIcityProfileDiaries(
                          "icityMyProfileDiaries",
                          "me",
                        ),
                        window.renderIcityProfileDiaries(
                          "icityTaProfileDiaries",
                          "ta",
                        )),
                      "function" == typeof window.showInAppNotif &&
                        window.showInAppNotif({
                          app: "icity",
                          avatar: s,
                          name: l,
                          fullContent: !0,
                          msg: "评论了你的日记：" + i,
                          onTap: function () {
                            r("icityArea");
                          },
                        }));
                  }
                }
              })(n);
            },
            e(0, 0),
          ));
      }
      ((window.replyToMyComment = function (t) {
        var e = q(),
          n = e.find(function (e) {
            return e.id == t;
          });
        if (n && n.comments && n.comments.length && _isIcityContactAuthor(n)) {
          var c = o(n),
            l = c.name,
            s = c.avatar,
            d = i();
          if (!("me" === n.who || "me" === n.author) || a(n)) {
            for (var u = !1, m = n.comments.length - 1; m >= 0; m--) {
              var f = n.comments[m];
              if ((f.author === d || "我" === f.author) && !f.repliedByTa) {
                var g = "";
                try {
                  g = Dn(1);
                } catch (t) {}
                if (!g) break;
                ((f.repliedByTa = !0),
                  n.comments.push({
                    id: "c_" + Math.random().toString(36).slice(2) + "_" + Date.now(),
                    author: l,
                    authorId: n.authorId,
                    text: g,
                    avatar: s,
                    replyTo: f.author,
                    ts: Date.now(),
                  }),
                  (u = !0),
                  "function" == typeof window.showInAppNotif &&
                    window.showInAppNotif({
                      app: "icity",
                      avatar: s,
                      name: l,
                      fullContent: !0,
                      msg: "回复了你的评论：" + g,
                      onTap: function () {
                        r("icityArea");
                      },
                    }));
                break;
              }
            }
            u &&
              (j(e),
              window._renderIcity && window._renderIcity(),
              window.renderIcityProfileDiaries &&
                (window.renderIcityProfileDiaries(
                  "icityMyProfileDiaries",
                  "me",
                ),
                n.authorId
                  ? window.renderIcityProfileDiaries(
                      "icityTaProfileDiaries",
                      n.authorId,
                    )
                  : window.renderIcityProfileDiaries(
                      "icityTaProfileDiaries",
                      "ta",
                    )));
          }
        }
      }),
        // iCity 点赞/评论/回复统一由 akini-moments-engine.js 处理（100% 全联系人）
        (window.scheduleTaReplySoon = function (n) {}),
        (window.scheduleTaLikeSoon = function (n) {}),
        (window.scheduleTaCommentSoon = function (n) {}),
        function n() {
          /* 已禁用自动点赞/评论调度 */
        });
    })();
    (function () {
      function Wt(t, e) {
        if (t) {
          if (
            t.getAttribute("onclick") ||
            t.getAttribute("ontouchend") ||
            t.getAttribute("onpointerdown")
          )
            return;
          t.style.cursor = "pointer";
          var _fired = !1;
          t.addEventListener(
            "touchend",
            function (t) {
              t.preventDefault();
              t.stopPropagation();
              _fired = !0;
              e();
              setTimeout(function () {
                _fired = !1;
              }, 500);
            },
            { passive: false },
          );
          t.addEventListener("click", function (t) {
            t.preventDefault();
            t.stopPropagation();
            if (_fired) return;
            e();
          });
        }
      }
      function xt() {
        ((__akiniManualPlay = !1),
          (d = !1),
          u && u.pause(),
          ut(),
          X(),
          Ct(),
          (e.disc.style.animationPlayState = "paused"),
          pt("已暂停"),
          Y(),
          ot() ? it() : __akiniStopAudio());
      }
      function Et() {
        __akiniManualPlay = !0;
        d
          ? xt()
          : (_t(),
            u && u.paused && u.src && c[l]
              ? ((d = !0),
                Ct(),
                e.disc && (e.disc.style.animationPlayState = "running"),
                pt("继续播放"),
                (u.muted = !1),
                (u.volume = 1),
                u.play().catch(function (t) {
                  (console.warn("恢复播放失败", t), It());
                }))
              : It());
      }
      function St(t) {
        t && (__akiniManualPlay = !0);
        if (c.length) {
          var e = (l + 1) % c.length,
            n = c[e];
          n && n.id && !kt(n)
            ? (_t(),
              wt(n, !1)
                .then(function () {
                  ((l = e), It());
                })
                .catch(function () {
                  ((l = e), It());
                }))
            : ((l = e), It());
        }
      }
      function At(t) {
        t && (__akiniManualPlay = !0);
        if (c.length) {
          var e = (l - 1 + c.length) % c.length,
            n = c[e];
          n && n.id && !kt(n)
            ? (_t(),
              wt(n, !1)
                .then(function () {
                  ((l = e), It());
                })
                .catch(function () {
                  ((l = e), It());
                }))
            : ((l = e), It());
        }
      }
      function Ct() {
        e.playIcon &&
          e.pauseIcon &&
          ((e.playIcon.style.display = d ? "none" : "block"),
          (e.pauseIcon.style.display = d ? "block" : "none"));
      }
      function Bt() {
        var _pc = document.getElementById("musicPlaylistContainer");
        if (_pc)
          if (c.length) {
            var t = "";
            (c.forEach(function (e, n) {
              var i = n === l;
              t +=
                '<div data-idx="' +
                n +
                '" style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:12px;background:' +
                (i ? "rgba(79,124,255,0.18)" : "rgba(255,255,255,0.05)") +
                ';margin-bottom:8px;cursor:pointer;"><div style="width:46px;height:46px;border-radius:8px;background:#333;overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:18px;">' +
                (e.cover
                  ? '<img src="' +
                    e.cover +
                    '" style="width:100%;height:100%;object-fit:cover;">'
                  : "🎵") +
                '</div><div style="flex:1;min-width:0;"><div style="font-size:15px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' +
                J(e.title) +
                '</div><div style="font-size:12px;color:#999;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' +
                J(e.artist) +
                '</div></div><div style="font-size:13px;color:' +
                (i ? "#4f7cff" : "#666") +
                ';">' +
                (i ? "播放中" : "") +
                '</div><span class="playlist-del-btn" data-del-idx="' +
                n +
                '" style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;color:#999;font-size:18px;line-height:1;cursor:pointer;flex-shrink:0;-webkit-tap-highlight-color:transparent;">✕</span></div>';
            }),
              (_pc.innerHTML = t));
          } else
            _pc.innerHTML =
              '<div style="text-align:center;color:#888;padding:20px;font-size:14px;">暂无歌曲，请导入歌单</div>';
      }
      function Tt(n, i, a) {
        i =
          i ||
          (function () {
            try {
              return localStorage.getItem("akini_netease_cookie");
            } catch (e) {
              return "";
            }
          })();
        var o, r;
        if ("netease" !== B.platform)
          return (
            alert(
              "当前仅支持网易云音乐歌单解析。QQ/酷狗/酷我扫码后请手动打开对应 App，再复制歌单链接到此处切换回网易云导入",
            ),
            Promise.reject(new Error("暂不支持该平台"))
          );
        if (
          (n ||
            ((o = e.playlistInput ? e.playlistInput.value : ""),
            (n =
              (r = (o = String(o).trim()).match(
                /(?:playlist\?id=|\/playlist\/)(\d+)/i,
              )) ||
              (r = o.match(/[?&]id=(\d{5,})/)) ||
              (r = o.match(/id=(\d{5,})/)) ||
              (r = o.match(/\/(\d{5,})(?:\?|#|\/|$)/)) ||
              (r = o.match(/(\d{5,})/))
                ? r[1]
                : "")),
          !n)
        )
          return (
            alert("请输入网易云歌单链接或ID"),
            Promise.reject(new Error("缺少歌单 ID"))
          );
        a || (e.importBtn && (e.importBtn.textContent = "导入中…"));
        var playlistCookie = encodeURIComponent(i || "");
        function _parseTracks(tracks, playlistName) {
          if (!tracks || !tracks.length) return [];
          return tracks.map(function (t) {
            var artists = t.ar || t.artists || [];
            var artistName =
              artists
                .map(function (a) {
                  return a.name;
                })
                .join("/") ||
              t.artist ||
              "未知歌手";
            var cover =
              t.al && t.al.picUrl
                ? t.al.picUrl
                : t.cover || (t.album && t.album.picUrl) || "";
            return {
              id: t.id,
              title: t.name || t.title,
              artist: artistName,
              cover: cover,
              duration: t.dt || t.duration || 0,
            };
          });
        }
        function _fetchTrackAll() {
          return fetch(t + "/playlist/track/all?id=" + encodeURIComponent(String(n)) + "&cookie=" + playlistCookie)
            .then(function (r) { return r.json(); })
            .then(function (r) {
              console.log("[Akini Netease] /playlist/track/all response", r);
              if (r && r.code !== 200 && r.code !== 0) throw new Error(r.message || r.msg || "track/all 返回异常");
              var songs = r.songs || (r.data && r.data.songs) || [];
              if (!songs.length) throw new Error("track/all 无歌曲");
              return { tracks: songs, name: (r.playlist && r.playlist.name) || "" };
            });
        }
        function _fetchDetailFallback() {
          return fetch(t + "/playlist/detail?id=" + encodeURIComponent(String(n)) + "&cookie=" + playlistCookie)
            .then(function (r) { return r.json(); })
            .then(function (r) {
              console.log("[Akini Netease] /playlist/detail response", r);
              if (r && r.code !== 200 && r.code !== 0)
                throw new Error(
                  r.message || r.msg || "返回数据异常 (code:" + r.code + ")",
                );
              var playlist = r && r.playlist;
              if (!playlist && r && r.data) playlist = r.data.playlist;
              if (!playlist) throw new Error("返回数据异常：缺少 playlist");
              var tracks = playlist.tracks || r.songs || [];
              return { tracks: tracks, name: playlist.name || "" };
            });
        }
        return _fetchTrackAll().catch(function (err) {
          console.warn("[Akini Netease] track/all failed, fallback to detail", err);
          return _fetchDetailFallback();
        }).then(function (res) {
          var tracks = res.tracks;
          var playlistName = res.name;
          if (!tracks.length) throw new Error("歌单为空或需要登录");
          var o = _parseTracks(tracks, playlistName);
          return (
            a ||
              ((c = o),
              localStorage.setItem("akini_music_playlist", JSON.stringify(c)),
              (function () {
                try {
                  window._idbStore &&
                    window._idbStore.set("akini_music_playlist", JSON.stringify(c));
                } catch (t) {}
              })(),
              (l = 0),
              localStorage.setItem("akini_music_index", 0),
              e.playlistInput && (e.playlistInput.value = ""),
              Pt(),
              wt(c[l], !1),
              pt("已导入 " + c.length + " 首，点击播放按钮开始播放"),
              Bt(),
              e.playlistOverlay && (e.playlistOverlay.style.display = "flex"),
              alert(
                "已导入「" +
                  (playlistName || "未知歌单") +
                  "」共 " +
                  c.length +
                  " 首",
              )),
            o
          );
        })
          .catch(function (t) {
            var msg = t.message || "";
            if (msg.indexOf("歌单不存在") !== -1 || msg.indexOf("404") !== -1) {
              msg = "歌单不存在或无法访问。请检查：\n1. 是否粘贴了 music.163.com 开头的完整链接；\n2. 歌单是否被删除或设为私密；\n3. 第三方短链接需要先在外部浏览器打开，再复制真实链接。";
            }
            if (!a) {
              alert("导入失败：" + msg);
              return Promise.reject(t);
            }
            return Promise.reject(t);
          })
          .finally(function () {
            a || (e.importBtn && (e.importBtn.textContent = "导入"));
          });
      }
      function _importAllNeteasePlaylists(e, n) {
        n = n || "";
        var a = [],
          o = 0;
        if (!e || !e.length) return a;
        function i() {
          if (o >= e.length) {
            if (!a.length) return void alert("没有导入任何歌曲");
            (T(a), Bt(), alert("已合并导入全部歌单，共 " + a.length + " 首"));
            return;
          }
          var r = e[o];
          o++;
          var l = r.id || r;
          if (!l) {
            i();
            return;
          }
          Tt(l, n, !0)
            .then(function (e) {
              (e &&
                e.forEach(function (e) {
                  a.push(e);
                }),
                setTimeout(i, 200));
            })
            .catch(function (e) {
              setTimeout(i, 200);
            });
        }
        i();
      }
      function Mt() {
        if (e.lyricsBody) {
          if (!b.length)
            return (
              (e.lyricsBody.innerHTML =
                '<div style="text-align:center;padding:40px 0;color:rgba(255,255,255,0.35);font-size:13px;">暂无歌词</div>'),
              void (H = [])
            );
          var LH = 34;
          for (var t = 0, n = 0; n < b.length && w >= b[n].time; n++) t = n;
          var next = b[t + 1] ? b[t + 1].time : b[t] ? b[t].time + 4 : 0;
          var dur = Math.max(0.4, next - b[t].time);
          var prog = Math.min(1, Math.max(0, (w - b[t].time) / dur));
          if (H.length !== b.length) {
            var i = "";
            for (n = 0; n < b.length; n++)
              i +=
                '<div class="lyric-line" data-idx="' +
                n +
                '" style="text-align:center;padding:6px 0;font-size:13px;color:rgba(255,255,255,0.45);font-weight:400;line-height:1.6;transition:color 0.2s,font-size 0.2s,opacity 0.2s;height:' +
                LH +
                'px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;">' +
                J(b[n].text) +
                "</div>";
            ((e.lyricsBody.innerHTML = i),
              (H = Array.from(e.lyricsBody.querySelectorAll(".lyric-line"))));
          }
          var a = t - 2 + prog;
          a = Math.max(0, Math.min(a, b.length - 5));
          var containerH =
            (e.lyricsBody.parentElement &&
              e.lyricsBody.parentElement.clientHeight) ||
            200;
          var activeTop = t * LH + prog * LH;
          var target = activeTop - containerH / 2 + LH / 2;
          var maxScroll = Math.max(0, b.length * LH - containerH);
          target = Math.max(0, Math.min(target, maxScroll));
          (H.forEach(function (el, n) {
            if (!el || !el.style) return;
            var d = Math.abs(n - t),
              o = n === t;
            ((el.style.fontSize = o ? "15px" : "13px"),
              (el.style.color = o ? "#fff" : "rgba(255,255,255,0.45)"),
              (el.style.fontWeight = o ? "600" : "400"),
              (el.style.opacity = o ? "1" : d <= 1 ? "0.6" : "0.35"));
          }),
            (e.lyricsBody.style.transform = "translateY(" + -target + "px)"));
        }
      }
      function loadUserPlaylists(n, uid, nickname) {
        if (typeof window._fetchUserPlaylists === "function" && n) {
          window._fetchUserPlaylists(n, nickname);
        }
        return Promise.resolve();
      }
      function Lt() {}
      function Dt() {}
      function Nt() {
        e.menuOverlay &&
          ((e.menuOverlay.style.display = "block"),
          Lt(),
          updateMusicLoginStatus());
        try {
          var _cookie = localStorage.getItem("akini_netease_cookie") || "";
          var _uid = localStorage.getItem("akini_netease_uid") || "";
          var _nickname = localStorage.getItem("akini_netease_nickname") || "";
          if (
            _cookie &&
            _uid &&
            typeof window._fetchUserPlaylists === "function"
          )
            window._fetchUserPlaylists(_cookie, _nickname);
        } catch (e) {}
        B.platform = "netease";
        try {
          localStorage.setItem("akini_music_platform", "netease");
        } catch (t) {}
        switchMusicPlatform(B.platform, !0);
        try {
          if (typeof window._generateQrCode === "function") {
            var _c = "";
            try {
              _c = localStorage.getItem("akini_netease_cookie") || "";
            } catch (t) {}
            if (!_c)
              setTimeout(function () {
                try {
                  window._generateQrCode();
                } catch (t) {}
              }, 500);
          }
        } catch (t) {}
      }
      function switchMusicPlatform(n, i) {
        n = "netease";
        B.platform = n;
        try {
          localStorage.setItem("akini_music_platform", n);
        } catch (t) {}
      }
      function Pt() {
        (e.menuOverlay && (e.menuOverlay.style.display = "none"), Lt());
      }
      function Ht() {
        e.playlistOverlay && (e.playlistOverlay.style.display = "none");
      }
      function zt() {
        if (e.contactList) {
          if (window.akiniContacts && window.akiniContacts.resetCache)
            window.akiniContacts.resetCache();
          var t = window.akiniContacts
            ? window.akiniContacts.getContacts()
            : [];
          if (!t || 0 === t.length) {
            t = [
              {
                id: "ta",
                name: localStorage.getItem("akini_ta_name") || "TA",
                avatar: localStorage.getItem("akini_ta_avatar") || "🐰",
                isDefault: !0,
              },
            ];
          }
          ((t && 0 !== t.length) ||
            (t = [
              {
                id: "ta",
                name: p ? p() : "对方",
                avatar: y ? y() : "🐰",
                isDefault: !0,
              },
            ]),
            (e.contactList.innerHTML = ""),
            t.forEach(function (t, n) {
              var i = T.some(function (e) {
                  return e.id === t.id;
                }),
                a = document.createElement("div");
              ((a.className = "music-contact-item"),
                (a.style.cssText =
                  "display:flex;flex-direction:column;justify-content:flex-start;align-items:center;gap:8px;padding:14px;background:transparent;border-radius:16px;cursor:pointer;position:relative;min-width:0;box-sizing:border-box;"),
                a.setAttribute("data-cid", t.id),
                a.setAttribute("data-index", n),
                (a.innerHTML =
                  '<div style="position:absolute;top:10px;right:10px;width:22px;height:22px;border-radius:50%;border:2px solid ' +
                  (i ? "#4f7cff" : "rgba(255,255,255,0.25)") +
                  ';display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.25);">' +
                  (i
                    ? '<div style="width:10px;height:10px;border-radius:50%;background:#4f7cff;"></div>'
                    : "") +
                  '</div><div style="width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,0.1);overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:28px;">' +
                  nt(t.avatar, 56) +
                  '</div><div style="font-size:13px;font-weight:600;color:#fff;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;">' +
                  J(t.name || "对方") +
                  "</div>"),
                a.addEventListener("click", function () {
                  (!(function (t) {
                    var e = T.findIndex(function (e) {
                      return e.id === t.id;
                    });
                    e >= 0
                      ? T.splice(e, 1)
                      : (T.length >= 2 && T.shift(),
                        T.push({ id: t.id, name: t.name, avatar: t.avatar }));
                    saveMusicContacts();
                  })(t),
                    zt(),
                    Ot());
                }),
                e.contactList.appendChild(a));
            }),
            (e.contactList.style.display = "grid"),
            (e.contactList.style.gridTemplateColumns = "repeat(4, 1fr)"),
            (e.contactList.style.alignItems = "start"),
            (e.contactList.style.justifyItems = "center"),
            (e.contactList.style.gap = "10px"),
            (e.contactList.style.padding = "0 20px 20px"));
        }
      }
      function Ot() {
        if (e.pickerSelectedInfo) {
          var t = T.length,
            n =
              0 === t
                ? "请选择至少 1 人"
                : 1 === t
                  ? "已选 1 人：双人模式"
                  : "已选 2 人：三人模式";
          e.pickerSelectedInfo.textContent = n;
        }
      }
      function Rt() {
        e.contactPicker &&
          ((e.contactPicker.style.display = "flex"), zt(), Ot());
      }
      function Ft() {
        e.contactPicker && (e.contactPicker.style.display = "none");
      }
      function qt() {
        return "1" === localStorage.getItem("akini_music_listening_active");
      }
      function jt(t) {
        try {
          localStorage.setItem("akini_music_listening_active", t ? "1" : "0");
          if (t) {
            window._akiniMusicExited = false;
            try {
              localStorage.removeItem("akini_music_exited");
            } catch (e) {}
          }
        } catch (t) {}
      }
      function $t() {
        e.optionPicker && (e.optionPicker.style.display = "none");
      }
      function Jt(t, n, i, noStore) {
        if (t) {
          var a,
            r = $(),
            c = "function" == typeof isSwapped && isSwapped(),
            l = "对方",
            s = "🐰";
          if ("triple" === r && T.length >= 2)
            if (n) a = e.chatCenter;
            else {
              var d = 1 === i || "1" === i ? 1 : 0;
              a = 1 === d ? e.chatRight : e.chatLeft;
              var u = T[d];
              u && ((l = u.name || l), (s = u.avatar || s));
            }
          else
            n
              ? (a = c ? e.chatRight : e.chatLeft)
              : ((a = c ? e.chatLeft : e.chatRight),
                T.length >= 1 &&
                  ((l = T[0].name || l), (s = T[0].avatar || s)));
          if (a) {
            var m = document.createElement("div");
            ((m.style.cssText =
              "max-width:120px;padding:8px 10px;border-radius:14px;background:rgba(255,255,255,0.12);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);color:#fff;font-size:12px;line-height:1.45;word-break:break-word;box-shadow:0 2px 8px rgba(0,0,0,0.15);text-align:center;opacity:0;transform:translateY(10px) scale(0.95);transition:opacity 0.5s ease, transform 0.5s ease;"),
              (m.textContent = t),
              a.appendChild(m),
              requestAnimationFrame(function () {
                setTimeout(function () {
                  ((m.style.opacity = "1"),
                    (m.style.transform = "translateY(0) scale(1)"));
                }, 50);
              }),
              z.push({
                text: t,
                isMe: n,
                fromIdx: i,
                time: Date.now(),
                el: m,
              }));
            z.length > 200 && z.shift();
            try {
              window._idbStore &&
                window._idbStore.set &&
                window._idbStore.set(
                  "akini_music_chat_messages",
                  JSON.stringify(
                    z.map(function (m) {
                      return {
                        text: m.text,
                        isMe: m.isMe,
                        fromIdx: m.fromIdx,
                        time: m.time,
                      };
                    }),
                  ),
                );
            } catch (e) {}
            z.shift();
            setTimeout(function () {
              m.style.opacity = "0";
              m.style.transform = "translateY(10px) scale(0.95)";
              setTimeout(function () {
                m.parentNode && m.parentNode.removeChild(m);
              }, 500);
            }, 2e4);
            n ||
              "function" != typeof window.showInAppNotif ||
              window.showInAppNotif({
                app: "网易云",
                appIcon: "🎵",
                avatar: s,
                name: l,
                fullContent: !0,
                msg: t,
                onTap: function () {
                  o("music");
                },
              });
          }
        }
      }
      function Gt(t) {
        var e = document.getElementById("replyDelayMin"),
          n = document.getElementById("replyDelayMax"),
          i = parseFloat((e && e.value) || 2),
          a = parseFloat((n && n.value) || 5);
        (isNaN(i) && (i = 2), isNaN(a) && (a = 5));
        var o = 1e3 * (i + Math.random() * Math.max(0, a - i));
        setTimeout(function () {
          var e = window.pickWordCards ? window.pickWordCards(1) : "";
          e && Jt(e, !1, t);
        }, o);
      }
      function Ut() {
        if (e.chatInput) {
          var t = e.chatInput.value || "";
          t.trim() &&
            (!(function (t) {
              (t = (t || "").trim()) &&
                (Jt(t, !0),
                "triple" === $() && T.length >= 2 ? (Gt(0), Gt(1)) : Gt(0));
            })(t),
            (e.chatInput.value = ""));
        }
      }
      var t =
          (typeof window.AKINI_NETEASE_PROXY === "string" && window.AKINI_NETEASE_PROXY) ||
          "https://api.mc666.org.cn";
      // 自定义代理已禁用，固定使用官方代理，避免用户配置被封控代理
      window._akiniSetMusicProxy = function (url) {
        window.AKINI_NETEASE_PROXY = t;
      };
      var e = {
          page: document.getElementById("app-music"),
          bgLayer: document.getElementById("musicBgLayer"),
          backBtn: document.getElementById("musicBackBtn"),
          exitBtn: document.getElementById("musicExitBtn"),
          menuBtn: document.getElementById("musicMenuBtn"),
          menuOverlay: document.getElementById("musicMenuOverlay"),
          menuClose: document.getElementById("musicMenuClose"),
          qrWrap: document.getElementById("musicQrWrap"),
          qrImageWrap: document.getElementById("musicQrImageWrap"),
          qrFallback: document.getElementById("musicQrFallback"),
          qrImg: document.getElementById("musicQrImg"),
          qrStatus: document.getElementById("musicQrStatus"),
          qrHint: document.getElementById("musicQrHint"),
          loginInfo: document.getElementById("musicLoginInfo"),
          playlistSelect: document.getElementById("musicPlaylistSelect"),
          playlistInput: document.getElementById("musicPlaylistInput"),
          importBtn: document.getElementById("musicImportBtn"),
          platformTabs: document.getElementById("musicPlatformTabs"),
          loginRow: document.getElementById("musicLoginRow"),
          logoutBtn: document.getElementById("musicLogoutBtn"),
          phoneInput: document.getElementById("musicPhoneInput"),
          passwordInput: document.getElementById("musicPasswordInput"),
          loginCellphoneBtn: document.getElementById("musicLoginCellphoneBtn"),
          loginStatus: document.getElementById("musicLoginStatus"),
          songName: document.getElementById("musicSongName"),
          artist: document.getElementById("musicArtist"),
          listenTime: document.getElementById("musicPlayerListenTime"),
          leftAvatar: document.getElementById("musicLeftAvatar"),
          centerAvatar: document.getElementById("musicCenterAvatar"),
          rightAvatar: document.getElementById("musicRightAvatar"),
          distanceText: document.getElementById("musicDistanceText"),
          disc: document.getElementById("musicDiscWrap"),
          cover: document.getElementById("musicCover"),
          discRing: document.getElementById("musicDiscRing"),
          lyricsBox: document.getElementById("musicLyricsBox"),
          lyricsBody: document.getElementById("musicLyricsBody"),
          chatBubbles: document.getElementById("musicChatBubbles"),
          chatLeft: document.getElementById("musicChatLeft"),
          chatCenter: document.getElementById("musicChatCenter"),
          chatRight: document.getElementById("musicChatRight"),
          chatToggle: document.getElementById("musicChatToggle"),
          chatModal: document.getElementById("musicChatModal"),
          chatInput: document.getElementById("musicChatInput"),
          chatSend: document.getElementById("musicChatSend"),
          chatModalClose: document.getElementById("musicChatModalClose"),
          progress: document.getElementById("musicProgress"),
          curTime: document.getElementById("musicCurTime"),
          totalTime: document.getElementById("musicTotalTime"),
          modeBtn: document.getElementById("musicModeBtn"),
          prevBtn: document.getElementById("musicPrevBtn"),
          playBtn: document.getElementById("musicPlayBtn"),
          playIcon: document.getElementById("musicPlayIcon"),
          pauseIcon: document.getElementById("musicPauseIcon"),
          nextBtn: document.getElementById("musicNextBtn"),
          playlistBtn: document.getElementById("musicPlaylistBtn"),
          playlistOverlay: document.getElementById("musicPlaylistOverlay"),
          playlistClose: document.getElementById("musicPlaylistClose"),
          playlistClearAll: document.getElementById("musicPlaylistClearAll"),
          playlistContainer: document.getElementById("musicPlaylistContainer"),
          status: document.getElementById("musicStatus"),
          contactPicker: document.getElementById("musicContactPicker"),
          contactList: document.getElementById("musicContactList"),
          pickerBackBtn: document.getElementById("musicPickerBackBtn"),
          pickerConfirmBtn: document.getElementById("musicPickerConfirmBtn"),
          pickerOptionBtn: document.getElementById("musicPickerOptionBtn"),
          pickerSelectedInfo: document.getElementById(
            "musicPickerSelectedInfo",
          ),
          optionPicker: document.getElementById("musicOptionPicker"),
          optionList: document.getElementById("musicOptionList"),
          optionPickerClose: document.getElementById("musicOptionPickerClose"),
        };
      if (e.page) {
        var n,
          a,
          c =
            ((n = "akini_music_playlist"),
            (a = []),
            i
              ? i(n, a)
              : (function () {
                  try {
                    var t = localStorage.getItem(n);
                    return t ? JSON.parse(t) : a;
                  } catch (t) {
                    return a;
                  }
                })()),
          l =
            parseInt(localStorage.getItem("akini_music_index") || "0", 10) || 0,
          s =
            parseInt(localStorage.getItem("akini_music_mode") || "0", 10) || 0,
          d = !1,
          u = null,
          m = null,
          g = null,
          v = null,
          h = null,
          w =
            parseFloat(
              localStorage.getItem("akini_music_current_time") || "0",
            ) || 0,
          k = 0,
          _ = null,
          b = [],
          I =
            parseInt(
              localStorage.getItem("akini_music_listen_seconds") || "0",
              10,
            ) || 0,
          x = 0,
          E = "",
          S = 0,
          A = null,
          C = !1,
          B = {
            key: "",
            cookie: "",
            timer: null,
            checking: !1,
            platform: "netease",
            qrType: 1,
          };
        var listenMap = {};
        try {
          var raw = localStorage.getItem("akini_music_listen_together");
          if (raw) listenMap = JSON.parse(raw);
        } catch (e) {
          listenMap = {};
        }
        (!(function () {
          try {
            var t = localStorage.getItem("akini_netease_cookie");
            t && (B.cookie = t);
          } catch (t) {}
        })(),
          (window.isSwapped = function () {
            var t = localStorage.getItem("akini_swap_avatar_pos");
            return "true" === t || "1" === t;
          }));
        window.getMusicListenTogether = function () {
          return listenMap;
        };
        window.saveMusicListenTogether = function () {
          try {
            localStorage.setItem("akini_music_listen_together", JSON.stringify(listenMap));
          } catch (e) {}
        };
        window.getMusicCurrentTrack = function () {
          return c && c[l] ? c[l] : null;
        };
        window.isMusicPlaying = function () {
          return d;
        };
        window.getMusicSelectedContacts = function () {
          return T;
        };
        window.musicControlPrev = function () {
          var b = document.getElementById("musicPrevBtn");
          if (b) b.click();
        };
        window.musicControlToggle = function () {
          var b = document.getElementById("musicPlayBtn");
          if (b) b.click();
        };
        window.musicControlNext = function () {
          var b = document.getElementById("musicNextBtn");
          if (b) b.click();
        };
        var T = [];
        localStorage.getItem("akini_music_selected_option");
        try {
          var M = localStorage.getItem("akini_music_selected_contacts");
          M && (T = JSON.parse(M));
        } catch (t) {
          T = [];
        }
        var __akiniManualPlay = !1;
        window.syncAvatars = function (t) {
          var n = t || f();
          window.akiniContacts &&
            T.forEach(function (t) {
              var e = window.akiniContacts.getContactById(t.id);
              e && e.avatar && (t.avatar = e.avatar);
            });
          var _mcIgnore = false;
          if ("triple" === $() && T.length >= 2) {
            var i = T[0],
              a = T[1];
            if (false) {
              e.leftAvatar &&
                ((e.leftAvatar.style.display = "flex"),
                (e.leftAvatar.style.bottom = "0px"),
                (e.leftAvatar.style.transform = "translateX(-150px)"),
                (e.leftAvatar.style.filter = "grayscale(1)"),
                (e.leftAvatar.style.opacity = "0.6"),
                (e.leftAvatar.innerHTML = nt(i.avatar, 70)));
              e.centerAvatar &&
                ((e.centerAvatar.style.display = "flex"),
                (e.centerAvatar.style.bottom = "14px"),
                (e.centerAvatar.style.transform = "translateX(-50%)"),
                (e.centerAvatar.style.filter = "none"),
                (e.centerAvatar.style.opacity = "1"),
                (e.centerAvatar.innerHTML = nt(n, 70)));
              e.rightAvatar &&
                ((e.rightAvatar.style.display = "flex"),
                (e.rightAvatar.style.bottom = "0px"),
                (e.rightAvatar.style.transform = "translateX(80px)"),
                (e.rightAvatar.style.filter = "grayscale(1)"),
                (e.rightAvatar.style.opacity = "0.6"),
                (e.rightAvatar.innerHTML = nt(a.avatar, 70)));
              if (acceptBtn) acceptBtn.style.display = "none";
            } else {
              e.leftAvatar &&
                ((e.leftAvatar.style.display = "flex"),
                (e.leftAvatar.style.bottom = "0px"),
                (e.leftAvatar.style.transform =
                  "translateX(calc(-100% - 22px))"),
                (e.leftAvatar.style.filter = "none"),
                (e.leftAvatar.style.opacity = "1"),
                (e.leftAvatar.innerHTML = nt(i.avatar, 70)));
              e.centerAvatar &&
                ((e.centerAvatar.style.display = "flex"),
                (e.centerAvatar.style.bottom = "14px"),
                (e.centerAvatar.style.transform = "translateX(-50%)"),
                (e.centerAvatar.style.filter = "none"),
                (e.centerAvatar.style.opacity = "1"),
                (e.centerAvatar.innerHTML = nt(n, 70)));
              e.rightAvatar &&
                ((e.rightAvatar.style.display = "flex"),
                (e.rightAvatar.style.bottom = "0px"),
                (e.rightAvatar.style.transform = "translateX(22px)"),
                (e.rightAvatar.style.filter = "none"),
                (e.rightAvatar.style.opacity = "1"),
                (e.rightAvatar.innerHTML = nt(a.avatar, 70)));
            }
            e.chatLeft &&
              ((e.chatLeft.style.display = "flex"),
              (e.chatLeft.style.left = "calc(50% - 184px)"),
              (e.chatLeft.style.width = "120px"));
            e.chatCenter && (e.chatCenter.style.display = "flex");
            e.chatRight &&
              ((e.chatRight.style.display = "flex"),
              (e.chatRight.style.left = "calc(50% + 64px)"),
              (e.chatRight.style.width = "120px"));
            (function () {
              var t = document.getElementById("musicAvatarWrap"),
                e = document.getElementById("musicHeadphonePath");
              if (!t || !e) return;
              var n = t.clientWidth || 375,
                i = t.clientHeight || 110,
                a = 70,
                o = n / 2,
                r = ((o - 0.65 * a) / n) * 1e3,
                c = ((o + 0.65 * a) / n) * 1e3,
                l = 500,
                s = ((i - 0 - 70) / i) * 110,
                d = s + 42;
              e.setAttribute(
                "d",
                "M" + r + " " + s + " Q" + l + " " + d + " " + c + " " + s,
              );
            })();
          } else {
            var o = T.length >= 1 ? T[0].avatar : y(),
              r = (T.length >= 1 ? T[0].name : p && p(), window.isSwapped());
            if (false) {
              e.leftAvatar &&
                ((e.leftAvatar.style.display = "flex"),
                (e.leftAvatar.style.bottom = "8px"),
                (e.leftAvatar.style.transform = "translateX(-90px)"),
                (e.leftAvatar.style.filter = "grayscale(1)"),
                (e.leftAvatar.style.opacity = "0.6"),
                (e.leftAvatar.innerHTML = nt(r ? o : n, 70)));
              e.centerAvatar && (e.centerAvatar.style.display = "none");
              e.rightAvatar &&
                ((e.rightAvatar.style.display = "flex"),
                (e.rightAvatar.style.bottom = "8px"),
                (e.rightAvatar.style.transform = "translateX(20px)"),
                (e.rightAvatar.style.filter = "grayscale(1)"),
                (e.rightAvatar.style.opacity = "0.6"),
                (e.rightAvatar.innerHTML = nt(r ? n : o, 70)));
              if (acceptBtn) acceptBtn.style.display = "none";
            } else {
              e.leftAvatar &&
                ((e.leftAvatar.style.display = "flex"),
                (e.leftAvatar.style.bottom = "8px"),
                (e.leftAvatar.style.transform =
                  "translateX(calc(-100% + 3px))"),
                (e.leftAvatar.style.filter = "none"),
                (e.leftAvatar.style.opacity = "1"),
                (e.leftAvatar.innerHTML = nt(r ? o : n, 70)));
              e.centerAvatar && (e.centerAvatar.style.display = "none");
              e.rightAvatar &&
                ((e.rightAvatar.style.display = "flex"),
                (e.rightAvatar.style.bottom = "8px"),
                (e.rightAvatar.style.transform = "translateX(-3px)"),
                (e.rightAvatar.style.filter = "none"),
                (e.rightAvatar.style.opacity = "1"),
                (e.rightAvatar.innerHTML = nt(r ? n : o, 70)));
            }
            e.chatLeft &&
              ((e.chatLeft.style.display = "flex"),
              (e.chatLeft.style.left = "calc(50% - 120px)"),
              (e.chatLeft.style.width = "120px"));
            e.chatCenter && (e.chatCenter.style.display = "none");
            e.chatRight &&
              ((e.chatRight.style.display = "flex"),
              (e.chatRight.style.left = "50%"),
              (e.chatRight.style.width = "120px"));
            G();
          }
        };
        var L = null;
        ((window.startKeepAliveIsland = V),
          (window.stopKeepAliveIsland = tt),
          (window.pauseKeepAliveIsland = et),
          (window.resumeKeepAliveIsland = it),
          document.addEventListener("click", at),
          document.addEventListener("touchstart", at),
          document.addEventListener("touchend", at),
          document.addEventListener("visibilitychange", function () {
            document.hidden ? ct() : rt();
          }),
          window.addEventListener("pagehide", function () {
            ct();
          }),
          window.addEventListener("beforeunload", function () {
            ct();
          }),
          setInterval(function () {
            if (document.hidden) return;
            (rt(),
              ot() && !d && V(),
              d &&
                (Q(),
                Y(),
                u && u.paused && u.play().catch(function () {}),
                u &&
                  !u._ending &&
                  (u.ended ||
                    (u.duration &&
                      u.currentTime > 0 &&
                      u.currentTime >= u.duration - 0.3)) &&
                  ((u._ending = !0), yt())));
          }, 5e3));
        var N = null,
          P = null,
          H = [];
        ((window.isMusicListeningActive = qt),
          (window._showMusicContactPicker = function () {
            try {
              var am = document.getElementById("app-music");
              if (am) {
                am.style.display = "flex";
                am.classList.add("show");
              }
              var isListening = false;
              try {
                isListening =
                  localStorage.getItem("akini_music_listening_active") === "1";
              } catch (e) {}
              var hasContacts = false;
              try {
                hasContacts =
                  (
                    JSON.parse(
                      localStorage.getItem("akini_music_selected_contacts") ||
                        "[]",
                    ) || []
                  ).length > 0;
              } catch (e) {}
              var exited = false;
              try {
                exited = localStorage.getItem("akini_music_exited") === "1";
              } catch (e) {}
              if (isListening || (!exited && hasContacts)) {
                o("music");
                if ("function" == typeof syncAvatars) syncAvatars();
                U();
              } else {
                try {
                  localStorage.removeItem("akini_music_exited");
                } catch (e) {}
                // 保留已选联系人，退出一起听后也不清空，避免重新选人
                if (hasContacts && T.length === 0) {
                  try {
                    T = JSON.parse(
                      localStorage.getItem("akini_music_selected_contacts") ||
                        "[]",
                    );
                  } catch (e) {
                    T = [];
                  }
                  Ot();
                }
                Rt();
              }
            } catch (err) {
              console.error("[music] _showMusicContactPicker error", err);
              try {
                Rt();
              } catch (e2) {
                var _mp = document.getElementById("musicContactPicker");
                if (_mp) _mp.style.display = "flex";
              }
            }
          }),
          (window._ensureMusicContactsSelected = function () {
            return T.length > 0 || (Rt(), !1);
          }),
          /* menu button uses onpointerdown */ e.exitBtn &&
            Wt(e.exitBtn, function () {
              Pt();
              try {
                window._stopNeteaseMusic && window._stopNeteaseMusic();
              } catch (t) {}
              jt(!1);
              try {
                if (window._exitListenTogether) {
                  window._exitListenTogether();
                } else {
                  T = [];
                  saveMusicContacts();
                  Rt();
                }
              } catch (t) {}
            }),
          e.menuClose && e.menuClose.addEventListener("click", Pt),
          e.menuOverlay &&
            e.menuOverlay.addEventListener("click", function (t) {
              t.target === e.menuOverlay && Pt();
            }));
        (e.menuOverlay &&
          e.menuOverlay.addEventListener(
            "touchend",
            function (t) {
              if (t.target === e.menuOverlay) {
                t.preventDefault();
                Pt();
              }
            },
            { passive: false },
          ),
          e.menuBtn &&
            (e.menuBtn.addEventListener("click", function (t) {
              t.preventDefault();
              t.stopPropagation();
              try {
                window._startNeteaseQr && window._startNeteaseQr();
              } catch (e) {}
            }),
            e.menuBtn.addEventListener(
              "touchend",
              function (t) {
                t.preventDefault();
                t.stopPropagation();
                try {
                  window._startNeteaseQr && window._startNeteaseQr();
                } catch (e) {}
              },
              { passive: false },
            )),
          e.platformTabs &&
            e.platformTabs.addEventListener("click", function (t) {
              var e = t.target.closest(".music-platform-btn");
              e &&
                e.dataset.platform &&
                switchMusicPlatform(e.dataset.platform, !0);
            }),
          e.logoutBtn &&
            e.logoutBtn.addEventListener("click", function () {
              try {
                (localStorage.removeItem("akini_netease_cookie"),
                  localStorage.removeItem("akini_netease_uid"),
                  localStorage.removeItem("akini_netease_nickname"),
                  localStorage.removeItem("akini_netease_avatar"));
              } catch (t) {}
              ((B.cookie = ""), (B.userId = ""));
              try {
                var ls = _qrEl("musicLoginStatus");
                if (ls) ls.textContent = "未登录";
                var genBtn = _qrEl("musicQrGenerateBtn");
                if (genBtn) genBtn.style.display = "block";
                var logoutBtn = _qrEl("musicLogoutBtn");
                if (logoutBtn) logoutBtn.style.display = "none";
                var qrContainer = _qrEl("musicQrContainer");
                if (qrContainer) qrContainer.style.display = "flex";
                var accountInfo = _qrEl("musicAccountInfo");
                if (accountInfo) accountInfo.style.display = "none";
                var qrPlaceholder = _qrEl("musicQrPlaceholder");
                if (qrPlaceholder) {
                  qrPlaceholder.style.display = "block";
                  qrPlaceholder.innerHTML =
                    "点击下方按钮<br>生成扫码登录二维码";
                }
                var qrImg = _qrEl("musicQrImage");
                if (qrImg) qrImg.style.display = "none";
                var qrCanvas = _qrEl("musicQrCanvas");
                if (qrCanvas) qrCanvas.style.display = "none";
                var selectEl = _qrEl("musicPlaylistSelect");
                if (selectEl) {
                  selectEl.style.display = "none";
                  selectEl.innerHTML = "";
                }
                var statusEl = _qrEl("musicQrStatus");
                if (statusEl)
                  statusEl.textContent = "使用网易云音乐APP扫码登录";
                if (_qrTimer) {
                  clearInterval(_qrTimer);
                  _qrTimer = null;
                }
              } catch (t) {}
            }),
          e.importBtn &&
            e.importBtn.addEventListener("click", function () {
              Tt("", B.cookie).catch(function(){});
            }),
          e.playlistInput &&
            e.playlistInput.addEventListener("keydown", function (t) {
              "Enter" === t.key && Tt("", B.cookie).catch(function(){});
            }));
        var songUrlInput = document.getElementById("musicSongUrlInput");
        var songNameInput = document.getElementById("musicSongNameInput");
        var importSongBtn = document.getElementById("musicImportSongBtn");
        var importMp3 = function () {
          var url = (songUrlInput ? songUrlInput.value : "").trim();
          if (!url) {
            alert("请输入 MP3 链接");
            return;
          }
          var name = (songNameInput ? songNameInput.value : "").trim();
          if (!name) {
            name = url.split("/").pop().split("?")[0] || "自定义歌曲";
          }
          var track = {
            id: "mp3_" + Date.now(),
            title: name,
            artist: "自定义",
            cover: "",
            url: url,
            duration: 0,
          };
          var list = JSON.parse(
            localStorage.getItem("akini_music_playlist") || "[]",
          );
          list.push(track);
          localStorage.setItem("akini_music_playlist", JSON.stringify(list));
          c = list;
          l = list.length - 1;
          localStorage.setItem("akini_music_index", l);
          if (songUrlInput) songUrlInput.value = "";
          if (songNameInput) songNameInput.value = "";
          try {
            Pt();
          } catch (e) {}
          wt(c[l], !1);
          pt("已导入歌曲：" + name);
          Bt();
        };
        importSongBtn &&
          importSongBtn.addEventListener("click", importMp3);
        songUrlInput &&
          songUrlInput.addEventListener("keydown", function (t) {
            "Enter" === t.key && importMp3();
          });
        var musicMenuCloseBtn2 = document.getElementById("musicMenuCloseBtn");
        musicMenuCloseBtn2 &&
          musicMenuCloseBtn2.addEventListener("click", function (t) {
            t && t.stopPropagation && t.stopPropagation();
            try {
              Pt();
            } catch (e) {}
          });
        var musicOpenPickerBtn2 = document.getElementById("musicOpenPickerBtn");
        musicOpenPickerBtn2 &&
          Wt(musicOpenPickerBtn2, function () {
            try {
              Pt();
            } catch (e) {}
            if (window._showMusicContactPicker) {
              window._showMusicContactPicker();
            } else {
              var e = document.getElementById("musicContactPicker");
              e && (e.style.display = "flex");
            }
          });
        function updateMusicLoginStatus() {
          var t = "";
          try {
            t = localStorage.getItem("akini_netease_cookie") || "";
          } catch (t) {}
          (e.loginStatus &&
            (e.loginStatus.textContent = t ? "已登录" : "未登录"),
            e.phoneInput && (e.phoneInput.value = ""),
            e.passwordInput && (e.passwordInput.value = ""));
        }
        (e.loginCellphoneBtn &&
          e.phoneInput &&
          e.passwordInput &&
          e.loginCellphoneBtn.addEventListener("click", function () {
            var n = e.phoneInput.value || "",
              i = e.passwordInput.value || "";
            if (!n.trim() || !i.trim()) return alert("请输入手机号和密码");
            (e.loginCellphoneBtn &&
              (e.loginCellphoneBtn.textContent = "登录中…"),
              fetch(t + "/login-cellphone", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone: n.trim(), password: i }),
              })
                .then(function (t) {
                  return t.json();
                })
                .then(function (t) {
                  if (t.error || (0 !== t.code && 200 !== t.code))
                    throw new Error(t.message || t.error || "登录失败");
                  try {
                    (localStorage.setItem(
                      "akini_netease_cookie",
                      t.cookie || "",
                    ),
                      t.userId &&
                        localStorage.setItem(
                          "akini_netease_uid",
                          String(t.userId),
                        ));
                  } catch (t) {}
                  ((B.cookie = t.cookie || ""),
                    (B.userId = t.userId || 0),
                    updateMusicLoginStatus(),
                    alert(
                      "登录成功" + (t.nickname ? "，欢迎 " + t.nickname : ""),
                    ));
                })
                .catch(function (t) {
                  alert("登录失败：" + ((t && t.message) || t));
                })
                .finally(function () {
                  e.loginCellphoneBtn &&
                    (e.loginCellphoneBtn.textContent = "登录");
                }));
          }),
          e.loginRow && (e.loginRow.style.display = "flex"),
          updateMusicLoginStatus());
        var musicExitListeningBtn2 = document.getElementById(
          "musicExitListeningBtn",
        );
        window._akiniMusicExited = false;
        window._logoutNeteaseAccount = function () {
          try {
            localStorage.removeItem("akini_netease_cookie");
          } catch (e) {}
          try {
            localStorage.removeItem("akini_netease_uid");
          } catch (e) {}
          try {
            localStorage.removeItem("akini_netease_nickname");
          } catch (e) {}
          try {
            localStorage.removeItem("akini_netease_avatar");
          } catch (e) {}
          try {
            localStorage.removeItem("akini_netease_cookie_backup");
          } catch (e) {}
          try {
            localStorage.removeItem("akini_netease_login_at");
          } catch (e) {}
          try {
            localStorage.removeItem("akini_netease_playlists");
          } catch (e) {}
          try {
            updateMusicLoginStatus();
          } catch (e) {}
          try {
            var statusEl = document.getElementById("musicLoginStatus");
            if (statusEl) statusEl.textContent = "未登录";
          } catch (e) {}
          try {
            var ai = document.getElementById("musicAccountInfo");
            if (ai) ai.style.display = "none";
          } catch (e) {}
          try {
            var qrContainer = document.getElementById("musicQrContainer");
            if (qrContainer) qrContainer.style.display = "flex";
          } catch (e) {}
          try {
            var genBtn = document.getElementById("musicQrGenerateBtn");
            if (genBtn) genBtn.style.display = "block";
          } catch (e) {}
          try {
            var qrPlaceholder = document.getElementById("musicQrPlaceholder");
            if (qrPlaceholder) qrPlaceholder.style.display = "block";
          } catch (e) {}
          try {
            var qrImg = document.getElementById("musicQrImage");
            if (qrImg) qrImg.style.display = "none";
          } catch (e) {}
          try {
            var qrCanvas = document.getElementById("musicQrCanvas");
            if (qrCanvas) qrCanvas.style.display = "none";
          } catch (e) {}
          try {
            var lrb = document.getElementById("musicLoginRow");
            if (lrb) lrb.style.display = "flex";
          } catch (e) {}
          alert("已退出网易云账号");
        };
        (function () {
          var btn = document.getElementById("musicLogoutAccountBtn");
          if (btn && !btn._akiniBoundLogout) {
            btn._akiniBoundLogout = !0;
            btn.addEventListener("pointerdown", function (e) {
              e.preventDefault();
              e.stopPropagation();
              window._logoutNeteaseAccount && window._logoutNeteaseAccount();
              return false;
            });
            btn.addEventListener("click", function (e) {
              e.preventDefault();
              e.stopPropagation();
              window._logoutNeteaseAccount && window._logoutNeteaseAccount();
              return false;
            });
          }
        })();
        window._exitListenTogether = function () {
          window._akiniMusicExited = true;
          try {
            localStorage.setItem("akini_music_exited", "1");
          } catch (e) {}
          try {
            window._stopNeteaseMusic && window._stopNeteaseMusic();
          } catch (e) {}
          try {
            localStorage.setItem("akini_music_listening_active", "0");
          } catch (e) {}
          try {
            [
              "musicMenuOverlay",
              "musicPlaylistOverlay",
              "musicQrWrap",
              "musicLoginInfo",
              "musicPlaylistSelect",
              "musicOptionPicker",
              "musicExitConfirmModal",
            ].forEach(function (id) {
              var el = document.getElementById(id);
              if (el) {
                el.style.display = "none";
                el.classList.remove("show");
              }
            });
          } catch (e) {}
          try {
            var am = document.getElementById("app-music");
            if (am) {
              am.style.display = "flex";
              am.classList.add("show");
            }
            if (typeof Rt === "function") Rt();
            if (typeof zt === "function") zt();
            if (typeof Ot === "function") Ot();
            var cp = document.getElementById("musicContactPicker");
            if (cp) {
              cp.style.display = "flex";
              cp.classList.add("show");
            }
          } catch (e) {
            console.error("[exit] error", e);
          }
        };
        window._akiniMusicGoHome = function () {
          try {
            [
              "app-music",
              "app-chat",
              "app-call",
              "app-friends",
              "app-mail",
              "app-add-contact",
              "app-contact-detail",
              "app-create-group",
              "musicMenuOverlay",
              "musicContactPicker",
              "musicPlaylistOverlay",
              "musicQrWrap",
              "musicLoginInfo",
              "musicPlaylistSelect",
              "musicOptionPicker",
              "musicExitConfirmModal",
            ].forEach(function (id) {
              var el = document.getElementById(id);
              if (el) {
                el.style.display = "none";
                el.classList.remove("show");
              }
            });
            try {
              localStorage.removeItem("akini_active_chat_id");
            } catch (e) {}
            var allApps = [
              "app-chat-list",
              "app-friends",
              "app-mail",
              "app-music",
              "app-chat",
              "app-call",
              "app-add-contact",
              "app-contact-detail",
              "app-create-group",
            ];
            allApps.forEach(function (id) {
              var el = document.getElementById(id);
              if (el) {
                el.style.display = "none";
                el.classList.remove("show");
              }
            });
            var areas = [
              "settingsArea",
              "beautifyArea",
              "icityArea",
              "wordbankOverlay",
              "surveyListModal",
              "surveyCreateModal",
              "surveyDetailModal",
              "surveyCreatedListModal",
            ];
            areas.forEach(function (id) {
              var el = document.getElementById(id);
              if (el) {
                el.style.display = "none";
                el.classList.remove("show");
              }
            });
            var overlays = [
              "musicMenuOverlay",
              "musicContactPicker",
              "musicPlaylistOverlay",
              "musicQrWrap",
              "musicLoginInfo",
              "musicPlaylistSelect",
              "musicOptionPicker",
            ];
            overlays.forEach(function (id) {
              var el = document.getElementById(id);
              if (el) {
                el.style.display = "none";
                el.classList.remove("show");
              }
            });
            if (window.__akiniBackStack) window.__akiniBackStack.length = 0;
          } catch (e) {
            console.error("[goHome] error", e);
          }
        };
        /* Exit button uses onpointerdown inline handler - no addEventListener needed */
        if (musicExitListeningBtn2 && !musicExitListeningBtn2._akiniBound) {
          musicExitListeningBtn2._akiniBound = !0;
        }
        (e.playlistSelect &&
          e.playlistSelect.addEventListener("click", function (t) {
            var e = t.target.closest("[data-pid]");
            e && Tt(e.getAttribute("data-pid"), B.cookie);
          }),
          e.pickerConfirmBtn &&
            Wt(e.pickerConfirmBtn, function () {
              0 !== T.length
                ? (function () {
                    window._akiniMusicExited = false;
                    Ft();
                    jt(!0);
                    if (e.page) e.page.style.display = "block";
                    try {
                      o("music");
                      syncAvatars();
                      U();
                    } catch (e) {}
                    try {
                      Bt();
                    } catch (e) {}
                    d = !1;
                    e.playIcon &&
                      ((e.playIcon.style.display = "block"),
                      (e.pauseIcon.style.display = "none"));
                    e.disc && (e.disc.style.animationPlayState = "paused");
                  })()
                : alert("请至少选择 1 位联系人");
            }),
          e.optionPicker &&
            e.optionPicker.addEventListener("click", function (t) {
              t.target === e.optionPicker && $t();
            }),
          e.optionPickerClose && Wt(e.optionPickerClose, $t),
          e.optionList &&
            e.optionList.addEventListener("click", function (t) {
              var n = t.target.closest(".music-option-item");
              if (n) {
                var i = n.getAttribute("data-option");
                i &&
                  (function (t) {
                    0;
                    try {
                      localStorage.setItem("akini_music_selected_option", t);
                    } catch (t) {}
                    ($t(),
                      e.pickerSelectedInfo &&
                        (e.pickerSelectedInfo.textContent =
                          "已选择：" +
                          ({
                            daily: "每日推荐",
                            liked: "我喜欢的音乐",
                            chill: "轻音乐/放松",
                            hot: "热歌榜",
                          }[t] || t)));
                  })(i);
              }
            }),
          Wt(e.playBtn, function () {
            ("Notification" in window &&
              "default" === Notification.permission &&
              Notification.requestPermission().catch(function () {}),
              Et());
          }),
          Wt(e.prevBtn, function () {
            At(!0);
          }),
          Wt(e.nextBtn, function () {
            St(!0);
          }),
          Wt(e.modeBtn, function () {
            ((s = (s + 1) % 3),
              localStorage.setItem("akini_music_mode", s),
              st());
          }),
          e.playlistBtn &&
            (e.playlistBtn.addEventListener("click", function (t) {
              t.preventDefault();
              t.stopPropagation();
              Bt();
              e.playlistOverlay && (e.playlistOverlay.style.display = "flex");
            }),
            e.playlistBtn.addEventListener(
              "touchend",
              function (t) {
                t.preventDefault();
                t.stopPropagation();
                Bt();
                e.playlistOverlay && (e.playlistOverlay.style.display = "flex");
              },
              { passive: false },
            ),
            document.addEventListener("click", function (t) {
              if (
                t &&
                t.target &&
                (t.target.id === "musicPlaylistBtn" ||
                  (t.target.closest && t.target.closest("#musicPlaylistBtn")))
              ) {
                t.preventDefault();
                t.stopPropagation();
                Bt();
                e.playlistOverlay && (e.playlistOverlay.style.display = "flex");
              }
            }),
            document.addEventListener(
              "touchend",
              function (t) {
                if (
                  t &&
                  t.target &&
                  (t.target.id === "musicPlaylistBtn" ||
                    (t.target.closest && t.target.closest("#musicPlaylistBtn")))
                ) {
                  t.preventDefault();
                  t.stopPropagation();
                  Bt();
                  e.playlistOverlay &&
                    (e.playlistOverlay.style.display = "flex");
                }
              },
              { passive: false },
            )));
        var z = [];
        try {
          window._idbStore &&
            window._idbStore.get &&
            window._idbStore.get("akini_music_chat_messages", function (v) {
              if (v) {
                try {
                  var arr = JSON.parse(v);
                  Array.isArray(arr) &&
                    (z = arr.map(function (m) {
                      return {
                        text: m.text,
                        isMe: m.isMe,
                        fromIdx: m.fromIdx,
                        time: m.time,
                      };
                    }));
                } catch (e) {}
              }
            });
        } catch (e) {}
        if (
          (e.chatModal &&
            Wt(e.chatModal, function (t) {
              t &&
                t.target === e.chatModal &&
                ((e.chatModal.style.display = "none"),
                e.chatInput && (e.chatInput.value = ""));
            }),
          e.chatToggle &&
            Wt(e.chatToggle, function (t) {
              if (
                (t && t.stopPropagation && t.stopPropagation(),
                e.chatModal && (e.chatModal.style.display = "flex"),
                e.chatInput)
              )
                try {
                  e.chatInput.focus({ preventScroll: !0 });
                } catch (t) {
                  e.chatInput.focus();
                }
            }),
          e.chatModalClose &&
            Wt(e.chatModalClose, function () {
              (e.chatModal && (e.chatModal.style.display = "none"),
                e.chatInput && (e.chatInput.value = ""));
            }),
          e.chatSend &&
            Wt(e.chatSend, function () {
              Ut();
            }),
          e.chatInput &&
            e.chatInput.addEventListener("keydown", function (t) {
              ("Enter" !== t.key && 13 !== t.keyCode) || Ut();
            }),
          (window.__clearAll = function () {
            if (!c.length) {
              pt("歌单已为空");
              return;
            }
            c = [];
            try {
              localStorage.setItem("akini_music_playlist", "[]");
            } catch (t) {}
            l = 0;
            try {
              localStorage.setItem("akini_music_index", "0");
            } catch (t) {}
            xt();
            e.songName && (e.songName.textContent = "一起听");
            e.artist && (e.artist.textContent = "点击右上角导入歌单");
            e.cover &&
              (e.cover.src =
                "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7");
            Bt();
            Ht();
            pt("已删除全部歌曲");
          }),
          e.playlistClose &&
            (e.playlistClose.addEventListener("click", Ht),
            e.playlistClose.addEventListener(
              "touchend",
              function (t) {
                t.preventDefault();
                Ht();
              },
              { passive: false },
            )),
          e.playlistOverlay &&
            (e.playlistOverlay.addEventListener("click", function (t) {
              t.target === e.playlistOverlay && Ht();
            }),
            e.playlistOverlay.addEventListener(
              "touchend",
              function (t) {
                t.target === e.playlistOverlay && (t.preventDefault(), Ht());
              },
              { passive: false },
            )),
          e.playlistClearAll &&
            (e.playlistClearAll.addEventListener("click", __clearAll),
            e.playlistClearAll.addEventListener(
              "touchend",
              function (t) {
                t.preventDefault();
                __clearAll();
              },
              { passive: false },
            )),
          e.playlistContainer &&
            (function () {
              var _plTouchStartX = 0;
              var _plTouchStartY = 0;
              var _plTouchMoved = false;
              e.playlistContainer.addEventListener(
                "touchstart",
                function (t) {
                  if (t.touches.length === 1) {
                    _plTouchStartX = t.touches[0].clientX;
                    _plTouchStartY = t.touches[0].clientY;
                    _plTouchMoved = false;
                  }
                },
                { passive: true },
              );
              e.playlistContainer.addEventListener(
                "touchmove",
                function (t) {
                  if (t.touches.length === 1) {
                    var dx = Math.abs(t.touches[0].clientX - _plTouchStartX);
                    var dy = Math.abs(t.touches[0].clientY - _plTouchStartY);
                    if (dx > 8 || dy > 8) _plTouchMoved = true;
                  }
                },
                { passive: true },
              );
              function __plTap(t) {
                var n = t.target.closest(".playlist-del-btn");
                if (n)
                  return (
                    t.stopPropagation(),
                    void (function (t) {
                      if (!(!c.length || t < 0 || t >= c.length)) {
                        c.splice(t, 1);
                        try {
                          localStorage.setItem(
                            "akini_music_playlist",
                            JSON.stringify(c),
                          );
                        } catch (t) {}
                        if (0 === c.length) {
                          l = 0;
                          try {
                            localStorage.setItem("akini_music_index", "0");
                          } catch (t) {}
                          (xt(),
                            e.songName && (e.songName.textContent = "一起听"),
                            e.artist &&
                              (e.artist.textContent = "点击右上角导入歌单"),
                            e.cover &&
                              (e.cover.src =
                                "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"),
                            pt("歌单已清空"));
                        } else if (t === l) {
                          l >= c.length && (l = c.length - 1);
                          try {
                            localStorage.setItem(
                              "akini_music_index",
                              String(l),
                            );
                          } catch (t) {}
                          It();
                        } else if (t < l) {
                          l--;
                          try {
                            localStorage.setItem(
                              "akini_music_index",
                              String(l),
                            );
                          } catch (t) {}
                        }
                        Bt();
                      }
                    })(parseInt(n.getAttribute("data-del-idx"), 10))
                  );
                var i = t.target.closest("[data-idx]");
                if (i) {
                  var a = parseInt(i.getAttribute("data-idx"), 10),
                    o = c[a];
                  o && o.id && !kt(o)
                    ? (_t(),
                      wt(o, !1)
                        .then(function () {
                          ((l = a), It(), Ht());
                        })
                        .catch(function () {
                          ((l = a), It(), Ht());
                        }))
                    : ((l = a), It(), Ht());
                }
              }
              e.playlistContainer.addEventListener("click", function (t) {
                __plTap(t);
              });
              e.playlistContainer.addEventListener(
                "touchend",
                function (t) {
                  if (_plTouchMoved) {
                    _plTouchMoved = false;
                    t.preventDefault();
                    return;
                  }
                  t.preventDefault();
                  __plTap(t);
                },
                { passive: false },
              );
            })(),
          e.progress &&
            e.progress.addEventListener("input", function () {
              var t = parseFloat(e.progress.value) || 0;
              ((w = (t / 100) * k),
                u && u.duration && (u.currentTime = w),
                ft());
            }),
          e.backBtn)
        ) {
          /* back button uses onpointerdown inline handler */
        }
        if (
          (window.addEventListener("storage", function (t) {
            (("akini_my_avatar" !== t.key &&
              "akini_ta_avatar" !== t.key &&
              "akini_swap_avatar_pos" !== t.key) ||
              syncAvatars(),
              "akini_music_bg" === t.key && U());
          }),
          window.addEventListener("resize", function () {
            G();
          }),
          (window._stopNeteaseMusic = function () {
            if ((X(), u))
              try {
                u.pause();
              } catch (t) {}
            (ut(), Y(), ot() ? it() : __akiniStopAudio());
          }),
          G(),
          st(),
          syncAvatars(),
          U(),
          lt(),
          ot() && (window.requestWakeLock && window.requestWakeLock(), V()),
          c[l])
        ) {
          var R = c[l];
          ((e.songName.textContent = R.title || "未知歌曲"),
            (e.artist.textContent = R.artist || "未知歌手"));
          var F =
            R.cover ||
            "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
          (F &&
            !F.startsWith("data:") &&
            (F = F.replace(/(\?.*)?$/, "?param=500y500")),
            (e.cover.src = F),
            (k = bt(R.duration)),
            ft());
          var q = !1;
          d = !1;
          e.playIcon &&
            ((e.playIcon.style.display = "block"),
            (e.pauseIcon.style.display = "none"));
          e.disc && (e.disc.style.animationPlayState = "paused");
          try {
            localStorage.setItem("akini_music_playing", "0");
          } catch (t) {}
          (wt(R, q), pt("已预加载: " + (R.title || "未知")));
        } else
          ((e.songName.textContent = "一起听"),
            (e.artist.textContent = "点击右上角导入歌单"),
            pt("歌单为空，请先导入歌单"));
      }
      function saveMusicContacts() {
        try {
          localStorage.setItem(
            "akini_music_selected_contacts",
            JSON.stringify(T),
          );
        } catch (t) {}
      }
      function $() {
        return T.length >= 2 ? "triple" : "dual";
      }
      function W(t) {
        if (!isFinite(t) || null == t) return "--:--";
        var e = (t = Math.floor(t)) % 60;
        return Math.floor(t / 60) + ":" + (e < 10 ? "0" + e : e);
      }
      function J(t) {
        return String(t)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");
      }
      function G() {
        var t = document.getElementById("musicAvatarWrap"),
          e = document.getElementById("musicHeadphonePath");
        if (t && e) {
          return;
          var n = t.clientWidth || 375,
            i = t.clientHeight || 110,
            a = n / 2,
            o = ((a - 20) / n) * 1e3,
            r = ((a + 20) / n) * 1e3,
            c = ((i - 8 - 70) / i) * 110,
            l = c + 20;
          e.setAttribute(
            "d",
            "M" + o + " " + c + " Q500 " + l + " " + r + " " + c,
          );
        }
      }
      function U() {
        var t = document.getElementById("musicDarkOverlay");
        D("akini_music_bg", function (n) {
          (e.bgLayer &&
            (n
              ? ((e.bgLayer.style.backgroundImage = "url(" + n + ")"),
                (e.bgLayer.style.display = "block"))
              : ((e.bgLayer.style.backgroundImage = "none"),
                (e.bgLayer.style.display = "none"))),
            t &&
              (t.style.background = n
                ? "radial-gradient(circle at 50% 40%, rgba(0,0,0,0.30) 0%, rgba(15,15,18,0.55) 70%, rgba(15,15,18,0.75) 100%)"
                : "radial-gradient(circle at 50% 40%, transparent 0%, rgba(15,15,18,0.75) 70%, rgba(15,15,18,0.92) 100%)"));
        });
      }
      function K() {
        (x || (x = Date.now()), Y());
      }
      function X() {
        if (!x) return;
        var delta = Math.floor((Date.now() - x) / 1e3);
        if (delta > 0) {
          I += delta;
          if (T && T.length) {
            T.forEach(function (t) {
              if (t && t.id) listenMap[t.id] = (listenMap[t.id] || 0) + delta;
            });
          }
          try {
            localStorage.setItem("akini_music_listen_together", JSON.stringify(listenMap));
          } catch (e) {}
        }
        x = 0;
        localStorage.setItem("akini_music_listen_seconds", String(I));
      }
      setInterval(function () {
        if (d && x) {
          var delta = Math.floor((Date.now() - x) / 1e3);
          if (delta > 0) {
            I += delta;
            x = Date.now();
            localStorage.setItem("akini_music_listen_seconds", String(I));
            if (T && T.length) {
              T.forEach(function (t) {
                if (t && t.id) listenMap[t.id] = (listenMap[t.id] || 0) + delta;
              });
              try {
                localStorage.setItem("akini_music_listen_together", JSON.stringify(listenMap));
              } catch (e) {}
            }
          }
        }
      }, 10000);
      function Y() {
        try {
          if ("mediaSession" in navigator && navigator.mediaSession) {
            var t = c[l] || {},
              e = t.title || "未知歌曲",
              n = t.artist || "未知歌手",
              i = t.cover || "",
              a = [];
            (i &&
              (a.push({
                src: i.replace(/(\?.*)?$/, "?param=500y500"),
                sizes: "500x500",
                type: "image/jpeg",
              }),
              a.push({
                src: i.replace(/(\?.*)?$/, "?param=96y96"),
                sizes: "96x96",
                type: "image/jpeg",
              }),
              a.push({
                src: i.replace(/(\?.*)?$/, "?param=256y256"),
                sizes: "256x256",
                type: "image/jpeg",
              })),
              (navigator.mediaSession.metadata = new MediaMetadata({
                title: e,
                artist: n,
                album: "一起听",
                artwork: a,
              })),
              (navigator.mediaSession.playbackState = d
                ? "playing"
                : "paused"));
            try {
              navigator.mediaSession.setPositionState({
                duration: k || (u && u.duration) || 0,
                playbackRate: 1,
                position: w || 0,
              });
            } catch (t) {}
            try {
              navigator.mediaSession.setActionHandler("play", function () {
                Et();
              });
            } catch (t) {}
            try {
              navigator.mediaSession.setActionHandler("pause", function () {
                xt();
              });
            } catch (t) {}
            try {
              navigator.mediaSession.setActionHandler(
                "previoustrack",
                function () {
                  At();
                },
              );
            } catch (t) {}
            try {
              navigator.mediaSession.setActionHandler("nexttrack", function () {
                St();
              });
            } catch (t) {}
            try {
              navigator.mediaSession.setActionHandler(
                "seekbackward",
                function () {
                  u.currentTime = Math.max(0, u.currentTime - 10);
                },
              );
            } catch (t) {}
            try {
              navigator.mediaSession.setActionHandler(
                "seekforward",
                function () {
                  u.currentTime = Math.min(
                    k || u.duration || 0,
                    u.currentTime + 10,
                  );
                },
              );
            } catch (t) {}
          }
        } catch (t) {
          console.warn("mediaSession 设置失败", t);
        }
      }
      function Q() {
        try {
          var t = window.AudioContext || window.webkitAudioContext;
          if (!t) return;
          if (m && g && "running" === m.state) return;
          (m || (m = new t()),
            "suspended" === m.state && m.resume().catch(function () {}),
            g ||
              ((g = m.createOscillator()),
              (v = m.createGain()),
              (g.type = "sine"),
              (g.frequency.value = 0.01),
              (v.gain.value = 0.001),
              g.connect(v),
              v.connect(m.destination),
              g.start()));
        } catch (t) {
          console.warn("后台保活启动失败", t);
        }
      }
      function __akiniStopAudio() {
        try {
          (g && (g.stop(), g.disconnect(), (g = null)),
            v && (v.disconnect(), (v = null)));
        } catch (t) {}
      }
      function V() {
        try {
          if (h && !h.paused) return;
          if (
            (h ||
              (((h = document.createElement("audio")).loop = !0),
              (h.preload = "auto"),
              (h.volume = 0.001),
              (h.muted = !1),
              (h.src =
                "data:audio/wav;base64,UklGRsQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YaAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"),
              h.setAttribute("playsinline", ""),
              h.setAttribute("webkit-playsinline", ""),
              h.setAttribute("x5-playsinline", ""),
              dt(h)),
            h.play().catch(function (t) {
              (console.warn("keepAliveAudio play failed", t),
                t &&
                  "NotAllowedError" === t.name &&
                  (L && clearTimeout(L),
                  (L = setTimeout(function () {
                    !ot() || (u && !u.paused) || V();
                  }, 2e3))));
            }),
            "mediaSession" in navigator &&
              navigator.mediaSession &&
              (!u || u.paused))
          )
            try {
              var t =
                'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none"><rect x="0" y="0" width="100" height="100" rx="0" fill="%23000000"/><text x="50" y="68" text-anchor="middle" font-family="Arial, sans-serif" font-size="52" font-weight="700" fill="%23ffffff">A</text></svg>';
              ((navigator.mediaSession.metadata = new MediaMetadata({
                title: "Akini",
                artist: "后台运行中",
                album: "后台保活",
                artwork: [
                  { src: t, sizes: "512x512", type: "image/svg+xml" },
                  { src: t, sizes: "256x256", type: "image/svg+xml" },
                  { src: t, sizes: "128x128", type: "image/svg+xml" },
                  { src: t, sizes: "96x96", type: "image/svg+xml" },
                  { src: t, sizes: "32x32", type: "image/svg+xml" },
                ],
              })),
                (navigator.mediaSession.playbackState = "playing"));
            } catch (t) {}
        } catch (t) {
          console.warn("保活灵动岛启动失败", t);
        }
      }
      function __akiniMediaPause() {
        try {
          h && (h.pause(), (h.currentTime = 0));
        } catch (t) {}
        if (
          "mediaSession" in navigator &&
          navigator.mediaSession &&
          (!u || u.paused)
        )
          try {
            navigator.mediaSession.playbackState = "none";
          } catch (t) {}
      }
      function et() {
        L && (clearTimeout(L), (L = null));
        try {
          h && h.pause();
        } catch (t) {}
      }
      function it() {
        !ot() || (u && !u.paused) || V();
      }
      function at() {
        try {
          !ot() || (u && !u.paused) || V();
        } catch (t) {}
      }
      function ot() {
        var t = document.getElementById("keepAliveToggle");
        return t && t.classList.contains("on");
      }
      function rt() {
        ot() ? V() : __akiniMediaPause();
      }
      function ct() {
        (ot() && (V(), Q()),
          __akiniManualPlay &&
            d &&
            (Q(), u && u.paused && u.play().catch(function () {})));
      }
      function lt() {
        var selectedSeconds = 0;
        if (T && T.length > 0) {
          var nowDelta = x ? Math.floor((Date.now() - x) / 1e3) : 0;
          T.forEach(function (ct) {
            if (ct && ct.id) {
              selectedSeconds += (listenMap[ct.id] || 0) + nowDelta;
            }
          });
        }
        var totalDisplay = selectedSeconds > 0 ? selectedSeconds : I + (x ? Math.floor((Date.now() - x) / 1e3) : 0);
        var n = Math.floor(totalDisplay / 60),
          i = Math.floor(n / 60),
          a = "";
        i > 0 && (a += i + " 小时 ");
        var names = "";
        if (T && T.length > 0) {
          names = T.map(function (ct) { return ct.name || "TA"; }).join("、");
        } else {
          names = "TA";
        }
        var timeText = "一起听了 " + (a += (n % 60) + " 分钟");
        var fullText = "TA就在你的身边 " + timeText;
        e.distanceText && (e.distanceText.textContent = fullText);
        e.listenTime && (e.listenTime.textContent = timeText);
      }
      function st() {
        var t = [
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2.1l4 4-4 4"/><path d="M3 12.2v-1.8A4.4 4.4 0 0 1 7.4 6h11.6"/><path d="M7 21.9l-4-4 4-4"/><path d="M21 11.8v1.8A4.4 4.4 0 0 1 16.6 18H5"/></svg>',
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2.1l4 4-4 4"/><path d="M3 12.2v-1.8A4.4 4.4 0 0 1 7.4 6h11.6"/><path d="M7 21.9l-4-4 4-4"/><path d="M21 11.8v1.8A4.4 4.4 0 0 1 16.6 18H5"/><circle cx="12" cy="12" r="2.5" fill="rgba(255,255,255,0.85)" stroke="none"/></svg>',
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"/><path d="M4 20L21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/></svg>',
        ];
        e.modeBtn &&
          ((e.modeBtn.innerHTML = t[s] || t[0]),
          (e.modeBtn.title = ["列表循环", "单曲循环", "随机播放"][s] || ""));
      }
      function dt(t) {
        t &&
          ((t.style.cssText =
            "position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;"),
          t.setAttribute("aria-hidden", "true"),
          t.setAttribute("playsinline", ""),
          t.setAttribute("webkit-playsinline", ""),
          t.setAttribute("x5-playsinline", ""),
          t.parentNode || document.body.appendChild(t));
      }
      function ut() {
        _ && (clearInterval(_), (_ = null));
      }
      function mt() {
        (ut(),
          (_ = setInterval(function () {
            if (u && !u.paused && u.currentTime > 0) {
              w = u.currentTime;
            } else if (!u || u.paused) {
              w += 1;
            }
            if (k && w >= k) return ((w = 0), X(), void yt());
            (ft(), gt());
          }, 1000)),
          K());
      }
      function ft() {
        var t = k ? (w / k) * 100 : 0;
        (e.progress && (e.progress.value = t),
          e.curTime && (e.curTime.textContent = W(w)),
          e.totalTime && (e.totalTime.textContent = W(k)),
          lt());
      }
      function gt() {
        N ||
          (N = requestAnimationFrame(function () {
            ((N = null), Mt());
          }));
      }
      var _spRaf = null,
        _spLastTs = 0,
        _spLastW = 0;
      function _smoothProg() {
        if (!u || u.paused || !d || k <= 0) {
          _spRaf = null;
          return;
        }
        var el = (performance.now() - _spLastTs) / 1000,
          iw = _spLastW + el;
        if (iw < k) {
          if (e.progress) e.progress.value = (iw / k) * 100;
          if (e.curTime) {
            var m = Math.floor(iw / 60),
              s = Math.floor(iw % 60);
            e.curTime.textContent = m + ":" + (s < 10 ? "0" + s : s);
          }
        }
        _spRaf = requestAnimationFrame(_smoothProg);
      }
      function _startSmooth() {
        ((_spLastTs = performance.now()),
          (_spLastW = w),
          _spRaf || _smoothProg());
      }
      function _stopSmooth() {
        _spRaf && (cancelAnimationFrame(_spRaf), (_spRaf = null));
      }
      function yt() {
        ((__akiniManualPlay = !1),
          (w = 0),
          X(),
          1 === s
            ? It()
            : 2 === s
              ? (function () {
                  if (!c.length) return;
                  var t;
                  if (1 === c.length) t = 0;
                  else
                    do {
                      t = Math.floor(Math.random() * c.length);
                    } while (t === l);
                  var e = c[t];
                  e && e.id && !kt(e)
                    ? (_t(),
                      wt(e, !1)
                        .then(function () {
                          ((l = t), It());
                        })
                        .catch(function () {
                          ((l = t), It());
                        }))
                    : ((l = t), It());
                })()
              : St());
      }
      function xt() {
        d = !1;
        try {
          localStorage.setItem("akini_music_playing", "0");
        } catch (t) {}
        u && u.pause && u.pause();
        if (e.playIcon) e.playIcon.style.display = "block";
        if (e.pauseIcon) e.pauseIcon.style.display = "none";
        if (e.disc) e.disc.style.animationPlayState = "paused";
        et();
        Y();
      }
      function Ct() {
        d = !0;
        try {
          localStorage.setItem("akini_music_playing", "1");
        } catch (t) {}
        if (e.playIcon) e.playIcon.style.display = "none";
        if (e.pauseIcon) e.pauseIcon.style.display = "block";
        if (e.disc) e.disc.style.animationPlayState = "running";
        u && u.paused && u.src && ht();
        Q();
        Y();
      }
      function Et() {
        if (d) xt();
        else {
          var n = c[l];
          if (n && !kt(n)) {
            __akiniManualPlay = !0;
            wt(n, !0)
              .then(function () {
                Ct();
              })
              .catch(function () {
                Ct();
              });
          } else {
            Ct();
          }
        }
      }
      function At(prev) {
        if (!c.length) return;
        __akiniManualPlay = !0;
        w = 0;
        try {
          localStorage.setItem("akini_music_current_time", "0");
        } catch (t) {}
        if (prev) {
          l = l > 0 ? l - 1 : c.length - 1;
        } else {
          l = l < c.length - 1 ? l + 1 : 0;
        }
        try {
          localStorage.setItem("akini_music_index", String(l));
        } catch (t) {}
        // 清理旧音频，避免切歌后仍播放上一首
        if (u) {
          try {
            u.pause();
            u.removeAttribute("src");
            u.load();
          } catch (t) {}
        }
        (E = null), (S = 0), (A = null);
        It();
      }
      function St(next) {
        At(false);
      }
      function pt(t) {
        e.status && (e.status.textContent = t);
      }
      function vt(e, n) {
        if (e) {
          if (
            (u ||
              (((u = document.createElement("audio")).preload = "auto"),
              u.setAttribute("playsinline", ""),
              u.setAttribute("webkit-playsinline", ""),
              u.setAttribute("x5-playsinline", ""),
              dt(u),
              u.addEventListener("loadedmetadata", function () {
                if (
                  (u &&
                    u.duration &&
                    isFinite(u.duration) &&
                    u.duration > 0 &&
                    (k = Math.floor(u.duration)),
                  u && w > 0 && u.currentTime !== w)
                )
                  try {
                    u.currentTime = w;
                  } catch (t) {}
                (ft(), pt("已获取歌曲时长"));
              }),
              u.addEventListener("timeupdate", function () {
                if (u) {
                  ((w = u.currentTime),
                    (_spLastTs = performance.now()),
                    (_spLastW = w),
                    ft(),
                    gt(),
                    w > 0 && pt(""));
                  try {
                    localStorage.setItem("akini_music_current_time", String(w));
                  } catch (t) {}
                  d &&
                    u.duration &&
                    u.currentTime > 0 &&
                    u.currentTime >= u.duration - 0.3 &&
                    !u._ending &&
                    ((u._ending = !0), yt());
                }
              }),
              u.addEventListener("ended", function () {
                (u && (u._ending = !0), yt());
              }),
              u.addEventListener("loadstart", function () {
                (console.log("audio loadstart", u && u.src),
                  pt("正在加载音颞…"));
              }),
              u.addEventListener("canplay", function () {
                (console.log(
                  "audio canplay",
                  u && u.src,
                  "readyState",
                  u.readyState,
                ),
                  pt("音颞可播放"));
              }),
              u.addEventListener(
                "error",
                function (i) {
                  var a = u && u.error ? u.error.code : "unknown",
                    o =
                      "音颞加载失败(" +
                      a +
                      ") 网络状态:" +
                      (u && u.networkState) +
                      " 就绪状态:" +
                      (u && u.readyState);
                  (console.warn(
                    "音颞加载/播放错误",
                    a,
                    i,
                    u && u.error && u.error.message,
                    "src",
                    u && u.src,
                    "networkState",
                    u && u.networkState,
                    "readyState",
                    u && u.readyState,
                  ),
                    pt(o));
                  if (4 === a) pt("该歌曲无法播放，可能为 VIP 或版权受限");
                  else if (3 === a) pt("音频解码失败，尝试切换歌曲");
                  else if (2 === a) pt("网络错误，请检查网络连接");
                  else if (1 === a) pt("音频加载被中断");
                  var r = (e.match(/id=([^&?]+)/) || ["", ""])[1] || "",
                    s = r
                      ? "https://music.163.com/song/media/outer/url?id=" +
                        encodeURIComponent(r) +
                        ".mp3"
                      : "",
                    d =
                      e &&
                      (/\.(m4a|flac)(\?|$)/i.test(e) ||
                        -1 === e.indexOf(".mp3")),
                    m = (B && B.cookie) || "";
                  if (!m)
                    try {
                      m = localStorage.getItem("akini_netease_cookie") || "";
                    } catch (i) {}
                  // 防止同一首歌反复失败导致界面卡死
                  if (!window._akiniAudioErrCounts) window._akiniAudioErrCounts = {};
                  var errKey = String(c[l] && c[l].id || r || e || "_");
                  window._akiniAudioErrCounts[errKey] = (window._akiniAudioErrCounts[errKey] || 0) + 1;
                  if (window._akiniAudioErrCounts[errKey] > 3) {
                    console.warn("[Akini Music] 同一首歌错误次数过多，停止重试", errKey);
                    pt("该歌曲无法播放，自动切换下一首");
                    window._akiniAudioErrCounts[errKey] = 0;
                    setTimeout(function () { St(); }, 800);
                    return;
                  }
                  if ((4 === a || d) && r && "retry" !== n && "retry2" !== n) {
                    if ("proxy" === n) return void setTimeout(function(){ vt(s, "retry"); }, 200);
                    var f = t + "/song/url?id=" + encodeURIComponent(r) + "&br=999000";
                    return (
                      m && (f += "&cookie=" + encodeURIComponent(m)),
                      f += "&realIP=" + encodeURIComponent(window._neteaseRealIp || "223.5.5.5"),
                      void setTimeout(function(){ vt(f, "proxy"); }, 200)
                    );
                  }
                  if ("fetch" === n || "fetch-retry" === n) {
                    if (
                      ((f = r
                        ? t + "/song/url?id=" + encodeURIComponent(r) + "&br=999000"
                        : "") &&
                        m &&
                        (f += "&cookie=" + encodeURIComponent(m)),
                      f && (f += "&realIP=" + encodeURIComponent(window._neteaseRealIp || "223.5.5.5")),
                      f)
                    )
                      return void setTimeout(function(){ vt(f, "proxy"); }, 200);
                  } else if ("proxy" === n) {
                    if (s) return void setTimeout(function(){ vt(s, "retry"); }, 200);
                  } else if ("retry" === n) {
                    ((E = null), (S = 0), (A = null));
                    var g = c[l];
                    if (g && g.id) return void setTimeout(function(){ wt(g, !0, !0); }, 200);
                    if (e)
                      return void setTimeout(function(){ vt(
                        e +
                          (e.indexOf("?") > -1 ? "&" : "?") +
                          "_retry=" +
                          Date.now(),
                        "retry2",
                      ); }, 200);
                  } else {
                    if ("retry2" === n && e)
                      return void setTimeout(function(){ vt(
                        e +
                          (e.indexOf("?") > -1 ? "&" : "?") +
                          "_retry2=" +
                          Date.now(),
                        "retry3",
                      ); }, 200);
                    (pt("当前歌曲无法播放，自动切换下一首"),
                      setTimeout(function () {
                        St();
                      }, 800));
                  }
                },
                u.addEventListener("stalled", function () {
                  console.warn("audio stalled", u && u.src);
                  pt("音频加载停滞，请检查网络");
                }),
              ),
              u.addEventListener("play", function () {
                d = !0;
                try {
                  localStorage.setItem("akini_music_playing", "1");
                } catch (t) {}
                (K(),
                  u && ((u.muted = !1), (u.volume = 1)),
                  Y(),
                  et(),
                  Q(),
                  _startSmooth());
                var _ctsStart = u.currentTime,
                  _ctsTimer = setTimeout(function () {
                    if (u && u.currentTime === _ctsStart && !u.paused) {
                      console.warn("audio currentTime not advancing", u.src);
                      u.dispatchEvent(new Event("error"));
                    }
                  }, 2500);
              }),
              u.addEventListener("pause", function () {
                d = !1;
                try {
                  localStorage.setItem("akini_music_playing", "0");
                } catch (t) {}
                (X(), Y(), it(), _stopSmooth());
              }),
              u.addEventListener("playing", function () {
                (et(), Q(), Y(), pt(""));
                // 播放成功时重置错误计数
                if (c[l] && c[l].id && window._akiniAudioErrCounts) {
                  window._akiniAudioErrCounts[String(c[l].id)] = 0;
                }
              })),
            u)
          ) {
            ((u.muted = !1), (u.volume = 1));
            try {
              u.currentTime = 0;
            } catch (t) {}
            u.crossOrigin = null;
          }
          (u.src !== e && ((u.src = e), u.load()), ht());
        } else mt();
      }
      function ht(t) {
        if (u && __akiniManualPlay) {
          ((t = t || 0), P && (clearTimeout(P), (P = null)));
          if (!u.src) {
            pt("歌曲地址未加载，正在获取…");
            u.dispatchEvent(new Event("error"));
            return;
          }
          ((u.muted = !1),
            (u.volume = 1),
            m && "suspended" === m.state && m.resume().catch(function () {}));
          var e = u.play();
          e &&
            e.catch &&
            e.catch(function (e) {
              (console.warn("播放被阻止或失败", e),
                e && "NotAllowedError" === e.name
                  ? (pt("请点击播放按钮开始播放"), xt())
                  : e && "AbortError" === e.name && t < 5
                    ? (P = setTimeout(function () {
                        ht(t + 1);
                      }, 300))
                    : e && "NotSupportedError" === e.name
                      ? (pt("播放失败：" + e.name),
                        u.dispatchEvent(new Event("error")))
                      : (pt("播放失败：" + ((e && e.name) || "未知")), mt()));
            });
        }
      }
      function wt(e, n, i) {
        if (!e || !e.id) return Promise.resolve();
        // 自定义 MP3 链接歌曲：直接使用其 url，无需请求网易云接口
        if (e.url) {
          ((E = e.url), (S = Date.now()), (A = e.id), vt(e.url, i ? "fetch-retry" : "fetch"));
          return Promise.resolve();
        }
        var a = (B && B.cookie) || "";
        if (!a)
          try {
            a = localStorage.getItem("akini_netease_cookie") || "";
          } catch (t) {}
        if (!n && !i && kt(e)) {
          // 命中缓存时仍需把当前 URL 设置给音频，避免旧音频继续播放
          return E && vt(E, i ? "fetch-retry" : "fetch"), Promise.resolve();
        }
        var o = t + "/song/url?id=" + encodeURIComponent(String(e.id)) + "&br=999000&cookie=" + encodeURIComponent(a || "") + "&realIP=" + encodeURIComponent((window._neteaseRealIp || "223.5.5.5"));
        return fetch(o)
          .then(function (t) {
            return t.json().catch(function () {
              return {};
            });
          })
          .then(function (t) {
            var data = t && t.data && t.data[0] ? t.data[0] : {};
            var o = data.url || "";
            if (o) {
              ((E = o),
                (S = Date.now()),
                (A = e.id),
                vt(o, i ? "fetch-retry" : "fetch"));
              return;
            }
            var fb =
              "https://music.163.com/song/media/outer/url?id=" +
              encodeURIComponent(e.id) +
              ".mp3";
            ((E = fb),
              (S = Date.now()),
              (A = e.id),
              vt(fb, i ? "fetch-retry" : "fetch"));
            if (!n)
              pt("该歌曲暂时无法播放，可能是 VIP 歌曲，正在尝试备用地址…");
          })
          .catch(function () {
            var fb =
              "https://music.163.com/song/media/outer/url?id=" +
              encodeURIComponent(e.id) +
              ".mp3";
            ((E = fb),
              (S = Date.now()),
              (A = e.id),
              vt(fb, i ? "fetch-retry" : "fetch"));
            if (!n) pt("歌曲地址获取失败，正在尝试备用地址…");
          });
      }
      function kt(t) {
        return E && A === (t && t.id) && Date.now() - S < 6e5;
      }
      function _t() {
        if (!C) {
          C = !0;
          var t = window.AudioContext || window.webkitAudioContext;
          if (t && !m)
            try {
              m = new t();
            } catch (t) {}
          m && "suspended" === m.state && m.resume().catch(function () {});
        }
      }
      function bt(t) {
        if (null == t) return 0;
        var e = parseFloat(t);
        return !isFinite(e) || e <= 0
          ? 0
          : (e > 6e4 && (e /= 1e3), Math.floor(e));
      }
      function It() {
        var n = c[l];
        if (!n)
          return (
            (e.songName.textContent = "一起听"),
            (e.artist.textContent = "点击右上角导入歌单"),
            void pt("歌单为空，请先导入")
          );
        (_t(), Q(), et(), Y(), pt("准备播放: " + (n.title || "未知")), (w = 0));
        try {
          localStorage.setItem("akini_music_current_time", "0");
        } catch (t) {}
        k = 0;
        if (u) {
          u._ending = !1;
          try {
            u.currentTime = 0;
          } catch (t) {}
        }
        _spLastW = 0;
        _spLastTs = performance.now();
        ((k = bt(n.duration)),
          (e.songName.textContent = n.title || "未知歌曲"),
          (e.artist.textContent = n.artist || "未知歌手"));
        var i =
          n.cover ||
          "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
        (i &&
          !i.startsWith("data:") &&
          (i = i.replace(/(\?.*)?$/, "?param=500y500")),
          (e.cover.src = i),
          (d = __akiniManualPlay),
          u && (u._ending = !1));
        __akiniManualPlay = !0;
        ft();
        wt(n, !0)
          .then(function () {
            (Ct(),
              e.disc &&
                (e.disc.style.animationPlayState = d ? "running" : "paused"),
              ft());
          })
          .catch(function () {
            (Ct(),
              e.disc &&
                (e.disc.style.animationPlayState = d ? "running" : "paused"),
              ft());
          });
        (function (e) {
          function loadLyric(retryCount) {
            if (!e) return Promise.resolve();
            console.log("[Akini lyric] loading id", e);
            var lyricCookie = (B && B.cookie) || "";
          try {
            lyricCookie = lyricCookie || localStorage.getItem("akini_netease_cookie") || "";
          } catch (x) {}
          return fetch(
            t +
            "/lyric?id=" +
            encodeURIComponent(String(e)) +
            "&cookie=" +
            encodeURIComponent(lyricCookie) +
            "&realIP=" +
            encodeURIComponent(window._neteaseRealIp || "223.5.5.5")
          )
              .then(function (t) {
                return t.json();
              })
              .then(function (t) {
                console.log("[Akini lyric] response", t);
                if (
                  t &&
                  t.code !== 200 &&
                  t.code !== 0 &&
                  t.code !== -190000 &&
                  t.code !== -190001
                )
                  throw new Error(t.message || t.msg || "歌词接口错误");
                var rawLyric = "";
                t.lrc && t.lrc.lyric
                  ? (rawLyric = t.lrc.lyric)
                  : t.klyric && t.klyric.lyric
                    ? (rawLyric = t.klyric.lyric)
                    : t.tlyric && t.tlyric.lyric
                      ? (rawLyric = t.tlyric.lyric)
                      : "string" == typeof t.lyric
                        ? (rawLyric = t.lyric)
                        : "string" == typeof t.lrc
                          ? (rawLyric = t.lrc)
                          : "";
                if (!rawLyric) {
                  if (t.nolyric) {
                    pt("此歌曲暂无歌词");
                    b = [];
                    H = [];
                    Mt();
                    return "";
                  }
                  if (t.uncollected) {
                    pt("歌词暂未收集");
                    b = [];
                    H = [];
                    Mt();
                    return "";
                  }
                  if (retryCount > 0) {
                    console.log("[Akini lyric] retry", retryCount);
                    return new Promise(function (r) {
                      setTimeout(function () {
                        r(loadLyric(retryCount - 1));
                      }, 500);
                    });
                  }
                }
                rawLyric &&
                  (function (lyr) {
                    var lines = [];
                    lyr.split("\n").forEach(function (line) {
                      var m = line.match(
                        /^\[(\d{2}):(\d{2})(?:\.(\d{1,3}))?\](.*)$/,
                      );
                      if (m) {
                        var sec = 60 * parseInt(m[1], 10) + parseInt(m[2], 10);
                        lines.push({ time: sec, text: m[4].trim() });
                      }
                    });
                    b = lines.sort(function (a, b) {
                      return a.time - b.time;
                    });
                    H = [];
                    Mt();
                  })(rawLyric);
                rawLyric || ((b = []), (H = []), Mt());
                return rawLyric;
              })
              .catch(function (err) {
                console.warn("[Akini lyric] failed", err);
                pt("歌词加载失败");
                e.lyricsBody &&
                  (e.lyricsBody.innerHTML =
                    '<div style="text-align:center;padding:40px 0;color:rgba(255,255,255,0.35);font-size:13px;">歌词加载失败</div>');
              });
          }
          b = [];
          Mt();
          loadLyric(2);
        })(n.id);
        window._renderPlaylist = Bt;
        window.Bt = Bt;
        window._akiniMusicReloadPlaylist = function () {
          try {
            var saved = localStorage.getItem("akini_music_playlist");
            if (saved) {
              var parsed = JSON.parse(saved);
              if (parsed && parsed.length > 0) {
                c = parsed;
                Bt();
              }
            }
          } catch (e) {
            console.warn("[Akini music] reload playlist after restore failed", e);
          }
        };
        window._TtNetease = Tt;
        window._importAllNeteasePlaylists = _importAllNeteasePlaylists;
        window._startNeteaseQr = function () {
          console.log("[QR] _startNeteaseQr called");
          try {
            if (typeof Nt === "function") {
              Nt();
            }
          } catch (e) {
            console.error("[QR] Nt error:", e);
          }
          try {
            var mo = document.getElementById("musicMenuOverlay");
            if (mo) {
              mo.style.display = "block";
              mo.classList.add("show");
            }
            if (typeof updateMusicLoginStatus === "function") {
              updateMusicLoginStatus();
            }
            /* Show login row and auto-generate QR */
            try {
              var lr = document.getElementById("musicLoginRow");
              if (lr)
                lr.scrollIntoView({ behavior: "smooth", block: "center" });
            } catch (e) {}
            try {
              var _c = localStorage.getItem("akini_netease_cookie") || "";
              if (!_c && typeof window._generateQrCode === "function") {
                setTimeout(function () {
                  try {
                    window._generateQrCode();
                  } catch (t) {}
                }, 200);
              }
            } catch (t) {}
          } catch (e) {
            console.error("[QR] DOM fallback error:", e);
          }
        };
        window._jtMusicListening = jt;
      }
      /* 防止下一行 IIFE 被解析为上一语句的函数调用（ASI 陷阱） */
      ;
      (function () {
        var t = "akini_last_page_state";
        function e() {
          for (
            var e = "",
              n = [
                "chat",
                "chat-list",
                "create-group",
                "friends",
                "mail",
                "music",
                "settings",
                "beautify",
                "call",
                "icity",
                "add-contact",
                "contact-detail",
              ],
              i = 0;
            i < n.length;
            i++
          ) {
            var a = document.getElementById("app-" + n[i]);
            if (a && "none" !== a.style.display) {
              e = n[i];
              break;
            }
          }
          var o = "";
          [
            "settingsArea",
            "beautifyArea",
            "icityArea",
            "wordbankOverlay",
          ].forEach(function (t) {
            var e = document.getElementById(t);
            e && "none" !== e.style.display && (o = t);
          });
          try {
            localStorage.setItem(
              t,
              JSON.stringify({ page: e, area: o, ts: Date.now() }),
            );
          } catch (t) {}
        }
        function n() {
          return;
        }
        (document.addEventListener("visibilitychange", function () {
          "hidden" === document.visibilityState && e();
        }),
          window.addEventListener("pagehide", e),
          window.addEventListener("beforeunload", e),
          "complete" === document.readyState ||
          "interactive" === document.readyState
            ? setTimeout(n, 80)
            : document.addEventListener("DOMContentLoaded", function () {
                setTimeout(n, 80);
              }));
      })();
    })();
    window.__akiniOpenPlaylist = function () {
      try {
        Bt && Bt();
      } catch (t) {
        try {
          window._renderPlaylist && window._renderPlaylist();
        } catch (e) {}
      }
      var o = document.getElementById("musicPlaylistOverlay");
      o && (o.style.display = "flex");
    };
    ((window.I = I));
    console.log("[Akini] v20260825s build - DOMContentLoaded 执行完毕 ✅");
  } catch (__bootErr) {
    console.error("[Akini] BOOT ERROR", __bootErr);
    __akiniShowBanner(
      "初始化错误: " +
        ((__bootErr && __bootErr.message) || __bootErr) +
        " 步骤:" +
        window.__akiniBootStep,
      "#ff4444",
    );
  } /* 网易云一起听邀请功能 */
  (function () {
    var inviteOverlay = document.getElementById("musicInviteOverlay");
    var waitingOverlay = document.getElementById("musicInviteWaitingOverlay");

    function getRandomContact() {
      var contacts = (window.getContacts && window.getContacts()) || [];
      if (!contacts.length) return null;
      return contacts[Math.floor(Math.random() * contacts.length)];
    }

    function setAvatar(el, avatar) {
      if (!el) return;
      if (!avatar) {
        el.textContent = "🐰";
        return;
      }
      if (
        String(avatar).indexOf("data:") === 0 ||
        String(avatar).indexOf("http") === 0
      ) {
        el.innerHTML =
          '<img src="' +
          avatar +
          '" style="width:100%;height:100%;object-fit:cover">';
      } else {
        el.textContent = avatar;
      }
    }

    window._showMusicInvite = function () {
      var contact = getRandomContact();
      window._showMusicInviteWithContact(contact);
    };

    window._showMusicInviteWithContact = function (contact) {
      if (!contact) {
        console.log("[MusicInvite] no contacts");
        return;
      }
      var myAvatar = window.getMyAvatar ? window.getMyAvatar() : "🐱";
      var fromAvatarEl = document.getElementById("musicInviteFromAvatar");
      var myAvatarEl = document.getElementById("musicInviteMyAvatar");
      var fromNameEl = document.getElementById("musicInviteFromName");
      var fromName2El = document.getElementById("musicInviteFromName2");
      setAvatar(fromAvatarEl, contact.avatar);
      setAvatar(myAvatarEl, myAvatar);
      if (fromNameEl) fromNameEl.textContent = contact.name;
      if (fromName2El) fromName2El.textContent = contact.name;
      if (inviteOverlay) inviteOverlay.style.display = "flex";
    };

    window._hideMusicInvite = function () {
      if (inviteOverlay) inviteOverlay.style.display = "none";
    };

    window._showMusicInviteWaiting = function (contact) {
      var myAvatar = window.getMyAvatar ? window.getMyAvatar() : "🐱";
      var otherAvatar = contact && contact.avatar ? contact.avatar : "🐰";
      var myEl = document.getElementById("musicInviteWaitingMyAvatar");
      var otherEl = document.getElementById("musicInviteWaitingOtherAvatar");
      setAvatar(myEl, myAvatar);
      setAvatar(otherEl, otherAvatar);
      if (waitingOverlay) waitingOverlay.style.display = "flex";
    };

    window._hideMusicInviteWaiting = function () {
      if (waitingOverlay) waitingOverlay.style.display = "none";
    };

    // 拒绝
    var rejectBtn = document.getElementById("musicInviteRejectBtn");
    if (rejectBtn)
      rejectBtn.addEventListener("click", function () {
        window._hideMusicInvite();
        if (window._showMusicContactPicker) window._showMusicContactPicker();
      });
    // 同意
    var acceptBtn = document.getElementById("musicInviteAcceptBtn");
    if (acceptBtn)
      acceptBtn.addEventListener("click", function () {
        var contact = getRandomContact();
        if (contact) {
          try {
            localStorage.setItem(
              "akini_music_selected_contacts",
              JSON.stringify([contact]),
            );
          } catch (e) {}
        }
        window._hideMusicInvite();
        if (window._showMusicContactPicker) window._showMusicContactPicker();
      });

    // 纯概率触发邀请（无定时器）：仅在用户发送消息时按概率触发，且仅在未一起听时
    window._tryRandomMusicInvite = function () {
      var isListening = false;
      try {
        isListening =
          localStorage.getItem("akini_music_listening_active") === "1" ||
          (document.getElementById("app-music") &&
            document.getElementById("app-music").style.display === "flex");
      } catch (e) {}
    };

    // 连接动画已改为自动靠近，无需同意按钮

    // 清除可能存在的旧定时器（不再使用定时器）
    try {
      if (window._musicInviteTimer) {
        clearInterval(window._musicInviteTimer);
        window._musicInviteTimer = null;
      }
    } catch (e) {}

    // 挂载到发送按钮：每次点击发送时按概率尝试邀请（无定时器、无强制触发）
    try {
      if (!window.__musicInviteHooked) {
        window.__musicInviteHooked = true;
        var _sendBtn = document.getElementById("sendBtn");
        if (_sendBtn) {
          _sendBtn.addEventListener("click", function () {
            try {
              window._tryRandomMusicInvite();
            } catch (e) {}
          });
        }
      }
    } catch (e) {}
  })();

  (function () {
    function dbg(msg) {}
    window.__akiniDbg = dbg;
    try {
      var apps = [
        "appBtnChat",
        "appBtnFriends",
        "appBtnMusic",
        "appBtnIcity",
        "appBtnShop",
        "settingsBtn",
        "beautifyBtn",
        "wordBtn",
      ];
      var bound = apps.filter(function (id) {
        var el = document.getElementById(id);
        return (el && el.onclick) || (el && el.getAttribute("data-bound"));
      });
      dbg(
        "构建 v20260825s | 联系人:" +
          (window.akiniContacts
            ? window.akiniContacts.getContacts().length
            : "无") +
          " | AKR:" +
          (window.AKR ? "有" : "无") +
          " | idb:" +
          (window._idbStore ? "有" : "无") +
          " | body子元素:" +
          document.body.children.length,
      );
    } catch (e) {
      dbg("诊断错误:" + e.message);
    }
  })();

  // 数据自动兜底保护：每 20 秒备份一次，切后台/关闭前也立即备份
  try {
    function _akiniImmediateBackup() {
      // 先把内存中所有聊天记录同步刷到 IDB/localStorage，防止页面被系统回收时丢失
      // 注意：DOM 只渲染最近 100 条（防卡顿），严禁用 U.innerHTML 覆盖完整历史
      // 必须从 session.messagesHTML（内存全量）保存，与 milk 的内存数据源一致
      try {
        if (window.akiniContacts && typeof E === "object") {
          var activeId = window.akiniContacts.getActiveChatId();
          if (activeId) {
            var sess = window.akiniContacts.getSession(activeId);
            if (sess && sess.messagesHTML && sess.messagesHTML.trim()) {
              E[activeId] = sess.messagesHTML;
              C(activeId, sess.messagesHTML);
            }
          }
          Object.keys(E).forEach(function (k) {
            if (E[k] && typeof E[k] === "string") C(k, E[k]);
          });
        }
      } catch (e) {}
      try {
        window._idbStore && window._idbStore.backupAll && window._idbStore.backupAll();
      } catch (e) {}
      try {
        window._akiniCacheStore && window._akiniCacheStore.backupAll && window._akiniCacheStore.backupAll();
      } catch (e) {}
    }
    setInterval(_akiniImmediateBackup, 20000);
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) _akiniImmediateBackup();
    });
    window.addEventListener("pagehide", _akiniImmediateBackup);
    window.addEventListener("beforeunload", _akiniImmediateBackup);

    // ===== milk 核心防丢机制：页面重新可见时，对比备份与内存数据，备份更完整则自动恢复 =====
    // 防止移动端系统回收内存后（微信内置浏览器长时间后台），内存数据被清空导致聊天记录丢失
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) return;
      if (window._restoringData || window._restoringChatHistory) return;
      try {
        if (window.akiniContacts && window.akiniContacts.getContacts) {
          var contactsEmpty = window.akiniContacts.getContacts().length === 0;
          var sessions = window.akiniContacts.getSessions ? window.akiniContacts.getSessions() : {};
          var anyMsg = !1;
          for (var sid in sessions)
            if (sessions.hasOwnProperty(sid) && sessions[sid] && sessions[sid].messagesHTML && sessions[sid].messagesHTML.trim()) { anyMsg = !0; break; }
          if (contactsEmpty || (!anyMsg && Object.keys(sessions).length === 0)) {
            // 内存数据疑似被回收清空：从 IDB 恢复
            window._restoringData = !0;
            window._idbStore && window._idbStore.restoreAll && window._idbStore.restoreAll(function () {
              window.akiniContacts && window.akiniContacts.tryRestoreFromBackup && window.akiniContacts.tryRestoreFromBackup(function () {
                window.akiniContacts.resetCache && window.akiniContacts.resetCache();
                window._akiniRestoreFromSnapshot && window._akiniRestoreFromSnapshot(function () {
                  window._restoringData = !1;
                  if ("function" == typeof __akiniBootApp) { try { __akiniBootApp(); } catch (e) {} }
                  if ("function" == typeof window._renderPosts) window._renderPosts();
                  if ("function" == typeof window._renderIcity) window._renderIcity();
                });
              });
            });
          } else if (!anyMsg && Object.keys(sessions).length > 0) {
            // 有会话但聊天记录全空：逐会话从 IDB 兜底找回（内存 chat HTML 缓存 E 的 key 对应记录）
            Object.keys(sessions).forEach(function (sid) {
              var ok = !1;
              try {
                if (E[sid] && E[sid].length) ok = !0;
              } catch (e) {}
              if (!ok) {
                _idbStore.get("akini_chat_history_" + sid, function (v) {
                  if (v && v.trim()) {
                    window.akiniContacts.updateSession(sid, { messagesHTML: v });
                    E[sid] = v;
                    var cur = window.akiniContacts.getActiveChatId();
                    if (cur === sid) {
                      var body = document.getElementById("chatBody");
                      if (body && (!body.innerHTML || !body.innerHTML.trim())) {
                        __akiniRenderChatBody(__akiniDeduplicateChatHTML(v), sid);
                      }
                    }
                  }
                });
              }
            });
          }
        }
        // 朋友圈/iCity 内存缓存被回收时对比恢复
        try {
          if (typeof O === "function" && (!z || z.length === 0)) {
            var pv = localStorage.getItem("akini_posts");
            if (pv) {
              var pa = JSON.parse(pv);
              Array.isArray(pa) && pa.length && R(pa);
              "function" == typeof window._renderPosts && window._renderPosts();
            }
          }
        } catch (e) {}
        try {
          if (typeof q === "function" && (!F || F.length === 0)) {
            // 内存缓存被回收：优先从 IDB 恢复（IDB 是权威源，localStorage 可能因配额写入失败而陈旧）
            window._idbStore && window._idbStore.get && window._idbStore.get("akini_icity_diaries", function (dv) {
              var src = dv || localStorage.getItem("akini_icity_diaries") || localStorage.getItem("akini_icity_diaries_backup");
              if (src) {
                try {
                  var da = JSON.parse(src);
                  if (Array.isArray(da) && da.length) {
                    // 用合并函数恢复，保证评论只增不减，避免旧数据覆盖
                    if (typeof $ === "function") { $(src, !0); }
                    else { j(da); }
                  }
                } catch (e) {}
                "function" == typeof window._renderIcity && window._renderIcity();
              }
            });
          }
        } catch (e) {}
      } catch (e) {}
    });

    // ===== milk 每 3 分钟全量保存：即使所有生命周期事件都失效，数据也会定期落盘 =====
    setInterval(function () {
      try {
        if (document.hidden || window._restoringData || window._restoringChatHistory) return;
        _akiniImmediateBackup();
        if ("function" == typeof flushAllData) flushAllData();
        // 朋友圈 / iCity 定期落盘（milk saveData 等价物）
        try { if (typeof R === "function" && z && z.length) R(z); } catch (e) {}
        try { if (typeof j === "function" && F && F.length) j(F); } catch (e) {}
      } catch (e) {}
    }, 180000);
  } catch (e) {}
});
