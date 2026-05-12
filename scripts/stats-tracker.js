(function () {
  window.__powerMode = window.__powerMode || {};
  const STORAGE_KEY = 'powerModeStats';

  const DEFAULT_STATS = {
    profile: { username: '', avatar: '⚡' },
    totalChars: 0,
    totalDeletes: 0,
    totalPastes: 0,
    totalPasteChars: 0,
    totalEnters: 0,
    highestCombo: 0,
    longestStreakMs: 0,
    totalActiveMs: 0,
    charsPerDay: {},
    charsBySite: {},
    milestonesHit: {},
    firstUseDate: '',
    lastUseDate: ''
  };

  let stats = null;
  let dirty = false;
  let lastSaveAt = 0;
  let lastActivityAt = 0;
  let currentStreakMs = 0;
  let loaded = false;

  function hasChromeStorage() {
    return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  }

  function isoDate(d) {
    d = d || new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function cloneDefaults() {
    return JSON.parse(JSON.stringify(DEFAULT_STATS));
  }

  function ensureStructure() {
    if (!stats || typeof stats !== 'object') stats = cloneDefaults();
    if (!stats.profile) stats.profile = { username: '', avatar: '⚡' };
    if (!stats.charsPerDay) stats.charsPerDay = {};
    if (!stats.charsBySite) stats.charsBySite = {};
    if (!stats.milestonesHit) stats.milestonesHit = {};
    if (!stats.firstUseDate) stats.firstUseDate = isoDate();
    stats.lastUseDate = isoDate();
    // Trim per-day map to last 60 entries to avoid unbounded growth
    const days = Object.keys(stats.charsPerDay).sort();
    if (days.length > 60) {
      const keep = days.slice(days.length - 60);
      const next = {};
      keep.forEach(function (k) { next[k] = stats.charsPerDay[k]; });
      stats.charsPerDay = next;
    }
    // Trim per-site map to top 50 by count
    const siteEntries = Object.keys(stats.charsBySite).map(function (k) { return [k, stats.charsBySite[k]]; });
    if (siteEntries.length > 50) {
      siteEntries.sort(function (a, b) { return b[1] - a[1]; });
      const next = {};
      siteEntries.slice(0, 50).forEach(function (e) { next[e[0]] = e[1]; });
      stats.charsBySite = next;
    }
  }

  function load(cb) {
    if (!hasChromeStorage()) {
      stats = cloneDefaults();
      ensureStructure();
      loaded = true;
      if (cb) cb(stats);
      return;
    }
    try {
      chrome.storage.local.get([STORAGE_KEY], function (res) {
        const stored = res && res[STORAGE_KEY];
        stats = stored && typeof stored === 'object' ? Object.assign(cloneDefaults(), stored) : cloneDefaults();
        ensureStructure();
        loaded = true;
        if (cb) cb(stats);
      });
    } catch (e) {
      stats = cloneDefaults();
      ensureStructure();
      loaded = true;
      if (cb) cb(stats);
    }
  }

  function maybeSave(force) {
    if (!hasChromeStorage()) return;
    if (!stats) return;
    const now = performance.now();
    if (!force && now - lastSaveAt < 2000) return;
    if (!dirty && !force) return;
    lastSaveAt = now;
    dirty = false;
    try {
      const payload = {};
      payload[STORAGE_KEY] = stats;
      chrome.storage.local.set(payload);
    } catch (e) { /* ignore */ }
  }

  function touchActivity() {
    const now = performance.now();
    if (lastActivityAt) {
      const dt = now - lastActivityAt;
      if (dt < 30000) {
        stats.totalActiveMs = (stats.totalActiveMs || 0) + dt;
        currentStreakMs += dt;
        if (currentStreakMs > (stats.longestStreakMs || 0)) {
          stats.longestStreakMs = Math.floor(currentStreakMs);
        }
      } else {
        currentStreakMs = 0;
      }
    }
    lastActivityAt = now;
  }

  function currentSiteKey() {
    const h = (typeof location !== 'undefined' && location.hostname) ? location.hostname.toLowerCase() : '';
    return h.replace(/^www\./, '');
  }

  function bumpDay(n) {
    const k = isoDate();
    stats.charsPerDay[k] = (stats.charsPerDay[k] || 0) + n;
  }

  function bumpSite(n) {
    const k = currentSiteKey();
    if (!k) return;
    stats.charsBySite[k] = (stats.charsBySite[k] || 0) + n;
  }

  function recordChar() {
    if (!loaded || !stats) return;
    ensureStructure();
    touchActivity();
    stats.totalChars++;
    bumpDay(1);
    bumpSite(1);
    dirty = true;
    maybeSave(false);
  }

  function recordDelete() {
    if (!loaded || !stats) return;
    ensureStructure();
    touchActivity();
    stats.totalDeletes++;
    dirty = true;
    maybeSave(false);
  }

  function recordEnter() {
    if (!loaded || !stats) return;
    ensureStructure();
    stats.totalEnters++;
    dirty = true;
    maybeSave(false);
  }

  function recordPaste(charCount) {
    if (!loaded || !stats) return;
    ensureStructure();
    touchActivity();
    stats.totalPastes++;
    stats.totalPasteChars += charCount || 0;
    bumpDay(charCount || 0);
    bumpSite(charCount || 0);
    dirty = true;
    maybeSave(false);
  }

  function recordCombo(count) {
    if (!loaded || !stats) return;
    if (typeof count !== 'number' || !count) return;
    if (count > (stats.highestCombo || 0)) {
      stats.highestCombo = count;
      dirty = true;
      maybeSave(false);
    }
  }

  function recordMilestone(name) {
    if (!loaded || !stats || !name) return;
    ensureStructure();
    stats.milestonesHit[name] = (stats.milestonesHit[name] || 0) + 1;
    dirty = true;
    maybeSave(false);
  }

  function setProfile(profile) {
    if (!loaded || !stats) return;
    ensureStructure();
    stats.profile = Object.assign({}, stats.profile, profile || {});
    dirty = true;
    maybeSave(true);
  }

  function getSnapshot() {
    return stats ? JSON.parse(JSON.stringify(stats)) : cloneDefaults();
  }

  function resetAll() {
    stats = cloneDefaults();
    ensureStructure();
    dirty = true;
    maybeSave(true);
  }

  // Periodic flush
  if (typeof window !== 'undefined') {
    setInterval(function () { maybeSave(true); }, 5000);
    window.addEventListener('beforeunload', function () { maybeSave(true); });
  }

  window.__powerMode.stats = {
    init: load,
    recordChar: recordChar,
    recordDelete: recordDelete,
    recordEnter: recordEnter,
    recordPaste: recordPaste,
    recordCombo: recordCombo,
    recordMilestone: recordMilestone,
    setProfile: setProfile,
    getSnapshot: getSnapshot,
    resetAll: resetAll,
    flush: function () { maybeSave(true); },
    _DEFAULT_STATS: DEFAULT_STATS,
    _isoDate: isoDate,
    _setStats: function (s) { stats = s; loaded = true; ensureStructure(); }
  };
})();
