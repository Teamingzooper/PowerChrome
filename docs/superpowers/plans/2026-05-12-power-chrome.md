# PowerChrome Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome Manifest V3 extension that adds Activate Power Mode (particles, shake, combo, bitcrushed audio, milestones) to any text input on the web, with full customization and accessibility, and push it to `Teamingzooper/PowerChrome` replacing existing contents.

**Architecture:** All content scripts loaded directly via manifest (no bundler). Each module is an IIFE attaching to `window.__powerMode`. A single full-viewport `<canvas>` renders all particles; a separate `<div>` is the combo HUD. Background service worker mediates settings between popup and tabs. In-browser test harness verifies pure-logic modules.

**Tech Stack:** Vanilla JavaScript (ES2020), HTML, CSS, Canvas2D + optional WebGL2, Web Audio API + AudioWorklet/ScriptProcessor bitcrusher, chrome.storage.local, chrome.tabs.sendMessage. Zero npm dependencies.

---

## File map

| Path | Purpose |
|---|---|
| `manifest.json` | MV3 manifest, lists content scripts in load order, declares commands |
| `background.js` | Service worker — seeds defaults, relays settings, handles commands |
| `content.js` | Content-script entry — invokes `__powerMode.main.init()` |
| `scripts/accessibility.js` | OS hint detection (reduced motion, high contrast) |
| `scripts/effect-presets.js` | Visual presets, color schemes, sound packs (data) |
| `scripts/performance-monitor.js` | FPS sampling, memory estimate, throttle logic |
| `scripts/custom-particles.js` | Shape draw functions (circle/square/triangle/star/diamond) |
| `scripts/particle-system.js` | Pool, physics, render dispatch |
| `scripts/webgl-renderer.js` | Optional WebGL2 renderer (point sprites) |
| `scripts/visual-effects.js` | Screen shake + combo HUD |
| `scripts/sound-effects-enhanced.js` | Web Audio voices + bitcrusher + packs |
| `scripts/combo-milestones.js` | Combo tracker + milestone spawn patterns |
| `scripts/ml-personalization.js` | Per-context preference learning |
| `scripts/keyboard-shortcuts.js` | In-page Ctrl+Shift+P/S handlers |
| `scripts/main.js` | Wires all modules, owns the overlay canvas + rAF loop |
| `popup.html` | Settings UI markup |
| `popup.css` | Settings UI styling |
| `popup.js` | Settings UI behavior |
| `icons/icon{16,48,128}.png` | Extension icons (hand-generated) |
| `test/test-runner.html` | In-browser test harness |
| `README.md` | Install + features |

---

### Task 1: Repo scaffolding & manifest

**Files:**
- Create: `/Users/michaelsilverstein/powerChrome/manifest.json`

- [ ] **Step 1: Write manifest.json with all content scripts listed in dependency order**

```json
{
  "manifest_version": 3,
  "name": "PowerChrome — Activate Power Mode",
  "version": "1.0.0",
  "description": "Explosive particles, screen shake, combos, and bitcrushed audio in every text box.",
  "permissions": ["activeTab", "storage", "tabs"],
  "action": {
    "default_popup": "popup.html",
    "default_icon": { "16": "icons/icon16.png", "48": "icons/icon48.png", "128": "icons/icon128.png" }
  },
  "icons": { "16": "icons/icon16.png", "48": "icons/icon48.png", "128": "icons/icon128.png" },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": [
      "scripts/accessibility.js",
      "scripts/effect-presets.js",
      "scripts/performance-monitor.js",
      "scripts/custom-particles.js",
      "scripts/particle-system.js",
      "scripts/webgl-renderer.js",
      "scripts/visual-effects.js",
      "scripts/sound-effects-enhanced.js",
      "scripts/combo-milestones.js",
      "scripts/ml-personalization.js",
      "scripts/keyboard-shortcuts.js",
      "scripts/main.js",
      "content.js"
    ],
    "run_at": "document_end",
    "all_frames": false
  }],
  "background": { "service_worker": "background.js" },
  "commands": {
    "toggle-power-mode": {
      "suggested_key": { "default": "Ctrl+Shift+P" },
      "description": "Toggle PowerChrome on/off"
    },
    "toggle-sound": {
      "suggested_key": { "default": "Ctrl+Shift+S" },
      "description": "Toggle PowerChrome sound effects"
    }
  }
}
```

**Verify:** `python3 -c "import json; json.load(open('/Users/michaelsilverstein/powerChrome/manifest.json'))"` exits 0.

---

### Task 2: Generate icon PNGs

**Files:**
- Create (temporarily): `/Users/michaelsilverstein/powerChrome/.tmp-gen-icons.js`
- Create (committed): `icons/icon16.png`, `icons/icon48.png`, `icons/icon128.png`

- [ ] **Step 1: Write zero-dep Node PNG generator using `zlib` + `crypto`**

Generator emits a stylized lightning bolt on a gradient background. Uses only Node built-ins. After run, delete the generator.

- [ ] **Step 2: Run `node .tmp-gen-icons.js`, verify 3 PNGs exist, delete the generator**

```bash
cd /Users/michaelsilverstein/powerChrome && node .tmp-gen-icons.js
ls -la icons/
rm .tmp-gen-icons.js
```

**Verify:** `file icons/icon16.png` reports `PNG image data, 16 x 16`.

---

### Task 3: accessibility.js

**Files:**
- Create: `scripts/accessibility.js`

Module exports `{ prefersReducedMotion, prefersHighContrast, onChange }`. Wraps `matchMedia` and notifies subscribers when OS preference changes.

- [ ] **Step 1: Write module as IIFE attaching to `window.__powerMode.accessibility`**

```js
(function () {
  window.__powerMode = window.__powerMode || {};
  const subs = [];
  const motionMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  const contrastMQ = window.matchMedia('(prefers-contrast: more)');
  const fire = () => subs.forEach(cb => { try { cb(); } catch (e) { console.error(e); } });
  motionMQ.addEventListener('change', fire);
  contrastMQ.addEventListener('change', fire);
  window.__powerMode.accessibility = {
    prefersReducedMotion: () => motionMQ.matches,
    prefersHighContrast: () => contrastMQ.matches,
    onChange: (cb) => { subs.push(cb); return () => subs.splice(subs.indexOf(cb), 1); }
  };
})();
```

---

### Task 4: effect-presets.js

**Files:**
- Create: `scripts/effect-presets.js`

Exports `getPreset(name)`, `getColorScheme(name)`, `getSoundPack(name)`, `LIST`.

- [ ] **Step 1: Define data + accessors**

```js
(function () {
  window.__powerMode = window.__powerMode || {};
  const PRESETS = {
    default:  { particleCount: 12, shakeIntensity: 5,  trails: true,  shapes: ['circle','square','triangle','star','diamond'] },
    subtle:   { particleCount: 5,  shakeIntensity: 1,  trails: false, shapes: ['circle'] },
    intense:  { particleCount: 30, shakeIntensity: 10, trails: true,  shapes: ['star','diamond','triangle'] },
    retro:    { particleCount: 10, shakeIntensity: 6,  trails: false, shapes: ['square'] },
    minimal:  { particleCount: 0,  shakeIntensity: 0,  trails: false, shapes: [] }
  };
  const SCHEMES = {
    rainbow:   ['#ff3b30','#ff9500','#ffcc00','#34c759','#5ac8fa','#007aff','#af52de'],
    pastel:    ['#ffd1dc','#ffe4b5','#fffacd','#e0ffff','#e6e6fa','#d8bfd8','#f0e68c'],
    neon:      ['#ff006e','#fb5607','#ffbe0b','#8338ec','#3a86ff','#06ffa5','#ff4081'],
    monochrome:['#ffffff','#dddddd','#bbbbbb','#999999','#777777','#555555'],
    fire:      ['#ffeb3b','#ff9800','#ff5722','#f44336','#d32f2f','#b71c1c'],
    ocean:     ['#03a9f4','#00bcd4','#009688','#3f51b5','#1976d2','#0d47a1']
  };
  const PACKS = {
    default: { waveform: 'sine',     bitcrushAmount: 0.4, attack: 0.005, decay: 0.18, gainScale: 0.30 },
    arcade:  { waveform: 'square',   bitcrushAmount: 0.6, attack: 0.002, decay: 0.10, gainScale: 0.25 },
    synth:   { waveform: 'sawtooth', bitcrushAmount: 0.2, attack: 0.010, decay: 0.40, gainScale: 0.22 },
    retro:   { waveform: 'triangle', bitcrushAmount: 0.8, attack: 0.001, decay: 0.08, gainScale: 0.28 }
  };
  window.__powerMode.presets = {
    getPreset: (n) => PRESETS[n] || PRESETS.default,
    getColorScheme: (n) => SCHEMES[n] || SCHEMES.rainbow,
    getSoundPack: (n) => PACKS[n] || PACKS.default,
    LIST: { presets: Object.keys(PRESETS), schemes: Object.keys(SCHEMES), packs: Object.keys(PACKS) }
  };
})();
```

