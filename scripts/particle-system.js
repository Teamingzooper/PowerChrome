(function () {
  window.__powerMode = window.__powerMode || {};

  const POOL_MAX = 2000;
  const POOL_INITIAL = 800;
  const DEFAULT_GRAVITY = 0.15;
  const DEFAULT_FRICTION = 0.985;
  const SHAPES_LIST = ['circle', 'square', 'triangle', 'star', 'diamond'];
  const DELETE_PALETTE = ['#2a0606', '#5a1010', '#8a1f1f', '#b73838', '#e85555', '#ff7575'];

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
      _trailsEnabled: false,
      _implode: false
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

  function generateAngle(direction) {
    const r = Math.random();
    switch (direction) {
      case 'up':
        return -Math.PI / 2 + (r - 0.5) * (2 * Math.PI / 3);
      case 'down':
        return Math.PI / 2 + (r - 0.5) * (2 * Math.PI / 3);
      case 'coneUp':
        return -Math.PI / 2 + (r - 0.5) * (Math.PI / 3);
      case 'coneDown':
        return Math.PI / 2 + (r - 0.5) * (Math.PI / 3);
      case 'side': {
        const side = Math.random() < 0.5 ? 0 : Math.PI;
        return side + (r - 0.5) * (Math.PI / 4);
      }
      case 'radial':
      default:
        return r * Math.PI * 2;
    }
  }

  function filterShapes(presetShapes, enabledShapes) {
    const base = (presetShapes && presetShapes.length) ? presetShapes : SHAPES_LIST;
    if (!enabledShapes) return base;
    const filtered = [];
    for (let i = 0; i < base.length; i++) {
      if (enabledShapes[base[i]] !== false) filtered.push(base[i]);
    }
    return filtered.length ? filtered : ['circle'];
  }

  function spawnDelete(x, y, settings, perf) {
    const baseCount = Math.max(6, Math.min(14, (settings.particleCount || 12)));
    let count = baseCount;
    if (perf && perf.shouldThrottle()) count = Math.floor(count * 0.5);
    if (count <= 0) return 0;
    const ringRadius = 24;
    const lifeMul = settings.particleLifeMul || 1.0;
    let spawned = 0;
    for (let i = 0; i < count; i++) {
      const p = findFree();
      if (!p) break;
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const r = ringRadius + Math.random() * 14;
      const sx = x + Math.cos(angle) * r;
      const sy = y + Math.sin(angle) * r;
      const speed = 2.5 + Math.random() * 2;
      const towardAngle = Math.atan2(y - sy, x - sx);
      p.alive = true;
      p.x = sx;
      p.y = sy;
      p.vx = Math.cos(towardAngle) * speed;
      p.vy = Math.sin(towardAngle) * speed;
      p.maxLife = (350 + Math.random() * 200) * lifeMul;
      p.life = p.maxLife;
      p.size = 3 + Math.random() * 2;
      p.color = DELETE_PALETTE[Math.floor(Math.random() * DELETE_PALETTE.length)];
      p.shape = Math.random() < 0.5 ? 'square' : 'diamond';
      p.rotation = Math.random() * Math.PI * 2;
      p.vrot = (Math.random() - 0.5) * 0.3;
      p.trail.length = 0;
      p._trailsEnabled = false;
      p._implode = true;
      spawned++;
    }
    return spawned;
  }

  function spawn(x, y, opts) {
    opts = opts || {};
    const settings = getSettings();
    const perf = window.__powerMode.perf;

    if (opts.deleteMode) return spawnDelete(x, y, settings, perf);

    const presets = window.__powerMode.presets;
    const preset = presets ? presets.getPreset(settings.preset || 'default') : { trails: true, shapes: SHAPES_LIST };
    const palette = opts.palette || (presets ? presets.getColorScheme(settings.colorScheme || 'rainbow') : ['#ffffff']);
    const enabledShapes = settings.enabledShapes;
    const shapesAvail = (opts.shapes && opts.shapes.length) ? opts.shapes : filterShapes(preset.shapes, enabledShapes);
    const combo = opts.combo || 0;

    let count = opts.count != null ? opts.count : ((settings.particleCount != null ? settings.particleCount : 12) + Math.min(combo / 5, 20));
    if (perf && perf.shouldThrottle()) count = Math.floor(count * 0.5);
    if (count <= 0) return 0;

    const baseSize = opts.baseSize || 4;
    const sizeMul = 1 + Math.log10(1 + combo) * 0.3;
    const speed = opts.speed != null ? opts.speed : (3 + Math.min(combo / 20, 6));
    const lifeMul = settings.particleLifeMul || 1.0;
    const life = (opts.life || 800) * lifeMul;
    const trails = opts.trails != null ? opts.trails : (preset.trails && !(perf && perf.shouldThrottle()));
    const angleBase = opts.angle != null ? opts.angle : null;
    const userTriggered = !!opts.userTriggered;

    const offX = userTriggered ? (settings.spawnOffsetX || 0) : 0;
    const offY = userTriggered ? (settings.spawnOffsetY || 0) : 0;
    const jitter = userTriggered ? Math.max(0, settings.spawnJitter || 0) : 0;
    const direction = userTriggered ? (settings.spawnDirection || 'radial') : 'radial';

    let spawned = 0;
    for (let i = 0; i < count; i++) {
      const p = findFree();
      if (!p) break;
      let angle;
      if (angleBase != null) {
        angle = angleBase + (Math.random() - 0.5) * 0.6;
      } else if (userTriggered) {
        angle = generateAngle(direction);
      } else {
        angle = Math.random() * Math.PI * 2;
      }
      const sp = speed * (0.5 + Math.random());
      const jx = jitter ? (Math.random() - 0.5) * 2 * jitter : 0;
      const jy = jitter ? (Math.random() - 0.5) * 2 * jitter : 0;
      p.alive = true;
      p.x = x + offX + jx;
      p.y = y + offY + jy;
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
      p._implode = false;
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
    const gravity = (settings.gravity != null) ? settings.gravity : DEFAULT_GRAVITY;
    const friction = (settings.friction != null) ? settings.friction : DEFAULT_FRICTION;
    const w = (typeof innerWidth !== 'undefined') ? innerWidth : 1920;
    const h = (typeof innerHeight !== 'undefined') ? innerHeight : 1080;

    for (let i = 0; i < pool.length; i++) {
      const p = pool[i];
      if (!p.alive) continue;
      if (!reduced) {
        if (p._trailsEnabled) {
          const trailLen = Math.max(0, Math.min(12, settings.trailLength != null ? settings.trailLength : 4));
          if (trailLen > 0) {
            p.trail.push(p.x, p.y);
            const cap = trailLen * 2; // each segment uses 2 entries
            if (p.trail.length > cap) p.trail.splice(0, p.trail.length - cap);
          } else {
            p.trail.length = 0;
          }
        }
        // Imploding particles ignore gravity and decay faster on velocity
        if (p._implode) {
          p.vx *= Math.pow(0.96, dtScale);
          p.vy *= Math.pow(0.96, dtScale);
        } else {
          p.vy += gravity * dtScale;
          p.vx *= Math.pow(friction, dtScale);
          p.vy *= Math.pow(friction, dtScale);
        }
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
    _config: { POOL_MAX: POOL_MAX, POOL_INITIAL: POOL_INITIAL, DEFAULT_GRAVITY: DEFAULT_GRAVITY, DEFAULT_FRICTION: DEFAULT_FRICTION },
    _generateAngle: generateAngle,
    _filterShapes: filterShapes,
    _DELETE_PALETTE: DELETE_PALETTE
  };
})();
