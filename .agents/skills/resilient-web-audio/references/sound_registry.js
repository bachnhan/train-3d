/**
 * Reference Implementation: Resilient Web Audio Registry & Mixer
 * 
 * Production Web Audio asset resolution and multi-bus mixer patterns:
 * 1. Fingerprinted CDN resolution: maps logical sound IDs to hashed filenames (e.g. 'track-click' -> 'track-click.a8f3.mp3').
 * 2. Lazy AudioContext initialization: avoids browser autoplay warnings before user gesture.
 * 3. Multi-bus gain hierarchy: SFX, Ambient, Score -> Master Gain -> Destination.
 */

class SoundRegistry {
  constructor({ basePath = '/audio/', manifest = {} } = {}) {
    this.basePath = basePath.endsWith('/') ? basePath : basePath + '/';
    
    // Manifest supports either:
    // 1. Key-value mapping: { 'track-click': 'track-click.a8f3c.mp3', 'hum': 'hum.b21d.mp3' }
    // 2. Array of available sound IDs: ['track-click', 'hum']
    this.manifest = new Map();
    if (Array.isArray(manifest)) {
      for (const item of manifest) {
        const cleanKey = item.replace(/\.(mp3|ogg|wav)$/, '');
        this.manifest.set(cleanKey, item.endsWith('.mp3') ? item : `${item}.mp3`);
      }
    } else if (manifest && typeof manifest === 'object') {
      for (const [k, v] of Object.entries(manifest)) {
        const cleanKey = k.replace(/\.(mp3|ogg|wav)$/, '');
        this.manifest.set(cleanKey, typeof v === 'string' ? v : `${k}.mp3`);
      }
    }

    this.buffers = new Map(); // id -> AudioBuffer
    this.ctx = null; // Lazily initialized on first user interaction to satisfy autoplay policies
    this.masterGain = null;
    this.sfxGain = null;
    this.ambientGain = null;
    this.scoreGain = null;
  }

  _initContext() {
    if (this.ctx) return;
    const AudioCtx = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.ambientGain = this.ctx.createGain();
    this.scoreGain = this.ctx.createGain();

    this.sfxGain.connect(this.masterGain);
    this.ambientGain.connect(this.masterGain);
    this.scoreGain.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);
  }

  isAvailable(id) {
    const cleanId = id.replace(/\.(mp3|ogg|wav)$/, '');
    return this.manifest.has(cleanId) || this.manifest.has(id);
  }

  resolveURL(id) {
    const cleanId = id.replace(/\.(mp3|ogg|wav)$/, '');
    const filename = this.manifest.get(cleanId) || this.manifest.get(id);
    if (filename) {
      return `${this.basePath}${filename.endsWith('.mp3') ? filename : filename + '.mp3'}`;
    }
    // Fallback if not found in manifest
    return `${this.basePath}${id.endsWith('.mp3') ? id : id + '.mp3'}`;
  }

  async unlock() {
    this._initContext();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  async load(id) {
    if (!this.isAvailable(id)) return null;
    this._initContext();
    if (!this.ctx) return null;
    if (this.buffers.has(id)) return this.buffers.get(id);

    try {
      const url = this.resolveURL(id);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arrayBuffer = await res.arrayBuffer();
      const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
      this.buffers.set(id, audioBuffer);
      return audioBuffer;
    } catch (err) {
      console.warn(`[SoundRegistry] Optional audio "${id}" failed to load:`, err.message);
      return null;
    }
  }

  async playSFX(id, { volume = 1.0, rate = 1.0, loop = false } = {}) {
    await this.unlock();
    if (!this.ctx) return null;

    const buffer = await this.load(id);
    if (!buffer) return null;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    source.loop = loop;

    const gain = this.ctx.createGain();
    gain.gain.value = volume;

    source.connect(gain);
    gain.connect(this.sfxGain);

    source.start(0);
    return source;
  }

  setMasterVolume(val) {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(val, this.ctx.currentTime);
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SoundRegistry };
}
// ESM named export for direct import in Next.js / bundlers
export { SoundRegistry };
if (typeof window !== 'undefined') {
  window.SoundRegistry = SoundRegistry;
}
