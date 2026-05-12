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

  /* ---------- Backend object ---------- */
  const MOCK_BACKEND = {
    name: 'local-mock',
    getMyAccount: function () { return getMyProfile(); },
    addFriendByCode: function (code, opts) { return addFriendByCode(code, opts); },
    removeFriend: function (code) { return removeFriend(code); },
    getFriends: function () { return getFriendsRows(); },
    getLeaderboard: function (kind, scope) { return getLeaderboard(kind, scope); },
    getStatus: function () { return getStatus(); },
    resetFriends: resetFriends
  };

  window.__powerMode.social = {
    init: load,
    backend: MOCK_BACKEND,
    _generateFriendCode: generateFriendCode,
    _normalizeCode: normalizeCode,
    _formatCode: formatCode,
    _seedFromCode: seedFromCode,
    _setSocial: function (s) { social = s; loaded = true; }
  };
})();
