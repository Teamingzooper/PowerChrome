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
  theme: '',
  wordEffects: true,
  sentenceEffects: true,
  wpmIndicator: false,
  syncSettings: false,
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

const PRESET_SIDE_EFFECTS = {
  default: { particleCount: 12, shakeIntensity: 5 },
  subtle:  { particleCount: 5,  shakeIntensity: 1 },
  intense: { particleCount: 30, shakeIntensity: 10 },
  retro:   { particleCount: 10, shakeIntensity: 6 },
  minimal: { particleCount: 5,  shakeIntensity: 0 }
};

// Themes mirrored from scripts/effect-presets.js so the popup is standalone.
// Selecting a theme writes every field into state.
const THEMES = {
  cyberpunk:   { label: 'Cyberpunk',    icon: '🌃', preset: 'intense', colorScheme: 'neon',       soundPack: 'arcade',  shakeIntensity: 8,  particleCount: 22, volume: 0.55, bitcrushAmount: 0.55, waveform: 'square',   trailLength: 6 },
  pastelDream: { label: 'Pastel Dream', icon: '🌸', preset: 'subtle',  colorScheme: 'pastel',     soundPack: 'default', shakeIntensity: 2,  particleCount: 9,  volume: 0.35, bitcrushAmount: 0.15, waveform: 'sine',     trailLength: 3 },
  mechanical:  { label: 'Mechanical',   icon: '⌨️', preset: 'retro',   colorScheme: 'monochrome', soundPack: 'arcade',  shakeIntensity: 4,  particleCount: 8,  volume: 0.50, bitcrushAmount: 0.25, waveform: 'square',   trailLength: 0 },
  vaporwave:   { label: 'Vaporwave',    icon: '🌴', preset: 'default', colorScheme: 'custom',     soundPack: 'synth',   shakeIntensity: 4,  particleCount: 14, volume: 0.40, bitcrushAmount: 0.25, waveform: 'sine',     trailLength: 8,
                 customColors: ['#ff71ce','#b967ff','#01cdfe','#05ffa1','#fffb96','#ff9cee'] },
  studioGhibli:{ label: 'Studio',       icon: '🍃', preset: 'subtle',  colorScheme: 'custom',     soundPack: 'default', shakeIntensity: 1,  particleCount: 6,  volume: 0.30, bitcrushAmount: 0.10, waveform: 'triangle', trailLength: 2,
                 customColors: ['#a8c98a','#e0d4a0','#b8c4e0','#d9a3a0','#f3d8b6'] },
  retroArcade: { label: 'Retro Arcade', icon: '🕹️', preset: 'intense', colorScheme: 'fire',       soundPack: 'retro',   shakeIntensity: 7,  particleCount: 18, volume: 0.50, bitcrushAmount: 0.75, waveform: 'triangle', trailLength: 4 }
};

const MILESTONE_SLOTS = ['fireworks', 'galaxy', 'tornado', 'supernova', 'blackhole', 'bigbang', 'universe'];
const EFFECT_OPTIONS = MILESTONE_SLOTS.slice();
const SHAPE_NAMES = ['circle', 'square', 'triangle', 'star', 'diamond'];
const HEX_RE = /^#[0-9a-f]{6}$/i;

const $ = function (sel) { return document.querySelector(sel); };
const $$ = function (sel) { return document.querySelectorAll(sel); };

/* ---------------- Account bar ---------------- *
 * The popup mirrors a tiny subset of the stats page: avatar, username,
 * friend code, online status, and a big "open stats" button. Editing
 * username/avatar here writes to chrome.storage.local AND pushes to
 * the live backend so leaderboards update without opening the stats tab.
 */
const ACCOUNT_KEY = 'powerModeAccount';
const STATS_KEY = 'powerModeStats';
const DEFAULT_BACKEND_URL = 'https://powerchrome-api.vercel.app';
const ACCOUNT_AVATARS = [
  '⚡','🔥','💥','✨','🌟','🚀','🎮','🎯','🎨',
  '🎵','🎸','🎲','🧠','🦾','🤖','👾','🐉','🦊',
  '🐱','🐺','🐧','🦉','🦋','🐙','🌈','🌌','🌊',
  '🌋','☄️','🪐','🌀','🌪️','🔱','♾️','⚙️','🧩'
];

