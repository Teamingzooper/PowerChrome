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

  /* One-click theme bundles. Selecting one writes every field into settings; the
   * UI still lets you tweak afterwards. customColors is only applied when the
   * theme explicitly defines one.
   */
  const THEMES = {
    cyberpunk: {
      label: 'Cyberpunk',
      icon: '🌃',
      preset: 'intense',
      colorScheme: 'neon',
      soundPack: 'arcade',
      shakeIntensity: 8,
      particleCount: 22,
      volume: 0.55,
      bitcrushAmount: 0.55,
      waveform: 'square',
      trailLength: 6
    },
    pastelDream: {
      label: 'Pastel Dream',
      icon: '🌸',
      preset: 'subtle',
      colorScheme: 'pastel',
      soundPack: 'default',
      shakeIntensity: 2,
      particleCount: 9,
      volume: 0.35,
      bitcrushAmount: 0.15,
      waveform: 'sine',
      trailLength: 3
    },
    mechanical: {
      label: 'Mechanical',
      icon: '⌨️',
      preset: 'retro',
      colorScheme: 'monochrome',
      soundPack: 'arcade',
      shakeIntensity: 4,
      particleCount: 8,
      volume: 0.5,
      bitcrushAmount: 0.25,
      waveform: 'square',
      trailLength: 0
    },
    vaporwave: {
      label: 'Vaporwave',
      icon: '🌴',
      preset: 'default',
      colorScheme: 'custom',
      customColors: ['#ff71ce', '#b967ff', '#01cdfe', '#05ffa1', '#fffb96', '#ff9cee'],
      soundPack: 'synth',
      shakeIntensity: 4,
      particleCount: 14,
      volume: 0.4,
      bitcrushAmount: 0.25,
      waveform: 'sine',
      trailLength: 8
    },
    studioGhibli: {
      label: 'Studio',
      icon: '🍃',
      preset: 'subtle',
      colorScheme: 'custom',
      customColors: ['#a8c98a', '#e0d4a0', '#b8c4e0', '#d9a3a0', '#f3d8b6'],
      soundPack: 'default',
      shakeIntensity: 1,
      particleCount: 6,
      volume: 0.3,
      bitcrushAmount: 0.1,
      waveform: 'triangle',
      trailLength: 2
    },
    retroArcade: {
      label: 'Retro Arcade',
      icon: '🕹️',
      preset: 'intense',
      colorScheme: 'fire',
      soundPack: 'retro',
      shakeIntensity: 7,
      particleCount: 18,
      volume: 0.5,
      bitcrushAmount: 0.75,
      waveform: 'triangle',
      trailLength: 4
    }
  };

  window.__powerMode.presets = {
    getPreset: function (name) { return PRESETS[name] || PRESETS.default; },
    getColorScheme: function (name) {
      if (name === 'custom') return resolveCustomPalette();
      return SCHEMES[name] || SCHEMES.rainbow;
    },
    getSoundPack: function (name) { return PACKS[name] || PACKS.default; },
    getTheme: function (name) { return THEMES[name] || null; },
    getThemes: function () { return THEMES; },
    LIST: {
      presets: Object.keys(PRESETS),
      schemes: Object.keys(SCHEMES).concat(['custom']),
      packs: Object.keys(PACKS),
      themes: Object.keys(THEMES)
    },
    _isValidHex: isValidHex
  };
})();
