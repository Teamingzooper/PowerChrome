# PowerChrome — Design Spec

**Date:** 2026-05-12
**Target repo:** https://github.com/Teamingzooper/PowerChrome (full replacement of existing contents)

## Goal

A Chrome extension (Manifest V3) that brings Activate Power Mode's typing feedback — explosive particles, screen shake, combo counter, milestone effects, bitcrushed audio — to any text input on the web. Customizable, accessible, and performance-monitored.

## Scope decisions (resolved during brainstorming)

- **Advanced features:** Lean implementations of `ml-personalization.js` and `webgl-renderer.js` — fully functional but minimal, not stretched into half-baked complexity.
- **Icons:** Hand-rolled minimal PNGs committed directly to the repo. Generated once via a one-off zero-dep Node script, then the bytes are committed.
- **Tests:** In-browser test harness (`test/test-runner.html`) — open in a browser, see pass/fail. No npm.
- **Module loading:** Manifest-listed scripts + namespace pattern. Every `scripts/*.js` is an IIFE that attaches to `window.__powerMode`. No build step.

## Architecture overview

```
┌──────────────────────────────────────────────────────────────┐
│ Page                                                          │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ Content scripts (isolated world, MV3)               │   │
│   │   accessibility → effect-presets → perf-monitor →   │   │
│   │   custom-particles → particle-system → webgl →      │   │
│   │   visual-effects → sound-effects → combo-milestones │   │
│   │   → ml-personalization → keyboard-shortcuts →       │   │
│   │   main → content                                     │   │
│   │     ↓ injects                                        │   │
│   │   <canvas> overlay (fixed, z-max, pointer:none)     │   │
│   │   <div> combo HUD (fixed, near caret)               │   │
│   └─────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
                    ↕ chrome.runtime messages
┌──────────────────────────────────────────────────────────────┐
│ Background service worker (background.js)                     │
│   • Seeds defaults on install                                 │
│   • Relays settingsChanged from popup → all tabs              │
│   • Handles Ctrl+Shift+P / Ctrl+Shift+S commands              │
└──────────────────────────────────────────────────────────────┘
                    ↕ chrome.runtime messages
┌──────────────────────────────────────────────────────────────┐
│ Popup (popup.html / popup.js)                                 │
│   • Settings UI: toggles, sliders, dropdowns                  │
│   • Reads/writes chrome.storage.local                         │
│   • Live FPS readout                                          │
└──────────────────────────────────────────────────────────────┘
```

## File structure

```
PowerChrome/
├── manifest.json
├── popup.html
├── popup.js
├── popup.css
├── background.js
├── content.js
├── README.md
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── scripts/
│   ├── accessibility.js
│   ├── effect-presets.js
│   ├── performance-monitor.js
│   ├── custom-particles.js
│   ├── particle-system.js
│   ├── webgl-renderer.js
│   ├── visual-effects.js
│   ├── sound-effects-enhanced.js
│   ├── combo-milestones.js
│   ├── ml-personalization.js
│   ├── keyboard-shortcuts.js
│   └── main.js
├── test/
│   └── test-runner.html
└── docs/superpowers/specs/2026-05-12-power-chrome-design.md  (this file)
```

## Module contracts

Each module attaches to `window.__powerMode` namespace:

| Module | Namespace key | Exports |
|---|---|---|
| accessibility.js | `accessibility` | `prefersReducedMotion()`, `prefersHighContrast()`, `onChange(cb)` |
| effect-presets.js | `presets` | `getPreset(name)`, `getColorScheme(name)`, `getSoundPack(name)`, `LIST` |
| performance-monitor.js | `perf` | `tick()`, `getStats()`, `shouldThrottle()` |
| custom-particles.js | `shapes` | `draw(ctx, particle)` map keyed by shape name |
| particle-system.js | `particles` | `spawn(x, y, opts)`, `update(dt)`, `render(ctx)`, `clear()`, `getAliveCount()` |
| webgl-renderer.js | `webgl` | `tryInit(canvas)`, `render(particles)`, `available` |
| visual-effects.js | `vfx` | `shake(intensity)`, `updateHUD(combo, x, y)`, `tick()` |
| sound-effects-enhanced.js | `sfx` | `init()`, `play(key, combo)`, `playArpeggio(tier)`, `setPack(name)`, `setVolume(v)` |
| combo-milestones.js | `combo` | `register(x, y)`, `getCount()`, `reset()`, `tick()` |
| ml-personalization.js | `ml` | `observe(setting, value)`, `getSuggestion()`, `enabled` |
| keyboard-shortcuts.js | `shortcuts` | (registers handlers internally) |
| main.js | `main` | `init()`, `getSettings()`, `applySettings(s)` |

