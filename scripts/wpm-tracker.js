/* WPM tracker.
 *
 * Standard WPM formula: chars / 5 / minutes.
 * We compute over a 10-second rolling window for "live" WPM and track the
 * highest 10-second window ever seen as "peak WPM". A small floating
 * indicator can be opted into via settings.wpmIndicator.
 */
(function () {
  window.__powerMode = window.__powerMode || {};

  const WINDOW_MS = 10000;
  const SAMPLE_CAP = 256;
  const samples = []; // timestamps of recent char strokes
  let peak = 0;
  let indicatorEl = null;
  let indicatorLastRender = 0;

  function getSettings() {
    return (window.__powerMode.main && window.__powerMode.main.getSettings()) || {};
  }

  function pruneOld(now) {
    const cutoff = now - WINDOW_MS;
    while (samples.length && samples[0] < cutoff) samples.shift();
    if (samples.length > SAMPLE_CAP) samples.splice(0, samples.length - SAMPLE_CAP);
  }

  function liveWpm() {
    const now = performance.now();
    pruneOld(now);
    if (samples.length < 2) return 0;
    const elapsed = now - samples[0];
    if (elapsed < 250) return 0;
    const minutes = elapsed / 60000;
    return Math.round((samples.length / 5) / minutes);
  }

  function recordChar() {
    const now = performance.now();
    samples.push(now);
    pruneOld(now);
    const wpm = liveWpm();
    if (wpm > peak) peak = wpm;
  }

  function getPeak() { return peak; }
  function setPeak(p) { peak = Math.max(peak, p || 0); }

  function ensureIndicator() {
    if (indicatorEl && indicatorEl.isConnected) return indicatorEl;
    indicatorEl = document.createElement('div');
    indicatorEl.setAttribute('data-powermode-wpm', '');
    indicatorEl.style.cssText = [
      'position:fixed',
      'right:14px',
      'bottom:14px',
      'z-index:2147483646',
      'pointer-events:none',
      'font:bold 13px/1 ui-monospace,SFMono-Regular,Menlo,monospace',
      'color:#e7ecf2',
      'background:rgba(11,13,19,.82)',
      'border:1px solid #2a2f3d',
      'border-radius:999px',
      'padding:6px 12px',
      'box-shadow:0 4px 18px rgba(0,0,0,.45)',
      'backdrop-filter:blur(4px)',
      'opacity:0',
      'transition:opacity .2s ease-out, transform .2s ease-out',
      'transform:translateY(8px)'
    ].join(';');
    (document.documentElement || document.body).appendChild(indicatorEl);
    return indicatorEl;
  }

  function removeIndicator() {
    if (indicatorEl && indicatorEl.parentNode) indicatorEl.parentNode.removeChild(indicatorEl);
    indicatorEl = null;
  }

  function tick() {
    const settings = getSettings();
    if (!settings.wpmIndicator) {
      if (indicatorEl) removeIndicator();
      return;
    }
    const now = performance.now();
    if (now - indicatorLastRender < 200) return;
    indicatorLastRender = now;
    const el = ensureIndicator();
    const wpm = liveWpm();
    if (wpm <= 0) {
      el.style.opacity = '0';
      el.style.transform = 'translateY(8px)';
      return;
    }
    el.textContent = wpm + ' wpm · peak ' + peak;
    // Color escalates: green > 40, yellow > 80, magenta > 120
    let color = '#34c759';
    if (wpm > 120) color = '#bf5af2';
    else if (wpm > 80) color = '#ffd60a';
    else if (wpm > 40) color = '#34c759';
    else color = '#e7ecf2';
    el.style.color = color;
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
  }

  window.__powerMode.wpm = {
    recordChar: recordChar,
    liveWpm: liveWpm,
    getPeak: getPeak,
    setPeak: setPeak,
    tick: tick,
    _samples: samples,
    _config: { WINDOW_MS: WINDOW_MS, SAMPLE_CAP: SAMPLE_CAP }
  };
})();
