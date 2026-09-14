import { STATIONS } from "../stations.js";
import { createRailway, stationIndexAt, trackCurves } from "./layout.js";
import {
  createWorld, getBuilderStats, getCityFootprints, getClearanceItems,
  getMapMetadata, getRailInfrastructureRects
} from "./scene.js";
import {
  RAILWAY_CORRIDOR_HALF_WIDTH, distanceFootprintToRoads,
  distanceToRailwayFootprint, distanceToRoad, featuresOutsideBoard, portalPose
} from "./map-model.js";
import { createTrain, createTrainFleet } from "./train.js";
import { createOrbitControls } from "./controls.js";
import { createCameraController } from "./cameras.js";
import { initializeHud, updateEnvironmentCard, updateLandmarkCard, updateStationCard } from "./hud.js";
import { auditTrackClearance } from "./clearance.mjs";
import { SimulationLoop } from "./simulation-loop.js";
import { SoundRegistry } from "./audio.js";
import { CanvasAccessibleTwin } from "./accessible-twin.js";
import { createSkyAtmosphere, updateSkyAtmosphere, getAirplanePose } from "./sky.js";
import { createRiverBoat, updateRiverBoat, getRiverBoatPose } from "./riverboat.js";
import { createAnimatedPromenadePedestrians, updateAnimatedPedestrians } from "./pedestrians.js";
import { WeatherController } from "./weather.js";
import { TrafficController } from "./traffic.js";
import { RiverWater } from "./water.js";

const canvas = document.getElementById("rail-canvas");
const scene = new THREE.Scene();
// A 0.2 m near plane leaves the depth buffer resolving only ~75 mm at the far side of the
// board, which is coarser than the detail sitting on the buildings. The camera controller
// drops it back down for the cab view, which is the only one with geometry up close.
const camera = new THREE.PerspectiveCamera(20, 1, 2, 5200);
camera.position.set(280, 440, 540);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
// Everything that casts a shadow here is scenery, and scenery never moves, so the map is
// baked on the first frame instead of being re-rendered 60 times a second. That was most
// of the frame cost. The train is excluded from casting so it leaves no ghost behind.
renderer.shadowMap.enabled = true;
// PCFSoft measured ~33ms a frame against ~0.7ms for plain PCF at this resolution.
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;
canvas.addEventListener("webglcontextlost", (event) => {
  event.preventDefault();
  simulation?.stop();
});
canvas.addEventListener("webglcontextrestored", () => {
  renderer.shadowMap.needsUpdate = true;
  simulation?.start();
});

const { world, sun, hemi } = createWorld(scene);
scene.add(createRailway());
const trains = [createTrain(), createTrain()];
trains.forEach((train) => scene.add(train));
const trainController = createTrainFleet(trains);

// City life & sky atmosphere systems
createSkyAtmosphere(scene);
createRiverBoat(scene);
createAnimatedPromenadePedestrians(scene);
const riverWater = new RiverWater(scene);
const trafficController = new TrafficController(scene);

const sound = new SoundRegistry();
const weatherController = new WeatherController({
  scene,
  sun,
  hemi,
  renderer,
  onThunder: () => sound.thunder(),
  onRainSoundChange: (isRain, isStorm) => {
    if (trainController.state.soundEnabled) {
      if (isRain) sound.startRain(isStorm);
      else sound.stopRain();
    }
  }
});

const orbit = createOrbitControls(canvas);

const targetProvider = {
  getPose: (key) => {
    if (key === "train") {
      const lead = trainController.leadCar();
      return {
        id: "train",
        type: "train",
        name: "2026系 通勤列車",
        label: "2026系 · 10両編成",
        position: lead.position,
        yaw: lead.rotation.y,
        speed: trainController.state.speed,
        height: 3.2
      };
    }
    if (key === "plane") return getAirplanePose();
    if (key === "boat") return getRiverBoatPose();
    if (key === "bus" || key === "taxi") return trafficController.getVehiclePose(key);
    return null;
  }
};

const cameraController = createCameraController(camera, targetProvider, orbit);
window.__cameraController = cameraController;
window.__camera = camera;
window.__orbit = orbit;
window.__weatherController = weatherController;
window.__trafficController = trafficController;