## Rendering

- Single `<canvas>` injected into `document.documentElement` (not body — survives body replacement). `position: fixed; top:0; left:0; width:100vw; height:100vh; pointer-events:none; z-index:2147483647`.
- Resized on `window.resize` (debounced 100ms).
- Cleared each frame; particles drawn via Canvas2D (or WebGL2 if `useWebGL` enabled and init succeeds).
- Combo HUD: `<div>` injected separately, CSS-positioned near last keystroke location.

## Particle physics

- Pool size: 800 (grows to 2000 on milestones), reused via `alive` flag.
- Each particle: `{x, y, vx, vy, life, maxLife, size, color, shape, rotation, vrot, trail}`.
- Per-frame: `vy += gravity * dt; vx *= friction; x += vx; y += vy; life -= dt;` Death when `life <= 0` or off-screen.
- Trail: ring buffer of last 4 (x,y) pairs, rendered with linear alpha fade.
- Spawn count per keystroke: `settings.particleCount + min(combo / 5, 20)`.
- Size scaling: `baseSize * (1 + log10(1 + combo) * 0.3)`.

## Audio

- Single shared `AudioContext`, created lazily on first keystroke (autoplay-policy compliant).
- Voice graph: `OscillatorNode → GainNode (envelope ADSR) → BitcrusherNode → masterGain → destination`.
- Bitcrusher: `AudioWorkletNode` preferred, falls back to `ScriptProcessorNode`. Quantizes samples: `Math.round(sample * step) / step` where `step = 2^bits`, `bits = lerp(16, 2, bitcrushAmount)`.
- Key mapping:
  - Enter → sine 880Hz
  - Space → square 220Hz
  - Backspace → sawtooth 110Hz
  - Tab → triangle 440Hz
  - A–G letters → mapped musical notes (220–392Hz)
  - Other keys → hash(charCode) modulo a 7-note scale
- Combo arpeggios at milestones (10/20/50/100/200/500/1000): 4-note ascending pattern in major or minor depending on tier.
- Sound packs: Default / Arcade / Synth / Retro — preset objects overriding `{waveform, bitcrushAmount, attack, decay, gainScale}`.

## Combo system

- `count` increments per keystroke; resets to 0 after `comboTimeout` ms (default 1000) of inactivity.
- Color tiers shown in HUD:
  - 1–9 red · 10–49 orange · 50–99 purple · 100–499 blue · 500+ yellow
- Milestone triggers fire **once** per combo run, with 5s cooldown:
  - 10x fireworks · 20x galaxy swirl · 50x tornado · 100x supernova · 200x black hole · 500x big bang · 1000x universe explosion
- Each milestone is a tagged spawn pattern (location, particle count, velocity field, color palette) executed through the same pool.

## Visual effects

- Screen shake: rAF-driven `transform: translate(${dx}px, ${dy}px)` on `document.documentElement`, amplitude `min(combo / 10, 20) * (settings.shakeIntensity / 5)` px, decay 0.85/frame.
- Dynamic `box-shadow` on body for depth during shake.
- Combo HUD: absolutely-positioned div near caret, CSS scale-in (0.8 → 1.0 over 80ms), fade-out 600ms after combo expires.
- Reduced motion: shake disabled, particles become brief 200ms radial fades, milestone effects become a single flash.

## Input detection

- Single delegated `keydown` listener on `document` (capture phase).
- `isEditable(target)`: matches `<input>` (text-like types), `<textarea>`, `[contenteditable]`, or any contenteditable ancestor.
- Cursor position resolution:
  - `<input>` / `<textarea>` → mirror-div technique (clone styles, insert text up to `selectionStart`, measure offset)
  - `contenteditable` → `Selection.getRangeAt(0).getBoundingClientRect()`
  - Fallback → element's bounding rect center
- `MutationObserver` on `documentElement` (childList + subtree) re-attaches the overlay canvas if a page strips it.

## Settings

- Stored in `chrome.storage.local` under key `powerModeSettings`.
- Defaults:
  ```js
  {
    enabled: true,
    soundEnabled: true,
    preset: 'default',
    colorScheme: 'rainbow',
    soundPack: 'default',
    shakeIntensity: 5,
    particleCount: 12,
    volume: 0.5,
    bitcrushAmount: 0.4,
    waveform: 'sine',
    reducedMotion: false,
    highContrast: false,
    useWebGL: false,
    enableML: false,
    comboTimeout: 1000
  }
  ```
- Changed by popup → written to `chrome.storage.local` → background relays `{type:'settingsChanged', settings}` to all tabs.

## Background service worker

