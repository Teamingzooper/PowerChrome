(function () {
  window.__powerMode = window.__powerMode || {};

  let count = 0;
  let lastKeyAt = 0;
  let lastX = 0;
  let lastY = 0;
  const firedThisRun = new Set();

  // Default milestone slots — name → { tier, defaultAt, defaultEffect }
  const SLOT_DEFAULTS = {
    fireworks: { tier: 1, at: 10,   effect: 'fireworks' },
    galaxy:    { tier: 2, at: 20,   effect: 'galaxy' },
    tornado:   { tier: 3, at: 50,   effect: 'tornado' },
    supernova: { tier: 4, at: 100,  effect: 'supernova' },
    blackhole: { tier: 5, at: 200,  effect: 'blackhole' },
    bigbang:   { tier: 6, at: 500,  effect: 'bigbang' },
    universe:  { tier: 7, at: 1000, effect: 'universe' }
  };
  const SLOT_NAMES = ['fireworks', 'galaxy', 'tornado', 'supernova', 'blackhole', 'bigbang', 'universe'];
  const EFFECT_NAMES = SLOT_NAMES.slice();

  function getSettings() {
    return (window.__powerMode.main && window.__powerMode.main.getSettings()) || {};
  }

  function getMilestoneList() {
    const settings = getSettings();
    const cfg = settings.milestones || {};
    const out = [];
    for (let i = 0; i < SLOT_NAMES.length; i++) {
      const name = SLOT_NAMES[i];
      const def = SLOT_DEFAULTS[name];
      const s = cfg[name] || {};
      const enabled = s.enabled !== false;
      const at = (typeof s.at === 'number' && s.at > 0) ? Math.floor(s.at) : def.at;
      const effect = EFFECT_NAMES.indexOf(s.effect) >= 0 ? s.effect : def.effect;
      out.push({ name: name, tier: def.tier, at: at, effect: effect, enabled: enabled });
    }
    out.sort(function (a, b) { return a.at - b.at; });
    return out;
  }

  function reset() {
    count = 0;
    firedThisRun.clear();
  }

  function register(x, y, opts) {
    opts = opts || {};
    const settings = getSettings();
    const timeout = settings.comboTimeout || 1000;
    const now = performance.now();
    if (now - lastKeyAt > timeout) reset();
    lastKeyAt = now;
    lastX = x;
    lastY = y;
    if (opts.noIncrement) return count;
    count++;
    const milestones = getMilestoneList();
    for (let i = 0; i < milestones.length; i++) {
      const m = milestones[i];
      if (!m.enabled) continue;
      if (count === m.at && !firedThisRun.has(m.name)) {
        firedThisRun.add(m.name);
        runEffect(m.effect, m.tier, x, y);
      }
    }
    return count;
  }

  function runEffect(effectName, tier, x, y) {
    const particles = window.__powerMode.particles;
    const presets = window.__powerMode.presets;
    const sfx = window.__powerMode.sfx;
    const vfx = window.__powerMode.vfx;
    const a11y = window.__powerMode.accessibility;
    const settings = getSettings();
    const palette = presets ? presets.getColorScheme(settings.colorScheme || 'rainbow') : ['#ffffff'];
    if (sfx && settings.soundEnabled !== false) sfx.playArpeggio(tier);
    if (!particles) return;

    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const reduced = (a11y && a11y.prefersReducedMotion()) || settings.reducedMotion;
    if (reduced) {
      particles.spawn(cx, cy, { count: 30, palette: palette, speed: 1, baseSize: 6, life: 400, trails: false });
      return;
    }
    if (vfx) vfx.shake(20 + tier * 5);

    switch (effectName) {
      case 'fireworks':
        for (let i = 0; i < 5; i++) {
          (function (idx) {
            setTimeout(function () {
              particles.spawn(
                Math.random() * window.innerWidth,
                window.innerHeight * 0.3 + Math.random() * window.innerHeight * 0.3,
                { count: 40, baseSize: 5, speed: 8, palette: palette, life: 1200 }
              );
            }, idx * 120);
          })(i);
        }
        break;
      case 'galaxy':
        for (let i = 0; i < 80; i++) {
          const a = (i / 80) * Math.PI * 2 * 3;
          const r = 50 + i * 4;
          particles.spawn(cx + Math.cos(a) * r, cy + Math.sin(a) * r, {
            count: 1, angle: a + Math.PI / 2, speed: 5, baseSize: 4, palette: palette, life: 1600
          });
        }
        break;
      case 'tornado':
        for (let i = 0; i < 200; i++) {
          const py = window.innerHeight - i * (window.innerHeight / 200);
          const a = i * 0.3;
          particles.spawn(cx + Math.cos(a) * (i * 0.6), py, {
            count: 1, angle: a, speed: 4 + i * 0.02, baseSize: 5, palette: palette, life: 1400
          });
        }
        break;
      case 'supernova':
        particles.spawn(cx, cy, { count: 400, baseSize: 8, speed: 14, palette: palette, life: 1600 });
        break;
      case 'blackhole':
        for (let i = 0; i < 200; i++) {
          const a = Math.random() * Math.PI * 2;
          const r = 400 + Math.random() * 200;
          const px = cx + Math.cos(a) * r;
          const py2 = cy + Math.sin(a) * r;
          const towardA = Math.atan2(cy - py2, cx - px);
          particles.spawn(px, py2, { count: 1, angle: towardA, speed: 12, baseSize: 6, palette: palette, life: 1500 });
        }
        break;
      case 'bigbang':
        particles.spawn(cx, cy, { count: 800, baseSize: 10, speed: 22, palette: palette, life: 2200 });
        if (vfx) vfx.shake(60);
        break;
      case 'universe':
        for (let r = 0; r < 8; r++) {
          (function (idx) {
            setTimeout(function () {
              particles.spawn(
                Math.random() * window.innerWidth,
                Math.random() * window.innerHeight,
                { count: 200, baseSize: 9, speed: 18, palette: palette, life: 1800 }
              );
            }, idx * 200);
          })(r);
        }
        if (vfx) vfx.shake(80);
        break;
    }
  }

  function tick() {
    const settings = getSettings();
    const timeout = settings.comboTimeout || 1000;
    if (count > 0 && performance.now() - lastKeyAt > timeout) reset();
  }

  window.__powerMode.combo = {
    register: register,
    getCount: function () { return count; },
    reset: reset,
    tick: tick,
    _getMilestones: getMilestoneList,
    _firedThisRun: firedThisRun,
    _SLOT_DEFAULTS: SLOT_DEFAULTS,
    _SLOT_NAMES: SLOT_NAMES,
    _EFFECT_NAMES: EFFECT_NAMES,
    _runEffect: runEffect,
    _getLast: function () { return { x: lastX, y: lastY, t: lastKeyAt }; }
  };
})();