let acctState = {
  friendCode: '',
  token: '',
  username: '',
  avatar: '⚡'
};
let acctUsernameTimer = null;

function loadAccount(cb) {
  chrome.storage.local.get([ACCOUNT_KEY, STATS_KEY], function (res) {
    const acct = (res && res[ACCOUNT_KEY]) || {};
    const stats = (res && res[STATS_KEY]) || {};
    const profile = (stats && stats.profile) || {};
    acctState = {
      friendCode: acct.friendCode || '',
      token: acct.token || '',
      username: profile.username || '',
      avatar: profile.avatar || '⚡'
    };
    if (cb) cb();
  });
}

function saveProfileLocal() {
  chrome.storage.local.get([STATS_KEY], function (res) {
    const cur = (res && res[STATS_KEY]) || {};
    cur.profile = Object.assign({}, cur.profile || {}, {
      username: acctState.username,
      avatar: acctState.avatar
    });
    chrome.storage.local.set({ [STATS_KEY]: cur });
  });
}

function backendUrl() {
  const u = (state && state.backendUrl) || '';
  return (u || DEFAULT_BACKEND_URL).replace(/\/$/, '');
}

async function pushProfileToBackend() {
  if (!acctState.token) return;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(function () { ctrl.abort(); }, 8000);
    const res = await fetch(backendUrl() + '/api/account/update', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        token: acctState.token,
        username: acctState.username,
        avatar: acctState.avatar
      }),
      signal: ctrl.signal
    });
    clearTimeout(t);
    if (!res.ok) return;
    await res.json();
    refreshStatusDot('online');
  } catch (e) {
    refreshStatusDot('offline');
  }
}

