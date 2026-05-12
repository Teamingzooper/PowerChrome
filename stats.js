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
  }

  function formatInt(n) {
    return (n || 0).toLocaleString('en-US');
  }
  function formatDuration(ms) {
    ms = Math.max(0, Math.floor(ms || 0));
    const sec = Math.floor(ms / 1000);
    if (sec < 60) return sec + 's';
    const min = Math.floor(sec / 60);
    if (min < 60) return min + 'm';
    const hr = Math.floor(min / 60);
    const remMin = min % 60;
    if (hr < 24) return hr + 'h ' + remMin + 'm';
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

  /* ---------------- Render ---------------- */
  function render(stats) {
    // Profile
    const profile = stats.profile || { username: '', avatar: '⚡' };
    $('#avatarBtn').textContent = profile.avatar || '⚡';
    if (document.activeElement !== $('#username')) {
      $('#username').value = profile.username || '';
    }
    $('#profileSince').textContent = 'First use: ' + (stats.firstUseDate || isoDate());

    // Hero
    $('#statHighestCombo').textContent = formatInt(stats.highestCombo);
    $('#statHighestComboSub').textContent = stats.highestCombo >= 1000 ? 'universe-tier!'
      : stats.highestCombo >= 500 ? 'big bang reached'
      : stats.highestCombo >= 100 ? 'supernova reached'
      : stats.highestCombo >= 10 ? 'milestone reached'
      : stats.highestCombo > 0 ? 'just getting started'
      : 'no streak yet';

    $('#statTotalChars').textContent = formatInt(stats.totalChars);
    const siteCount = Object.keys(stats.charsBySite || {}).length;
    $('#statTotalCharsSub').textContent = siteCount
      ? 'across ' + siteCount + ' site' + (siteCount === 1 ? '' : 's')
      : 'across all sites';

    $('#statLongestStreak').textContent = formatDuration(stats.longestStreakMs);
    $('#statActiveTime').textContent = formatDuration(stats.totalActiveMs);
    const firstDay = stats.firstUseDate ? new Date(stats.firstUseDate) : new Date();
    const daysActive = Math.max(1, Math.floor((Date.now() - firstDay.getTime()) / 86400000) + 1);
    $('#statActiveTimeSub').textContent = 'across ' + daysActive + ' day' + (daysActive === 1 ? '' : 's');

    $('#statTotalDeletes').textContent = formatInt(stats.totalDeletes);
    const total = (stats.totalChars || 0) + (stats.totalDeletes || 0);
    const ratio = total ? Math.round((stats.totalDeletes / total) * 100) : 0;
    $('#statDeleteRatio').textContent = ratio + '% of all keystrokes';

    $('#statTotalPastes').textContent = formatInt(stats.totalPastes);
    $('#statPasteCharsSub').textContent = formatInt(stats.totalPasteChars) + ' chars eased in';

    // Chart (last 30 days)
    const chart = $('#dayChart');
    chart.innerHTML = '';
    const days = [];
    let maxVal = 0;
    let totalChartChars = 0;
    let peakDay = null;
    for (let i = 29; i >= 0; i--) {
      const d = daysAgo(i);
      const key = isoDate(d);
      const val = (stats.charsPerDay && stats.charsPerDay[key]) || 0;
      days.push({ key: key, date: d, val: val });
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

    // Top sites
    const siteList = $('#siteList');
    siteList.innerHTML = '';
    const sites = Object.keys(stats.charsBySite || {}).map(function (k) {
      return { host: k, count: stats.charsBySite[k] };
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
      li.appendChild(rank);
      li.appendChild(host);
      li.appendChild(count);
      siteList.appendChild(li);
    });

    // Milestones
    const msList = $('#milestoneList');
    msList.innerHTML = '';
    const ORDER = ['fireworks', 'galaxy', 'tornado', 'supernova', 'blackhole', 'bigbang', 'universe'];
    let anyMilestone = false;
    ORDER.forEach(function (name) {
      const c = (stats.milestonesHit && stats.milestonesHit[name]) || 0;
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
      li.appendChild(rank);
      li.appendChild(n);
      li.appendChild(ct);
      msList.appendChild(li);
    });
    if (!anyMilestone) {
      msList.innerHTML = '';
    }

    // Local-only leaderboard "me" rows
    const meName = (profile.username || 'you') + ' ' + (profile.avatar || '');
    $('#lbComboMeName').textContent = meName;
    $('#lbComboMeVal').textContent = formatInt(stats.highestCombo);
    $('#lbCharsMeName').textContent = meName;
    $('#lbCharsMeVal').textContent = formatInt(stats.totalChars);
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
        render(currentStats);
        $('#avatarPicker').hidden = true;
      });
      grid.appendChild(b);
    });
  }

  /* ---------------- Persistence ---------------- */
  let currentStats = defaultStats();

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
      // Update leaderboard names live
      const profile = currentStats.profile;
      const meName = (profile.username || 'you') + ' ' + (profile.avatar || '');
      $('#lbComboMeName').textContent = meName;
      $('#lbCharsMeName').textContent = meName;
    });

    $('#resetStats').addEventListener('click', function () {
      if (!confirm('Reset all PowerChrome stats? This cannot be undone.')) return;
      const preservedProfile = currentStats.profile;
      currentStats = defaultStats();
      currentStats.profile = preservedProfile;
      currentStats.firstUseDate = isoDate();
      save();
      render(currentStats);
    });

    // Live sync if extension is updating stats while page is open
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(function (changes, area) {
        if (area !== 'local') return;
        if (!changes[STATS_KEY]) return;
        const newVal = changes[STATS_KEY].newValue;
        if (!newVal) return;
        // Preserve username/avatar typed locally if the content script hasn't seen them yet
        const localProfile = currentStats.profile;
        currentStats = Object.assign(defaultStats(), newVal);
        if (localProfile && (localProfile.username || (localProfile.avatar && localProfile.avatar !== '⚡'))) {
          currentStats.profile = Object.assign({}, currentStats.profile, localProfile);
        }
        render(currentStats);
      });
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    load(function () {
      render(currentStats);
      bind();
    });
  });
})();