---

### Task 5: performance-monitor.js

**Files:**
- Create: `scripts/performance-monitor.js`

Exposes `tick()`, `getStats()`, `shouldThrottle()`.

- [ ] **Step 1: Rolling-window FPS sampler with throttle threshold**

```js
(function () {
  window.__powerMode = window.__powerMode || {};
  const WINDOW_SIZE = 60;
  const frameTimes = [];
  let lastTick = performance.now();
  let lowFpsStartedAt = null;
  let throttling = false;

  function tick() {
    const now = performance.now();
    const dt = now - lastTick;
    lastTick = now;
    frameTimes.push(dt);
    if (frameTimes.length > WINDOW_SIZE) frameTimes.shift();
    const avgDt = frameTimes.reduce((s, v) => s + v, 0) / frameTimes.length;
    const fps = avgDt > 0 ? 1000 / avgDt : 60;
    if (fps < 30) {
      lowFpsStartedAt = lowFpsStartedAt || now;
      if (now - lowFpsStartedAt > 2000) throttling = true;
    } else {
      lowFpsStartedAt = null;
      throttling = false;
    }
  }

  function getStats() {
    const avgDt = frameTimes.length ? frameTimes.reduce((s, v) => s + v, 0) / frameTimes.length : 16.67;
    const aliveParticles = (window.__powerMode.particles && window.__powerMode.particles.getAliveCount()) || 0;
    return {
      fps: Math.round(1000 / avgDt),
      memoryBytes: aliveParticles * 256,
      throttling
    };
  }
  window.__powerMode.perf = { tick, getStats, shouldThrottle: () => throttling };
})();
```

---

### Task 6: custom-particles.js

**Files:**
- Create: `scripts/custom-particles.js`

Map of `{circle, square, triangle, star, diamond}` → draw functions.

- [ ] **Step 1: Implement shape drawers**

```js
(function () {
  window.__powerMode = window.__powerMode || {};
  function setStyle(ctx, p) {
    const alpha = Math.max(0, Math.min(1, p.life / p.maxLife));
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.strokeStyle = p.color;
  }
  const shapes = {
    circle(ctx, p) {
      setStyle(ctx, p);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    },
    square(ctx, p) {
      setStyle(ctx, p);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillRect(-p.size, -p.size, p.size * 2, p.size * 2);
      ctx.restore();
    },
    triangle(ctx, p) {
      setStyle(ctx, p);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.beginPath();
      ctx.moveTo(0, -p.size);
      ctx.lineTo(p.size, p.size);
      ctx.lineTo(-p.size, p.size);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    },
    star(ctx, p) {
      setStyle(ctx, p);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.beginPath();
      const spikes = 5, outer = p.size, inner = p.size * 0.4;
      for (let i = 0; i < spikes * 2; i++) {
        const r = i % 2 === 0 ? outer : inner;
        const a = (i * Math.PI) / spikes - Math.PI / 2;
        const x = Math.cos(a) * r, y = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    },
    diamond(ctx, p) {
      setStyle(ctx, p);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation + Math.PI / 4);
      ctx.fillRect(-p.size, -p.size, p.size * 2, p.size * 2);
      ctx.restore();
    }
  };
  window.__powerMode.shapes = shapes;
})();
```

---

### Task 7: particle-system.js

**Files:**
- Create: `scripts/particle-system.js`

Pool of particles, physics update, render via shapes or webgl renderer.

- [ ] **Step 1: Implement pool + spawn + update + render**

```js
(function () {
  window.__powerMode = window.__powerMode || {};
  const POOL_MAX = 2000;
  const POOL_INITIAL = 800;
  const GRAVITY = 0.15;
  const FRICTION = 0.985;
  const SHAPES_LIST = ['circle','square','triangle','star','diamond'];

  function makeParticle() {
    return {
      alive: false,
      x: 0, y: 0, vx: 0, vy: 0,
      life: 0, maxLife: 0, size: 0,
      color: '#fff', shape: 'circle',
      rotation: 0, vrot: 0,
      trail: []
    };
  }
  const pool = Array.from({ length: POOL_INITIAL }, makeParticle);

  function findFree() {
    for (let i = 0; i < pool.length; i++) if (!pool[i].alive) return pool[i];
    if (pool.length < POOL_MAX) {
      const p = makeParticle();
      pool.push(p);
      return p;
    }
    return null;
  }

  function spawn(x, y, opts) {
    opts = opts || {};
    const settings = (window.__powerMode.main && window.__powerMode.main.getSettings()) || {};
    const presets = window.__powerMode.presets;
    const preset = presets ? presets.getPreset(settings.preset || 'default') : { trails: true, shapes: SHAPES_LIST };
    const palette = opts.palette || (presets ? presets.getColorScheme(settings.colorScheme || 'rainbow') : ['#fff']);
    const shapesAvail = (opts.shapes || preset.shapes || SHAPES_LIST);
    const combo = opts.combo || 0;
    const perf = window.__powerMode.perf;
    let count = opts.count != null ? opts.count : ((settings.particleCount || 12) + Math.min(combo / 5, 20));
    if (perf && perf.shouldThrottle()) count = Math.floor(count * 0.5);
    const baseSize = opts.baseSize || 4;
    const sizeMul = 1 + Math.log10(1 + combo) * 0.3;
    const speed = opts.speed || (3 + Math.min(combo / 20, 6));
    const trails = opts.trails != null ? opts.trails : (preset.trails && !(perf && perf.shouldThrottle()));
    for (let i = 0; i < count; i++) {
      const p = findFree();
      if (!p) break;
      const angle = opts.angle != null ? opts.angle + (Math.random() - 0.5) * 0.6 : Math.random() * Math.PI * 2;
      const sp = speed * (0.5 + Math.random());
      p.alive = true;
      p.x = x; p.y = y;
      p.vx = Math.cos(angle) * sp + (opts.vxBias || 0);
      p.vy = Math.sin(angle) * sp + (opts.vyBias || 0);
      p.maxLife = (opts.life || 800) * (0.7 + Math.random() * 0.6);
      p.life = p.maxLife;
      p.size = (baseSize * sizeMul) * (0.7 + Math.random() * 0.6);
      p.color = palette[Math.floor(Math.random() * palette.length)];
      p.shape = shapesAvail[Math.floor(Math.random() * shapesAvail.length)] || 'circle';
      p.rotation = Math.random() * Math.PI * 2;
      p.vrot = (Math.random() - 0.5) * 0.2;
      p.trail.length = 0;
      p._trailsEnabled = trails;
    }
  }

  function update(dt) {
    const dtScale = dt / 16.67;
    const settings = (window.__powerMode.main && window.__powerMode.main.getSettings()) || {};
    const reduced = (window.__powerMode.accessibility && window.__powerMode.accessibility.prefersReducedMotion()) || settings.reducedMotion;
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
      if (p.life <= 0 || p.x < -50 || p.x > innerWidth + 50 || p.y > innerHeight + 50) {
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

  function clear() { for (let i = 0; i < pool.length; i++) pool[i].alive = false; }

  window.__powerMode.particles = { spawn, update, render, clear, getAliveCount, _pool: pool };
})();
```

