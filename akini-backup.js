/**
 * Akini 备份引擎：milk-main 风格 ZIP 导出/导入
 * 把 localStorage + IndexedDB 中的数据打包成 ZIP：backup.json + media/* 二进制
 * 避免单文件巨型 JSON 无法解析，导入后再把媒体内联回 data URL。
 */
(function (global) {
  "use strict";

  var MIN_MEDIA_CHARS = 800;

  function isDataMediaUrl(s) {
    return (
      typeof s === "string" &&
      s.length > MIN_MEDIA_CHARS &&
      /^data:(image|video|audio)\//i.test(s)
    );
  }

  function escapeRe(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function dataUrlToBinary(dataUrl) {
    if (typeof dataUrl !== "string") return null;
    var m = /^data:([^,]+),([\s\S]*)$/.exec(dataUrl);
    if (!m) return null;
    var header = m[1];
    var body = m[2].replace(/\s/g, "");
    var mime = header.split(";")[0].trim();
    var isB64 = /;base64/i.test(header);
    if (isB64) {
      try {
        var binary = atob(body);
        var len = binary.length;
        var bytes = new Uint8Array(len);
        for (var i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
        return { mime: mime, bytes: bytes };
      } catch (e) {
        return null;
      }
    }
    try {
      return {
        mime: mime,
        bytes: new TextEncoder().encode(decodeURIComponent(body)),
      };
    } catch (e2) {
      return null;
    }
  }

  function uint8ToBase64Chunked(u8) {
    var CHUNK = 0x8000;
    var str = "";
    for (var i = 0; i < u8.length; i += CHUNK) {
      str += String.fromCharCode.apply(
        null,
        u8.subarray(i, Math.min(i + CHUNK, u8.length))
      );
    }
    return btoa(str);
  }

  function binaryToDataUrl(mime, u8) {
    return (
      "data:" + (mime || "application/octet-stream") + ";base64," + uint8ToBase64Chunked(u8)
    );
  }

  function deepCloneJsonSafe(obj) {
    try {
      return JSON.parse(
        JSON.stringify(obj, function (k, v) {
          if (v instanceof Date) return v.toISOString();
          return v;
        })
      );
    } catch (e) {
      return obj;
    }
  }

  function extractMediaTree(node, state) {
    if (!state) state = { store: {}, map: new Map(), n: 0 };
    if (node === null || node === undefined) return node;
    if (typeof node === "string") {
      if (isDataMediaUrl(node)) {
        var id = state.map.get(node);
        if (!id) {
          id = "m" + state.n++;
          state.map.set(node, id);
          state.store[id] = node;
        }
        return { __mRef: id };
      }
      return node;
    }
    if (Array.isArray(node))
      return node.map(function (x) {
        return extractMediaTree(x, state);
      });
    if (typeof node === "object") {
      if (node instanceof Date) return node.toISOString();
      var out = {};
      for (var k in node) {
        if (!Object.prototype.hasOwnProperty.call(node, k)) continue;
        out[k] = extractMediaTree(node[k], state);
      }
      return out;
    }
    return node;
  }

  function inlineMediaTree(node, store) {
    if (!store) store = {};
    if (node === null || node === undefined) return node;
    if (
      typeof node === "object" &&
      !Array.isArray(node) &&
      node.__mRef &&
      typeof node.__mRef === "string"
    ) {
      var blob = store[node.__mRef];
      return blob !== undefined && blob !== null ? blob : node;
    }
    if (Array.isArray(node))
      return node.map(function (x) {
        return inlineMediaTree(x, store);
      });
    if (typeof node === "object") {
      var o = {};
      for (var k in node) {
        if (!Object.prototype.hasOwnProperty.call(node, k)) continue;
        o[k] = inlineMediaTree(node[k], store);
      }
      return o;
    }
    return node;
  }

  function processLocalStorageValueForExport(str, state) {
    if (str == null) return str;
    if (typeof str !== "string") return str;
    if (isDataMediaUrl(str)) {
      var id = state.map.get(str);
      if (!id) {
        id = "m" + state.n++;
        state.map.set(str, id);
        state.store[id] = str;
      }
      // __raw 标记该值原本是普通字符串（data URL），导入时应还原为字符串而非 JSON
      return JSON.stringify({ __mRef: id, __raw: true });
    }
    try {
      var parsed = JSON.parse(str);
      var extracted = extractMediaTree(parsed, state);
      return JSON.stringify(extracted);
    } catch (e) {
      return str;
    }
  }

  function processLocalStorageValueForImport(str, store) {
    if (str == null) return str;
    if (typeof str !== "string") return str;
    try {
      var parsed = JSON.parse(str);
      // 原本就是 data URL 字符串的值，直接还原为 data URL 字符串
      if (
        parsed &&
        typeof parsed === "object" &&
        !Array.isArray(parsed) &&
        parsed.__mRef &&
        parsed.__raw === true
      ) {
        var blob = store[parsed.__mRef];
        return blob !== undefined && blob !== null ? String(blob) : str;
      }
      return JSON.stringify(inlineMediaTree(parsed, store));
    } catch (e) {
      return str;
    }
  }

  function collectLocalStorageSync() {
    var data = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (!key) continue;
        try {
          data[key] = localStorage.getItem(key);
        } catch (e) {}
      }
    } catch (e) {}
    return data;
  }

  function collectIndexedDB(cb) {
    if (!window._idbStore || !window._idbStore.getAll) {
      cb && cb({});
      return;
    }
    try {
      window._idbStore.getAll(function (idbData) {
        var filtered = {};
        if (idbData && typeof idbData === "object") {
          for (var k in idbData) {
            if (!Object.prototype.hasOwnProperty.call(idbData, k)) continue;
            if (/snapshot|_backup|_cache/i.test(k)) continue;
            filtered[k] = idbData[k];
          }
        }
        cb && cb(filtered);
      });
    } catch (e) {
      cb && cb({});
    }
  }

  function buildBackupPayload(done) {
    var lsData = collectLocalStorageSync();
    collectIndexedDB(function (idbData) {
      var state = { store: {}, map: new Map(), n: 0 };
      var lsOut = {};
      for (var k in lsData) {
        if (!Object.prototype.hasOwnProperty.call(lsData, k)) continue;
        lsOut[k] = processLocalStorageValueForExport(lsData[k], state);
      }
      var idbOut = {};
      for (var k2 in idbData) {
        if (!Object.prototype.hasOwnProperty.call(idbData, k2)) continue;
        idbOut[k2] = processLocalStorageValueForExport(idbData[k2], state);
      }
      done({
        type: "akini-backup-v5",
        formatVersion: 5,
        appName: "Akini",
        timestamp: new Date().toISOString(),
        localStorage: lsOut,
        indexedDB: idbOut,
        mediaStore: state.store,
      });
    });
  }

  function downloadBlob(blob, fileName) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 2000);
  }

  function notify(title, body, type) {
    try {
      if (window.__akiniCenterModal) {
        window.__akiniCenterModal(title, body);
      } else if (typeof showNotification === "function") {
        showNotification(body, type || "info", 3000);
      } else {
        alert(body);
      }
    } catch (e) {}
  }

  function isZipArrayBuffer(ab) {
    if (!ab || ab.byteLength < 4) return false;
    var u = new Uint8Array(ab);
    return (
      u[0] === 0x50 &&
      u[1] === 0x4b &&
      (u[2] === 0x03 || u[2] === 0x05 || u[2] === 0x07) &&
      (u[3] === 0x04 || u[3] === 0x06 || u[3] === 0x08)
    );
  }

  function parseZipBackup(ab, done, errCb) {
    if (typeof JSZip === "undefined") {
      errCb && errCb("JSZip 未加载，无法读取 ZIP 备份");
      return;
    }
    JSZip.loadAsync(ab)
      .then(function (zip) {
        var jsonFile = zip.file("backup.json");
        if (!jsonFile) {
          var names = Object.keys(zip.files).filter(function (n) {
            var e = zip.files[n];
            return e && !e.dir && /\.json$/i.test(n);
          });
          if (names.length === 1) jsonFile = zip.file(names[0]);
        }
        if (!jsonFile) {
          errCb && errCb("ZIP 内未找到 backup.json");
          return;
        }
        jsonFile
          .async("string")
          .then(function (raw) {
            if (raw.length && raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
            try {
              var data = JSON.parse(raw);
              var idx = data.mediaIndex;
              if (
                data.formatVersion === 5 &&
                data.type === "akini-backup-v5" &&
                idx &&
                typeof idx === "object"
              ) {
                var built = {};
                var ids = Object.keys(idx);
                var pending = ids.length;
                if (pending === 0) {
                  data.mediaStore = built;
                  done(data);
                  return;
                }
                ids.forEach(function (id) {
                  var meta = idx[id];
                  var path = meta && meta.path ? meta.path : "media/" + id;
                  var zf = zip.file(path);
                  if (!zf) {
                    console.warn("[AkiniBackup] ZIP 缺少媒体文件", path);
                    pending--;
                    if (pending === 0) {
                      data.mediaStore = built;
                      done(data);
                    }
                    return;
                  }
                  var mimeMeta = meta && meta.mime ? meta.mime : "application/octet-stream";
                  if (mimeMeta === "text/plain+dataurl") {
                    zf.async("string").then(function (txt) {
                      built[id] = txt;
                      pending--;
                      if (pending === 0) {
                        data.mediaStore = built;
                        done(data);
                      }
                    });
                  } else {
                    zf.async("arraybuffer").then(function (buf) {
                      built[id] = binaryToDataUrl(mimeMeta, new Uint8Array(buf));
                      pending--;
                      if (pending === 0) {
                        data.mediaStore = built;
                        done(data);
                      }
                    });
                  }
                });
              } else {
                done(data);
              }
            } catch (e) {
              errCb && errCb("备份 JSON 解析失败：" + e.message);
            }
          })
          .catch(function (e) {
            errCb && errCb("读取 backup.json 失败：" + e.message);
          });
      })
      .catch(function (e) {
        errCb && errCb("ZIP 解析失败：" + e.message);
      });
  }

  function loadBackupFromArrayBuffer(ab, done, errCb) {
    if (isZipArrayBuffer(ab)) {
      parseZipBackup(ab, done, errCb);
      return;
    }
    try {
      var text = new TextDecoder("utf-8", { fatal: false }).decode(ab);
      if (text.length && text.charCodeAt(0) === 0xfeff) text = text.slice(1);
      done(JSON.parse(text));
    } catch (e) {
      errCb && errCb("备份解析失败：" + e.message);
    }
  }

  function exportBackupToFile() {
    notify("备份导出", "正在打包 ZIP，媒体文件会单独存放…", "info");
    buildBackupPayload(function (payload) {
      var dateStr = new Date().toISOString().slice(0, 10);
      var fileNameZip = "akini-backup-" + dateStr + ".zip";

      if (typeof JSZip !== "undefined") {
        try {
          var zip = new JSZip();
          var store = payload.mediaStore || {};
          var mediaIndex = {};
          for (var sid in store) {
            if (!Object.prototype.hasOwnProperty.call(store, sid)) continue;
            var url = store[sid];
            var parts = dataUrlToBinary(url);
            var path = "media/" + sid;
            if (parts && parts.bytes && parts.bytes.length) {
              zip.file(path, parts.bytes, { binary: true });
              mediaIndex[sid] = { path: path, mime: parts.mime };
            } else {
              var txtPath = path + ".txt";
              zip.file(txtPath, String(url));
              mediaIndex[sid] = { path: txtPath, mime: "text/plain+dataurl" };
            }
          }
          var jsonBody = {
            type: "akini-backup-v5",
            formatVersion: 5,
            appName: payload.appName || "Akini",
            timestamp: payload.timestamp,
            localStorage: payload.localStorage,
            indexedDB: payload.indexedDB,
            mediaIndex: mediaIndex,
          };
          zip.file("backup.json", "\uFEFF" + JSON.stringify(jsonBody));
          zip
            .generateAsync({
              type: "blob",
              compression: "DEFLATE",
              compressionOptions: { level: 6 },
            })
            .then(function (zipBlob) {
              downloadBlob(zipBlob, fileNameZip);
              notify(
                "导出成功",
                "已导出 ZIP：localStorage " +
                  Object.keys(payload.localStorage).length +
                  " 项，IndexedDB " +
                  Object.keys(payload.indexedDB).length +
                  " 项",
                "success"
              );
            })
            .catch(function (e) {
              console.error("[AkiniBackup] ZIP 导出失败", e);
              fallbackJson(payload, dateStr);
            });
          return;
        } catch (zipErr) {
          console.error("[AkiniBackup] ZIP 初始化失败", zipErr);
        }
      }
      fallbackJson(payload, dateStr);
    });
  }

  function fallbackJson(payload, dateStr) {
    var fileName = "akini-backup-" + dateStr + ".json";
    var str = "\uFEFF" + JSON.stringify(payload);
    var blob = new Blob([str], { type: "application/json;charset=utf-8" });
    downloadBlob(blob, fileName);
    notify(
      "导出成功（JSON）",
      "已导出 JSON，大备份建议尽快改用 ZIP",
      "warning"
    );
  }

  function applyBackupToStorage(data, done, errCb) {
    window._restoringData = true;
    var lsRaw = (data && data.localStorage) || {};
    var idbRaw = (data && data.indexedDB) || {};
    var mediaStore = (data && data.mediaStore) || {};
    var backupKeyCount = Object.keys(lsRaw).length + Object.keys(idbRaw).length;
    if (backupKeyCount === 0) {
      window._restoringData = false;
      if (errCb) errCb("备份文件为空，未导入任何数据");
      return;
    }

    // 先拍回滚快照，导入失败时可恢复
    var rollback = {};
    try {
      for (var ri = 0; ri < localStorage.length; ri++) {
        var rk = localStorage.key(ri);
        if (rk) rollback[rk] = localStorage.getItem(rk);
      }
    } catch (e) {}
    function restoreRollback() {
      try { localStorage.clear(); } catch (e) {}
      for (var k in rollback) {
        try { localStorage.setItem(k, rollback[k]); } catch (e) {}
      }
    }

    function writeAll() {
      var count = 0;
      var pending = 0;

      function tryWrite(key, value) {
        if (value === null || value === undefined) return;
        if (key === "akini_localstorage_snapshot" || key === "akini_localstorage_snapshot_backup")
          return;
        count++;
        pending++;
        // localStorage 兜底
        try {
          localStorage.setItem(key, value);
        } catch (e) {}
        // IndexedDB 持久化
        try {
          if (window._idbStore && window._idbStore.set) {
            window._idbStore.set(key, value, function () {
              pending--;
              if (pending === 0 && done) done(count);
            });
          } else {
            pending--;
          }
        } catch (e) {
          pending--;
        }
        if (pending === 0 && done) done(count);
      }

      for (var key in lsRaw) {
        if (!Object.prototype.hasOwnProperty.call(lsRaw, key)) continue;
        var v = processLocalStorageValueForImport(lsRaw[key], mediaStore);
        tryWrite(key, v);
      }
      for (var k2 in idbRaw) {
        if (!Object.prototype.hasOwnProperty.call(idbRaw, k2)) continue;
        var v2 = processLocalStorageValueForImport(idbRaw[k2], mediaStore);
        tryWrite(k2, v2);
      }
      if (pending === 0 && done) done(count);
    }

    // 清空旧数据
    try {
      localStorage.clear();
    } catch (e) {}
    if (window._idbStore && window._idbStore.clearAll) {
      try {
        window._idbStore.clearAll(function () {
          try { writeAll(); } catch (e) { restoreRollback(); window._restoringData = false; if (errCb) errCb("导入写入失败：" + e.message); }
        });
      } catch (e) {
        restoreRollback();
        window._restoringData = false;
        if (errCb) errCb("清空旧数据失败：" + e.message);
      }
    } else {
      try { writeAll(); } catch (e) { restoreRollback(); window._restoringData = false; if (errCb) errCb("导入写入失败：" + e.message); }
    }
  }

  function akImportBackup(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (ev) {
      try {
        var ab = ev.target.result;
        loadBackupFromArrayBuffer(
          ab,
          function (data) {
            function doImport() {
              applyBackupToStorage(
                data,
                function (count) {
                  notify(
                    "导入成功",
                    "成功导入 " + count + " 项数据，页面即将刷新",
                    "success"
                  );
                  setTimeout(function () {
                    location.reload();
                  }, 600);
                },
                function (err) {
                  notify("导入失败", err, "error");
                }
              );
            }
            if (window.__akiniCenterModal) {
              window.__akiniCenterModal(
                "确认导入",
                "导入将覆盖当前全部本地数据，确定继续？",
                {
                  confirm: true,
                  onClose: function (ok) {
                    if (ok) doImport();
                  },
                }
              );
            } else if (confirm("导入将覆盖当前全部本地数据，确定继续？")) {
              doImport();
            }
          },
          function (err) {
            notify("导入失败", err, "error");
          }
        );
      } catch (e) {
        notify("导入失败", e.message, "error");
      }
    };
    reader.onerror = function () {
      notify("读取失败", "文件读取失败，请重试", "error");
    };
    reader.readAsArrayBuffer(file);
  }

  global.akExportBackup = exportBackupToFile;
  global.akImportBackup = akImportBackup;
  global.__akiniBackupEngineReady = true;

  function bindBackupButtons() {
    var exp = document.getElementById("exportBackupBtn");
    var imp = document.getElementById("importBackupInput");
    if (exp) exp.addEventListener("click", exportBackupToFile);
    if (imp) {
      imp.addEventListener("change", function () {
        akImportBackup(imp.files && imp.files[0]);
        imp.value = "";
      });
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindBackupButtons);
  } else {
    setTimeout(bindBackupButtons, 0);
  }
})(window);
