(function () {
  window.__powerMode = window.__powerMode || {};

  let shakeAmp = 0;
  const SHAKE_DECAY = 0.85;
  let hudEl = null;
  let hudCountEl = null;
  let hudBarEl = null;
  let hudBarFillEl = null;
  let hudHideTimer = null;
  let lastComboShown = 0;

  const COLOR_TIERS = [
    { min: 500, color: '#ffd60a' },
    { min: 100, color: '#0a84ff' },
    { min: 50,  color: '#bf5af2' },
    { min: 10,  color: '#ff9f0a' },
    { min: 0,   color: '#ff3b30' }
  ];

  function tierColor(combo) {
    for (let i = 0; i < COLOR_TIERS.length; i++) {
      if (combo >= COLOR_TIERS[i].min) return COLOR_TIERS[i].color;
    }
    return '#ff3b30';
  }

  function getSettings() {
    return (window.__powerMode.main && window.__powerMode.main.getSettings()) || {};
  }

  function ensureHud() {
    if (hudEl && hudEl.isConnected) return hudEl;
    hudEl = document.createElement('div');
    hudEl.setAttribute('data-powermode-hud', '');
    hudEl.style.cssText = [
      'position:fixed',
      'pointer-events:none',
      'z-index:2147483646',
      'transition:opacity .25s ease,transform .25s ease',
      'opacity:0',
      'transform:scale(.8)',
      'user-select:none',
      'will-change:transform,opacity',
      'left:0',
      'top:0',
      'display:flex',
      'flex-direction:column',
      'align-items:flex-start',
      'gap:4px'
    ].join(';');

    hudCountEl = document.createElement('div');
    hudCountEl.style.cssText = [
      'font:bold 32px/1 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif',
      'text-shadow:0 2px 12px rgba(0,0,0,.55),0 0 24px currentColor'
    ].join(';');
    hudEl.appendChild(hudCountEl);

    hudBarEl = document.createElement('div');
    hudBarEl.style.cssText = [
      'width:96px',
      'height:3px',
      'background:rgba(0,0,0,.5)',
      'border-radius:2px',
      'overflow:hidden',
      'box-shadow:0 0 6px rgba(0,0,0,.4)'
    ].join(';');
    hudBarFillEl = document.createElement('div');
    hudBarFillEl.style.cssText = [
      'height:100%',
      'width:100%',
      'background:currentColor',
      'transform-origin:left',
      'transition:transform .08s linear,background .15s ease'
    ].join(';');
    hudBarEl.appendChild(hudBarFillEl);
    hudEl.appendChild(hudBarEl);

    (document.documentElement || document.body).appendChild(hudEl);
    return hudEl;
  }

  function shake(intensity) {
    const settings = getSettings();
    const a11y = window.__powerMode.accessibility;
    const reduced = (a11y && a11y.prefersReducedMotion()) || settings.reducedMotion;
    if (reduced) return;
    const scale = (settings.shakeIntensity != null ? settings.shakeIntensity : 5) / 5;
    shakeAmp = Math.max(shakeAmp, intensity * scale);
  }

  function updateHUD(combo, x, y) {
    const el = ensureHud();
    if (combo < 2) {
      hideHud();
      return;
    }
    const settings = getSettings();
    const scale = settings.hudScale != null ? Math.max(0.3, Math.min(3, settings.hudScale)) : 1;
    const opacity = settings.hudOpacity != null ? Math.max(0.1, Math.min(1, settings.hudOpacity)) : 1;
    const color = tierColor(combo);
    hudCountEl.textContent = combo + 'x';
    el.style.color = color;
    const sz = Math.min(20 + combo * 0.5, 96) * scale;
    hudCountEl.style.fontSize = sz + 'px';
    // Bar width scales with HUD scale; pulse style is a little taller
    const barWidth = Math.round(80 * scale + Math.min(combo, 80));
    hudBarEl.style.width = barWidth + 'px';
    hudBarEl.style.height = (settings.comboBarStyle === 'pulse' ? 6 : 3) + 'px';
    hudBarEl.hidden = !settings.comboBar;
    hudBarFillEl.style.background = color;
    hudBarFillEl.style.transform = 'scaleX(1)';
    const w = window.innerWidth;
    const h = window.innerHeight;
    const px = Math.max(8, Math.min(w - 160, x));
    const py = Math.max(8, Math.min(h - 40, y));
    el.style.left = px + 'px';
    el.style.top = py + 'px';
    el.style.opacity = String(opacity);
    el.style.transform = 'scale(1)';
    lastComboShown = combo;
    clearTimeout(hudHideTimer);
    hudHideTimer = setTimeout(hideHud, 1200);
  }

  function updateComboBar() {
    if (!hudBarEl || !hudBarFillEl) return;
    if (!hudEl || hudEl.style.opacity === '0' || hudEl.style.opacity === '') return;
    const settings = getSettings();
    if (!settings.comboBar) {
      hudBarEl.hidden = true;
      return;
    }
    hudBarEl.hidden = false;
    const combo = window.__powerMode.combo;
    if (!combo) return;
    const count = combo.getCount();
    if (count < 2) return;
    const last = combo._getLast ? combo._getLast() : null;
    if (!last) return;
    const timeout = settings.comboTimeout || 1000;
    const elapsed = performance.now() - last.t;
    const remaining = Math.max(0, 1 - elapsed / timeout);
    hudBarFillEl.style.transform = 'scaleX(' + remaining.toFixed(3) + ')';
    // Pulse style: small extra glow as it gets low
    if (settings.comboBarStyle === 'pulse' && remaining < 0.3) {
      hudBarFillEl.style.opacity = String(0.5 + 0.5 * Math.sin(performance.now() / 120));
    } else {
      hudBarFillEl.style.opacity = '1';
    }
  }

  function hideHud() {
    if (!hudEl) return;
    hudEl.style.opacity = '0';
    hudEl.style.transform = 'scale(.8)';
  }

  function tick() {
    updateComboBar();
    if (shakeAmp < 0.1) {
      if (document.documentElement && document.documentElement.style.transform) {
        document.documentElement.style.transform = '';
      }
      if (document.body && document.body.style.boxShadow) {
        document.body.style.boxShadow = '';
      }
      shakeAmp = 0;
      return;
    }
    const dx = (Math.random() - 0.5) * shakeAmp * 2;
    const dy = (Math.random() - 0.5) * shakeAmp * 2;
    if (document.documentElement) {
      document.documentElement.style.transform = 'translate(' + dx.toFixed(2) + 'px,' + dy.toFixed(2) + 'px)';
    }
    if (document.body) {
      const shadowAlpha = Math.min(0.5, shakeAmp / 30);
      document.body.style.boxShadow = 'inset 0 0 ' + (shakeAmp * 4).toFixed(1) + 'px rgba(0,0,0,' + shadowAlpha.toFixed(2) + ')';
    }
    shakeAmp *= SHAKE_DECAY;
  }

  function reset() {
    shakeAmp = 0;
    if (document.documentElement) document.documentElement.style.transform = '';
    if (document.body) document.body.style.boxShadow = '';
    hideHud();
  }

  window.__powerMode.vfx = {
    shake: shake,
    updateHUD: updateHUD,
    tick: tick,
    hideHud: hideHud,
    reset: reset,
    _tierColor: tierColor,
    _getShakeAmp: function () { return shakeAmp; }
  };
})();
