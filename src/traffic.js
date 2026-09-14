// Procedural Autonomous Street Traffic System for Train 3D
// Simulates running Tokyo City Bus and Tokyo Crown Taxi along surveyed Tokyo road loops.

// 1. Bus Loop (Shibuya Terminal / Meiji-dori / Roppongi-dori / Shibuya Stream Loop)
const BUS_WAYPOINTS = [
  { x: 69.8,  z: -506.6 },
  { x: 57.2,  z: -523.8 },
  { x: 67.5,  z: -526.0 },
  { x: 125.8, z: -534.7 },
  { x: 140.6, z: -533.3 },
  { x: 164.2, z: -536.3 },
  { x: 181.2, z: -539.9 },
  { x: 178.8, z: -523.5 },
  { x: 173.2, z: -517.6 },
  { x: 119.5, z: -514.0 },
  { x: 93.3,  z: -510.6 },
  { x: 79.9,  z: -508.5 },
  { x: 93.7,  z: -491.3 },
  { x: 122.5, z: -464.3 },
  { x: 172.8, z: -417.2 },
  { x: 159.9, z: -404.3 },
  { x: 81.1,  z: -491.3 },
  { x: 69.8,  z: -506.6 }
];

// 2. Taxi Loop (Shibuya Namikibashi / Hachiman-dori / Daikanyama Station Loop / Daikanyama-zaka)
const TAXI_WAYPOINTS = [
  { x: 323.2, z: -96.1 },
  { x: 295.4, z: -46.6 },
  { x: 269.5, z: -3.1 },
  { x: 256.7, z: 18.2 },
  { x: 244.5, z: 39.3 },
  { x: 225.3, z: 73.9 },
  { x: 219.8, z: 84.0 },
  { x: 199.6, z: 122.8 },
  { x: 179.0, z: 161.2 },
  { x: 161.0, z: 192.8 },
  { x: 142.4, z: 226.4 },
  { x: 128.9, z: 242.3 },
  { x: 101.8, z: 270.4 },
  { x: 79.6,  z: 292.7 },
  { x: 71.0,  z: 302.8 },
  { x: 37.0,  z: 354.0 },
  { x: 16.9,  z: 384.2 },
  { x: -2.3,  z: 429.9 },
  { x: -14.4, z: 460.4 },
  { x: -26.9, z: 491.6 },
  { x: -31.3, z: 502.7 },
  { x: -23.1, z: 502.2 },
  { x: -0.7,  z: 502.9 },
  { x: 22.4,  z: 512.7 },
  { x: 43.2,  z: 526.7 },
  { x: 63.8,  z: 543.9 },
  { x: 90.4,  z: 548.4 },
  { x: 111.1, z: 537.0 },
  { x: 131.4, z: 523.7 },
  { x: 151.0, z: 504.6 },
  { x: 164.3, z: 474.3 },
  { x: 175.1, z: 415.8 },
  { x: 166.8, z: 404.1 },
  { x: 151.9, z: 404.1 },
  { x: 137.2, z: 400.0 },
  { x: 83.5,  z: 375.3 },
  { x: 64.9,  z: 370.8 },
  { x: 42.7,  z: 357.4 },
  { x: 37.0,  z: 354.0 },
  { x: 71.0,  z: 302.8 },
  { x: 79.6,  z: 292.7 },
  { x: 101.8, z: 270.4 },
  { x: 128.9, z: 242.3 },
  { x: 142.4, z: 226.4 },
  { x: 161.0, z: 192.8 },
  { x: 179.0, z: 161.2 },
  { x: 199.6, z: 122.8 },
  { x: 219.8, z: 84.0 },
  { x: 225.3, z: 73.9 },
  { x: 244.5, z: 39.3 },
  { x: 256.7, z: 18.2 },
  { x: 269.5, z: -3.1 },
  { x: 295.4, z: -46.6 },
  { x: 323.2, z: -96.1 }
];

