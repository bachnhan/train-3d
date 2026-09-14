// Procedural Shibuya River Canal Patrol Boat (東京都 渋谷川河川巡回艇)
// Zero-dependency Three.js r125 model with realistic water heave, pitch, roll, and wake animation.

import { SHIBUYA_RIVER } from "./map-model.js";

// Active patrol segment along the open Shibuya canal (Z from -460 to -130)
const BOAT_WAYPOINTS = [];
for (let i = 1; i <= 6 && i < SHIBUYA_RIVER.length; i += 1) {
  BOAT_WAYPOINTS.push({
    x: SHIBUYA_RIVER[i][0],
    z: SHIBUYA_RIVER[i][1]
  });
}

const SEGMENT_LENGTHS = [];
let TOTAL_RIVER_LENGTH = 0;
for (let i = 1; i < BOAT_WAYPOINTS.length; i += 1) {
  const p0 = BOAT_WAYPOINTS[i - 1];
  const p1 = BOAT_WAYPOINTS[i];
  const len = Math.hypot(p1.x - p0.x, p1.z - p0.z);
  SEGMENT_LENGTHS.push(len);
  TOTAL_RIVER_LENGTH += len;
}

function getBoatPoseAtDistance(dist) {
  let remaining = Math.max(0, Math.min(TOTAL_RIVER_LENGTH, dist));
  for (let i = 0; i < SEGMENT_LENGTHS.length; i += 1) {
    const segLen = SEGMENT_LENGTHS[i];
    if (remaining <= segLen || i === SEGMENT_LENGTHS.length - 1) {
      const t = segLen > 0 ? remaining / segLen : 0;
      const p0 = BOAT_WAYPOINTS[i];
      const p1 = BOAT_WAYPOINTS[i + 1];
      const dx = p1.x - p0.x;
      const dz = p1.z - p0.z;
      return {
        x: p0.x + dx * t,
        z: p0.z + dz * t,
        yaw: Math.atan2(dx, dz)
      };
    }
    remaining -= segLen;
  }
  const last = BOAT_WAYPOINTS[BOAT_WAYPOINTS.length - 1];
  return { x: last.x, z: last.z, yaw: 0 };
}

let boatGroup = null;
let boatHullGroup = null;
let wakeMesh = null;
let boatState = {
  distance: 30,
  direction: 1,
  speed: 2.2, // ~4.3 knots
  elapsed: 0
};

