  function addImportant(css){
    // 逐个规则块处理：对 {...} 内的每条声明补 !important（即使末尾无分号也能覆盖）
    return css.replace(/([^{}]*?)\{([^{}]*)\}/g,function(m,sel,body){
      var fixedBody=body.replace(/([a-zA-Z-]+)\s*:\s*([^;{}]+)\s*(;|$)/g,function(mm,prop,val,sep){
        if(/^\s*content\s*$/i.test(prop)) return mm;
        if(/^\s*--/.test(prop)) return mm;
        if(/!important/i.test(val)) return mm;
        return prop+":"+val+" !important"+(sep||";");
      });
      return sel+"{"+fixedBody+"}";
    });
  }

  /* 将常见气泡选择器映射到本应用结构，并加 .chat-body 前缀提升权重；排除转账与表情包气泡 */
  function translateSelectors(css){
    var meSel=".chat-body .msg-row.me .bubble:not(.transfer-bubble):not(.sticker-bubble):not(.survey-bubble):not(.shop-card-bubble)";
    var otherSel=".chat-body .msg-row.other .bubble:not(.transfer-bubble):not(.sticker-bubble):not(.survey-bubble):not(.shop-card-bubble)";
    var anySel=".chat-body .msg-row .bubble:not(.transfer-bubble):not(.sticker-bubble):not(.survey-bubble):not(.shop-card-bubble)";
    /* 单次遍历替换：替换结果不会被再次替换，避免生成嵌套的无效选择器 */
    return css.replace(/\.message\.message-sent|\.message\.message-received|\.message-sent|\.message-received|\.bubble\.me(?![\w-])|\.bubble\.other(?![\w-])|\.bubble(?![\w-])|\.message(?![\w-])/g,function(m){
      if(m===".message.message-sent") return meSel;
      if(m===".message.message-received") return otherSel;
      if(m===".message-sent") return meSel;
      if(m===".message-received") return otherSel;
      if(m===".bubble.me") return meSel;
      if(m===".bubble.other") return otherSel;
      if(m===".bubble") return anySel;
      return anySel;
    });
  }


function applyCss(css){
  var st = document.getElementById('akini-user-css');
  if(!st){ st=document.createElement('style'); st.id='akini-user-css'; document.head.appendChild(st); }
  st.textContent = css ? addImportant(translateSelectors(css)) : '';
  document.body.classList.add('bubble-css-on');
}

/* ===== milk 管线：boostSpecificity（html body 前缀加权，与 milk utils.js 一致） ===== */
function milkBoost(css) {
  return css.replace(/([^{}@][^{}]*)\{([^{}]*)\}/g, function (match, rawSel, body) {
    var selectors = rawSel.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    var boosted = selectors.map(function (sel) {
      if (sel.startsWith('html') || sel.startsWith('@') || sel.startsWith('from') || sel.startsWith('to') || /^\d/.test(sel)) return sel;
      return 'html body ' + sel;
    });
    return boosted.join(', ') + ' {' + body + '}';
  });
}
function applyBoth() {
  var css = document.getElementById('btCss').value || '';
  var ms = document.getElementById('bt-milk-style');
  if (!ms) { ms = document.createElement('style'); ms.id = 'bt-milk-style'; document.head.appendChild(ms); }
  ms.textContent = milkBoost(css);
  applyCss(css); // akini 真实管线（translator.js 原文）
}
document.getElementById('btApply').addEventListener('click', applyBoth);
applyBoth();
