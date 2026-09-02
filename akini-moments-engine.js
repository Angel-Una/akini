/*
 * akini-moments-engine.js
 * 朋友圈 / iCity 自动点赞/评论引擎（对齐 syy 用户定制逻辑）
 * - 用户发布动态后，按"消息回复延迟"等待，随后所有联系人 100% 点赞 + 100% 评论
 * - 每个联系人只评论 1 条文字，评论内容仅来自用户字卡库，无兜底句库/表情
 * - 用户回复某联系人评论后，该联系人再回复 1 条（同样延迟）
 * - 联系人自己发朋友圈时，有 8% 概率附带用户给 TA 添加的表情包（仅朋友圈贴文，非评论）
 */
(function () {
  'use strict';
  if (window.__akiniMomentsEngineReady) return;
  window.__akiniMomentsEngineReady = true;

  // ========== 工具函数 ==========

  function getContacts() {
    return (window.akiniContacts && window.akiniContacts.getContacts) ? window.akiniContacts.getContacts() : [];
  }

  function getContactById(id) {
    if (!id) return null;
    var contacts = getContacts();
    for (var i = 0; i < contacts.length; i++) {
      if (contacts[i].id === id || String(contacts[i].id) === String(id)) return contacts[i];
    }
    return null;
  }

  function getContactName(contact) {
    if (!contact) return '对方';
    if (window.getIcityContactProfile) {
      var p = window.getIcityContactProfile(contact.id);
      if (p && p.name) return p.name;
    }
    return contact.name || '对方';
  }

  function getContactAvatar(contact) {
    if (!contact) return '🐰';
    if (window.getIcityContactProfile) {
      var p = window.getIcityContactProfile(contact.id);
      if (p && p.avatar) return p.avatar;
    }
    return contact.avatar || '🐰';
  }

  // 读取该联系人的专属表情包（akini_stickers_<contactId>）
  function getContactStickers(contactId) {
    if (!contactId) return [];
    try {
      var raw = localStorage.getItem('akini_stickers_' + contactId);
      if (raw) {
        var arr = JSON.parse(raw);
        if (Array.isArray(arr)) return arr.filter(function (s) { return s && String(s).trim(); });
      }
    } catch (e) {}
    return [];
  }

  // 从字卡库取可用文字（排除拍一拍 pat）
  function getWordbankTexts() {
    var out = [];
    var seen = {};
    function addFromRaw(raw) {
      if (!raw) return;
      try {
        var arr = JSON.parse(raw);
        if (!Array.isArray(arr)) return;
        arr.forEach(function (item) {
          var t = typeof item === 'string' ? item : (item && item.text);
          if (!t || !String(t).trim()) return;
          var tab = ((item && item.tab) || '').toLowerCase();
          var type = ((item && item.type) || '').toLowerCase();
          if (tab === 'pat' || type === 'pat') return;
          var key = String(t).trim();
          if (!seen[key]) {
            seen[key] = true;
            out.push(key);
          }
        });
      } catch (e) {}
    }
    try {
      // 优先从内存缓存读取（与 akiniStore 同步），避免 localStorage 配额空时无法取到字卡
      if (window.akiniStore && window.akiniStore.memoryGet) {
        addFromRaw(window.akiniStore.memoryGet('akini_wordbank'));
      }
      // 兜底 localStorage
      var keys = Object.keys(localStorage);
      keys.forEach(function (k) {
        if (k.indexOf('akini_wordbank') === 0) {
          addFromRaw(localStorage.getItem(k));
        }
      });
    } catch (e) {}
    return out;
  }

  function pickRandom(arr) {
    if (!arr || !arr.length) return null;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // 使用与聊天回复相同的消息回复延迟
  function getMessageReplyDelay() {
    var min = parseFloat(localStorage.getItem('akini_num_replyDelayMin') || '2');
    var max = parseFloat(localStorage.getItem('akini_num_replyDelayMax') || '5');
    if (isNaN(min) || min < 0) min = 2;
    if (isNaN(max) || max < min) max = min;
    return Math.floor(1000 * (min + Math.random() * Math.max(0, max - min)));
  }

  // ========== 数据读写 ==========

  function getData(app) {
    if (app === 'icity') {
      return window.__akiniGetIcity ? window.__akiniGetIcity() : [];
    }
    return window.__akiniGetPosts ? window.__akiniGetPosts() : [];
  }

  function saveData(app, data) {
    try {
      if (app === 'icity') {
        if (window.__akiniSaveIcity) window.__akiniSaveIcity(data);
      } else {
        if (window.__akiniSavePosts) window.__akiniSavePosts(data);
      }
    } catch (e) {}
  }

  function render(app) {
    try {
      if (app === 'icity') {
        if (window._renderIcity) window._renderIcity();
        if (window.renderIcityProfileDiaries) {
          window.renderIcityProfileDiaries('icityMyProfileDiaries', 'me');
          window.renderIcityProfileDiaries('icityTaProfileDiaries', 'ta');
        }
      } else {
        if (window._renderPosts) window._renderPosts();
      }
    } catch (e) {}
  }

  function findMoment(data, momentId) {
    if (!data || !data.length) return null;
    for (var i = 0; i < data.length; i++) {
      if (String(data[i].id) === String(momentId)) return data[i];
    }
    return null;
  }

  function notify(app, name, avatar, msg) {
    try {
      if (window.showInAppNotif) {
        window.showInAppNotif({
          app: app === 'icity' ? 'icity' : '朋友圈',
          avatar: avatar,
          name: name,
          fullContent: true,
          msg: msg,
          onTap: function () {}
        });
      }
    } catch (e) {}
  }

  // ========== 点赞/评论核心 ==========

  function likeMoment(moment, contact, app) {
    var name = getContactName(contact);
    if (app === 'icity') {
      moment.likers = moment.likers || [];
      if (moment.likers.indexOf(name) < 0) {
        moment.likers.push(name);
        moment.likes = (moment.likes || 0) + 1;
      }
    } else {
      moment.likes = moment.likes || [];
      if (moment.likes.indexOf(name) < 0) {
        moment.likes.push(name);
      }
    }
  }

  function commentMoment(moment, contact, replyTo, app) {
    var texts = getWordbankTexts();
    if (!texts.length) return false;
    var text = pickRandom(texts);
    if (!text) return false;

    var name = getContactName(contact);
    var avatar = getContactAvatar(contact);
    var comment = {
      author: name,
      authorId: contact.id,
      text: text,
      ts: Date.now()
    };
    if (replyTo) comment.replyTo = replyTo;
    if (app === 'icity') comment.avatar = avatar;

    moment.comments = moment.comments || [];
    moment.comments.push(comment);
    return true;
  }

  // ========== 初始点赞/评论 ==========

  function doInitialReply(momentId, app) {
    var data = getData(app);
    var moment = findMoment(data, momentId);
    if (!moment) return;

    var contacts = getContacts();
    if (!contacts.length) return;

    var myName = localStorage.getItem('akini_my_name') || '我';
    var didAnything = false;

    contacts.forEach(function (contact) {
      likeMoment(moment, contact, app);
      didAnything = true;
    });

    // 每个联系人评论一条文字（无表情包）
    contacts.forEach(function (contact) {
      if (commentMoment(moment, contact, null, app)) {
        didAnything = true;
        notify(app, getContactName(contact), getContactAvatar(contact), '评论了你的动态：' + moment.comments[moment.comments.length - 1].text.slice(0, 20));
      }
    });

    if (didAnything) {
      saveData(app, data);
      render(app);
    }
  }

  // ========== 用户回复后再回复 ==========

  function doReplyToUser(momentId, contactId, replyToName, app) {
    var data = getData(app);
    var moment = findMoment(data, momentId);
    if (!moment) return;

    var contact = getContactById(contactId);
    if (!contact) return;

    if (commentMoment(moment, contact, replyToName, app)) {
      saveData(app, data);
      render(app);
      var text = moment.comments[moment.comments.length - 1].text;
      notify(app, getContactName(contact), getContactAvatar(contact), '回复了你的评论：' + text.slice(0, 20));
    }
  }

  // ========== 联系人自己发朋友圈时，8% 概率带表情包 ==========

  function maybeAttachSticker(contactId) {
    var stickers = getContactStickers(contactId);
    if (!stickers.length) return null;
    if (Math.random() >= 0.08) return null;
    return pickRandom(stickers);
  }

  // ========== 暴露接口 ==========

  window.akiniTriggerMomentAutoReply = function (momentId, app) {
    var delay = getMessageReplyDelay();
    setTimeout(function () {
      doInitialReply(momentId, app);
    }, delay);
  };

  // 用户回复了某条联系人评论后调用
  // momentId: 动态 id
  // contactIdOrName: 被回复的联系人 id 或名字
  // app: 'friends' | 'icity'
  window.akiniOnMomentUserReply = function (momentId, contactIdOrName, app) {
    if (!momentId) return;
    var targetName = contactIdOrName || '';
    var contact = null;
    var contacts = getContacts();
    if (targetName) {
      contact = getContactById(targetName);
      if (!contact) {
        // 尝试按名字查找
        for (var i = 0; i < contacts.length; i++) {
          if (getContactName(contacts[i]) === targetName) {
            contact = contacts[i];
            break;
          }
        }
      }
    }
    // 如果目标不是联系人（比如回复自己/用户自己），随机选一个联系人来回复
    if (!contact && contacts.length) {
      contact = contacts[Math.floor(Math.random() * contacts.length)];
    }
    if (!contact) return;

    var myName = localStorage.getItem('akini_my_name') || '我';
    var delay = getMessageReplyDelay();
    setTimeout(function () {
      doReplyToUser(momentId, contact.id, myName, app);
    }, delay);
  };

  window.akiniMomentMaybeAttachSticker = maybeAttachSticker;
  window.akiniMomentEngineActive = true;

  console.log('[akini-moments-engine] 朋友圈/iCity 点赞/评论引擎已加载（100% 全联系人，仅文字评论，延迟=消息回复延迟）');
})();
