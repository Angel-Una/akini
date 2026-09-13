/* ============================================================
 * Akini 小说 & 陪伴 模块
 * 小说：导入 txt / 书架 3 列 / 长按换封面改名 / 选人共读 / 阅读页头像栏 + 三点菜单
 *       （背景、字号、翻页方式：下滑滚动 / 左右翻页；深色背景自动浅字）
 * 陪伴：选人（复刻网易云一起听）→ 双方头像 + 波形爱心 + 浅粉动态环 + 陪伴计时
 *       + 双方消息区（顶部渐变）+ 消息/表情线条输入栏 + ⋮（换背景带浅黑蒙层/退出）
 * ============================================================ */
(function () {
  'use strict';

  /* ---------- 通用工具 ---------- */
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function idbSet(k, v) { try { window._idbStore && window._idbStore.set(k, v, function () {}); } catch (e) {} }
  function idbGet(k, cb) {
    try {
      if (window._idbStore && window._idbStore.get) { window._idbStore.get(k, function (v) { cb(v == null ? null : v); }); return; }
    } catch (e) {}
    cb(null);
  }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function isImgSrc(s) { return typeof s === 'string' && /^(data:|https?:|blob:)/.test(s); }
  /* 头像渲染统一走主程序 nt()：默认头像（空/emoji/文字）→ 线条人像 SVG，真实图片 → img（zzc 全局约定） */
  function avatarInner(url) {
    if (window.nt) { try { return window.nt(url || '', 40); } catch (e) {} }
    if (!isImgSrc(url) && window.__akiniLineAvatarImg) return window.__akiniLineAvatarImg();
    if (isImgSrc(url)) return '<img src="' + esc(url) + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">';
    return '';
  }
  function myAvatar() {
    var a = lsGet('akini_my_avatar', '');
    if (!a && window.__akiniAvatarCache && window.__akiniAvatarCache.my) a = window.__akiniAvatarCache.my;
    return a || '\uD83D\uDC31';
  }
  function contacts() {
    try { return (window.akiniContacts && window.akiniContacts.getContacts) ? (window.akiniContacts.getContacts() || []) : []; } catch (e) { return []; }
  }
  function contactById(id) {
    try { return (window.akiniContacts && window.akiniContacts.getContactById) ? window.akiniContacts.getContactById(id) : null; } catch (e) { return null; }
  }
  function goHome() { try { window.navTo('home'); } catch (e) { var h = $('homeArea'); if (h) h.style.display = 'flex'; } }
  function openSheet(id) { var e = $(id); if (e) e.style.display = 'flex'; }
  function closeSheet(id) { var e = $(id); if (e) e.style.display = 'none'; }

  /* ============================================================
   * 一、陪伴
   * ============================================================ */
  var COMPANION_KEY = 'akini_companion_state';
  var COMPANION_BG_KEY = 'akini_companion_bg';
  var _companionSel = null;
  var _companionTimer = null;
  var _companionBg = ''; /* 内存缓存，进入时从 IDB 读 */

  var EMOJIS = ['😀','😄','😆','🥰','😘','😚','😊','😉','🤗','😋','😜','😝','😭','😡','🥺','😴','🤒','😳','😱','😬','🙄','😇','🤭','😪','😤','🙃','😈','👻','👍','🙏','👏','🤝','💗','💖','💕','💘','💝','❤️','🎉','🎂','🌹','⭐'];

  function companionState() {
    try { return JSON.parse(lsGet(COMPANION_KEY, 'null')); } catch (e) { return null; }
  }
  function saveCompanionState(st) { lsSet(COMPANION_KEY, JSON.stringify(st)); }

  function renderCompanionPicker() {
    var list = $('companionContactList');
    if (!list) return;
    var cs = contacts();
    if (!cs.length) {
      list.innerHTML = '<div style="text-align:center;color:#999;font-size:14px;padding:60px 0;line-height:1.8">还没有联系人<br>去微信-通讯录添加一位吧</div>';
      return;
    }
    list.innerHTML = cs.map(function (c) {
      var on = _companionSel === c.id;
      return '<div class="akcp-item" data-cid="' + esc(c.id) + '" style="display:flex;align-items:center;gap:12px;padding:12px 4px;border-bottom:1px solid #f0f0f0;cursor:pointer;-webkit-tap-highlight-color:transparent">'
        + '<div style="width:22px;height:22px;border-radius:50%;border:2px solid ' + (on ? '#1a1a1a' : '#ddd') + ';background:' + (on ? '#1a1a1a' : '#fff') + ';color:#fff;font-size:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0">' + (on ? '\u2713' : '') + '</div>'
        + '<div style="width:44px;height:44px;border-radius:50%;background:#e8e8e8;overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center">' + avatarInner(c.avatar) + '</div>'
        + '<div style="flex:1;min-width:0;font-size:16px;color:#1a1a1a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(c.name || '未命名') + '</div>'
        + '</div>';
    }).join('');
    Array.prototype.forEach.call(list.querySelectorAll('.akcp-item'), function (el) {
      el.addEventListener('click', function () {
        _companionSel = el.getAttribute('data-cid');
        renderCompanionPicker();
        updateCompanionConfirm();
      });
    });
    updateCompanionConfirm();
  }

  function updateCompanionConfirm() {
    var info = $('companionPickerSelectedInfo');
    var c = _companionSel ? contactById(_companionSel) : null;
    if (info) info.textContent = c ? ('已选择：' + (c.name || '未命名')) : '已选择 0 人';
  }

  function fmtDur(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return p(h) + ':' + p(m) + ':' + p(ss);
  }

  function showCompanionView(view) {
    var pv = $('companionPickerView'), mv = $('companionMainView');
    if (pv) pv.style.display = view === 'picker' ? 'flex' : 'none';
    if (mv) mv.style.display = view === 'main' ? 'flex' : 'none';
  }

  function applyCompanionBg() {
    var layer = $('companionBgLayer'), dim = $('companionBgDim');
    if (!layer || !dim) return;
    var app = $('app-companion');
    if (isImgSrc(_companionBg)) {
      layer.style.backgroundImage = 'url(' + _companionBg + ')';
      layer.style.display = 'block';
      dim.style.display = 'block'; /* 更换背景图后整体带一层浅黑色 */
      if (app) app.classList.add('hasBg'); /* 气泡切自定义背景适配样式 */
    } else {
      layer.style.display = 'none';
      dim.style.display = 'none';
      if (app) app.classList.remove('hasBg'); /* 默认背景用默认气泡 */
    }
  }

  function renderCompanionMsgs(scrollBottom) {
    var box = $('companionMsgs');
    if (!box) return;
    var st = companionState();
    var msgs = (st && st.msgs) || [];
    if (!msgs.length) {
      box.innerHTML = '<div style="text-align:center;color:#bbb;font-size:13px;padding:26px 0 0;line-height:1.8">陪伴开始啦<br>在下面发条消息给对方吧~</div>';
      return;
    }
    /* zzz：陪伴气泡不显示头像（用户需求），仅消息内容居中/两侧对齐 */
    box.innerHTML = '';
    msgs.forEach(function (m) {
      var me = m.side === 'me';
      var row = document.createElement('div');
      row.className = 'msg-row ' + (me ? 'me' : 'other');
      row.setAttribute('data-ts', String(m.ts || Date.now()));
      row.style.paddingLeft = '0';
      row.style.paddingRight = '0';
      var bubbleHtml = m.img
        ? '<div class="bubble sticker-bubble" style="background:transparent;padding:0;box-shadow:none;border:none;"><img src="' + esc(m.img) + '" style="max-width:120px;max-height:120px;border-radius:8px;display:block;" alt=""/></div>'
        : '<div class="bubble">' + esc(m.text || '') + '</div>';
      row.innerHTML = '<div class="msg-content-line">' + bubbleHtml + '</div>';
      box.appendChild(row);
      try { if (typeof window.__akiniProcessMsgMeta === 'function') window.__akiniProcessMsgMeta(row); } catch (e) {}
    });
    if (scrollBottom !== false) box.scrollTop = box.scrollHeight;
  }

  /* zzz：陪伴历史存储 key */
  var COMPANION_HISTORY_KEY = 'akini_companion_history';

  function companionHistory() {
    try { return JSON.parse(lsGet(COMPANION_HISTORY_KEY, '[]')) || []; } catch (e) { return []; }
  }
  function saveCompanionHistory(arr) { lsSet(COMPANION_HISTORY_KEY, JSON.stringify(arr)); }

  function pushCompanionHistory(st) {
    /* st: { cid, ts, msgs } → 记录对象名/时长/消息条数 */
    if (!st || !st.cid) return;
    var c = contactById(st.cid);
    var name = c ? (c.name || '未命名') : '对方';
    var durMs = Date.now() - (st.ts || Date.now());
    var msgCount = (st.msgs || []).length;
    var arr = companionHistory();
    arr.unshift({
      cid: st.cid,
      name: name,
      avatar: c ? (c.avatar || '') : '',
      duration: durMs,
      msgCount: msgCount,
      startTs: st.ts,
      endTs: Date.now()
    });
    /* 最多保留 100 条 */
    if (arr.length > 100) arr.length = 100;
    saveCompanionHistory(arr);
  }

  function renderCompanionHistory() {
    var list = $('companionHistoryList');
    if (!list) return;
    var arr = companionHistory();
    if (!arr.length) {
      list.innerHTML = '<div style="text-align:center;color:#bbb;font-size:14px;padding:60px 0;line-height:1.8">暂无陪伴历史</div>';
      return;
    }
    list.innerHTML = arr.map(function (h) {
      var dur = fmtDur(h.duration || 0);
      var d = h.startTs ? new Date(h.startTs) : null;
      var dateStr = d ? (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) : '';
      return '<div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #f0f0f0">'
        + '<div style="width:44px;height:44px;border-radius:50%;background:#e8e8e8;overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center">' + avatarInner(h.avatar) + '</div>'
        + '<div style="flex:1;min-width:0">'
        + '<div style="font-size:15px;font-weight:600;color:#1a1a1a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(h.name) + '</div>'
        + '<div style="font-size:12px;color:#999;margin-top:2px">' + esc(dateStr) + '</div>'
        + '</div>'
        + '<div style="text-align:right;flex-shrink:0">'
        + '<div style="font-size:13px;color:#666">' + dur + '</div>'
        + '<div style="font-size:12px;color:#999;margin-top:2px">' + (h.msgCount || 0) + ' 条聊天记录</div>'
        + '</div>'
        + '</div>';
    }).join('');
  }

  function startCompanion(cid) {
    /* zzz：距离只在开启陪伴时随机生成一次（0-1000），随会话固化保存；
       退出陪伴后下次开启才重新随机；计时每次从 0 开始（不累计） */
    /* zzz2：距离 0-100 米，保留一位小数 */
    var st = { cid: cid, ts: Date.now(), msgs: [], dist: Math.round(Math.random() * 1000) / 10 };
    saveCompanionState(st);
    enterCompanionMain(st);
  }

  function enterCompanionMain(st) {
    var c = contactById(st.cid);
    var name = c ? (c.name || '未命名') : '对方';
    var ava = c ? c.avatar : '';
    var myA = $('companionMyAvatar'), taA = $('companionTaAvatar');
    if (myA) myA.innerHTML = avatarInner(myAvatar());
    if (taA) taA.innerHTML = avatarInner(ava);
    /* zzy：距离读取本轮陪伴固化的 dist（开启时生成）；旧数据无 dist 时补一次并保存，之后不再变 */
    var dd = $('companionDistance');
    if (dd) {
      if (typeof st.dist !== 'number' || isNaN(st.dist)) {
        st.dist = Math.round(Math.random() * 1000) / 10;
        saveCompanionState(st);
      }
      dd.textContent = 'TA距离你' + st.dist.toFixed(1) + '米';
    }
    applyCompanionBg();
    renderCompanionMsgs(false);
    showCompanionView('main');
    if (_companionTimer) { clearInterval(_companionTimer); _companionTimer = null; }
    var timerEl = $('companionTimer');
    var tick = function () {
      var cur = companionState();
      if (!cur) { if (timerEl) timerEl.textContent = '00:00:00'; return; }
      if (timerEl) timerEl.textContent = fmtDur(Date.now() - cur.ts);
    };
    tick();
    _companionTimer = setInterval(tick, 1000);
  }

  function endCompanion() {
    /* zzz：退出前归档陪伴历史（对象/时长/消息条数），再清空状态 */
    var st = companionState();
    if (st && st.cid) pushCompanionHistory(st);
    /* 主程序重写了 localStorage.removeItem（失效），且快照恢复会把 'null' 视为丢失并复活旧值；
       故写 '{"cleared":true}' 墓碑：非空不进恢复条件，解析后无 cid 即无会话 */
    lsSet(COMPANION_KEY, '{"cleared":true}');
    if (_companionTimer) { clearInterval(_companionTimer); _companionTimer = null; }
    _companionSel = null;
    closeSheet('companionMenuSheet');
    showCompanionView('picker');
    renderCompanionPicker();
  }

  function myStickerPool() {
    /* 我给自己添加的表情包：字卡库-表情包 tab 主集合 akini_stickers */
    var arr = [];
    try {
      arr = (window.__wbRead ? window.__wbRead('akini_stickers', []) : JSON.parse(lsGet('akini_stickers', '[]'))) || [];
    } catch (e) {}
    if (!Array.isArray(arr)) arr = [];
    var out = [];
    arr.forEach(function (it) {
      var s2 = '';
      if (typeof it === 'string') s2 = it;
      else if (it && typeof it.s === 'string') s2 = it.s;
      var blocked = it && typeof it === 'object' && (it.b === 1 || it.b === true || it.b === '1');
      if (!blocked && /^data:image\//.test(s2)) out.push(s2);
    });
    return out;
  }
  function companionStickerPool(cid) {
    /* 该联系人专属表情包（与观影 watchStickerPool 同数据源 getContactStickersSync） */
    var out = [];
    try {
      var own = typeof window.getContactStickersSync === 'function' ? window.getContactStickersSync(cid) : [];
      (Array.isArray(own) ? own : []).forEach(function (it) {
        var s2 = '';
        if (typeof it === 'string') s2 = it;
        else if (it && typeof it.s === 'string') s2 = it.s;
        var blocked = it && typeof it === 'object' && (it.b === 1 || it.b === true || it.b === '1');
        if (!blocked && /^data:image\//.test(s2)) out.push(s2);
      });
    } catch (e) {}
    return out;
  }
  function showCompanionTyping() {
    /* 微信同款正在输入：消息区左下角、无头像、仅三点气泡 */
    var box = $('companionMsgs');
    if (!box || $('companionTyping')) return;
    var t = document.createElement('div');
    t.id = 'companionTyping';
    t.className = 'akcp-typing';
    t.innerHTML = '<span class="wt-dot"></span><span class="wt-dot"></span><span class="wt-dot"></span>';
    box.appendChild(t);
    box.scrollTop = box.scrollHeight;
  }
  function hideCompanionTyping() {
    var t = $('companionTyping');
    if (t) t.remove();
  }
  function scheduleCompanionReply(cid) {
    /* 回复节奏照搬微信/观影：设置页回复延迟范围（默认 2~5s），回复前 1.1s 左下角出现正在输入气泡 */
    var dMin = parseFloat(lsGet('akini_num_replyDelayMin', '2'));
    var dMax = parseFloat(lsGet('akini_num_replyDelayMax', '5'));
    if (!(dMin >= 0)) dMin = 2;
    if (!(dMax >= dMin)) dMax = Math.max(dMin, 5);
    var delayMs = 1000 * (dMin + Math.random() * (dMax - dMin));
    setTimeout(function () { if (companionState()) showCompanionTyping(); }, Math.max(0, delayMs - 1100));
    setTimeout(function () {
      hideCompanionTyping();
      var cur = companionState();
      if (!cur) return;
      /* 表情包：概率与微信聊天一致（contactEmojiToggle 开关 + AKR.getProb('emoji')），仅限该联系人专属收藏，裸图无气泡 */
      var stkOn = false;
      try { stkOn = localStorage.getItem('akini_toggle_contactEmojiToggle') === '1'; } catch (e) {}
      var stkProb = (stkOn && window.AKR && typeof window.AKR.getProb === 'function') ? window.AKR.getProb('emoji') : 0;
      if (stkProb > 0 && Math.random() < stkProb) {
        var pool = companionStickerPool(cur.cid);
        if (pool.length) {
          cur.msgs = cur.msgs || [];
          cur.msgs.push({ side: 'ta', img: pool[Math.floor(Math.random() * pool.length)], ts: Date.now() });
          saveCompanionState(cur);
          renderCompanionMsgs(true);
          return;
        }
      }
      /* 文本回复：从该联系人字卡库抽取，零兜底（抽不到则不回复） */
      var t = '';
      try { t = window.pickWordCards ? window.pickWordCards(1, cur.cid) : ''; } catch (e) {}
      t = (t || '').split('\n')[0].trim();
      if (!t) return;
      cur.msgs = cur.msgs || [];
      cur.msgs.push({ side: 'ta', text: t, ts: Date.now() });
      saveCompanionState(cur);
      renderCompanionMsgs(true);
    }, delayMs);
  }
  function sendCompanionMsg(imgUrl) {
    var st = companionState();
    if (!st) return;
    var input = $('companionMsgInput');
    var v = imgUrl ? '' : ((input && input.value || '').trim());
    if (!imgUrl && !v) return;
    st.msgs = st.msgs || [];
    st.msgs.push(imgUrl ? { side: 'me', img: imgUrl, ts: Date.now() } : { side: 'me', text: v, ts: Date.now() });
    saveCompanionState(st);
    if (input) input.value = '';
    renderCompanionMsgs(true);
    scheduleCompanionReply(st.cid);
  }

  window.__openCompanion = function () {
    idbGet(COMPANION_BG_KEY, function (v) { _companionBg = v || ''; applyCompanionBg(); });
    /* zzz8：会话保持（与一起听一致）——存在进行中的陪伴会话时直接回到陪伴主界面，
       切出/返回/刷新都不重置；仅「退出陪伴」主动操作才清除会话回选人页 */
    var st = companionState();
    if (st && st.cid && contactById(st.cid)) {
      enterCompanionMain(st);
      return;
    }
    _companionSel = null;
    showCompanionView('picker');
    renderCompanionPicker();
  };

  function bindCompanion() {
    var back1 = $('companionBackBtn'), back2 = $('companionMainBackBtn');
    var confirm = $('companionConfirmBtn');
    var histBtn = $('companionHistoryBtn');
    var histClose = $('companionHistoryClose');
    var histOverlay = $('companionHistoryOverlay');
    var menuBtn = $('companionMenuBtn');
    var menuCancel = $('companionMenuCancel');
    var menuSheet = $('companionMenuSheet');
    var actBg = $('companionActBg');
    var actBgReset = $('companionActBgReset');
    var actExit = $('companionActExit');
    var bgInput = $('companionBgInput');
    var msgInput = $('companionMsgInput');
    var emojiBtn = $('companionEmojiBtn');
    var emojiSheet = $('companionEmojiSheet');
    var emojiGrid = $('companionEmojiGrid');

    if (back1) back1.addEventListener('click', goHome);
    if (back2) back2.addEventListener('click', goHome);
    if (histBtn) histBtn.addEventListener('click', function () {
      renderCompanionHistory();
      openSheet('companionHistoryOverlay');
    });
    if (histClose) histClose.addEventListener('click', function () {
      closeSheet('companionHistoryOverlay');
    });
    if (histOverlay) histOverlay.addEventListener('click', function (e) {
      if (e.target === histOverlay) closeSheet('companionHistoryOverlay');
    });
    if (confirm) confirm.addEventListener('click', function () {
      if (!_companionSel) return;
      startCompanion(_companionSel);
    });

    if (menuBtn) menuBtn.addEventListener('click', function () { openSheet('companionMenuSheet'); });
    if (menuCancel) menuCancel.addEventListener('click', function () { closeSheet('companionMenuSheet'); });
    if (menuSheet) menuSheet.addEventListener('click', function (e) { if (e.target === menuSheet) closeSheet('companionMenuSheet'); });
    if (actBg) actBg.addEventListener('click', function () {
      closeSheet('companionMenuSheet');
      if (bgInput) bgInput.click();
    });
    if (actBgReset) actBgReset.addEventListener('click', function () {
      closeSheet('companionMenuSheet');
      _companionBg = '';
      idbSet(COMPANION_BG_KEY, '');
      applyCompanionBg();
    });
    if (actExit) actExit.addEventListener('click', endCompanion);
    if (bgInput) bgInput.addEventListener('change', function () {
      var f = this.files && this.files[0];
      this.value = '';
      if (!f) return;
      var fr = new FileReader();
      fr.onload = function () {
        shrinkImage(fr.result, 750, 1334, function (url) {
          _companionBg = url;
          idbSet(COMPANION_BG_KEY, url);
          applyCompanionBg();
        });
      };
      fr.readAsDataURL(f);
    });

    if (msgInput) msgInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); sendCompanionMsg(); }
    });

    if (emojiBtn) emojiBtn.addEventListener('click', function () {
      /* zzx：表情面板 = 我给自己添加的表情包（字卡库-表情包 tab） */
      if (emojiGrid) {
        var pool = myStickerPool();
        if (pool.length) {
          emojiGrid.innerHTML = pool.map(function (s2, i) {
            return '<button type="button" class="akcp-stk" data-i="' + i + '" style="background:0 0;border:none;padding:4px;cursor:pointer;touch-action:manipulation"><img src="' + esc(s2) + '" style="width:62px;height:62px;object-fit:contain;display:block;pointer-events:none" alt="表情包"></button>';
          }).join('');
          Array.prototype.forEach.call(emojiGrid.querySelectorAll('.akcp-stk'), function (el) {
            el.addEventListener('click', function () {
              var s2 = pool[parseInt(el.getAttribute('data-i'), 10)];
              if (s2) sendCompanionMsg(s2);
              closeSheet('companionEmojiSheet');
            });
          });
        } else {
          emojiGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:#999;font-size:13px;padding:34px 0;line-height:1.9">还没有表情包<br>去字卡库-表情包里添加吧</div>';
        }
      }
      openSheet('companionEmojiSheet');
    });
    if (emojiSheet) emojiSheet.addEventListener('click', function (e) { if (e.target === emojiSheet) closeSheet('companionEmojiSheet'); });
  }

  /* ============================================================
   * 二、小说
   * ============================================================ */
  var BOOKS_KEY = 'akini_novel_books';
  var CONTENT_PREFIX = 'akini_novel_content_';
  var PROGRESS_PREFIX = 'akini_novel_progress_';
  var PAGEPROG_PREFIX = 'akini_novel_pageprog_';
  var SETTING_KEY = 'akini_novel_reader_settings';

  var _books = [];
  var _booksLoaded = false;
  var _curBook = null;
  var _readerContact = null;
  var _readerParas = [];
  var _readerIdx = 0;
  var RENDER_CHUNK = 120;

  var COVER_GRADS = [
    ['#f6d5c3', '#e8a87c'], ['#c3d9f6', '#7ca8e8'], ['#d5f6c3', '#8ce87c'],
    ['#f6c3d9', '#e87ca8'], ['#e6d5f6', '#b07ce8'], ['#f6efc3', '#e8d07c']
  ];
  var DARK_BG = '#2a2a2e';

  function saveBooks() { idbSet(BOOKS_KEY, JSON.stringify(_books)); }

  function loadBooks(cb) {
    if (_booksLoaded) { cb(); return; }
    idbGet(BOOKS_KEY, function (v) {
      try { _books = v ? JSON.parse(v) : []; } catch (e) { _books = []; }
      if (!Array.isArray(_books)) _books = [];
      _booksLoaded = true;
      cb();
    });
  }

  function defaultCover(b) {
    var h = 0;
    for (var i = 0; i < b.title.length; i++) h = (h * 31 + b.title.charCodeAt(i)) >>> 0;
    var g = COVER_GRADS[h % COVER_GRADS.length];
    return '<div style="width:100%;height:100%;background:linear-gradient(150deg,' + g[0] + ',' + g[1] + ');display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8px;box-sizing:border-box">'
      + '<div style="font-size:14px;font-weight:700;color:rgba(60,40,20,.85);text-align:center;line-height:1.4;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;word-break:break-all">' + esc(b.title) + '</div>'
      + '<div style="margin-top:6px;width:24px;height:2px;background:rgba(60,40,20,.35);border-radius:1px"></div>'
      + '</div>';
  }

  window.__renderNovelShelf = function () {
    loadBooks(function () {
      var grid = $('novelShelfGrid');
      var tip = $('novelEmptyTip');
      if (!grid) return;
      if (tip) tip.style.display = _books.length ? 'none' : 'block';
      grid.innerHTML = _books.map(function (b) {
        var cover = isImgSrc(b.cover)
          ? '<img src="' + esc(b.cover) + '" style="width:100%;height:100%;object-fit:cover;">'
          : defaultCover(b);
        return '<div class="aknv-book" data-bid="' + esc(b.id) + '" style="cursor:pointer;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none">'
          + '<div style="width:100%;aspect-ratio:3/4;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.12);background:#eee">' + cover + '</div>'
          + '<div style="margin-top:6px;font-size:13px;color:#333;text-align:center;line-height:1.35;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;word-break:break-all">' + esc(b.title) + '</div>'
          + '</div>';
      }).join('');
      bindBookEvents(grid);
    });
  };

  function bindBookEvents(grid) {
    Array.prototype.forEach.call(grid.querySelectorAll('.aknv-book'), function (el) {
      var lpTimer = null, longFired = false;
      var start = function () {
        longFired = false;
        var bid = el.getAttribute('data-bid');
        lpTimer = setTimeout(function () {
          longFired = true;
          _curBook = _books.filter(function (b) { return b.id === bid; })[0] || null;
          if (_curBook) openSheet('novelBookActions');
          try { if (navigator.vibrate) navigator.vibrate(30); } catch (e) {}
        }, 600);
      };
      var cancel = function () { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; } };
      el.addEventListener('touchstart', start, { passive: true });
      el.addEventListener('touchend', cancel);
      el.addEventListener('touchmove', cancel);
      el.addEventListener('mousedown', start);
      el.addEventListener('mouseup', cancel);
      el.addEventListener('mouseleave', cancel);
      el.addEventListener('click', function () {
        if (longFired) { longFired = false; return; }
        var bid = el.getAttribute('data-bid');
        _curBook = _books.filter(function (b) { return b.id === bid; })[0] || null;
        if (_curBook) openNovelPicker();
      });
    });
  }

  /* ---------- 导入 txt ---------- */
  function decodeText(file, cb) {
    var fr = new FileReader();
    fr.onload = function () {
      var buf = fr.result;
      var txt = '';
      try { txt = new TextDecoder('utf-8', { fatal: false }).decode(buf); } catch (e) { txt = ''; }
      /* 乱码探测：utf-8 解码出大量替换符(U+FFFD)则按 GB18030 重解 */
      var bad = txt.split('\uFFFD').length - 1;
      if (bad > Math.max(8, txt.length * 0.01)) {
        try { txt = new TextDecoder('gb18030').decode(buf); }
        catch (e1) { try { txt = new TextDecoder('gbk').decode(buf); } catch (e2) {} }
      }
      cb(txt);
    };
    fr.onerror = function () { cb(''); };
    fr.readAsArrayBuffer(file);
  }

  function importNovel(file) {
    if (!file) return;
    decodeText(file, function (txt) {
      txt = (txt || '').replace(/^﻿/, '').trim();
      if (!txt) { alert('导入失败：文件内容为空或无法识别'); return; }
      var title = (file.name || '未命名').replace(/\.[^.]+$/, '') || '未命名';
      var id = 'nv' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
      var book = { id: id, title: title, cover: '', fileName: file.name, addedAt: Date.now() };
      _books.push(book);
      saveBooks();
      idbSet(CONTENT_PREFIX + id, txt);
      window.__renderNovelShelf();
    });
  }

  /* ---------- 封面/背景图压缩 ---------- */
  function shrinkImage(dataUrl, maxW, maxH, cb) {
    var img = new Image();
    img.onload = function () {
      var w = img.width, h = img.height;
      var r = Math.min(maxW / w, maxH / h, 1);
      var cw = Math.max(1, Math.round(w * r)), ch = Math.max(1, Math.round(h * r));
      var cv = document.createElement('canvas');
      cv.width = cw; cv.height = ch;
      var ctx = cv.getContext('2d');
      ctx.drawImage(img, 0, 0, cw, ch);
      cb(cv.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = function () { cb(dataUrl); };
    img.src = dataUrl;
  }

  /* ---------- 选人共读弹层 ---------- */
  function openNovelPicker() {
    _readerContact = null;
    renderNovelPickerList();
    openSheet('novelPickerOverlay');
  }

  function renderNovelPickerList() {
    var list = $('novelPickerList');
    if (!list) return;
    var cs = contacts();
    if (!cs.length) {
      list.innerHTML = '<div style="text-align:center;color:#999;font-size:14px;padding:40px 0;line-height:1.8">还没有联系人<br>去微信-通讯录添加一位吧</div>';
      return;
    }
    list.innerHTML = cs.map(function (c) {
      var on = _readerContact === c.id;
      return '<div class="aknv-item" data-cid="' + esc(c.id) + '" style="display:flex;align-items:center;gap:12px;padding:11px 4px;border-bottom:1px solid #f0f0f0;cursor:pointer;-webkit-tap-highlight-color:transparent">'
        + '<div style="width:22px;height:22px;border-radius:50%;border:2px solid ' + (on ? '#1a1a1a' : '#ddd') + ';background:' + (on ? '#1a1a1a' : '#fff') + ';color:#fff;font-size:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0">' + (on ? '\u2713' : '') + '</div>'
        + '<div style="width:40px;height:40px;border-radius:50%;background:#e8e8e8;overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center">' + avatarInner(c.avatar) + '</div>'
        + '<div style="flex:1;min-width:0;font-size:15px;color:#1a1a1a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(c.name || '未命名') + '</div>'
        + '</div>';
    }).join('');
    Array.prototype.forEach.call(list.querySelectorAll('.aknv-item'), function (el) {
      el.addEventListener('click', function () {
        _readerContact = el.getAttribute('data-cid');
        renderNovelPickerList();
      });
    });
  }

  /* ---------- 阅读页设置 ---------- */
  function readerSettings() {
    try { return JSON.parse(lsGet(SETTING_KEY, 'null')) || {}; } catch (e) { return {}; }
  }
  function saveReaderSettings(s) { lsSet(SETTING_KEY, JSON.stringify(s)); }
  function flipMode() { return readerSettings().flip === 'page' ? 'page' : 'scroll'; }

  function applyReaderSettings() {
    var s = readerSettings();
    var page = $('app-novel-reader');
    var content = $('novelReaderContent');
    var fsEl = $('novelFontSizeValue');
    var fs = Math.min(28, Math.max(14, parseInt(s.fontSize, 10) || 18));
    var dark = (s.bgColor === DARK_BG);
    if (content) {
      content.style.fontSize = fs + 'px';
      content.style.lineHeight = '1.9';
      /* 深色背景自动切浅色文字，避免黑底看不见 */
      content.style.color = dark ? '#d8d8d8' : '#2b2b2b';
    }
    if (fsEl) fsEl.textContent = String(fs);
    if (page) {
      if (isImgSrc(s.bg)) {
        page.style.background = '#f5f0e8';
        page.style.backgroundImage = 'url(' + s.bg + ')';
        page.style.backgroundSize = 'cover';
        page.style.backgroundPosition = 'center';
        /* 图片背景上叠一层浅色蒙层保证文字可读 */
        page.style.boxShadow = 'inset 0 0 0 999px rgba(255,255,255,0.42)';
      } else {
        page.style.backgroundImage = '';
        page.style.background = s.bgColor || '#f5f0e8';
        page.style.boxShadow = 'none';
      }
    }
    var row = $('novelBgColors');
    if (row) {
      Array.prototype.forEach.call(row.children, function (el) {
        var c = el.getAttribute('data-color');
        el.style.boxShadow = (c === s.bgColor && !isImgSrc(s.bg)) ? '0 0 0 2px #07c160' : 'none';
      });
    }
    /* 翻页方式按钮态 */
    var bScroll = $('novelFlipScroll'), bPage = $('novelFlipPage');
    var isPage = flipMode() === 'page';
    if (bScroll) { bScroll.style.background = isPage ? '#f8f8f8' : '#1a1a1a'; bScroll.style.color = isPage ? '#333' : '#fff'; bScroll.style.border = isPage ? '1px solid #e0e0e0' : 'none'; }
    if (bPage) { bPage.style.background = isPage ? '#1a1a1a' : '#f8f8f8'; bPage.style.color = isPage ? '#fff' : '#333'; bPage.style.border = isPage ? 'none' : '1px solid #e0e0e0'; }
  }

  /* ---------- 翻页（左右）模式 ---------- */
  var _pagedPages = [];
  var _pagedIdx = 0;

  function pageWidth() {
    var content = $('novelReaderContent');
    return content ? content.clientWidth : 1;
  }

  function pageHeight() {
    var content = $('novelReaderContent');
    return content ? content.clientHeight : 1;
  }

  /* 视口真实分页算法：逐段渲染到隐藏测量容器，溢出则分页 */
  function _computePages() {
    if (!_readerParas.length) { _pagedPages = [[]]; return; }
    var content = $('novelReaderContent');
    if (!content) { _pagedPages = [[]]; return; }
    
    // 创建测量容器，完全继承当前正文样式
    var meas = document.createElement('div');
    meas.style.cssText = 'position:absolute;top:-9999px;left:-9999px;width:' + (pageWidth() - 40) + 'px;visibility:hidden;box-sizing:content-box;';
    var s = readerSettings();
    meas.style.fontSize = s.fontSize + 'px';
    meas.style.lineHeight = s.lineHeight;
    meas.style.color = s.textColor;
    meas.style.background = 'transparent';
    document.body.appendChild(meas);

    var maxH = pageHeight() - 40; // 减去上下 padding
    var pages = [];
    var currentPageParas = [];
    var currentH = 0;
    var pStyle = 'margin:0 0 1em;text-indent:2em;word-break:break-all;';

    for (var i = 0; i < _readerParas.length; i++) {
      var para = _readerParas[i];
      meas.innerHTML = '<p style="' + pStyle + '">' + esc(para) + '</p>';
      var h = meas.firstChild.getBoundingClientRect().height;
      if (h > maxH) {
        // 单段超过一页：按字符拆分
        var chars = para.split('');
        var chunk = '';
        for (var j = 0; j < chars.length; j++) {
          chunk += chars[j];
          meas.innerHTML = '<p style="' + pStyle + '">' + esc(chunk) + '</p>';
          if (meas.firstChild.getBoundingClientRect().height > maxH) {
            chunk = chunk.slice(0, -1);
            if (currentH + meas.firstChild.getBoundingClientRect().height > maxH && currentPageParas.length) {
              pages.push(currentPageParas);
              currentPageParas = [];
              currentH = 0;
            }
            currentPageParas.push(chunk);
            currentH += meas.firstChild.getBoundingClientRect().height;
            chunk = chars[j];
          }
        }
        if (chunk) {
          meas.innerHTML = '<p style="' + pStyle + '">' + esc(chunk) + '</p>';
          if (currentH + meas.firstChild.getBoundingClientRect().height > maxH && currentPageParas.length) {
            pages.push(currentPageParas);
            currentPageParas = [];
            currentH = 0;
          }
          currentPageParas.push(chunk);
          currentH += meas.firstChild.getBoundingClientRect().height;
        }
      } else {
        if (currentH + h > maxH && currentPageParas.length) {
          pages.push(currentPageParas);
          currentPageParas = [];
          currentH = 0;
        }
        currentPageParas.push(para);
        currentH += h;
      }
    }
    if (currentPageParas.length) pages.push(currentPageParas);
    if (!pages.length) pages.push([]);
    _pagedPages = pages;
    document.body.removeChild(meas);
  }

  function _renderPaged() {
    var content = $('novelReaderContent');
    var ind = $('novelPageIndicator');
    if (!content || !ind) return;
    content.innerHTML = '';
    content.style.overflowY = 'hidden';
    content.style.overflowX = 'hidden';
    
    var pageParas = _pagedPages[_pagedIdx] || [];
    var html = '';
    for (var i = 0; i < pageParas.length; i++) {
      html += '<p style="margin:0 0 1em;text-indent:2em;word-break:break-all">' + esc(pageParas[i]) + '</p>';
    }
    content.innerHTML = html;
    ind.textContent = (_pagedIdx + 1) + '/' + _pagedPages.length;
    ind.style.display = 'block';
    
    // 滚动到顶部，模拟真实翻页
    content.scrollTop = 0;
  }

  function enterPageMode() {
    var content = $('novelReaderContent');
    if (!content) return;
    content.classList.add('paged');
    _computePages();
    _renderPaged();
  }

  function exitPageMode() {
    var content = $('novelReaderContent');
    if (!content) return;
    content.classList.remove('paged');
    content.style.overflowY = 'auto';
    content.style.overflowX = 'hidden';
  }

  function updatePageIndicator() {
    var ind = $('novelPageIndicator');
    if (!ind) return;
    if (flipMode() !== 'page') { ind.style.display = 'none'; return; }
    ind.textContent = (_pagedIdx + 1) + '/' + _pagedPages.length;
    ind.style.display = 'block';
  }

  function nextPage() {
    if (_pagedIdx < _pagedPages.length - 1) {
      _pagedIdx++;
      _renderPaged();
      savePageProgress();
    }
  }

  function prevPage() {
    if (_pagedIdx > 0) {
      _pagedIdx--;
      _renderPaged();
      savePageProgress();
    }
  }

  function savePageProgress() {
    if (!_curBook) return;
    lsSet(PAGEPROG_PREFIX + _curBook.id, String(_pagedIdx));
  }

  function restorePageProgress() {
    var content = $('novelReaderContent');
    if (!content || !_curBook) return;
    var savedIdx = parseInt(lsGet(PAGEPROG_PREFIX + _curBook.id, '0'), 10) || 0;
    _pagedIdx = Math.min(savedIdx, Math.max(0, _pagedPages.length - 1));
    _renderPaged();
  }

  /* ---------- 打开阅读页 ---------- */
  function openReader() {
    if (!_curBook) return;
    closeSheet('novelPickerOverlay');
    var c = _readerContact ? contactById(_readerContact) : null;
    var myA = $('novelReaderMyAvatar'), taA = $('novelReaderTaAvatar');
    if (myA) myA.innerHTML = avatarInner(myAvatar());
    if (taA) taA.innerHTML = c ? avatarInner(c.avatar) : '<span style="font-size:14px;color:#bbb">+</span>';
    var tt = $('novelReaderTitle');
    if (tt) tt.textContent = _curBook.title;
    var content = $('novelReaderContent');
    if (content) content.innerHTML = '<div style="text-align:center;color:#999;padding:40px 0">加载中…</div>';
    window.showEl('app-novel-reader');
    applyReaderSettings();
    idbGet(CONTENT_PREFIX + _curBook.id, function (txt) {
      txt = txt || '';
      _readerParas = txt.split(/\n+/).map(function (p) { return p.trim(); }).filter(function (p) { return p !== ''; });
      _readerIdx = 0;
      if (content) content.innerHTML = '';
      if (flipMode() === 'page') {
        enterPageMode();
        restorePageProgress();
      } else {
        exitPageMode();
        renderMoreParas();
        var prog = parseInt(lsGet(PROGRESS_PREFIX + _curBook.id, '0'), 10) || 0;
        if (content && prog > 0) {
          var targetIdx = Math.min(_readerParas.length, Math.round(prog));
          while (_readerIdx < targetIdx) renderMoreParas();
          requestAnimationFrame(function () {
            content.scrollTop = Math.max(0, content.scrollHeight - content.clientHeight);
          });
        }
      }
    });
  }

  function renderMoreParas() {
    var content = $('novelReaderContent');
    if (!content || !_readerParas.length) {
      if (content && !_readerParas.length) content.innerHTML = '<div style="text-align:center;color:#999;padding:40px 0">这本书没有内容</div>';
      return;
    }
    var end = Math.min(_readerParas.length, _readerIdx + RENDER_CHUNK);
    var html = '';
    for (var i = _readerIdx; i < end; i++) {
      html += '<p style="margin:0 0 1em;text-indent:2em;word-break:break-all">' + esc(_readerParas[i]) + '</p>';
    }
    if (end >= _readerParas.length) html += '<div id="novelProgressMarker" style="text-align:center;color:#bbb;font-size:12px;padding:24px 0">— 全书完 —</div>';
    var marker = $('novelProgressMarker');
    if (marker) marker.remove();
    var wrap = document.createElement('div');
    wrap.innerHTML = html;
    while (wrap.firstChild) content.appendChild(wrap.firstChild);
    _readerIdx = end;
  }

  function saveProgress() {
    if (!_curBook) return;
    lsSet(PROGRESS_PREFIX + _curBook.id, String(_readerIdx));
  }

  function closeReader() {
    if (flipMode() === 'page') savePageProgress(); else saveProgress();
    var e = $('app-novel-reader');
    if (e) e.style.display = 'none';
    window.__renderNovelShelf();
  }

  /* ---------- 绑定 ---------- */
  function bindNovel() {
    var back = $('novelBackBtn');
    var addBtn = $('novelAddBtn');
    var importInput = $('novelImportInput');
    var readerBack = $('novelReaderBackBtn');
    var menuBtn = $('novelMenuBtn');
    var menuClose = $('novelMenuClose');
    var menuOverlay = $('novelReaderMenu');
    var fsMinus = $('novelFontMinus'), fsPlus = $('novelFontPlus');
    var bgRow = $('novelBgColors');
    var bgInput = $('novelBgInput');
    var flipScroll = $('novelFlipScroll'), flipPage = $('novelFlipPage');
    var pickerClose = $('novelPickerClose');
    var pickerConfirm = $('novelPickerConfirm');
    var pickerOverlay = $('novelPickerOverlay');
    var actOverlay = $('novelBookActions');
    var actCover = $('novelActCover');
    var actRename = $('novelActRename');
    var actDelete = $('novelActDelete');
    var actCancel = $('novelActCancel');
    var coverInput = $('novelCoverInput');
    var renameOverlay = $('novelRenameModal');
    var renameInput = $('novelRenameInput');
    var renameOk = $('novelRenameOk');
    var renameCancel = $('novelRenameCancel');
    var content = $('novelReaderContent');

    if (back) back.addEventListener('click', goHome);
    if (addBtn) addBtn.addEventListener('click', function () { if (importInput) importInput.click(); });
    if (importInput) importInput.addEventListener('change', function () {
      var f = this.files && this.files[0];
      this.value = '';
      importNovel(f);
    });
    if (readerBack) readerBack.addEventListener('click', closeReader);
    if (menuBtn) menuBtn.addEventListener('click', function () { openSheet('novelReaderMenu'); });
    if (menuClose) menuClose.addEventListener('click', function () { closeSheet('novelReaderMenu'); });
    if (menuOverlay) menuOverlay.addEventListener('click', function (e) { if (e.target === menuOverlay) closeSheet('novelReaderMenu'); });

    if (fsMinus) fsMinus.addEventListener('click', function () {
      var s = readerSettings();
      s.fontSize = Math.max(14, (parseInt(s.fontSize, 10) || 18) - 1);
      saveReaderSettings(s); applyReaderSettings(); updatePageIndicator();
    });
    if (fsPlus) fsPlus.addEventListener('click', function () {
      var s = readerSettings();
      s.fontSize = Math.min(28, (parseInt(s.fontSize, 10) || 18) + 1);
      saveReaderSettings(s); applyReaderSettings(); updatePageIndicator();
    });

    /* 阅读区点击左右翻页 */
    if (content) {
      content.addEventListener('click', function (e) {
        if (flipMode() !== 'page') return;
        var rect = content.getBoundingClientRect();
        var x = e.clientX - rect.left;
        if (x > rect.width * 0.7) { nextPage(); e.preventDefault(); e.stopPropagation(); return; }
        if (x < rect.width * 0.3) { prevPage(); e.preventDefault(); e.stopPropagation(); return; }
      });
      var _touchStartX = 0, _touchStartY = 0;
      content.addEventListener('touchstart', function (e) {
        if (flipMode() !== 'page') return;
        if (e.touches && e.touches.length) {
          _touchStartX = e.touches[0].clientX;
          _touchStartY = e.touches[0].clientY;
        }
      }, { passive: true });
      content.addEventListener('touchend', function (e) {
        if (flipMode() !== 'page') return;
        if (e.changedTouches && e.changedTouches.length) {
          var dx = e.changedTouches[0].clientX - _touchStartX;
          var dy = e.changedTouches[0].clientY - _touchStartY;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
            if (dx < 0) nextPage(); else prevPage();
          }
        }
      }, { passive: true });
    }
    if (bgRow) Array.prototype.forEach.call(bgRow.children, function (el) {
      el.addEventListener('click', function () {
        var s = readerSettings();
        s.bgColor = el.getAttribute('data-color');
        delete s.bg;
        saveReaderSettings(s); applyReaderSettings();
      });
    });
    if (bgInput) bgInput.addEventListener('change', function () {
      var f = this.files && this.files[0];
      this.value = '';
      if (!f) return;
      var fr = new FileReader();
      fr.onload = function () {
        shrinkImage(fr.result, 750, 1334, function (url) {
          var s = readerSettings();
          s.bg = url;
          saveReaderSettings(s); applyReaderSettings();
        });
      };
      fr.readAsDataURL(f);
    });

    /* 翻页方式切换 */
    if (flipScroll) flipScroll.addEventListener('click', function () {
      var s = readerSettings();
      s.flip = 'scroll';
      saveReaderSettings(s); applyReaderSettings();
      if (_curBook) {
        savePageProgress();
        var content2 = $('novelReaderContent');
        if (content2) content2.innerHTML = '';
        _readerIdx = 0;
        exitPageMode();
        renderMoreParas();
        updatePageIndicator();
      }
    });
    if (flipPage) flipPage.addEventListener('click', function () {
      var s = readerSettings();
      s.flip = 'page';
      saveReaderSettings(s); applyReaderSettings();
      if (_curBook) {
        saveProgress();
        _readerIdx = 0;
        enterPageMode();
        restorePageProgress();
      }
    });

    if (pickerClose) pickerClose.addEventListener('click', function () { closeSheet('novelPickerOverlay'); });
    if (pickerOverlay) pickerOverlay.addEventListener('click', function (e) { if (e.target === pickerOverlay) closeSheet('novelPickerOverlay'); });
    if (pickerConfirm) pickerConfirm.addEventListener('click', function () {
      if (!_readerContact) { alert('先选一位一起看的联系人吧~'); return; }
      openReader();
    });

    if (actCancel) actCancel.addEventListener('click', function () { closeSheet('novelBookActions'); });
    if (actOverlay) actOverlay.addEventListener('click', function (e) { if (e.target === actOverlay) closeSheet('novelBookActions'); });
    if (actCover) actCover.addEventListener('click', function () {
      closeSheet('novelBookActions');
      if (coverInput) coverInput.click();
    });
    if (coverInput) coverInput.addEventListener('change', function () {
      var f = this.files && this.files[0];
      this.value = '';
      if (!f || !_curBook) return;
      var fr = new FileReader();
      fr.onload = function () {
        shrinkImage(fr.result, 240, 320, function (url) {
          _curBook.cover = url;
          saveBooks();
          window.__renderNovelShelf();
        });
      };
      fr.readAsDataURL(f);
    });
    if (actRename) actRename.addEventListener('click', function () {
      closeSheet('novelBookActions');
      if (renameInput && _curBook) renameInput.value = _curBook.title;
      openSheet('novelRenameModal');
    });
    if (actDelete) actDelete.addEventListener('click', function () {
      closeSheet('novelBookActions');
      if (!_curBook) return;
      if (!confirm('确定删除《' + _curBook.title + '》吗？')) return;
      var id = _curBook.id;
      _books = _books.filter(function (b) { return b.id !== id; });
      saveBooks();
      try { window._idbStore && window._idbStore.remove && window._idbStore.remove(CONTENT_PREFIX + id); } catch (e) {}
      lsSet(PROGRESS_PREFIX + id, '0'); /* removeItem 被主程序禁用，写 0 重置 */
      lsSet(PAGEPROG_PREFIX + id, '0');
      window.__renderNovelShelf();
    });
    if (renameCancel) renameCancel.addEventListener('click', function () { closeSheet('novelRenameModal'); });
    if (renameOverlay) renameOverlay.addEventListener('click', function (e) { if (e.target === renameOverlay) closeSheet('novelRenameModal'); });
    if (renameOk) renameOk.addEventListener('click', function () {
      if (!_curBook) { closeSheet('novelRenameModal'); return; }
      var v = (renameInput && renameInput.value || '').trim();
      if (v) {
        _curBook.title = v.slice(0, 60);
        saveBooks();
        window.__renderNovelShelf();
      }
      closeSheet('novelRenameModal');
    });

    if (content) {
      var st = null;
      content.addEventListener('scroll', function () {
        if (st) clearTimeout(st);
        st = setTimeout(function () {
          if (flipMode() === 'page') {
            updatePageIndicator();
            savePageProgress();
          } else {
            if (content.scrollTop + content.clientHeight > content.scrollHeight - 600 && _readerIdx < _readerParas.length) {
              renderMoreParas();
            }
            saveProgress();
          }
        }, 200);
      }, { passive: true });
    }
  }

  /* ---------- 启动 ---------- */
  function boot() {
    bindCompanion();
    bindNovel();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
