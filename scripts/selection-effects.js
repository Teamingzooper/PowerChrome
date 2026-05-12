(function () {
  window.__powerMode = window.__powerMode || {};

  const COPY_PALETTE  = ['#00d4ff', '#5ac8fa', '#34c7ff', '#7c5cff', '#a5f3fc'];
  const CUT_PALETTE   = ['#ffd60a', '#ff9f0a', '#ff6347', '#ff3b30', '#ff4d6d'];
  const DELETE_SEL_PALETTE = ['#7a0a0a', '#a01818', '#c52828', '#e85555', '#ff7575'];

  function getSettings() {
    return (window.__powerMode.main && window.__powerMode.main.getSettings()) || {};
  }

  function getSelectionLength(target) {
    if (!target) target = document.activeElement;
    if (!target) return 0;
    const tag = (target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') {
      const s = target.selectionStart;
      const e = target.selectionEnd;
      if (s == null || e == null) return 0;
      return Math.max(0, e - s);
    }
    try {
      const sel = window.getSelection();
      return sel ? sel.toString().length : 0;
    } catch (e) { return 0; }
  }

  function selectionRect(target) {
    if (!target) target = document.activeElement;
    const tag = target && (target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') {
      const r = target.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
    }
    try {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const r = range.getBoundingClientRect();
        if (r && (r.width || r.height || r.left || r.top)) {
          return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
        }
      }
    } catch (e) { /* ignore */ }
    if (target) {
      const r = target.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
    }
    return { x: window.innerWidth / 2, y: window.innerHeight / 2, w: 0, h: 0 };
  }

  function spawnAlongRect(rect, opts) {
    const particles = window.__powerMode.particles;
    if (!particles) return;
    const count = opts.count || 24;
    const palette = opts.palette || ['#ffffff'];
    const w = Math.max(8, rect.w);
    for (let i = 0; i < count; i++) {
      const t = count <= 1 ? 0.5 : i / (count - 1);
      const x = rect.x - w / 2 + t * w + (Math.random() - 0.5) * 20;
      const y = rect.y + (Math.random() - 0.5) * Math.max(8, rect.h);
      particles.spawn(x, y, {
        count: 1,
        angle: opts.angle != null ? opts.angle : (-Math.PI / 2 + (Math.random() - 0.5) * 0.6),
        speed: opts.speed || (4 + Math.random() * 4),
        baseSize: opts.baseSize || 4,
        life: opts.life || 900,
        palette: palette
      });
    }
  }

  function spawnImplodingAround(rect, opts) {
    const particles = window.__powerMode.particles;
    if (!particles) return;
    const count = opts.count || 20;
    const palette = opts.palette || DELETE_SEL_PALETTE;
    const cx = rect.x;
    const cy = rect.y;
    const radius = Math.max(40, Math.min(200, rect.w * 0.6 + 30));
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const r = radius + Math.random() * 20;
      const sx = cx + Math.cos(a) * r;
      const sy = cy + Math.sin(a) * r;
      const toward = Math.atan2(cy - sy, cx - sx);
      const speed = 4 + Math.random() * 3;
      particles.spawn(sx, sy, {
        count: 1,
        angle: toward,
        speed: speed,
        baseSize: opts.baseSize || 4,
        life: opts.life || 700,
        palette: palette
      });
      // Manually force inward by overriding the just-spawned particle's flags
      const pool = particles._pool;
      const last = pool[pool.length - 1] || (function () {
        // find newest alive particle
        for (let k = pool.length - 1; k >= 0; k--) if (pool[k].alive) return pool[k];
        return null;
      })();
      if (last) last._implode = true;
    }
  }

  function onCopy(e) {
    const settings = getSettings();
    if (!settings.enabled || !settings.selectionEffects) return;
    const target = e.target;
    if (!target) return;
    const len = getSelectionLength(target);
    if (len <= 0) return;
    const rect = selectionRect(target);
    const count = Math.min(40, 12 + Math.floor(len / 4));
    spawnAlongRect(rect, {
      count: count,
      palette: COPY_PALETTE,
      angle: -Math.PI / 2,
      speed: 6,
      life: 900
    });
    if (window.__powerMode.vfx) window.__powerMode.vfx.shake(2);
    if (settings.soundEnabled && window.__powerMode.sfx) {
      window.__powerMode.sfx.playArpeggio(0); // soft ascending chime
    }
    if (window.__powerMode.debug) {
      window.__powerMode.debug.log('copy', len + ' chars');
    }
  }

  function onCut(e) {
    const settings = getSettings();
    if (!settings.enabled || !settings.selectionEffects) return;
    const target = e.target;
    if (!target) return;
    const len = getSelectionLength(target);
    if (len <= 0) return;
    const rect = selectionRect(target);
    // Hybrid: upward celebratory + brief implode flash
    const upCount = Math.min(30, 10 + Math.floor(len / 5));
    spawnAlongRect(rect, {
      count: upCount,
      palette: CUT_PALETTE,
      angle: -Math.PI / 2,
      speed: 7,
      life: 800
    });
    spawnImplodingAround(rect, {
      count: Math.min(18, 8 + Math.floor(len / 6)),
      palette: DELETE_SEL_PALETTE,
      baseSize: 3,
      life: 550
    });
    if (window.__powerMode.vfx) window.__powerMode.vfx.shake(4);
    if (settings.soundEnabled && window.__powerMode.sfx) {
      window.__powerMode.sfx.play('Backspace', 0);
    }
    if (window.__powerMode.debug) {
      window.__powerMode.debug.log('cut', len + ' chars');
    }
  }

  /* Called by main.js when Backspace/Delete fires with a non-zero selection. */
  function onSelectionDelete(target, len) {
    const settings = getSettings();
    if (!settings.selectionEffects) return;
    const rect = selectionRect(target);
    const count = Math.min(60, 14 + Math.floor(len / 3));
    spawnImplodingAround(rect, {
      count: count,
      palette: DELETE_SEL_PALETTE,
      baseSize: 3 + Math.min(3, len / 20),
      life: 600 + Math.min(400, len * 4)
    });
    if (window.__powerMode.vfx) {
      const intensity = 3 + Math.min(12, len / 5);
      window.__powerMode.vfx.shake(intensity);
    }
    if (settings.soundEnabled && window.__powerMode.sfx) {
      window.__powerMode.sfx.play('Backspace', 0);
    }
    if (window.__powerMode.debug) {
      window.__powerMode.debug.log('select-delete', len + ' chars');
    }
  }

  function onClick(e) {
    const settings = getSettings();
    if (!settings.enabled || !settings.clickEffects) return;
    if (!window.__powerMode.particles) return;
    const presets = window.__powerMode.presets;
    const palette = presets ? presets.getColorScheme(settings.colorScheme || 'rainbow') : ['#ffffff'];
    window.__powerMode.particles.spawn(e.clientX, e.clientY, {
      count: 6,
      palette: palette,
      speed: 4,
      baseSize: 3,
      life: 500
    });
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('copy', onCopy, true);
    document.addEventListener('cut', onCut, true);
    document.addEventListener('click', onClick, true);
  }

  window.__powerMode.selectionFx = {
    _getSelectionLength: getSelectionLength,
    _selectionRect: selectionRect,
    onSelectionDelete: onSelectionDelete,
    _COPY_PALETTE: COPY_PALETTE,
    _CUT_PALETTE: CUT_PALETTE,
    _DELETE_SEL_PALETTE: DELETE_SEL_PALETTE
  };
})();