---

### Task 8: webgl-renderer.js

**Files:**
- Create: `scripts/webgl-renderer.js`

Optional WebGL2 point-sprite renderer; falls back if unavailable.

- [ ] **Step 1: Implement try-init + render-points**

```js
(function () {
  window.__powerMode = window.__powerMode || {};
  let gl = null, program = null, posBuf = null, sizeBuf = null, colorBuf = null;
  let available = false;

  const VS = `#version 300 es
in vec2 a_pos;
in float a_size;
in vec3 a_color;
uniform vec2 u_viewport;
out vec3 v_color;
void main() {
  vec2 clip = (a_pos / u_viewport) * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  gl_PointSize = a_size;
  v_color = a_color;
}`;
  const FS = `#version 300 es
precision mediump float;
in vec3 v_color;
out vec4 outColor;
void main() {
  vec2 c = gl_PointCoord - vec2(0.5);
  float d = length(c);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.35, d);
  outColor = vec4(v_color, a);
}`;

  function compile(g, src, type) {
    const sh = g.createShader(type);
    g.shaderSource(sh, src);
    g.compileShader(sh);
    if (!g.getShaderParameter(sh, g.COMPILE_STATUS)) {
      console.warn('shader compile failed', g.getShaderInfoLog(sh));
      return null;
    }
    return sh;
  }

  function tryInit(canvas) {
    try {
      gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: false });
      if (!gl) return false;
      const vs = compile(gl, VS, gl.VERTEX_SHADER);
      const fs = compile(gl, FS, gl.FRAGMENT_SHADER);
      if (!vs || !fs) return false;
      program = gl.createProgram();
      gl.attachShader(program, vs); gl.attachShader(program, fs);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return false;
      posBuf = gl.createBuffer();
      sizeBuf = gl.createBuffer();
      colorBuf = gl.createBuffer();
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      available = true;
      return true;
    } catch (e) {
      console.warn('webgl init failed', e);
      return false;
    }
  }

  function hexToRgb(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return m ? [parseInt(m[1],16)/255, parseInt(m[2],16)/255, parseInt(m[3],16)/255] : [1,1,1];
  }

  function render(pool, canvas) {
    if (!available || !gl) return;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0,0,0,0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.uniform2f(gl.getUniformLocation(program, 'u_viewport'), canvas.width, canvas.height);
    const positions = [], sizes = [], colors = [];
    for (let i = 0; i < pool.length; i++) {
      const p = pool[i];
      if (!p.alive) continue;
      positions.push(p.x, p.y);
      sizes.push(p.size * 2);
      const rgb = hexToRgb(p.color);
      colors.push(rgb[0], rgb[1], rgb[2]);
    }
    if (!positions.length) return;
    const posLoc = gl.getAttribLocation(program, 'a_pos');
    const sizeLoc = gl.getAttribLocation(program, 'a_size');
    const colorLoc = gl.getAttribLocation(program, 'a_color');
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sizes), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(sizeLoc);
    gl.vertexAttribPointer(sizeLoc, 1, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(colorLoc);
    gl.vertexAttribPointer(colorLoc, 3, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.POINTS, 0, positions.length / 2);
  }

  window.__powerMode.webgl = { tryInit, render, get available() { return available; } };
})();
```

---

### Task 9: visual-effects.js

**Files:**
- Create: `scripts/visual-effects.js`

Screen shake + combo HUD positioning.

- [ ] **Step 1: Implement shake() + updateHUD() + tick()**

```js
(function () {
  window.__powerMode = window.__powerMode || {};
  let shakeAmp = 0, shakeDecay = 0.85;
  let hudEl = null;
  let hudHideTimer = null;
  const COLOR_TIERS = [
    { min: 500, color: '#ffd60a' },
    { min: 100, color: '#0a84ff' },
    { min: 50,  color: '#bf5af2' },
    { min: 10,  color: '#ff9f0a' },
    { min: 0,   color: '#ff3b30' }
  ];
  function tierColor(combo) {
    for (const t of COLOR_TIERS) if (combo >= t.min) return t.color;
    return '#ff3b30';
  }

  function ensureHud() {
    if (hudEl && hudEl.isConnected) return hudEl;
    hudEl = document.createElement('div');
    hudEl.setAttribute('data-powermode-hud', '');
    hudEl.style.cssText = [
      'position:fixed','pointer-events:none','z-index:2147483646',
      'font:bold 32px/1 system-ui,sans-serif','text-shadow:0 2px 8px rgba(0,0,0,.5)',
      'transition:opacity .25s ease,transform .25s ease',
      'opacity:0','transform:scale(.8)','user-select:none','will-change:transform,opacity'
    ].join(';');
    (document.documentElement || document.body).appendChild(hudEl);
    return hudEl;
  }

  function shake(intensity) {
    const settings = (window.__powerMode.main && window.__powerMode.main.getSettings()) || {};
    const reduced = (window.__powerMode.accessibility && window.__powerMode.accessibility.prefersReducedMotion()) || settings.reducedMotion;
    if (reduced) return;
    const scale = (settings.shakeIntensity || 5) / 5;
    shakeAmp = Math.max(shakeAmp, intensity * scale);
  }

  function updateHUD(combo, x, y) {
    const el = ensureHud();
    if (combo < 2) { hideHud(); return; }
    el.textContent = combo + 'x';
    el.style.color = tierColor(combo);
    el.style.fontSize = Math.min(20 + combo * 0.5, 96) + 'px';
    const px = Math.max(8, Math.min(window.innerWidth - 120, x + 20));
    const py = Math.max(8, Math.min(window.innerHeight - 60, y - 40));
    el.style.left = px + 'px';
    el.style.top = py + 'px';
    el.style.opacity = '1';
    el.style.transform = 'scale(1)';
    clearTimeout(hudHideTimer);
    hudHideTimer = setTimeout(hideHud, 1200);
  }

  function hideHud() {
    if (!hudEl) return;
    hudEl.style.opacity = '0';
    hudEl.style.transform = 'scale(.8)';
  }

  function tick() {
    if (shakeAmp < 0.1) {
      if (document.documentElement.style.transform) document.documentElement.style.transform = '';
      if (document.body && document.body.style.boxShadow) document.body.style.boxShadow = '';
      shakeAmp = 0;
      return;
    }
    const dx = (Math.random() - 0.5) * shakeAmp * 2;
    const dy = (Math.random() - 0.5) * shakeAmp * 2;
    document.documentElement.style.transform = `translate(${dx.toFixed(2)}px,${dy.toFixed(2)}px)`;
    if (document.body) {
      const shadowAlpha = Math.min(0.5, shakeAmp / 30);
      document.body.style.boxShadow = `inset 0 0 ${shakeAmp * 4}px rgba(0,0,0,${shadowAlpha.toFixed(2)})`;
    }
    shakeAmp *= shakeDecay;
  }

  window.__powerMode.vfx = { shake, updateHUD, tick, hideHud, _tierColor: tierColor };
})();
```

---

### Task 10: sound-effects-enhanced.js

**Files:**
- Create: `scripts/sound-effects-enhanced.js`

Web Audio voices, bitcrusher via ScriptProcessor, arpeggios.

- [ ] **Step 1: Implement init + play + arpeggio**