async function pingHealth() {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(function () { ctrl.abort(); }, 6000);
    const res = await fetch(backendUrl() + '/api/health', { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

function refreshStatusDot(forced) {
  const dot = $('#acctStatusDot');
  const text = $('#acctStatusText');
  if (!dot) return;
  const kind = (state && state.backendKind) || 'auto';
  if (kind === 'local') {
    dot.className = 'acct-dot local';
    text.textContent = 'local';
    return;
  }
  if (forced === 'online') {
    dot.className = 'acct-dot online';
    text.textContent = 'online';
    return;
  }
  if (forced === 'offline') {
    dot.className = 'acct-dot offline';
    text.textContent = 'offline';
    return;
  }
  pingHealth().then(function (h) {
    if (h && h.ok) {
      dot.className = 'acct-dot online';
      text.textContent = 'online · ' + (h.storage || '?');
    } else {
      dot.className = 'acct-dot offline';
      text.textContent = 'offline';
    }
  });
}

function renderAccountBar() {
  $('#acctAvatar').textContent = acctState.avatar || '⚡';
  if (document.activeElement !== $('#acctUsername')) {
    $('#acctUsername').value = acctState.username || '';
  }
  $('#acctCode').textContent = acctState.friendCode || '— pending —';
}

function buildEmojiPicker() {
  const grid = $('#acctEmojiGrid');
  grid.innerHTML = '';
  ACCOUNT_AVATARS.forEach(function (em) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = em;
    if (em === acctState.avatar) b.classList.add('active');
    b.addEventListener('click', function () {
      acctState.avatar = em;
      renderAccountBar();
      saveProfileLocal();
      pushProfileToBackend();
      $('#acctEmojiPicker').hidden = true;
    });
    grid.appendChild(b);
  });
}

/* ---------------- Onboarding ---------------- *
 * Shown only on first install (no friendCode cached locally). Submit
 * creates the cloud account explicitly with the user-picked username +
 * avatar, then hides the modal so all subsequent opens jump straight to
 * the account bar.
 */
let onbSelectedAvatar = '⚡';

function isOnboardingNeeded() {
  return !acctState.friendCode;
}

function buildOnboardingPicker() {
  const grid = document.getElementById('onbEmojiGrid');
  grid.innerHTML = '';
  ACCOUNT_AVATARS.forEach(function (em) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = em;
    if (em === onbSelectedAvatar) b.classList.add('active');
    b.addEventListener('click', function () {
      onbSelectedAvatar = em;
      grid.querySelectorAll('button').forEach(function (x) { x.classList.toggle('active', x === b); });
    });
    grid.appendChild(b);
  });
}

function showOnboarding() {
  document.body.classList.add('onb-active');
  document.getElementById('onboarding').hidden = false;
  buildOnboardingPicker();
  setTimeout(function () { document.getElementById('onbUsername').focus(); }, 50);
}

function hideOnboarding() {
  document.body.classList.remove('onb-active');
  document.getElementById('onboarding').hidden = true;
}

function setOnbStatus(msg, kind) {
  const el = document.getElementById('onbStatus');
  if (!msg) { el.hidden = true; return; }
  el.textContent = msg;
  el.className = 'onb-status' + (kind ? ' ' + kind : '');
  el.hidden = false;
}

async function submitOnboarding() {
  const nameRaw = document.getElementById('onbUsername').value || '';
  const username = nameRaw.trim().slice(0, 24);
  if (!username) {
    setOnbStatus('Pick a username first.', 'error');
    document.getElementById('onbUsername').focus();
    return;
  }
  const submitBtn = document.getElementById('onbSubmit');
  submitBtn.disabled = true;
  setOnbStatus('Creating account…');

  // Always cache locally first so the bar shows the right thing even if the
  // network call fails. We'll create the cloud account in the background
  // and the auto-recover path picks up later if it fails now.
  acctState.username = username;
  acctState.avatar = onbSelectedAvatar;
  saveProfileLocal();

  try {
    const ctrl = new AbortController();
    const t = setTimeout(function () { ctrl.abort(); }, 10000);
    const res = await fetch(backendUrl() + '/api/account/init', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: username, avatar: onbSelectedAvatar }),
      signal: ctrl.signal
    });
    clearTimeout(t);
    if (!res.ok) throw new Error('http ' + res.status);
    const data = await res.json();
    if (!data || !data.ok) throw new Error(data && data.error || 'failed');

    acctState.friendCode = data.friendCode;
    acctState.token = data.token;
    chrome.storage.local.set({
      [ACCOUNT_KEY]: {
        friendCode: data.friendCode,
        token: data.token,
        createdAt: new Date().toISOString()
      }
    });
    setOnbStatus('Saved ✓', 'ok');
    setTimeout(function () {
      hideOnboarding();
      renderAccountBar();
      refreshStatusDot('online');
    }, 500);
  } catch (e) {
    // Even if the cloud account fails, the local profile is saved. The next
    // typing session in any tab will retry account creation via the content
    // script's social-api init flow.
    setOnbStatus('Saved locally (cloud sync will retry)', 'ok');
    setTimeout(function () {
      hideOnboarding();
      renderAccountBar();
      refreshStatusDot('offline');
    }, 800);
  } finally {
    submitBtn.disabled = false;
  }
}

function bindOnboarding() {
  document.getElementById('onbSubmit').addEventListener('click', submitOnboarding);
  document.getElementById('onbUsername').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitOnboarding();
    }
  });
}

function bindAccountBar() {
  // Avatar click toggles the emoji picker.
  $('#acctAvatar').addEventListener('click', function () {
    const picker = $('#acctEmojiPicker');
    const willShow = picker.hidden;
    if (willShow) buildEmojiPicker();
    picker.hidden = !willShow;
  });

  // Username editing — debounce backend push so live typing isn't a sync storm.
  $('#acctUsername').addEventListener('input', function (e) {
    acctState.username = (e.target.value || '').slice(0, 24);
    saveProfileLocal();
    clearTimeout(acctUsernameTimer);
    acctUsernameTimer = setTimeout(pushProfileToBackend, 400);
  });

  // Friend code copy-to-clipboard.
  $('#acctCode').addEventListener('click', function () {
    const code = acctState.friendCode;
    if (!code || code.indexOf('—') >= 0) return;
    try { navigator.clipboard.writeText(code); } catch (e) { /* ignore */ }
    const fb = $('#acctCopied');
    fb.hidden = false;
    setTimeout(function () { fb.hidden = true; }, 1500);
  });

  // Both "open stats" buttons.
  const openStats = function () {
    try { chrome.tabs.create({ url: chrome.runtime.getURL('stats.html') }); } catch (e) { /* ignore */ }
  };
  $('#acctStatsBtn').addEventListener('click', openStats);
  $('#headerStatsBtn').addEventListener('click', openStats);

  // Live update if the stats page (or another popup) changes the profile.
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area !== 'local') return;
      if (changes[STATS_KEY]) {
        const newStats = changes[STATS_KEY].newValue || {};
        const profile = newStats.profile || {};
        if (document.activeElement !== $('#acctUsername')) {
          acctState.username = profile.username || acctState.username;
        }
        acctState.avatar = profile.avatar || acctState.avatar;
        renderAccountBar();
      }
      if (changes[ACCOUNT_KEY]) {
        const newAcct = changes[ACCOUNT_KEY].newValue || {};
        acctState.friendCode = newAcct.friendCode || acctState.friendCode;
        acctState.token = newAcct.token || acctState.token;
        renderAccountBar();
      }
    });
  }
}

