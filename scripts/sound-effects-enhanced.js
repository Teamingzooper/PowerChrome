(function () {
  window.__powerMode = window.__powerMode || {};

  let ctx = null;
  let masterGain = null;
  let bitcrushNode = null;
  let bitcrushKind = 'none'; // 'worklet' | 'scriptProcessor' | 'passthrough'
  let workletReady = false;
  let workletLoading = false;
  let currentPack = 'default';
  let volume = 0.5;
  let bitcrushAmount = 0.4;
  let waveformOverride = null;

  const LETTER_NOTES = {
    A: 220.00, B: 246.94, C: 261.63, D: 293.66,
    E: 329.63, F: 349.23, G: 392.00
  };
  const SCALE = [220.00, 246.94, 261.63, 293.66, 329.63, 349.23, 392.00];

  /* The bitcrush AudioWorklet processor as a self-contained source string.
   * audioWorklet.addModule() rejects cross-origin URLs (e.g. a
   * chrome-extension://... URL loaded from github.com), so we generate a
   * same-origin Blob URL at runtime instead. The same source also lives at
   * scripts/bitcrush-worklet.js for tooling / debugging.
   */
  const WORKLET_SOURCE = "class B extends AudioWorkletProcessor{static get parameterDescriptors(){return [{name:'amount',defaultValue:0.4,minValue:0,maxValue:1,automationRate:'k-rate'}]}constructor(){super();this._l=0;this._p=0}process(i,o,p){const a=i[0],b=o[0];if(!a||!a.length||!b||!b.length)return true;const amt=p.amount.length>0?p.amount[0]:0.4;const bits=Math.max(2,16-Math.floor(amt*14));const step=Math.pow(2,bits-1);const nf=0.15+(1-amt)*0.85;const ip=a[0];if(!ip)return true;const fr=ip.length;for(let c=0;c<b.length;c++){const op=b[c];if(!op)continue;let lt=this._l,ph=this._p;for(let k=0;k<fr;k++){ph+=nf;if(ph>=1){ph-=1;lt=Math.round(ip[k]*step)/step}op[k]=lt}if(c===0){this._l=lt;this._p=ph}}return true}}registerProcessor('powerchrome-bitcrush',B);";

  let cachedBlobUrl = null;
  function workletUrls() {
    // Try Blob URL first (same-origin to the host page, works everywhere
    // including pages whose CSP would block a chrome-extension:// script).
    const urls = [];
    try {
      if (!cachedBlobUrl) {
        const blob = new Blob([WORKLET_SOURCE], { type: 'application/javascript' });
        cachedBlobUrl = URL.createObjectURL(blob);
      }
      if (cachedBlobUrl) urls.push(cachedBlobUrl);
    } catch (e) { /* Blob unavailable for some reason */ }
    // Fall back to the extension-served URL (works in popup / stats page
    // where the document IS chrome-extension://, but typically not on the web).
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
        urls.push(chrome.runtime.getURL('scripts/bitcrush-worklet.js'));
      }
    } catch (e) { /* not in extension context */ }
    if (urls.length === 0) urls.push('scripts/bitcrush-worklet.js');
    return urls;
  }

  function ensureCtx() {
    if (ctx) {
      // Late upgrade to worklet if it became available
      if (!workletReady && !workletLoading && ctx.audioWorklet) tryUpgradeToWorklet();
      return ctx;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      masterGain = ctx.createGain();
      masterGain.gain.value = volume;
      // Start with a passthrough so play() works immediately. Upgrade to worklet
      // (or fallback ScriptProcessor) as soon as we can without blocking sound.
      bitcrushNode = ctx.createGain();
      bitcrushKind = 'passthrough';
      bitcrushNode.connect(masterGain).connect(ctx.destination);
      tryUpgradeToWorklet();
    } catch (e) {
      console.warn('[PowerChrome] AudioContext unavailable', e);
      ctx = null;
    }
    return ctx;
  }

  function swapBitcrushNode(newNode, kind) {
    if (!ctx) return;
    try { bitcrushNode.disconnect(); } catch (e) { /* ignore */ }
    bitcrushNode = newNode;
    bitcrushKind = kind;
    bitcrushNode.connect(masterGain);
    applyBitcrushParam();
  }

  function applyBitcrushParam() {
    if (bitcrushKind === 'worklet' && bitcrushNode && bitcrushNode.parameters) {
      const p = bitcrushNode.parameters.get('amount');
      if (p) p.setValueAtTime(bitcrushAmount, ctx.currentTime);
    }
    // ScriptProcessor + passthrough read the closure-level `bitcrushAmount` directly.
  }

  async function tryUpgradeToWorklet() {
    if (workletReady || workletLoading) return;
    if (!ctx || !ctx.audioWorklet || typeof AudioWorkletNode === 'undefined') {
      // Worklet not supported in this browser — fall back to ScriptProcessor.
      installScriptProcessorFallback();
      return;
    }
    workletLoading = true;
    const urls = workletUrls();
    let lastError = null;
    for (let i = 0; i < urls.length; i++) {
      try {
        await ctx.audioWorklet.addModule(urls[i]);
        const node = new AudioWorkletNode(ctx, 'powerchrome-bitcrush', {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [1]
        });
        workletReady = true;
        workletLoading = false;
        swapBitcrushNode(node, 'worklet');
        return;
      } catch (e) {
        lastError = e;
        // Try the next URL — typical case: chrome-extension:// blocked by
        // host CSP after the Blob URL succeeded, or vice versa.
      }
    }
    // Every worklet URL failed → ScriptProcessor as a last resort.
    if (lastError) console.warn('[PowerChrome] AudioWorklet unavailable, falling back to ScriptProcessor', lastError);
    workletLoading = false;
    installScriptProcessorFallback();
  }

  function installScriptProcessorFallback() {
    if (!ctx || bitcrushKind !== 'passthrough') return;
    if (!ctx.createScriptProcessor) return; // already on a passthrough; leave it
    const node = ctx.createScriptProcessor(4096, 1, 1);
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
    swapBitcrushNode(node, 'scriptProcessor');
  }

  function isDeleteKey(key) {
    return key === 'Backspace' || key === 'Delete';
  }

  function keyFreq(key) {
    if (!key) return 440;
    if (key === 'Enter') return 880;
    if (key === ' ' || key === 'Space') return 220;
    if (isDeleteKey(key)) return 90;
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
    if (isDeleteKey(key)) return 'sawtooth';
    if (waveformOverride) return waveformOverride;
    if (key === 'Enter') return 'sine';
    if (key === ' ' || key === 'Space') return 'square';
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
    const isDelete = isDeleteKey(key);
    const detune = isDelete ? -200 : Math.min((combo || 0) * 4, 1200);
    const osc = ac.createOscillator();
    osc.type = keyWaveform(key, pack);
    osc.frequency.value = baseFreq;
    osc.detune.value = detune;
    const env = ac.createGain();
    const now = ac.currentTime;
    const attack = isDelete ? 0.001 : pack.attack;
    const decay = isDelete ? 0.06 : pack.decay;
    const gainScale = isDelete ? (pack.gainScale * 0.65) : pack.gainScale;
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(gainScale, now + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay);
    if (isDelete) {
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, baseFreq * 0.4), now + decay);
    }
    osc.connect(env).connect(bitcrushNode);
    osc.start(now);
    osc.stop(now + attack + decay + 0.08);
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
    setBitcrush: function (a) {
      bitcrushAmount = Math.max(0, Math.min(1, a));
      applyBitcrushParam();
    },
    setWaveformOverride: function (w) { waveformOverride = (!w || w === 'auto') ? null : w; },
    getBackendKind: function () { return bitcrushKind; },
    _getPack: function () { return currentPack; },
    _keyFreq: keyFreq,
    _keyWaveform: function (k) {
      const presets = window.__powerMode.presets;
      const pack = presets ? presets.getSoundPack(currentPack) : { waveform: 'sine' };
      return keyWaveform(k, pack);
    }
  };
})();
