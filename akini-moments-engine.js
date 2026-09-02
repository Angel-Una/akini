/*
 * akini-moments-engine.js
 * syy 风格的朋友圈 / iCity 自动评论 + 自动点赞引擎
 * - 发布动态后延迟随机时间触发：多联系人按概率独立评论 + 80% 概率自动点赞
 * - 评论内容优先取用户字卡库（akini_wordbank_*），其次默认句库
 * - 数据写入走 akini-main 的 R()/j()（已优先 IndexedDB，彻底解决数据消失）
 */
(function () {
  'use strict';
  if (window.__akiniMomentsEngineReady) return;
  window.__akiniMomentsEngineReady = true;

  /* 默认评论句库（无字卡库时兜底） */
  var DEFAULT_REPLIES = [
    '好棒呀，我也想试试~',
    '这个看起来好好玩！',
    '哈哈太可爱了吧',
    '记录得真详细，羡慕了',
    '今天也辛苦啦，抱抱',
    '好温馨的画面呀',
    '我也好想去这里看看',
    '被治愈到了，谢谢分享',
    '这么好的心情，要一直保持哦',
    '看着就让人开心呢'
  ];

  /* 默认表情包（无自定义表情时兜底，纯文字） */
  var DEFAULT_KAOMOJI = ['(◕ᴗ◕✿)', '(｡♥‿♥｡)', '(≧▽≦)', '(✿◡‿◡)', '(^▽^)'];

  function getWordbankReplies() {
    var out = [];
    try {
      var keys = Object.keys(localStorage);
      keys.forEach(function (k) {
        if (k.indexOf('akini_wordbank_') === 0) {
          var raw = localStorage.getItem(k);
          if (raw) {
            var arr = JSON.parse(raw);
            if (Array.isArray(arr)) {
              arr.forEach(function (item) {
                var t = typeof item === 'string' ? item : (item && item.text);
                if (t && String(t).trim()) out.push(String(t).trim());
              });
            }
          }
        }
      });
    } catch (e) {}
    return out;
  }

  function getContactStickers() {
    var out = [];
    try {
      var st = JSON.parse(localStorage.getItem('akini_contact_stickers') || '{}');
      if (st && typeof st === 'object') {
        Object.keys(st).forEach(function (cid) {
          var arr = st[cid];
          if (Array.isArray(arr)) arr.forEach(function (s) { if (s) out.push(s); });
        });
      }
    } catch (e) {}
    return out;
  }

  function getContacts() {
    return (window.akiniContacts && window.akiniContacts.getContacts) ? window.akiniContacts.getContacts() : [];
  }

  function getContactAvatar(contact) {
    if (!contact) return '🐰';
    if (window.akiniContacts && window.akiniContacts.getContactById) {
      var p = window.getIcityContactProfile ? window.getIcityContactProfile(contact.id) : null;
      if (p && p.avatar) return p.avatar;
    }
    return contact.avatar || '🐰';
  }

  function getContactName(contact) {
    if (!contact) return '对方';
    if (window.getIcityContactProfile) {
      var p = window.getIcityContactProfile(contact.id);
      if (p && p.name) return p.name;
    }
    return contact.name || '对方';
  }

  function pickRandom(arr) {
    if (!arr || !arr.length) return null;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function getReplyDelay() {
    var min = parseFloat(localStorage.getItem('akini_num_replyDelayMin') || '2');
    var max = parseFloat(localStorage.getItem('akini_num_replyDelayMax') || '5');
    if (isNaN(min)) min = 2;
    if (isNaN(max) || max < min) max = min;
    return Math.floor(1000 * (min + Math.random() * Math.max(0, max - min)));
  }

  function buildReplyText(replies, kaomoji) {
    var useKaomoji = (!replies.length) || (kaomoji.length > 0 && Math.random() < 0.3);
    var text = '';
    if (useKaomoji && kaomoji.length) {
      text = pickRandom(kaomoji);
    } else if (replies.length) {
      text = pickRandom(replies);
    }
    if (!text) return '';
    // 25% 概率混入颜文字
    if (!useKaomoji && kaomoji.length > 0 && Math.random() < 0.25) {
      var k = pickRandom(kaomoji);
      text = Math.random() < 0.5 ? (k + ' ' + text) : (text + ' ' + k);
    }
    return text;
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

  /**
   * syy 风格自动回复：多联系人按概率独立评论 + 自动点赞
   * @param {string} momentId 动态 id
   * @param {string} app 'friends' | 'icity'
   */
  function triggerAutoReply(momentId, app) {
    var contacts = getContacts();
    if (!contacts.length) return;

    var replies = getWordbankReplies();
    var kaomoji = DEFAULT_KAOMOJI;
    var stickers = getContactStickers();
    var hasContent = replies.length > 0 || kaomoji.length > 0;

    // 回复数量：默认 1~3 条随机
    var replyCount = Math.random() < 0.7 ? 1 : (Math.random() < 0.9 ? 2 : 3);

    // 打乱联系人顺序，每个联系人 60% 概率回复
    var shuffled = contacts.slice().sort(function () { return Math.random() - 0.5; });
    var repliers = [];
    shuffled.forEach(function (c) {
      if (Math.random() < 0.6) {
        repliers.push(c);
      }
    });
    // 保证至少一个回复者
    if (!repliers.length) repliers.push(contacts[0]);

    // 分配回复数量
    var remaining = replyCount;
    var plan = [];
    for (var i = 0; i < repliers.length && remaining > 0; i++) {
      var cnt = (i === repliers.length - 1) ? remaining : (Math.random() < 0.5 ? 1 : Math.min(2, remaining));
      plan.push({ contact: repliers[i], count: cnt });
      remaining -= cnt;
    }

    // 读取动态数据
    var data, saveFn;
    if (app === 'icity') {
      data = window.__akiniGetIcity ? window.__akiniGetIcity() : [];
      saveFn = window.__akiniSaveIcity || function (d) { if (window.__akiniSaveIcity) window.__akiniSaveIcity(d); };
    } else {
      data = window.__akiniGetPosts ? window.__akiniGetPosts() : [];
      saveFn = window.__akiniSavePosts || function (d) { if (window.__akiniSavePosts) window.__akiniSavePosts(d); };
    }
    if (!data || !data.length) return;

    var moment = null;
    for (var j = 0; j < data.length; j++) {
      if (String(data[j].id) === String(momentId)) { moment = data[j]; break; }
    }
    if (!moment) return;

    var myName = localStorage.getItem('akini_my_name') || '我';

    // 执行评论
    plan.forEach(function (p) {
      var name = getContactName(p.contact);
      var avatar = getContactAvatar(p.contact);
      for (var k = 0; k < p.count; k++) {
        // 20% 概率发表情包（有表情包时）
        var sendSticker = stickers.length > 0 && Math.random() < 0.2;
        if (sendSticker) {
          moment.comments = moment.comments || [];
          moment.comments.push({
            author: name,
            authorId: p.contact.id,
            text: '',
            sticker: pickRandom(stickers),
            replyTo: null,
            ts: Date.now()
          });
          notify(app, name, avatar, '[表情包]');
          continue;
        }
        var text = buildReplyText(replies, kaomoji);
        if (!text) {
          // 无字卡库且无默认句时，用默认句库兜底
          text = pickRandom(DEFAULT_REPLIES) || '';
        }
        if (!text) continue;
        moment.comments = moment.comments || [];
        moment.comments.push({
          author: name,
          authorId: p.contact.id,
          text: text,
          replyTo: null,
          ts: Date.now()
        });
        notify(app, name, avatar, '评论了你的动态：' + text.slice(0, 20));
      }
    });

    // 自动点赞：80% 概率，每个联系人 50% 概率独立点赞
    var didLike = false;
    if (Math.random() < 0.8) {
      contacts.forEach(function (c) {
        if (Math.random() < 0.5) {
          if (app === 'icity') {
            moment.likers = moment.likers || [];
            var ln = getContactName(c);
            if (moment.likers.indexOf(ln) < 0) {
              moment.likers.push(ln);
              moment.likes = (moment.likes || 0) + 1;
              didLike = true;
            }
          } else {
            moment.likes = moment.likes || [];
            var fn = getContactName(c);
            if (moment.likes.indexOf(fn) < 0) {
              moment.likes.push(fn);
              didLike = true;
            }
          }
        }
      });
    }

    // 保存并渲染
    try { saveFn(data); } catch (e) {}
    render(app);

    if (didLike && plan.length) {
      var last = plan[plan.length - 1].contact;
      notify(app, getContactName(last), getContactAvatar(last), '点赞了你的动态');
    }
  }

  // 暴露
  window.akiniTriggerMomentAutoReply = triggerAutoReply;
  window.akiniGetMomentReplyDelay = getReplyDelay;

  console.log('[akini-moments-engine] syy 风格自动评论/点赞引擎已加载');
})();