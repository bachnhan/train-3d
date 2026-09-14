// Procedural Animated Promenade Pedestrians & Joggers (渋谷川遊歩道・ランナー)
// Zero-dependency Three.js r125 kinematic characters with synchronized stride & bobbing.

const PROMENADE_WAYPOINTS = [
  { x: 42, y: 0.10, z: -430 },
  { x: 50, y: 0.10, z: -360 },
  { x: 61, y: 0.10, z: -290 },
  { x: 74, y: 0.10, z: -210 },
  { x: 86, y: 0.10, z: -140 },
  { x: 101, y: 0.10, z: -75 }
];

// Calculate cumulative distances along waypoints
const SEGMENT_LENGTHS = [];
let TOTAL_PATH_LENGTH = 0;
for (let i = 1; i < PROMENADE_WAYPOINTS.length; i += 1) {
  const p0 = PROMENADE_WAYPOINTS[i - 1];
  const p1 = PROMENADE_WAYPOINTS[i];
  const len = Math.hypot(p1.x - p0.x, p1.z - p0.z);
  SEGMENT_LENGTHS.push(len);
  TOTAL_PATH_LENGTH += len;
}

function getPointAtDistance(dist) {
  let remaining = Math.max(0, Math.min(TOTAL_PATH_LENGTH, dist));
  for (let i = 0; i < SEGMENT_LENGTHS.length; i += 1) {
    const segLen = SEGMENT_LENGTHS[i];
    if (remaining <= segLen || i === SEGMENT_LENGTHS.length - 1) {
      const t = segLen > 0 ? remaining / segLen : 0;
      const p0 = PROMENADE_WAYPOINTS[i];
      const p1 = PROMENADE_WAYPOINTS[i + 1];
      const dx = p1.x - p0.x;
      const dz = p1.z - p0.z;
      return {
        x: p0.x + dx * t,
        y: p0.y + (p1.y - p0.y) * t,
        z: p0.z + dz * t,
        yaw: Math.atan2(dx, dz)
      };
    }
    remaining -= segLen;
  }
  const last = PROMENADE_WAYPOINTS[PROMENADE_WAYPOINTS.length - 1];
  return { x: last.x, y: last.y, z: last.z, yaw: 0 };
}

let pedestrianGroup = null;
const animatedCharacters = [];

