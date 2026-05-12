# ⚡ PowerChrome — Activate Power Mode for Chrome

Bring the satisfying dopamine of [Activate Power Mode](https://github.com/disclosurat-1/activate-power-mode) to every text box on the web. Explosive particles, screen shake, combo tracking, milestone effects, and bitcrushed audio — all customizable, all accessible, all under 60 KB of zero-dependency JavaScript.

## Install (Developer Mode)

1. Clone or download this repository.
2. Open `chrome://extensions` in Chrome (or any Chromium-based browser).
3. Toggle **Developer mode** (top right).
4. Click **Load unpacked** and select the `PowerChrome/` directory.
5. Pin the extension to your toolbar for quick access to settings.

## Features

### Visual
- **Particle explosions** with five shapes (circle, square, triangle, star, diamond), size scaling with combo, gravity/friction physics, optional trails.
- **Screen shake** that intensifies with combo, with dynamic depth shadow.
- **Combo counter** that floats near your cursor and color-shifts by tier:
  - 🟥 1–9 · 🟧 10–49 · 🟪 50–99 · 🟦 100–499 · 🟨 500+
- **Milestone effects** that trigger once per combo run:
  - 10× fireworks · 20× galaxy swirl · 50× tornado · 100× supernova · 200× black hole · 500× big bang · 1000× universe explosion
- **Backspace / Delete feel different**: imploding red particles converge toward the caret, with a lower, shorter "thunk" sound, and they don't increment your combo — mistakes shouldn't break a streak.

### Audio
- **Bitcrushed synthesis** for that crunchy lo-fi feel (adjustable 0–100%).
- **Key-specific waveforms**: Enter (sine 880Hz), Space (square 220Hz), Backspace/Delete (descending sawtooth 90Hz), Tab (triangle 440Hz), letters A–G mapped to musical notes.
- **Combo arpeggios** at each milestone.
- **Four sound packs**: Default · Arcade · Synth · Retro.
- Volume + bitcrush + waveform override controls.

### Customization (v1.1)
- **Five visual presets**: Default · Subtle · Intense · Retro · Minimal.
- **Six built-in color schemes** plus a **Custom palette editor** — up to 8 hex slots with native color pickers + text inputs.
- **Combo customization**: each of the 7 milestone slots has its own toggle, editable threshold, and effect picker — assign any of the 7 effects to any combo number. Want a tornado at 5x? Done.
- **Spawn customization**: offset X/Y, jitter radius, direction (Radial · Up · Down · Cone↑ · Cone↓ · Sides), particle life multiplier.
- **HUD location**: near caret · 6 fixed positions · follow cursor — plus HUD scale and opacity sliders.
- **Per-shape toggles** — disable any of circle/square/triangle/star/diamond.
- **Physics sliders** — gravity and friction adjustable in real time.
- **Combo reset timeout** (300–3000 ms).
- **Per-site disable list** — block PowerChrome on specific domains (with one-click "Add current").
- **Live sliders** for shake intensity, particle count, volume, bitcrush.
- Settings sync across all open tabs instantly via `chrome.storage.local`.

### Smart features
- **Personalization (opt-in)**: gently learns your preferences per time-of-day × site category × typing speed, after 10 observations in a context.
- **Accessibility**: honors `prefers-reduced-motion` and `prefers-contrast: more`. Override either in the popup.
- **Performance monitoring**: live FPS readout in the popup, automatic throttling if frame rate drops below 30 fps for 2 seconds.
- **WebGL renderer (opt-in)**: switch to a GPU point-sprite renderer for very heavy combos.

### Typing feel (v1.2)

- **Paste animation** — paste anywhere and the text snaps in character-by-character with an ease-in cadence (slow → fast, ~120 ms → 15 ms), counting as a single combo so a paste doesn't artificially inflate your stats.
- **Enter flash** — pressing Return triggers a brief screen flash plus a horizontal "carriage return" particle sweep, mimicking a typewriter's line break.
- **Float-in letters** *(opt-in)* — the literal character you typed appears above the caret and snaps to position with a soft fade, on top of the regular particle effects.
- **Combo spam detection** — holding a key or hammering the same character pauses your combo (so it doesn't grow off-cheating) without resetting your existing streak. Spam stops the moment you actually type something different.
- **Backspace + Delete** stay imploding red particles with a short downward thunk, and they never break a streak.

### Stats, profile & social (v1.3)

- Open a full **stats dashboard** in a new tab from the popup's **More → Open stats / profile** button (also lives at `chrome-extension://<id>/stats.html`).
- Tracks **highest combo**, **total characters typed**, **longest streak**, **total active time**, **backspace ratio**, **pastes animated**, and the **last 30 days** as a bar chart.
- **Per-site top 10** so you can see which sites you actually type on.
- **Milestones unlocked** count — every time you hit fireworks / galaxy / tornado / supernova / black hole / big bang / universe is recorded.
- **Profile** — pick a username and an emoji avatar.
- **Friend codes** — every install auto-generates an 8-char code (e.g. `WXYZ-2345`). Copy it from the dashboard, share it with a friend, and add their code via the "Add a friend" form.
- **Leaderboards** with segmented controls: by highest combo / characters typed, scoped to friends or global. Synthetic global rows make the view feel alive in local-only mode.
- **Backend banner** — clearly labels whether you're running on the local mock backend or a real one. Currently always local. Plugging in a real backend is a straight swap in `scripts/social-api.js`.

### Debugging (v1.3)

- Toggle **More → Debug → Show debug HUD** in the popup for an in-page overlay with live FPS, particle count, current combo, audio backend (`worklet` / `scriptProcessor` / `passthrough`), last event, last error.
- A **Diagnostics** card on the stats page shows the same data plus AudioWorklet support, account info, and the active backend. Useful for filing issues.
- The bitcrusher now uses an **AudioWorklet** (worker thread, no main-thread blocking, no deprecation warnings); it falls back to `ScriptProcessorNode` only if `audioWorklet` isn't available in the browser.

### Text selection effects (v1.4)

- **Copy** a selection (`⌘C` / `Ctrl+C`) and a celebratory cyan streak sweeps upward along the selection range, with a soft ascending arpeggio.
- **Cut** (`⌘X`) fires a hybrid burst: upward yellow/orange streaks plus a brief imploding red flash, scaled to the length of the selection.
- **Backspace / Delete with a non-empty selection** spawns an imploding ring of red particles scaled to the deletion length — bigger selections feel weightier. The combo doesn't increment.
- All three effects can be turned off in **Particles → Select / cut / copy effects**.

### Combo timeout bar (v1.4)

- A thin progress bar sits under the combo counter showing how much time is left before the combo resets. Width shrinks smoothly toward zero; the bar's color follows the tier color of the current combo.
- Toggle in **Combo → Timeout bar**. Two styles: **thin** (constant) or **pulse** (pulses near the end for a panic vibe).

### More polish (v1.4)

- **Trail length slider** (0–12 segments) under **Particles → Trails & extras**. Set to 0 for crisp non-trailing particles, 12 for long comet streaks.
- **Click bursts** toggle — every mouse click anywhere on the page spawns a tiny burst of particles. Off by default.

### Real backend (v1.4) — **live at `powerchrome-api.vercel.app`**

A live deployment of the server in [`server/`](server/) is already running at **`https://powerchrome-api.vercel.app`** with persistent Upstash Redis (KV) storage. That URL is also the extension's default — install v1.4.0+ and the social system is wired to the live backend out of the box.

The deployment provides:

- POST `/api/account/init` — generates a friend code + secret token
- POST `/api/account/get` · `/api/account/update`
- POST `/api/stats/sync` — monotonic counters; server never lowers a stat
- POST `/api/friends/add` · `/api/friends/remove` · `/api/friends/list`
- POST `/api/leaderboard` — `kind: 'combo' | 'chars'` × `scope: 'friends' | 'global'`
- GET `/api/health` — surfaces the active storage backend (`memory` or `kv`)

Persistence is via Vercel KV (Upstash Redis); without it the function falls back to in-process memory. After deploying the server directory, attach a KV store in the Vercel dashboard's Storage tab to make data durable across cold starts.

The extension's social backend (popup → **More → Social backend**) has three modes:

- **Auto** — try remote, fall back to local mock if the server is unreachable
- **Remote only** — uses the URL in the **Backend URL** field
- **Local mock only** — pre-1.4 behavior, synthetic friends and leaderboards

Stats sync to the server every 15 seconds when the remote backend is active.

### Site coverage (v1.3)

- Content scripts now inject into **all frames** (with safeguards against tiny ad iframes) so editors-in-iframes work — Google Docs / Sheets / Slides, Figma, embedded CodeMirror, etc.
- **Canvas-rendered editors** (Google Docs and friends, which render text to a canvas instead of the DOM) get a dedicated caret-resolution fallback: known caret markers like `.kix-cursor` are measured first, then last mouse position, then editor center. Particles still spawn at a sensible location even when the DOM has nothing to measure.
- Elements with `role="textbox"` / `combobox` / `searchbox` are now recognized as editable, covering rich-text frameworks that don't use real `contenteditable`.

### Keyboard shortcuts
- `Ctrl+Shift+P` — toggle Power Mode on/off
- `Ctrl+Shift+S` — toggle sound effects

## File layout

```
PowerChrome/
├── manifest.json
├── popup.html / popup.css / popup.js     ← Settings UI
├── background.js                          ← Service worker (settings relay + commands)
├── content.js                             ← Bootstraps the page-side runtime
├── scripts/
│   ├── accessibility.js                   ← OS hint detection
│   ├── effect-presets.js                  ← Preset / color / sound-pack data
│   ├── performance-monitor.js             ← FPS sampler + throttle
│   ├── custom-particles.js                ← Shape draw functions
│   ├── particle-system.js                 ← Pool + physics
│   ├── webgl-renderer.js                  ← Optional WebGL2 point sprites
│   ├── visual-effects.js                  ← Screen shake + combo HUD
│   ├── sound-effects-enhanced.js          ← Web Audio + bitcrusher
│   ├── combo-milestones.js                ← Tracker + 7 milestone patterns
│   ├── ml-personalization.js              ← Per-context preference learning
│   ├── keyboard-shortcuts.js              ← In-page Ctrl+Shift hotkeys
│   └── main.js                            ← Orchestrator (canvas + rAF + input)
├── icons/                                 ← 16/48/128 PNG icons
└── test/test-runner.html                  ← Open in browser to run the test suite
```

All scripts run in the content-script isolated world and share a single `window.__powerMode` namespace. No bundler, no build step.

## Testing

Open `test/test-runner.html` directly in your browser:

```bash
open test/test-runner.html
# or
python3 -m http.server -d test 8000  # then visit http://localhost:8000/test-runner.html
```

The harness loads the same scripts the extension uses and runs ~30 assertions covering combo timing, particle pool reuse, ML weighted updates, audio key mapping, accessibility behavior, performance throttling, and main module wiring.

## Privacy

- All settings live in `chrome.storage.local` on your machine.
- ML personalization (off by default) stores aggregated preference data locally; nothing is sent anywhere.
- The extension only reacts to keystrokes on focused text inputs. It does not record, log, or transmit their content.

## Compatibility

Tested on Chrome 120+, Edge 120+, Brave 1.6+. Works with:

- Plain `<input>` / `<textarea>` elements
- `contenteditable` elements (Notion, Gmail, Twitter/X, Reddit composer, etc.)
- Single-page apps that swap focus dynamically (a `MutationObserver` re-attaches the overlay if the page strips it)

If a particular site interferes (very high z-index modals, strict CSP that blocks inline canvas), please open an issue with the URL.

## License

MIT.
