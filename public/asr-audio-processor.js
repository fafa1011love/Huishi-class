class HuishiAsrAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.targetSampleRate = 16000;
    this.ratio = sampleRate / this.targetSampleRate;
    this.pending = new Float32Array(0);
    this.readPosition = 0;
    this.output = new Float32Array(1600);
    this.outputLength = 0;
    this.port.onmessage = (event) => {
      if (event.data === 'flush') this.flush();
    };
  }

  append(input) {
    const combined = new Float32Array(this.pending.length + input.length);
    combined.set(this.pending);
    combined.set(input, this.pending.length);

    while (this.readPosition + this.ratio <= combined.length) {
      const start = Math.floor(this.readPosition);
      const end = Math.max(start + 1, Math.floor(this.readPosition + this.ratio));
      let total = 0;
      let count = 0;
      for (let index = start; index < end && index < combined.length; index += 1) {
        total += combined[index];
        count += 1;
      }
      this.output[this.outputLength] = count ? total / count : 0;
      this.outputLength += 1;
      this.readPosition += this.ratio;

      if (this.outputLength === this.output.length) this.emitOutput();
    }

    const consumed = Math.floor(this.readPosition);
    this.pending = combined.slice(consumed);
    this.readPosition -= consumed;
  }

  emitOutput() {
    if (!this.outputLength) return;
    const frame = this.output.slice(0, this.outputLength);
    this.port.postMessage(frame.buffer, [frame.buffer]);
    this.outputLength = 0;
  }

  flush() {
    this.emitOutput();
    this.pending = new Float32Array(0);
    this.readPosition = 0;
  }

  process(inputs) {
    const input = inputs[0]?.[0];
    if (input?.length) this.append(input);
    return true;
  }
}

registerProcessor('huishi-asr-audio-processor', HuishiAsrAudioProcessor);