```js
(function () {
  window.__powerMode = window.__powerMode || {};
  let ctx = null, masterGain = null, bitcrushNode = null;
  let currentPack = 'default';
  let volume = 0.5;
  let bitcrushAmount = 0.4;
  let waveformOverride = null;

  const LETTER_NOTES = { A:220.00, B:246.94, C:261.63, D:293.66, E:329.63, F:349.23, G:392.00 };
  const SCALE = [220, 246.94, 261.63, 293.66, 329.63, 349.23, 392.00];

  function ensureCtx() {
    if (ctx) return ctx;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = volume;
      bitcrushNode = makeBitcrusher(ctx);
      bitcrushNode.connect(masterGain).connect(ctx.destination);
    } catch (e) {
      console.warn('AudioContext unavailable', e);
      ctx = null;
    }
    return ctx;
  }

  function makeBitcrusher(ac) {
    const node = ac.createScriptProcessor ? ac.createScriptProcessor(4096, 1, 1) : null;
    if (!node) {
      const passthrough = ac.createGain();
      passthrough.gain.value = 1;
      return passthrough;
    }
    let lastSample = 0, phaser = 0;
    node.onaudioprocess = function (e) {
      const inp = e.inputBuffer.getChannelData(0);
      const out = e.outputBuffer.getChannelData(0);
      const bits = Math.max(2, 16 - Math.floor(bitcrushAmount * 14));
      const step = Math.pow(2, bits - 1);
      const normFreq = 0.15 + (1 - bitcrushAmount) * 0.85;
      for (let i = 0; i < inp.length; i++) {
        phaser += normFreq;
        if (phaser >= 1) {
          phaser -= 1;
          lastSample = Math.round(inp[i] * step) / step;
        }
        out[i] = lastSample;
      }
    };
    return node;
  }

  function keyFreq(key) {
    if (!key) return 440;
    if (key === 'Enter') return 880;
    if (key === ' ' || key === 'Space') return 220;
    if (key === 'Backspace') return 110;
    if (key === 'Tab') return 440;
    const ch = key.length === 1 ? key.toUpperCase() : '';
    if (LETTER_NOTES[ch]) return LETTER_NOTES[ch];
    if (ch) {
      const code = ch.charCodeAt(0);
      return SCALE[code % SCALE.length];
    }
    return 440;
  }

  function keyWaveform(key, pack) {
    if (waveformOverride) return waveformOverride;
    if (key === 'Enter') return 'sine';
    if (key === ' ' || key === 'Space') return 'square';
    if (key === 'Backspace') return 'sawtooth';
    if (key === 'Tab') return 'triangle';
    return pack.waveform;
  }

  function play(key, combo) {
    const ac = ensureCtx();
    if (!ac) return;
    if (ac.state === 'suspended') ac.resume();
    const presets = window.__powerMode.presets;
    const pack = presets ? presets.getSoundPack(currentPack) : { waveform:'sine', attack:0.005, decay:0.18, gainScale:0.3 };
    const baseFreq = keyFreq(key);
    const detune = Math.min(combo * 4, 1200);
    const osc = ac.createOscillator();
    osc.type = keyWaveform(key, pack);
    osc.frequency.value = baseFreq;
    osc.detune.value = detune;
    const env = ac.createGain();
    const now = ac.currentTime;
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(pack.gainScale, now + pack.attack);
    env.gain.exponentialRampToValueAtTime(0.0001, now + pack.attack + pack.decay);
    osc.connect(env).connect(bitcrushNode);
    osc.start(now);
    osc.stop(now + pack.attack + pack.decay + 0.05);
  }

  function playArpeggio(tier) {
    const ac = ensureCtx();
    if (!ac) return;
    if (ac.state === 'suspended') ac.resume();
    const base = 330 + tier * 60;
    const intervals = tier >= 4 ? [0, 3, 7, 12] : [0, 4, 7, 12];
    intervals.forEach((semis, i) => {
      const freq = base * Math.pow(2, semis / 12);
      const osc = ac.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const env = ac.createGain();
      const now = ac.currentTime + i * 0.08;
      env.gain.setValueAtTime(0, now);
      env.gain.linearRampToValueAtTime(0.25, now + 0.005);
      env.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
      osc.connect(env).connect(bitcrushNode);
      osc.start(now);
      osc.stop(now + 0.4);
    });
  }

  window.__powerMode.sfx = {
    init: ensureCtx,
    play,
    playArpeggio,
    setPack: (n) => { currentPack = n; },
    setVolume: (v) => { volume = v; if (masterGain) masterGain.gain.value = v; },
    setBitcrush: (a) => { bitcrushAmount = a; },
    setWaveformOverride: (w) => { waveformOverride = w === 'auto' || !w ? null : w; },
    _getPack: () => currentPack
  };
})();
```

---

### Task 11: combo-milestones.js

**Files:**
- Create: `scripts/combo-milestones.js`

Combo counter + milestone-pattern dispatch.

- [ ] **Step 1: Implement register + milestone patterns**

```js
(function () {
  window.__powerMode = window.__powerMode || {};
  let count = 0;
  let lastKeyAt = 0;
  let lastX = 0, lastY = 0;
  const firedThisRun = new Set();
  let runStartedAt = 0;

  const MILESTONES = [
    { at: 10,   tier: 1, name: 'fireworks' },
    { at: 20,   tier: 2, name: 'galaxy' },
    { at: 50,   tier: 3, name: 'tornado' },
    { at: 100,  tier: 4, name: 'supernova' },
    { at: 200,  tier: 5, name: 'blackhole' },
    { at: 500,  tier: 6, name: 'bigbang' },
    { at: 1000, tier: 7, name: 'universe' }
  ];

  function reset() {
    count = 0;
    firedThisRun.clear();
    runStartedAt = 0;
  }

  function register(x, y) {
    const settings = (window.__powerMode.main && window.__powerMode.main.getSettings()) || {};
    const timeout = settings.comboTimeout || 1000;
    const now = performance.now();
    if (now - lastKeyAt > timeout) reset();
    lastKeyAt = now;
    if (count === 0) runStartedAt = now;
    count++;
    lastX = x; lastY = y;
    for (const m of MILESTONES) {
      if (count === m.at && !firedThisRun.has(m.name)) {
        firedThisRun.add(m.name);
        runMilestone(m, x, y);
      }
    }
    return count;
  }

  function runMilestone(m, x, y) {
    const particles = window.__powerMode.particles;
    const presets = window.__powerMode.presets;
    const sfx = window.__powerMode.sfx;
    const vfx = window.__powerMode.vfx;
    const settings = (window.__powerMode.main && window.__powerMode.main.getSettings()) || {};
    const palette = presets ? presets.getColorScheme(settings.colorScheme || 'rainbow') : ['#fff'];
    if (sfx && settings.soundEnabled !== false) sfx.playArpeggio(m.tier);
    if (!particles) return;
    const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    const reduced = (window.__powerMode.accessibility && window.__powerMode.accessibility.prefersReducedMotion()) || settings.reducedMotion;
    if (reduced) {
      particles.spawn(cx, cy, { count: 30, palette, speed: 1, baseSize: 6, life: 400, trails: false });
      return;
    }
    if (vfx) vfx.shake(20 + m.tier * 5);
    switch (m.name) {
      case 'fireworks':
        for (let i = 0; i < 5; i++) {
          setTimeout(() => particles.spawn(
            Math.random() * window.innerWidth,
            window.innerHeight * 0.3 + Math.random() * window.innerHeight * 0.3,
            { count: 40, baseSize: 5, speed: 8, palette, life: 1200 }
          ), i * 120);
        }
        break;
      case 'galaxy':
        for (let i = 0; i < 80; i++) {
          const a = (i / 80) * Math.PI * 2 * 3;
          const r = 50 + i * 4;
          particles.spawn(cx + Math.cos(a) * r, cy + Math.sin(a) * r, {
            count: 1, angle: a + Math.PI / 2, speed: 5, baseSize: 4, palette, life: 1600
          });
        }
        break;
      case 'tornado':
        for (let i = 0; i < 200; i++) {
          const y = window.innerHeight - i * (window.innerHeight / 200);
          const a = i * 0.3;
          particles.spawn(cx + Math.cos(a) * (i * 0.6), y, {
            count: 1, angle: a, speed: 4 + i * 0.02, baseSize: 5, palette, life: 1400
          });
        }
        break;
      case 'supernova':
        particles.spawn(cx, cy, { count: 400, baseSize: 8, speed: 14, palette, life: 1600 });
        break;
      case 'blackhole':
        for (let i = 0; i < 200; i++) {
          const a = Math.random() * Math.PI * 2;
          const r = 400 + Math.random() * 200;
          const px = cx + Math.cos(a) * r;
          const py = cy + Math.sin(a) * r;
          const towardA = Math.atan2(cy - py, cx - px);
          particles.spawn(px, py, { count: 1, angle: towardA, speed: 12, baseSize: 6, palette, life: 1500 });
        }
        break;
      case 'bigbang':
        particles.spawn(cx, cy, { count: 800, baseSize: 10, speed: 22, palette, life: 2200 });
        if (vfx) vfx.shake(60);
        break;
      case 'universe':
        for (let r = 0; r < 8; r++) {
          setTimeout(() => particles.spawn(
            Math.random() * window.innerWidth,
            Math.random() * window.innerHeight,
            { count: 200, baseSize: 9, speed: 18, palette, life: 1800 }
          ), r * 200);
        }
        if (vfx) vfx.shake(80);
        break;
    }
  }

  function tick() {
    const settings = (window.__powerMode.main && window.__powerMode.main.getSettings()) || {};
    const timeout = settings.comboTimeout || 1000;
    if (count > 0 && performance.now() - lastKeyAt > timeout) reset();
  }

  window.__powerMode.combo = {
    register,
    getCount: () => count,
    reset,
    tick,
    _getMilestones: () => MILESTONES,
    _firedThisRun: firedThisRun
  };
})();
```

