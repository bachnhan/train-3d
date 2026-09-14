// Procedural Tokyo Sky Atmosphere: Sun Disc Corona, Volumetric Low-Poly Clouds, and Haneda Commercial Jet
// Zero-dependency Three.js r125 system.

let skyGroup = null;
let sunDiscGroup = null;
let cloudClusters = [];
let airplane = null;

export function createSkyAtmosphere(scene) {
  skyGroup = new THREE.Group();
  skyGroup.name = "Tokyo Sky Atmosphere";

  // 1. Sun Disc & Corona Glow (Aligned with Directional Light Vector [-180, 260, 120])
  sunDiscGroup = new THREE.Group();
  sunDiscGroup.name = "Sun Disc Corona";

  // Positioned along the directional light ray at ~540m into the sky dome
  const sunDir = new THREE.Vector3(-180, 260, 120).normalize();
  const sunDistance = 540;
  sunDiscGroup.position.copy(sunDir.clone().multiplyScalar(sunDistance));
  sunDiscGroup.lookAt(0, 50, 0);

  // Radiant central sun core (blinding warm white)
  const coreGeom = new THREE.CircleGeometry(26, 32);
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0xfffdf0,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const sunCore = new THREE.Mesh(coreGeom, coreMat);
  sunDiscGroup.add(sunCore);

  // Inner corona ring (warm golden daylight)
  const innerCoronaGeom = new THREE.RingGeometry(24, 46, 32);
  const innerCoronaMat = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const innerCorona = new THREE.Mesh(innerCoronaGeom, innerCoronaMat);
  sunDiscGroup.add(innerCorona);

  // Mid halo ring (soft amber atmospheric scattering)
  const midCoronaGeom = new THREE.RingGeometry(44, 78, 32);
  const midCoronaMat = new THREE.MeshBasicMaterial({
    color: 0xfde047,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const midCorona = new THREE.Mesh(midCoronaGeom, midCoronaMat);
  sunDiscGroup.add(midCorona);

  // Outer ambient sky glow
  const outerCoronaGeom = new THREE.RingGeometry(75, 125, 32);
  const outerCoronaMat = new THREE.MeshBasicMaterial({
    color: 0xfbbf24,
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const outerCorona = new THREE.Mesh(outerCoronaGeom, outerCoronaMat);
  sunDiscGroup.add(outerCorona);

  // Stylized radial solar flares / rays
  const rayMat = new THREE.MeshBasicMaterial({
    color: 0xfef9c3,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  for (let i = 0; i < 8; i += 1) {
    const angle = (i * Math.PI) / 4;
    const rayGeom = new THREE.PlaneGeometry(6.0, 160);
    const ray = new THREE.Mesh(rayGeom, rayMat);
    ray.rotation.z = angle;
    sunDiscGroup.add(ray);
  }

  skyGroup.add(sunDiscGroup);

  // 2. Volumetric Curved Cumulus Clouds (有機的な曲線積乱雲)
  const matCloudTop = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const matCloudShade = new THREE.MeshLambertMaterial({ color: 0xcbd5e1 });

  function getCloudPuffs(type, s) {
    if (type === "elongated") {
      return [
        // Base shade cushions
        { x: -10 * s, y: -2.5 * s, z: 0, rx: 18 * s, ry: 4.5 * s, rz: 14 * s, mat: matCloudShade },
        { x: 10 * s, y: -2.5 * s, z: 0, rx: 18 * s, ry: 4.5 * s, rz: 14 * s, mat: matCloudShade },
        // Main billowing bodies
        { x: -8 * s, y: 2.5 * s, z: 1 * s, rx: 16 * s, ry: 10 * s, rz: 13 * s, mat: matCloudTop },
        { x: 8 * s, y: 2.5 * s, z: -1 * s, rx: 16 * s, ry: 9.5 * s, rz: 13 * s, mat: matCloudTop },
        // Central crown billow
        { x: 0, y: 5 * s, z: 0, rx: 14 * s, ry: 11 * s, rz: 12 * s, mat: matCloudTop },
        // Outer crest puffs
        { x: -22 * s, y: 1 * s, z: -2 * s, rx: 12 * s, ry: 7 * s, rz: 10 * s, mat: matCloudTop },
        { x: 22 * s, y: 1 * s, z: 2 * s, rx: 12 * s, ry: 7.5 * s, rz: 10 * s, mat: matCloudTop },
        // Flanking lobes
        { x: -4 * s, y: 2 * s, z: 9 * s, rx: 11 * s, ry: 7 * s, rz: 10 * s, mat: matCloudTop },
        { x: 4 * s, y: 2 * s, z: -8 * s, rx: 11 * s, ry: 7 * s, rz: 9.5 * s, mat: matCloudTop }
      ];
    } else if (type === "compact") {
      return [
        // Base shade cushion
        { x: 0, y: -2.5 * s, z: 0, rx: 18 * s, ry: 5 * s, rz: 16 * s, mat: matCloudShade },
        // Central dome
        { x: 0, y: 2.5 * s, z: 0, rx: 15 * s, ry: 11 * s, rz: 14 * s, mat: matCloudTop },
        // Summit crown
        { x: 1 * s, y: 7 * s, z: 1 * s, rx: 11 * s, ry: 9 * s, rz: 10 * s, mat: matCloudTop },
        // Left and right rounded lobes
        { x: -10 * s, y: 2 * s, z: -2 * s, rx: 12 * s, ry: 8 * s, rz: 11 * s, mat: matCloudTop },
        { x: 10 * s, y: 2 * s, z: 2 * s, rx: 12 * s, ry: 8 * s, rz: 11 * s, mat: matCloudTop },
        // Forward and aft rounded lobes
        { x: -1 * s, y: 1.5 * s, z: 8 * s, rx: 10 * s, ry: 7 * s, rz: 10 * s, mat: matCloudTop },
        { x: 1 * s, y: 1.5 * s, z: -7 * s, rx: 10 * s, ry: 7 * s, rz: 9 * s, mat: matCloudTop }
      ];
    } else {
      // Default "cumulus": Majestic towering billowing cumulus cloud
      return [
        // Flat broad base cushions (under-shadow)
        { x: 0, y: -3 * s, z: 0, rx: 22 * s, ry: 5.5 * s, rz: 18 * s, mat: matCloudShade },
        { x: 5 * s, y: -3.5 * s, z: 3 * s, rx: 16 * s, ry: 4.5 * s, rz: 14 * s, mat: matCloudShade },
        // Main central body
        { x: 0, y: 3 * s, z: 0, rx: 17 * s, ry: 13 * s, rz: 15 * s, mat: matCloudTop },
        // High towering billow crown
        { x: 3 * s, y: 8 * s, z: 1 * s, rx: 12 * s, ry: 11 * s, rz: 11 * s, mat: matCloudTop },
        // Flanking billowing mounds
        { x: -12 * s, y: 3 * s, z: -2 * s, rx: 14 * s, ry: 9.5 * s, rz: 12 * s, mat: matCloudTop },
        { x: 13 * s, y: 3.5 * s, z: 2 * s, rx: 15 * s, ry: 9 * s, rz: 13 * s, mat: matCloudTop },
        // Outlying rounded lobes
        { x: -2 * s, y: 2 * s, z: 10 * s, rx: 12 * s, ry: 8 * s, rz: 12 * s, mat: matCloudTop },
        { x: 2 * s, y: 2 * s, z: -9 * s, rx: 12 * s, ry: 8 * s, rz: 11 * s, mat: matCloudTop },
        // Mid-level shoulder puffs
        { x: -7 * s, y: 6 * s, z: 4 * s, rx: 9.5 * s, ry: 7.5 * s, rz: 9.5 * s, mat: matCloudTop },
        { x: 8 * s, y: 6.5 * s, z: -3 * s, rx: 10 * s, ry: 7.5 * s, rz: 9 * s, mat: matCloudTop }
      ];
    }
  }

  cloudClusters = [];
  const CLOUD_CONFIGS = [
    { x: -280, y: 155, z: -560, scale: 1.2, type: "cumulus" },
    { x: -110, y: 168, z: -360, scale: 0.95, type: "compact" },
    { x: 160, y: 148, z: -480, scale: 1.15, type: "elongated" },
    { x: -210, y: 162, z: -140, scale: 1.05, type: "cumulus" },
    { x: 230, y: 172, z: -70, scale: 1.3, type: "elongated" },
    { x: -80, y: 152, z: 110, scale: 0.9, type: "compact" },
    { x: 180, y: 165, z: 260, scale: 1.1, type: "cumulus" },
    { x: -260, y: 158, z: 400, scale: 1.25, type: "elongated" },
    { x: 60, y: 175, z: 540, scale: 1.0, type: "compact" },
    { x: -140, y: 160, z: 660, scale: 1.15, type: "cumulus" },
    { x: 240, y: 150, z: 600, scale: 0.85, type: "compact" }
  ];

  CLOUD_CONFIGS.forEach((cfg, idx) => {
    const cluster = new THREE.Group();
    cluster.name = `Cloud cluster ${idx}`;
    cluster.position.set(cfg.x, cfg.y, cfg.z);

    const puffs = getCloudPuffs(cfg.type, cfg.scale);
    puffs.forEach((p) => {
      // 12x8 smooth sphere geometry scaled at the buffer level to preserve uniform mesh scale
      const puffGeom = new THREE.SphereGeometry(1, 12, 8);
      puffGeom.scale(p.rx, p.ry, p.rz);
      const puff = new THREE.Mesh(puffGeom, p.mat);
      puff.position.set(p.x, p.y, p.z);
      cluster.add(puff);
    });

    skyGroup.add(cluster);
    cloudClusters.push(cluster);
  });

  // 3. Commercial Passenger Airliner — Haneda Corridor Flight (都心上空羽田進入便)
  const jetGroup = new THREE.Group();
  jetGroup.name = "Haneda Commercial Jet";

  const matAeroWhite = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const matAeroGrey = new THREE.MeshLambertMaterial({ color: 0x94a3b8 });
  const matAirlineRed = new THREE.MeshLambertMaterial({ color: 0xdc2626 });
  const matAirlineNavy = new THREE.MeshLambertMaterial({ color: 0x1e3a8a });
  const matCockpitGlass = new THREE.MeshLambertMaterial({ color: 0x0f172a });
  const matEngineIntake = new THREE.MeshLambertMaterial({ color: 0x1e293b });

  const matBeaconRed = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  const matStrobeWhite = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const matNavGreen = new THREE.MeshBasicMaterial({ color: 0x22c55e });

  // Fuselage (Length = 19.5m, Diameter = 2.4m)
  const fuselageGeom = new THREE.CylinderGeometry(1.2, 1.2, 15.0, 12);
  const fuselage = new THREE.Mesh(fuselageGeom, matAeroWhite);
  fuselage.rotation.x = Math.PI / 2;
  jetGroup.add(fuselage);

  // Aerodynamic Nose Cone
  const noseGeom = new THREE.ConeGeometry(1.2, 3.8, 12);
  const nose = new THREE.Mesh(noseGeom, matAeroWhite);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = 7.5 + 1.9;
  jetGroup.add(nose);

  // Flight Deck Windshield Visor
  const windshieldGeom = new THREE.BoxGeometry(1.4, 0.45, 0.6);
  const windshield = new THREE.Mesh(windshieldGeom, matCockpitGlass);
  windshield.position.set(0, 0.55, 7.8);
  jetGroup.add(windshield);

  // Tapered Tail Cone
  const tailConeGeom = new THREE.ConeGeometry(1.2, 4.4, 12);
  const tailCone = new THREE.Mesh(tailConeGeom, matAeroWhite);
  tailCone.rotation.x = Math.PI / 2;
  tailCone.position.z = -7.5 - 2.2;
  jetGroup.add(tailCone);

  // Vertical Fin / Tail Stabilizer with Tokyo Airline Livery
  const finGeom = new THREE.BoxGeometry(0.22, 4.6, 3.8);
  const fin = new THREE.Mesh(finGeom, matAeroWhite);
  fin.position.set(0, 2.8, -8.2);
  jetGroup.add(fin);

  // Airline Tail Livery Flashes (Red & Navy)
  const finFlashRed = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.2, 2.2), matAirlineRed);
  finFlashRed.position.set(0, 3.6, -8.6);
  jetGroup.add(finFlashRed);

  const finFlashNavy = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.6, 2.8), matAirlineNavy);
  finFlashNavy.position.set(0, 2.0, -8.2);
  jetGroup.add(finFlashNavy);

  // Horizontal Tailplanes
  const hTailGeom = new THREE.BoxGeometry(7.4, 0.16, 2.2);
  const hTail = new THREE.Mesh(hTailGeom, matAeroGrey);
  hTail.position.set(0, 1.2, -9.0);
  jetGroup.add(hTail);

  // Main Swept Wings (Wingspan = 18m)
  const wingGeom = new THREE.BoxGeometry(18.0, 0.22, 3.4);
  const wing = new THREE.Mesh(wingGeom, matAeroGrey);
  wing.position.set(0, -0.2, 0.5);
  jetGroup.add(wing);

  // Winglets (upturned tips)
  for (const side of [-1, 1]) {
    const wingletGeom = new THREE.BoxGeometry(0.14, 1.2, 0.9);
    const winglet = new THREE.Mesh(wingletGeom, matAirlineRed);
    winglet.position.set(side * 8.95, 0.5, 0.4);
    jetGroup.add(winglet);
  }

  // Twin Turbofan Engines under wings
  for (const side of [-1, 1]) {
    const ex = side * 3.8;
    const engineGeom = new THREE.CylinderGeometry(0.85, 0.85, 3.2, 12);
    const engine = new THREE.Mesh(engineGeom, matAeroWhite);
    engine.rotation.x = Math.PI / 2;
    engine.position.set(ex, -1.1, 1.2);
    jetGroup.add(engine);

    // Intake Rim / Fan
    const intakeGeom = new THREE.CylinderGeometry(0.72, 0.72, 0.2, 10);
    const intake = new THREE.Mesh(intakeGeom, matEngineIntake);
    intake.rotation.x = Math.PI / 2;
    intake.position.set(ex, -1.1, 2.75);
    jetGroup.add(intake);

    // Engine Pylon
    const pylonGeom = new THREE.BoxGeometry(0.16, 0.8, 1.8);
    const pylon = new THREE.Mesh(pylonGeom, matAeroGrey);
    pylon.position.set(ex, -0.65, 1.2);
    jetGroup.add(pylon);
  }

  // Anti-collision Red Beacons (Fuselage Spine & Belly)
  const beaconTop = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.24), matBeaconRed);
  beaconTop.position.set(0, 1.32, 0.8);
  jetGroup.add(beaconTop);

  const beaconBelly = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.24), matBeaconRed);
  beaconBelly.position.set(0, -1.32, 0.8);
  jetGroup.add(beaconBelly);

  // Wingtip Navigation & White Strobe Lights
  const portNav = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.18), matBeaconRed);
  portNav.position.set(-9.05, -0.15, 0.5);
  jetGroup.add(portNav);

  const stbdNav = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.18), matNavGreen);
  stbdNav.position.set(9.05, -0.15, 0.5);
  jetGroup.add(stbdNav);

  const strobeLeft = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), matStrobeWhite);
  strobeLeft.position.set(-9.05, 0.0, 0.3);
  jetGroup.add(strobeLeft);

  const strobeRight = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), matStrobeWhite);
  strobeRight.position.set(9.05, 0.0, 0.3);
  jetGroup.add(strobeRight);

  airplane = {
    group: jetGroup,
    beaconTop,
    beaconBelly,
    strobeLeft,
    strobeRight,
    x: -30,
    y: 156,
    z: -750,
    speed: 21.0, // ~75 km/h model scale
    heading: 0.12 // slight southward-eastward heading matching Haneda RWY16 route
  };

  jetGroup.position.set(airplane.x, airplane.y, airplane.z);
  jetGroup.rotation.y = airplane.heading;
  skyGroup.add(jetGroup);

  scene.add(skyGroup);
  return skyGroup;
}

