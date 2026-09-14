export class SoundRegistry {
  constructor({ manifest = window.APP_AUDIO_AVAILABLE || [] } = {}) {
    this.available = new Set(manifest);
    this.context = null;
    this.master = null;
    this.motor = null;
    this.motorGain = null;
    this.rainSource = null;
    this.rainGain = null;
    this.rainFilter = null;
    this.rainBuffer = null;
  }

  _createNoiseBuffer(duration = 2.0) {
    if (!this.context) return null;
    const bufferSize = Math.floor(this.context.sampleRate * duration);
    const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  startRain(isStorm = false) {
    if (!this.context) return;
    const now = this.context.currentTime;
    const targetVolume = isStorm ? 0.065 : 0.038;

    if (!this.rainSource) {
      if (!this.rainBuffer) {
        this.rainBuffer = this._createNoiseBuffer(2.5);
      }
      this.rainSource = this.context.createBufferSource();
      this.rainSource.buffer = this.rainBuffer;
      this.rainSource.loop = true;

      this.rainFilter = this.context.createBiquadFilter();
      this.rainFilter.type = "bandpass";
      this.rainFilter.frequency.value = isStorm ? 880 : 1250;
      this.rainFilter.Q.value = 0.85;

      this.rainGain = this.context.createGain();
      this.rainGain.gain.setValueAtTime(0, now);

      this.rainSource.connect(this.rainFilter).connect(this.rainGain).connect(this.master);
      this.rainSource.start(now);
    }

    if (this.rainFilter) {
      this.rainFilter.frequency.setTargetAtTime(isStorm ? 880 : 1250, now, 0.2);
    }
    if (this.rainGain) {
      this.rainGain.gain.setTargetAtTime(targetVolume, now, 0.3);
    }
  }

  stopRain() {
    if (!this.context || !this.rainGain) return;
    const now = this.context.currentTime;
    this.rainGain.gain.setTargetAtTime(0, now, 0.35);
  }

  async thunder() {
    if (!await this.unlock()) return false;
    const now = this.context.currentTime;

    // 1. Deep Sub-Bass Rumble Oscillators
    const subOsc1 = this.context.createOscillator();
    const subOsc2 = this.context.createOscillator();
    const subGain = this.context.createGain();

    subOsc1.type = "sine";
    subOsc1.frequency.setValueAtTime(54, now);
    subOsc1.frequency.exponentialRampToValueAtTime(28, now + 2.2);

    subOsc2.type = "triangle";
    subOsc2.frequency.setValueAtTime(78, now);
    subOsc2.frequency.exponentialRampToValueAtTime(36, now + 2.4);

    subGain.gain.setValueAtTime(0, now);
    subGain.gain.linearRampToValueAtTime(0.09, now + 0.05);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 2.4);

    subOsc1.connect(subGain);
    subOsc2.connect(subGain);
    subGain.connect(this.master);

    subOsc1.start(now);
    subOsc2.start(now);
    subOsc1.stop(now + 2.5);
    subOsc2.stop(now + 2.5);

    // 2. Filtered Atmospheric Rumble Noise
    const noiseBuffer = this._createNoiseBuffer(2.2);
    if (noiseBuffer) {
      const noiseSource = this.context.createBufferSource();
      noiseSource.buffer = noiseBuffer;

      const noiseFilter = this.context.createBiquadFilter();
      noiseFilter.type = "lowpass";
      noiseFilter.frequency.setValueAtTime(240, now);
      noiseFilter.frequency.exponentialRampToValueAtTime(80, now + 2.2);

      const noiseGain = this.context.createGain();
      noiseGain.gain.setValueAtTime(0, now);
      noiseGain.gain.linearRampToValueAtTime(0.11, now + 0.06);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);

      noiseSource.connect(noiseFilter).connect(noiseGain).connect(this.master);
      noiseSource.start(now);
      noiseSource.stop(now + 2.3);
    }

    return true;
  }

  initialize() {
    if (this.context) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = 0.42;
    this.master.connect(this.context.destination);
  }

  async unlock() {
    this.initialize();
    if (this.context?.state === "suspended") await this.context.resume();
    return this.context?.state === "running";
  }

  isAvailable(id) {
    return this.available.has(id);
  }

  startMotor() {
    if (!this.context || this.motor) return;
    this.motor = this.context.createOscillator();
    this.motor.type = "sawtooth";
    this.motorGain = this.context.createGain();
    this.motorGain.gain.value = 0;
    const filter = this.context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 720;
    this.motor.connect(filter).connect(this.motorGain).connect(this.master);
    this.motor.start();
  }

  updateMotorSpeed(normalizedSpeed, enabled = true) {
    if (!this.context) return;
    this.startMotor();
    const now = this.context.currentTime;
    const speed = Math.max(0, Math.min(1, normalizedSpeed));
    this.motor.frequency.setTargetAtTime(85 + speed * 430, now, 0.06);
    this.motorGain.gain.setTargetAtTime(enabled ? 0.018 + speed * 0.026 : 0, now, 0.08);
  }

  async whistle() {
    if (!await this.unlock()) return false;
    const now = this.context.currentTime;
    for (const [frequency, volume] of [[620, 0.055], [830, 0.035]]) {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.frequency.setValueAtTime(frequency, now);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.04, now + 0.55);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(volume, now + 0.04);
      gain.gain.linearRampToValueAtTime(0, now + 0.65);
      oscillator.connect(gain).connect(this.master);
      oscillator.start(now);
      oscillator.stop(now + 0.7);
    }
    return true;
  }

  dispose() {
    this.motor?.stop();
    this.motor = null;
    this.motorGain = null;
    this.rainSource?.stop();
    this.rainSource = null;
    this.rainGain = null;
    this.rainFilter = null;
    this.rainBuffer = null;
    this.context?.close();
    this.context = null;
  }
}
