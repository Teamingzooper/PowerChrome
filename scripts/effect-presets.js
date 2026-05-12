(function () {
  window.__powerMode = window.__powerMode || {};

  const PRESETS = {
    default: { particleCount: 12, shakeIntensity: 5, trails: true, shapes: ['circle', 'square', 'triangle', 'star', 'diamond'] },
    subtle: { particleCount: 5, shakeIntensity: 1, trails: false, shapes: ['circle'] },
    intense: { particleCount: 30, shakeIntensity: 10, trails: true, shapes: ['star', 'diamond', 'triangle', 'circle', 'square'] },
    retro: { particleCount: 10, shakeIntensity: 6, trails: false, shapes: ['square'] },
    minimal: { particleCount: 0, shakeIntensity: 0, trails: false, shapes: [] }
  };

  const SCHEMES = {
    rainbow:    ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#5ac8fa', '#007aff', '#af52de'],
    pastel:     ['#ffd1dc', '#ffe4b5', '#fffacd', '#e0ffff', '#e6e6fa', '#d8bfd8', '#f0e68c'],
    neon:       ['#ff006e', '#fb5607', '#ffbe0b', '#8338ec', '#3a86ff', '#06ffa5', '#ff4081'],
    monochrome: ['#ffffff', '#dddddd', '#bbbbbb', '#999999', '#777777', '#555555'],
    fire:       ['#ffeb3b', '#ff9800', '#ff5722', '#f44336', '#d32f2f', '#b71c1c'],
    ocean:      ['#03a9f4', '#00bcd4', '#009688', '#3f51b5', '#1976d2', '#0d47a1']
  };

  const PACKS = {
    default: { waveform: 'sine',     bitcrushAmount: 0.4, attack: 0.005, decay: 0.18, gainScale: 0.30 },
    arcade:  { waveform: 'square',   bitcrushAmount: 0.6, attack: 0.002, decay: 0.10, gainScale: 0.25 },
    synth:   { waveform: 'sawtooth', bitcrushAmount: 0.2, attack: 0.010, decay: 0.40, gainScale: 0.22 },
    retro:   { waveform: 'triangle', bitcrushAmount: 0.8, attack: 0.001, decay: 0.08, gainScale: 0.28 }
  };

  function isValidHex(s) {
    return typeof s === 'string' && /^#[0-9a-f]{6}$/i.test(s);
  }

  function resolveCustomPalette() {
    const settings = (window.__powerMode.main && window.__powerMode.main.getSettings()) || {};
    const list = Array.isArray(settings.customColors) ? settings.customColors.filter(isValidHex) : [];
    return list.length ? list : SCHEMES.rainbow;
  }

  window.__powerMode.presets = {
    getPreset: function (name) { return PRESETS[name] || PRESETS.default; },
    getColorScheme: function (name) {
      if (name === 'custom') return resolveCustomPalette();
      return SCHEMES[name] || SCHEMES.rainbow;
    },
    getSoundPack: function (name) { return PACKS[name] || PACKS.default; },
    LIST: {
      presets: Object.keys(PRESETS),
      schemes: Object.keys(SCHEMES).concat(['custom']),
      packs: Object.keys(PACKS)
    },
    _isValidHex: isValidHex
  };
})();