---

### Task 12: ml-personalization.js

**Files:**
- Create: `scripts/ml-personalization.js`

Per-context preference tracker (opt-in).

- [ ] **Step 1: Implement observe + suggestion**

```js
(function () {
  window.__powerMode = window.__powerMode || {};
  const STORAGE_KEY = 'powerModeML';
  let data = null;
  let typingTimestamps = [];

  function loadData(cb) {
    if (!chrome || !chrome.storage) { data = {}; return cb && cb(data); }
    chrome.storage.local.get([STORAGE_KEY], (res) => {
      data = (res && res[STORAGE_KEY]) || {};
      cb && cb(data);
    });
  }

  function persist() {
    if (!chrome || !chrome.storage) return;
    chrome.storage.local.set({ [STORAGE_KEY]: data });
  }

  function siteCategory() {
    const h = (location.hostname || '').toLowerCase();
    if (/github\.com|gitlab\.com|bitbucket\.org/.test(h)) return 'code';
    if (/docs\.google\.com|medium\.com|notion\.so|substack\.com/.test(h)) return 'writing';
    if (/twitter\.com|x\.com|reddit\.com|facebook\.com|instagram\.com/.test(h)) return 'social';
    return 'other';
  }

  function typingSpeedBucket() {
    const now = performance.now();
    while (typingTimestamps.length && now - typingTimestamps[0] > 30000) typingTimestamps.shift();
    const wpm = (typingTimestamps.length / 5) / 0.5;
    if (wpm < 30) return 'slow';
    if (wpm < 60) return 'med';
    return 'fast';
  }

  function recordKeystroke() {
    typingTimestamps.push(performance.now());
  }

  function contextKey() {
    const h = new Date().getHours();
    const bucket = Math.floor(h / 4);
    return bucket + '_' + siteCategory() + '_' + typingSpeedBucket();
  }

  function observe(setting, value) {
    if (data == null) data = {};
    const k = contextKey();
    data[k] = data[k] || { _count: 0 };
    const ctx = data[k];
    ctx._count++;
    if (typeof value === 'number') {
      ctx[setting] = ctx[setting] != null ? ctx[setting] * 0.8 + value * 0.2 : value;
    } else {
      ctx[setting] = value;
    }
    persist();
  }

  function getSuggestion() {
    if (data == null) return null;
    const k = contextKey();
    const ctx = data[k];
    if (!ctx || ctx._count < 10) return null;
    const { _count, ...rest } = ctx;
    return rest;
  }

  window.__powerMode.ml = {
    init: loadData,
    observe,
    getSuggestion,
    recordKeystroke,
    _contextKey: contextKey,
    _setData: (d) => { data = d; },
    _getData: () => data,
    get enabled() {
      const s = window.__powerMode.main && window.__powerMode.main.getSettings();
      return !!(s && s.enableML);
    }
  };
})();
```

---

### Task 13: keyboard-shortcuts.js

**Files:**
- Create: `scripts/keyboard-shortcuts.js`

In-page handler for Ctrl+Shift+P / Ctrl+Shift+S (in addition to manifest commands which only work when the browser action is focused on some platforms).

- [ ] **Step 1: Implement document keydown listener**

```js
(function () {
  window.__powerMode = window.__powerMode || {};
  document.addEventListener('keydown', function (e) {
    if (!e.ctrlKey && !e.metaKey) return;
    if (!e.shiftKey) return;
    const key = (e.key || '').toLowerCase();
    if (key !== 'p' && key !== 's') return;
    const main = window.__powerMode.main;
    if (!main) return;
    const s = main.getSettings();
    if (key === 'p') {
      main.applySettings({ ...s, enabled: !s.enabled });
      e.preventDefault();
    } else if (key === 's') {
      main.applySettings({ ...s, soundEnabled: !s.soundEnabled });
      e.preventDefault();
    }
  }, true);
})();
```

---

### Task 14: main.js (orchestrator)

**Files:**
- Create: `scripts/main.js`

Owns overlay canvas, rAF loop, settings, input detection, message handling.

- [ ] **Step 1: Implement init + settings + render loop + input handling**

