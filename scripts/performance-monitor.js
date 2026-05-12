(function () {
  window.__powerMode = window.__powerMode || {};
  const WINDOW_SIZE = 60;
  const frameTimes = [];
  let lastTick = performance.now();
  let lowFpsStartedAt = null;
  let throttling = false;

  function tick() {
    const now = performance.now();
    const dt = now - lastTick;
    lastTick = now;
    if (dt <= 0 || dt > 1000) return;
    frameTimes.push(dt);
    if (frameTimes.length > WINDOW_SIZE) frameTimes.shift();
    if (frameTimes.length < 10) return;
    const avgDt = avg(frameTimes);
    const fps = avgDt > 0 ? 1000 / avgDt : 60;
    if (fps < 30) {
      if (lowFpsStartedAt == null) lowFpsStartedAt = now;
      if (now - lowFpsStartedAt > 2000) throttling = true;
    } else {
      lowFpsStartedAt = null;
      throttling = false;
    }
  }

  function avg(arr) {
    let s = 0;
    for (let i = 0; i < arr.length; i++) s += arr[i];
    return arr.length ? s / arr.length : 0;
  }

  function getStats() {
    const avgDt = frameTimes.length ? avg(frameTimes) : 16.67;
    const aliveParticles = (window.__powerMode.particles && window.__powerMode.particles.getAliveCount()) || 0;
    return {
      fps: Math.round(1000 / Math.max(0.1, avgDt)),
      memoryBytes: aliveParticles * 256,
      throttling: throttling,
      aliveParticles: aliveParticles
    };
  }

  function reset() {
    frameTimes.length = 0;
    lowFpsStartedAt = null;
    throttling = false;
    lastTick = performance.now();
  }

  window.__powerMode.perf = {
    tick: tick,
    getStats: getStats,
    shouldThrottle: function () { return throttling; },
    reset: reset,
    _pushFrame: function (dt) {
      frameTimes.push(dt);
      if (frameTimes.length > WINDOW_SIZE) frameTimes.shift();
    },
    _forceThrottle: function (v) { throttling = !!v; }
  };
})();
