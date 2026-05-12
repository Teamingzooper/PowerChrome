(function () {
  window.__powerMode = window.__powerMode || {};
  const STORAGE_KEY = 'powerModeML';
  let data = null;
  const typingTimestamps = [];

  function hasChromeStorage() {
    return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  }

  function loadData(cb) {
    if (!hasChromeStorage()) {
      data = {};
      if (cb) cb(data);
      return;
    }
    try {
      chrome.storage.local.get([STORAGE_KEY], function (res) {
        data = (res && res[STORAGE_KEY]) || {};
        if (cb) cb(data);
      });
    } catch (e) {
      data = {};
      if (cb) cb(data);
    }
  }

  function persist() {
    if (!hasChromeStorage()) return;
    try {
      const payload = {};
      payload[STORAGE_KEY] = data;
      chrome.storage.local.set(payload);
    } catch (e) { /* ignore */ }
  }

  function siteCategory() {
    const h = (typeof location !== 'undefined' && location.hostname) ? location.hostname.toLowerCase() : '';
    if (/github\.com|gitlab\.com|bitbucket\.org|stackoverflow\.com/.test(h)) return 'code';
    if (/docs\.google\.com|medium\.com|notion\.so|substack\.com|wordpress\.com/.test(h)) return 'writing';
    if (/twitter\.com|x\.com|reddit\.com|facebook\.com|instagram\.com|threads\.net/.test(h)) return 'social';
    return 'other';
  }

  function typingSpeedBucket() {
    const now = performance.now();
    while (typingTimestamps.length && now - typingTimestamps[0] > 30000) typingTimestamps.shift();
    const minutes = 0.5;
    const wpm = (typingTimestamps.length / 5) / minutes;
    if (wpm < 30) return 'slow';
    if (wpm < 60) return 'med';
    return 'fast';
  }

  function recordKeystroke() {
    typingTimestamps.push(performance.now());
  }

  function contextKey() {
    const h = new Date().getHours();
    const bucket = Math.floor(h / 4);
    return bucket + '_' + siteCategory() + '_' + typingSpeedBucket();
  }

  function observe(setting, value) {
    if (data == null) data = {};
    const k = contextKey();
    if (!data[k]) data[k] = { _count: 0 };
    const ctx = data[k];
    ctx._count++;
    if (typeof value === 'number') {
      ctx[setting] = (ctx[setting] != null) ? ctx[setting] * 0.8 + value * 0.2 : value;
    } else {
      ctx[setting] = value;
    }
    persist();
  }

  function getSuggestion() {
    if (data == null) return null;
    const k = contextKey();
    const ctx = data[k];
    if (!ctx || ctx._count < 10) return null;
    const out = {};
    for (const key in ctx) {
      if (key === '_count') continue;
      out[key] = ctx[key];
    }
    return out;
  }

  function enabled() {
    const s = window.__powerMode.main && window.__powerMode.main.getSettings();
    return !!(s && s.enableML);
  }

  window.__powerMode.ml = {
    init: loadData,
    observe: observe,
    getSuggestion: getSuggestion,
    recordKeystroke: recordKeystroke,
    get enabled() { return enabled(); },
    _contextKey: contextKey,
    _setData: function (d) { data = d; },
    _getData: function () { return data; },
    _siteCategory: siteCategory,
    _typingSpeedBucket: typingSpeedBucket
  };
})();
