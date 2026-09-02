/**
 * TA的手机 - Akini 版
 * - 小手机样式的居中弹窗
 * - 打开后首先显示「所有创建过的联系人」网格：头像在上，名字在下
 * - 点击联系人后进入该联系人的桌面，显示三个应用：聊天 / 朋友圈 / iCity
 * - 点击应用后查看 TA 自动收藏的该联系人的对应数据
 * - 收藏逻辑参考 syy ta-phone.js：系统按概率自动收藏用户发过的聊天消息与朋友圈/iCity
 * - 数据按联系人维度存储：akini_ta_phone_<contactId> = { chat:[], moments:[], icity:[] }
 */
(function () {
  'use strict';

  var CHAT_CHANCE = 0.02;           // 聊天实时收藏概率 2%
  var MOMENTS_CHANCE = 0.10;        // 朋友圈实时收藏概率 10%
  var ICITY_CHANCE = 0.10;          // iCity 实时收藏概率 10%（与朋友圈一致）
  var CHAT_HISTORY_CHANCE = 0.03;   // 历史聊天收藏概率 3%
  var MOMENTS_HISTORY_CHANCE = 0.05;// 历史朋友圈收藏概率 5%
  var ICITY_HISTORY_CHANCE = 0.05;  // 历史 iCity 收藏概率 5%

  // 当前查看的联系人 id
  var currentContactId = null;
  // 当前 tab：'chat' | 'moments' | 'icity'
  var currentTab = 'chat';
  var chatSortMode = 'collected';

  /* ============ 工具 ============ */
  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
  }

  function formatTime(ts) {
    var d = new Date(ts || Date.now());
    function p(n) { return n < 10 ? '0' + n : '' + n; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function getContacts() {
    try {
      if (window.akiniContacts && typeof window.akiniContacts.getContacts === 'function') {
        return window.akiniContacts.getContacts() || [];
      }
    } catch (e) {}
    return [];
  }

  function getContactById(id) {
    var list = getContacts();
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].id === id) return list[i];
    }
    return null;
  }

  function avatarHtml(c, size) {
    size = size || 48;
    var av = (c && c.avatar) || '👤';
    var style = 'width:' + size + 'px;height:' + size + 'px;border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#f0f0f0;';
    if (typeof av === 'string' && av.indexOf('data:') === 0) {
      return '<div style="' + style + '"><img src="' + av + '" style="width:100%;height:100%;object-fit:cover;" alt="头像"/></div>';
    }
    return '<div style="' + style + '"><span style="font-size:' + Math.round(size * 0.55) + 'px;">' + escapeHtml(av) + '</span></div>';
  }

  /* ============ 收藏存储（按联系人维度） ============ */
  function storageKey(contactId) { return 'akini_ta_phone_' + contactId; }

  function loadCollections(contactId) {
    try {
      var saved = localStorage.getItem(storageKey(contactId));
      if (saved) {
        var parsed = JSON.parse(saved);
        return {
          chat: Array.isArray(parsed.chat) ? parsed.chat : [],
          moments: Array.isArray(parsed.moments) ? parsed.moments : [],
          icity: Array.isArray(parsed.icity) ? parsed.icity : []
        };
      }
    } catch (e) {}
    return { chat: [], moments: [], icity: [] };
  }

  function saveCollections(contactId, data) {
    try { localStorage.setItem(storageKey(contactId), JSON.stringify(data)); } catch (e) {}
  }

  function addCollection(contactId, type, content, originalTime) {
    if (!contactId || !content || !content.trim()) return false;
    var data = loadCollections(contactId);
    var dup = false;
    for (var i = 0; i < data[type].length; i++) {
      if (data[type][i].content === content.trim() && data[type][i].originalTime === originalTime) { dup = true; break; }
    }
    if (dup) return false;
    data[type].unshift({
      id: Date.now() + Math.random(),
      content: content.trim(),
      originalTime: originalTime || Date.now(),
      collectedTime: Date.now()
    });
    saveCollections(contactId, data);
    return true;
  }

  window.akiniTaPhoneCollectChat = function (contactId, text, timestamp) {
    if (!contactId || !text || !text.trim()) return;
    if (Math.random() < CHAT_CHANCE) addCollection(contactId, 'chat', text.trim(), timestamp || Date.now());
  };

  window.akiniTaPhoneCollectMoment = function (contactId, text, timestamp) {
    if (!contactId || !text || !text.trim()) return;
    if (Math.random() < MOMENTS_CHANCE) addCollection(contactId, 'moments', text.trim(), timestamp || Date.now());
  };

  window.akiniTaPhoneCollectIcity = function (contactId, text, timestamp) {
    if (!contactId || !text || !text.trim()) return;
    if (Math.random() < ICITY_CHANCE) addCollection(contactId, 'icity', text.trim(), timestamp || Date.now());
  };

  function scanHistory() {
    try {
      var contacts = getContacts();
      if (window.akiniContacts && typeof window.akiniContacts.getChatTarget === 'function') {
        contacts.forEach(function (c) {
          if (!c || !c.id) return;
          var target = window.akiniContacts.getChatTarget(c.id);
          if (!target || target.type !== 'contact') return;
          var session = window.akiniContacts.getSession(c.id);
          var html = session && session.messagesHTML ? session.messagesHTML : '';
          if (!html) return;
          var tmp = document.createElement('div');
          tmp.innerHTML = html;
          var meRows = tmp.querySelectorAll('.msg-row.me');
          meRows.forEach(function (row) {
            var bubble = row.querySelector('.bubble');
            if (!bubble) return;
            if (bubble.querySelector('img') && !(bubble.textContent || '').trim()) return;
            var text = (bubble.textContent || '').trim();
            if (!text) return;
            if (Math.random() < CHAT_HISTORY_CHANCE) addCollection(c.id, 'chat', text, Date.now());
          });
        });
      }
      var posts = (typeof window.__akiniGetPosts === 'function') ? window.__akiniGetPosts() : [];
      if (Array.isArray(posts)) {
        var myName = localStorage.getItem('akini_my_name') || '我';
        posts.forEach(function (post) {
          if (!post || !post.text || !post.text.trim()) return;
          if (post.author && post.author !== myName) return;
          var cid = currentContactId || (contacts[0] && contacts[0].id);
          if (!cid) return;
          if (post.source === 'icity') {
            if (Math.random() < ICITY_HISTORY_CHANCE) addCollection(cid, 'icity', post.text, post.ts || Date.now());
          } else {
            if (Math.random() < MOMENTS_HISTORY_CHANCE) addCollection(cid, 'moments', post.text, post.ts || Date.now());
          }
        });
      }
    } catch (e) {}
  }

  /* ============ 渲染 ============ */
  function getEl(id) { return document.getElementById(id); }

  function showContainer() {
    var c = getEl('akini-ta-phone-container');
    if (!c) return;
    if (c.parentElement !== document.body) document.body.appendChild(c);
    c.style.display = 'flex';
    showContactGrid();
  }

  function hideContainer() {
    var c = getEl('akini-ta-phone-container');
    if (c) c.style.display = 'none';
  }

  function hideAllViews() {
    var grid = getEl('akini-ta-phone-contact-grid');
    var desktop = getEl('akini-ta-phone-desktop');
    var listView = getEl('akini-ta-phone-list-view');
    if (grid) grid.style.display = 'none';
    if (desktop) desktop.style.display = 'none';
    if (listView) listView.style.display = 'none';
  }

  function showContactGrid() {
    hideAllViews();
    var grid = getEl('akini-ta-phone-contact-grid');
    if (grid) { grid.style.display = 'flex'; updateTitle('TA的手机'); renderContactGrid(); }
  }

  function openContact(contactId) {
    currentContactId = contactId;
    hideAllViews();
    var desktop = getEl('akini-ta-phone-desktop');
    if (desktop) desktop.style.display = 'flex';
    var c = getContactById(contactId);
    updateTitle((c && c.name) || 'TA的手机');
  }

  function showApp(tab) {
    if (!currentContactId) return;
    currentTab = tab;
    hideAllViews();
    var listView = getEl('akini-ta-phone-list-view');
    if (listView) listView.style.display = 'flex';
    var c = getContactById(currentContactId);
    updateTitle((c && c.name ? c.name + ' · ' : '') + (tab === 'chat' ? '聊天' : (tab === 'moments' ? '朋友圈' : 'iCity')));
    renderList();
  }

  function goBack() {
    var listView = getEl('akini-ta-phone-list-view');
    var desktop = getEl('akini-ta-phone-desktop');
    if (listView && listView.style.display !== 'none') {
      hideAllViews();
      if (desktop) desktop.style.display = 'flex';
      var c = getContactById(currentContactId);
      updateTitle((c && c.name) || 'TA的手机');
    } else if (desktop && desktop.style.display !== 'none') {
      showContactGrid();
      currentContactId = null;
    } else {
      hideContainer();
      currentContactId = null;
    }
  }

  function updateTitle(text) {
    var el = getEl('akini-ta-phone-title');
    if (el) el.textContent = text;
  }

  function renderContactGrid() {
    var el = getEl('akini-ta-phone-contact-grid');
    if (!el) return;
    var contacts = getContacts();
    if (!contacts.length) {
      el.innerHTML = '<div class="akini-ta-phone-empty">还没有联系人，快去创建吧~</div>';
      return;
    }
    el.innerHTML = contacts.map(function (c) {
      return '<div class="akini-ta-phone-grid-item" onclick="window.AkiniTaPhone.openContact(\'' + c.id + '\')">' +
        avatarHtml(c, 56) +
        '<div class="akini-ta-phone-grid-name">' + escapeHtml(c.name || '联系人') + '</div>' +
      '</div>';
    }).join('');
  }

  function renderList() {
    var el = getEl('akini-ta-phone-list');
    if (!el || !currentContactId) return;
    var data = loadCollections(currentContactId);
    var items = data[currentTab] || [];
    var sortBar = getEl('akini-ta-phone-sort-bar');
    if (sortBar) sortBar.style.display = currentTab === 'chat' ? 'flex' : 'none';
    if (!items.length) {
      el.innerHTML = '<div class="akini-ta-phone-empty">TA 还没有收藏任何内容...</div>';
      return;
    }
    var sorted = items.slice();
    // 所有数据统一按收藏时间倒序排列
    sorted.sort(function (a, b) { return (b.collectedTime || 0) - (a.collectedTime || 0); });
    el.innerHTML = sorted.map(function (item) {
      return '<div class="akini-ta-phone-item">' +
        '<button class="akini-ta-phone-item-delete" onclick="window.AkiniTaPhone.deleteCollection(\'' + currentContactId + '\',\'' + currentTab + '\',' + item.id + ')" title="删除">×</button>' +
        '<div class="akini-ta-phone-item-time">' + formatTime(item.originalTime) + '</div>' +
        '<div class="akini-ta-phone-item-text">' + escapeHtml(item.content) + '</div>' +
        '<div class="akini-ta-phone-item-meta">发送于: ' + formatTime(item.originalTime) + ' | 收藏于: ' + formatTime(item.collectedTime) + '</div>' +
      '</div>';
    }).join('');
  }

  function deleteCollection(contactId, type, id) {
    if (!confirm('是否要偷偷取消 TA 的收藏？')) return;
    var data = loadCollections(contactId);
    data[type] = data[type].filter(function (item) { return item.id !== id; });
    saveCollections(contactId, data);
    renderList();
  }

  /* ============ 样式注入 ============ */
  function injectStyles() {
    if (getEl('akini-ta-phone-styles')) return;
    var style = document.createElement('style');
    style.id = 'akini-ta-phone-styles';
    style.textContent = [
      // 遮罩：浅灰色
      '.akini-ta-phone-container{position:fixed!important;inset:0!important;z-index:100000!important;display:flex;align-items:center;justify-content:center;background:rgba(245,245,245,0.92)!important;}',
      // 竖屏小手机外观
      '.akini-ta-phone-modal{width:min(76vw,340px);height:min(78vh,680px);max-height:680px;background:#fff;border-radius:44px;overflow:hidden;box-shadow:0 25px 70px rgba(0,0,0,0.22);display:flex;flex-direction:column;border:10px solid #111;}',
      // 灵动岛
      '.akini-ta-phone-notch{width:90px;height:26px;background:#111;border-radius:13px;margin:10px auto 4px;flex-shrink:0;}',
      // header
      '.akini-ta-phone-header{background:transparent;display:flex;align-items:center;justify-content:space-between;padding:8px 14px 10px;flex-shrink:0;}',
      '.akini-ta-phone-back{background:none;border:none;color:#999;font-size:24px;cursor:pointer;font-weight:400;line-height:1;padding:0 4px;}',
      '.akini-ta-phone-back:active{opacity:0.6;}',
      '.akini-ta-phone-title{font-size:15px;font-weight:600;color:#111;flex:1;text-align:center;}',
      // 联系人网格（首页图标风格）
      '.akini-ta-phone-contact-grid{display:none;flex:1;overflow-y:auto;padding:24px 16px 16px;gap:22px 16px;flex-wrap:wrap;align-content:flex-start;justify-content:center;background:#fff;}',
      '.akini-ta-phone-grid-item{display:flex;flex-direction:column;align-items:center;gap:7px;width:64px;cursor:pointer;}',
      '.akini-ta-phone-grid-item:active{opacity:0.7;}',
      '.akini-ta-phone-grid-name{font-size:12px;color:#666;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;}',
      // 联系人桌面（三个应用图标）
      '.akini-ta-phone-desktop{display:none;justify-content:center;align-items:center;gap:34px;padding:45px 20px;flex:1;background:#fff;}',
      '.akini-ta-phone-app{display:flex;flex-direction:column;align-items:center;gap:7px;cursor:pointer;}',
      '.akini-ta-phone-app:active{opacity:0.7;}',
      '.akini-ta-phone-app-icon{width:56px;height:56px;display:flex;align-items:center;justify-content:center;color:#666;}',
      '.akini-ta-phone-app-icon svg{width:100%;height:100%;}',
      '.akini-ta-phone-app-name{font-size:12px;color:#666;}',
      // 列表视图
      '.akini-ta-phone-list-view{display:none;flex-direction:column;flex:1;min-height:0;overflow:hidden;background:#fff;}',
      '.akini-ta-phone-list{flex:1;overflow-y:auto;padding:12px 12px 16px;}',
      '.akini-ta-phone-list .akini-ta-phone-empty{padding-top:60px;}',
      '.akini-ta-phone-item{background:#f7f7f7;border-radius:12px;padding:12px;margin-bottom:8px;position:relative;}',
      '.akini-ta-phone-item-time{font-size:12px;color:#999;margin-bottom:4px;}',
      '.akini-ta-phone-item-text{font-size:14px;color:#111;line-height:1.5;word-break:break-all;}',
      '.akini-ta-phone-item-meta{font-size:11px;color:#bbb;margin-top:4px;}',
      '.akini-ta-phone-item-delete{position:absolute;top:8px;right:8px;background:none;border:none;color:#ccc;font-size:18px;cursor:pointer;line-height:1;}',
      '.akini-ta-phone-item-delete:hover{color:#ef4444;}',
      '.akini-ta-phone-empty{text-align:center;padding:40px 20px;color:#bbb;font-size:14px;}'
    ].join('');
    document.head.appendChild(style);
  }

  /* ============ DOM 注入 ============ */
  function injectDOM() {
    if (getEl('akini-ta-phone-container')) return;
    var container = document.createElement('div');
    container.id = 'akini-ta-phone-container';
    container.className = 'akini-ta-phone-container';
    container.style.display = 'none';
    container.innerHTML =
      '<div class="akini-ta-phone-modal">' +
        '<div class="akini-ta-phone-notch"></div>' +
        '<div class="akini-ta-phone-header">' +
          '<button class="akini-ta-phone-back" onclick="window.AkiniTaPhone.goBack()">‹</button>' +
          '<span class="akini-ta-phone-title" id="akini-ta-phone-title">TA的手机</span>' +
          '<span style="width:32px;"></span>' +
        '</div>' +
        // 联系人网格
        '<div class="akini-ta-phone-contact-grid" id="akini-ta-phone-contact-grid"></div>' +
        // 联系人桌面（三个应用）
        '<div class="akini-ta-phone-desktop" id="akini-ta-phone-desktop">' +
          '<div class="akini-ta-phone-app" onclick="window.AkiniTaPhone.showApp(\'chat\')">' +
            '<div class="akini-ta-phone-app-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>' +
            '<span class="akini-ta-phone-app-name">聊天</span>' +
          '</div>' +
          '<div class="akini-ta-phone-app" onclick="window.AkiniTaPhone.showApp(\'moments\')">' +
            '<div class="akini-ta-phone-app-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>' +
            '<span class="akini-ta-phone-app-name">朋友圈</span>' +
          '</div>' +
          '<div class="akini-ta-phone-app" onclick="window.AkiniTaPhone.showApp(\'icity\')">' +
            '<div class="akini-ta-phone-app-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg></div>' +
            '<span class="akini-ta-phone-app-name">iCity</span>' +
          '</div>' +
        '</div>' +
        // 收藏列表
        '<div class="akini-ta-phone-list-view" id="akini-ta-phone-list-view">' +
          '<div class="akini-ta-phone-list" id="akini-ta-phone-list"></div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(container);
  }

  var _scanned = false;
  function init() {
    injectStyles();
    injectDOM();
    if (!_scanned) {
      _scanned = true;
      setTimeout(scanHistory, 2500);
    }
  }

  window.AkiniTaPhone = {
    showTaPhone: showContainer,
    hideTaPhone: hideContainer,
    goBack: goBack,
    openContact: openContact,
    showApp: showApp,
    deleteCollection: deleteCollection
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  setTimeout(init, 1500);
})();