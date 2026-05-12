/* PowerChrome social-api
 *
 * Frontend-facing interface for accounts / friends / leaderboards.
 * The current implementation is a local mock that uses chrome.storage.local
 * and synthesizes plausible global leaderboard rows so the UI is real and
 * testable end-to-end without a backend.
 *
 * To wire a real backend later, swap `BACKEND` for an implementation that
 * matches the same shape (see `MOCK_BACKEND` below). The rest of the UI
 * doesn't need to change.
 */
(function () {
  window.__powerMode = window.__powerMode || {};
  const SOCIAL_KEY = 'powerModeSocial';

  function hasChromeStorage() {
    return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  }

  /* ---------- Friend code generation ---------- */
  const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // omit confusables (I,O,0,1)
  function generateFriendCode() {
    let out = '';
    const bytes = new Uint8Array(8);
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    for (let i = 0; i < 8; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
    return out.slice(0, 4) + '-' + out.slice(4, 8);
  }

  function normalizeCode(s) {
    return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  }

  function formatCode(c) {
    const n = normalizeCode(c);
    if (n.length !== 8) return n;
    return n.slice(0, 4) + '-' + n.slice(4, 8);
  }

  /* ---------- Local persistence ---------- */
  let social = null;
  let loaded = false;

  function defaults() {
    return {
      account: {
        code: generateFriendCode(),
        createdAt: new Date().toISOString(),
        backend: 'local-mock'
      },
      friends: [], // [{ code, username, avatar, addedAt, stats: { highestCombo, totalChars, totalEnters, totalDeletes } }]
      backendStatus: 'local-only'
    };
  }

  function load(cb) {
    if (!hasChromeStorage()) {
      social = defaults();
      loaded = true;
      if (cb) cb(social);
      return;
    }
    try {
      chrome.storage.local.get([SOCIAL_KEY], function (res) {
        const stored = res && res[SOCIAL_KEY];
        if (stored && stored.account && stored.account.code) {
          social = Object.assign(defaults(), stored);
          // Sanitize friends list
          social.friends = (social.friends || []).filter(function (f) {
            return f && typeof f.code === 'string';
          });
        } else {
          social = defaults();
          persist();
        }
        loaded = true;
        if (cb) cb(social);
      });
    } catch (e) {
      social = defaults();
      loaded = true;
      if (cb) cb(social);
    }
  }

  function persist() {
    if (!hasChromeStorage() || !social) return;
    try {
      const payload = {};
      payload[SOCIAL_KEY] = social;
      chrome.storage.local.set(payload);
    } catch (e) { /* ignore */ }
  }

  /* ---------- Backend interface ---------- *
   *
   * A real backend impl should expose:
   *   getMyAccount() -> { code, username, avatar }
   *   addFriendByCode(code) -> Promise<{ ok, friend?, error? }>
   *   removeFriend(code) -> Promise<{ ok }>
   *   getFriends() -> Promise<friendArray>
   *   getLeaderboard(kind, scope) -> Promise<rows>
   *     kind: 'combo' | 'chars'
   *     scope: 'friends' | 'global'
   *
   * The mock backend below produces deterministic-ish synthetic global rows
   * so the leaderboard tab looks alive in local-only mode.
   */

  /* ---------- Mock global leaderboard ---------- */
  const SYNTHETIC_GLOBAL = [
    { name: 'NotchHero',     avatar: '⚡', highestCombo: 1742, totalChars: 481213 },
    { name: 'KeyboardKing',  avatar: '👾', highestCombo: 1284, totalChars: 397210 },
    { name: 'PixelPunisher', avatar: '🎮', highestCombo: 1107, totalChars: 351999 },
    { name: 'BoltRunner',    avatar: '🚀', highestCombo:  956, totalChars: 290413 },
    { name: 'MochaMash',     avatar: '☄️', highestCombo:  712, totalChars: 244020 },
    { name: 'TypoNebula',    avatar: '🌌', highestCombo:  611, totalChars: 198440 },
    { name: 'GlitchKitten',  avatar: '🐱', highestCombo:  574, totalChars: 176200 },
    { name: 'ArcadeFox',     avatar: '🦊', highestCombo:  502, totalChars: 154110 }
  ];

  function getMyProfile() {
    const stats = window.__powerMode.stats ? window.__powerMode.stats.getSnapshot() : null;
    const profile = (stats && stats.profile) || { username: '', avatar: '⚡' };
    const highestCombo = stats ? (stats.highestCombo || 0) : 0;
    const totalChars = stats ? (stats.totalChars || 0) : 0;
    return {
      code: social ? social.account.code : '',
      username: profile.username || 'you',
      avatar: profile.avatar || '⚡',
      highestCombo: highestCombo,
      totalChars: totalChars
    };
  }

  function getFriendsRows() {
    const me = getMyProfile();
    const list = [];
    list.push({
      isMe: true,
      code: me.code,
      name: me.username,
      avatar: me.avatar,
      highestCombo: me.highestCombo,
      totalChars: me.totalChars
    });
    (social ? social.friends : []).forEach(function (f) {
      list.push({
        isMe: false,
        code: f.code,
        name: f.username || 'friend',
        avatar: f.avatar || '🙂',
        highestCombo: (f.stats && f.stats.highestCombo) || 0,
        totalChars: (f.stats && f.stats.totalChars) || 0
      });
    });
    return list;
  }

  function getGlobalRows() {
    const me = getMyProfile();
    const rows = SYNTHETIC_GLOBAL.map(function (r) {
      return Object.assign({ isMe: false, code: '' }, r, { name: r.name });
    });
    rows.push({
      isMe: true,
      code: me.code,
      name: me.username,
      avatar: me.avatar,
      highestCombo: me.highestCombo,
      totalChars: me.totalChars
    });
    return rows;
  }

  function getLeaderboard(kind, scope) {
    const rows = scope === 'global' ? getGlobalRows() : getFriendsRows();
    const field = kind === 'chars' ? 'totalChars' : 'highestCombo';
    rows.sort(function (a, b) { return (b[field] || 0) - (a[field] || 0); });
    return rows;
  }

  function addFriendByCode(rawCode, opts) {
    const code = normalizeCode(rawCode);
    if (code.length !== 8) {
      return { ok: false, error: 'Code must be 8 characters (e.g. ABCD-EFGH).' };
    }
    if (social.account && code === normalizeCode(social.account.code)) {
      return { ok: false, error: "You can't add yourself." };
    }
    const existing = social.friends.find(function (f) { return normalizeCode(f.code) === code; });
    if (existing) {
      return { ok: false, error: 'Already in your friends list.' };
    }
    // Mock: synthesize plausible stats from the code so each code is its own "person".
    const seed = seedFromCode(code);
    const friend = {
      code: formatCode(code),
      username: (opts && opts.username) || pickName(seed),
      avatar: (opts && opts.avatar) || pickAvatar(seed),
      addedAt: new Date().toISOString(),
      stats: {
        highestCombo: 80 + Math.floor(seed.rand() * 1500),
        totalChars: 1000 + Math.floor(seed.rand() * 350000),
        totalEnters: Math.floor(seed.rand() * 8000),
        totalDeletes: Math.floor(seed.rand() * 12000)
      },
      _synthetic: true
    };
    social.friends.push(friend);
    persist();
    return { ok: true, friend: friend };
  }

  function removeFriend(rawCode) {
    const code = normalizeCode(rawCode);
    const before = social.friends.length;
    social.friends = social.friends.filter(function (f) {
      return normalizeCode(f.code) !== code;
    });
    persist();
    return { ok: social.friends.length < before };
  }

  function seedFromCode(code) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < code.length; i++) {
      h = (h ^ code.charCodeAt(i)) >>> 0;
      h = ((h * 16777619) >>> 0);
    }
    return {
      rand: function () {
        h = ((h * 1103515245) + 12345) >>> 0;
        return (h / 0x100000000);
      }
    };
  }

  const FRIEND_NAMES = ['Specter', 'Pixie', 'Vortex', 'Orbit', 'Ember', 'Glitch', 'Cipher', 'Nova', 'Quasar', 'Rune', 'Sable', 'Tide', 'Echo', 'Halo', 'Jolt', 'Kite'];
  const FRIEND_AVATARS = ['🦊', '🐉', '🦋', '🐙', '🦉', '🚀', '🌌', '⚙️', '🎮', '👾', '🌀', '☄️'];
  function pickName(seed) { return FRIEND_NAMES[Math.floor(seed.rand() * FRIEND_NAMES.length)] + Math.floor(seed.rand() * 99); }
  function pickAvatar(seed) { return FRIEND_AVATARS[Math.floor(seed.rand() * FRIEND_AVATARS.length)]; }

  function getStatus() {
    return {
      backend: 'local-mock',
      myCode: social ? social.account.code : null,
      friendCount: social ? social.friends.length : 0,
      createdAt: social ? social.account.createdAt : null
    };
  }

  function resetFriends() {
    if (!social) return;
    social.friends = [];
    persist();
  }

  /* ---------- Mock backend ---------- */
  const MOCK_BACKEND = {
    name: 'local-mock',
    isSync: true,
    getMyAccount: function () { return getMyProfile(); },
    addFriendByCode: function (code, opts) { return addFriendByCode(code, opts); },
    removeFriend: function (code) { return removeFriend(code); },
    getFriends: function () { return getFriendsRows(); },
    getLeaderboard: function (kind, scope) { return getLeaderboard(kind, scope); },
    getStatus: function () { return getStatus(); },
    resetFriends: resetFriends,
    updateProfile: function () {
      // Mock backend reads the profile from local stats every render, so there's
      // nothing to push — just succeed.
      return { ok: true };
    }
  };

  /* ---------- Remote backend ---------- *
   * Talks to the deployed PowerChrome API (server/ directory). Storage layout:
   *   chrome.storage.local.powerModeAccount = { friendCode, token, backendUrl }
   * Tokens are persisted locally; the API never lowers stats so re-sync is safe.
   *
   * Auto-fallback: if a network call fails twice in a row, we fall back to the
   * mock backend for the remainder of the session so the UI never deadlocks
   * on an unreachable server.
   */
  const DEFAULT_BACKEND_URL = 'https://powerchrome-api.vercel.app';
  const REMOTE_CACHE = { friends: [], leaderboards: {}, status: { backend: 'remote', online: false } };
  let remoteAccount = null;
  let remoteUrl = '';
  let remoteFailureCount = 0;
  let remoteListeners = [];

  function notifyRemote() {
    for (let i = 0; i < remoteListeners.length; i++) {
      try { remoteListeners[i](); } catch (e) { /* ignore */ }
    }
  }

  function hasChromeStorageRemote() {
    return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  }

  function loadRemoteAccount(cb) {
    if (!hasChromeStorageRemote()) { remoteAccount = null; if (cb) cb(); return; }
    try {
      chrome.storage.local.get(['powerModeAccount'], function (res) {
        remoteAccount = (res && res.powerModeAccount) || null;
        if (cb) cb();
      });
    } catch (e) { remoteAccount = null; if (cb) cb(); }
  }

  function saveRemoteAccount() {
    if (!hasChromeStorageRemote() || !remoteAccount) return;
    try { chrome.storage.local.set({ powerModeAccount: remoteAccount }); } catch (e) { /* ignore */ }
  }

  function getRemoteUrl() {
    if (remoteUrl) return remoteUrl;
    const s = window.__powerMode.main && window.__powerMode.main.getSettings();
    if (s && s.backendUrl) return s.backendUrl;
    return DEFAULT_BACKEND_URL;
  }

  function apiUrl(path) {
    return getRemoteUrl().replace(/\/$/, '') + path;
  }

  async function apiPost(path, body, opts) {
    const ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    const timeout = setTimeout(function () { if (ctrl) ctrl.abort(); }, (opts && opts.timeoutMs) || 6000);
    try {
      const res = await fetch(apiUrl(path), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body || {}),
        signal: ctrl ? ctrl.signal : undefined
      });
      clearTimeout(timeout);
      if (!res.ok) {
        const text = await res.text();
        const err = new Error('http ' + res.status);
        err.payload = text;
        throw err;
      }
      return await res.json();
    } catch (e) {
      clearTimeout(timeout);
      throw e;
    }
  }

  async function apiHealth() {
    const ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    const timeout = setTimeout(function () { if (ctrl) ctrl.abort(); }, 4000);
    try {
      const res = await fetch(apiUrl('/api/health'), { signal: ctrl ? ctrl.signal : undefined });
      clearTimeout(timeout);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      clearTimeout(timeout);
      return null;
    }
  }

  async function ensureRemoteAccount() {
    if (!remoteAccount) await new Promise(function (r) { loadRemoteAccount(r); });
    if (remoteAccount && remoteAccount.token) return remoteAccount;

    // Create a brand-new account on the server. Username/avatar come from
    // local stats if present so the cloud profile matches the local one.
    const stats = window.__powerMode.stats ? window.__powerMode.stats.getSnapshot() : null;
    const profile = (stats && stats.profile) || { username: '', avatar: '⚡' };
    const result = await apiPost('/api/account/init', {
      username: profile.username || 'player',
      avatar: profile.avatar || '⚡'
    });
    if (!result || !result.ok) throw new Error('init failed');
    remoteAccount = {
      friendCode: result.friendCode,
      token: result.token,
      createdAt: new Date().toISOString()
    };
    saveRemoteAccount();
    return remoteAccount;
  }

  function markRemoteFailure() {
    remoteFailureCount++;
    REMOTE_CACHE.status.online = false;
    notifyRemote();
  }
  function markRemoteSuccess() {
    remoteFailureCount = 0;
    REMOTE_CACHE.status.online = true;
    notifyRemote();
  }

  async function pingRemote() {
    const h = await apiHealth();
    if (h && h.ok) {
      REMOTE_CACHE.status.online = true;
      REMOTE_CACHE.status.storage = h.storage;
      REMOTE_CACHE.status.serverUrl = getRemoteUrl();
    } else {
      REMOTE_CACHE.status.online = false;
    }
    notifyRemote();
    return h;
  }

  async function syncStatsToRemote() {
    if (!remoteAccount || !remoteAccount.token) return;
    const stats = window.__powerMode.stats ? window.__powerMode.stats.getSnapshot() : null;
    if (!stats) return;
    try {
      await apiPost('/api/stats/sync', {
        token: remoteAccount.token,
        highestCombo: stats.highestCombo || 0,
        totalChars: stats.totalChars || 0,
        totalDeletes: stats.totalDeletes || 0,
        totalEnters: stats.totalEnters || 0
      });
      markRemoteSuccess();
    } catch (e) {
      markRemoteFailure();
    }
  }

  async function updateProfileOnRemote(profile) {
    profile = profile || {};
    try {
      const acc = await ensureRemoteAccount();
      const res = await apiPost('/api/account/update', {
        token: acc.token,
        username: profile.username,
        avatar: profile.avatar
      });
      if (res && res.ok) {
        markRemoteSuccess();
        // Force fresh leaderboards so the updated name shows immediately.
        await Promise.all([
          refreshRemoteFriends(),
          refreshRemoteLeaderboard('combo', 'friends'),
          refreshRemoteLeaderboard('combo', 'global'),
          refreshRemoteLeaderboard('chars', 'friends'),
          refreshRemoteLeaderboard('chars', 'global')
        ]);
        return { ok: true, account: res.account };
      }
      return { ok: false, error: (res && res.error) || 'unknown' };
    } catch (e) {
      markRemoteFailure();
      return { ok: false, error: 'network' };
    }
  }

  async function refreshRemoteFriends() {
    if (!remoteAccount || !remoteAccount.token) return [];
    try {
      const res = await apiPost('/api/friends/list', { token: remoteAccount.token });
      if (res && res.ok) {
        REMOTE_CACHE.friends = (res.friends || []).map(function (f) {
          return Object.assign({ isMe: false }, f, { name: f.username || 'friend' });
        });
        markRemoteSuccess();
      }
    } catch (e) {
      markRemoteFailure();
    }
    return REMOTE_CACHE.friends;
  }

  async function refreshRemoteLeaderboard(kind, scope) {
    const key = kind + '/' + scope;
    if (!remoteAccount || !remoteAccount.token) return [];
    try {
      const res = await apiPost('/api/leaderboard', {
        token: remoteAccount.token,
        kind: kind,
        scope: scope,
        limit: 20
      });
      if (res && res.ok) {
        REMOTE_CACHE.leaderboards[key] = (res.rows || []).map(function (r) {
          return Object.assign({ name: r.username || 'player' }, r);
        });
        markRemoteSuccess();
      }
    } catch (e) {
      markRemoteFailure();
    }
    return REMOTE_CACHE.leaderboards[key] || [];
  }

  const REMOTE_BACKEND = {
    name: 'remote',
    isSync: false,
    init: async function () {
      await new Promise(function (r) { loadRemoteAccount(r); });
      const h = await pingRemote();
      if (h && h.ok) {
        try { await ensureRemoteAccount(); } catch (e) { /* swallow */ }
        await Promise.all([refreshRemoteFriends(), refreshRemoteLeaderboard('combo', 'friends'), refreshRemoteLeaderboard('combo', 'global')]);
      }
    },
    getMyAccount: function () {
      if (!remoteAccount) return { code: '— pending —', username: '', avatar: '⚡', highestCombo: 0, totalChars: 0 };
      const stats = window.__powerMode.stats ? window.__powerMode.stats.getSnapshot() : null;
      const profile = (stats && stats.profile) || { username: '', avatar: '⚡' };
      return {
        code: remoteAccount.friendCode,
        username: profile.username || 'you',
        avatar: profile.avatar || '⚡',
        highestCombo: stats ? stats.highestCombo || 0 : 0,
        totalChars: stats ? stats.totalChars || 0 : 0
      };
    },
    addFriendByCode: async function (rawCode) {
      try {
        const acc = await ensureRemoteAccount();
        const res = await apiPost('/api/friends/add', { token: acc.token, code: rawCode });
        if (res && res.ok) {
          markRemoteSuccess();
          await refreshRemoteFriends();
          await refreshRemoteLeaderboard('combo', 'friends');
          return { ok: true, friend: res.friend };
        }
        return { ok: false, error: (res && res.error) || 'unknown error' };
      } catch (e) {
        markRemoteFailure();
        return { ok: false, error: 'network error — backend unreachable' };
      }
    },
    removeFriend: async function (code) {
      try {
        const acc = await ensureRemoteAccount();
        await apiPost('/api/friends/remove', { token: acc.token, code: code });
        markRemoteSuccess();
        await refreshRemoteFriends();
        return { ok: true };
      } catch (e) {
        markRemoteFailure();
        return { ok: false };
      }
    },
    getFriends: function () {
      // Synchronous read of cached list with the current user injected so the
      // stats page shows the "me" row even before the first refresh completes.
      const me = REMOTE_BACKEND.getMyAccount();
      const out = [{
        isMe: true,
        code: me.code,
        name: me.username,
        username: me.username,
        avatar: me.avatar,
        highestCombo: me.highestCombo,
        totalChars: me.totalChars
      }];
      (REMOTE_CACHE.friends || []).forEach(function (f) { out.push(f); });
      return out;
    },
    getLeaderboard: function (kind, scope) {
      const key = kind + '/' + scope;
      // Kick off a fresh fetch in the background; return cached for immediate paint.
      refreshRemoteLeaderboard(kind, scope);
      const rows = (REMOTE_CACHE.leaderboards[key] || []).slice();
      const field = kind === 'chars' ? 'totalChars' : 'highestCombo';
      rows.sort(function (a, b) { return (b[field] || 0) - (a[field] || 0); });
      return rows;
    },
    getStatus: function () {
      return {
        backend: 'remote',
        myCode: remoteAccount ? remoteAccount.friendCode : null,
        friendCount: REMOTE_CACHE.friends.length,
        createdAt: remoteAccount ? remoteAccount.createdAt : null,
        online: REMOTE_CACHE.status.online,
        serverUrl: getRemoteUrl(),
        serverStorage: REMOTE_CACHE.status.storage || null
      };
    },
    ping: pingRemote,
    syncStats: syncStatsToRemote,
    refreshFriends: refreshRemoteFriends,
    refreshLeaderboard: refreshRemoteLeaderboard,
    updateProfile: updateProfileOnRemote,
    onChange: function (fn) { remoteListeners.push(fn); return function () { remoteListeners = remoteListeners.filter(function (x) { return x !== fn; }); }; }
  };

  /* ---------- Auto-fallback wrapper ---------- *
   * Picks remote if backendKind === 'auto' and the server is reachable,
   * otherwise mock. Re-evaluated when settings change or pings fail.
   */
  let activeBackendName = 'local-mock';

  function pickBackend() {
    const s = window.__powerMode.main && window.__powerMode.main.getSettings();
    const kind = s && s.backendKind;
    if (kind === 'local') return MOCK_BACKEND;
    if (kind === 'remote') return REMOTE_BACKEND;
    // 'auto': use remote if online, mock otherwise
    if (REMOTE_CACHE.status.online && remoteFailureCount < 3) return REMOTE_BACKEND;
    if (remoteFailureCount >= 3) return MOCK_BACKEND;
    return REMOTE_BACKEND;
  }

  function backendProxy() {
    return {
      get name() { return pickBackend().name; },
      getMyAccount: function () { return pickBackend().getMyAccount(); },
      addFriendByCode: function () { const b = pickBackend(); return b.addFriendByCode.apply(b, arguments); },
      removeFriend: function () { const b = pickBackend(); return b.removeFriend.apply(b, arguments); },
      getFriends: function () { return pickBackend().getFriends(); },
      getLeaderboard: function () { const b = pickBackend(); return b.getLeaderboard.apply(b, arguments); },
      getStatus: function () { return pickBackend().getStatus(); },
      updateProfile: function () {
        const b = pickBackend();
        if (b.updateProfile) return b.updateProfile.apply(b, arguments);
        return Promise.resolve({ ok: true });
      },
      isRemoteOnline: function () { return !!REMOTE_CACHE.status.online; }
    };
  }

  /* ---------- Periodic sync ---------- */
  let syncTimer = null;
  function startPeriodicSync() {
    if (syncTimer) return;
    syncTimer = setInterval(async function () {
      const s = window.__powerMode.main && window.__powerMode.main.getSettings();
      const kind = s ? s.backendKind : 'auto';
      if (kind === 'local') return;
      try {
        await REMOTE_BACKEND.syncStats();
      } catch (e) { /* swallow */ }
    }, 15000);
  }

  /* ---------- Public surface ---------- */
  const proxy = backendProxy();

  window.__powerMode.social = {
    init: function (cb) {
      load(async function () {
        const s = window.__powerMode.main && window.__powerMode.main.getSettings();
        const kind = s ? s.backendKind : 'auto';
        if (kind !== 'local') {
          try { await REMOTE_BACKEND.init(); } catch (e) { /* swallow */ }
          startPeriodicSync();
        }
        if (cb) cb(social);
      });
    },
    backend: proxy,
    mockBackend: MOCK_BACKEND,
    remoteBackend: REMOTE_BACKEND,
    onRemoteChange: function (fn) { return REMOTE_BACKEND.onChange(fn); },
    _generateFriendCode: generateFriendCode,
    _normalizeCode: normalizeCode,
    _formatCode: formatCode,
    _seedFromCode: seedFromCode,
    _setSocial: function (s) { social = s; loaded = true; },
    _pickBackendName: function () { return pickBackend().name; }
  };
})();
