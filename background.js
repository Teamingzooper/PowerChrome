const STORAGE_KEY = 'powerModeSettings';
const DEFAULTS = {
  enabled: true,
  soundEnabled: true,
  preset: 'default',
  colorScheme: 'rainbow',
  customColors: ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#5ac8fa', '#007aff', '#af52de'],
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
  comboTimeout: 1000,
  spawnOffsetX: 0,
  spawnOffsetY: 0,
  spawnJitter: 0,
  spawnDirection: 'radial',
  particleLifeMul: 1.0,
  enabledShapes: { circle: true, square: true, triangle: true, star: true, diamond: true },
  gravity: 0.15,
  friction: 0.985,
  hudPosition: 'caret',
  hudScale: 1.0,
  hudOpacity: 1.0,
  disabledDomains: [],
  pasteAnimate: true,
  enterFlash: true,
  floatInChars: false,
  spamDetection: true,
  debugMode: false,
  selectionEffects: true,
  comboBar: true,
  comboBarStyle: 'thin',
  trailLength: 4,
  clickEffects: false,
  backendKind: 'auto',
  backendUrl: '',
  milestones: {
    fireworks: { enabled: true, at: 10,   effect: 'fireworks' },
    galaxy:    { enabled: true, at: 20,   effect: 'galaxy' },
    tornado:   { enabled: true, at: 50,   effect: 'tornado' },
    supernova: { enabled: true, at: 100,  effect: 'supernova' },
    blackhole: { enabled: true, at: 200,  effect: 'blackhole' },
    bigbang:   { enabled: true, at: 500,  effect: 'bigbang' },
    universe:  { enabled: true, at: 1000, effect: 'universe' }
  }
};

chrome.runtime.onInstalled.addListener(function () {
  chrome.storage.local.get([STORAGE_KEY], function (res) {
    if (!res || !res[STORAGE_KEY]) {
      const payload = {};
      payload[STORAGE_KEY] = DEFAULTS;
      chrome.storage.local.set(payload);
    }
  });
});

function broadcast(settings) {
  chrome.tabs.query({}, function (tabs) {
    for (let i = 0; i < tabs.length; i++) {
      const t = tabs[i];
      if (t.id == null) continue;
      try {
        const p = chrome.tabs.sendMessage(t.id, { type: 'settingsChanged', settings: settings });
        if (p && typeof p.catch === 'function') p.catch(function () {});
      } catch (e) { /* ignore receiver-not-found */ }
    }
  });
}

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (msg && msg.type === 'settingsChanged' && msg.settings) {
    const payload = {};
    payload[STORAGE_KEY] = msg.settings;
    chrome.storage.local.set(payload, function () {
      broadcast(msg.settings);
    });
    try { sendResponse({ ok: true }); } catch (e) { /* ignore */ }
    return true;
  }
  return false;
});

if (chrome.commands && chrome.commands.onCommand) {
  chrome.commands.onCommand.addListener(function (command) {
    chrome.storage.local.get([STORAGE_KEY], function (res) {
      const stored = (res && res[STORAGE_KEY]) || {};
      const s = Object.assign({}, DEFAULTS, stored);
      if (command === 'toggle-power-mode') s.enabled = !s.enabled;
      if (command === 'toggle-sound') s.soundEnabled = !s.soundEnabled;
      const payload = {};
      payload[STORAGE_KEY] = s;
      chrome.storage.local.set(payload, function () {
        broadcast(s);
      });
    });
  });
}
