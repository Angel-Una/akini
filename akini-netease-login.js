/*
 * akini-netease-login.js
 * 网易云音乐登录重做：二维码扫码 + Cookie 手动导入 + 手机号验证码备选
 * 所有账号信息仅保存在本地 localStorage，不上传任何服务器。
 */
(function () {
  'use strict';
  if (window.__akiniNeteaseLoginReady) return;
  window.__akiniNeteaseLoginReady = true;

  var PROXY_LIST = [
    (typeof window.AKINI_NETEASE_PROXY === 'string' && window.AKINI_NETEASE_PROXY) || 'https://api.mc666.org.cn'
  ];
  // 备用代理（按可用性自动 fallback）
  var FALLBACK_PROXIES = [
    'https://api.mc666.org.cn',
    'https://netease-cloud-music-api-theta.vercel.app',
    'https://netease-cloud-music-api-sigma.vercel.app',
    'https://music-api.heymcx.cn'
  ];

  var _qrTimer = null;
  var _currentKey = '';
  var _currentProxy = '';

  function getProxy() {
    return _currentProxy || PROXY_LIST[0] || FALLBACK_PROXIES[0];
  }

  function setProxyByIndex(idx) {
    var list = FALLBACK_PROXIES.filter(function (u) { return !!u; });
    _currentProxy = list[idx % list.length];
    console.log('[NeteaseLogin] 切换代理到', _currentProxy);
  }

  function safeSetItem(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
  }

  function safeGetItem(key) {
    try { return localStorage.getItem(key) || ''; } catch (e) { return ''; }
  }

  function setStatus(text) {
    var el = document.getElementById('musicQrStatus');
    if (el) el.textContent = text || '';
    console.log('[NeteaseLogin]', text);
  }

  function setLoginStatus(text) {
    var el = document.getElementById('musicLoginStatus');
    if (el) el.textContent = text || '';
  }

  function showQrImage(src) {
    var img = document.getElementById('musicQrImage');
    var canvas = document.getElementById('musicQrCanvas');
    var placeholder = document.getElementById('musicQrPlaceholder');
    if (placeholder) placeholder.style.display = 'none';
    if (canvas) canvas.style.display = 'none';
    if (img) {
      img.style.display = 'block';
      img.src = src;
    }
  }

  function clearQrImage() {
    var img = document.getElementById('musicQrImage');
    var placeholder = document.getElementById('musicQrPlaceholder');
    if (img) {
      img.style.display = 'none';
      img.src = '';
    }
    if (placeholder) {
      placeholder.style.display = 'block';
      placeholder.innerHTML = '点击下方按钮<br>生成扫码登录二维码';
    }
  }

  function stopQrCheck() {
    if (_qrTimer) {
      clearInterval(_qrTimer);
      _qrTimer = null;
    }
  }

  function saveLoginProfile(cookie, uid, nickname, avatar) {
    safeSetItem('akini_netease_cookie', cookie || '');
    safeSetItem('akini_netease_uid', uid ? String(uid) : '');
    safeSetItem('akini_netease_nickname', nickname || '');
    safeSetItem('akini_netease_avatar', avatar || '');
    safeSetItem('akini_netease_login_at', String(Date.now()));
    try {
      if (typeof window.updateMusicLoginStatus === 'function') window.updateMusicLoginStatus();
    } catch (e) {}
  }

  function fetchJson(url, opts) {
    opts = opts || {};
    opts.headers = opts.headers || {};
    opts.headers['Accept'] = 'application/json';
    return fetch(url, opts).then(function (res) { return res.json(); });
  }

  function tryFetchWithFallback(path, opts, onProxyFail) {
    var idx = 0;
    function attempt() {
      setProxyByIndex(idx);
      var url = getProxy() + path;
      return fetchJson(url, opts).then(function (data) {
        if (data && (data.code === 200 || data.code === 800 || data.code === 801 || data.code === 802 || data.code === 803)) {
          return data;
        }
        throw new Error(data && (data.message || data.error) ? data.message || data.error : '代理返回异常');
      }).catch(function (err) {
        console.warn('[NeteaseLogin] 代理失败', getProxy(), err.message || err);
        idx++;
        if (idx < FALLBACK_PROXIES.length) {
          return attempt();
        }
        throw err;
      });
    }
    return attempt();
  }

  function fetchAccountInfo(cookie) {
    var proxy = getProxy();
    fetchJson(proxy + '/user/account', {
      headers: { 'Cookie': cookie }
    }).then(function (res) {
      if (res && res.profile) {
        var p = res.profile;
        saveLoginProfile(cookie, p.userId, p.nickname, p.avatarUrl);
        setLoginStatus('已登录：' + p.nickname);
        setStatus('登录成功，欢迎 ' + p.nickname);
        if (typeof window._fetchUserPlaylists === 'function') {
          window._fetchUserPlaylists(cookie, p.nickname);
        }
      }
    }).catch(function (e) {
      console.warn('[NeteaseLogin] 获取用户信息失败', e);
      setStatus('登录成功，但获取用户信息失败，请手动导入歌单');
    });
  }

  function onQrLoginSuccess(cookie) {
    stopQrCheck();
    clearQrImage();
    setStatus('扫码成功，正在获取用户信息…');
    saveLoginProfile(cookie, '', '', '');
    fetchAccountInfo(cookie);
    try {
      var ai = document.getElementById('musicAccountInfo');
      if (ai) ai.style.display = 'block';
    } catch (e) {}
    try {
      var genBtn = document.getElementById('musicQrGenerateBtn');
      if (genBtn) genBtn.style.display = 'none';
    } catch (e) {}
  }

  function checkQrStatus(key) {
    var proxy = getProxy();
    var url = proxy + '/login/qr/check?key=' + encodeURIComponent(key) + '&timestamp=' + Date.now();
    fetchJson(url).then(function (data) {
      var code = data && data.code;
      if (code === 800) {
        setStatus('二维码已过期，请重新生成');
        stopQrCheck();
        clearQrImage();
      } else if (code === 801) {
        setStatus('等待扫码…');
      } else if (code === 802) {
        setStatus('已扫码，请在手机上确认登录');
      } else if (code === 803) {
        if (data.cookie) {
          onQrLoginSuccess(data.cookie);
        } else {
          setStatus('登录成功但未获取到 Cookie，请尝试 Cookie 导入方式');
        }
      } else {
        setStatus('扫码状态异常：' + (data && (data.message || data.code)));
      }
    }).catch(function (err) {
      console.warn('[NeteaseLogin] checkQrStatus 失败', err);
    });
  }

  function startQrCheck(key) {
    stopQrCheck();
    _currentKey = key;
    _qrTimer = setInterval(function () {
      checkQrStatus(_currentKey);
    }, 2500);
  }

  window._generateQrCode = function () {
    stopQrCheck();
    clearQrImage();
    setStatus('正在获取二维码…');
    var genBtn = document.getElementById('musicQrGenerateBtn');
    if (genBtn) genBtn.style.display = 'none';

    tryFetchWithFallback('/login/qr/key?timestamp=' + Date.now(), {}, function () {})
      .then(function (keyRes) {
        var key = keyRes && keyRes.data && keyRes.data.unikey;
        if (!key) throw new Error('未获取到二维码 Key');
        _currentKey = key;
        var proxy = getProxy();
        return fetchJson(proxy + '/login/qr/create?key=' + encodeURIComponent(key) + '&qrimg=true&timestamp=' + Date.now());
      })
      .then(function (qrRes) {
        var qrimg = qrRes && qrRes.data && qrRes.data.qrimg;
        var qrurl = qrRes && qrRes.data && qrRes.data.qrurl;
        if (!qrimg && !qrurl) throw new Error('未获取到二维码图片');
        showQrImage(qrimg || qrurl);
        setStatus('请使用网易云音乐 APP 扫码');
        startQrCheck(_currentKey);
      })
      .catch(function (err) {
        console.error('[NeteaseLogin] 生成二维码失败', err);
        setStatus('二维码生成失败：' + (err.message || err) + '，请尝试下方的 Cookie 导入方式');
        if (genBtn) genBtn.style.display = 'block';
      });
  };

  function showCookieImportHint() {
    var placeholder = document.getElementById('musicQrPlaceholder');
    if (placeholder) {
      placeholder.style.display = 'block';
      placeholder.innerHTML = '<div style="font-size:13px;color:#888;line-height:1.6">如果扫码提示"设备环境异常"，请使用 Cookie 导入方式登录：<br>1. 在电脑/手机浏览器打开 music.163.com 并登录<br>2. 复制 Cookie 中的 <b>MUSIC_U</b> 值<br>3. 点击下方"导入 Cookie"按钮粘贴</div><button id="musicImportCookieBtn" type="button" style="margin-top:10px;height:36px;padding:0 16px;border:none;border-radius:8px;background:#07c160;color:#fff;font-size:13px;cursor:pointer">导入 Cookie</button>';
      var btn = document.getElementById('musicImportCookieBtn');
      if (btn) btn.addEventListener('click', window._neteaseImportCookie);
    }
  }

  window._neteaseImportCookie = function () {
    var cookieRaw = prompt('请粘贴从 music.163.com 复制到的 Cookie（至少需要包含 MUSIC_U=...）：');
    if (!cookieRaw) return;
    cookieRaw = cookieRaw.trim();
    if (!cookieRaw) return;
    // 如果只粘贴了 MUSIC_U 的值，自动补全前缀
    if (cookieRaw.indexOf('MUSIC_U=') === -1 && cookieRaw.indexOf('=') === -1) {
      cookieRaw = 'MUSIC_U=' + cookieRaw;
    }
    setStatus('正在验证 Cookie…');
    var proxy = getProxy();
    fetchJson(proxy + '/user/account?timestamp=' + Date.now(), {
      headers: { 'Cookie': cookieRaw }
    }).then(function (res) {
      if (res && res.profile) {
        var p = res.profile;
        saveLoginProfile(cookieRaw, p.userId, p.nickname, p.avatarUrl);
        setLoginStatus('已登录：' + p.nickname);
        setStatus('Cookie 导入成功，欢迎 ' + p.nickname);
        if (typeof window._fetchUserPlaylists === 'function') {
          window._fetchUserPlaylists(cookieRaw, p.nickname);
        }
      } else {
        throw new Error(res && res.msg ? res.msg : 'Cookie 无效');
      }
    }).catch(function (err) {
      alert('Cookie 验证失败：' + (err.message || err) + '\n\n请确保：\n1. 已在 music.163.com 登录\n2. 复制的是完整 Cookie 或 MUSIC_U 值\n3. 当前网络可以访问该代理');
      setStatus('Cookie 验证失败');
    });
  };

  // 绑定"生成二维码"按钮，并常驻显示 Cookie 导入入口
  document.addEventListener('DOMContentLoaded', function () {
    var genBtn = document.getElementById('musicQrGenerateBtn');
    if (genBtn) {
      genBtn.addEventListener('click', function () {
        window._generateQrCode();
      });
    }
    // 在二维码容器下方常驻提供 Cookie 导入按钮
    var qrContainer = document.getElementById('musicQrContainer');
    if (qrContainer) {
      var cookieBtnId = 'musicImportCookieBtn';
      if (!document.getElementById(cookieBtnId)) {
        var cookieWrap = document.createElement('div');
        cookieWrap.id = 'musicCookieImportWrap';
        cookieWrap.style.cssText = 'width:100%;text-align:center;margin-top:12px;';
        cookieWrap.innerHTML = '<div style="font-size:12px;color:#999;margin-bottom:6px;line-height:1.5">扫码提示"设备环境异常"？<br>请用下方 Cookie 导入方式</div><button id="' + cookieBtnId + '" type="button" style="height:36px;padding:0 18px;border:none;border-radius:8px;background:#ff9500;color:#fff;font-size:13px;cursor:pointer">导入 Cookie 登录</button>';
        qrContainer.appendChild(cookieWrap);
        document.getElementById(cookieBtnId).addEventListener('click', window._neteaseImportCookie);
      }
    }
  });

  // 页面隐藏时停止轮询，避免后台继续请求
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      stopQrCheck();
    } else if (_currentKey) {
      startQrCheck(_currentKey);
    }
  });

  console.log('[akini-netease-login] 网易云登录模块已加载');
})();