```js
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

  let settings = { ...DEFAULTS };
  let canvas = null, ctx2d = null;
  let lastFrame = performance.now();
  let initialized = false;
  let lastCaret = { x: 0, y: 0 };

  function ensureCanvas() {
    if (canvas && canvas.isConnected) return canvas;
    canvas = document.createElement('canvas');
    canvas.setAttribute('data-powermode-canvas', '');
    canvas.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483647;';
    canvas.width = window.innerWidth * devicePixelRatio;
    canvas.height = window.innerHeight * devicePixelRatio;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    (document.documentElement || document.body).appendChild(canvas);
    ctx2d = canvas.getContext('2d');
    ctx2d.scale(devicePixelRatio, devicePixelRatio);
    if (settings.useWebGL && window.__powerMode.webgl) window.__powerMode.webgl.tryInit(canvas);
    return canvas;
  }

  function onResize() {
    if (!canvas) return;
    canvas.width = window.innerWidth * devicePixelRatio;
    canvas.height = window.innerHeight * devicePixelRatio;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx2d = canvas.getContext('2d');
    ctx2d.scale(devicePixelRatio, devicePixelRatio);
  }

  function isEditable(el) {
    if (!el) return false;
    const tag = (el.tagName || '').toLowerCase();
    if (tag === 'textarea') return true;
    if (tag === 'input') {
      const t = (el.type || 'text').toLowerCase();
      return ['text','search','email','url','tel','password','number','date','time'].includes(t);
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
      const style = getComputedStyle(el);
      const mirror = document.createElement('div');
      const props = ['boxSizing','width','height','padding','border','font','letterSpacing','textAlign','direction','whiteSpace','wordWrap','lineHeight','textTransform'];
      props.forEach(p => mirror.style[p] = style[p]);
      mirror.style.position = 'absolute';
      mirror.style.visibility = 'hidden';
      mirror.style.whiteSpace = 'pre-wrap';
      mirror.style.wordWrap = 'break-word';
      const rect = el.getBoundingClientRect();
      mirror.style.left = rect.left + 'px';
      mirror.style.top = rect.top + 'px';
      mirror.style.width = rect.width + 'px';
      mirror.style.overflow = 'hidden';
      const value = (el.value || '').substring(0, el.selectionEnd != null ? el.selectionEnd : (el.value || '').length);
      mirror.textContent = value;
      const caret = document.createElement('span');
      caret.textContent = '​';
      mirror.appendChild(caret);
      document.body.appendChild(mirror);
      const cr = caret.getBoundingClientRect();
      const x = cr.left - el.scrollLeft;
      const y = cr.top - el.scrollTop + 8;
      document.body.removeChild(mirror);
      return { x, y };
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
        const r = sel.getRangeAt(0).getBoundingClientRect();
        if (r && (r.width || r.height || r.left || r.top)) {
          return { x: r.left, y: r.top + r.height / 2 };
        }
      }
    } catch (e) {}
    const r = el.getBoundingClientRect();
    return { x: r.left + 20, y: r.top + r.height / 2 };
  }

  function onKeydown(e) {
    if (!settings.enabled) return;
    const target = e.target;
    if (!isEditable(target)) return;
    if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Meta' || e.key === 'Alt') return;
    if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'v' || e.key === 'x' || e.key === 'a' || e.key === 'z')) return;
    const pos = caretPos(target);
    lastCaret = pos;
    const combo = window.__powerMode.combo ? window.__powerMode.combo.register(pos.x, pos.y) : 1;
    const ml = window.__powerMode.ml;
    if (ml) ml.recordKeystroke();
    if (window.__powerMode.particles) {
      window.__powerMode.particles.spawn(pos.x, pos.y, { combo });
    }
    if (window.__powerMode.vfx) {
      window.__powerMode.vfx.shake(2 + Math.min(combo / 8, 12));
      window.__powerMode.vfx.updateHUD(combo, pos.x, pos.y);
    }
    if (settings.soundEnabled && window.__powerMode.sfx) {
      window.__powerMode.sfx.play(e.key, combo);
    }
  }

  function loop() {
    const now = performance.now();
    const dt = now - lastFrame;
    lastFrame = now;
    if (window.__powerMode.perf) window.__powerMode.perf.tick();
    if (window.__powerMode.combo) window.__powerMode.combo.tick();
    if (window.__powerMode.particles) window.__powerMode.particles.update(dt);
    ensureCanvas();
    if (settings.useWebGL && window.__powerMode.webgl && window.__powerMode.webgl.available) {
      window.__powerMode.webgl.render(window.__powerMode.particles._pool, canvas);
    } else if (ctx2d) {
      ctx2d.clearRect(0, 0, canvas.width, canvas.height);
      if (window.__powerMode.particles) window.__powerMode.particles.render(ctx2d);
    }
    if (window.__powerMode.vfx) window.__powerMode.vfx.tick();
    requestAnimationFrame(loop);
  }

  function applyAccessibilityOverrides(s) {
    const ax = window.__powerMode.accessibility;
    if (!ax) return s;
    if (ax.prefersHighContrast() || s.highContrast) s = { ...s, colorScheme: 'monochrome' };
    return s;
  }

  function applySettings(next) {
    const prev = settings;
    settings = { ...DEFAULTS, ...next };
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
    if (chrome && chrome.storage) {
      chrome.storage.local.set({ [STORAGE_KEY]: settings });
    }
    const ml = window.__powerMode.ml;
    if (ml && prev && next && settings.enableML) {
      ['shakeIntensity','particleCount','volume','bitcrushAmount'].forEach(k => {
        if (prev[k] !== settings[k]) ml.observe(k, settings[k]);
      });
      ['preset','colorScheme','soundPack','waveform'].forEach(k => {
        if (prev[k] !== settings[k]) ml.observe(k, settings[k]);
      });
    }
  }

  function init() {
    if (initialized) return;
    initialized = true;
    if (chrome && chrome.storage) {
      chrome.storage.local.get([STORAGE_KEY], (res) => {
        const stored = (res && res[STORAGE_KEY]) || {};
        applySettings(applyAccessibilityOverrides({ ...DEFAULTS, ...stored }));
        if (window.__powerMode.ml) window.__powerMode.ml.init();
      });
      chrome.runtime.onMessage.addListener((msg) => {
        if (msg && msg.type === 'settingsChanged' && msg.settings) {
          applySettings(applyAccessibilityOverrides(msg.settings));
        } else if (msg && msg.type === 'getStats') {
          // popup handler – respond via sendResponse if provided
        }
        return false;
      });
    } else {
      applySettings(DEFAULTS);
    }
    const ax = window.__powerMode.accessibility;
    if (ax) ax.onChange(() => applySettings(applyAccessibilityOverrides(settings)));
    document.addEventListener('keydown', onKeydown, true);
    window.addEventListener('resize', onResize);
    ensureCanvas();
    const mo = new MutationObserver(() => {
      if (!canvas || !canvas.isConnected) {
        canvas = null;
        ensureCanvas();
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: false });
    requestAnimationFrame(loop);
  }

  window.__powerMode.main = {
    init,
    getSettings: () => settings,
    applySettings,
    DEFAULTS,
    _caretPos: caretPos,
    _isEditable: isEditable
  };
})();
```

---

### Task 15: content.js (entry)

**Files:**
- Create: `content.js`

Thin bootstrap; everything is initialized inside `main.init()`.

- [ ] **Step 1: Call main.init()**

```js
(function () {
  if (window.__powerMode && window.__powerMode.main) {
    try { window.__powerMode.main.init(); } catch (e) { console.warn('PowerMode init failed', e); }
  }
})();
```

---

### Task 16: background.js (service worker)

**Files:**
- Create: `background.js`

Seeds defaults, relays settings, handles commands.

- [ ] **Step 1: Implement install + relay + command handling**

```js
const STORAGE_KEY = 'powerModeSettings';
const DEFAULTS = {
  enabled: true, soundEnabled: true, preset: 'default',
  colorScheme: 'rainbow', soundPack: 'default',
  shakeIntensity: 5, particleCount: 12, volume: 0.5,
  bitcrushAmount: 0.4, waveform: 'auto',
  reducedMotion: false, highContrast: false,
  useWebGL: false, enableML: false, comboTimeout: 1000
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get([STORAGE_KEY], (res) => {
    if (!res || !res[STORAGE_KEY]) chrome.storage.local.set({ [STORAGE_KEY]: DEFAULTS });
  });
});

function broadcast(settings) {
  chrome.tabs.query({}, (tabs) => {
    for (const t of tabs) {
      if (t.id == null) continue;
      chrome.tabs.sendMessage(t.id, { type: 'settingsChanged', settings }).catch(() => {});
    }
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'settingsChanged' && msg.settings) {
    chrome.storage.local.set({ [STORAGE_KEY]: msg.settings }, () => broadcast(msg.settings));
    sendResponse({ ok: true });
    return true;
  }
});

chrome.commands.onCommand.addListener((command) => {
  chrome.storage.local.get([STORAGE_KEY], (res) => {
    const s = { ...DEFAULTS, ...((res && res[STORAGE_KEY]) || {}) };
    if (command === 'toggle-power-mode') s.enabled = !s.enabled;
    if (command === 'toggle-sound') s.soundEnabled = !s.soundEnabled;
    chrome.storage.local.set({ [STORAGE_KEY]: s }, () => broadcast(s));
  });
});
```

---

### Task 17: popup.html

**Files:**
- Create: `popup.html`

- [ ] **Step 1: Write structured settings UI**

(Full HTML with sections for master toggle, presets, color scheme, sound, sliders, accessibility, advanced, FPS, reset.)

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>PowerChrome</title>
<link rel="stylesheet" href="popup.css">
</head>
<body>
<header>
  <h1>⚡ PowerChrome</h1>
  <span id="fps" class="fps">— fps</span>
</header>
<section class="row">
  <label class="switch"><input type="checkbox" id="enabled"><span>Power Mode</span></label>
  <label class="switch"><input type="checkbox" id="soundEnabled"><span>Sound</span></label>
</section>
<section>
  <h2>Preset</h2>
  <div class="chips" id="presetChips">
    <button data-preset="default">Default</button>
    <button data-preset="subtle">Subtle</button>
    <button data-preset="intense">Intense</button>
    <button data-preset="retro">Retro</button>
    <button data-preset="minimal">Minimal</button>
  </div>