let state = mergeDefaults({});

function mergeDefaults(s) {
  const out = Object.assign({}, DEFAULTS, s || {});
  out.customColors = Array.isArray(s && s.customColors) && s.customColors.length
    ? s.customColors.slice() : DEFAULTS.customColors.slice();
  out.enabledShapes = Object.assign({}, DEFAULTS.enabledShapes, (s && s.enabledShapes) || {});
  out.disabledDomains = Array.isArray(s && s.disabledDomains) ? s.disabledDomains.slice() : [];
  out.milestones = {};
  for (let i = 0; i < MILESTONE_SLOTS.length; i++) {
    const name = MILESTONE_SLOTS[i];
    const def = DEFAULTS.milestones[name];
    const cur = (s && s.milestones && s.milestones[name]) || {};
    out.milestones[name] = {
      enabled: cur.enabled !== false,
      at: (typeof cur.at === 'number' && cur.at > 0) ? Math.floor(cur.at) : def.at,
      effect: EFFECT_OPTIONS.indexOf(cur.effect) >= 0 ? cur.effect : def.effect
    };
  }
  return out;
}

function pct(v) { return Math.round(v * 100); }
function unpct(v) { return Number(v) / 100; }

function load(cb) {
  chrome.storage.local.get([STORAGE_KEY], function (res) {
    state = mergeDefaults((res && res[STORAGE_KEY]) || {});
    if (cb) cb();
  });
}

function save() {
  chrome.runtime.sendMessage({ type: 'settingsChanged', settings: state }, function () {
    if (chrome.runtime.lastError) { /* no live tabs is fine */ }
  });
}

/* ---------------- Tabs ---------------- */
function bindTabs() {
  $$('nav.tabs button').forEach(function (b) {
    b.addEventListener('click', function () {
      $$('nav.tabs button').forEach(function (x) { x.classList.remove('active'); });
      b.classList.add('active');
      const tab = b.dataset.tab;
      $$('.panel').forEach(function (p) {
        p.classList.toggle('active', p.dataset.panel === tab);
      });
    });
  });
}

/* ---------------- Custom palette ---------------- */
function renderPalette() {
  const list = $('#customColorsList');
  list.innerHTML = '';
  state.customColors.forEach(function (hex, idx) {
    const row = document.createElement('div');
    row.className = 'row-color';
    const swatch = document.createElement('label');
    swatch.className = 'swatch';
    swatch.style.background = HEX_RE.test(hex) ? hex : '#888';
    const colorIn = document.createElement('input');
    colorIn.type = 'color';
    colorIn.value = HEX_RE.test(hex) ? hex.toLowerCase() : '#888888';
    colorIn.addEventListener('input', function (e) {
      state.customColors[idx] = e.target.value;
      swatch.style.background = e.target.value;
      hexIn.value = e.target.value;
      save();
    });
    swatch.appendChild(colorIn);

    const hexIn = document.createElement('input');
    hexIn.type = 'text';
    hexIn.className = 'hex-input';
    hexIn.value = hex.toLowerCase();
    hexIn.maxLength = 7;
    hexIn.addEventListener('change', function (e) {
      let v = (e.target.value || '').trim();
      if (v && v[0] !== '#') v = '#' + v;
      if (HEX_RE.test(v)) {
        state.customColors[idx] = v;
        swatch.style.background = v;
        colorIn.value = v.toLowerCase();
        save();
      } else {
        e.target.value = state.customColors[idx];
      }
    });

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove-color';
    remove.textContent = '×';
    remove.title = 'Remove color';
    remove.addEventListener('click', function () {
      if (state.customColors.length <= 1) return;
      state.customColors.splice(idx, 1);
      renderPalette();
      save();
    });

    row.appendChild(swatch);
    row.appendChild(hexIn);
    row.appendChild(remove);
    list.appendChild(row);
  });
  $('#addColor').disabled = state.customColors.length >= 8;
}