const accessibleTwin = new CanvasAccessibleTwin({
  canvasElement: canvas,
  onObjectSelected: (id) => {
    const index = id === "shibuya" ? 0 : id === "daikanyama" ? 1 : null;
    if (index !== null) cameraController.focusStation(index);
    else if (id.startsWith("vehicle-")) cameraController.setTargetVehicle(id.replace("vehicle-", ""));
  }
});
accessibleTwin.registerEntity({
  id: "shibuya",
  label: "TY01 渋谷駅、旧地上高架ターミナル",
  onActivate: () => cameraController.focusStation(0)
});
accessibleTwin.registerEntity({
  id: "daikanyama",
  label: "TY02 代官山駅",
  onActivate: () => cameraController.focusStation(1)
});
trains.forEach((train, index) => accessibleTwin.registerEntity({
  id: `train-${index + 1}`,
  label: `2026系 通勤列車 ${index + 1}`,
  mesh: train,
  onActivate: () => {
    cameraController.setTargetVehicle("train");
    cameraController.setView("follow");
  }
}));
accessibleTwin.registerEntity({
  id: "vehicle-plane",
  label: "羽田便 旅客機 (ボーイング777)",
  onActivate: () => {
    cameraController.setTargetVehicle("plane");
    cameraController.setView("follow");
  }
});
accessibleTwin.registerEntity({
  id: "vehicle-boat",
  label: "渋谷川 巡回艇",
  onActivate: () => {
    cameraController.setTargetVehicle("boat");
    cameraController.setView("follow");
  }
});
accessibleTwin.registerEntity({
  id: "vehicle-bus",
  label: "都バス 渋72系統",
  onActivate: () => {
    cameraController.setTargetVehicle("bus");
    cameraController.setView("follow");
  }
});
accessibleTwin.registerEntity({
  id: "vehicle-taxi",
  label: "個人タクシー クラウン",
  onActivate: () => {
    cameraController.setTargetVehicle("taxi");
    cameraController.setView("follow");
  }
});

let currentStation = -1;
let lastTelemetryUpdate = 0;

// The scene is fill-rate bound, so cap the drawing buffer by total pixels rather than by
// device ratio. A retina 1080p window at full ratio asks for over six megapixels a frame.
const PIXEL_BUDGET = 2.6e6;

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const ratio = Math.min(window.devicePixelRatio, 2, Math.sqrt(PIXEL_BUDGET / (width * height)));
  renderer.setPixelRatio(Math.max(0.85, ratio));
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function refreshTelemetryCard() {
  const activePose = targetProvider.getPose(cameraController.state.targetVehicle);
  if (!activePose || cameraController.state.view === "landmark") return;

  const kmh = Math.round(activePose.speed * 3.6);
  let locationStr = "渋谷地区";
  if (cameraController.state.targetVehicle === "train") {
    locationStr = trainController.direction > 0 ? "代官山方面へ走行中" : "渋谷方面へ走行中";
  } else if (cameraController.state.targetVehicle === "plane") {
    locationStr = "羽田進入回廊 · 高度 156m";
  } else if (cameraController.state.targetVehicle === "boat") {
    locationStr = "渋谷川河川回廊 · 並木橋区間";
  } else if (cameraController.state.targetVehicle === "bus") {
    locationStr = "渋谷駅東口〜六本木通り〜渋谷ストリーム循環";
  } else if (cameraController.state.targetVehicle === "taxi") {
    locationStr = "並木橋〜八幡通り〜代官山駅アベニュー";
  }

  let domain = "RAIL TRANSIT";
  if (cameraController.state.targetVehicle === "plane") domain = "AIRSPACE";
  else if (cameraController.state.targetVehicle === "boat") domain = "WATERWAY";
  else if (cameraController.state.targetVehicle === "bus") domain = "CITY BUS";
  else if (cameraController.state.targetVehicle === "taxi") domain = "URBAN CAB";

  updateEnvironmentCard({
    targetVehicle: cameraController.state.targetVehicle,
    name: activePose.name,
    domain,
    caption: activePose.label,
    speed: `${kmh} km/h`,
    location: locationStr,
    weather: weatherController.currentPreset
  });
}

function update(delta) {
  const dt = Math.min(delta, .05);
  trainController.update(dt);
  sound.updateMotorSpeed(trainController.state.speed / 24, trainController.state.soundEnabled && !trainController.state.paused);
  updateSkyAtmosphere(dt);
  updateRiverBoat(dt);
  updateAnimatedPedestrians(dt);
  trafficController.update(dt);
  riverWater.update(dt, getRiverBoatPose(), weatherController);

  const activePose = targetProvider.getPose(cameraController.state.targetVehicle);
  weatherController.update(dt, activePose ? activePose.position : cameraController.state.currentTarget);

  const nextStation = stationIndexAt(trainController.progress);
  if (nextStation !== currentStation) {
    currentStation = nextStation;
    if (cameraController.state.view !== "landmark" && cameraController.state.targetVehicle === "train") {
      updateStationCard(currentStation, trainController.direction);
    }
    accessibleTwin.announce(`${STATIONS[currentStation].name.split(" / ")[0]}駅に到着しました`);
  }

  // Periodic live telemetry update
  lastTelemetryUpdate += dt;
  if (lastTelemetryUpdate >= 0.15) {
    lastTelemetryUpdate = 0;
    refreshTelemetryCard();
  }
}

function render(alpha = 1) {
  trainController.render(alpha);
  cameraController.update();
  renderer.render(scene, camera);
}

const simulation = new SimulationLoop({ onUpdate: update, onRender: render });