let skyElapsed = 0;

export function updateSkyAtmosphere(delta) {
  if (!skyGroup) return;
  const dt = Math.min(delta, 0.1);
  skyElapsed += dt;

  // 1. Drifting Clouds across diorama (Wind vector: vx = 1.35 m/s, vz = 0.65 m/s)
  const vx = 1.35 * dt;
  const vz = 0.65 * dt;

  for (let i = 0; i < cloudClusters.length; i += 1) {
    const c = cloudClusters[i];
    c.position.x += vx;
    c.position.z += vz;

    // Seamless wrap around boundary
    if (c.position.x > 420) {
      c.position.x = -420;
    }
    if (c.position.z > 780) {
      c.position.z = -780;
    }
  }

  // 2. Commercial Jet Cruise & Flight Corridor
  if (airplane) {
    airplane.z += Math.cos(airplane.heading) * airplane.speed * dt;
    airplane.x += Math.sin(airplane.heading) * airplane.speed * dt;

    // Loop flight corridor when leaving Tokyo airspace
    if (airplane.z > 850) {
      airplane.z = -850;
      airplane.x = -60 + Math.random() * 40;
    }

    airplane.group.position.x = airplane.x;
    airplane.group.position.y = airplane.y;
    airplane.group.position.z = airplane.z;

    // Anti-collision Red Beacon Flash (1.2 Hz pulse)
    const beaconCycle = (skyElapsed * 1.2) % 1.0;
    const isBeaconLit = beaconCycle < 0.22;
    airplane.beaconTop.visible = isBeaconLit;
    airplane.beaconBelly.visible = isBeaconLit;

    // Wingtip High-Intensity White Strobe Double Flash (every 1.4s)
    const strobeCycle = (skyElapsed / 1.4) % 1.0;
    const isStrobeLit = (strobeCycle > 0.0 && strobeCycle < 0.06) || (strobeCycle > 0.14 && strobeCycle < 0.20);
    airplane.strobeLeft.visible = isStrobeLit;
    airplane.strobeRight.visible = isStrobeLit;
  }
}

export function getAirplanePose() {
  if (!airplane) return null;
  return {
    id: "plane",
    type: "plane",
    name: "羽田便 旅客機 (Haneda Flight)",
    label: "ボーイング777 · 羽田進入路 156m",
    position: airplane.group.position,
    yaw: airplane.heading,
    speed: airplane.speed,
    height: 5.5
  };
}