function normalizeAngle(ang) {
  let a = ang;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function lerpAngle(a, b, t) {
  const diff = normalizeAngle(b - a);
  return a + diff * t;
}

function buildRouteSegments(waypoints) {
  const segments = [];
  let totalLength = 0;
  for (let i = 1; i < waypoints.length; i += 1) {
    const p0 = waypoints[i - 1];
    const p1 = waypoints[i];
    const dx = p1.x - p0.x;
    const dz = p1.z - p0.z;
    const len = Math.hypot(dx, dz);
    const tx = len > 0 ? dx / len : 0;
    const tz = len > 0 ? dz / len : 1;
    const yaw = Math.atan2(dx, dz);
    segments.push({ len, p0, p1, dx, dz, tx, tz, yaw });
    totalLength += len;
  }
  return { segments, totalLength };
}

const busRoute = buildRouteSegments(BUS_WAYPOINTS);
const taxiRoute = buildRouteSegments(TAXI_WAYPOINTS);

function getPoseAtDistance(route, distance, laneOffset = 0) {
  let dist = distance % route.totalLength;
  if (dist < 0) dist += route.totalLength;

  let remaining = dist;
  const numSegs = route.segments.length;
  for (let i = 0; i < numSegs; i += 1) {
    const seg = route.segments[i];
    if (remaining <= seg.len || i === numSegs - 1) {
      const t = seg.len > 0 ? remaining / seg.len : 0;
      // Centerline position
      const cx = seg.p0.x + seg.dx * t;
      const cz = seg.p0.z + seg.dz * t;

      // Left-side driving lane offset in Japan: (-tz, tx) perpendicular to forward tangent
      const x = cx - seg.tz * laneOffset;
      const z = cz + seg.tx * laneOffset;

      // Smooth corner yaw easing
      let yaw = seg.yaw;
      const cornerBlendDist = 3.5;
      if (seg.len > cornerBlendDist && remaining > seg.len - cornerBlendDist) {
        const nextSeg = route.segments[(i + 1) % numSegs];
        const blendT = (remaining - (seg.len - cornerBlendDist)) / cornerBlendDist;
        const st = blendT * blendT * (3 - 2 * blendT);
        yaw = lerpAngle(seg.yaw, nextSeg.yaw, st * 0.5);
      } else if (seg.len > cornerBlendDist && remaining < cornerBlendDist) {
        const prevSeg = route.segments[(i - 1 + numSegs) % numSegs];
        const blendT = remaining / cornerBlendDist;
        const st = blendT * blendT * (3 - 2 * blendT);
        yaw = lerpAngle(prevSeg.yaw, seg.yaw, 0.5 + st * 0.5);
      }

      return { x, z, yaw };
    }
    remaining -= seg.len;
  }
  const last = route.segments[numSegs - 1].p1;
  return { x: last.x, z: last.z, yaw: 0 };
}

export class TrafficController {
  constructor(scene) {
    this.scene = scene;
    this.vehicles = new Map();

    this.group = new THREE.Group();
    this.group.name = "Tokyo Dynamic Street Traffic";
    this.scene.add(this.group);

    this._initBus();
    this._initTaxi();
  }

  _initBus() {
    const busGroup = new THREE.Group();
    busGroup.name = "Tokyo City Bus";

    const matBody = new THREE.MeshLambertMaterial({ color: 0xf8fafc });
    const matStripe = new THREE.MeshLambertMaterial({ color: 0xd71920 });
    const matSkirt = new THREE.MeshLambertMaterial({ color: 0x334155 });
    const matGlass = new THREE.MeshLambertMaterial({ color: 0x0f172a });
    const matSign = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
    const matHeadlight = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const matTaillight = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const matWheel = new THREE.MeshLambertMaterial({ color: 0x09090b });
    const matRoofPod = new THREE.MeshLambertMaterial({ color: 0xcbd5e1 });

    // Main bus body
    const bodyGeom = new THREE.BoxGeometry(2.45, 1.45, 8.8);
    const body = new THREE.Mesh(bodyGeom, matBody);
    body.position.y = 1.65;
    busGroup.add(body);

    // Crimson corporate stripe
    const stripeGeom = new THREE.BoxGeometry(2.47, 0.32, 8.82);
    const stripe = new THREE.Mesh(stripeGeom, matStripe);
    stripe.position.y = 0.95;
    busGroup.add(stripe);

    // Lower skirt
    const skirtGeom = new THREE.BoxGeometry(2.46, 0.45, 8.81);
    const skirt = new THREE.Mesh(skirtGeom, matSkirt);
    skirt.position.y = 0.55;
    busGroup.add(skirt);

    // Side passenger windows
    const winGeom = new THREE.BoxGeometry(2.48, 0.75, 6.8);
    const win = new THREE.Mesh(winGeom, matGlass);
    win.position.set(0, 1.82, 0.2);
    busGroup.add(win);

    // Front windshield
    const shieldGeom = new THREE.BoxGeometry(2.32, 0.88, 0.08);
    const shield = new THREE.Mesh(shieldGeom, matGlass);
    shield.position.set(0, 1.76, 4.38);
    busGroup.add(shield);

    // Front destination LED sign
    const signGeom = new THREE.BoxGeometry(1.4, 0.22, 0.04);
    const sign = new THREE.Mesh(signGeom, matSign);
    sign.position.set(0, 2.32, 4.41);
    busGroup.add(sign);

    // Headlights (front)
    for (const side of [-1, 1]) {
      const hlGeom = new THREE.BoxGeometry(0.32, 0.16, 0.04);
      const hl = new THREE.Mesh(hlGeom, matHeadlight);
      hl.position.set(side * 0.92, 0.62, 4.41);
      busGroup.add(hl);

      // Taillights (rear)
      const tlGeom = new THREE.BoxGeometry(0.32, 0.16, 0.04);
      const tl = new THREE.Mesh(tlGeom, matTaillight);
      tl.position.set(side * 0.92, 0.62, -4.41);
      busGroup.add(tl);
    }

    // 6 Wheels
    const wheels = [];
    for (const side of [-1, 1]) {
      for (const wz of [-2.6, -1.5, 2.8]) {
        const wGeom = new THREE.CylinderGeometry(0.44, 0.44, 0.22, 8);
        const w = new THREE.Mesh(wGeom, matWheel);
        w.rotation.z = Math.PI / 2;
        w.position.set(side * 1.18, 0.44, wz);
        busGroup.add(w);
        wheels.push(w);
      }
    }

    // Rooftop AC Pods
    const acGeom = new THREE.BoxGeometry(1.5, 0.30, 2.6);
    const ac = new THREE.Mesh(acGeom, matRoofPod);
    ac.position.set(0, 2.52, 0.5);
    busGroup.add(ac);

    this.group.add(busGroup);

    this.vehicles.set("bus", {
      id: "bus",
      type: "bus",
      name: "都バス (City Bus)",
      label: "都バス · 渋谷駅東口循環",
      group: busGroup,
      wheels,
      route: busRoute,
      distance: 60,
      laneOffset: 1.6, // Drive on left side of 2-lane road
      speed: 6.8, // ~24 km/h realistic urban bus speed
      height: 2.8,
      position: new THREE.Vector3(),
      yaw: 0
    });
  }

  _initTaxi() {
    const taxiGroup = new THREE.Group();
    taxiGroup.name = "Tokyo Crown Taxi";

    const matBody = new THREE.MeshLambertMaterial({ color: 0x155e75 }); // Deep cyan/navy
    const matGlass = new THREE.MeshLambertMaterial({ color: 0x0f172a });
    const matAndon = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const matHeadlight = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const matTaillight = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const matWheel = new THREE.MeshLambertMaterial({ color: 0x09090b });
    const matBumper = new THREE.MeshLambertMaterial({ color: 0x334155 });

    // Lower chassis & fenders
    const bodyGeom = new THREE.BoxGeometry(1.74, 0.54, 4.4);
    const body = new THREE.Mesh(bodyGeom, matBody);
    body.position.y = 0.52;
    taxiGroup.add(body);

    // Passenger cabin greenhouse
    const cabinGeom = new THREE.BoxGeometry(1.52, 0.55, 2.3);
    const cabin = new THREE.Mesh(cabinGeom, matBody);
    cabin.position.set(0, 1.05, -0.2);
    taxiGroup.add(cabin);

    // Windshield & side windows
    const winGeom = new THREE.BoxGeometry(1.54, 0.46, 2.1);
    const win = new THREE.Mesh(winGeom, matGlass);
    win.position.set(0, 1.06, -0.2);
    taxiGroup.add(win);

    // Front windshield rake
    const shieldGeom = new THREE.BoxGeometry(1.44, 0.48, 0.06);
    const shield = new THREE.Mesh(shieldGeom, matGlass);
    shield.position.set(0, 1.05, 0.95);
    taxiGroup.add(shield);

    // Rooftop glowing TAXI andon dome
    const andonGeom = new THREE.BoxGeometry(0.48, 0.22, 0.28);
    const andon = new THREE.Mesh(andonGeom, matAndon);
    andon.position.set(0, 1.44, -0.2);
    taxiGroup.add(andon);

    // Bumpers
    const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.18, 0.16), matBumper);
    frontBumper.position.set(0, 0.38, 2.22);
    taxiGroup.add(frontBumper);

    const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.18, 0.16), matBumper);
    rearBumper.position.set(0, 0.38, -2.22);
    taxiGroup.add(rearBumper);

    // Headlights & Taillights
    for (const side of [-1, 1]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.04), matHeadlight);
      hl.position.set(side * 0.65, 0.55, 2.21);
      taxiGroup.add(hl);

      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.04), matTaillight);
      tl.position.set(side * 0.65, 0.55, -2.21);
      taxiGroup.add(tl);
    }

    // 4 Wheels
    const wheels = [];
    for (const side of [-1, 1]) {
      for (const wz of [-1.2, 1.25]) {
        const wGeom = new THREE.CylinderGeometry(0.32, 0.32, 0.18, 8);
        const w = new THREE.Mesh(wGeom, matWheel);
        w.rotation.z = Math.PI / 2;
        w.position.set(side * 0.88, 0.32, wz);
        taxiGroup.add(w);
        wheels.push(w);
      }
    }

    this.group.add(taxiGroup);

    this.vehicles.set("taxi", {
      id: "taxi",
      type: "taxi",
      name: "東京タクシー (Tokyo Taxi)",
      label: "個人タクシー · クラウン (代官山線)",
      group: taxiGroup,
      wheels,
      route: taxiRoute,
      distance: 120,
      laneOffset: 1.4, // Drive on left side
      speed: 8.8, // ~32 km/h realistic cruising speed
      height: 1.5,
      position: new THREE.Vector3(),
      yaw: 0
    });
  }

  update(delta) {
    const dt = Math.min(delta, 0.1);

    for (const vehicle of this.vehicles.values()) {
      vehicle.distance += vehicle.speed * dt;
      const pose = getPoseAtDistance(vehicle.route, vehicle.distance, vehicle.laneOffset || 0);

      vehicle.group.position.x = pose.x;
      vehicle.group.position.z = pose.z;
      vehicle.group.position.y = 0.06;
      vehicle.group.rotation.y = pose.yaw;

      vehicle.position.set(pose.x, 0.06, pose.z);
      vehicle.yaw = pose.yaw;

      // Wheel rotation
      const wheelSpin = (vehicle.speed * dt) / 0.4;
      for (let i = 0; i < vehicle.wheels.length; i += 1) {
        vehicle.wheels[i].rotation.x += wheelSpin;
      }
    }
  }

  getVehiclePose(id) {
    const v = this.vehicles.get(id);
    if (!v) return null;
    return {
      id: v.id,
      type: v.type,
      name: v.name,
      label: v.label,
      position: v.position,
      yaw: v.yaw,
      speed: v.speed,
      height: v.height
    };
  }

  getAllVehicles() {
    return Array.from(this.vehicles.values());
  }
}