initializeHud({
  cameraController,
  trainController,
  weatherController,
  trafficController,
  sound,
  onVehicleFocus: () => refreshTelemetryCard(),
  onStationFocus: (index) => updateStationCard(index, trainController.direction),
  onLandmarkFocus: (key) => updateLandmarkCard(key, trainController.direction)
});
resize();
update(0);
render();
simulation.start();
window.addEventListener("resize", resize);
window.addEventListener("pagehide", () => {
  simulation.stop();
  accessibleTwin.destroy();
  sound.dispose();
});

window.addEventListener("keydown", async (event) => {
  if (event.key.toLowerCase() !== "f") return;
  if (document.fullscreenElement) await document.exitFullscreen();
  else await document.documentElement.requestFullscreen();
});

window.__train3d = window.__demo3d = { camera, scene, cameraController, trainController, orbit, renderer };

window.render_game_to_text = () => JSON.stringify({
  coordinateSystem: "Three.js world in metres: +x east, +y up, +z south from Shibuya to Daikanyama",
  view: cameraController.state.view,
  trains: trainController.controllers.map((controller) => ({
    progress: Number(controller.state.progress.toFixed(3)),
    direction: controller.state.direction > 0 ? "Daikanyama" : "Shibuya",
    edge: controller.state.edgeId
  })),
  operation: {
    paused: trainController.state.paused,
    speed: trainController.state.speed
  },
  station: {
    index: currentStation,
    code: STATIONS[currentStation]?.code,
    name: STATIONS[currentStation]?.name
  },
  soundEnabled: trainController.state.soundEnabled
});

window.run_qa = () => {
  const routeSamples = trackCurves.flatMap((curve) =>
    Array.from({ length: 701 }, (_, index) => {
      const point = curve.getPointAt(index / 700);
      return { x: point.x, y: point.y, z: point.z };
    })
  );
  // 2.8 m body plus the folded pantograph, measured from the rail head so the gauge
  // follows the climb onto the viaduct.
  const clearance = auditTrackClearance(routeSamples, getClearanceItems(), {
    halfWidth: 1.55,
    railOffsetMin: -0.6,
    railOffsetMax: 3.8
  });
  // Squashing an object whose geometry follows the alignment flattens the route's own
  // climb, not just the profile being squashed. The ballast floated six metres over the
  // rails at the Daikanyama end that way, so no scene object may scale unevenly.
  const nonUniformScales = [];
  scene.traverse((object) => {
    const { x, y, z } = object.scale;
    if (x !== y || y !== z) nonUniformScales.push({ type: object.type, scale: [x, y, z] });
  });

  const footprints = getCityFootprints();
  const polygonOf = (footprint) => footprint.polygon || [
    [footprint.x - footprint.width / 2, footprint.z - footprint.depth / 2],
    [footprint.x + footprint.width / 2, footprint.z - footprint.depth / 2],
    [footprint.x + footprint.width / 2, footprint.z + footprint.depth / 2],
    [footprint.x - footprint.width / 2, footprint.z + footprint.depth / 2]
  ];
  const buildingsOnRoads = footprints
    .filter((footprint) => distanceFootprintToRoads(polygonOf(footprint)) < -0.1)
    .map((footprint) => ({ x: footprint.x, z: footprint.z }));
  const buildingsInRailway = footprints
    .filter((footprint) =>
      distanceToRailwayFootprint(polygonOf(footprint)) < RAILWAY_CORRIDOR_HALF_WIDTH)
    .map((footprint) => ({ x: footprint.x, z: footprint.z }));
  const infrastructureOnRoads = getRailInfrastructureRects()
    .filter((item) => item.ground && distanceToRoad(item.x, item.z) < item.radius)
    .map((item) => ({ label: item.label, x: item.x, z: item.z }));
  const portal = portalPose();

  return {
    ...clearance,
    buildingsOnRoads,
    buildingsInRailway,
    infrastructureOnRoads,
    outsideBoard: featuresOutsideBoard(),
    portalCenter: [portal.point.x, portal.point.z],
    map: getMapMetadata(),
    nonUniformScales,
    builder: getBuilderStats(),
    renderer: {
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures
    },
    estimatedVramMB: Number((
      (getBuilderStats().byteLength + PIXEL_BUDGET * 16 + 2048 * 2048 * 4 + 8 * 1024 * 1024) /
      (1024 * 1024)
    ).toFixed(1)),
    audioState: sound.context?.state || "not-initialized",
    fov: camera.fov,
    pixelRatio: renderer.getPixelRatio()
  };
};
window.run_demo3d_qa = window.run_qa;

window.advanceTime = (milliseconds) => {
  const steps = Math.max(1, Math.round(milliseconds / (1000 / 60)));
  for (let i = 0; i < steps; i += 1) update(1 / 60);
  render();
};

requestAnimationFrame(() => {
  document.getElementById("loading-screen").classList.add("hidden");
});