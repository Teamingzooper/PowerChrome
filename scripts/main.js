(function () {
  window.__powerMode = window.__powerMode || {};

  const STORAGE_KEY = 'powerModeSettings';
  const DEFAULTS = {
    enabled: true,
    soundEnabled: true,
    preset: 'default',
    colorScheme: 'rainbow',
    customColors: ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#5ac8fa', '#007aff', '#af52de'],
    soundPack: 'default',
    shakeIntensity: 5,
    particleCount: 12,
    volume: 0.5,
    bitcrushAmount: 0.4,
    waveform: 'auto',
    reducedMotion: false,
    highContrast: false,
    useWebGL: false,
    enableML: false,
    comboTimeout: 1000,
    spawnOffsetX: 0,
    spawnOffsetY: 0,
    spawnJitter: 0,
    spawnDirection: 'radial',
    particleLifeMul: 1.0,
    enabledShapes: { circle: true, square: true, triangle: true, star: true, diamond: true },
    gravity: 0.15,
    friction: 0.985,
    hudPosition: 'caret',
    hudScale: 1.0,
    hudOpacity: 1.0,
    disabledDomains: [],
    pasteAnimate: true,
    enterFlash: true,
    floatInChars: false,
    spamDetection: true,
    debugMode: false,
    selectionEffects: true,
    comboBar: true,
    comboBarStyle: 'thin',
    trailLength: 4,
    clickEffects: false,
    backendKind: 'auto',
    backendUrl: '',
    theme: '',
    wordEffects: true,
    sentenceEffects: true,
    wpmIndicator: false,
    syncSettings: false,
    milestones: {
      fireworks: { enabled: true, at: 10,   effect: 'fireworks' },
      galaxy:    { enabled: true, at: 20,   effect: 'galaxy' },
      tornado:   { enabled: true, at: 50,   effect: 'tornado' },
      supernova: { enabled: true, at: 100,  effect: 'supernova' },
      blackhole: { enabled: true, at: 200,  effect: 'blackhole' },
      bigbang:   { enabled: true, at: 500,  effect: 'bigbang' },
      universe:  { enabled: true, at: 1000, effect: 'universe' }
    }
  };

  let settings = Object.assign({}, DEFAULTS);
  let canvas = null;
  let ctx2d = null;
  let lastFrame = performance.now();
  let initialized = false;
  let mutationObserver = null;
  let resizeRaf = 0;

  function hasChromeStorage() {
    return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  }
  function hasChromeRuntime() {
    return typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage;
  }

  function ensureCanvas() {
    if (canvas && canvas.isConnected) return canvas;
    canvas = document.createElement('canvas');
    canvas.setAttribute('data-powermode-canvas', '');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.cssText = [
      'position:fixed',
      'left:0',
      'top:0',
      'width:' + window.innerWidth + 'px',
      'height:' + window.innerHeight + 'px',
      'pointer-events:none',
      'z-index:2147483647',
      'background:transparent'
    ].join(';');
    (document.documentElement || document.body).appendChild(canvas);
    ctx2d = canvas.getContext('2d');
    if (ctx2d) ctx2d.scale(dpr, dpr);
    if (settings.useWebGL && window.__powerMode.webgl) {
      window.__powerMode.webgl.tryInit(canvas);
    }
    return canvas;
  }

  function onResize() {
    if (resizeRaf) cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(function () {
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      ctx2d = canvas.getContext('2d');
      if (ctx2d) ctx2d.scale(dpr, dpr);
      resizeRaf = 0;
    });
  }

  function isEditable(el) {
    if (!el) return false;
    const tag = (el.tagName || '').toLowerCase();
    if (tag === 'textarea') return !el.disabled && !el.readOnly;
    if (tag === 'input') {
      if (el.disabled || el.readOnly) return false;
      const t = (el.type || 'text').toLowerCase();
      return ['text', 'search', 'email', 'url', 'tel', 'password', 'number', 'date', 'time', 'datetime-local'].indexOf(t) >= 0;
    }
    let n = el;
    while (n) {
      if (n.isContentEditable) return true;
      const role = n.getAttribute && n.getAttribute('role');
      if (role === 'textbox' || role === 'combobox' || role === 'searchbox') return true;
      n = n.parentElement;
    }
    // Canvas-rendered editors (Google Docs etc.) route keystrokes through hidden
    // helpers; trust the host check rather than the target element.
    if (isCanvasBasedEditorHost()) return true;
    return false;
  }

  function inputCaretPos(el) {
    try {
      const style = window.getComputedStyle(el);
      const mirror = document.createElement('div');
      const props = ['boxSizing', 'width', 'height', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'textAlign', 'direction', 'lineHeight', 'textTransform'];
      for (let i = 0; i < props.length; i++) mirror.style[props[i]] = style[props[i]];
      mirror.style.position = 'absolute';
      mirror.style.visibility = 'hidden';
      mirror.style.whiteSpace = 'pre-wrap';
      mirror.style.wordWrap = 'break-word';
      mirror.style.overflow = 'hidden';
      const rect = el.getBoundingClientRect();
      mirror.style.left = (rect.left + window.scrollX) + 'px';
      mirror.style.top = (rect.top + window.scrollY) + 'px';
      mirror.style.width = rect.width + 'px';

      const tag = (el.tagName || '').toLowerCase();
      const value = (el.value || '');
      const selEnd = el.selectionEnd != null ? el.selectionEnd : value.length;
      const before = value.substring(0, selEnd);
      mirror.textContent = tag === 'input' ? before.replace(/ /g, ' ') : before;

      const caret = document.createElement('span');
      caret.textContent = '​';
      mirror.appendChild(caret);
      document.body.appendChild(mirror);
      const cr = caret.getBoundingClientRect();
      const x = cr.left - el.scrollLeft - window.scrollX;
      const y = cr.top - el.scrollTop - window.scrollY + (parseFloat(style.fontSize) || 14) * 0.6;
      document.body.removeChild(mirror);
      const rect2 = el.getBoundingClientRect();
      return {
        x: Math.max(rect2.left, Math.min(rect2.right, x)),
        y: Math.max(rect2.top, Math.min(rect2.bottom, y))
      };
    } catch (e) {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
  }

  /* Some sites render their editor to canvas/SVG — Google Docs, Sheets, Slides,
   * Figma, Notion's whiteboard. We can't measure DOM caret position there, so
   * we fall back to the last mouse position (the user's gaze usually tracks the
   * caret since they recently clicked to position it). If we have a known
   * caret-marker selector for the site, we measure that first.
   */
  const CANVAS_EDITOR_HOSTS = [
    /(^|\.)docs\.google\.com$/i,
    /(^|\.)sheets\.google\.com$/i,
    /(^|\.)slides\.google\.com$/i,
    /(^|\.)figma\.com$/i
  ];
  const CARET_MARKER_SELECTORS = ['.kix-cursor', '.kix-cursor-caret', '.docs-text-ui-cursor-blink'];

  function isCanvasBasedEditorHost() {
    const h = (typeof location !== 'undefined' && location.hostname) ? location.hostname : '';
    for (let i = 0; i < CANVAS_EDITOR_HOSTS.length; i++) {
      if (CANVAS_EDITOR_HOSTS[i].test(h)) return true;
    }
    return false;
  }

  function findCanvasCaretRect() {
    try {
      for (let i = 0; i < CARET_MARKER_SELECTORS.length; i++) {
        const el = document.querySelector(CARET_MARKER_SELECTORS[i]);
        if (el) {
          const r = el.getBoundingClientRect();
          if (r && (r.width || r.height || r.left || r.top)) return r;
        }
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  function caretPos(el) {
    if (isCanvasBasedEditorHost()) {
      const r = findCanvasCaretRect();
      if (r) return { x: r.left, y: r.top + r.height / 2 };
      if (lastMouseX || lastMouseY) return { x: lastMouseX, y: lastMouseY };
      const rect = el ? el.getBoundingClientRect() : { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0, height: 0 };
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
    const tag = (el.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return inputCaretPos(el);
    try {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0).cloneRange();
        let r = range.getBoundingClientRect();
        if (!r || (r.width === 0 && r.height === 0 && r.left === 0 && r.top === 0)) {
          const span = document.createElement('span');
          span.textContent = '​';
          range.insertNode(span);
          r = span.getBoundingClientRect();
          if (span.parentNode) span.parentNode.removeChild(span);
        }
        if (r && (r.width || r.height || r.left || r.top)) {
          return { x: r.left, y: r.top + r.height / 2 };
        }
      }
    } catch (e) { /* ignore */ }
    const r = el.getBoundingClientRect();
    return { x: r.left + 20, y: r.top + r.height / 2 };
  }

  function isModifierOnly(e) {
    const k = e.key;
    return k === 'Shift' || k === 'Control' || k === 'Meta' || k === 'Alt' ||
      k === 'CapsLock' || k === 'NumLock' || k === 'ScrollLock' ||
      k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown' ||
      k === 'Home' || k === 'End' || k === 'PageUp' || k === 'PageDown' ||
      k === 'Escape' || k === 'F1' || k === 'F2' || k === 'F3' || k === 'F4' ||
      k === 'F5' || k === 'F6' || k === 'F7' || k === 'F8' ||
      k === 'F9' || k === 'F10' || k === 'F11' || k === 'F12';
  }

  function isComboShortcut(e) {
    if (!(e.ctrlKey || e.metaKey)) return false;
    const k = (e.key || '').toLowerCase();
    return ['c', 'v', 'x', 'a', 'z', 'y', 's', 'f', 'r', 'p', 'd', 'l', 'h', 'j', 'k', 't', 'n', 'w'].indexOf(k) >= 0;
  }

  function isDeleteKey(e) {
    return e.key === 'Backspace' || e.key === 'Delete';
  }

  function isEnterKey(e) {
    return e.key === 'Enter';
  }

  /* ---------- Spam detection ----------
   * Pauses combo growth (and milestones) when the user is either
   * holding a key (browser auto-repeat) or hammering the same key
   * fast enough that it isn't real "typing".
   */
  let spamLastKey = null;
  let spamRepeatCount = 0;
  let spamLastAt = 0;
  const SPAM_REPEAT_THRESHOLD = 3;     // same key N times in a row
  const SPAM_INTERVAL_THRESHOLD = 80;  // and each within this many ms

  function shouldPauseForSpam(e) {
    const settings = currentSettings();
    if (!settings.spamDetection) return false;
    if (e && e.repeat) return true;
    const now = performance.now();
    const k = e ? e.key : null;
    const dt = now - spamLastAt;
    if (k && k === spamLastKey && dt < SPAM_INTERVAL_THRESHOLD) {
      spamRepeatCount++;
    } else {
      spamLastKey = k;
      spamRepeatCount = 1;
    }
    spamLastAt = now;
    return spamRepeatCount >= SPAM_REPEAT_THRESHOLD;
  }

  function resetSpamWindow() {
    spamLastKey = null;
    spamRepeatCount = 0;
    spamLastAt = 0;
  }

  function currentSettings() {
    return (window.__powerMode.main && window.__powerMode.main.getSettings && window.__powerMode.main.getSettings()) || settings;
  }

  function isDomainDisabled() {
    const s = currentSettings();
    const list = s.disabledDomains;
    if (!list || !list.length) return false;
    const host = (typeof location !== 'undefined' && location.hostname) ? location.hostname.toLowerCase() : '';
    for (let i = 0; i < list.length; i++) {
      const d = String(list[i] || '').toLowerCase().trim();
      if (!d) continue;
      if (host === d || host.endsWith('.' + d)) return true;
    }
    return false;
  }

  let lastMouseX = 0;
  let lastMouseY = 0;
  function onMouseMove(e) {
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  }

  function onKeydown(e) {
    if (!settings.enabled) return;
    if (isDomainDisabled()) return;
    const target = e.target;
    if (!isEditable(target)) return;
    if (isModifierOnly(e)) return;
    if (isComboShortcut(e)) return;

    // Paste animator handles its own preventDefault on `paste` events.
    // We skip processing here while it's animating to avoid double counts.
    if (window.__powerMode.paste && window.__powerMode.paste._isAnimating()) return;

    const pos = caretPos(target);
    const ml = window.__powerMode.ml;
    const stats = window.__powerMode.stats;
    const tfx = window.__powerMode.typingFx;
    const deleteMode = isDeleteKey(e);
    const enterMode = isEnterKey(e);
    const spammed = !deleteMode && !enterMode && shouldPauseForSpam(e);
    if (deleteMode || enterMode) resetSpamWindow();

    let combo;
    if (window.__powerMode.combo) {
      combo = window.__powerMode.combo.register(pos.x, pos.y, { noIncrement: deleteMode || spammed });
    } else {
      combo = 1;
    }
    if (ml) ml.recordKeystroke();

    // Backspace/Delete with a non-empty selection deletes a span of text —
    // give it a bigger feel proportional to the deletion length.
    let selectionDeleteLen = 0;
    if (deleteMode && window.__powerMode.selectionFx) {
      selectionDeleteLen = window.__powerMode.selectionFx._getSelectionLength(target);
      if (selectionDeleteLen > 0) {
        window.__powerMode.selectionFx.onSelectionDelete(target, selectionDeleteLen);
      }
    }

    if (stats) {
      if (deleteMode) stats.recordDelete();
      else if (enterMode) stats.recordEnter();
      else if (e.key && e.key.length === 1) stats.recordChar();
      if (!spammed) stats.recordCombo(combo);
    }

    if (window.__powerMode.particles) {
      const opts = { combo: combo, userTriggered: true };
      if (deleteMode) opts.deleteMode = true;
      // Selection-delete already handled its own burst — skip the single-char one.
      if (!(deleteMode && selectionDeleteLen > 0)) {
        window.__powerMode.particles.spawn(pos.x, pos.y, opts);
      }
    }
    if (window.__powerMode.vfx) {
      const shakeAmount = deleteMode ? 1.5 : (spammed ? 1 : (2 + Math.min(combo / 8, 12)));
      window.__powerMode.vfx.shake(shakeAmount);
      if (!deleteMode) {
        const hudPos = resolveHudPos(pos);
        window.__powerMode.vfx.updateHUD(combo, hudPos.x, hudPos.y);
      }
    }
    if (settings.soundEnabled && window.__powerMode.sfx) {
      window.__powerMode.sfx.play(e.key, combo);
    }
    if (enterMode && tfx) {
      tfx.flashEnter();
      tfx.spawnCarriageReturnParticles(pos.x, pos.y);
      const enterResult = tfx.onEnterKey();
      if (enterResult) {
        if (stats) stats.recordSentence();
        tfx.spawnSentenceEffect(pos.x, pos.y);
      }
    } else if (deleteMode && tfx) {
      tfx.onDeleteChar();
    } else if (tfx && e.key && e.key.length === 1) {
      tfx.floatChar(e.key, pos.x, pos.y);
      const wordResult = tfx.onCharKey(e.key);
      if (wordResult && wordResult.kind === 'word') {
        if (stats) stats.recordWord();
        tfx.spawnWordEffect(pos.x, pos.y);
      } else if (wordResult && wordResult.kind === 'sentence') {
        if (stats) {
          if (wordResult.hadWord) stats.recordWord();
          stats.recordSentence();
        }
        tfx.spawnSentenceEffect(pos.x, pos.y);
      }
    }
    if (window.__powerMode.debug) {
      const tag = deleteMode ? 'delete' : (enterMode ? 'enter' : (spammed ? 'spam' : 'key'));
      window.__powerMode.debug.log(tag, e.key + ' @ ' + Math.round(pos.x) + ',' + Math.round(pos.y) + ' combo=' + combo);
    }
  }

  function resolveHudPos(caret) {
    const s = currentSettings();
    const pos = s.hudPosition || 'caret';
    if (pos === 'caret') return caret;
    if (pos === 'followCursor') return { x: lastMouseX, y: lastMouseY };
    const w = window.innerWidth;
    const h = window.innerHeight;
    const margin = 16;
    const hw = 100;
    const hh = 60;
    switch (pos) {
      case 'topLeft':      return { x: margin,           y: margin + hh };
      case 'topCenter':    return { x: w / 2 - hw,       y: margin + hh };
      case 'topRight':     return { x: w - hw * 2 - margin, y: margin + hh };
      case 'bottomLeft':   return { x: margin,           y: h - margin };
      case 'bottomCenter': return { x: w / 2 - hw,       y: h - margin };
      case 'bottomRight':  return { x: w - hw * 2 - margin, y: h - margin };
      default:             return caret;
    }
  }

  function frame() {
    const now = performance.now();
    const dt = now - lastFrame;
    lastFrame = now;

    if (window.__powerMode.perf) window.__powerMode.perf.tick();
    if (window.__powerMode.combo) window.__powerMode.combo.tick();
    if (window.__powerMode.particles) window.__powerMode.particles.update(dt);

    ensureCanvas();
    const useWebGL = settings.useWebGL && window.__powerMode.webgl && window.__powerMode.webgl.available;
    if (useWebGL) {
      try {
        window.__powerMode.webgl.render(window.__powerMode.particles._pool, canvas);
      } catch (err) {
        console.warn('[PowerChrome] webgl render error', err);
      }
    } else if (ctx2d) {
      const dpr = window.devicePixelRatio || 1;
      ctx2d.save();
      ctx2d.setTransform(1, 0, 0, 1, 0, 0);
      ctx2d.clearRect(0, 0, canvas.width, canvas.height);
      ctx2d.restore();
      if (window.__powerMode.particles) {
        try {
          window.__powerMode.particles.render(ctx2d);
        } catch (err) {
          console.warn('[PowerChrome] particle render error', err);
        }
      }
    }
    if (window.__powerMode.vfx) window.__powerMode.vfx.tick();
    if (window.__powerMode.debug) window.__powerMode.debug.tick();
    if (window.__powerMode.wpm) window.__powerMode.wpm.tick();

    requestAnimationFrame(frame);
  }

  function applyAccessibilityOverrides(s) {
    const a11y = window.__powerMode.accessibility;
    if (!a11y) return s;
    if (a11y.prefersHighContrast() || s.highContrast) {
      return Object.assign({}, s, { colorScheme: 'monochrome' });
    }
    return s;
  }

  function applySettings(next) {
    const prev = Object.assign({}, settings);
    settings = Object.assign({}, DEFAULTS, next);
    const sfx = window.__powerMode.sfx;
    if (sfx) {
      sfx.setVolume(settings.volume);
      sfx.setBitcrush(settings.bitcrushAmount);
      sfx.setPack(settings.soundPack);
      sfx.setWaveformOverride(settings.waveform);
    }
    if (settings.useWebGL && window.__powerMode.webgl && canvas) {
      if (!window.__powerMode.webgl.available) window.__powerMode.webgl.tryInit(canvas);
    }
    if (!settings.enabled && window.__powerMode.vfx) {
      window.__powerMode.vfx.reset();
      if (window.__powerMode.particles) window.__powerMode.particles.clear();
    }
    const ml = window.__powerMode.ml;
    if (ml && ml.enabled && prev) {
      const numericKeys = ['shakeIntensity', 'particleCount', 'volume', 'bitcrushAmount'];
      const enumKeys = ['preset', 'colorScheme', 'soundPack', 'waveform'];
      for (let i = 0; i < numericKeys.length; i++) {
        const k = numericKeys[i];
        if (prev[k] !== settings[k]) ml.observe(k, settings[k]);
      }
      for (let i = 0; i < enumKeys.length; i++) {
        const k = enumKeys[i];
        if (prev[k] !== settings[k]) ml.observe(k, settings[k]);
      }
    }
    // Push settings to the backend when sync is enabled. Skip transient/per-device
    // fields so different machines can still have different backendUrl etc.
    if (settings.syncSettings && window.__powerMode.social && window.__powerMode.social.remoteBackend) {
      try {
        const slim = Object.assign({}, settings);
        delete slim.backendUrl;
        delete slim.backendKind;
        delete slim.syncSettings;
        delete slim.debugMode;
        window.__powerMode.social.remoteBackend.pushSettings(slim);
      } catch (e) { /* ignore */ }
    }
  }

  function persistAndApply(next) {
    applySettings(next);
    if (hasChromeStorage()) {
      try {
        const payload = {};
        payload[STORAGE_KEY] = settings;
        chrome.storage.local.set(payload);
      } catch (e) { /* ignore */ }
    }
  }

  function onMessage(msg, sender, sendResponse) {
    if (!msg) return false;
    if (msg.type === 'settingsChanged' && msg.settings) {
      applySettings(applyAccessibilityOverrides(msg.settings));
      return false;
    }
    if (msg.type === 'getStats') {
      const stats = window.__powerMode.perf ? window.__powerMode.perf.getStats() : { fps: 0 };
      try { sendResponse(stats); } catch (e) { /* ignore */ }
      return false;
    }
    return false;
  }

  function shouldInitInThisFrame() {
    // Top frame: always.
    if (window === window.top) return true;
    // No body? Not an HTML document we can paint onto.
    if (!document.body) return false;
    // Skip tiny iframes (ads, tracking pixels, hidden mounting frames).
    const w = window.innerWidth || 0;
    const h = window.innerHeight || 0;
    if (w < 120 || h < 80) return false;
    return true;
  }

  function init() {
    if (initialized) return;
    if (!shouldInitInThisFrame()) return;
    initialized = true;

    if (hasChromeStorage()) {
      try {
        chrome.storage.local.get([STORAGE_KEY], function (res) {
          const stored = (res && res[STORAGE_KEY]) || {};
          applySettings(applyAccessibilityOverrides(Object.assign({}, DEFAULTS, stored)));
          if (window.__powerMode.ml) window.__powerMode.ml.init();
          if (window.__powerMode.stats) window.__powerMode.stats.init();
          if (window.__powerMode.social) window.__powerMode.social.init();
        });
      } catch (e) {
        applySettings(applyAccessibilityOverrides(DEFAULTS));
      }
    } else {
      applySettings(applyAccessibilityOverrides(DEFAULTS));
      if (window.__powerMode.stats) window.__powerMode.stats.init();
      if (window.__powerMode.social) window.__powerMode.social.init();
    }

    if (hasChromeRuntime()) {
      try { chrome.runtime.onMessage.addListener(onMessage); } catch (e) { /* ignore */ }
    }

    const a11y = window.__powerMode.accessibility;
    if (a11y) a11y.onChange(function () { applySettings(applyAccessibilityOverrides(settings)); });

    document.addEventListener('keydown', onKeydown, true);
    document.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('resize', onResize);
    ensureCanvas();

    try {
      mutationObserver = new MutationObserver(function () {
        if (!canvas || !canvas.isConnected) {
          canvas = null;
          ensureCanvas();
        }
      });
      if (document.documentElement) {
        mutationObserver.observe(document.documentElement, { childList: true, subtree: false });
      }
    } catch (e) { /* ignore */ }

    requestAnimationFrame(frame);
  }

  window.__powerMode.main = {
    init: init,
    getSettings: function () { return settings; },
    applySettings: persistAndApply,
    DEFAULTS: DEFAULTS,
    _caretPos: caretPos,
    _isEditable: isEditable,
    _isDeleteKey: isDeleteKey,
    _isEnterKey: isEnterKey,
    _isDomainDisabled: isDomainDisabled,
    _resolveHudPos: resolveHudPos,
    _shouldPauseForSpam: shouldPauseForSpam,
    _resetSpamWindow: resetSpamWindow,
    _onKeydown: onKeydown,
    _applySettingsRaw: applySettings,
    _applyAccessibilityOverrides: applyAccessibilityOverrides
  };
})();