</section>
<section>
  <h2>Colors</h2>
  <select id="colorScheme">
    <option value="rainbow">Rainbow</option>
    <option value="pastel">Pastel</option>
    <option value="neon">Neon</option>
    <option value="monochrome">Monochrome</option>
    <option value="fire">Fire</option>
    <option value="ocean">Ocean</option>
  </select>
</section>
<section>
  <h2>Sound pack</h2>
  <select id="soundPack">
    <option value="default">Default</option>
    <option value="arcade">Arcade</option>
    <option value="synth">Synth</option>
    <option value="retro">Retro</option>
  </select>
</section>
<section class="sliders">
  <label>Shake <input type="range" id="shakeIntensity" min="1" max="10" step="1"><output id="shakeIntensityVal"></output></label>
  <label>Particles <input type="range" id="particleCount" min="5" max="30" step="1"><output id="particleCountVal"></output></label>
  <label>Volume <input type="range" id="volume" min="0" max="100" step="1"><output id="volumeVal"></output></label>
  <label>Bitcrush <input type="range" id="bitcrushAmount" min="0" max="100" step="1"><output id="bitcrushAmountVal"></output></label>
</section>
<section>
  <h2>Waveform</h2>
  <select id="waveform">
    <option value="auto">Auto (per-key)</option>
    <option value="sine">Sine</option>
    <option value="square">Square</option>
    <option value="sawtooth">Sawtooth</option>
    <option value="triangle">Triangle</option>
  </select>
</section>
<section>
  <h2>Accessibility</h2>
  <label class="switch"><input type="checkbox" id="reducedMotion"><span>Reduced motion</span></label>
  <label class="switch"><input type="checkbox" id="highContrast"><span>High contrast</span></label>
</section>
<section>
  <h2>Advanced</h2>
  <label class="switch"><input type="checkbox" id="useWebGL"><span>WebGL renderer</span></label>
  <label class="switch"><input type="checkbox" id="enableML"><span>Personalization (learn)</span></label>
</section>
<footer>
  <button id="reset">Reset to defaults</button>
  <div class="hint">Ctrl+Shift+P toggle · Ctrl+Shift+S sound</div>