export function createRiverBoat(scene) {
  if (typeof window !== "undefined") {
    window.__riverBoatState = boatState;
  }
  boatGroup = new THREE.Group();
  boatGroup.name = "Shibuya River Patrol Boat";

  // Shared boat materials
  const matHullWhite = new THREE.MeshLambertMaterial({ color: 0xf8fafc });
  const matNavyStripe = new THREE.MeshLambertMaterial({ color: 0x1e3a8a });
  const matDeckGrey = new THREE.MeshLambertMaterial({ color: 0x94a3b8 });
  const matCabinGlass = new THREE.MeshLambertMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.75 });
  const matGunwale = new THREE.MeshLambertMaterial({ color: 0x0f172a });
  const matMetal = new THREE.MeshLambertMaterial({ color: 0x64748b });
  const matLifebuoy = new THREE.MeshLambertMaterial({ color: 0xea580c });
  const matWhite = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const matSearchlight = new THREE.MeshBasicMaterial({ color: 0xfef08a });
  const matNavRed = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  const matNavGreen = new THREE.MeshBasicMaterial({ color: 0x22c55e });

  // Floating sub-group that oscillates with water dynamics
  boatHullGroup = new THREE.Group();
  boatHullGroup.name = "Boat Hull Dynamics";

  const boatLength = 6.6;
  const boatBeam = 2.1;

  // 1. Lower V-Hull (sitting slightly submerged at water line)
  const hullBottomGeom = new THREE.BoxGeometry(boatBeam * 0.85, 0.40, boatLength);
  const hullBottom = new THREE.Mesh(hullBottomGeom, matNavyStripe);
  hullBottom.position.y = -0.05;
  boatHullGroup.add(hullBottom);

  // 2. Main Topsides Hull
  const hullTopGeom = new THREE.BoxGeometry(boatBeam, 0.45, boatLength);
  const hullTop = new THREE.Mesh(hullTopGeom, matHullWhite);
  hullTop.position.y = 0.22;
  boatHullGroup.add(hullTop);

  // 3. Tapered Bow Nose (pointed bow stem)
  const bowNoseGeom = new THREE.CylinderGeometry(0.08, boatBeam / 2, 1.6, 6);
  const bowNose = new THREE.Mesh(bowNoseGeom, matHullWhite);
  bowNose.rotation.x = Math.PI / 2;
  bowNose.position.set(0, 0.22, boatLength / 2 + 0.6);
  boatHullGroup.add(bowNose);

  // 4. Heavy Rubber D-Fender (Rubbing Strake / 防舷材) around the sheerline
  const fenderSideGeom = new THREE.BoxGeometry(0.12, 0.12, boatLength + 0.3);
  const leftFender = new THREE.Mesh(fenderSideGeom, matGunwale);
  leftFender.position.set(-boatBeam / 2 - 0.04, 0.38, 0);
  boatHullGroup.add(leftFender);

  const rightFender = new THREE.Mesh(fenderSideGeom, matGunwale);
  rightFender.position.set(boatBeam / 2 + 0.04, 0.38, 0);
  boatHullGroup.add(rightFender);

  // Bow rubber fender cushion
  const bowFenderGeom = new THREE.BoxGeometry(boatBeam * 0.8, 0.16, 0.20);
  const bowFender = new THREE.Mesh(bowFenderGeom, matGunwale);
  bowFender.position.set(0, 0.38, boatLength / 2 + 1.25);
  boatHullGroup.add(bowFender);

  // 5. Foredeck & Cockpit Floor
  const deckGeom = new THREE.BoxGeometry(boatBeam * 0.88, 0.04, boatLength * 0.9);
  const deck = new THREE.Mesh(deckGeom, matDeckGrey);
  deck.position.y = 0.44;
  boatHullGroup.add(deck);

  // 6. Pilot House / Wheelhouse Cabin (Authentic Tokyo canal low air-draught design)
  const cabinW = 1.65;
  const cabinH = 0.48;
  const cabinL = 2.4;
  const cabinGeom = new THREE.BoxGeometry(cabinW, cabinH, cabinL);
  const cabin = new THREE.Mesh(cabinGeom, matHullWhite);
  cabin.position.set(0, 0.58, 0.2);
  boatHullGroup.add(cabin);

  // Cabin windshield & side windows
  const winFrontGeom = new THREE.BoxGeometry(cabinW * 0.92, 0.22, 0.08);
  const winFront = new THREE.Mesh(winFrontGeom, matCabinGlass);
  winFront.position.set(0, 0.64, 0.2 + cabinL / 2 + 0.02);
  boatHullGroup.add(winFront);

  const winSideGeom = new THREE.BoxGeometry(0.08, 0.20, cabinL * 0.7);
  const winLeft = new THREE.Mesh(winSideGeom, matCabinGlass);
  winLeft.position.set(-cabinW / 2 - 0.02, 0.64, 0.2);
  boatHullGroup.add(winLeft);

  const winRight = new THREE.Mesh(winSideGeom, matCabinGlass);
  winRight.position.set(cabinW / 2 + 0.02, 0.64, 0.2);
  boatHullGroup.add(winRight);

  // 7. Low-Profile Folding Radar Arch & Mast (Clears canal bridge arches)
  const archGeom = new THREE.BoxGeometry(cabinW * 0.8, 0.06, 0.14);
  const arch = new THREE.Mesh(archGeom, matMetal);
  arch.position.set(0, 0.85, -0.4);
  boatHullGroup.add(arch);

  // Radar Scanner Dome
  const radarGeom = new THREE.CylinderGeometry(0.18, 0.20, 0.10, 10);
  const radar = new THREE.Mesh(radarGeom, matWhite);
  radar.position.set(0, 0.93, -0.4);
  boatHullGroup.add(radar);

  // Cabin Roof Searchlight
  const searchlightGeom = new THREE.CylinderGeometry(0.09, 0.07, 0.14, 8);
  const searchlight = new THREE.Mesh(searchlightGeom, matMetal);
  searchlight.rotation.x = Math.PI / 2;
  searchlight.position.set(0, 0.87, 0.8);
  boatHullGroup.add(searchlight);

  const searchlightLens = new THREE.Mesh(new THREE.CircleGeometry(0.08, 8), matSearchlight);
  searchlightLens.position.set(0, 0.87, 0.88);
  boatHullGroup.add(searchlightLens);

  // Navigation lights (Port red / Starboard green)
  const navLightGeom = new THREE.BoxGeometry(0.08, 0.08, 0.08);
  const navPort = new THREE.Mesh(navLightGeom, matNavRed);
  navPort.position.set(-cabinW / 2 - 0.05, 0.80, 0.4);
  boatHullGroup.add(navPort);

  const navStarboard = new THREE.Mesh(navLightGeom, matNavGreen);
  navStarboard.position.set(cabinW / 2 + 0.05, 0.80, 0.4);
  boatHullGroup.add(navStarboard);

  // 8. Lifebuoy Ring (救命浮環) mounted on cabin side
  const lifebuoyTorus = new THREE.TorusGeometry(0.20, 0.055, 8, 16);
  const lifebuoy = new THREE.Mesh(lifebuoyTorus, matLifebuoy);
  lifebuoy.position.set(-cabinW / 2 - 0.06, 0.68, -0.2);
  lifebuoy.rotation.y = Math.PI / 2;
  boatHullGroup.add(lifebuoy);

  // 9. Twin Outboard Motors on Transom
  for (const side of [-1, 1]) {
    const motorGeom = new THREE.BoxGeometry(0.28, 0.65, 0.38);
    const motor = new THREE.Mesh(motorGeom, matGunwale);
    motor.position.set(side * 0.55, 0.18, -boatLength / 2 - 0.22);
    boatHullGroup.add(motor);

    const propShaft = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.32, 0.18), matMetal);
    propShaft.position.set(side * 0.55, -0.22, -boatLength / 2 - 0.22);
    boatHullGroup.add(propShaft);
  }

  // 10. Stainless Steel Bow Pulpit Railing
  const bowRailGeom = new THREE.BoxGeometry(boatBeam * 0.7, 0.04, 0.04);
  const bowRail = new THREE.Mesh(bowRailGeom, matMetal);
  bowRail.position.set(0, 0.82, boatLength / 2 + 0.8);
  boatHullGroup.add(bowRail);

  boatGroup.add(boatHullGroup);

  // 11. Water Surface Stern Wake Mesh
  const matWake = new THREE.MeshBasicMaterial({
    color: 0x93c5fd,
    transparent: true,
    opacity: 0.35,
    depthWrite: false
  });
  const wakeGeom = new THREE.PlaneGeometry(boatBeam * 1.6, 7.0);
  wakeMesh = new THREE.Mesh(wakeGeom, matWake);
  wakeMesh.rotation.x = -Math.PI / 2;
  wakeMesh.position.set(0, 0.01, -boatLength / 2 - 3.4);
  boatGroup.add(wakeMesh);

  scene.add(boatGroup);
  return boatGroup;
}

