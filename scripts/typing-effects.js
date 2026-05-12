(function () {
  window.__powerMode = window.__powerMode || {};

  let flashEl = null;
  const floatLayer = { el: null };

  function getSettings() {
    return (window.__powerMode.main && window.__powerMode.main.getSettings()) || {};
  }

  function ensureFlashEl() {
    if (flashEl && flashEl.isConnected) return flashEl;
    flashEl = document.createElement('div');
    flashEl.setAttribute('data-powermode-flash', '');
    flashEl.style.cssText = [
      'position:fixed', 'inset:0',
      'pointer-events:none',
      'z-index:2147483645',
      'background:linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.0) 80%)',
      'opacity:0',
      'transition:opacity .22s ease-out',
      'mix-blend-mode:screen'
    ].join(';');
    (document.documentElement || document.body).appendChild(flashEl);
    return flashEl;
  }

  function flashEnter() {
    const settings = getSettings();
    const a11y = window.__powerMode.accessibility;
    const reduced = (a11y && a11y.prefersReducedMotion()) || settings.reducedMotion;
    if (!settings.enterFlash) return;
    const el = ensureFlashEl();
    el.style.transition = 'opacity .05s linear';
    el.style.opacity = reduced ? '0.08' : '0.22';
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        el.style.transition = 'opacity .35s ease-out';
        el.style.opacity = '0';
      });
    });
  }

  function spawnCarriageReturnParticles(x, y) {
    const particles = window.__powerMode.particles;
    const presets = window.__powerMode.presets;
    const settings = getSettings();
    const a11y = window.__powerMode.accessibility;
    const reduced = (a11y && a11y.prefersReducedMotion()) || settings.reducedMotion;
    if (!particles || reduced) return;
    const palette = presets ? presets.getColorScheme(settings.colorScheme || 'rainbow') : ['#ffffff'];
    // A row of particles streaking horizontally (typewriter carriage return)
    const count = 20;
    const w = window.innerWidth;
    for (let i = 0; i < count; i++) {
      const t = i / count;
      particles.spawn(w * 0.05 + t * w * 0.9, y, {
        count: 1,
        angle: Math.PI,
        speed: 6 + Math.random() * 6,
        baseSize: 3,
        life: 700,
        palette: palette
      });
    }
  }

  /* ---------- Float-in character ---------- */
  function ensureFloatLayer() {
    if (floatLayer.el && floatLayer.el.isConnected) return floatLayer.el;
    const layer = document.createElement('div');
    layer.setAttribute('data-powermode-floatlayer', '');
    layer.style.cssText = [
      'position:fixed', 'inset:0',
      'pointer-events:none',
      'z-index:2147483644',
      'overflow:hidden'
    ].join(';');
    (document.documentElement || document.body).appendChild(layer);
    floatLayer.el = layer;
    return layer;
  }

  function floatChar(ch, x, y, opts) {
    const settings = getSettings();
    if (!settings.floatInChars) return;
    const a11y = window.__powerMode.accessibility;
    const reduced = (a11y && a11y.prefersReducedMotion()) || settings.reducedMotion;
    if (reduced) return;
    if (!ch || ch.length !== 1) return;
    const layer = ensureFloatLayer();
    const span = document.createElement('span');
    span.textContent = ch;
    const dx = (Math.random() - 0.5) * 30;
    const dy = -28 - Math.random() * 16;
    const startX = x + dx;
    const startY = y + dy;
    const presets = window.__powerMode.presets;
    const palette = (opts && opts.palette) || (presets ? presets.getColorScheme(settings.colorScheme || 'rainbow') : ['#ffffff']);
    const color = palette[Math.floor(Math.random() * palette.length)] || '#ffffff';
    span.style.cssText = [
      'position:absolute',
      'left:' + startX + 'px',
      'top:' + startY + 'px',
      'font:600 22px/1 ui-monospace,SFMono-Regular,Menlo,monospace',
      'color:' + color,
      'text-shadow:0 2px 8px rgba(0,0,0,.5)',
      'opacity:0',
      'will-change:transform,opacity',
      'transition:transform .28s cubic-bezier(.2,.8,.2,1), opacity .28s ease-out'
    ].join(';');
    layer.appendChild(span);
    requestAnimationFrame(function () {
      span.style.opacity = '1';
      span.style.transform = 'translate(' + (x - startX).toFixed(1) + 'px, ' + (y - startY).toFixed(1) + 'px)';
      setTimeout(function () {
        span.style.transition = 'opacity .12s ease-out';
        span.style.opacity = '0';
        setTimeout(function () { if (span.parentNode) span.parentNode.removeChild(span); }, 200);
      }, 200);
    });
  }

  /* ---------- Word + sentence detection ---------- */
  const WORD_BREAK_RE = /^[\s,;:–—/\\()\[\]{}"'`]$/;
  const SENTENCE_END_RE = /^[.!?]$/;
  let wordBuffer = '';

  function onCharKey(key) {
    if (!key || key.length !== 1) return null;
    if (SENTENCE_END_RE.test(key)) {
      const had = wordBuffer.length > 0;
      const len = wordBuffer.length;
      wordBuffer = '';
      return { kind: 'sentence', length: len + 1, hadWord: had };
    }
    if (WORD_BREAK_RE.test(key)) {
      if (wordBuffer.length === 0) return null;
      const len = wordBuffer.length;
      wordBuffer = '';
      return { kind: 'word', length: len };
    }
    wordBuffer += key;
    return null;
  }

  function onDeleteChar() {
    wordBuffer = wordBuffer.slice(0, -1);
  }

  function onEnterKey() {
    if (wordBuffer.length === 0) return null;
    const len = wordBuffer.length;
    wordBuffer = '';
    return { kind: 'sentence', length: len, hadWord: true, viaEnter: true };
  }

  function resetWordBuffer() { wordBuffer = ''; }
  function _getWordBuffer() { return wordBuffer; }

  function spawnWordEffect(x, y) {
    const particles = window.__powerMode.particles;
    if (!particles) return;
    const settings = getSettings();
    if (!settings.wordEffects) return;
    const a11y = window.__powerMode.accessibility;
    const reduced = (a11y && a11y.prefersReducedMotion()) || settings.reducedMotion;
    if (reduced) return;
    const presets = window.__powerMode.presets;
    const palette = presets ? presets.getColorScheme(settings.colorScheme || 'rainbow') : ['#ffffff'];
    particles.spawn(x, y, {
      count: 6,
      palette: palette.concat(['#ffffff']),
      angle: -Math.PI / 2,
      speed: 4,
      baseSize: 2,
      life: 500
    });
  }

  function spawnSentenceEffect(x, y) {
    const particles = window.__powerMode.particles;
    if (!particles) return;
    const settings = getSettings();
    if (!settings.sentenceEffects) return;
    const a11y = window.__powerMode.accessibility;
    const reduced = (a11y && a11y.prefersReducedMotion()) || settings.reducedMotion;
    if (reduced) return;
    const presets = window.__powerMode.presets;
    const palette = presets ? presets.getColorScheme(settings.colorScheme || 'rainbow') : ['#ffffff'];
    particles.spawn(x, y, {
      count: 18,
      palette: palette,
      speed: 7,
      baseSize: 4,
      life: 900
    });
    // Subtle flash to mark the end of a sentence
    const el = ensureFlashEl();
    el.style.transition = 'opacity .04s linear';
    el.style.opacity = '0.10';
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        el.style.transition = 'opacity .3s ease-out';
        el.style.opacity = '0';
      });
    });
    if (window.__powerMode.vfx) window.__powerMode.vfx.shake(3);
  }

  window.__powerMode.typingFx = {
    flashEnter: flashEnter,
    spawnCarriageReturnParticles: spawnCarriageReturnParticles,
    floatChar: floatChar,
    onCharKey: onCharKey,
    onDeleteChar: onDeleteChar,
    onEnterKey: onEnterKey,
    spawnWordEffect: spawnWordEffect,
    spawnSentenceEffect: spawnSentenceEffect,
    resetWordBuffer: resetWordBuffer,
    _ensureFlashEl: ensureFlashEl,
    _getWordBuffer: _getWordBuffer
  };
})();