function bindPalette() {
  $('#addColor').addEventListener('click', function () {
    if (state.customColors.length >= 8) return;
    state.customColors.push('#ffffff');
    renderPalette();
    save();
  });
}

function updateCustomColorsVisibility() {
  $('#customColorsSection').hidden = state.colorScheme !== 'custom';
}

/* ---------------- Milestones ---------------- */
function renderMilestones() {
  const list = $('#milestonesList');
  list.innerHTML = '';
  MILESTONE_SLOTS.forEach(function (name) {
    const m = state.milestones[name];
    const row = document.createElement('div');
    row.className = 'milestone-row';

    const toggleWrap = document.createElement('div');
    toggleWrap.className = 'ms-toggle';
    const toggleIn = document.createElement('input');
    toggleIn.type = 'checkbox';
    toggleIn.id = 'ms-' + name;
    toggleIn.checked = m.enabled;
    const toggleLbl = document.createElement('label');
    toggleLbl.htmlFor = 'ms-' + name;
    toggleIn.addEventListener('change', function () {
      state.milestones[name].enabled = toggleIn.checked;
      save();
    });
    toggleWrap.appendChild(toggleIn);
    toggleWrap.appendChild(toggleLbl);

    const atIn = document.createElement('input');
    atIn.type = 'number';
    atIn.min = '2';
    atIn.max = '99999';
    atIn.step = '1';
    atIn.value = m.at;
    atIn.addEventListener('change', function () {
      const v = parseInt(atIn.value, 10);
      if (Number.isFinite(v) && v >= 2) {
        state.milestones[name].at = v;
      } else {
        atIn.value = state.milestones[name].at;
      }
      save();
    });

    const effectSel = document.createElement('select');
    EFFECT_OPTIONS.forEach(function (eff) {
      const opt = document.createElement('option');
      opt.value = eff;
      opt.textContent = eff;
      effectSel.appendChild(opt);
    });
    effectSel.value = m.effect;
    effectSel.addEventListener('change', function () {
      state.milestones[name].effect = effectSel.value;
      save();
    });

    const label = document.createElement('div');
    label.className = 'ms-label';
    label.textContent = name;

    row.appendChild(toggleWrap);
    row.appendChild(atIn);
    row.appendChild(effectSel);
    row.appendChild(label);
    list.appendChild(row);
  });
}

function bindMilestones() {
  $('#resetMilestones').addEventListener('click', function () {
    state.milestones = JSON.parse(JSON.stringify(DEFAULTS.milestones));
    renderMilestones();
    save();
  });
}

/* ---------------- Disabled domains ---------------- */
function renderDomains() {
  const list = $('#disabledList');
  list.innerHTML = '';
  state.disabledDomains.forEach(function (d, idx) {
    const row = document.createElement('div');
    row.className = 'domain-row';
    const text = document.createElement('span');
    text.textContent = d;
    const rm = document.createElement('button');
    rm.type = 'button';
    rm.textContent = '×';
    rm.title = 'Remove';
    rm.addEventListener('click', function () {
      state.disabledDomains.splice(idx, 1);
      renderDomains();
      save();
    });
    row.appendChild(text);
    row.appendChild(rm);
    list.appendChild(row);
  });
}

function addDomain(raw) {
  const d = (raw || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!d) return;
  if (state.disabledDomains.indexOf(d) >= 0) return;
  state.disabledDomains.push(d);
  renderDomains();
  save();
}

