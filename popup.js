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

const PRESET_SIDE_EFFECTS = {
  default: { particleCount: 12, shakeIntensity: 5 },
  subtle:  { particleCount: 5,  shakeIntensity: 1 },
  intense: { particleCount: 30, shakeIntensity: 10 },
  retro:   { particleCount: 10, shakeIntensity: 6 },
  minimal: { particleCount: 5,  shakeIntensity: 0 }
};

const $ = function (sel) { return document.querySelector(sel); };
const $$ = function (sel) { return document.querySelectorAll(sel); };

let state = Object.assign({}, DEFAULTS);

function pct(v) { return Math.round(v * 100); }
function unpct(v) { return Number(v) / 100; }

function load(cb) {
  chrome.storage.local.get([STORAGE_KEY], function (res) {
    state = Object.assign({}, DEFAULTS, (res && res[STORAGE_KEY]) || {});
    if (cb) cb();
  });
}

function save() {
  chrome.runtime.sendMessage({ type: 'settingsChanged', settings: state }, function () {
    if (chrome.runtime.lastError) { /* tabs may not be listening; non-fatal */ }
  });
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

  $$('#presetChips button').forEach(function (b) {
    b.classList.toggle('active', b.dataset.preset === state.preset);
  });
}

function bindCheckbox(id, key) {
  $('#' + id).addEventListener('change', function (e) {
    state[key] = !!e.target.checked;
    save();
  });
}

function bindSelect(id, key) {
  $('#' + id).addEventListener('change', function (e) {
    state[key] = e.target.value;
    save();
  });
}

function bindRangeInt(id, key, valId) {
  $('#' + id).addEventListener('input', function (e) {
    state[key] = Number(e.target.value);
    $('#' + valId).textContent = state[key];
    save();
  });
}

function bindRangePct(id, key, valId) {
  $('#' + id).addEventListener('input', function (e) {
    state[key] = unpct(e.target.value);
    $('#' + valId).textContent = e.target.value + '%';
    save();
  });
}

function bindPresets() {
  $$('#presetChips button').forEach(function (b) {
    b.addEventListener('click', function () {
      state.preset = b.dataset.preset;
      const effect = PRESET_SIDE_EFFECTS[b.dataset.preset];
      if (effect) Object.assign(state, effect);
      refresh();
      save();
    });
  });
}

function bind() {
  bindCheckbox('enabled', 'enabled');
  bindCheckbox('soundEnabled', 'soundEnabled');
  bindCheckbox('reducedMotion', 'reducedMotion');
  bindCheckbox('highContrast', 'highContrast');
  bindCheckbox('useWebGL', 'useWebGL');
  bindCheckbox('enableML', 'enableML');

  bindSelect('colorScheme', 'colorScheme');
  bindSelect('soundPack', 'soundPack');
  bindSelect('waveform', 'waveform');

  bindRangeInt('shakeIntensity', 'shakeIntensity', 'shakeIntensityVal');
  bindRangeInt('particleCount', 'particleCount', 'particleCountVal');
  bindRangePct('volume', 'volume', 'volumeVal');
  bindRangePct('bitcrushAmount', 'bitcrushAmount', 'bitcrushAmountVal');

  bindPresets();

  $('#reset').addEventListener('click', function () {
    state = Object.assign({}, DEFAULTS);
    refresh();
    save();
  });
}

function pollFps() {
  if (!chrome.tabs || !chrome.tabs.query) return;
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (!tabs || !tabs[0] || tabs[0].id == null) return;
    try {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'getStats' }, function (resp) {
        if (chrome.runtime.lastError) {
          $('#fps').textContent = '— fps';
          return;
        }
        if (resp && resp.fps != null) {
          $('#fps').textContent = resp.fps + ' fps';
        } else {
          $('#fps').textContent = '— fps';
        }
      });
    } catch (e) {
      $('#fps').textContent = '— fps';
    }
  });
}

document.addEventListener('DOMContentLoaded', function () {
  load(function () {
    refresh();
    bind();
    pollFps();
    setInterval(pollFps, 1000);
  });
});
