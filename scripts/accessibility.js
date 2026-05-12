(function () {
  window.__powerMode = window.__powerMode || {};
  const subs = [];
  const motionMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  const contrastMQ = window.matchMedia('(prefers-contrast: more)');

  function fire() {
    for (let i = 0; i < subs.length; i++) {
      try { subs[i](); } catch (e) { console.error('[PowerChrome] a11y subscriber failed', e); }
    }
  }

  if (motionMQ.addEventListener) motionMQ.addEventListener('change', fire);
  else if (motionMQ.addListener) motionMQ.addListener(fire);
  if (contrastMQ.addEventListener) contrastMQ.addEventListener('change', fire);
  else if (contrastMQ.addListener) contrastMQ.addListener(fire);

  window.__powerMode.accessibility = {
    prefersReducedMotion: function () { return motionMQ.matches; },
    prefersHighContrast: function () { return contrastMQ.matches; },
    onChange: function (cb) {
      subs.push(cb);
      return function () {
        const i = subs.indexOf(cb);
        if (i >= 0) subs.splice(i, 1);
      };
    }
  };
})();
