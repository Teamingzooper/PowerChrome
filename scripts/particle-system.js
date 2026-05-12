(function () {
  window.__powerMode = window.__powerMode || {};

  const POOL_MAX = 2000;
  const POOL_INITIAL = 800;
  const GRAVITY = 0.15;
  const FRICTION = 0.985;
  const SHAPES_LIST = ['circle', 'square', 'triangle', 'star', 'diamond'];

  function makeParticle() {
    return {
      alive: false,
      x: 0, y: 0,
      vx: 0, vy: 0,
      life: 0, maxLife: 0,
      size: 0,
      color: '#ffffff',
      shape: 'circle',
      rotation: 0,
      vrot: 0,
      trail: [],
      _trailsEnabled: false
    };
  }

  const pool = [];
  for (let i = 0; i < POOL_INITIAL; i++) pool.push(makeParticle());

  function findFree() {
    for (let i = 0; i < pool.length; i++) {
      if (!pool[i].alive) return pool[i];
    }
    if (pool.length < POOL_MAX) {
      const p = makeParticle();
      pool.push(p);
      return p;
    }
    return null;
  }

  function getSettings() {
    return (window.__powerMode.main && window.__powerMode.main.getSettings()) || {};
  }

  function spawn(x, y, opts) {
    opts = opts || {};
    const settings = getSettings();
    const presets = window.__powerMode.presets;
    const preset = presets ? presets.getPreset(settings.preset || 'default') : { trails: true, shapes: SHAPES_LIST };
    const palette = opts.palette || (presets ? presets.getColorScheme(settings.colorScheme || 'rainbow') : ['#ffffff']);
    const shapesAvail = (opts.shapes && opts.shapes.length) ? opts.shapes : ((preset.shapes && preset.shapes.length) ? preset.shapes : SHAPES_LIST);
    const combo = opts.combo || 0;
    const perf = window.__powerMode.perf;
    let count = opts.count != null ? opts.count : ((settings.particleCount != null ? settings.particleCount : 12) + Math.min(combo / 5, 20));
    if (perf && perf.shouldThrottle()) count = Math.floor(count * 0.5);
    if (count <= 0) return 0;

    const baseSize = opts.baseSize || 4;
    const sizeMul = 1 + Math.log10(1 + combo) * 0.3;
    const speed = opts.speed != null ? opts.speed : (3 + Math.min(combo / 20, 6));
    const life = opts.life || 800;
    const trails = opts.trails != null ? opts.trails : (preset.trails && !(perf && perf.shouldThrottle()));
    const angleBase = opts.angle != null ? opts.angle : null;

    let spawned = 0;
    for (let i = 0; i < count; i++) {
      const p = findFree();
      if (!p) break;
      const angle = angleBase != null ? angleBase + (Math.random() - 0.5) * 0.6 : Math.random() * Math.PI * 2;
      const sp = speed * (0.5 + Math.random());
      p.alive = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * sp + (opts.vxBias || 0);
      p.vy = Math.sin(angle) * sp + (opts.vyBias || 0);
      p.maxLife = life * (0.7 + Math.random() * 0.6);
      p.life = p.maxLife;
      p.size = (baseSize * sizeMul) * (0.7 + Math.random() * 0.6);
      p.color = palette[Math.floor(Math.random() * palette.length)] || '#ffffff';
      p.shape = shapesAvail[Math.floor(Math.random() * shapesAvail.length)] || 'circle';
      p.rotation = Math.random() * Math.PI * 2;
      p.vrot = (Math.random() - 0.5) * 0.2;
      p.trail.length = 0;
      p._trailsEnabled = !!trails;
      spawned++;
    }
    return spawned;
  }

  function update(dt) {
    if (!dt || dt <= 0) return;
    const settings = getSettings();
    const a11y = window.__powerMode.accessibility;
    const reduced = (a11y && a11y.prefersReducedMotion()) || settings.reducedMotion;
    const dtScale = dt / 16.67;
    const w = (typeof innerWidth !== 'undefined') ? innerWidth : 1920;
    const h = (typeof innerHeight !== 'undefined') ? innerHeight : 1080;

    for (let i = 0; i < pool.length; i++) {
      const p = pool[i];
      if (!p.alive) continue;
      if (!reduced) {
        if (p._trailsEnabled) {
          p.trail.push(p.x, p.y);
          if (p.trail.length > 8) p.trail.splice(0, p.trail.length - 8);
        }
        p.vy += GRAVITY * dtScale;
        p.vx *= Math.pow(FRICTION, dtScale);
        p.vy *= Math.pow(FRICTION, dtScale);
        p.x += p.vx * dtScale;
        p.y += p.vy * dtScale;
        p.rotation += p.vrot * dtScale;
      }
      p.life -= dt;
      if (p.life <= 0 || p.x < -80 || p.x > w + 80 || p.y > h + 80) {
        p.alive = false;
      }
    }
  }

  function render(ctx) {
    const shapes = window.__powerMode.shapes;
    if (!shapes) return;
    for (let i = 0; i < pool.length; i++) {
      const p = pool[i];
      if (!p.alive) continue;
      if (p._trailsEnabled && p.trail.length >= 4) {
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(1, p.size * 0.4);
        ctx.beginPath();
        ctx.moveTo(p.trail[0], p.trail[1]);
        for (let k = 2; k < p.trail.length; k += 2) ctx.lineTo(p.trail[k], p.trail[k + 1]);
        ctx.stroke();
      }
      (shapes[p.shape] || shapes.circle)(ctx, p);
    }
    ctx.globalAlpha = 1;
  }

  function getAliveCount() {
    let n = 0;
    for (let i = 0; i < pool.length; i++) if (pool[i].alive) n++;
    return n;
  }

  function clear() {
    for (let i = 0; i < pool.length; i++) pool[i].alive = false;
  }

  window.__powerMode.particles = {
    spawn: spawn,
    update: update,
    render: render,
    clear: clear,
    getAliveCount: getAliveCount,
    _pool: pool,
    _config: { POOL_MAX: POOL_MAX, POOL_INITIAL: POOL_INITIAL, GRAVITY: GRAVITY, FRICTION: FRICTION }
  };
})();
