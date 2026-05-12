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

### Audio
- **Bitcrushed synthesis** for that crunchy lo-fi feel (adjustable 0–100%).
- **Key-specific waveforms**: Enter (sine 880Hz), Space (square 220Hz), Backspace (sawtooth 110Hz), Tab (triangle 440Hz), letters A–G mapped to musical notes.
- **Combo arpeggios** at each milestone.
- **Four sound packs**: Default · Arcade · Synth · Retro.
- Volume + bitcrush + waveform override controls.

### Customization
- **Five visual presets**: Default · Subtle · Intense · Retro · Minimal.
- **Six color schemes**: Rainbow · Pastel · Neon · Monochrome · Fire · Ocean.
- **Live sliders** for shake intensity (1–10), particle count (5–30), volume, bitcrush.
- Settings sync across all open tabs instantly via `chrome.storage.local`.

### Smart features
- **Personalization (opt-in)**: gently learns your preferences per time-of-day × site category × typing speed, after 10 observations in a context.
- **Accessibility**: honors `prefers-reduced-motion` and `prefers-contrast: more`. Override either in the popup.
- **Performance monitoring**: live FPS readout in the popup, automatic throttling if frame rate drops below 30 fps for 2 seconds.
- **WebGL renderer (opt-in)**: switch to a GPU point-sprite renderer for very heavy combos.

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