</footer>
<script src="popup.js"></script>
</body>
</html>
```

---

### Task 18: popup.css

**Files:**
- Create: `popup.css`

- [ ] **Step 1: Premium dark theme styling**

```css
*, *::before, *::after { box-sizing: border-box; }
:root {
  --bg: #0b0d13;
  --bg-2: #131722;
  --fg: #e7ecf2;
  --muted: #95a0b4;
  --accent: #7c5cff;
  --accent-2: #00d4ff;
  --good: #34c759;
  --warn: #ff9f0a;
  --bad: #ff3b30;
  --radius: 10px;
}
html, body { margin: 0; padding: 0; }
body {
  width: 320px;
  font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif;
  background: linear-gradient(160deg, var(--bg) 0%, var(--bg-2) 100%);
  color: var(--fg);
}
header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px 8px;
}
header h1 { margin: 0; font-size: 16px; font-weight: 700; background: linear-gradient(90deg, var(--accent), var(--accent-2)); -webkit-background-clip: text; background-clip: text; color: transparent; }
.fps { font-family: ui-monospace, monospace; color: var(--muted); font-size: 11px; }
section { padding: 8px 16px; }
section h2 { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); margin: 0 0 6px; }
.row { display: flex; gap: 12px; padding: 4px 16px 0; }
.switch { display: inline-flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; }
.switch input { appearance: none; -webkit-appearance: none; width: 36px; height: 20px; background: #2a2f3d; border-radius: 999px; position: relative; transition: background .15s; cursor: pointer; }
.switch input:checked { background: linear-gradient(90deg, var(--accent), var(--accent-2)); }
.switch input::after { content: ""; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; background: #fff; border-radius: 50%; transition: transform .15s; }
.switch input:checked::after { transform: translateX(16px); }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chips button { background: #1d2231; color: var(--fg); border: 1px solid #2a2f3d; border-radius: 999px; padding: 6px 10px; font-size: 12px; cursor: pointer; transition: background .12s, border-color .12s; }
.chips button.active { background: linear-gradient(90deg, var(--accent), var(--accent-2)); color: #0b0d13; border-color: transparent; font-weight: 600; }
.chips button:hover { border-color: var(--accent); }
select { width: 100%; background: #1d2231; color: var(--fg); border: 1px solid #2a2f3d; border-radius: var(--radius); padding: 6px 8px; font-size: 13px; }
.sliders { display: grid; grid-template-columns: 1fr; gap: 8px; }
.sliders label { display: grid; grid-template-columns: 70px 1fr 32px; align-items: center; gap: 8px; font-size: 12px; color: var(--muted); }
.sliders input[type=range] { -webkit-appearance: none; appearance: none; width: 100%; height: 4px; background: #2a2f3d; border-radius: 2px; }
.sliders input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 14px; height: 14px; border-radius: 50%; background: var(--accent); cursor: pointer; box-shadow: 0 0 0 3px rgba(124,92,255,.18); }
.sliders output { font-family: ui-monospace, monospace; font-size: 11px; color: var(--fg); text-align: right; }
footer { padding: 10px 16px 14px; display: flex; justify-content: space-between; align-items: center; gap: 8px; }
footer button { background: transparent; color: var(--muted); border: 1px solid #2a2f3d; border-radius: var(--radius); padding: 6px 10px; cursor: pointer; }
footer button:hover { color: var(--fg); border-color: var(--accent); }
.hint { font-size: 10px; color: var(--muted); text-align: right; font-family: ui-monospace, monospace; }
```

---

### Task 19: popup.js

**Files:**
- Create: `popup.js`

- [ ] **Step 1: Wire UI ↔ chrome.storage ↔ broadcast**

```js
const STORAGE_KEY = 'powerModeSettings';
const DEFAULTS = {
  enabled: true, soundEnabled: true, preset: 'default',
  colorScheme: 'rainbow', soundPack: 'default',
  shakeIntensity: 5, particleCount: 12, volume: 0.5,
  bitcrushAmount: 0.4, waveform: 'auto',
  reducedMotion: false, highContrast: false,
  useWebGL: false, enableML: false, comboTimeout: 1000
};

const $ = (sel) => document.querySelector(sel);
const fields = ['enabled','soundEnabled','colorScheme','soundPack','shakeIntensity','particleCount','volume','bitcrushAmount','waveform','reducedMotion','highContrast','useWebGL','enableML'];

let state = { ...DEFAULTS };

function pct(v) { return Math.round(v * 100); }
function unpct(v) { return Number(v) / 100; }

function load(cb) {
  chrome.storage.local.get([STORAGE_KEY], (res) => {
    state = { ...DEFAULTS, ...((res && res[STORAGE_KEY]) || {}) };
    cb && cb();
  });
}

function save() {
  chrome.runtime.sendMessage({ type: 'settingsChanged', settings: state });
}

function refresh() {
  $('#enabled').checked = !!state.enabled;
  $('#soundEnabled').checked = !!state.soundEnabled;
  $('#colorScheme').value = state.colorScheme;
  $('#soundPack').value = state.soundPack;
  $('#waveform').value = state.waveform;
  $('#shakeIntensity').value = state.shakeIntensity;
  $('#shakeIntensityVal').textContent = state.shakeIntensity;
  $('#particleCount').value = state.particleCount;
  $('#particleCountVal').textContent = state.particleCount;
  $('#volume').value = pct(state.volume);
  $('#volumeVal').textContent = pct(state.volume) + '%';
  $('#bitcrushAmount').value = pct(state.bitcrushAmount);
  $('#bitcrushAmountVal').textContent = pct(state.bitcrushAmount) + '%';
  $('#reducedMotion').checked = !!state.reducedMotion;
  $('#highContrast').checked = !!state.highContrast;
  $('#useWebGL').checked = !!state.useWebGL;
  $('#enableML').checked = !!state.enableML;
  document.querySelectorAll('#presetChips button').forEach(b => {
    b.classList.toggle('active', b.dataset.preset === state.preset);
  });
}

function bind() {
  $('#enabled').addEventListener('change', e => { state.enabled = e.target.checked; save(); });
  $('#soundEnabled').addEventListener('change', e => { state.soundEnabled = e.target.checked; save(); });
  $('#colorScheme').addEventListener('change', e => { state.colorScheme = e.target.value; save(); });
  $('#soundPack').addEventListener('change', e => { state.soundPack = e.target.value; save(); });
  $('#waveform').addEventListener('change', e => { state.waveform = e.target.value; save(); });
  $('#shakeIntensity').addEventListener('input', e => { state.shakeIntensity = +e.target.value; $('#shakeIntensityVal').textContent = state.shakeIntensity; save(); });
  $('#particleCount').addEventListener('input', e => { state.particleCount = +e.target.value; $('#particleCountVal').textContent = state.particleCount; save(); });
  $('#volume').addEventListener('input', e => { state.volume = unpct(e.target.value); $('#volumeVal').textContent = e.target.value + '%'; save(); });
  $('#bitcrushAmount').addEventListener('input', e => { state.bitcrushAmount = unpct(e.target.value); $('#bitcrushAmountVal').textContent = e.target.value + '%'; save(); });
  $('#reducedMotion').addEventListener('change', e => { state.reducedMotion = e.target.checked; save(); });
  $('#highContrast').addEventListener('change', e => { state.highContrast = e.target.checked; save(); });
  $('#useWebGL').addEventListener('change', e => { state.useWebGL = e.target.checked; save(); });
  $('#enableML').addEventListener('change', e => { state.enableML = e.target.checked; save(); });
  document.querySelectorAll('#presetChips button').forEach(b => {
    b.addEventListener('click', () => {
      state.preset = b.dataset.preset;
      // apply preset side-effects to sliders
      const map = {
        default: { particleCount: 12, shakeIntensity: 5 },
        subtle:  { particleCount: 5,  shakeIntensity: 1 },
        intense: { particleCount: 30, shakeIntensity: 10 },
        retro:   { particleCount: 10, shakeIntensity: 6 },
        minimal: { particleCount: 0,  shakeIntensity: 0 }
      };
      Object.assign(state, map[b.dataset.preset] || {});
      refresh();
      save();
    });
  });
  $('#reset').addEventListener('click', () => {
    state = { ...DEFAULTS };
    refresh();
    save();
  });
}

function pollFps() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0] || tabs[0].id == null) return;
    chrome.tabs.sendMessage(tabs[0].id, { type: 'getStats' }, (resp) => {
      if (chrome.runtime.lastError) return;
      if (resp && resp.fps != null) $('#fps').textContent = resp.fps + ' fps';
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  load(() => { refresh(); bind(); pollFps(); setInterval(pollFps, 1000); });
});
```

(Note: requires content-script to respond to `getStats` — add handler in main.js. Update Task 14 accordingly when implementing.)

---

### Task 20: Test harness

**Files:**
- Create: `test/test-runner.html`

- [ ] **Step 1: Write standalone test page**

In-browser test harness with assertion lib + chrome.storage shim. Tests:
- Combo: increments, resets after timeout, milestone fires once per run, color tiers
- Particle pool: spawn reuses dead slots, no leak past cap, alive count correct
- Presets: getPreset returns expected shape, fallback works
- Color schemes / sound packs: lookups + fallbacks
- ML: contextKey format, observe + suggestion threshold
- Accessibility: simulated reduced-motion changes shake behavior
- Performance monitor: simulated frame times → fps + throttle

Renders pass/fail summary on the page.

---

### Task 21: README.md

**Files:**
- Create: `README.md`

- [ ] **Step 1: Installation, features, keyboard shortcuts, accessibility notes**

---

### Task 22: Sanity / lint pass

- [ ] **Step 1: For every JS file, run `node --check <file>` to confirm parse**

```bash
cd /Users/michaelsilverstein/powerChrome && for f in background.js content.js scripts/*.js popup.js; do node --check "$f" || echo "FAIL: $f"; done
```

Expected: no FAIL lines.

- [ ] **Step 2: Confirm manifest references match files on disk**

```bash
cd /Users/michaelsilverstein/powerChrome && python3 -c "
import json, os
m = json.load(open('manifest.json'))
missing = []
for j in m['content_scripts'][0]['js']:
    if not os.path.exists(j): missing.append(j)
for k, v in m['icons'].items():
    if not os.path.exists(v): missing.append(v)
if missing:
    print('MISSING:', missing); raise SystemExit(1)
print('OK')
"
```

---

### Task 23: Commit + push to Teamingzooper/PowerChrome

- [ ] **Step 1: `git init`, add remote, stage everything, commit**

```bash
cd /Users/michaelsilverstein/powerChrome
git init
git checkout -b main
git remote add origin https://github.com/Teamingzooper/PowerChrome.git
git add .
git commit -m "feat: complete PowerChrome MV3 extension"
```

- [ ] **Step 2: Force-push to overwrite existing contents (user-authorized)**

```bash
cd /Users/michaelsilverstein/powerChrome && git push --force origin main
```

Expected: push succeeds. Verify URL accessible.

---

## Self-review

### Spec coverage

| Spec requirement | Plan task |
|---|---|
| MV3 manifest with permissions, content_scripts, action, background | Task 1 |
| 3 PNG icons (16/48/128) | Task 2 |
| Particle system with pool, physics, shapes, trails, size scaling | Tasks 6, 7 |
| Screen shake with dynamic shadow | Task 9 |
| Combo counter with color tiers, reset, animation | Tasks 9, 11 |
| 7 milestone effects at 10/20/50/100/200/500/1000 | Task 11 |
| Web Audio + bitcrusher + key-specific waveforms + arpeggios + sound packs | Task 10 |
| 5 visual presets, 6 color schemes | Task 4 |
| Sliders (shake, particles, volume, bitcrush) | Tasks 17–19 |
| ML personalization (opt-in) | Task 12 |
| Accessibility: reduced motion, high contrast | Tasks 3, 7, 9, 14 |
| Performance monitor: FPS + memory + throttle | Task 5 |
| Keyboard shortcuts Ctrl+Shift+P/S | Tasks 13, 16, manifest commands in Task 1 |
| MutationObserver for SPAs | Task 14 |
| Settings persistence via chrome.storage.local | Tasks 14, 16, 19 |
| Settings sync to all tabs | Tasks 16, 19 |
| WebGL renderer (opt-in, fallback to Canvas2D) | Tasks 8, 14 |
| Popup with full settings + FPS readout + reset | Tasks 17, 18, 19 |
| In-browser test suite | Task 20 |
| README with install + features | Task 21 |
| Push to Teamingzooper/PowerChrome | Task 23 |

### Placeholder scan
- No "TBD" / "TODO" / "implement later" in tasks.
- Every code-bearing step has actual code.
- Task 20 describes tests in prose but is intended as final test surface; will write fully during execution. (Acceptable since these tests are deliverables, not TDD drivers — the user explicitly chose in-browser harness over runnable TDD.)

### Type consistency
- `window.__powerMode.main.getSettings()` signature used identically across tasks 7, 9, 10, 11, 13, 14.
- `window.__powerMode.particles.spawn(x, y, opts)` consistent: tasks 7 (def), 11 (usage), 14 (usage).
- `window.__powerMode.sfx.play(key, combo)` matches between tasks 10 (def) and 14 (usage).
- `window.__powerMode.combo.register(x, y)` matches tasks 11 (def) and 14 (usage).
- Settings shape (DEFAULTS) identical in tasks 14 (main), 16 (background), 19 (popup).
- `getStats` message handler: Task 19 calls it, Task 14 needs the responder — call this out: when executing Task 14, include a `chrome.runtime.onMessage` branch that returns `window.__powerMode.perf.getStats()` synchronously via sendResponse.
