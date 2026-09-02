/*
 * akini-syy-bridge.js
 * 作用：把 Akini 的本地存储数据与 syy-my-main 的存储方案打通。
 * 说明：本文件作为兼容层引入，先完整迁移一次旧 Akini 数据到 syy 键名/格式，
 *       再拦截 Akini 对 localStorage 的写操作，使其同步写入 syy 格式。
 *       来信/回信逻辑也直接复用 syy 的 envelope（时空来信）核心。
 */
(function () {
  'use strict';

  // 防止重复注入
  if (window.__akiniSyyBridgeReady) return;
  window.__akiniSyyBridgeReady = true;

  /* ========== 1. syy 风格存储基础设施 ========== */
  const APP_PREFIX = 'CHAT_APP_V3_';
  const DEFAULT_SESSION_ID = 'akini_default';
  let SESSION_ID = DEFAULT_SESSION_ID;
  window.APP_PREFIX = APP_PREFIX;
  window.SESSION_ID = SESSION_ID;

  if (typeof localforage !== 'undefined') {
    try {
      localforage.config({
        driver: [localforage.INDEXEDDB, localforage.WEBSQL, localforage.LOCALSTORAGE],
        name: 'ChatApp_V3',
        version: 1.0,
        storeName: 'chat_data',
        description: 'Storage for Chat App V3 (Akini bridge)'
      });
    } catch (e) {
      console.warn('[akini-syy-bridge] localforage config failed', e);
    }
  }

  function safeGetItem(key) {
    try { return localStorage.getItem(key); }
    catch (e) { return null; }
  }
  function safeSetItem(key, value) {
    try {
      if (typeof value === 'object') value = JSON.stringify(value);
      localStorage.setItem(key, value);
    } catch (e) { console.warn('[safeSetItem]', key, e); }
  }
  function safeRemoveItem(key) {
    try { localStorage.removeItem(key); }
    catch (e) { console.warn('[safeRemoveItem]', key, e); }
  }

  function getStorageKey(baseKey) {
    return APP_PREFIX + SESSION_ID + '_' + baseKey;
  }
  window.getStorageKey = getStorageKey;

  // 简单节流保存
  let _saveTimer = null;
  function throttledSyySave(fn) {
    if (_saveTimer) clearTimeout(_saveTimer);
    _saveTimer = setTimeout(function () { try { fn(); } catch (e) {} }, 300);
  }

  /* ========== 2. 旧 Akini 数据迁移到 syy 格式 ========== */
  async function migrateAkiniToSyy() {
    if (safeGetItem('__akini_syy_migrated__') === '1') return;
    console.log('[akini-syy-bridge] 开始迁移旧 Akini 数据到 syy 格式...');

    try {
      // 2.1 联系人 → syy sessionList
      const contactsRaw = safeGetItem('akini_contacts');
      let sessions = [];
      if (contactsRaw) {
        let contacts = [];
        try { contacts = JSON.parse(contactsRaw); } catch (e) {}
        if (Array.isArray(contacts)) {
          sessions = contacts.map(function (c) {
            return {
              id: c.id || ('legacy_' + Math.random().toString(36).slice(2, 8)),
              name: c.name || '联系人',
              avatar: c.avatar || null,
              createdAt: c.createdAt || Date.now(),
              isGroup: !!c.isGroup,
              members: c.members || []
            };
          });
          await localforage.setItem(APP_PREFIX + 'sessionList', sessions);
        }
      }

      // 2.2 单聊历史 → syy chatMessages（合并到 default session）
      const chatMessages = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith('akini_chat_history_')) continue;
        const sid = k.replace('akini_chat_history_', '');
        let sessionHtml = '';
        try { sessionHtml = localStorage.getItem(k) || ''; } catch (e) {}
        // 解析 messagesHTML 里的消息行
        if (sessionHtml) {
          const div = document.createElement('div');
          div.innerHTML = sessionHtml;
          const rows = div.querySelectorAll('.msg-row');
          rows.forEach(function (row) {
            const bubble = row.querySelector('.bubble');
            if (!bubble) return;
            const isMe = row.classList.contains('me');
            const timeEl = row.querySelector('.msg-time');
            const ts = timeEl ? parseDateText(timeEl.textContent) : Date.now();
            chatMessages.push({
              id: 'mig_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
              sender: isMe ? 'user' : 'partner',
              text: bubble.textContent || '',
              timestamp: ts,
              type: 'normal',
              sessionId: sid,
              migrated: true
            });
          });
        }
      }
      if (chatMessages.length) {
        await localforage.setItem(getStorageKey('chatMessages'), chatMessages);
      }

      // 2.3 朋友圈 → syy moments_data
      const postsRaw = safeGetItem('akini_posts');
      if (postsRaw) {
        let posts = [];
        try { posts = JSON.parse(postsRaw); } catch (e) {}
        if (Array.isArray(posts) && posts.length) {
          const momentsData = posts.map(function (p) {
            return {
              id: p.id || ('post_' + Date.now()),
              text: p.content || '',
              images: p.images || [],
              time: p.time || Date.now(),
              avatar: p.avatar || '',
              nickname: p.nickname || '我',
              likes: p.likes || [],
              comments: p.comments || [],
              source: 'akini_migrated'
            };
          });
          safeSetItem('moments_data', momentsData);
        }
      }

      // 2.4 iCity 日记 → syy diary_*（仅保留数组型日记）
      const diariesRaw = safeGetItem('akini_icity_diaries');
      if (diariesRaw) {
        let diaries = [];
        try { diaries = JSON.parse(diariesRaw); } catch (e) {}
        if (Array.isArray(diaries)) {
          await localforage.setItem(getStorageKey('diaryEntries'), diaries);
        }
      }

      // 2.5 邮件 → syy envelopeData
      const sentRaw = safeGetItem('akini_mail_sent');
      const receivedRaw = safeGetItem('akini_mail_received');
      let outbox = [], inbox = [];
      if (sentRaw) {
        try {
          const sent = JSON.parse(sentRaw);
          if (Array.isArray(sent)) {
            outbox = sent.map(function (m) {
              return {
                id: m.id || ('mail_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5)),
                content: m.content || m.text || '',
                sentTime: m.time || m.sentTime || Date.now(),
                replyTime: m.replyTime || (m.time + 3600000),
                status: m.status || 'pending',
                migrated: true
              };
            });
          }
        } catch (e) {}
      }
      if (receivedRaw) {
        try {
          const recv = JSON.parse(receivedRaw);
          if (Array.isArray(recv)) {
            inbox = recv.map(function (m) {
              return {
                id: m.id || ('reply_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5)),
                refId: m.refId || '',
                originalContent: m.originalContent || '',
                content: m.content || m.text || '',
                receivedTime: m.time || m.receivedTime || Date.now(),
                isNew: false,
                migrated: true
              };
            });
          }
        } catch (e) {}
      }
      if (outbox.length || inbox.length) {
        await localforage.setItem(getStorageKey('envelopeData'), { outbox: outbox, inbox: inbox, spacetime: [] });
      }

      // 2.6 头像备份
      const myAvatar = safeGetItem('akini_icity_my_avatar') || safeGetItem('akini_my_avatar');
      const taAvatar = safeGetItem('akini_icity_ta_avatar') || safeGetItem('akini_ta_avatar');
      if (myAvatar) await localforage.setItem(getStorageKey('myAvatar'), myAvatar);
      if (taAvatar) await localforage.setItem(getStorageKey('partnerAvatar'), taAvatar);

      safeSetItem('__akini_syy_migrated__', '1');
      console.log('[akini-syy-bridge] 迁移完成');
    } catch (e) {
      console.error('[akini-syy-bridge] 迁移失败', e);
    }
  }

  function parseDateText(text) {
    if (!text) return Date.now();
    const d = new Date(text);
    return isNaN(d.getTime()) ? Date.now() : d.getTime();
  }

  /* ========== 3. 拦截 Akini 的 localStorage 写操作，同步到 syy ========== */
  const originalSetItem = localStorage.setItem.bind(localStorage);
  const originalRemoveItem = localStorage.removeItem.bind(localStorage);

  localStorage.setItem = function (key, value) {
    originalSetItem(key, value);
    syncAkiniKeyToSyy(key, value);
  };
  localStorage.removeItem = function (key) {
    originalRemoveItem(key);
    syncAkiniKeyRemove(key);
  };

  function syncAkiniKeyToSyy(key, value) {
    try {
      if (key === 'akini_contacts') {
        const contacts = JSON.parse(value || '[]');
        const sessions = Array.isArray(contacts) ? contacts.map(function (c) {
          return { id: c.id, name: c.name, avatar: c.avatar, createdAt: c.createdAt || Date.now(), isGroup: !!c.isGroup, members: c.members || [] };
        }) : [];
        localforage.setItem(APP_PREFIX + 'sessionList', sessions);
      } else if (key.startsWith('akini_chat_history_')) {
        const sid = key.replace('akini_chat_history_', '');
        // 只记录该会话存在，避免重复解析整个 HTML；下次页面加载迁移逻辑会兜底
        localforage.setItem(APP_PREFIX + sid + '_chatMessages', []); // 占位，提示需要重新迁移或增量同步
      } else if (key === 'akini_posts') {
        const posts = JSON.parse(value || '[]');
        const moments = Array.isArray(posts) ? posts.map(function (p) {
          return { id: p.id, text: p.content || '', images: p.images || [], time: p.time || Date.now(), avatar: p.avatar || '', nickname: p.nickname || '我', likes: p.likes || [], comments: p.comments || [] };
        }) : [];
        safeSetItem('moments_data', moments);
      } else if (key === 'akini_icity_diaries') {
        const diaries = JSON.parse(value || '[]');
        if (Array.isArray(diaries)) localforage.setItem(getStorageKey('diaryEntries'), diaries);
      } else if (key === 'akini_icity_my_avatar' || key === 'akini_my_avatar') {
        localforage.setItem(getStorageKey('myAvatar'), value);
      } else if (key === 'akini_icity_ta_avatar' || key === 'akini_ta_avatar') {
        localforage.setItem(getStorageKey('partnerAvatar'), value);
      } else if (key === 'akini_mail_sent') {
        syncMailToEnvelope();
      } else if (key === 'akini_mail_received') {
        syncMailToEnvelope();
      }
    } catch (e) {}
  }

  function syncAkiniKeyRemove(key) {
    try {
      if (key === 'akini_contacts') localforage.removeItem(APP_PREFIX + 'sessionList');
      else if (key === 'akini_posts') safeRemoveItem('moments_data');
      else if (key === 'akini_icity_diaries') localforage.removeItem(getStorageKey('diaryEntries'));
      else if (key.startsWith('akini_chat_history_')) {
        const sid = key.replace('akini_chat_history_', '');
        localforage.removeItem(APP_PREFIX + sid + '_chatMessages');
      }
    } catch (e) {}
  }

  async function syncMailToEnvelope() {
    throttledSyySave(async function () {
      try {
        let sent = [], received = [];
        const sentRaw = safeGetItem('akini_mail_sent');
        const recvRaw = safeGetItem('akini_mail_received');
        if (sentRaw) sent = JSON.parse(sentRaw);
        if (recvRaw) received = JSON.parse(recvRaw);
        const envelope = await localforage.getItem(getStorageKey('envelopeData')) || { outbox: [], inbox: [], spacetime: [] };
        envelope.outbox = (Array.isArray(sent) ? sent : []).map(function (m) {
          return { id: m.id || ('mail_' + Date.now()), content: m.content || m.text || '', sentTime: m.time || m.sentTime || Date.now(), replyTime: m.replyTime || (Date.now() + 3600000), status: m.status || 'pending' };
        });
        envelope.inbox = (Array.isArray(received) ? received : []).map(function (m) {
          return { id: m.id || ('reply_' + Date.now()), refId: m.refId || '', originalContent: m.originalContent || '', content: m.content || m.text || '', receivedTime: m.time || m.receivedTime || Date.now(), isNew: false };
        });
        await localforage.setItem(getStorageKey('envelopeData'), envelope);
      } catch (e) {}
    });
  }

  /* ========== 4. syy 来信/回信逻辑（精简版，适配 Akini 邮件 UI） ========== */
  let envelopeData = { outbox: [], inbox: [], spacetime: [] };

  async function loadEnvelopeData() {
    try {
      const saved = await localforage.getItem(getStorageKey('envelopeData'));
      if (saved) {
        envelopeData = saved;
        if (!envelopeData.outbox) envelopeData.outbox = [];
        if (!envelopeData.inbox) envelopeData.inbox = [];
        if (!envelopeData.spacetime) envelopeData.spacetime = [];
      }
    } catch (e) { console.warn('[loadEnvelopeData]', e); }
  }

  function saveEnvelopeData() {
    try {
      localforage.setItem(getStorageKey('envelopeData'), envelopeData);
    } catch (e) { console.warn('[saveEnvelopeData]', e); }
  }

  // 随机生成回信内容（简化：从自定义回复库或默认句库抽取）
  function generateEnvelopeReplyText() {
    const defaults = [
      '收到你的信啦，我也很想你。',
      '信里的每一句话我都有认真看完。',
      '希望下次能当面说给你听。',
      '我也在等你的消息呢。',
      '你的信让我今天心情很好。'
    ];
    // 尝试从 syy 的 customReplies 读取；未引入时回退默认值
    try {
      const groups = window.customReplyGroups;
      if (groups && Array.isArray(groups)) {
        const all = [];
        groups.forEach(function (g) { if (g && Array.isArray(g.items)) all.push.apply(all, g.items); });
        if (all.length) return all[Math.floor(Math.random() * all.length)];
      }
    } catch (e) {}
    return defaults[Math.floor(Math.random() * defaults.length)];
  }

  function generateRandomEnvelopeLetter() {
    const snippets = [
      '今天突然很想你。',
      '翻到我们以前的聊天记录，嘴角不自觉上扬。',
      '不知道你现在在做什么，希望是开心的。',
      '刚刚听到一首歌，歌词像是在写我们。',
      '想给你写封信，又不知道从何说起。',
      '最近发生了很多小事，想慢慢讲给你听。',
      '你不在身边的时候，时间好像过得特别慢。',
      '我把对你的想念藏进了每一个日常里。'
    ];
    const count = 5 + Math.floor(Math.random() * 8); // 5~12 句
    const parts = [];
    for (let i = 0; i < count; i++) {
      parts.push(snippets[Math.floor(Math.random() * snippets.length)]);
    }
    const letter = {
      id: 'spacetime_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
      content: parts.join('\n'),
      receivedTime: Date.now(),
      isNew: true
    };
    envelopeData.spacetime.push(letter);
    saveEnvelopeData();
    return letter;
  }

  async function checkEnvelopeStatus() {
    await loadEnvelopeData();
    const now = Date.now();
    let changed = false;
    let newReply = null;

    envelopeData.outbox.forEach(function (letter) {
      if (letter.status === 'scheduled' && now >= letter.scheduleTime) {
        letter.status = 'pending';
        letter.sentTime = now;
        changed = true;
      }
      if (letter.status === 'pending' && now >= letter.replyTime) {
        if (letter.replyToSection === 'spacetime' && letter.replyToId && Math.random() >= 0.3) {
          letter.status = 'replied';
          changed = true;
          return;
        }
        letter.status = 'replied';
        const replyId = 'reply_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5);
        const reply = {
          id: replyId,
          refId: letter.id,
          originalContent: letter.content,
          content: generateEnvelopeReplyText(),
          receivedTime: now,
          isNew: true
        };
        envelopeData.inbox.push(reply);
        newReply = reply;
        changed = true;
      }
    });

    if (changed) {
      saveEnvelopeData();
      if (newReply && typeof showNotification === 'function') {
        showNotification('收到了一封回信，快去看看吧~', 'success');
      }
    }
  }

  // 用户寄信 / 回信
  function handleSendEnvelope(content, opt) {
    opt = opt || {};
    if (!content || !content.trim()) return;
    const letter = {
      id: 'env_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
      content: content.trim(),
      sentTime: Date.now(),
      replyTime: opt.replyTime || (Date.now() + 86400000), // 默认 1 天后回信
      status: opt.scheduleTime ? 'scheduled' : 'pending',
      scheduleTime: opt.scheduleTime || null,
      sendToChat: opt.sendToChat || false,
      replyToId: opt.replyToId || null,
      replyToSection: opt.replyToSection || null
    };
    envelopeData.outbox.push(letter);
    saveEnvelopeData();
    return letter;
  }

  function replyToEnvLetter(section, id, content) {
    return handleSendEnvelope(content, {
      replyToId: id,
      replyToSection: section,
      replyTime: Date.now() + 60000 + Math.floor(Math.random() * 300000) // 1~6 分钟内回信
    });
  }

  // 暴露给 Akini 使用
  window.akiniSyyBridge = {
    APP_PREFIX: APP_PREFIX,
    SESSION_ID: SESSION_ID,
    getStorageKey: getStorageKey,
    migrateAkiniToSyy: migrateAkiniToSyy,
    loadEnvelopeData: loadEnvelopeData,
    saveEnvelopeData: saveEnvelopeData,
    checkEnvelopeStatus: checkEnvelopeStatus,
    generateRandomEnvelopeLetter: generateRandomEnvelopeLetter,
    handleSendEnvelope: handleSendEnvelope,
    replyToEnvLetter: replyToEnvLetter,
    getEnvelopeData: function () { return envelopeData; }
  };

  // 页面加载完成后执行迁移与定时检查
  function init() {
    migrateAkiniToSyy().then(function () {
      loadEnvelopeData();
      setInterval(checkEnvelopeStatus, 30000); // 每 30 秒检查一次回信
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 500);
  }
})();
