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
