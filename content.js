(function () {
  if (window.__powerMode && window.__powerMode.main) {
    try {
      window.__powerMode.main.init();
    } catch (e) {
      console.warn('[PowerChrome] init failed', e);
    }
  } else {
    console.warn('[PowerChrome] main module missing — extension scripts may have failed to load');
  }
})();