export function updateRiverBoat(delta) {
  if (!boatGroup || !boatHullGroup) return;
  const dt = Math.min(delta, 0.1);
  boatState.elapsed += dt;

  // Advance along river canal
  boatState.distance += boatState.direction * boatState.speed * dt;

  // Reverse patrol course at boundary ends
  if (boatState.distance >= TOTAL_RIVER_LENGTH - 4) {
    boatState.distance = TOTAL_RIVER_LENGTH - 4;
    boatState.direction = -1;
  } else if (boatState.distance <= 4) {
    boatState.distance = 4;
    boatState.direction = 1;
  }

  const pose = getBoatPoseAtDistance(boatState.distance);
  const facingYaw = boatState.direction > 0 ? pose.yaw : pose.yaw + Math.PI;

  boatGroup.position.x = pose.x;
  boatGroup.position.z = pose.z;
  boatGroup.position.y = 0.00; // Water level
  boatGroup.rotation.y = facingYaw;

  // Realistic water dynamics: heave, pitch, and roll
  const t = boatState.elapsed;
  const heave = Math.sin(t * 2.3) * 0.022 + Math.cos(t * 1.1) * 0.008;
  const roll = Math.sin(t * 1.8) * 0.024;
  const pitch = Math.cos(t * 2.1) * 0.014;

  boatHullGroup.position.y = heave;
  boatHullGroup.rotation.z = roll;
  boatHullGroup.rotation.x = pitch;

  // Oscillating wake intensity
  if (wakeMesh) {
    wakeMesh.material.opacity = 0.28 + Math.sin(t * 4.0) * 0.08;
  }
}

export function getRiverBoatPose() {
  if (!boatGroup) return null;
  const facingYaw = boatGroup.rotation.y;
  return {
    id: "boat",
    type: "boat",
    name: "渋谷川 巡回艇 (Shibuya Canal Patrol)",
    label: "東京都 渋谷川河川巡回艇 · 4.3kt",
    position: boatGroup.position,
    yaw: facingYaw,
    speed: boatState.speed,
    height: 1.8
  };
}
