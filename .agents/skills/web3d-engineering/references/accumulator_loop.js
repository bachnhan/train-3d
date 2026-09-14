/**
 * Reference Implementation: Fixed-Timestep Accumulator Loop for WebGL / WebGPU
 * 
 * Decouples deterministic physics/kinematic simulation (fixed 60Hz) from
 * display refresh rate rendering (variable 60Hz - 144Hz) with sub-frame
 * transform interpolation to eliminate jitter and tunneling.
 */

class SimulationLoop {
  constructor({
    fixedStep = 1.0 / 60.0, // 60 Hz physics
    maxFrameTime = 0.25,    // Clamp to prevent spiral of death on tab freeze
    onUpdate,               // fn(fixedDeltaTime)
    onRender,               // fn(alpha) where alpha in [0, 1]
  }) {
    this.fixedStep = fixedStep;
    this.maxFrameTime = maxFrameTime;
    this.onUpdate = onUpdate;
    this.onRender = onRender;

    this.accumulator = 0.0;
    this.lastTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.isRunning = false;
    this.rafId = null;

    this.tick = this.tick.bind(this);
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.accumulator = 0.0;
    if (typeof requestAnimationFrame !== 'undefined') {
      this.rafId = requestAnimationFrame(this.tick);
    }
  }

  stop() {
    this.isRunning = false;
    if (this.rafId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  tick(currentTime) {
    if (!this.isRunning) return;

    // Convert elapsed time to seconds
    let frameTime = (currentTime - this.lastTime) / 1000.0;
    this.lastTime = currentTime;

    // Prevent spiral of death if browser was backgrounded or lagging
    if (frameTime > this.maxFrameTime) {
      frameTime = this.maxFrameTime;
    }

    this.accumulator += frameTime;

    // Consume accumulator in discrete fixed-timestep increments
    while (this.accumulator >= this.fixedStep) {
      this.onUpdate(this.fixedStep);
      this.accumulator -= this.fixedStep;
    }

    // Alpha represents remainder progress between the last simulation state
    // and the next predicted state. Used for transform interpolation.
    const alpha = this.accumulator / this.fixedStep;

    // Render at whatever refresh rate the display supports
    this.onRender(alpha);

    if (typeof requestAnimationFrame !== 'undefined') {
      this.rafId = requestAnimationFrame(this.tick);
    }
  }
}

// Module export support (CommonJS & browser global)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SimulationLoop };
}
if (typeof window !== 'undefined') {
  window.SimulationLoop = SimulationLoop;
}
