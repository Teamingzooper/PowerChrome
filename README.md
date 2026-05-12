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

### Stats & profile (v1.2)

- Open a full **stats dashboard** in a new tab from the popup's **More → Open stats / profile** button (also lives at `chrome-extension://<id>/stats.html`).
- Tracks **highest combo**, **total characters typed**, **longest streak**, **total active time**, **backspace ratio**, **pastes animated**, and the **last 30 days** as a bar chart.
- **Per-site top 10** so you can see which sites you actually type on.
- **Milestones unlocked** count — every time you hit fireworks / galaxy / tornado / supernova / black hole / big bang / universe is recorded.
- **Profile** — pick a username and an emoji avatar.
- **Local-only leaderboard** today, with global/friends leaderboards reserved for a future release. Stats are stored locally and would sync upward when the backend ships.

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
