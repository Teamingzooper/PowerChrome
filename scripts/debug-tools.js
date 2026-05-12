(function () {
  window.__powerMode = window.__powerMode || {};

  const MAX_EVENTS = 50;
  const MAX_ERRORS = 25;
  let overlayEl = null;
  let overlayBody = null;
  let installedErrorHandler = false;
  let lastRender = 0;

  const recent = {
    events: [],   // ring buffer of { t, kind, msg }
    errors: []
  };

  function getSettings() {
    return (window.__powerMode.main && window.__powerMode.main.getSettings()) || {};
  }

  function shouldShow() {
    const s = getSettings();
    return !!s.debugMode;
  }

  function log(kind, msg) {
    const t = performance.now();
    recent.events.push({ t: t, kind: kind, msg: msg });
    if (recent.events.length > MAX_EVENTS) recent.events.splice(0, recent.events.length - MAX_EVENTS);
    if (shouldShow()) {
      try { console.log('[PowerChrome:' + kind + ']', msg); } catch (e) { /* ignore */ }
    }
  }

  function logError(err, where) {
    recent.errors.push({
      t: performance.now(),
      where: where || 'unknown',
      message: (err && err.message) || String(err),
      stack: (err && err.stack) || ''
    });
    if (recent.errors.length > MAX_ERRORS) recent.errors.splice(0, recent.errors.length - MAX_ERRORS);
    try { console.warn('[PowerChrome] error in', where, err); } catch (e) { /* ignore */ }
  }

  function installErrorCapture() {
    if (installedErrorHandler) return;
    installedErrorHandler = true;
    window.addEventListener('error', function (e) {
      const msg = (e && e.message) || 'error';
      if (msg.indexOf('PowerChrome') === -1 && msg.indexOf('__powerMode') === -1) return;
      logError(e.error || new Error(msg), 'window.onerror');
    });
    window.addEventListener('unhandledrejection', function (e) {
      logError(e.reason || new Error('unhandled rejection'), 'unhandledrejection');
    });
  }

  function ensureOverlay() {
    if (overlayEl && overlayEl.isConnected) return overlayEl;
    overlayEl = document.createElement('div');
    overlayEl.setAttribute('data-powermode-debug', '');
    overlayEl.style.cssText = [
      'position:fixed',
      'top:10px', 'left:10px',
      'z-index:2147483647',
      'pointer-events:none',
      'background:rgba(11,13,19,.85)',
      'border:1px solid #2a2f3d',
      'border-radius:8px',
      'padding:8px 10px',
      'min-width:240px',
      'max-width:340px',
      'font:11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace',
      'color:#e7ecf2',
      'box-shadow:0 4px 18px rgba(0,0,0,.5)',
      'backdrop-filter:blur(4px)',
      'opacity:0',
      'transition:opacity .15s ease-out'
    ].join(';');
    const header = document.createElement('div');
    header.textContent = '⚡ PowerChrome debug';
    header.style.cssText = 'font-weight:700;color:#7c5cff;margin-bottom:4px;letter-spacing:.04em;text-transform:uppercase;font-size:10px';
    overlayEl.appendChild(header);
    overlayBody = document.createElement('div');
    overlayBody.style.cssText = 'white-space:pre-wrap;color:#cdd5e0';
    overlayEl.appendChild(overlayBody);
    (document.documentElement || document.body).appendChild(overlayEl);
    return overlayEl;
  }

  function removeOverlay() {
    if (overlayEl && overlayEl.parentNode) {
      overlayEl.parentNode.removeChild(overlayEl);
    }
    overlayEl = null;
    overlayBody = null;
  }

  function summarize() {
    const PM = window.__powerMode;
    const perf = PM.perf;
    const particles = PM.particles;
    const combo = PM.combo;
    const stats = perf ? perf.getStats() : { fps: 0, memoryBytes: 0, aliveParticles: 0, throttling: false };
    const comboCount = combo ? combo.getCount() : 0;
    const settings = getSettings();
    const sfx = PM.sfx;
    const lastEvent = recent.events.length ? recent.events[recent.events.length - 1] : null;
    const lastError = recent.errors.length ? recent.errors[recent.errors.length - 1] : null;
    const lines = [
      'fps:        ' + String(stats.fps).padStart(3, ' ') + (stats.throttling ? '  (throttled)' : ''),
      'particles:  ' + (particles ? particles.getAliveCount() : 0),
      'combo:      ' + comboCount,
      'preset:     ' + (settings.preset || 'default'),
      'scheme:     ' + (settings.colorScheme || 'rainbow'),
      'audio:      ' + (sfx && sfx.getBackendKind ? sfx.getBackendKind() : 'none'),
      'frame:      ' + (window === window.top ? 'top' : 'iframe ' + (window.innerWidth + 'x' + window.innerHeight)),
      'last event: ' + (lastEvent ? (lastEvent.kind + ' · ' + truncate(lastEvent.msg, 36)) : '—'),
      'last error: ' + (lastError ? truncate(lastError.message, 48) : '—')
    ];
    return lines.join('\n');
  }

  function truncate(s, n) {
    s = String(s == null ? '' : s);
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }

  function tick() {
    const on = shouldShow();
    if (!on) {
      if (overlayEl) removeOverlay();
      return;
    }
    const now = performance.now();
    if (now - lastRender < 250) return; // throttle to 4Hz
    lastRender = now;
    const el = ensureOverlay();
    overlayBody.textContent = summarize();
    el.style.opacity = '1';
  }

  function getSnapshot() {
    const PM = window.__powerMode;
    const stats = PM.perf ? PM.perf.getStats() : {};
    return {
      version: '1.3.0',
      ua: navigator.userAgent,
      audioBackend: PM.sfx && PM.sfx.getBackendKind ? PM.sfx.getBackendKind() : 'none',
      webglAvailable: !!(PM.webgl && PM.webgl.available),
      audioWorkletSupported: typeof AudioWorkletNode !== 'undefined',
      hostname: location.hostname,
      isTopFrame: window === window.top,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      devicePixelRatio: window.devicePixelRatio || 1,
      reducedMotion: PM.accessibility ? PM.accessibility.prefersReducedMotion() : false,
      highContrast: PM.accessibility ? PM.accessibility.prefersHighContrast() : false,
      fps: stats.fps || 0,
      throttling: !!stats.throttling,
      aliveParticles: stats.aliveParticles || 0,
      recentEvents: recent.events.slice(),
      recentErrors: recent.errors.slice()
    };
  }

  installErrorCapture();

  window.__powerMode.debug = {
    log: log,
    logError: logError,
    tick: tick,
    getSnapshot: getSnapshot,
    _recent: recent,
    _ensureOverlay: ensureOverlay,
    _removeOverlay: removeOverlay,
    _shouldShow: shouldShow
  };
})();