function bindDomains() {
  $('#addDomain').addEventListener('click', function () {
    addDomain($('#newDomain').value);
    $('#newDomain').value = '';
  });
  $('#newDomain').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      addDomain(e.target.value);
      e.target.value = '';
    }
  });
  $('#addCurrentDomain').addEventListener('click', function () {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (!tabs || !tabs[0] || !tabs[0].url) return;
      try {
        const host = new URL(tabs[0].url).hostname;
        if (host) addDomain(host);
      } catch (e) { /* invalid URL */ }
    });
  });
}

/* ---------------- Shape toggles ---------------- */
function refreshShapeToggles() {
  $$('.shape-pill input').forEach(function (cb) {
    const name = cb.dataset.shape;
    cb.checked = state.enabledShapes[name] !== false;
  });
}
function bindShapeToggles() {
  $$('.shape-pill input').forEach(function (cb) {
    cb.addEventListener('change', function (e) {
      const name = cb.dataset.shape;
      state.enabledShapes[name] = !!e.target.checked;
      // Don't allow all-off
      if (!SHAPE_NAMES.some(function (s) { return state.enabledShapes[s]; })) {
        state.enabledShapes[name] = true;
        cb.checked = true;
      }
      save();
    });
  });
}

/* ---------------- Spawn direction chips ---------------- */
function refreshDirectionChips() {
  $$('#spawnDirectionChips button').forEach(function (b) {
    b.classList.toggle('active', b.dataset.direction === state.spawnDirection);
  });
}
function bindDirectionChips() {
  $$('#spawnDirectionChips button').forEach(function (b) {
    b.addEventListener('click', function () {
      state.spawnDirection = b.dataset.direction;
      refreshDirectionChips();
      save();
    });
  });
}

/* ---------------- Generic field bindings ---------------- */
function bindCheckbox(id, key) {
  $('#' + id).addEventListener('change', function (e) {
    state[key] = !!e.target.checked;
    save();
  });
}
function bindSelect(id, key, after) {
  $('#' + id).addEventListener('change', function (e) {
    state[key] = e.target.value;
    if (after) after();
    save();
  });
}
function bindRangeInt(id, key, valId, formatter) {
  $('#' + id).addEventListener('input', function (e) {
    state[key] = Number(e.target.value);
    $('#' + valId).textContent = formatter ? formatter(state[key]) : state[key];
    save();
  });
}
function bindRangeMapped(id, key, valId, fromRaw, format) {
  $('#' + id).addEventListener('input', function (e) {
    const raw = Number(e.target.value);
    state[key] = fromRaw(raw);
    $('#' + valId).textContent = format(raw, state[key]);
    save();
  });
}

