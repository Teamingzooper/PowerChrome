(function () {
  window.__powerMode = window.__powerMode || {};

  function handler(e) {
    if (!(e.ctrlKey || e.metaKey)) return;
    if (!e.shiftKey) return;
    const key = (e.key || '').toLowerCase();
    if (key !== 'p' && key !== 's') return;
    const main = window.__powerMode.main;
    if (!main) return;
    const s = main.getSettings();
    if (key === 'p') {
      main.applySettings(Object.assign({}, s, { enabled: !s.enabled }));
      e.preventDefault();
      e.stopPropagation();
    } else if (key === 's') {
      main.applySettings(Object.assign({}, s, { soundEnabled: !s.soundEnabled }));
      e.preventDefault();
      e.stopPropagation();
    }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('keydown', handler, true);
  }

  window.__powerMode.shortcuts = {
    _handler: handler
  };
})();
