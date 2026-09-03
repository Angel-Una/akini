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

  // 手机号 + 密码登录（最适合手机用户，无需电脑）
  window._neteasePhoneLogin = function () {
    var phoneEl = document.getElementById('musicPhoneInput');
    var pwdEl = document.getElementById('musicPwdInput');
    var phone = phoneEl ? phoneEl.value.trim() : '';
    var pwd = pwdEl ? pwdEl.value : '';
    if (!phone || !pwd) {
      alert('请输入手机号和密码');
      return;
    }
    if (!/^1\d{10}$/.test(phone)) {
      alert('请输入正确的 11 位手机号');
      return;
    }
    var btn = document.getElementById('musicPhoneLoginBtn');
    if (btn) { btn.disabled = true; btn.textContent = '登录中…'; }
    setStatus('正在登录…');
    var path = '/login/cellphone?phone=' + encodeURIComponent(phone) + '&countrycode=86&password=' + encodeURIComponent(pwd) + '&timestamp=' + Date.now();
    tryFetchWithFallback(path, {}).then(function (res) {
      var cookie = res && res.cookie;
      var profile = res && res.profile;
      if (res && res.code === 200 && (cookie || profile)) {
        if (profile) {
          saveLoginProfile(cookie || '', profile.userId, profile.nickname, profile.avatarUrl);
          setLoginStatus('已登录：' + profile.nickname);
          setStatus('登录成功，欢迎 ' + profile.nickname);
          if (typeof window._fetchUserPlaylists === 'function') {
            window._fetchUserPlaylists(cookie || '', profile.nickname);
          }
        } else if (cookie) {
          saveLoginProfile(cookie, '', '', '');
          setStatus('登录成功，正在获取用户信息…');
          fetchAccountInfo(cookie);
        }
        try { var ai = document.getElementById('musicAccountInfo'); if (ai) ai.style.display = 'block'; } catch (e) {}
      } else {
        var msg = res && (res.msg || res.message) ? (res.msg || res.message) : ('网易云返回错误码 ' + (res && res.code));
        if (res && res.code === 502) msg = '密码错误，请检查后重试';
        if (res && res.code === 461) msg = '需要短信验证码，请点下方“用验证码登录”';
        if (res && res.code === 10004) msg = '网易云判定存在安全风险，建议点下方“用验证码登录”或稍后重试';
        throw new Error(msg);
      }
    }).catch(function (err) {
      var tips = '登录失败：' + (err.message || err) + '\n\n可尝试：\n1. 确认手机号和密码\n2. 点下方“用验证码登录”\n3. 使用“生成二维码”换设备扫码';
      alert(tips);
      setStatus('手机号登录失败');
    }).then(function () {
      if (btn) { btn.disabled = false; btn.textContent = '手机号登录'; }
    });
  };

  // 发送短信验证码
  window._neteaseSendCaptcha = function () {
    var phoneEl = document.getElementById('musicPhoneInput');
    var phone = phoneEl ? phoneEl.value.trim() : '';
    if (!/^1\d{10}$/.test(phone)) {
      alert('请先输入正确的 11 位手机号');
      return;
    }
    var btn = document.getElementById('musicSendCaptchaBtn');
    if (btn) { btn.disabled = true; btn.textContent = '发送中…'; }
    var path = '/captcha/sent?phone=' + encodeURIComponent(phone) + '&countrycode=86&timestamp=' + Date.now();
    tryFetchWithFallback(path, {}).then(function (res) {
      if (res && res.code === 200) {
        alert('验证码已发送，请查看短信');
        setStatus('验证码已发送');
        if (btn) { btn.textContent = '已发送'; }
      } else {
        var msg = res && (res.msg || res.message) ? (res.msg || res.message) : ('错误码 ' + (res && res.code));
        throw new Error(msg);
      }
    }).catch(function (err) {
      alert('发送验证码失败：' + (err.message || err) + '\n可能原因：网易云安全限制 / 代理不可用');
      if (btn) { btn.disabled = false; btn.textContent = '发送验证码'; }
    });
  };

  // 手机号 + 验证码登录
  window._neteaseCaptchaLogin = function () {
    var phoneEl = document.getElementById('musicPhoneInput');
    var codeEl = document.getElementById('musicCaptchaInput');
    var phone = phoneEl ? phoneEl.value.trim() : '';
    var code = codeEl ? codeEl.value.trim() : '';
    if (!/^1\d{10}$/.test(phone) || !/^\d{4,6}$/.test(code)) {
      alert('请输入手机号和收到的短信验证码');
      return;
    }
    var btn = document.getElementById('musicCaptchaLoginBtn');
    if (btn) { btn.disabled = true; btn.textContent = '登录中…'; }
    setStatus('正在用验证码登录…');
    var path = '/login/cellphone?phone=' + encodeURIComponent(phone) + '&countrycode=86&captcha=' + encodeURIComponent(code) + '&timestamp=' + Date.now();
    tryFetchWithFallback(path, {}).then(function (res) {
      var cookie = res && res.cookie;
      var profile = res && res.profile;
      if (res && res.code === 200 && (cookie || profile)) {
        if (profile) {
          saveLoginProfile(cookie || '', profile.userId, profile.nickname, profile.avatarUrl);
          setLoginStatus('已登录：' + profile.nickname);
          setStatus('验证码登录成功，欢迎 ' + profile.nickname);
          if (typeof window._fetchUserPlaylists === 'function') {
            window._fetchUserPlaylists(cookie || '', profile.nickname);
          }
        } else if (cookie) {
          saveLoginProfile(cookie, '', '', '');
          setStatus('登录成功，正在获取用户信息…');
          fetchAccountInfo(cookie);
        }
        try { var ai = document.getElementById('musicAccountInfo'); if (ai) ai.style.display = 'block'; } catch (e) {}
      } else {
        var msg = res && (res.msg || res.message) ? (res.msg || res.message) : ('错误码 ' + (res && res.code));
        throw new Error(msg);
      }
    }).catch(function (err) {
      alert('验证码登录失败：' + (err.message || err));
      setStatus('验证码登录失败');
    }).then(function () {
      if (btn) { btn.disabled = false; btn.textContent = '验证码登录'; }
    });
  };

  // 绑定"生成二维码"按钮，并常驻显示手机号登录表单
  document.addEventListener('DOMContentLoaded', function () {
    var genBtn = document.getElementById('musicQrGenerateBtn');
    if (genBtn) {
      genBtn.addEventListener('click', function () {
        window._generateQrCode();
      });
    }
    // 在二维码容器下方常驻提供手机号 + 密码 / 验证码登录表单
    var qrContainer = document.getElementById('musicQrContainer');
    if (qrContainer) {
      if (!document.getElementById('musicExtraLoginWrap')) {
        var extraWrap = document.createElement('div');
        extraWrap.id = 'musicExtraLoginWrap';
        extraWrap.style.cssText = 'width:100%;margin-top:12px;';
        extraWrap.innerHTML =
          '<div style="font-size:12px;color:#999;text-align:center;margin-bottom:8px;line-height:1.5">没有电脑？直接用手机号登录最方便</div>' +
          '<div style="display:flex;flex-direction:column;gap:8px;">' +
            '<input id="musicPhoneInput" type="tel" inputmode="numeric" maxlength="11" placeholder="网易云绑定的手机号" style="height:40px;padding:0 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;background:#fff;color:#333;" />' +
            '<input id="musicPwdInput" type="password" placeholder="网易云密码" style="height:40px;padding:0 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;background:#fff;color:#333;" />' +
            '<div id="musicCaptchaWrap" style="display:none;flex-direction:column;gap:8px;">' +
              '<div style="display:flex;gap:8px;">' +
                '<input id="musicCaptchaInput" type="tel" inputmode="numeric" maxlength="6" placeholder="短信验证码" style="flex:1;height:40px;padding:0 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;background:#fff;color:#333;" />' +
                '<button id="musicSendCaptchaBtn" type="button" style="height:40px;padding:0 12px;border:none;border-radius:8px;background:#666;color:#fff;font-size:13px;cursor:pointer;white-space:nowrap;">发送验证码</button>' +
              '</div>' +
              '<button id="musicCaptchaLoginBtn" type="button" style="height:42px;border:none;border-radius:8px;background:#dd0000;color:#fff;font-size:14px;font-weight:600;cursor:pointer;">验证码登录</button>' +
            '</div>' +
            '<button id="musicPhoneLoginBtn" type="button" style="height:42px;border:none;border-radius:8px;background:#dd0000;color:#fff;font-size:14px;font-weight:600;cursor:pointer;">手机号登录</button>' +
          '</div>' +
          '<div style="font-size:12px;color:#999;text-align:center;margin:10px 0 6px;line-height:1.5">密码登录提示安全风险？<a href="#" id="musicToggleCaptcha" style="color:#dd0000;text-decoration:underline;">用短信验证码登录</a></div>';
        qrContainer.appendChild(extraWrap);
        document.getElementById('musicPhoneLoginBtn').addEventListener('click', window._neteasePhoneLogin);
        document.getElementById('musicToggleCaptcha').addEventListener('click', function (e) {
          e.preventDefault();
          var captchaWrap = document.getElementById('musicCaptchaWrap');
          var pwdInput = document.getElementById('musicPwdInput');
          var phoneBtn = document.getElementById('musicPhoneLoginBtn');
          var toggle = document.getElementById('musicToggleCaptcha');
          if (captchaWrap.style.display === 'flex') {
            captchaWrap.style.display = 'none';
            pwdInput.style.display = 'block';
            phoneBtn.style.display = 'block';
            toggle.innerHTML = '用短信验证码登录';
          } else {
            captchaWrap.style.display = 'flex';
            pwdInput.style.display = 'none';
            phoneBtn.style.display = 'none';
            toggle.innerHTML = '用密码登录';
          }
        });
        document.getElementById('musicSendCaptchaBtn').addEventListener('click', window._neteaseSendCaptcha);
        document.getElementById('musicCaptchaLoginBtn').addEventListener('click', window._neteaseCaptchaLogin);
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