export function createAnimatedPromenadePedestrians(scene) {
  pedestrianGroup = new THREE.Group();
  pedestrianGroup.name = "Animated Promenade Pedestrians";

  // Reusable shared materials
  const matSkin = new THREE.MeshLambertMaterial({ color: 0xfed7aa });
  const matHairDark = new THREE.MeshLambertMaterial({ color: 0x0f172a });
  const matWhite = new THREE.MeshLambertMaterial({ color: 0xf8fafc });
  const matBlue = new THREE.MeshLambertMaterial({ color: 0x0284c7 });
  const matOrange = new THREE.MeshLambertMaterial({ color: 0xea580c });
  const matGreen = new THREE.MeshLambertMaterial({ color: 0x16a34a });
  const matNavy = new THREE.MeshLambertMaterial({ color: 0x1e293b });
  const matYellow = new THREE.MeshLambertMaterial({ color: 0xfacc15 });

  const charactersConfig = [
    {
      type: "jogger",
      shirtMat: matBlue,
      shortsMat: matNavy,
      shoeMat: matYellow,
      speed: 3.2,
      cadence: 2.8,
      startDist: 20,
      direction: 1
    },
    {
      type: "jogger",
      shirtMat: matOrange,
      shortsMat: matNavy,
      shoeMat: matGreen,
      speed: 2.9,
      cadence: 2.7,
      startDist: 220,
      direction: -1
    },
    {
      type: "walker",
      shirtMat: matWhite,
      shortsMat: matNavy,
      shoeMat: matHairDark,
      speed: 1.35,
      cadence: 1.8,
      startDist: 110,
      direction: 1
    },
    {
      type: "jogger",
      shirtMat: matGreen,
      shortsMat: matNavy,
      shoeMat: matWhite,
      speed: 3.0,
      cadence: 2.75,
      startDist: 310,
      direction: -1
    }
  ];

  charactersConfig.forEach((cfg, idx) => {
    const root = new THREE.Group();
    root.name = `Promenade character ${idx}`;

    const isJogger = cfg.type === "jogger";

    // Pelvis / Center of mass
    const torsoH = isJogger ? 0.46 : 0.50;
    const torsoGeom = new THREE.BoxGeometry(0.34, torsoH, 0.20);
    const torsoMesh = new THREE.Mesh(torsoGeom, cfg.shirtMat);
    torsoMesh.position.y = 1.08;
    root.add(torsoMesh);

    // Shorts / Pants
    const hipsGeom = new THREE.BoxGeometry(0.32, 0.14, 0.19);
    const hipsMesh = new THREE.Mesh(hipsGeom, cfg.shortsMat);
    hipsMesh.position.y = 0.80;
    root.add(hipsMesh);

    // Head
    const headGeom = new THREE.BoxGeometry(0.18, 0.20, 0.18);
    const headMesh = new THREE.Mesh(headGeom, matSkin);
    headMesh.position.y = 1.48;
    root.add(headMesh);

    // Hair / Cap
    const hairGeom = new THREE.BoxGeometry(0.20, 0.08, 0.20);
    const hairMesh = new THREE.Mesh(hairGeom, matHairDark);
    hairMesh.position.y = 1.57;
    root.add(hairMesh);

    if (isJogger) {
      // Sports visor
      const visorGeom = new THREE.BoxGeometry(0.21, 0.04, 0.12);
      const visorMesh = new THREE.Mesh(visorGeom, matWhite);
      visorMesh.position.set(0, 1.53, 0.10);
      root.add(visorMesh);
    }

    // Legs (Pivot at hip: Y = 0.78)
    const legLen = 0.68;
    const legW = 0.11;
    const legD = 0.12;

    // Left Leg Group
    const leftLegGroup = new THREE.Group();
    leftLegGroup.position.set(-0.10, 0.76, 0);
    const leftLegMesh = new THREE.Mesh(
      new THREE.BoxGeometry(legW, legLen, legD),
      isJogger ? matSkin : cfg.shortsMat
    );
    leftLegMesh.position.y = -legLen / 2;
    leftLegGroup.add(leftLegMesh);

    const leftShoe = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.09, 0.22), cfg.shoeMat);
    leftShoe.position.set(0, -legLen, 0.04);
    leftLegGroup.add(leftShoe);
    root.add(leftLegGroup);

    // Right Leg Group
    const rightLegGroup = new THREE.Group();
    rightLegGroup.position.set(0.10, 0.76, 0);
    const rightLegMesh = new THREE.Mesh(
      new THREE.BoxGeometry(legW, legLen, legD),
      isJogger ? matSkin : cfg.shortsMat
    );
    rightLegMesh.position.y = -legLen / 2;
    rightLegGroup.add(rightLegMesh);

    const rightShoe = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.09, 0.22), cfg.shoeMat);
    rightShoe.position.set(0, -legLen, 0.04);
    rightLegGroup.add(rightShoe);
    root.add(rightLegGroup);

    // Arms (Pivot at shoulder: Y = 1.25)
    const armLen = 0.46;
    const armW = 0.09;

    // Left Arm Group
    const leftArmGroup = new THREE.Group();
    leftArmGroup.position.set(-0.22, 1.24, 0);
    const leftArmMesh = new THREE.Mesh(
      new THREE.BoxGeometry(armW, armLen, armW),
      isJogger ? matSkin : cfg.shirtMat
    );
    leftArmMesh.position.y = -armLen / 2;
    leftArmGroup.add(leftArmMesh);
    root.add(leftArmGroup);

    // Right Arm Group
    const rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(0.22, 1.24, 0);
    const rightArmMesh = new THREE.Mesh(
      new THREE.BoxGeometry(armW, armLen, armW),
      isJogger ? matSkin : cfg.shirtMat
    );
    rightArmMesh.position.y = -armLen / 2;
    rightArmGroup.add(rightArmMesh);
    root.add(rightArmGroup);

    pedestrianGroup.add(root);

    animatedCharacters.push({
      root,
      leftLegGroup,
      rightLegGroup,
      leftArmGroup,
      rightArmGroup,
      torsoMesh,
      config: cfg,
      currentDist: cfg.startDist,
      direction: cfg.direction,
      phase: Math.random() * Math.PI * 2
    });
  });

  scene.add(pedestrianGroup);
  return pedestrianGroup;
}

export function updateAnimatedPedestrians(delta) {
  if (!animatedCharacters.length) return;
  const dt = Math.min(delta, 0.1);

  for (let i = 0; i < animatedCharacters.length; i += 1) {
    const char = animatedCharacters[i];
    const { config } = char;

    // Advance along path
    char.currentDist += char.direction * config.speed * dt;

    // Turn around at ends
    if (char.currentDist >= TOTAL_PATH_LENGTH) {
      char.currentDist = TOTAL_PATH_LENGTH;
      char.direction = -1;
    } else if (char.currentDist <= 0) {
      char.currentDist = 0;
      char.direction = 1;
    }

    // Evaluate pose on path
    const pose = getPointAtDistance(char.currentDist);
    const facingYaw = char.direction > 0 ? pose.yaw : pose.yaw + Math.PI;

    char.root.position.x = pose.x;
    char.root.position.z = pose.z;
    char.root.rotation.y = facingYaw;

    // Advance gait animation phase
    char.phase += dt * config.cadence * Math.PI * 2;

    const isJogger = config.type === "jogger";
    const swingAmp = isJogger ? 0.72 : 0.42; // arm/leg swing amplitude in radians
    const bobAmp = isJogger ? 0.05 : 0.025;  // vertical bounce

    // Vertical bounce
    char.root.position.y = pose.y + Math.abs(Math.sin(char.phase)) * bobAmp;

    // Torso forward lean for runners
    if (isJogger) {
      char.torsoMesh.rotation.x = 0.12;
    }

    // Leg swings (synchronized counter-phase)
    const legSwing = Math.sin(char.phase) * swingAmp;
    char.leftLegGroup.rotation.x = legSwing;
    char.rightLegGroup.rotation.x = -legSwing;

    // Arm swings (opposite to leg swings)
    const armSwing = isJogger ? 0.65 : 0.38;
    char.leftArmGroup.rotation.x = -legSwing * (armSwing / swingAmp);
    char.rightArmGroup.rotation.x = legSwing * (armSwing / swingAmp);
  }
}
