---
name: resilient-web-audio
description: >-
  Implements a production-resilient Web Audio architecture featuring asset-fingerprinting resolution,
  dynamic availability injection, multi-bus mixing, and user-gesture audio context unlocking.
  Prevents production 404 errors on hashed audio CDN assets and eliminates browser autoplay rejections.
  Use when designing audio graphs, sound effects, or ambient soundscapes for WebGL/WebGPU applications.
---

# Resilient Web Audio Skill

This skill provides the resilient Web Audio architecture used by Train 3D (`src/audio.js`). This SKILL.md and `references/sound_registry.js` are the runnable counterpart and agent guidance. It solves two of the most common production failures in web 3D audio:
1. **Broken CDN paths:** Audio files with hash fingerprints in production breaking hardcoded URLs.
2. **Autoplay policy rejections:** AudioContext blocked or muted due to missing user gesture handlers.

---

## When to Use

- Building Web Audio graphs for games, dioramas, or interactive simulations.
- Connecting multiple audio buses (SFX, ambient loops, score/music, UI clicks) with master volume and category mute.
- Serving hashed/fingerprinted audio assets on CDNs without hardcoded paths.
- Safely handling missing optional audio recordings without throwing uncaught 404 network errors.

## Not For

- High-performance real-time VoIP or WebRTC audio streaming.
- Native mobile app audio engines (AVAudioEngine / AAudio).

---

## Core Architecture

1. **Fingerprint-Safe Resolution (`resolveAudioURL`):**
   Audio paths are resolved through an injection lookup table (`window.APP_AUDIO_AVAILABLE = [...]`). Code never requests literal `assets/audio/foo.mp3`.
2. **Gesture-Gated Initialization:**
   `AudioContext` starts in `'suspended'` state and unlocks gracefully on the first pointerdown or keydown event.
3. **Multi-Bus Mixer Hierarchy:**
   ```
   [SFX Bus] ──────┐
   [Ambient Bus] ──┼──► [Master Gain] ──► audioContext.destination
   [Score Bus] ────┘
   ```

See the complete reference implementation:
👉 [references/sound_registry.js](./references/sound_registry.js)

---

## Quick Start Example

```javascript
import { SoundRegistry } from '.agents/skills/resilient-web-audio/references/sound_registry.js';
// In Next.js (TypeScript): import { SoundRegistry } from '@/lib/3d';

// 1. Initialize registry — basePath maps to Next.js public/audio/
const sound = new SoundRegistry({
  basePath: '/audio/',
  manifest: ['station-bell', 'motor-hum', 'track-click']
});

// 2. Unlock on user interaction (required by all browsers)
window.addEventListener('pointerdown', () => sound.unlock(), { once: true });

// 3. Play sound safely (no 404 thrown if asset is absent)
sound.playSFX('station-bell', { volume: 0.9, rate: 1.0 });
```

---

## Production Invariants & Verification

* **Fingerprint Invariant:** Always check `sound.isAvailable(id)` before fetching an asset.
* **Autoplay Invariant:** Verify that `audioContext.state === 'running'` before scheduling oscillator nodes.
