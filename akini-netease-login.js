/*
 * akini-netease-login.js
 * 网易云音乐登录重做：二维码扫码 + Cookie 手动导入 + 手机号验证码备选
 * 所有账号信息仅保存在本地 localStorage，不上传任何服务器。
 */
(function () {
  'use strict';
  if (window.__akiniNeteaseLoginReady) return;
  window.__akiniNeteaseLoginReady = true;

  // 网易云 API 代理列表（顺序轮换，扫码风控与代理域名有关，多代理提高可用率）
  var FALLBACK_PROXIES = [
    'https://api.mc666.org.cn',
    'https://music-api.heymcx.cn',
    'https://neteasecloudmusicapi.vercel.app'
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
    return fetch(url, opts).then(function (res) {
      return res.text().then(function (text) {
        try {
          var data = JSON.parse(text);
          // 把原始状态码也暴露给调用方
          data._httpStatus = res.status;
          data._rawText = text;
          return data;
        } catch (e) {
          throw { _network: false, message: '返回内容不是有效 JSON：' + text.slice(0, 80), _rawText: text };
        }
      });
    });
  }

  function fetchJsonWithTimeout(url, opts, timeoutMs) {
    timeoutMs = timeoutMs || 15000;
    var controller = null;
    var signal = null;
    try {
      if (typeof AbortController !== 'undefined') {
        controller = new AbortController();
        signal = controller.signal;
      }
    } catch (e) {}
    var fetchPromise = fetchJson(url, Object.assign({}, opts, signal ? { signal: signal } : {}));
    var timer = setTimeout(function () {
      if (controller) try { controller.abort(); } catch (e) {}
    }, timeoutMs);
    return fetchPromise.then(function (data) {
      clearTimeout(timer);
      return data;
    }).catch(function (err) {
      clearTimeout(timer);
      throw err;
    });
  }

  function tryFetchWithFallback(path, opts, onProxyFail) {
    var idx = 0;
    var lastBusinessErr = null;
    function attempt() {
      setProxyByIndex(idx);
      var url = getProxy() + path;
      return fetchJsonWithTimeout(url, opts, 12000).then(function (data) {
        // 只要代理返回了有效的 JSON（无论网易云业务 code 是什么），都停止 fallback，
        // 避免把“密码错误/安全风险”这类业务错误误判成代理不可用，跳到下一个可能挂掉的代理。
        if (data && typeof data.code === 'number') {
          return data;
        }
        if (data && (data.code === 200 || data.code === 800 || data.code === 801 || data.code === 802 || data.code === 803)) {
          return data;
        }
        throw { _network: false, message: data && (data.message || data.error) ? data.message || data.error : '代理返回异常' };
      }).catch(function (err) {
        var msg = err && (err.message || err) || '请求失败';
        var isNetwork = err && (err._network || err.name === 'AbortError' || err.name === 'TypeError' || /fetch|network|load failed|timeout|abort/i.test(msg));
        console.warn('[NeteaseLogin] 代理结果', getProxy(), msg, 'network?', isNetwork);
        if (!isNetwork && err && err.message) {
          lastBusinessErr = err.message;
        }
        idx++;
        if (idx < FALLBACK_PROXIES.length) {
          return attempt();
        }
        throw new Error(lastBusinessErr || msg);
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
        setStatus('二维码生成失败：' + (err.message || err) + '，请尝试手机号+密码或验证码登录');
        if (genBtn) genBtn.style.display = 'block';
      });
  };

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

  // 绑定"生成二维码"按钮（扫码登录为唯一方式）
  document.addEventListener('DOMContentLoaded', function () {
    var genBtn = document.getElementById('musicQrGenerateBtn');
    if (genBtn) {
      genBtn.addEventListener('click', function () {
        window._generateQrCode();
      });
    }
    // 移除任何已存在的 Cookie 导入入口，确保只保留扫码登录
    var oldCookieBtn = document.getElementById('musicImportCookieBtn');
    var oldExtraWrap = document.getElementById('musicExtraLoginWrap');
    if (oldCookieBtn) oldCookieBtn.parentNode.removeChild(oldCookieBtn);
    if (oldExtraWrap) oldExtraWrap.parentNode.removeChild(oldExtraWrap);
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
