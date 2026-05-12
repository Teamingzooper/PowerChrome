/* PowerChrome bitcrush AudioWorklet.
 * Runs on the audio thread. Loaded via audioWorklet.addModule().
 * Replaces the deprecated ScriptProcessorNode path.
 *
 * Parameters (k-rate):
 *   amount  0..1   how aggressively to crunch (drives bit depth + sample-hold rate)
 *
 * The processor is silent until input arrives; it does not allocate per call.
 */
class BitcrushProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'amount', defaultValue: 0.4, minValue: 0, maxValue: 1, automationRate: 'k-rate' }
    ];
  }

  constructor() {
    super();
    this._lastSample = 0;
    this._phaser = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || input.length === 0 || !output || output.length === 0) {
      return true;
    }
    const amount = parameters.amount.length > 0 ? parameters.amount[0] : 0.4;
    const bits = Math.max(2, 16 - Math.floor(amount * 14));
    const step = Math.pow(2, bits - 1);
    const normFreq = 0.15 + (1 - amount) * 0.85;

    // Mono — most of our voices are mono; if multi-channel, mirror channel 0.
    const inp = input[0];
    if (!inp) return true;
    const frames = inp.length;

    for (let ch = 0; ch < output.length; ch++) {
      const out = output[ch];
      if (!out) continue;
      // Reset per-channel cursor only on channel 0 to keep phase consistent across mono voices.
      let last = this._lastSample;
      let phase = this._phaser;
      for (let i = 0; i < frames; i++) {
        phase += normFreq;
        if (phase >= 1) {
          phase -= 1;
          last = Math.round(inp[i] * step) / step;
        }
        out[i] = last;
      }
      if (ch === 0) {
        this._lastSample = last;
        this._phaser = phase;
      }
    }
    return true;
  }
}

registerProcessor('powerchrome-bitcrush', BitcrushProcessor);
