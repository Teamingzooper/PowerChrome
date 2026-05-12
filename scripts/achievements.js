/* Achievements.
 *
 * Catalog of badges that unlock from the existing stats counters.
 * checks run after every stat write (debounced). Newly-unlocked badges
 * also fire an in-page toast.
 */
(function () {
  window.__powerMode = window.__powerMode || {};

  const CATALOG = [
    // Combos
    { id: 'first-strike',    icon: '⚡', name: 'First Strike',       desc: 'Type your first character.',
      check: function (s) { return (s.totalChars || 0) >= 1; } },
    { id: 'hot-streak',      icon: '🔥', name: 'Hot Streak',         desc: 'Reach a 10× combo.',
      check: function (s) { return (s.highestCombo || 0) >= 10; } },
    { id: 'galactic',        icon: '🌌', name: 'Galactic',           desc: 'Reach a 50× combo.',
      check: function (s) { return (s.highestCombo || 0) >= 50; } },
    { id: 'supernova-tier',  icon: '💥', name: 'Supernova',          desc: 'Reach a 100× combo.',
      check: function (s) { return (s.highestCombo || 0) >= 100; } },
    { id: 'big-bang',        icon: '🚀', name: 'Big Bang',           desc: 'Reach a 500× combo.',
      check: function (s) { return (s.highestCombo || 0) >= 500; } },
    { id: 'universe',        icon: '♾️', name: 'Universe Achieved',   desc: 'Reach a 1000× combo.',
      check: function (s) { return (s.highestCombo || 0) >= 1000; } },

    // Volume
    { id: 'first-thousand',  icon: '✍️', name: 'First Thousand',     desc: '1,000 characters typed.',
      check: function (s) { return (s.totalChars || 0) >= 1000; } },
    { id: 'novelist',        icon: '📖', name: 'Novelist',           desc: '100,000 characters typed.',
      check: function (s) { return (s.totalChars || 0) >= 100000; } },
    { id: 'first-million',   icon: '💎', name: 'First Million',      desc: '1,000,000 characters typed.',
      check: function (s) { return (s.totalChars || 0) >= 1000000; } },

    // Speed
    { id: 'quick-fingers',   icon: '🏃', name: 'Quick Fingers',      desc: 'Peak WPM over 60.',
      check: function (s) { return (s.wpmPeak || 0) >= 60; } },
    { id: 'speed-demon',     icon: '⚡', name: 'Speed Demon',         desc: 'Peak WPM over 100.',
      check: function (s) { return (s.wpmPeak || 0) >= 100; } },
    { id: 'lightning',       icon: '🌩️', name: 'Lightning Fingers',  desc: 'Peak WPM over 140.',
      check: function (s) { return (s.wpmPeak || 0) >= 140; } },

    // Sessions
    { id: 'marathoner',      icon: '🏅', name: 'Marathoner',         desc: '30 minute unbroken streak.',
      check: function (s) { return (s.longestStreakMs || 0) >= 30 * 60 * 1000; } },
    { id: 'hour-glass',      icon: '⏳', name: 'Hour Glass',         desc: '1 hour total active time.',
      check: function (s) { return (s.totalActiveMs || 0) >= 60 * 60 * 1000; } },
    { id: 'day-tripper',     icon: '🌗', name: 'Day Tripper',        desc: '24 hours of total active time.',
      check: function (s) { return (s.totalActiveMs || 0) >= 24 * 60 * 60 * 1000; } },

    // Sites
    { id: 'polyglot',        icon: '🌐', name: 'Polyglot',           desc: 'Type on 10 different sites.',
      check: function (s) { return Object.keys(s.charsBySite || {}).length >= 10; } },
    { id: 'globe-trotter',   icon: '🗺️', name: 'Globe Trotter',      desc: 'Type on 25 different sites.',
      check: function (s) { return Object.keys(s.charsBySite || {}).length >= 25; } },

    // Time of day
    { id: 'night-owl',       icon: '🦉', name: 'Night Owl',          desc: '1,000 characters between midnight and 4am.',
      check: function (s) {
        const h = s.charsByHour || {};
        return (h['0']||0) + (h['1']||0) + (h['2']||0) + (h['3']||0) >= 1000;
      } },
    { id: 'early-bird',      icon: '🐦', name: 'Early Bird',         desc: '1,000 characters between 5am and 7am.',
      check: function (s) {
        const h = s.charsByHour || {};
        return (h['5']||0) + (h['6']||0) + (h['7']||0) >= 1000;
      } },

    // Behaviors
    { id: 'eraser',          icon: '🧽', name: 'The Eraser',         desc: '1,000 deletes.',
      check: function (s) { return (s.totalDeletes || 0) >= 1000; } },
    { id: 'paste-master',    icon: '📋', name: 'Paste Master',       desc: '50 pastes animated.',
      check: function (s) { return (s.totalPastes || 0) >= 50; } },
    { id: 'wordsmith',       icon: '🪶', name: 'Wordsmith',          desc: '1,000 words typed.',
      check: function (s) { return (s.totalWords || 0) >= 1000; } },
    { id: 'storyteller',     icon: '📚', name: 'Storyteller',        desc: '100 sentences completed.',
      check: function (s) { return (s.totalSentences || 0) >= 100; } }
  ];

  const CATALOG_BY_ID = {};
  CATALOG.forEach(function (a) { CATALOG_BY_ID[a.id] = a; });

  let toastEl = null;
  let toastQueue = [];
  let toastShowing = false;
  let checkDebounceTimer = null;

  function getById(id) { return CATALOG_BY_ID[id] || null; }

  function checkAll() {
    const stats = window.__powerMode.stats;
    if (!stats) return [];
    const snap = stats.getSnapshot();
    const owned = snap.achievements || {};
    const newly = [];
    for (let i = 0; i < CATALOG.length; i++) {
      const a = CATALOG[i];
      if (owned[a.id]) continue;
      try {
        if (a.check(snap)) {
          if (stats.recordAchievement(a.id)) {
            newly.push(a);
          }
        }
      } catch (e) { /* swallow per-achievement errors */ }
    }
    if (newly.length) {
      newly.forEach(showToast);
      // Forward to activity feed if remote backend is alive
      const social = window.__powerMode.social;
      if (social && social.remoteBackend && social.remoteBackend.logEvent) {
        newly.forEach(function (a) {
          social.remoteBackend.logEvent('achievement', { id: a.id, name: a.name, icon: a.icon });
        });
      }
    }
    return newly;
  }

  function scheduleCheck() {
    clearTimeout(checkDebounceTimer);
    checkDebounceTimer = setTimeout(checkAll, 600);
  }

  function ensureToastEl() {
    if (toastEl && toastEl.isConnected) return toastEl;
    toastEl = document.createElement('div');
    toastEl.setAttribute('data-powermode-toast', '');
    toastEl.style.cssText = [
      'position:fixed',
      'right:14px',
      'bottom:56px',
      'z-index:2147483647',
      'pointer-events:none',
      'background:linear-gradient(180deg, rgba(36,42,58,.95), rgba(15,18,28,.95))',
      'border:1px solid #3a4054',
      'border-radius:14px',
      'padding:12px 16px',
      'min-width:240px',
      'max-width:320px',
      'color:#e7ecf2',
      'box-shadow:0 16px 32px rgba(0,0,0,.5), 0 0 24px rgba(124,92,255,.25)',
      'font:13px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif',
      'opacity:0',
      'transform:translateY(20px)',
      'transition:opacity .25s ease, transform .25s ease'
    ].join(';');
    (document.documentElement || document.body).appendChild(toastEl);
    return toastEl;
  }

  function showToast(a) {
    toastQueue.push(a);
    if (!toastShowing) drainQueue();
  }

  function drainQueue() {
    if (!toastQueue.length) { toastShowing = false; return; }
    toastShowing = true;
    const a = toastQueue.shift();
    const el = ensureToastEl();
    el.innerHTML = '';
    const head = document.createElement('div');
    head.style.cssText = 'display:flex;align-items:center;gap:10px;';
    const icon = document.createElement('span');
    icon.textContent = a.icon || '🏆';
    icon.style.cssText = 'font-size:28px;filter:drop-shadow(0 0 8px rgba(124,92,255,.5));';
    const text = document.createElement('div');
    const title = document.createElement('div');
    title.textContent = 'Achievement unlocked';
    title.style.cssText = 'font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#95a0b4;margin-bottom:2px;';
    const name = document.createElement('div');
    name.textContent = a.name;
    name.style.cssText = 'font-weight:700;font-size:14px;';
    const desc = document.createElement('div');
    desc.textContent = a.desc;
    desc.style.cssText = 'color:#cdd5e0;font-size:12px;margin-top:3px;';
    text.appendChild(title); text.appendChild(name); text.appendChild(desc);
    head.appendChild(icon); head.appendChild(text);
    el.appendChild(head);

    requestAnimationFrame(function () {
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    });

    // Audio sting if available
    const sfx = window.__powerMode.sfx;
    const settings = (window.__powerMode.main && window.__powerMode.main.getSettings()) || {};
    if (sfx && settings.soundEnabled !== false) {
      try { sfx.playArpeggio(2); } catch (e) { /* ignore */ }
    }

    setTimeout(function () {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      setTimeout(drainQueue, 280);
    }, 3200);
  }

  function getCatalog() { return CATALOG.slice(); }

  window.__powerMode.achievements = {
    catalog: getCatalog,
    getById: getById,
    checkAll: checkAll,
    scheduleCheck: scheduleCheck,
    _catalogById: CATALOG_BY_ID
  };
})();
