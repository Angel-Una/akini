/**
 * Akini 数据备份 / 恢复模块
 * - 导出：收集 localStorage 全部 akini_* 键 + IndexedDB(akini_img_db/imgs) 全部键值，打包为 JSON 文件下载
 * - 导入：解析备份文件，写回 localStorage 与 IndexedDB，随后刷新页面以重新加载全部数据
 * - 兼容旧版纯 localStorage 备份（仅含 localStorage 字段）
 */
(function () {
  'use strict';

  var DB_NAME = 'akini_img_db';
  var STORE = 'imgs';

  function notify(msg, type) {
    try {
      if (typeof window.showInAppNotif === 'function') {
        window.showInAppNotif({ app: '设置', name: '数据管理', msg: msg, fullContent: false });
        return;
      }
    } catch (e) {}
    try { alert(msg); } catch (e2) {}
  }

  function openDB() {
    return new Promise(function (resolve) {
      try {
        var req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = function (e) {
          var d = e.target.result;
          if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE);
        };
        req.onsuccess = function (e) { resolve(e.target.result); };
        req.onerror = function () { resolve(null); };
        req.onblocked = function () { resolve(null); };
      } catch (err) { resolve(null); }
    });
  }

  function readAllIDB() {
    return openDB().then(function (db) {
      if (!db) return {};
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction(STORE, 'readonly');
          var store = tx.objectStore(STORE);
          var result = {};
          var cursorReq = store.openCursor();
          cursorReq.onsuccess = function (e) {
            var cursor = e.target.result;
            if (cursor) {
              result[cursor.key] = cursor.value;
              cursor.continue();
            } else {
              try { db.close(); } catch (_) {}
              resolve(result);
            }
          };
          cursorReq.onerror = function () {
            try { db.close(); } catch (_) {}
            resolve({});
          };
        } catch (err) {
          try { db.close(); } catch (_) {}
          resolve({});
        }
      });
    });
  }

  function writeAllIDB(data) {
    return openDB().then(function (db) {
      if (!db) return;
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction(STORE, 'readwrite');
          var store = tx.objectStore(STORE);
          var keys = Object.keys(data || {});
          for (var i = 0; i < keys.length; i++) {
            store.put(data[keys[i]], keys[i]);
          }
          tx.oncomplete = function () { try { db.close(); } catch (_) {} resolve(); };
          tx.onerror = function () { try { db.close(); } catch (_) {} resolve(); };
          tx.onabort = function () { try { db.close(); } catch (_) {} resolve(); };
        } catch (err) {
          try { db.close(); } catch (_) {}
          resolve();
        }
      });
    });
  }

  function collectLocalStorage() {
    var out = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!k) continue;
        var v = localStorage.getItem(k);
        if (v === null || v === undefined || v === '') continue;
        out[k] = v;
      }
    } catch (e) {}
    return out;
  }

  function downloadBlob(blob, fileName) {
    try {
      if (navigator.share && /Mobile|Android|iPhone|iPad/.test(navigator.userAgent)) {
        var f = new File([blob], fileName, { type: blob.type });
        if (navigator.canShare && navigator.canShare({ files: [f] })) {
          navigator.share({ files: [f], title: 'Akini 数据备份', text: '备份日期：' + new Date().toLocaleDateString() })
            .then(function () { notify('备份导出成功', 'success'); })
            .catch(function () { fallbackDownload(blob, fileName); });
          return;
        }
      }
    } catch (e) {}
    fallbackDownload(blob, fileName);
  }

  function fallbackDownload(blob, fileName) {
    try {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
      notify('备份导出成功', 'success');
    } catch (e) {
      notify('导出失败：' + (e && e.message ? e.message : '未知错误'), 'error');
    }
  }

  async function exportBackup() {
    try {
      notify('正在打包备份…', 'info');
      var ls = collectLocalStorage();
      var idb = await readAllIDB();
      var payload = {
        type: 'akini-backup',
        formatVersion: 1,
        appName: 'Akini',
        timestamp: new Date().toISOString(),
        localStorage: ls,
        indexedDB: idb
      };
      var json = '\uFEFF' + JSON.stringify(payload);
      var blob = new Blob([json], { type: 'application/json;charset=utf-8' });
      var dateStr = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, 'akini-backup-' + dateStr + '.json');
    } catch (e) {
      console.error('[Akini Backup] 导出失败', e);
      notify('导出失败，请重试', 'error');
    }
  }

  async function importBackup(file) {
    if (!file) return;
    if (file.size > 220 * 1024 * 1024) {
      notify('文件过大（>220MB），请确认是否为正确的备份文件', 'error');
      return;
    }
    try {
      var ab = await file.arrayBuffer();
      var text = new TextDecoder('utf-8', { fatal: false }).decode(ab);
      if (text.length && text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
      var data = JSON.parse(text);
      if (!data || typeof data !== 'object') throw new Error('文件格式不正确');

      var ls = data.localStorage && typeof data.localStorage === 'object' ? data.localStorage : {};
      var idb = data.indexedDB && typeof data.indexedDB === 'object' ? data.indexedDB : {};
      var lsCount = Object.keys(ls).length;
      var idbCount = Object.keys(idb).length;

      if (lsCount === 0 && idbCount === 0) {
        notify('未检测到可恢复的数据，请确认备份文件正确', 'error');
        return;
      }

      if (!confirm('导入备份将覆盖当前的全部数据（聊天记录、设置、头像、iCity、朋友圈、信件等）。\n\n此操作不可撤销，导入后页面将自动刷新。\n\n确定继续吗？')) return;

      // 写入 localStorage
      for (var k in ls) {
        if (Object.prototype.hasOwnProperty.call(ls, k)) {
          try { localStorage.setItem(k, ls[k]); } catch (e) {}
        }
      }
      // 写入 IndexedDB
      await writeAllIDB(idb);

      notify('数据恢复成功，即将刷新…', 'success');
      setTimeout(function () {
        window.location.href = window.location.pathname + '?restore=' + Date.now();
      }, 1500);
    } catch (e) {
      console.error('[Akini Backup] 导入失败', e);
      notify('导入失败：' + (e && e.message ? e.message : '文件格式不正确'), 'error');
    }
  }

  function bind() {
    var exportBtn = document.getElementById('exportBackupBtn');
    if (exportBtn && !exportBtn.__akiniBackupBound) {
      exportBtn.__akiniBackupBound = true;
      exportBtn.addEventListener('click', function () { exportBackup(); });
    }
    var importInput = document.getElementById('importBackupInput');
    if (importInput && !importInput.__akiniBackupBound) {
      importInput.__akiniBackupBound = true;
      importInput.addEventListener('change', function (e) {
        var f = e.target.files && e.target.files[0];
        if (f) importBackup(f);
        importInput.value = '';
      });
    }
  }

  window.AkiniBackup = { exportBackup: exportBackup, importBackup: importBackup };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
  // 兜底：延迟再绑一次，防止 DOM 晚就绪
  setTimeout(bind, 1000);
  setTimeout(bind, 3000);
})();