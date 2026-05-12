(function () {
  window.__powerMode = window.__powerMode || {};

  const STORAGE_KEY = 'powerModeSettings';
  const DEFAULTS = {
    enabled: true,
    soundEnabled: true,
    preset: 'default',
    colorScheme: 'rainbow',
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
    comboTimeout: 1000
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
      n = n.parentElement;
    }
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

  function caretPos(el) {
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

  function onKeydown(e) {
    if (!settings.enabled) return;
    const target = e.target;
    if (!isEditable(target)) return;
    if (isModifierOnly(e)) return;
    if (isComboShortcut(e)) return;

    const pos = caretPos(target);
    const combo = window.__powerMode.combo ? window.__powerMode.combo.register(pos.x, pos.y) : 1;
    const ml = window.__powerMode.ml;
    if (ml) ml.recordKeystroke();

    if (window.__powerMode.particles) {
      window.__powerMode.particles.spawn(pos.x, pos.y, { combo: combo });
    }
    if (window.__powerMode.vfx) {
      window.__powerMode.vfx.shake(2 + Math.min(combo / 8, 12));
      window.__powerMode.vfx.updateHUD(combo, pos.x, pos.y);
    }
    if (settings.soundEnabled && window.__powerMode.sfx) {
      window.__powerMode.sfx.play(e.key, combo);
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

  function init() {
    if (initialized) return;
    initialized = true;

    if (hasChromeStorage()) {
      try {
        chrome.storage.local.get([STORAGE_KEY], function (res) {
          const stored = (res && res[STORAGE_KEY]) || {};
          applySettings(applyAccessibilityOverrides(Object.assign({}, DEFAULTS, stored)));
          if (window.__powerMode.ml) window.__powerMode.ml.init();
        });
      } catch (e) {
        applySettings(applyAccessibilityOverrides(DEFAULTS));
      }
    } else {
      applySettings(applyAccessibilityOverrides(DEFAULTS));
    }

    if (hasChromeRuntime()) {
      try { chrome.runtime.onMessage.addListener(onMessage); } catch (e) { /* ignore */ }
    }

    const a11y = window.__powerMode.accessibility;
    if (a11y) a11y.onChange(function () { applySettings(applyAccessibilityOverrides(settings)); });

    document.addEventListener('keydown', onKeydown, true);
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
    _onKeydown: onKeydown,
    _applySettingsRaw: applySettings,
    _applyAccessibilityOverrides: applyAccessibilityOverrides
  };
})();
