import { createTimberMaterial } from "./materials.js";
import { MAP } from "./data/map.js";

export const GROUND_Y = 0;
export const TRACK_GAUGE = 1.435;
export const TRACK_SEPARATION = 4.2;
export const PLATFORM_HEIGHT = 1.1;
export const CATENARY_HEIGHT = 4.8;
// The board is sized by the baked map rather than the other way round, so nothing the map
// contains can fall off the tabletop.
export const LAND = MAP.land;
export const LANDMARKS = [0, 1];

const centerPoints = MAP.alignment.map(([x, y, z]) => new THREE.Vector3(x, y, z));

export const routeCurve = new THREE.CatmullRomCurve3(centerPoints, false, "catmullrom", 0.18);
routeCurve.arcLengthDivisions = 2000;
routeCurve.updateArcLengths();

export class SmoothOffsetCurve extends THREE.Curve {
  constructor(source, lateral, height = 0) {
    super();
    this.source = source;
    this.lateral = lateral;
    this.height = height;
    this.arcLengthDivisions = 2000;
  }

  getPoint(t, optionalTarget = new THREE.Vector3()) {
    const point = this.source.getPoint(t, optionalTarget);
    const tangent = this.source.getTangent(t);
    return optionalTarget.set(
      point.x + tangent.z * this.lateral,
      point.y + this.height,
      point.z - tangent.x * this.lateral
    );
  }

  getTangent(t, optionalTarget = new THREE.Vector3()) {
    return this.source.getTangent(t, optionalTarget);
  }
}

function createTrackCurve(lateral) {
  const curve = new SmoothOffsetCurve(routeCurve, lateral);
  curve.updateArcLengths();
  return curve;
}

export const trackCurves = [
  createTrackCurve(-TRACK_SEPARATION / 2),
  createTrackCurve(TRACK_SEPARATION / 2)
];
export const routeLength = routeCurve.getLength();

// Derived from the surveyed station coordinates rather than hand-tuned, so a change to the
// alignment moves the platforms with it instead of silently stranding them mid-block.
function nearestU(target) {
  let best = 0;
  let bestDistance = Infinity;
  for (let index = 0; index <= 2000; index += 1) {
    const u = index / 2000;
    const point = routeCurve.getPointAt(u);
    const distance = Math.hypot(point.x - target[0], point.z - target[1]);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = u;
    }
  }
  return best;
}

export const stationU = MAP.stations.map((station) => nearestU(station.point));
export const stationPoints = stationU.map((u) => routeCurve.getPointAt(u));

const routeSamples = trackCurves.flatMap((curve, track) =>
  Array.from({ length: 701 }, (_, index) => ({
    track,
    point: curve.getPointAt(index / 700)
  }))
);

export function yawAt(u, curve = routeCurve) {
  const tangent = curve.getTangentAt(THREE.MathUtils.clamp(u, 0, 1));
  return Math.atan2(tangent.x, tangent.z);
}

export function distanceToTrack(x, z) {
  let closest = Infinity;
  for (const sample of routeSamples) {
    const dx = sample.point.x - x;
    const dz = sample.point.z - z;
    closest = Math.min(closest, dx * dx + dz * dz);
  }
  return Math.sqrt(closest);
}

export function stationIndexAt(progress) {
  return Math.abs(progress - stationU[0]) <= Math.abs(progress - stationU[1]) ? 0 : 1;
}

function railCurve(trackCurve, lateral, height = 0.12) {
  const curve = new SmoothOffsetCurve(trackCurve, lateral, height);
  curve.updateArcLengths();
  return curve;
}

// Matches the Builder: sRGB hex authored by hand, decoded once so the track sits in the
// same colour space as the rest of the diorama.
function linearColor(hex) {
  return new THREE.Color(hex).convertSRGBToLinear();
}

const BALLAST_SEGMENTS = 360;
const BALLAST_SIDES = 6;

// A tube around a climbing alignment cannot be flattened with object scale, because that
// squashes the route's own rise as well as the cross-section. Each ring is flattened about
// its own point on the curve instead, then dropped so the sleepers rest on the shoulder.
function flattenBallast(geometry, curve, flatten, drop) {
  const position = geometry.getAttribute("position");
  const centre = new THREE.Vector3();
  for (let ring = 0; ring <= BALLAST_SEGMENTS; ring += 1) {
    curve.getPointAt(ring / BALLAST_SEGMENTS, centre);
    for (let side = 0; side <= BALLAST_SIDES; side += 1) {
      const index = ring * (BALLAST_SIDES + 1) + side;
      position.setY(index, centre.y + (position.getY(index) - centre.y) * flatten - drop);
    }
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function addTrack(group, curve) {
  const length = curve.getLength();
  const ballast = new THREE.Mesh(
    flattenBallast(
      new THREE.TubeGeometry(curve, BALLAST_SEGMENTS, 1.45, BALLAST_SIDES, false),
      curve, 0.18, 0.32
    ),
    new THREE.MeshStandardMaterial({ color: linearColor(0x80786e), roughness: 1 })
  );
  ballast.receiveShadow = true;
  group.add(ballast);

  const railMaterial = new THREE.MeshStandardMaterial({
    color: linearColor(0x777d80),
    metalness: 0.25,
    roughness: 0.38
  });
  for (const lateral of [-TRACK_GAUGE / 2, TRACK_GAUGE / 2]) {
    const rail = new THREE.Mesh(
      new THREE.TubeGeometry(railCurve(curve, lateral), 360, 0.07, 5, false),
      railMaterial
    );
    rail.castShadow = true;
    group.add(rail);
  }

  const sleeperCount = Math.floor(length / 0.82);
  const sleepers = new THREE.InstancedMesh(
    new THREE.BoxGeometry(2.45, 0.16, 0.24),
    createTimberMaterial({ color: linearColor(0x51463d), roughness: 0.96 }),
    sleeperCount
  );
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const scale = new THREE.Vector3(1, 1, 1);
  for (let index = 0; index < sleeperCount; index += 1) {
    const u = (index + 0.5) / sleeperCount;
    const point = curve.getPointAt(u);
    point.y += 0.035;
    euler.set(0, yawAt(u, curve), 0);
    matrix.compose(point, quaternion.setFromEuler(euler), scale);
    sleepers.setMatrixAt(index, matrix);
  }
  sleepers.castShadow = true;
  sleepers.receiveShadow = true;
  group.add(sleepers);
}

export function createRailway() {
  const group = new THREE.Group();
  trackCurves.forEach((curve) => addTrack(group, curve));
  group.userData.trackCurves = trackCurves;
  return group;
}
