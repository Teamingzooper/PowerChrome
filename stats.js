(function () {
  const STATS_KEY = 'powerModeStats';

  const AVATAR_CHOICES = [
    '⚡','🔥','💥','✨','🌟','🚀','🎮','🎯','🎨','🎵','🎸','🎲',
    '🧠','🦾','🤖','👾','🐉','🦊','🐱','🐺','🐧','🦉','🦋','🐙',
    '🌈','🌌','🌊','🌋','☄️','🪐','🌀','🌪️','🔱','♾️','⚙️','🧩'
  ];

  const $ = function (sel) { return document.querySelector(sel); };
  const $$ = function (sel) { return document.querySelectorAll(sel); };

  function safeStorageGet(key, cb) {
    if (typeof chrome === 'undefined' || !chrome.storage) return cb({});
    try {
      chrome.storage.local.get([key], function (res) { cb(res || {}); });
    } catch (e) {
      cb({});
    }
  }
  function safeStorageSet(obj) {
    if (typeof chrome === 'undefined' || !chrome.storage) return;
    try { chrome.storage.local.set(obj); } catch (e) { /* ignore */ }
  }

  function defaultStats() {
    return {
      profile: { username: '', avatar: '⚡' },
      totalChars: 0, totalDeletes: 0, totalPastes: 0, totalPasteChars: 0,
      totalEnters: 0, highestCombo: 0, longestStreakMs: 0, totalActiveMs: 0,
      charsPerDay: {}, charsBySite: {}, milestonesHit: {},
      firstUseDate: '', lastUseDate: ''
    };
  }

  function formatInt(n) { return (n || 0).toLocaleString('en-US'); }
  function formatDuration(ms) {
    ms = Math.max(0, Math.floor(ms || 0));
    const sec = Math.floor(ms / 1000);
    if (sec < 60) return sec + 's';
    const min = Math.floor(sec / 60);
    if (min < 60) return min + 'm';
    const hr = Math.floor(min / 60);
    if (hr < 24) return hr + 'h ' + (min % 60) + 'm';
    const days = Math.floor(hr / 24);
    return days + 'd ' + (hr % 24) + 'h';
  }
  function isoDate(d) {
    d = d || new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }
  function daysAgo(n) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - n);
    return d;
  }

  let currentStats = defaultStats();
  let lbKind = 'combo';   // 'combo' | 'chars'
  let lbScope = 'friends';
  let diagInterval = null;
  let profileSyncTimer = null;

  function primeSharedStats() {
    if (window.__powerMode && window.__powerMode.stats) {
      window.__powerMode.stats._setStats(currentStats);
    }
  }

  function scheduleProfileSync(immediate) {
    clearTimeout(profileSyncTimer);
    const social = window.__powerMode && window.__powerMode.social;
    if (!social || !social.backend || !social.backend.updateProfile) return;
    const profile = currentStats.profile || {};
    const fire = function () {
      Promise.resolve(social.backend.updateProfile({
        username: profile.username || '',
        avatar: profile.avatar || '⚡'
      })).then(function () {
        renderFriendList();
        renderLeaderboard();
        renderBackendBanner();
      }).catch(function () { /* swallow */ });
    };
    if (immediate) fire();
    else profileSyncTimer = setTimeout(fire, 400);
  }

  /* ---------------- Profile ---------------- */
  function renderProfile() {
    const profile = currentStats.profile || { username: '', avatar: '⚡' };
    $('#avatarBtn').textContent = profile.avatar || '⚡';
    if (document.activeElement !== $('#username')) {
      $('#username').value = profile.username || '';
    }
    $('#profileSince').textContent = 'First use: ' + (currentStats.firstUseDate || isoDate());
  }

  /* ---------------- Hero stats ---------------- */
  function renderHero() {
    $('#statHighestCombo').textContent = formatInt(currentStats.highestCombo);
    $('#statHighestComboSub').textContent = currentStats.highestCombo >= 1000 ? 'universe-tier!'
      : currentStats.highestCombo >= 500 ? 'big bang reached'
      : currentStats.highestCombo >= 100 ? 'supernova reached'
      : currentStats.highestCombo >= 10 ? 'milestone reached'
      : currentStats.highestCombo > 0 ? 'just getting started'
      : 'no streak yet';

    $('#statTotalChars').textContent = formatInt(currentStats.totalChars);
    const siteCount = Object.keys(currentStats.charsBySite || {}).length;
    $('#statTotalCharsSub').textContent = siteCount
      ? 'across ' + siteCount + ' site' + (siteCount === 1 ? '' : 's')
      : 'across all sites';

    $('#statLongestStreak').textContent = formatDuration(currentStats.longestStreakMs);
    $('#statActiveTime').textContent = formatDuration(currentStats.totalActiveMs);
    const firstDay = currentStats.firstUseDate ? new Date(currentStats.firstUseDate) : new Date();
    const daysActive = Math.max(1, Math.floor((Date.now() - firstDay.getTime()) / 86400000) + 1);
    $('#statActiveTimeSub').textContent = 'across ' + daysActive + ' day' + (daysActive === 1 ? '' : 's');

    $('#statTotalDeletes').textContent = formatInt(currentStats.totalDeletes);
    const total = (currentStats.totalChars || 0) + (currentStats.totalDeletes || 0);
    const ratio = total ? Math.round((currentStats.totalDeletes / total) * 100) : 0;
    $('#statDeleteRatio').textContent = ratio + '% of all keystrokes';

    $('#statTotalPastes').textContent = formatInt(currentStats.totalPastes);
    $('#statPasteCharsSub').textContent = formatInt(currentStats.totalPasteChars) + ' chars eased in';
  }

  /* ---------------- Chart + lists ---------------- */
  function renderChart() {
    const chart = $('#dayChart');
    chart.innerHTML = '';
    const days = [];
    let maxVal = 0;
    let totalChartChars = 0;
    let peakDay = null;
    for (let i = 29; i >= 0; i--) {
      const d = daysAgo(i);
      const key = isoDate(d);
      const val = (currentStats.charsPerDay && currentStats.charsPerDay[key]) || 0;
      days.push({ key: key, val: val });
      if (val > maxVal) { maxVal = val; peakDay = { key: key, val: val }; }
      totalChartChars += val;
    }
    days.forEach(function (day) {
      const bar = document.createElement('div');
      bar.className = 'bar' + (day.val === 0 ? ' empty' : '');
      const heightPct = maxVal > 0 ? (day.val / maxVal) * 100 : 0;
      bar.style.height = Math.max(2, heightPct) + '%';
      bar.dataset.tip = day.key + ' · ' + formatInt(day.val) + ' chars';
      chart.appendChild(bar);
    });
    $('#chartTotal').textContent = 'Total: ' + formatInt(totalChartChars);
    $('#chartPeak').textContent = peakDay && peakDay.val
      ? 'Peak day: ' + peakDay.key + ' · ' + formatInt(peakDay.val)
      : 'Peak day: —';
  }

  function renderSites() {
    const siteList = $('#siteList');
    siteList.innerHTML = '';
    const sites = Object.keys(currentStats.charsBySite || {}).map(function (k) {
      return { host: k, count: currentStats.charsBySite[k] };
    }).sort(function (a, b) { return b.count - a.count; }).slice(0, 10);
    sites.forEach(function (s, idx) {
      const li = document.createElement('li');
      const rank = document.createElement('span');
      rank.className = 'rank';
      rank.textContent = (idx + 1);
      const host = document.createElement('span');
      host.className = 'host';
      host.textContent = s.host;
      const count = document.createElement('span');
      count.className = 'count';
      count.textContent = formatInt(s.count);
      li.appendChild(rank); li.appendChild(host); li.appendChild(count);
      siteList.appendChild(li);
    });
  }

  function renderMilestones() {
    const msList = $('#milestoneList');
    msList.innerHTML = '';
    const ORDER = ['fireworks', 'galaxy', 'tornado', 'supernova', 'blackhole', 'bigbang', 'universe'];
    let anyMilestone = false;
    ORDER.forEach(function (name) {
      const c = (currentStats.milestonesHit && currentStats.milestonesHit[name]) || 0;
      if (c === 0) return;
      anyMilestone = true;
      const li = document.createElement('li');
      const rank = document.createElement('span');
      rank.className = 'rank';
      rank.textContent = ORDER.indexOf(name) + 1;
      const n = document.createElement('span');
      n.className = 'name';
      n.textContent = name;
      const ct = document.createElement('span');
      ct.className = 'count';
      ct.textContent = '×' + c;
      li.appendChild(rank); li.appendChild(n); li.appendChild(ct);
      msList.appendChild(li);
    });
    if (!anyMilestone) msList.innerHTML = '';
  }

  /* ---------------- Social ---------------- */
  function getBackend() {
    return window.__powerMode && window.__powerMode.social && window.__powerMode.social.backend;
  }

  function ensureSocialLoaded(cb) {
    const social = window.__powerMode && window.__powerMode.social;
    if (!social) return cb();
    // stats-tracker needs to be primed too so backend can pull profile/highestCombo/totalChars
    if (window.__powerMode.stats) {
      window.__powerMode.stats._setStats(currentStats);
    }
    social.init(function () { cb(); });
  }

  function renderBackendBanner() {
    const be = getBackend();
    const status = be ? be.getStatus() : { backend: 'unknown' };
    const isRemote = status.backend === 'remote';
    const online = !!status.online;
    const dotOK = isRemote && online;
    $('#backendDot').classList.toggle('ok', dotOK);

    let label, sub;
    if (!isRemote) {
      label = 'Local-only mode';
      sub = 'The social system is fully wired but stays on this device. Friend codes, leaderboards, and accounts are stored in <code>chrome.storage.local</code>. Switch to remote in the popup to share with friends.';
    } else if (online) {
      label = 'Connected · ' + (status.serverStorage === 'kv' ? 'persistent' : 'volatile') + ' storage';
      sub = 'Server: <code>' + (status.serverUrl || '') + '</code>. Storage backend: <strong>' + (status.serverStorage || 'unknown') + '</strong>. ' +
            (status.serverStorage === 'memory'
              ? "Data resets when the server cold-starts — link a Vercel KV store in the Vercel dashboard's Storage tab to enable real persistence."
              : 'Your friend code, friends list, and stats sync automatically every 15 seconds.');
    } else {
      label = 'Remote backend unreachable';
      sub = 'Trying <code>' + (status.serverUrl || '') + '</code> — no response. Falling back to local-only mode. Check the URL in the popup or try again later.';
    }
    $('#backendLabel').textContent = label;
    $('#backendSub').innerHTML = sub;
  }

  function renderMyCode() {
    const be = getBackend();
    if (!be) return;
    const acc = be.getMyAccount();
    $('#myCode').textContent = acc.code || '— — — —';
  }

  function renderFriendList() {
    const be = getBackend();
    const list = $('#friendList');
    list.innerHTML = '';
    if (!be) return;
    const rows = be.getFriends().filter(function (r) { return !r.isMe; });
    rows.forEach(function (f) {
      const row = document.createElement('li');
      row.className = 'friend-row';

      const avatar = document.createElement('span');
      avatar.className = 'friend-avatar';
      avatar.textContent = f.avatar || '🙂';

      const meta = document.createElement('div');
      meta.className = 'friend-meta';
      const name = document.createElement('span');
      name.className = 'friend-name';
      name.textContent = f.name;
      const code = document.createElement('span');
      code.className = 'friend-code-mini';
      code.textContent = f.code;
      meta.appendChild(name); meta.appendChild(code);

      const stat = document.createElement('span');
      stat.className = 'friend-stat';
      stat.textContent = formatInt(f.highestCombo) + ' combo · ' + formatInt(f.totalChars) + ' chars';

      const rm = document.createElement('button');
      rm.className = 'remove-friend';
      rm.type = 'button';
      rm.textContent = '×';
      rm.title = 'Remove';
      rm.addEventListener('click', async function () {
        try { await be.removeFriend(f.code); } catch (e) { /* ignore */ }
        renderFriendList();
        renderLeaderboard();
      });

      row.appendChild(avatar); row.appendChild(meta); row.appendChild(stat); row.appendChild(rm);
      list.appendChild(row);
    });
  }

  function renderLeaderboard() {
    const be = getBackend();
    const list = $('#lbList');
    list.innerHTML = '';
    if (!be) return;
    const rows = be.getLeaderboard(lbKind, lbScope);
    rows.forEach(function (r, idx) {
      const li = document.createElement('li');
      if (r.isMe) li.classList.add('lb-me');
      const rank = document.createElement('span');
      rank.className = 'rank';
      rank.textContent = (idx + 1);
      const av = document.createElement('span');
      av.className = 'lb-avatar';
      av.textContent = r.avatar || '🙂';
      const nm = document.createElement('span');
      nm.className = 'lb-name';
      nm.textContent = (r.isMe ? '★ ' : '') + (r.name || '—');
      const v = document.createElement('span');
      v.className = 'lb-val';
      v.textContent = lbKind === 'chars' ? formatInt(r.totalChars) : formatInt(r.highestCombo);
      li.appendChild(rank); li.appendChild(av); li.appendChild(nm); li.appendChild(v);
      list.appendChild(li);
    });
  }

  /* ---------------- Diagnostics ---------------- */
  function renderDiagnostics() {
    const grid = $('#diagGrid');
    grid.innerHTML = '';
    const PM = window.__powerMode || {};
    const snap = PM.debug ? PM.debug.getSnapshot() : null;
    const audio = snap ? snap.audioBackend : 'n/a';
    const worklet = snap ? snap.audioWorkletSupported : (typeof AudioWorkletNode !== 'undefined');
    const social = PM.social && PM.social.backend ? PM.social.backend.getStatus() : { backend: 'n/a' };
    const entries = [
      ['extension', '1.3.0'],
      ['audio backend', audio, audio === 'worklet' ? 'ok' : (audio === 'scriptProcessor' ? 'warn' : '')],
      ['AudioWorkletNode', worklet ? 'supported' : 'unsupported', worklet ? 'ok' : 'warn'],
      ['social backend', social.backend, social.backend === 'local-mock' ? 'warn' : 'ok'],
      ['friend code', social.myCode || '—'],
      ['account created', social.createdAt ? new Date(social.createdAt).toLocaleString() : '—']
    ];
    entries.forEach(function (e) {
      const row = document.createElement('div');
      const k = document.createElement('span');
      k.className = 'diag-key';
      k.textContent = e[0];
      const v = document.createElement('span');
      v.className = 'diag-val' + (e[2] ? ' ' + e[2] : '');
      v.textContent = e[1];
      row.appendChild(k); row.appendChild(v);
      grid.appendChild(row);
    });
  }

  /* ---------------- Avatar picker ---------------- */
  function buildAvatarPicker(activeAvatar) {
    const grid = $('#avatarGrid');
    grid.innerHTML = '';
    AVATAR_CHOICES.forEach(function (em) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = em;
      if (em === activeAvatar) b.classList.add('active');
      b.addEventListener('click', function () {
        currentStats.profile = currentStats.profile || {};
        currentStats.profile.avatar = em;
        save();
        primeSharedStats();
        renderProfile();
        renderFriendList();
        renderLeaderboard();
        $('#avatarPicker').hidden = true;
        scheduleProfileSync(true);
      });
      grid.appendChild(b);
    });
  }

  /* ---------------- Persistence ---------------- */
  function save() {
    const obj = {};
    obj[STATS_KEY] = currentStats;
    safeStorageSet(obj);
  }

  function load(cb) {
    safeStorageGet(STATS_KEY, function (res) {
      currentStats = Object.assign(defaultStats(), (res && res[STATS_KEY]) || {});
      currentStats.profile = Object.assign({ username: '', avatar: '⚡' }, currentStats.profile || {});
      currentStats.charsPerDay = currentStats.charsPerDay || {};
      currentStats.charsBySite = currentStats.charsBySite || {};
      currentStats.milestonesHit = currentStats.milestonesHit || {};
      if (cb) cb();
    });
  }

  function renderAll() {
    renderProfile();
    renderHero();
    renderChart();
    renderSites();
    renderMilestones();
    renderBackendBanner();
    renderMyCode();
    renderFriendList();
    renderLeaderboard();
    renderDiagnostics();
  }

  /* ---------------- Bindings ---------------- */
  function bind() {
    $('#avatarBtn').addEventListener('click', function () {
      const picker = $('#avatarPicker');
      const willShow = picker.hidden;
      if (willShow) buildAvatarPicker((currentStats.profile && currentStats.profile.avatar) || '⚡');
      picker.hidden = !willShow;
    });

    $('#username').addEventListener('input', function (e) {
      currentStats.profile = currentStats.profile || {};
      currentStats.profile.username = (e.target.value || '').slice(0, 24);
      save();
      primeSharedStats();
      renderFriendList();
      renderLeaderboard();
      scheduleProfileSync(false);
    });

    $('#resetStats').addEventListener('click', function () {
      if (!confirm('Reset all PowerChrome stats? This cannot be undone.')) return;
      const preservedProfile = currentStats.profile;
      currentStats = defaultStats();
      currentStats.profile = preservedProfile;
      currentStats.firstUseDate = isoDate();
      save();
      renderAll();
    });

    $('#copyCode').addEventListener('click', function () {
      const code = $('#myCode').textContent;
      try {
        navigator.clipboard.writeText(code);
      } catch (e) { /* clipboard may be denied in some contexts */ }
      const fb = $('#copyFeedback');
      fb.hidden = false;
      setTimeout(function () { fb.hidden = true; }, 1500);
    });

    $('#friendCodeInput').addEventListener('input', function (e) {
      const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
      e.target.value = v.length > 4 ? v.slice(0, 4) + '-' + v.slice(4) : v;
      $('#friendError').hidden = true;
    });

    $('#addFriendForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      const be = getBackend();
      if (!be) return;
      const submitBtn = e.target.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
      let result;
      try {
        result = await be.addFriendByCode($('#friendCodeInput').value);
      } catch (err) {
        result = { ok: false, error: 'network error' };
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
      if (result && result.ok) {
        $('#friendCodeInput').value = '';
        $('#friendError').hidden = true;
        renderFriendList();
        renderLeaderboard();
      } else {
        $('#friendError').textContent = (result && result.error) || 'failed';
        $('#friendError').hidden = false;
      }
    });

    // Leaderboard seg controls
    $$('.seg').forEach(function (seg) {
      const segKind = seg.dataset.seg;
      seg.querySelectorAll('button').forEach(function (b) {
        b.addEventListener('click', function () {
          seg.querySelectorAll('button').forEach(function (x) { x.classList.remove('active'); });
          b.classList.add('active');
          if (segKind === 'kind') lbKind = b.dataset.val;
          if (segKind === 'scope') lbScope = b.dataset.val;
          renderLeaderboard();
        });
      });
    });

    // Live sync from content script
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(function (changes, area) {
        if (area !== 'local') return;
        if (changes[STATS_KEY]) {
          const newVal = changes[STATS_KEY].newValue;
          if (newVal) {
            const localProfile = currentStats.profile;
            currentStats = Object.assign(defaultStats(), newVal);
            if (localProfile && (localProfile.username || (localProfile.avatar && localProfile.avatar !== '⚡'))) {
              currentStats.profile = Object.assign({}, currentStats.profile, localProfile);
            }
            renderHero();
            renderChart();
            renderSites();
            renderMilestones();
            renderLeaderboard();
          }
        }
        if (changes.powerModeSocial) {
          renderFriendList();
          renderLeaderboard();
          renderMyCode();
        }
      });
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    load(function () {
      // Prime stats-tracker with our loaded data so social-api sees real numbers
      if (window.__powerMode && window.__powerMode.stats) {
        window.__powerMode.stats._setStats(currentStats);
      }
      ensureSocialLoaded(function () {
        renderAll();
        bind();
        diagInterval = setInterval(renderDiagnostics, 5000);

        // Re-render any time the remote backend gets fresh data or its
        // connectivity flips on/off.
        if (window.__powerMode.social && window.__powerMode.social.onRemoteChange) {
          window.__powerMode.social.onRemoteChange(function () {
            renderBackendBanner();
            renderMyCode();
            renderFriendList();
            renderLeaderboard();
            renderDiagnostics();
          });
        }
      });
    });
  });
})();