- `chrome.runtime.onInstalled` → seed defaults if absent.
- `chrome.runtime.onMessage` → relay `settingsChanged` payload to every tab via `chrome.tabs.sendMessage`.
- `chrome.commands.onCommand` → toggle `enabled` or `soundEnabled` and rebroadcast.

## Popup UI

Sections, top to bottom:
1. Master enable toggle + Sound toggle
2. Preset buttons: Default · Subtle · Intense · Retro · Minimal
3. Color scheme dropdown
4. Sound pack dropdown
5. Shake intensity slider (1–10)
6. Particle count slider (5–30)
7. Volume slider (0–100%)
8. Bitcrush amount slider
9. Waveform dropdown (override for non-special keys)
10. Accessibility: Reduced motion + High contrast toggles
11. Advanced: Enable WebGL renderer + Enable ML personalization
12. Live FPS readout (polled 1s from active tab)
13. Reset to defaults

Dark theme, gradient accents, monospace combo preview. All inputs live-update on change.

## Accessibility

- `prefers-reduced-motion: reduce` → shake disabled, fade-only particles, no milestone bursts.
- `prefers-contrast: more` → color scheme forced to Monochrome.
- User toggles in popup override OS hints.
- Keyboard shortcuts (Ctrl+Shift+P / Ctrl+Shift+S) declared in manifest `commands`.

## Performance monitor

- rAF FPS sampler, 60-frame rolling window.
- Memory estimate: `pool.alive * 256 + audio.voices * 2048` bytes.
- Self-throttle: avg FPS < 30 for 2s → halve spawn rate, skip trails until recovery.
- `getStats()` exposed for popup readout.

## ML personalization (lean, opt-in)

- Off by default (`enableML: false`).
- Context key: `${hourBucket}_${siteCategory}_${typingSpeedBucket}` where:
  - `hourBucket` = `floor(hour / 4)` → 6 buckets/day
  - `siteCategory` = hostname heuristic: code (github/gitlab) · writing (docs/medium) · social (twitter/reddit) · other
  - `typingSpeedBucket` = rolling 30s WPM → slow/med/fast
- For each context, store running average of explicit user-set values for each numeric setting.
- On page load, if context has ≥10 observations, gently blend: `applied = 0.8 * explicit + 0.2 * learned` for sliders. Never override active popup session.
- Stored under `chrome.storage.local.powerModeML`.

## WebGL renderer (lean, opt-in)

- Off by default (`useWebGL: false`).
- `tryInit(canvas)` requests `webgl2`, builds point-sprite shader, sets up instanced rendering.
- If `getContext('webgl2')` returns null → `available = false`, particle system silently uses Canvas2D.
- Renders particles as colored point sprites with size from `gl_PointSize`. No trails in WebGL path (Canvas2D-only feature).

## Test harness

- Standalone `test/test-runner.html` page.
- Loads the same `scripts/*.js` files via `<script>` tags.
- Lightweight assertion library inline: `describe(group, fn)`, `test(name, fn)`, `assert(cond, msg)`, `assertEqual(a, b)`.
- Mocks `chrome.storage` with in-memory shim.
- Tests:
  - Combo: increments, resets after timeout, milestone trigger fires once.
  - Particle pool: spawns reuse dead slots, no leak past pool cap.
  - ML: weighted update math, suggestion blending.
  - Presets: applying preset overrides correct fields.
  - Sound packs: `setPack(name)` updates internal config.
  - Accessibility: reduced-motion path disables shake.
  - Performance: throttle kicks in below threshold.
- Pass/fail summary rendered on the page in colored cards.

## Error handling

- Wrap `AudioContext` creation in try/catch — fall back to silent mode if blocked.
- `chrome.storage` failures → log + use in-memory defaults.
- WebGL init failures → silently fall back to Canvas2D.
- `requestAnimationFrame` loop wrapped to catch + log per-frame exceptions without halting the loop.

## Deployment

After implementation:
1. Generate the three icon PNGs via a one-off Node script using only built-ins (`fs`, `zlib`, no deps). Commit PNG bytes. Discard generator.
2. `git init` in `/Users/michaelsilverstein/powerChrome`.
3. `git remote add origin https://github.com/Teamingzooper/PowerChrome.git`.
4. `git add .`, commit.
5. `git push --force origin main` to overwrite the existing repo as authorized.

## Success criteria (from user spec)

- Typing in any text box triggers satisfying visual/audio feedback ✓
- All customization options work ✓
- Milestone effects trigger at correct combo values ✓
- Settings persist across browser sessions ✓
- No performance degradation under extended use ✓
- Works on major websites ✓
- Accessibility options function correctly ✓
- Code is clean, modular, maintainable ✓
