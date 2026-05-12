(function () {
  window.__powerMode = window.__powerMode || {};

  let ctx = null;
  let masterGain = null;
  let bitcrushNode = null;
  let currentPack = 'default';
  let volume = 0.5;
  let bitcrushAmount = 0.4;
  let waveformOverride = null;

  const LETTER_NOTES = {
    A: 220.00, B: 246.94, C: 261.63, D: 293.66,
    E: 329.63, F: 349.23, G: 392.00
  };
  const SCALE = [220.00, 246.94, 261.63, 293.66, 329.63, 349.23, 392.00];

  function ensureCtx() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      masterGain = ctx.createGain();
      masterGain.gain.value = volume;
      bitcrushNode = makeBitcrusher(ctx);
      bitcrushNode.connect(masterGain).connect(ctx.destination);
    } catch (e) {
      console.warn('[PowerChrome] AudioContext unavailable', e);
      ctx = null;
    }
    return ctx;
  }

  function makeBitcrusher(ac) {
    if (!ac.createScriptProcessor) {
      const passthrough = ac.createGain();
      passthrough.gain.value = 1;
      return passthrough;
    }
    const node = ac.createScriptProcessor(4096, 1, 1);
    let lastSample = 0;
    let phaser = 0;
    node.onaudioprocess = function (e) {
      const inp = e.inputBuffer.getChannelData(0);
      const out = e.outputBuffer.getChannelData(0);
      const bits = Math.max(2, 16 - Math.floor(bitcrushAmount * 14));
      const step = Math.pow(2, bits - 1);
      const normFreq = 0.15 + (1 - bitcrushAmount) * 0.85;
      for (let i = 0; i < inp.length; i++) {
        phaser += normFreq;
        if (phaser >= 1) {
          phaser -= 1;
          lastSample = Math.round(inp[i] * step) / step;
        }
        out[i] = lastSample;
      }
    };
    return node;
  }

  function keyFreq(key) {
    if (!key) return 440;
    if (key === 'Enter') return 880;
    if (key === ' ' || key === 'Space') return 220;
    if (key === 'Backspace') return 110;
    if (key === 'Tab') return 440;
    const ch = key.length === 1 ? key.toUpperCase() : '';
    if (LETTER_NOTES[ch]) return LETTER_NOTES[ch];
    if (ch) {
      const code = ch.charCodeAt(0);
      return SCALE[code % SCALE.length];
    }
    return 440;
  }

  function keyWaveform(key, pack) {
    if (waveformOverride) return waveformOverride;
    if (key === 'Enter') return 'sine';
    if (key === ' ' || key === 'Space') return 'square';
    if (key === 'Backspace') return 'sawtooth';
    if (key === 'Tab') return 'triangle';
    return pack.waveform;
  }

  function play(key, combo) {
    const ac = ensureCtx();
    if (!ac) return;
    if (ac.state === 'suspended') ac.resume().catch(function () {});
    const presets = window.__powerMode.presets;
    const pack = presets ? presets.getSoundPack(currentPack) : { waveform: 'sine', attack: 0.005, decay: 0.18, gainScale: 0.3 };
    const baseFreq = keyFreq(key);
    const detune = Math.min((combo || 0) * 4, 1200);
    const osc = ac.createOscillator();
    osc.type = keyWaveform(key, pack);
    osc.frequency.value = baseFreq;
    osc.detune.value = detune;
    const env = ac.createGain();
    const now = ac.currentTime;
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(pack.gainScale, now + pack.attack);
    env.gain.exponentialRampToValueAtTime(0.0001, now + pack.attack + pack.decay);
    osc.connect(env).connect(bitcrushNode);
    osc.start(now);
    osc.stop(now + pack.attack + pack.decay + 0.08);
  }

  function playArpeggio(tier) {
    const ac = ensureCtx();
    if (!ac) return;
    if (ac.state === 'suspended') ac.resume().catch(function () {});
    const base = 330 + tier * 60;
    const intervals = tier >= 4 ? [0, 3, 7, 12] : [0, 4, 7, 12];
    for (let i = 0; i < intervals.length; i++) {
      const semis = intervals[i];
      const freq = base * Math.pow(2, semis / 12);
      const osc = ac.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const env = ac.createGain();
      const now = ac.currentTime + i * 0.08;
      env.gain.setValueAtTime(0, now);
      env.gain.linearRampToValueAtTime(0.28, now + 0.005);
      env.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      osc.connect(env).connect(bitcrushNode);
      osc.start(now);
      osc.stop(now + 0.45);
    }
  }

  window.__powerMode.sfx = {
    init: ensureCtx,
    play: play,
    playArpeggio: playArpeggio,
    setPack: function (n) { currentPack = n; },
    setVolume: function (v) { volume = v; if (masterGain) masterGain.gain.value = v; },
    setBitcrush: function (a) { bitcrushAmount = Math.max(0, Math.min(1, a)); },
    setWaveformOverride: function (w) { waveformOverride = (!w || w === 'auto') ? null : w; },
    _getPack: function () { return currentPack; },
    _keyFreq: keyFreq,
    _keyWaveform: function (k) {
      const presets = window.__powerMode.presets;
      const pack = presets ? presets.getSoundPack(currentPack) : { waveform: 'sine' };
      return keyWaveform(k, pack);
    }
  };
})();
