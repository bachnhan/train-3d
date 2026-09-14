export class SimulationLoop {
  constructor({ fixedStep = 1 / 60, maxFrameTime = 0.25, onUpdate, onRender }) {
    this.fixedStep = fixedStep;
    this.maxFrameTime = maxFrameTime;
    this.onUpdate = onUpdate;
    this.onRender = onRender;
    this.accumulator = 0;
    this.lastTime = performance.now();
    this.running = false;
    this.frameId = null;
    this.tick = this.tick.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.accumulator = 0;
    this.lastTime = performance.now();
    this.frameId = requestAnimationFrame(this.tick);
  }

  stop() {
    this.running = false;
    if (this.frameId !== null) cancelAnimationFrame(this.frameId);
    this.frameId = null;
  }

  tick(now) {
    if (!this.running) return;
    const frameTime = Math.min((now - this.lastTime) / 1000, this.maxFrameTime);
    this.lastTime = now;
    this.accumulator += Math.max(0, frameTime);
    while (this.accumulator + 1e-12 >= this.fixedStep) {
      this.onUpdate(this.fixedStep);
      this.accumulator = Math.max(0, this.accumulator - this.fixedStep);
    }
    this.onRender(this.accumulator / this.fixedStep);
    this.frameId = requestAnimationFrame(this.tick);
  }

  advance(frameTime) {
    this.accumulator += Math.min(Math.max(0, frameTime), this.maxFrameTime);
    while (this.accumulator + 1e-12 >= this.fixedStep) {
      this.onUpdate(this.fixedStep);
      this.accumulator = Math.max(0, this.accumulator - this.fixedStep);
    }
    this.onRender(this.accumulator / this.fixedStep);
  }
}