/* ---------------- Refresh UI from state ---------------- */
function refresh() {
  $('#enabled').checked = !!state.enabled;
  $('#soundEnabled').checked = !!state.soundEnabled;
  $('#colorScheme').value = state.colorScheme;
  $('#soundPack').value = state.soundPack;
  $('#waveform').value = state.waveform;
  $('#hudPosition').value = state.hudPosition;

  $('#shakeIntensity').value = state.shakeIntensity;
  $('#shakeIntensityVal').textContent = state.shakeIntensity;
  $('#particleCount').value = state.particleCount;
  $('#particleCountVal').textContent = state.particleCount;
  $('#particleLifeMul').value = Math.round(state.particleLifeMul * 100);
  $('#particleLifeMulVal').textContent = state.particleLifeMul.toFixed(2) + '×';
  $('#gravity').value = Math.round(state.gravity * 100);
  $('#gravityVal').textContent = state.gravity.toFixed(2);
  $('#friction').value = Math.round(state.friction * 1000);
  $('#frictionVal').textContent = state.friction.toFixed(3);

  $('#spawnOffsetX').value = state.spawnOffsetX;
  $('#spawnOffsetXVal').textContent = state.spawnOffsetX + 'px';
  $('#spawnOffsetY').value = state.spawnOffsetY;
  $('#spawnOffsetYVal').textContent = state.spawnOffsetY + 'px';
  $('#spawnJitter').value = state.spawnJitter;
  $('#spawnJitterVal').textContent = state.spawnJitter + 'px';

  $('#hudScale').value = Math.round(state.hudScale * 100);
  $('#hudScaleVal').textContent = state.hudScale.toFixed(2) + '×';
  $('#hudOpacity').value = Math.round(state.hudOpacity * 100);
  $('#hudOpacityVal').textContent = Math.round(state.hudOpacity * 100) + '%';
  $('#comboTimeout').value = state.comboTimeout;
  $('#comboTimeoutVal').textContent = state.comboTimeout + 'ms';

  $('#volume').value = pct(state.volume);
  $('#volumeVal').textContent = pct(state.volume) + '%';
  $('#bitcrushAmount').value = pct(state.bitcrushAmount);
  $('#bitcrushAmountVal').textContent = pct(state.bitcrushAmount) + '%';

  $('#reducedMotion').checked = !!state.reducedMotion;
  $('#highContrast').checked = !!state.highContrast;
  $('#useWebGL').checked = !!state.useWebGL;
  $('#enableML').checked = !!state.enableML;
  $('#pasteAnimate').checked = !!state.pasteAnimate;
  $('#enterFlash').checked = !!state.enterFlash;
  $('#floatInChars').checked = !!state.floatInChars;
  $('#spamDetection').checked = !!state.spamDetection;
  $('#debugMode').checked = !!state.debugMode;
  $('#selectionEffects').checked = !!state.selectionEffects;
  $('#comboBar').checked = !!state.comboBar;
  $('#clickEffects').checked = !!state.clickEffects;
  $('#wordEffects').checked = !!state.wordEffects;
  $('#sentenceEffects').checked = !!state.sentenceEffects;
  $('#wpmIndicator').checked = !!state.wpmIndicator;
  $('#syncSettings').checked = !!state.syncSettings;
  $('#trailLength').value = state.trailLength;
  $('#trailLengthVal').textContent = state.trailLength;
  $('#backendKind').value = state.backendKind || 'auto';
  $('#backendUrl').value = state.backendUrl || '';
  $$('#comboBarStyleChips button').forEach(function (b) {
    b.classList.toggle('active', b.dataset.style === state.comboBarStyle);
  });
  $$('#themeChips button').forEach(function (b) {
    b.classList.toggle('active', b.dataset.theme === state.theme);
  });

  $$('#presetChips button').forEach(function (b) {
    b.classList.toggle('active', b.dataset.preset === state.preset);
  });

  refreshShapeToggles();
  refreshDirectionChips();
  updateCustomColorsVisibility();
  renderPalette();
  renderMilestones();
  renderDomains();
}

