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

  var CHAT_CHANCE = 0.02;           // 聊天实时收藏概率 2%（对齐 syy）
  var MOMENTS_CHANCE = 0.10;        // 朋友圈实时收藏概率 10%（对齐 syy）
  var ICITY_CHANCE = 0.10;          // iCity 实时收藏概率 10%（与朋友圈一致）
  var MUSIC_CHANCE = 0.10;          // 网易云收藏概率 10%（与朋友圈一致）
  var CHAT_HISTORY_CHANCE = 0.03;   // 历史聊天收藏概率 3%（对齐 syy）
  var MOMENTS_HISTORY_CHANCE = 0.05;// 历史朋友圈收藏概率 5%（对齐 syy）
  var ICITY_HISTORY_CHANCE = 0.05;  // 历史 iCity 收藏概率 5%（与朋友圈一致）
  var MUSIC_HISTORY_CHANCE = 0.05;  // 历史网易云收藏概率 5%（与朋友圈一致）

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

  // 随机选择一个“创建的联系人”（排除系统 me/my），用于收藏归属
  function pickRandomCreatedContact() {
    var list = getContacts().filter(function (c) {
      return c && c.id && c.id !== 'me' && c.id !== 'my';
    });
    if (!list.length) return null;
    return list[Math.floor(Math.random() * list.length)];
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
      // 统一走 akiniStore（内存缓存+IDB+localStorage），与朋友圈数据持久化逻辑一致
      var saved = window.akiniStore && window.akiniStore.getSync
        ? window.akiniStore.getSync(storageKey(contactId), null)
        : localStorage.getItem(storageKey(contactId));
      if (saved && typeof saved === 'string') {
        var parsed = JSON.parse(saved);
        return {
          chat: Array.isArray(parsed.chat) ? parsed.chat : [],
          moments: Array.isArray(parsed.moments) ? parsed.moments : [],
          icity: Array.isArray(parsed.icity) ? parsed.icity : [],
          music: Array.isArray(parsed.music) ? parsed.music : []
        };
      }
    } catch (e) {}
    return { chat: [], moments: [], icity: [], music: [] };
  }

  function saveCollections(contactId, data) {
    var n = JSON.stringify(data);
    if (window.akiniStore && window.akiniStore.set) {
      window.akiniStore.set(storageKey(contactId), n);
    } else {
      try { localStorage.setItem(storageKey(contactId), n); } catch (e) {}
    }
  }

  /* 从字卡库随机抽一张字卡作为收藏备注（无兜底：字卡库为空时不加备注） */
  function pickWordcardRemark() {
    try {
      var raw = localStorage.getItem('akini_wordbank');
      var wb = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(wb)) return '';
      wb = wb.filter(function (t) { return t && (!t.tab || t.tab === 'main') && String(t.text || t.content || '').trim(); });
      if (!wb.length) return '';
      var c = wb[Math.floor(Math.random() * wb.length)];
      return String(c.text || c.content || '').trim();
    } catch (e) { return ''; }
  }

  function addCollection(contactId, type, content, originalTime) {
    if (!content || !content.trim()) return false;
    /* 严格归属到传入的联系人：微信消息只收藏对应窗口的，朋友圈/iCity/网易云各自独立收藏 */
    var targetId = contactId;
    if (!targetId) return false;
    var data = loadCollections(targetId);
    var dup = false;
    for (var i = 0; i < data[type].length; i++) {
      if (data[type][i].content === content.trim() && data[type][i].originalTime === originalTime) { dup = true; break; }
    }
    if (dup) return false;
    data[type].unshift({
      id: Date.now() + Math.random(),
      content: content.trim(),
      remark: pickWordcardRemark(),
      originalTime: originalTime || Date.now(),
      collectedTime: Date.now()
    });
    saveCollections(targetId, data);
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

  // 联系人收藏用户添加的歌曲：track = {title, artist, cover, ...}
  function addMusicCollection(contactId, track, originalTime) {
    if (!track || !(track.title || track.name)) return false;
    var targetId = contactId;
    if (!targetId) return false;
    var data = loadCollections(targetId);
    var title = String(track.title || track.name || '').trim();
    var artist = String(track.artist || track.singer || '').trim();
    var cover = track.cover || track.pic || '';
    for (var i = 0; i < data.music.length; i++) {
      var it = data.music[i];
      if (it && it.track && it.track.title === title && it.track.artist === artist) return false;
    }
    data.music.unshift({
      id: Date.now() + Math.random(),
      track: { title: title, artist: artist, cover: cover },
      remark: pickWordcardRemark(),
      originalTime: originalTime || Date.now(),
      collectedTime: Date.now()
    });
    saveCollections(targetId, data);
    return true;
  }

  window.akiniTaPhoneCollectMusic = function (track, timestamp) {
    if (!track) return;
    /* 每个联系人独立判定是否收藏（各自 10% 概率），收藏到各自的手机 */
    var all = getContacts();
    for (var i = 0; i < all.length; i++) {
      if (all[i] && all[i].id && Math.random() < MUSIC_CHANCE)
        addMusicCollection(all[i].id, track, timestamp || Date.now());
    }
  };

  var _lastScanAt = 0;
  function scanHistory() {
    /* 节流：30 分钟内最多全量扫描一次，避免频繁打开 TA 手机时反复解析全部聊天 DOM 导致卡顿 */
    var now = Date.now();
    if (now - _lastScanAt < 30 * 60 * 1000) return;
    _lastScanAt = now;
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
          /* 只收藏该联系人自己窗口的消息；每次扫描每人最多 1 条（从最新往旧，命中即停） */
          for (var ri = meRows.length - 1; ri >= 0; ri--) {
            var bubble = meRows[ri].querySelector('.bubble');
            if (!bubble) continue;
            if (bubble.querySelector('img') && !(bubble.textContent || '').trim()) continue;
            var text = (bubble.textContent || '').trim();
            if (!text) continue;
            if (Math.random() < CHAT_HISTORY_CHANCE) { addCollection(c.id, 'chat', text, Date.now()); break; }
          }
        });
      }
      var posts = (typeof window.__akiniGetPosts === 'function') ? window.__akiniGetPosts() : [];
      var myPosts = [], myDiaries = [];
      if (Array.isArray(posts)) {
        var myName = localStorage.getItem('akini_my_name') || '我';
        posts.forEach(function (post) {
          if (!post || !post.text || !post.text.trim()) return;
          if (post.author && post.author !== myName) return;
          if (post.source === 'icity') myDiaries.push(post); else myPosts.push(post);
        });
      }
      var plist = [];
      try {
        var plistRaw = (window.akiniStore && window.akiniStore.getSync)
          ? window.akiniStore.getSync('akini_music_playlist', null)
          : localStorage.getItem('akini_music_playlist');
        plist = plistRaw ? JSON.parse(plistRaw) : [];
      } catch (e) {}
      if (!Array.isArray(plist)) plist = [];
      /* 朋友圈/iCity/网易云：每个联系人独立判定、各自收藏到自己的手机；
         每类每次扫描最多 1 条（从最新往旧扫，命中即停），不会一口气收藏一堆 */
      contacts.forEach(function (c) {
        if (!c || !c.id) return;
        for (var mi = myPosts.length - 1; mi >= 0; mi--) {
          if (Math.random() < MOMENTS_HISTORY_CHANCE) { addCollection(c.id, 'moments', myPosts[mi].text, myPosts[mi].ts || Date.now()); break; }
        }
        for (var di = myDiaries.length - 1; di >= 0; di--) {
          if (Math.random() < ICITY_HISTORY_CHANCE) { addCollection(c.id, 'icity', myDiaries[di].text, myDiaries[di].ts || Date.now()); break; }
        }
        for (var si = plist.length - 1; si >= 0; si--) {
          var t = plist[si];
          if (!t || !(t.title || t.name)) continue;
          if (Math.random() < MUSIC_HISTORY_CHANCE) { addMusicCollection(c.id, t, Date.now()); break; }
        }
      });
    } catch (e) {}
  }

  /* ============ 渲染 ============ */
  function getEl(id) { return document.getElementById(id); }

  function showContainer() {
    var c = getEl('akini-ta-phone-container');
    if (!c) {
      try { init(); } catch (e) { console.error('[TA手机] init失败', e); }
      c = getEl('akini-ta-phone-container');
    }
    if (!c) { console.warn('[TA手机] 容器注入失败'); return; }
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
    updateTitle((c && c.name ? c.name + ' · ' : '') + (tab === 'chat' ? '聊天' : (tab === 'moments' ? '朋友圈' : (tab === 'music' ? '网易云' : 'iCity'))));
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
    /* 旧收藏补齐备注：无 remark 的条目现场从字卡库抽一张补上并持久化（字卡库为空则跳过，无兜底文案） */
    var needSave = false;
    items.forEach(function (it) {
      if (it && !it.remark) {
        var r = pickWordcardRemark();
        if (r) { it.remark = r; needSave = true; }
      }
    });
    if (needSave) saveCollections(currentContactId, data);
    var sorted = items.slice();
    // 所有数据统一按收藏时间倒序排列
    sorted.sort(function (a, b) { return (b.collectedTime || 0) - (a.collectedTime || 0); });
    if (currentTab === 'music') {
      el.innerHTML = sorted.map(function (item) {
        var t = item.track || {};
        var cover = t.cover
          ? '<img src="' + t.cover + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" alt="封面"/>'
          : '<span style="font-size:20px;line-height:1;">🎵</span>';
        return '<div class="akini-ta-phone-item akini-ta-phone-music-item">' +
          '<button class="akini-ta-phone-item-delete" onclick="window.AkiniTaPhone.deleteCollection(\'' + currentContactId + '\',\'music\',' + item.id + ')" title="删除">×</button>' +
          '<div class="akini-ta-phone-music-row">' +
            '<div class="akini-ta-phone-music-disc">' + cover + '</div>' +
            '<div class="akini-ta-phone-music-meta">' +
              '<div class="akini-ta-phone-music-title">' + escapeHtml(t.title || '未知歌曲') + '</div>' +
              '<div class="akini-ta-phone-music-artist">' + escapeHtml(t.artist || '未知歌手') + '</div>' +
            '</div>' +
          '</div>' +
          (item.remark ? '<div class="akini-ta-phone-item-remark">备注：' + escapeHtml(item.remark) + '</div>' : '') +
          '<div class="akini-ta-phone-item-meta">收藏于: ' + formatTime(item.collectedTime) + '</div>' +
        '</div>';
      }).join('');
      return;
    }
    el.innerHTML = sorted.map(function (item) {
      return '<div class="akini-ta-phone-item">' +
        '<button class="akini-ta-phone-item-delete" onclick="window.AkiniTaPhone.deleteCollection(\'' + currentContactId + '\',\'' + currentTab + '\',' + item.id + ')" title="删除">×</button>' +
        '<div class="akini-ta-phone-item-time">' + formatTime(item.originalTime) + '</div>' +
        '<div class="akini-ta-phone-item-text">' + escapeHtml(item.content) + '</div>' +
        (item.remark ? '<div class="akini-ta-phone-item-remark">备注：' + escapeHtml(item.remark) + '</div>' : '') +
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
      '.akini-ta-phone-container{position:fixed!important;inset:0!important;z-index:200000!important;display:flex;align-items:center;justify-content:center;background:rgba(245,245,245,0.92)!important;}',
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
      '.akini-ta-phone-desktop{display:none;justify-content:flex-start;align-items:flex-start;flex-wrap:wrap;gap:26px 6%;padding:40px 24px;flex:1;background:#fff;align-content:flex-start;}',
      '.akini-ta-phone-app{display:flex;flex-direction:column;align-items:center;gap:7px;cursor:pointer;width:27%;flex-shrink:0;}',
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
      '.akini-ta-phone-item-remark{font-size:12px;color:#999;margin-top:6px;line-height:1.5;word-break:break-word;}',
      '.akini-ta-phone-item-delete{position:absolute;top:8px;right:8px;background:none;border:none;color:#ccc;font-size:18px;cursor:pointer;line-height:1;}',
      '.akini-ta-phone-item-delete:hover{color:#ef4444;}',
      '.akini-ta-phone-empty{text-align:center;padding:40px 20px;color:#bbb;font-size:14px;}',
      '.akini-ta-phone-music-row{display:flex;align-items:center;gap:10px;padding-right:18px;}',
      '.akini-ta-phone-music-disc{width:44px;height:44px;flex-shrink:0;border-radius:50%;background:repeating-radial-gradient(#111 0,#111 3px,#222 4px,#222 5px);box-shadow:inset 0 0 0 4px #1a1a1a;display:flex;align-items:center;justify-content:center;overflow:hidden;}',
      '.akini-ta-phone-music-meta{min-width:0;flex:1;}',
      '.akini-ta-phone-music-title{font-size:14px;font-weight:600;color:#111;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.akini-ta-phone-music-artist{font-size:12px;color:#888;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      ''
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
          '<div class="akini-ta-phone-app" onclick="window.AkiniTaPhone.showApp(\'music\')">' +
            '<div class="akini-ta-phone-app-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></div>' +
            '<span class="akini-ta-phone-app-name">网易云</span>' +
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