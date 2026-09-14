import { Builder, MATERIAL } from "./builder.js";
import { trackCurves } from "./layout.js";
import { SpatialTrackGrid } from "./spatial-grid.js";

export const CAR_LENGTH = 12;
export const CAR_SPACING = 12.8;
export const CAR_COUNT = 3;
export const BOGIE_WHEELBASE = 8;
export const trackGrid = new SpatialTrackGrid({ cellSize: 2 });
trackCurves.forEach((curve, index) => trackGrid.sampleCurve(curve, `track-${index}`, 1.3));

function buildCar(carType) {
  const builder = new Builder();
  builder.beginAsset(`Commuter ${carType} car`);
  builder.buildCommuterCar({ length: CAR_LENGTH, carType });
  builder.endAsset();
  const car = builder.toThreeGroup();
  car.userData.geometryStats = builder.getStats();
  return car;
}

export function createTrain() {
  const train = new THREE.Group();
  train.name = "Series 2026 commuter train";
  train.add(buildCar("lead"));
  train.add(buildCar("trailer"));
  train.add(buildCar("tail"));
  return train;
}

export function createTrainController(train, options = {}) {
  const curve = options.curve || trackCurves[0];
  const length = curve.getLength();
  const carGap = CAR_SPACING / length;
  const bogieGap = BOGIE_WHEELBASE / length / 2;
  const frontPoints = train.children.map(() => new THREE.Vector3());
  const rearPoints = train.children.map(() => new THREE.Vector3());
  const updatePoint = new THREE.Vector3();
  const state = {
    progress: options.progress ?? 0.12,
    previousProgress: options.progress ?? 0.12,
    direction: options.direction ?? 1,
    speed: options.speed ?? 12,
    paused: false,
    soundEnabled: false,
    waiting: 0,
    edgeId: options.edgeId || "track-0",
    snap: { dist: Infinity, p: null, f: null, edge: null, d: 0, u: 0 }
  };

  function placeCar(car, index, centerU, direction) {
    const frontU = THREE.MathUtils.clamp(centerU + bogieGap * direction, 0, 1);
    const rearU = THREE.MathUtils.clamp(centerU - bogieGap * direction, 0, 1);
    const front = curve.getPointAt(frontU, frontPoints[index]);
    const rear = curve.getPointAt(rearU, rearPoints[index]);
    car.position.set(
      (front.x + rear.x) / 2,
      (front.y + rear.y) / 2 + 0.18,
      (front.z + rear.z) / 2
    );
    const dx = front.x - rear.x;
    const dz = front.z - rear.z;
    if (dx * dx + dz * dz > 1e-6) {
      car.rotation.y = Math.atan2(dx, dz);
    }
  }

  function placeCars(alpha = 1) {
    const clampedAlpha = THREE.MathUtils.clamp(alpha, 0, 1);
    const progress = THREE.MathUtils.lerp(state.previousProgress, state.progress, clampedAlpha);
    train.children.forEach((car, index) => {
      const centerU = progress - index * carGap * state.direction;
      placeCar(car, index, THREE.MathUtils.clamp(centerU, 0, 1), state.direction);
    });
  }

  function update(delta) {
    state.previousProgress = state.progress;
    if (state.paused || state.speed <= 0) return;
    if (state.waiting > 0) {
      state.waiting = Math.max(0, state.waiting - delta);
      return;
    }
    state.progress += state.direction * state.speed * delta / length;
    const point = curve.getPointAt(THREE.MathUtils.clamp(state.progress, 0, 1), updatePoint);
    trackGrid.nearestTrack(point.x, point.z, 1, state.snap);
    if (state.snap.dist > 2) throw new Error(`Train derailment threshold exceeded: ${state.snap.dist.toFixed(3)} m`);
    const margin = CAR_COUNT * carGap + 0.015;
    if (state.progress >= 0.96 - margin || state.progress <= 0.04 + margin) {
      state.progress = THREE.MathUtils.clamp(state.progress, 0.04 + margin, 0.96 - margin);
      state.previousProgress = state.progress;
      state.direction *= -1;
      state.waiting = options.portalWait ?? 1.8;
    }
  }

  placeCars();
  return { state, update, render: placeCars, leadCar: () => train.children[0], curve };
}

export function createTrainFleet(trains) {
  const controllers = trains.map((train, index) => createTrainController(train, {
    curve: trackCurves[index % trackCurves.length],
    edgeId: `track-${index % trackCurves.length}`,
    progress: index ? 0.78 : 0.18,
    direction: index ? -1 : 1,
    portalWait: index ? 2.4 : 1.2
  }));
  const state = { paused: false, speed: 12, soundEnabled: false };

  function update(delta) {
    for (const controller of controllers) {
      controller.state.paused = state.paused;
      controller.state.speed = state.speed;
      controller.update(delta);
    }
  }

  function render(alpha) {
    controllers.forEach((controller) => controller.render(alpha));
  }

  return {
    state,
    controllers,
    update,
    render,
    leadCar: () => controllers[0].leadCar(),
    get progress() { return controllers[0].state.progress; },
    get direction() { return controllers[0].state.direction; }
  };
}