/* ---------------- Bind everything ---------------- */
function bindBasics() {
  bindCheckbox('enabled', 'enabled');
  bindCheckbox('soundEnabled', 'soundEnabled');
  bindCheckbox('reducedMotion', 'reducedMotion');
  bindCheckbox('highContrast', 'highContrast');
  bindCheckbox('useWebGL', 'useWebGL');
  bindCheckbox('enableML', 'enableML');
  bindCheckbox('pasteAnimate', 'pasteAnimate');
  bindCheckbox('enterFlash', 'enterFlash');
  bindCheckbox('floatInChars', 'floatInChars');
  bindCheckbox('spamDetection', 'spamDetection');
  bindCheckbox('debugMode', 'debugMode');
  bindCheckbox('selectionEffects', 'selectionEffects');
  bindCheckbox('comboBar', 'comboBar');
  bindCheckbox('clickEffects', 'clickEffects');
  bindCheckbox('wordEffects', 'wordEffects');
  bindCheckbox('sentenceEffects', 'sentenceEffects');
  bindCheckbox('wpmIndicator', 'wpmIndicator');
  bindCheckbox('syncSettings', 'syncSettings');
  bindSelect('backendKind', 'backendKind');
  bindRangeInt('trailLength', 'trailLength', 'trailLengthVal');
  $('#backendUrl').addEventListener('change', function (e) {
    state.backendUrl = (e.target.value || '').trim();
    save();
  });
  $$('#comboBarStyleChips button').forEach(function (b) {
    b.addEventListener('click', function () {
      state.comboBarStyle = b.dataset.style;
      $$('#comboBarStyleChips button').forEach(function (x) { x.classList.toggle('active', x === b); });
      save();
    });
  });

  bindSelect('colorScheme', 'colorScheme', updateCustomColorsVisibility);
  bindSelect('soundPack', 'soundPack');
  bindSelect('waveform', 'waveform');
  bindSelect('hudPosition', 'hudPosition');

  bindRangeInt('shakeIntensity', 'shakeIntensity', 'shakeIntensityVal');
  bindRangeInt('particleCount', 'particleCount', 'particleCountVal');
  bindRangeInt('spawnOffsetX', 'spawnOffsetX', 'spawnOffsetXVal', function (v) { return v + 'px'; });
  bindRangeInt('spawnOffsetY', 'spawnOffsetY', 'spawnOffsetYVal', function (v) { return v + 'px'; });
  bindRangeInt('spawnJitter', 'spawnJitter', 'spawnJitterVal', function (v) { return v + 'px'; });
  bindRangeInt('comboTimeout', 'comboTimeout', 'comboTimeoutVal', function (v) { return v + 'ms'; });

  bindRangeMapped('particleLifeMul', 'particleLifeMul', 'particleLifeMulVal',
    function (raw) { return raw / 100; },
    function (raw, v) { return v.toFixed(2) + '×'; }
  );
  bindRangeMapped('gravity', 'gravity', 'gravityVal',
    function (raw) { return raw / 100; },
    function (raw, v) { return v.toFixed(2); }
  );
  bindRangeMapped('friction', 'friction', 'frictionVal',
    function (raw) { return raw / 1000; },
    function (raw, v) { return v.toFixed(3); }
  );
  bindRangeMapped('hudScale', 'hudScale', 'hudScaleVal',
    function (raw) { return raw / 100; },
    function (raw, v) { return v.toFixed(2) + '×'; }
  );
  bindRangeMapped('hudOpacity', 'hudOpacity', 'hudOpacityVal',
    function (raw) { return raw / 100; },
    function (raw, v) { return Math.round(v * 100) + '%'; }
  );
  bindRangeMapped('volume', 'volume', 'volumeVal',
    function (raw) { return raw / 100; },
    function (raw) { return raw + '%'; }
  );
  bindRangeMapped('bitcrushAmount', 'bitcrushAmount', 'bitcrushAmountVal',
    function (raw) { return raw / 100; },
    function (raw) { return raw + '%'; }
  );

  $$('#presetChips button').forEach(function (b) {
    b.addEventListener('click', function () {
      state.preset = b.dataset.preset;
      const effect = PRESET_SIDE_EFFECTS[b.dataset.preset];
      if (effect) Object.assign(state, effect);
      refresh();
      save();
    });
  });

  $$('#themeChips button').forEach(function (b) {
    b.addEventListener('click', function () {
      const themeName = b.dataset.theme;
      const theme = THEMES[themeName];
      if (!theme) return;
      // Apply every theme field, ignoring metadata like label/icon.
      const skip = ['label', 'icon'];
      Object.keys(theme).forEach(function (k) {
        if (skip.indexOf(k) >= 0) return;
        if (k === 'customColors') {
          state.customColors = theme.customColors.slice();
          return;
        }
        state[k] = theme[k];
      });
      state.theme = themeName;
      refresh();
      save();
    });
  });

  $('#reset').addEventListener('click', function () {
    state = mergeDefaults({});
    refresh();
    save();
  });

  $('#openStats').addEventListener('click', function () {
    try {
      chrome.tabs.create({ url: chrome.runtime.getURL('stats.html') });
    } catch (e) { /* ignore */ }
  });
}

/* ---------------- FPS readout ---------------- */
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

/* ---------------- Boot ---------------- */
document.addEventListener('DOMContentLoaded', function () {
  load(function () {
    refresh();
    bindTabs();
    bindBasics();
    bindPalette();
    bindMilestones();
    bindDomains();
    bindShapeToggles();
    bindDirectionChips();
    pollFps();
    setInterval(pollFps, 1000);

    // Account bar: load + render + bind, then ping health once for the status dot.
    // If this is a fresh install (no friend code yet), show the onboarding
    // modal first — it covers the rest of the popup until the user submits.
    loadAccount(function () {
      renderAccountBar();
      bindAccountBar();
      bindOnboarding();
      if (isOnboardingNeeded()) {
        showOnboarding();
      } else {
        refreshStatusDot();
      }
    });
  });
});
