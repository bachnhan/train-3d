import { Builder, MATERIAL } from "./builder.js";
import { createUrbanGroundMaterial } from "./materials.js";
import {
  CATENARY_HEIGHT, LAND, PLATFORM_HEIGHT, TRACK_SEPARATION,
  routeCurve, stationPoints, stationU, trackCurves, yawAt
} from "./layout.js";
import {
  BUILDINGS, LANDMARK_IDS, MAP_METADATA, RAILWAY_CORRIDOR_HALF_WIDTH, RIVER_BRIDGES, ROAD_SEGMENTS, SHIBUYA_RIVER,
  distanceFootprintToRoads, distanceToRailway, distanceToRiver, distanceToRoad, isInCity,
  overlapsBuilding, portalPose
} from "./map-model.js";
import { pointToOrientedRectDistance } from "./clearance.mjs";
import {
  addDepartureBoard, addStationClock, addStationBoard, addTokyoSign
} from "./signage.js";
import {
  addRooftopEquipment, addStreetShopfront, addShibuyaRiverPromenadeDetails, addBuildingFacade,
  addPlateauBuildingDetail
} from "./architecture.js";
import { populateTokyoStreetlife } from "./streetlife.js";

const clearanceItems = [];
const cityFootprints = [];
const railInfrastructureRects = [];
let builderStats = null;

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function registerClearance(label, width, height, depth, x, y, z, yaw = 0) {
  clearanceItems.push({
    label, x, z, width, depth, yaw,
    minY: y - height / 2,
    maxY: y + height / 2
  });
}

// Anything applied to a wall or a roof is sunk well into the host box rather than laid
// flush against it. Two faces at the same depth flicker against each other once the
// camera pulls back far enough that the depth buffer can no longer separate them.
function addWindow(builder, x, y, z, width, height, lit = false) {
  builder.box(x, y, z - 0.1, width + 0.18, height + 0.18, 0.26, "#4c5155");
  builder.box(x, y, z - 0.03, width, height, 0.06,
    lit ? "#f6d991" : "#668392", lit ? MATERIAL.EMISSIVE : MATERIAL.GLASS);
  builder.box(x, y - height / 2 - 0.1, z + 0.02, width + 0.2, 0.12, 0.3, "#d9d5ca");
}

function addZakkyo(builder, label, x, z, width, depth, floors, color) {
  const floorHeight = 3.1;
  const height = floors * floorHeight;
  builder.beginAsset(label).push(x, 0, z);
  builder.box(0, 0.04, 0, width + 1.6, 0.08, depth + 1.6, "#9e988c");
  builder.box(0, height / 2, 0, width, height, depth, color);
  builder.box(0, height + 0.2, 0, width + 0.3, 1, depth + 0.3, "#bbb9b0");
  // One deeply layered street facade plus lightweight glazing on the other three faces
  // keeps every orientation readable without breaking the 800-triangle asset guard.
  const columns = 1;
  for (let floor = 0; floor < floors; floor += 1) {
    for (let column = 0; column < columns; column += 1) {
      const windowX = -width / 2 + width / columns * (column + 0.5);
      addWindow(builder, windowX, 1.65 + floor * floorHeight, depth / 2 + 0.08,
        width / columns * 0.58, 1.45, (floor + column) % 4 === 0);
    }
    builder.box(0, 1.65 + floor * floorHeight, -depth / 2 + 0.02,
      width * 0.55, 1.35, 0.16, "#668392", MATERIAL.GLASS);
    for (const side of [-1, 1]) {
      builder.box(side * (width / 2 - 0.02), 1.65 + floor * floorHeight, 0,
        0.16, 1.35, depth * 0.6, "#668392", MATERIAL.GLASS);
    }
    builder.box(0, floor * floorHeight + 0.18, depth / 2 + 0.05, width + 0.2, 0.18, 0.3, "#858b8d");
  }
  if (width > 8) {
    builder.box(width / 2 + 0.1, height * 0.55, 0, 0.4, height * 0.55, depth * 0.72, "#56636b", MATERIAL.METAL);
  }
  builder.box(-width * 0.28, height + 1.2, 0, 2.1, 1.7, 2.4, "#9b9b93");
  builder.box(width * 0.25, height + 0.75, 0, 1.5, 0.8, 2.1, "#737b80", MATERIAL.METAL);
  builder.pop().endAsset();
  registerClearance(label, width, height + 2.1, depth, x, (height + 2.1) / 2, z);
}

function addHouse(builder, label, x, z, yaw, width, depth, floors, color) {
  const height = floors * 2.8;
  builder.beginAsset(label).push(x, 0, z, 0, yaw);
  builder.box(0, 0.04, 0, width + 1.2, 0.08, depth + 1.2, "#8a857a");
  builder.box(0, height / 2, 0, width, height, depth, color);
  builder.box(0, height + 0.05, 0, width + 0.45, 0.62, depth + 0.45, "#46535a", MATERIAL.METAL);
  for (let floor = 0; floor < floors; floor += 1) {
    addWindow(builder, -width * 0.22, 1.5 + floor * 2.8, depth / 2 + 0.07, width * 0.27, 1.2, floor === 1);
    addWindow(builder, width * 0.22, 1.5 + floor * 2.8, depth / 2 + 0.07, width * 0.27, 1.2, false);
    builder.box(0, 1.5 + floor * 2.8, -depth / 2 + 0.02,
      width * 0.48, 1.05, 0.16, "#668392", MATERIAL.GLASS);
    for (const side of [-1, 1]) {
      builder.box(side * (width / 2 - 0.02), 1.5 + floor * 2.8, 0,
        0.16, 1.05, depth * 0.42, "#668392", MATERIAL.GLASS);
    }
  }
  if (floors > 1) {
    builder.box(0, 3.1, depth / 2 + 0.55, width * 0.82, 0.16, 1.45, "#9ca6aa", MATERIAL.METAL);
    for (let column = -2; column <= 2; column += 1) {
      builder.box(column * width * 0.17, 3.55, depth / 2 + 1.2, 0.06, 0.9, 0.06, "#68767c", MATERIAL.METAL);
    }
    builder.wire([-width * 0.3, 3.65, depth / 2 + 1.23], [width * 0.3, 3.65, depth / 2 + 1.23], 0.025, "#e5e0d7");
  }
  builder.box(-width * 0.35, 0.65, depth / 2 + 0.05, 1.15, 1.3, 0.3, "#55453b");
  builder.pop().endAsset();
  registerClearance(label, width, height + 0.36, depth + 1.3, x, (height + 0.36) / 2, z, yaw);
}

function addDaikanyamaAddress(builder, building) {
  const xs = building.polygon.map((p) => p[0]);
  const zs = building.polygon.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  const width = Math.max(...xs) - Math.min(...xs);
  const depth = Math.max(...zs) - Math.min(...zs);
  const label = "Daikanyama Address Tower";
  cityFootprints.push({ x: cx, z: cz, width, depth, polygon: building.polygon });

  builder.beginAsset(label).push(cx, 0, cz);
  // 1. Boutique shopping podium
  builder.prism(building.polygon.map((p) => [p[0] - cx, p[1] - cz]), 14, "#dcd7cb");
  // 2. Main 36-storey residential tower body
  const towerWidth = width * 0.74;
  const towerDepth = depth * 0.74;
  const towerHeight = 112;
  builder.box(0, towerHeight / 2, 0, towerWidth, towerHeight, towerDepth, "#e8e5dc");
  // Balcony shadow bands and glass window vertical stripes
  for (let floor = 5; floor <= 34; floor += 3) {
    const y = floor * 3.1;
    builder.box(0, y, 0, towerWidth + 0.6, 0.35, towerDepth + 0.6, "#7c8588");
    builder.box(0, y + 1.2, 0, towerWidth + 0.25, 1.4, towerDepth * 0.72, "#587280", MATERIAL.GLASS);
  }
  // 3. Stepped penthouse and crown frame
  builder.box(0, towerHeight + 3, 0, towerWidth * 0.75, 6, towerDepth * 0.75, "#c2beb2");
  builder.box(0, towerHeight + 7.5, 0, towerWidth * 0.5, 3, towerDepth * 0.5, "#4d565b", MATERIAL.METAL);
  builder.beam([0, towerHeight + 9, 0], [0, towerHeight + 14, 0], 0.35, "#929ba0", MATERIAL.METAL);
  builder.pop().endAsset();
  registerClearance(label, width, towerHeight + 14, depth, cx, (towerHeight + 14) / 2, cz);
}

function addCeruleanTower(builder, building) {
  const xs = building.polygon.map((p) => p[0]);
  const zs = building.polygon.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  const width = Math.max(...xs) - Math.min(...xs);
  const depth = Math.max(...zs) - Math.min(...zs);
  const label = "Cerulean Tower";
  cityFootprints.push({ x: cx, z: cz, width, depth, polygon: building.polygon });

  builder.beginAsset(label).push(cx, 0, cz);
  // Base podium
  builder.prism(building.polygon.map((p) => [p[0] - cx, p[1] - cz]), 16, "#aba498");
  // Tower body with curved blue-grey glass curtain wall
  const towerWidth = width * 0.78;
  const towerDepth = depth * 0.78;
  const towerHeight = 92;
  builder.box(0, towerHeight / 2, 0, towerWidth, towerHeight, towerDepth, "#425664", MATERIAL.GLASS);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      builder.box(sx * (towerWidth / 2 - 0.6), towerHeight / 2, sz * (towerDepth / 2 - 0.6),
        3, towerHeight + 1.2, 3, "#b5afa4");
    }
  }
  // Floor bands
  for (let y = 20; y < towerHeight; y += 7.2) {
    builder.box(0, y, 0, towerWidth + 0.3, 0.45, towerDepth + 0.3, "#7f8b91", MATERIAL.METAL);
  }
  // Rooftop mechanical crown & helipad
  builder.box(0, towerHeight + 2.5, 0, towerWidth * 0.65, 5, towerDepth * 0.65, "#3b4347", MATERIAL.METAL);
  builder.cylinder(0, towerHeight + 5.5, 0, 7.5, 7.5, 0.6, "#e8e5dc", MATERIAL.MATTE, 12);
  builder.pop().endAsset();
  registerClearance(label, width, towerHeight + 6, depth, cx, (towerHeight + 6) / 2, cz);
}

function addShibuyaScrambleSquare(builder, building) {
  const xs = building.polygon.map((p) => p[0]);
  const zs = building.polygon.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  const width = Math.max(...xs) - Math.min(...xs);
  const depth = Math.max(...zs) - Math.min(...zs);
  const label = "Shibuya Scramble Square";
  cityFootprints.push({ x: cx, z: cz, width, depth, polygon: building.polygon });

  builder.beginAsset(label).push(cx, 0, cz);
  const height = 155;
  builder.prism(building.polygon.map((p) => [p[0] - cx, p[1] - cz]), height, "#374c59", MATERIAL.GLASS);
  builder.box(0, height / 2, 0, width * 0.85, height, depth * 0.85, "#49606e", MATERIAL.GLASS);
  for (let y = 18; y < height; y += 14) {
    builder.box(0, y, 0, width * 0.88, 0.6, depth * 0.88, "#8b9aa1", MATERIAL.METAL);
  }
  builder.box(0, height + 1.2, 0, width * 0.8, 2.4, depth * 0.8, "#252e33", MATERIAL.METAL);
  builder.box(0, height + 3.0, 0, width * 0.74, 1.2, depth * 0.74, "#7a9cb0", MATERIAL.GLASS);
  builder.pop().endAsset();
  registerClearance(label, width, height + 4, depth, cx, (height + 4) / 2, cz);
}

function addCity(builder) {
  const shibuyaColors = ["#9c968a", "#7d8a92", "#a8977f", "#6f7a7c", "#b0a08e", "#8b8377"];
  const houseColors = ["#cfc7b8", "#b3bab4", "#c2ab92", "#a9a69c", "#93a2a4", "#c8b8a4"];
  BUILDINGS.forEach((building, index) => {
    if (building.id === LANDMARK_IDS.ADDRESS_TOWER) {
      addDaikanyamaAddress(builder, building);
      return;
    }
    if (building.id === LANDMARK_IDS.CERULEAN_TOWER) {
      addCeruleanTower(builder, building);
      return;
    }
    if (building.id === LANDMARK_IDS.SHIBUYA_SCRAMBLE) {
      addShibuyaScrambleSquare(builder, building);
      return;
    }

    const xs = building.polygon.map((point) => point[0]);
    const zs = building.polygon.map((point) => point[1]);
    const x = (Math.min(...xs) + Math.max(...xs)) / 2;
    const z = (Math.min(...zs) + Math.max(...zs)) / 2;
    const width = Math.max(3, Math.max(...xs) - Math.min(...xs));
    const depth = Math.max(3, Math.max(...zs) - Math.min(...zs));
    if (width > 90 || depth > 90) return;
    cityFootprints.push({ x, z, width, depth, polygon: building.polygon });
    const label = `PLATEAU ${building.id}`;
    const floors = Math.max(2, Math.min(18, building.storeys > 0 && building.storeys < 40
      ? building.storeys
      : Math.round(building.height / 3.1)));
    const height = (building.station === "daikanyama" && building.height < 17
      ? Math.min(3, floors) * 2.8
      : floors * 3.1);
    const color = building.station === "daikanyama" && building.height < 17
      ? houseColors[index % houseColors.length]
      : shibuyaColors[index % shibuyaColors.length];
    builder.beginAsset(label);
    builder.prism(building.polygon, height, color);
    builder.box(x, height + 0.18, z, Math.min(width * 0.35, 5), 0.7,
      Math.min(depth * 0.35, 5), "#4f5350", MATERIAL.METAL);
    addRooftopEquipment(builder, x, height, z, width, depth, index);
    if (building.railwayDistance < 45 || (building.railwayDistance < 72 && index % 2 === 0)) {
      addPlateauBuildingDetail(builder, x, z, width, depth, height, floors, index);
    }
    builder.endAsset();
    registerClearance(label, width, height + 4.5, depth, x, (height + 4.5) / 2, z);
  });
}

function getBuildingCorners(x, z, width, depth, yaw) {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const hw = width / 2;
  const hd = depth / 2;
  return [
    [x + cos * hw - sin * hd, z + sin * hw + cos * hd],
    [x - cos * hw - sin * hd, z - sin * hw + cos * hd],
    [x - cos * hw + sin * hd, z - sin * hw - cos * hd],
    [x + cos * hw + sin * hd, z + sin * hw - cos * hd]
  ];
}

function buildingCollidesWithEnvironment(x, z, width, depth, yaw, trackSamples) {
  const rect = { x, z, width: width + 1.0, depth: depth + 1.0, yaw };
  for (const p of trackSamples) {
    if (pointToOrientedRectDistance(p, rect) < 4.5) return true;
  }
  const corners = getBuildingCorners(x, z, width, depth, yaw);
  if (distanceFootprintToRoads(corners) < 0.5) return true;
  for (const [cx, cz] of corners) {
    if (distanceToRiver(cx, cz) < 8.0) return true;
    if (distanceToRailway(cx, cz) < 10.0) return true;
  }
  if (overlapsBuilding(x, z, width / 2, depth / 2, 1.2)) return true;
  if (cityFootprints.some((f) => Math.hypot(f.x - x, f.z - z) < Math.hypot(width, depth) / 2 + Math.hypot(f.width, f.depth) / 2 + 1.5)) return true;
  return false;
}

function addCityFabric(builder) {
  const walls = ["#ded8cb", "#c2baa8", "#9da3a6", "#baa690", "#8b9194", "#b5aaa0"];
  const roofs = ["#383b3d", "#4b4843", "#2c3033", "#504e49"];
  const trackSamples = Array.from({ length: 400 }, (_, i) => routeCurve.getPointAt(i / 399));
  const candidates = [];

  // 1. Street frontage buildings along all surveyed carriageways
  for (const road of ROAD_SEGMENTS) {
    const dx = road.b[0] - road.a[0];
    const dz = road.b[1] - road.a[1];
    const length = Math.hypot(dx, dz);
    if (length < 9) continue;
    const stepDist = 11;
    const steps = Math.floor(length / stepDist);
    const nx = -dz / length;
    const nz = dx / length;
    const yaw = Math.atan2(dx, dz);
    for (let step = 0; step < steps; step += 1) {
      const t = (step + 0.5) / steps;
      const cx = road.a[0] + dx * t;
      const cz = road.a[1] + dz * t;
      for (const side of [-1, 1]) {
        const width = 8.0;
        const depth = 9.0;
        const setback = road.width / 2 + 1.8 + depth / 2;
        const x = cx + nx * setback * side;
        const z = cz + nz * setback * side;
        const facingYaw = Math.atan2(-nx * side, -nz * side);
        if (!isInCity(x, z, depth / 2)) continue;
        if (buildingCollidesWithEnvironment(x, z, width, depth, facingYaw, trackSamples)) continue;
        const floors = 2 + ((candidates.length * 3) % 4);
        const corners = getBuildingCorners(x, z, width, depth, facingYaw);
        candidates.push({ x, z, width, depth, yaw: facingYaw, floors, isFrontage: true });
        cityFootprints.push({ x, z, width, depth, yaw: facingYaw, polygon: corners, fabric: true });
      }
    }
  }

  // 2. Interior block infill filling deep residential parcels between roads (widened step 32m to avoid repetition)
  const margin = 45;
  for (let x = -LAND.halfX + margin; x <= LAND.halfX - margin; x += 36) {
    for (let z = LAND.minZ + margin; z <= LAND.maxZ - margin; z += 36) {
      if (!isInCity(x, z, 5)) continue;
      const width = 8.0;
      const depth = 8.5;
      if (buildingCollidesWithEnvironment(x, z, width, depth, 0, trackSamples)) continue;
      const floors = 2 + ((candidates.length * 7) % 3);
      const corners = getBuildingCorners(x, z, width, depth, 0);
      candidates.push({ x, z, width, depth, yaw: 0, floors, isFrontage: false });
      cityFootprints.push({ x, z, width, depth, yaw: 0, polygon: corners, fabric: true });
    }
  }

  // 3. Batch into individual building assets <= 450 triangles each
  const BATCH_SIZE = 1;
  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);
    builder.beginAsset(`city fabric batch ${Math.floor(i / BATCH_SIZE)}`);
    batch.forEach((b, idx) => {
      const height = b.floors * 3.0;
      const label = `city block ${i + idx}`;
      builder.push(b.x, 0, b.z, 0, b.yaw);
      // Foundation apron
      builder.box(0, 0.03, 0, b.width + 0.8, 0.06, b.depth + 0.8, "#6a6760");
      // Main wall body
      builder.box(0, height / 2, 0, b.width, height, b.depth, walls[(i + idx) % walls.length]);
      // Roof cap / parapet
      builder.box(0, height + 0.15, 0, b.width + 0.3, 0.3, b.depth + 0.3, roofs[(i + idx) % roofs.length]);
      // Rooftop equipment (water tank / HVAC / elevator penthouse)
      addRooftopEquipment(builder, 0, height + 0.15, 0, b.width, b.depth, i + idx);
      // Streetfront shops on street-facing fabric buildings (~20% of buildings)
      const hasShop = b.isFrontage && ((i + idx) % 5 === 0);
      if (hasShop) {
        const shopLabels = ["CAFE", "BOOKS", "MARKET", "BAKERY", "RAMEN", "FLOWER", "KOBAN"];
        const shopColors = ["#b91c1c", "#15803d", "#1d4ed8", "#d97706", "#7c3aed", "#0284c7"];
        const sLabel = shopLabels[(i + idx) % shopLabels.length];
        const sColor = shopColors[(i + idx) % shopColors.length];
        addStreetShopfront(builder, 0, 0, 0, b.width, b.depth, 0, sLabel, sColor);
      }
      // Facade fenestration on street frontage buildings (windows, sills, balconies across 4 archetypes)
      if (b.isFrontage) {
        addBuildingFacade(builder, b.width, b.depth, height, b.floors, i + idx, hasShop);
      }
      builder.pop();
      registerClearance(label, b.width + 0.8, height + 4.5, b.depth + 0.8, b.x, (height + 4.5) / 2, b.z, b.yaw);
    });
    builder.endAsset();
  }
}

function addGroundAndRoads(builder) {
  builder.beginAsset("tabletop");
  // Architectural diorama plinth and slate ground
  builder.box(0, -2.35, 0, LAND.halfX * 2 + 16, 4.2, LAND.maxZ - LAND.minZ + 16, "#4a4740");
  builder.box(0, -2.1, 0, LAND.halfX * 2, 4, LAND.maxZ - LAND.minZ, "#636058");
  builder.endAsset();

  const BATCH_SIZE = 2;
  for (let i = 0; i < ROAD_SEGMENTS.length; i += BATCH_SIZE) {
    builder.beginAsset(`roads ${Math.floor(i / BATCH_SIZE)}`);
    const batch = ROAD_SEGMENTS.slice(i, i + BATCH_SIZE);
    for (const road of batch) {
      if (road.isBridge) continue;
      const dx = road.b[0] - road.a[0];
      const dz = road.b[1] - road.a[1];
      const length = Math.hypot(dx, dz) + 0.4;
      const major = ["motorway", "trunk", "primary", "secondary"].includes(road.highway);
      builder.push((road.a[0] + road.b[0]) / 2, 0, (road.a[1] + road.b[1]) / 2,
        0, Math.atan2(dx, dz));

      // 1. Authentic dark black/charcoal asphalt carriageway
      builder.box(0, -0.17, 0, road.width, 0.44, length, major ? "#222628" : "#2e3336", MATERIAL.MATTE);

      if (major && road.width >= 7.5) {
        // Wide commercial arterial: White centerline divider and flanking sidewalks
        builder.box(0, 0.052, 0, 0.20, 0.01, length, "#f8fafc", MATERIAL.MATTE);

        // Flanking sidewalks on left and right (never covering the asphalt)
        builder.box(-road.width / 2 - 0.7, -0.18, 0, 1.4, 0.44, length, "#beb8ac", MATERIAL.MATTE);
        builder.box(road.width / 2 + 0.7, -0.18, 0, 1.4, 0.44, length, "#beb8ac", MATERIAL.MATTE);

        // Dark granite curbs between asphalt and sidewalks
        builder.box(-road.width / 2 - 0.06, -0.175, 0, 0.12, 0.44, length, "#5d5952", MATERIAL.MATTE);
        builder.box(road.width / 2 + 0.06, -0.175, 0, 0.12, 0.44, length, "#5d5952", MATERIAL.MATTE);

        // Authentic Japanese Pedestrian Crosswalks (横断歩道) and Guard Pipes (ガードパイプ) near intersections
        if (length >= 20) {
          const crossZ = length / 2 - 3.2;
          const numBars = Math.floor((road.width - 1.4) / 0.85);
          for (let b = 0; b < numBars; b++) {
            const bx = -road.width / 2 + 0.95 + b * 0.85;
            builder.box(bx, 0.054, crossZ, 0.42, 0.008, 3.4, "#f8fafc", MATERIAL.MATTE);
          }
          // Stop line (止まれ停止線) in front of crossing
          builder.box(road.width * 0.22, 0.054, crossZ - 2.2, road.width * 0.42, 0.008, 0.35, "#f8fafc", MATERIAL.MATTE);

          // White curbside guard pipes (ガードパイプ) along sidewalk edge
          for (const s of [-1, 1]) {
            const gx = s * (road.width / 2 + 0.14);
            builder.box(gx, 0.45, crossZ, 0.04, 0.04, 4.0, "#f8fafc", MATERIAL.METAL);
            builder.box(gx, 0.75, crossZ, 0.04, 0.04, 4.0, "#f8fafc", MATERIAL.METAL);
            for (const pz of [-1.8, 0, 1.8]) {
              builder.cylinder(gx, 0.42, crossZ + pz, 0.035, 0.035, 0.84, "#f8fafc", MATERIAL.METAL, 6);
            }
          }
        }
      } else if (road.width >= 4.0) {
        // Standard Tokyo residential street: White road-edge lines (路側帯) painted on dark asphalt
        builder.box(-road.width / 2 + 0.30, 0.052, 0, 0.12, 0.01, length, "#f1f5f9", MATERIAL.MATTE);
        builder.box(road.width / 2 - 0.30, 0.052, 0, 0.12, 0.01, length, "#f1f5f9", MATERIAL.MATTE);
      }

      builder.pop();
    }
    builder.endAsset();
  }
}

function addUrbanInfill(builder) {
  // Elevated Railway Corridor Ballast & Maintenance Strip along running line curve
  const ballastSamples = Array.from({ length: 48 }, (_, i) => {
    const u = 0.05 + (i / 47) * 0.90;
    const p = routeCurve.getPointAt(u);
    const t = routeCurve.getTangentAt(u);
    return { p, yaw: Math.atan2(t.x, t.z) };
  });
  const BALLAST_BATCH = 24;
  for (let i = 0; i < ballastSamples.length; i += BALLAST_BATCH) {
    builder.beginAsset(`viaduct ballast ${Math.floor(i / BALLAST_BATCH)}`);
    const batch = ballastSamples.slice(i, i + BALLAST_BATCH);
    batch.forEach(({ p, yaw }) => {
      // Prevent ground railway ballast from slicing through ground-level roads or canal waters under viaduct
      if (distanceToRoad(p.x, p.z) < 7.5 || distanceToRiver(p.x, p.z) < 7.0) {
        return;
      }
      builder.push(p.x, 0, p.z, 0, yaw);
      // Dark crushed gravel ballast bed under viaduct
      builder.box(0, 0.02, 0, 7.6, 0.04, 22.0, "#44413b");
      // Concrete maintenance walkway strip
      builder.box(3.2, 0.03, 0, 0.9, 0.06, 22.0, "#5a564e");
      builder.pop();
    });
    builder.endAsset();
  }
}

function getRailingIntervals(segLen, bridgesInSegment) {
  const minZ = -segLen / 2;
  const maxZ = segLen / 2;
  const forbidden = bridgesInSegment
    .map((b) => ({
      start: b.localZ - b.width / 2 - 0.4,
      end: b.localZ + b.width / 2 + 0.4
    }))
    .filter((f) => f.end > minZ && f.start < maxZ)
    .sort((a, b) => a.start - b.start);

  const allowed = [];
  let curr = minZ;
  for (const f of forbidden) {
    const fStart = Math.max(minZ, f.start);
    const fEnd = Math.min(maxZ, f.end);
    if (fStart - curr > 0.8) {
      allowed.push({ start: curr, end: fStart });
    }
    curr = Math.max(curr, fEnd);
  }
  if (maxZ - curr > 0.8) {
    allowed.push({ start: curr, end: maxZ });
  }
  return allowed;
}

function addShibuyaRiver(builder) {
  // 1. North Terminus — Shibuya Underground Culvert Portal (暗渠坑口)
  const pNorth0 = SHIBUYA_RIVER[0];
  const pNorth1 = SHIBUYA_RIVER[1];
  const northDx = pNorth1[0] - pNorth0[0];
  const northDz = pNorth1[1] - pNorth0[1];
  const northYaw = Math.atan2(northDx, northDz);

  builder.beginAsset("Shibuya river culvert portal");
  builder.push(pNorth0[0], 0, pNorth0[1], 0, northYaw);

  // Main concrete headwall (spanning across canal, embedded into ground)
  builder.box(0, -0.05, -1.6, 17.6, 1.4, 3.2, "#525759");
  // Stepped headwall top coping
  builder.box(0, 0.65, -1.0, 18.0, 0.2, 4.0, "#6c7275");
  // Upper ground-level paved service apron behind the portal headwall
  builder.box(0, 0.04, -8.0, 20.0, 0.08, 10.0, "#827d73");

  // Twin recessed underground storm conduit tunnel mouths (intakes)
  for (const side of [-1, 1]) {
    const intakeX = side * 3.6;
    // Dark recessed cavity opening
    builder.box(intakeX, -0.05, -0.1, 4.8, 1.05, 1.4, "#101314");
    // Deep dark interior recess void
    builder.box(intakeX, -0.05, -1.0, 4.6, 0.95, 0.8, "#070809");
    // Concrete intake frame lintel (architrave)
    builder.box(intakeX, 0.52, 0.3, 5.2, 0.22, 0.6, "#757c80");
    // Metal debris/trash rack safety screen (vertical bars)
    for (let bar = -2; bar <= 2; bar += 1) {
      builder.box(intakeX + bar * 0.95, 0.0, 0.4, 0.08, 0.9, 0.08, "#252b2e", MATERIAL.METAL);
    }
  }

  // Central dividing pier separating the twin conduits
  builder.box(0, -0.05, 0.2, 1.4, 1.15, 1.8, "#525759");
  builder.box(0, 0.55, 0.4, 1.6, 0.22, 1.4, "#6c7275");

  // Wing retaining walls flaring into the banks
  for (const side of [-1, 1]) {
    builder.box(side * 8.6, -0.05, 0.8, 1.6, 1.4, 3.0, "#5a6063");
    builder.box(side * 7.5, 0.66, -0.6, 0.25, 0.6, 3.8, "#3e4548", MATERIAL.METAL);
  }
  // Parapet safety railing along the top edge of the headwall
  builder.box(0, 1.0, -0.1, 17.6, 0.55, 0.16, "#3e4548", MATERIAL.METAL);

  builder.pop();
  builder.endAsset();

  // 2. Continuous open-air canal segments
  for (let i = 1; i < SHIBUYA_RIVER.length; i += 1) {
    builder.beginAsset(`Shibuya river segment ${i}`);
    const p0 = SHIBUYA_RIVER[i - 1];
    const p1 = SHIBUYA_RIVER[i];
    const dx = p1[0] - p0[0];
    const dz = p1[1] - p0[1];
    const len = Math.hypot(dx, dz) + 0.8;
    const yaw = Math.atan2(dx, dz);
    const cx = (p0[0] + p1[0]) / 2;
    const cz = (p0[1] + p1[1]) / 2;
    const ux = dx / (len - 0.8 || 1);
    const uz = dz / (len - 0.8 || 1);

    const bridgesInSegment = RIVER_BRIDGES.filter((b) => {
      const s = (b.cx - cx) * ux + (b.cz - cz) * uz;
      const perp = Math.abs(-(b.cx - cx) * uz + (b.cz - cz) * ux);
      return perp < 4.0 && Math.abs(s) <= len / 2 + 2.0;
    }).map((b) => {
      const s = (b.cx - cx) * ux + (b.cz - cz) * uz;
      return { localZ: s, width: b.width };
    });

    builder.push(cx, 0, cz, 0, yaw);
    // Recessed concrete canal floor
    builder.box(0, -0.65, 0, 14.4, 0.4, len, "#464b4b");
    for (const side of [-1, 1]) {
      // Stepped retaining wall
      builder.box(side * 6.2, -0.22, 0, 0.8, 0.65, len, "#7c807a");
      // Upper quay promenade / footpath
      builder.box(side * 6.8, 0.02, 0, 0.8, 0.16, len, "#a8a599");
      // Safety railing with clean openings at bridge crossings
      const railingIntervals = getRailingIntervals(len, bridgesInSegment);
      for (const interval of railingIntervals) {
        const spanLen = interval.end - interval.start;
        const midZ = (interval.start + interval.end) / 2;
        builder.box(side * 7.15, 0.32, midZ, 0.18, 0.45, spanLen, "#424a4c", MATERIAL.METAL);
      }
    }
    builder.pop();
    builder.endAsset();
  }

  // 3. South Terminus — Board edge framing pilasters
  const pSouthLast = SHIBUYA_RIVER[SHIBUYA_RIVER.length - 1];
  const pSouthPrev = SHIBUYA_RIVER[SHIBUYA_RIVER.length - 2];
  const southYaw = Math.atan2(pSouthLast[0] - pSouthPrev[0], pSouthLast[1] - pSouthPrev[1]);

  builder.beginAsset("Shibuya river south terminus");
  builder.push(pSouthLast[0], 0, pSouthLast[1], 0, southYaw);
  for (const side of [-1, 1]) {
    // End terminal pylons flanking the diorama cut
    builder.box(side * 6.8, 0.2, 0, 1.2, 0.8, 1.4, "#5a6063");
    builder.box(side * 6.8, 0.62, 0, 1.4, 0.14, 1.6, "#72797d");
    builder.box(side * 6.2, -0.22, 0, 0.82, 0.65, 0.6, "#7c807a");
  }
  builder.pop();
  builder.endAsset();

  // Road bridges spanning across the river canal with U-line arch clearance (太鼓橋・アーチ桁橋)
  const ARCH_SLICES = 10;
  const ARCH_RISE = 1.15; // Natural camber crown height above street level, creating safe canal boat clearance

  RIVER_BRIDGES.forEach((bridge, idx) => {
    builder.beginAsset(`Shibuya river bridge ${idx}`);
    builder.push(bridge.cx, 0, bridge.cz, 0, bridge.yaw);

    const halfSpan = bridge.span / 2;
    const sliceLen = bridge.span / ARCH_SLICES;

    // 1. Segmented Cambered Deck Slab with Arched Underside ("U line" clearance)
    for (let s = 0; s < ARCH_SLICES; s += 1) {
      const zMid = -halfSpan + (s + 0.5) * sliceLen;
      const u = zMid / halfSpan;
      const yCrown = 0.08 + ARCH_RISE * (1 - u * u);

      // Main structural asphalt deck slab
      builder.box(0, yCrown, zMid, bridge.width, 0.28, sliceLen + 0.04, "#2a2f32");

      // White road centerline marking
      if (bridge.width >= 7.5) {
        builder.box(0, yCrown + 0.145, zMid, 0.20, 0.01, sliceLen + 0.04, "#edebe4");
      }

      // Curbs, sidewalks, and parapet railings along both edges
      for (const side of [-1, 1]) {
        const curbX = side * (bridge.width / 2 - 0.45);
        builder.box(curbX, yCrown + 0.06, zMid, 0.75, 0.16, sliceLen + 0.04, "#dedad2");

        const railX = side * (bridge.width / 2 + 0.08);
        builder.box(railX, yCrown + 0.44, zMid, 0.14, 0.64, sliceLen + 0.04, "#758085", MATERIAL.METAL);

        // Outer fascia arch rib girder under railing (U-line profile)
        const fasciaX = side * (bridge.width / 2 + 0.04);
        builder.box(fasciaX, yCrown - 0.12, zMid, 0.22, 0.26, sliceLen + 0.04, "#475569", MATERIAL.METAL);

        // Structural steel arch rib on underside
        builder.box(side * (bridge.width / 2 - 0.15), yCrown - 0.22, zMid, 0.30, 0.18, sliceLen + 0.04, "#334155", MATERIAL.METAL);
      }
    }

    // 2. Concrete Abutments on canal banks
    for (const end of [-1, 1]) {
      const zOffset = end * (halfSpan - 0.8);
      builder.box(0, -0.32, zOffset, bridge.width + 0.6, 0.76, 2.2, "#656a6d");
      builder.box(0, 0.04, zOffset, bridge.width + 0.8, 0.18, 2.4, "#7a8286");
    }

    // 3. Authentic Japanese Stone Bridge Newel Pillars (親柱) with Capstones
    for (const side of [-1, 1]) {
      for (const end of [-1, 1]) {
        const xCorner = side * (bridge.width / 2 + 0.15);
        const zCorner = end * (halfSpan - 0.38);
        const u = zCorner / halfSpan;
        const yBank = 0.08 + ARCH_RISE * (1 - u * u);

        // Pillar column
        builder.box(xCorner, yBank + 0.44, zCorner, 0.52, 0.84, 0.52, "#bfb9ae");
        // Pyramidal stone cap
        builder.box(xCorner, yBank + 0.88, zCorner, 0.60, 0.12, 0.60, "#d5cfc0");
        // Bronze nameplate plaque
        builder.box(xCorner - side * 0.27, yBank + 0.44, zCorner, 0.04, 0.34, 0.26, "#4a3c2c", MATERIAL.METAL);
      }
    }

    builder.pop();
    builder.endAsset();
  });
}

const VIADUCT = { start: 0.1, end: 0.64, spans: 60 };

// Enhanced Japanese Elevated Viaduct with cable troughs, maintenance refuges, and acoustic noise barriers
function addViaduct(builder) {
  const SPANS_PER_BATCH = 5;
  for (let batch = 0; batch < Math.ceil(VIADUCT.spans / SPANS_PER_BATCH); batch += 1) {
    builder.beginAsset(`viaduct spans ${batch}`);
    const startIdx = batch * SPANS_PER_BATCH;
    const endIdx = Math.min(VIADUCT.spans, startIdx + SPANS_PER_BATCH);

    for (let index = startIdx; index < endIdx; index += 1) {
      const reach = VIADUCT.end - VIADUCT.start;
      const a = routeCurve.getPointAt(VIADUCT.start + reach * index / VIADUCT.spans);
      const c = routeCurve.getPointAt(VIADUCT.start + reach * (index + 1) / VIADUCT.spans);
      const dy = c.y - a.y;
      const flat = Math.hypot(c.x - a.x, c.z - a.z);
      const length = Math.hypot(flat, dy) + 0.3;
      const yaw = Math.atan2(c.x - a.x, c.z - a.z);
      const pitch = -Math.atan2(dy, flat);
      const uSpan = VIADUCT.start + reach * (index + 0.5) / VIADUCT.spans;

      builder.push((a.x + c.x) / 2, (a.y + c.y) / 2, (a.z + c.z) / 2, pitch, yaw);
      // Main concrete viaduct slab deck
      builder.box(0, -0.55, 0, 10.5, 1.1, length, "#777c7d", MATERIAL.METAL);
      // Longitudinal steel support girders under track centers
      builder.box(-4.7, -1.45, 0, 0.35, 1.8, length, "#596267", MATERIAL.METAL);
      builder.box(4.7, -1.45, 0, 0.35, 1.8, length, "#596267", MATERIAL.METAL);

      // Flanking parapet concrete walls
      for (const side of [-1, 1]) {
        builder.box(side * 4.9, 0.35, 0, 0.4, 1.5, length, "#8a8f8c");
        // Concrete coping cap along top edge of parapet
        builder.box(side * 4.9, 1.12, 0, 0.48, 0.12, length, "#9da39f", MATERIAL.MATTE);
        // Continuous electrical & signalling cable trough (ケーブルトラフ) along exterior wall
        builder.box(side * 5.22, 0.38, 0, 0.24, 0.28, length, "#5b6369", MATERIAL.METAL);
        // Steel bracket supports under cable trough
        builder.box(side * 5.22, 0.15, 0, 0.28, 0.14, 0.22, "#41494e", MATERIAL.METAL);
      }

      // Green steel truss bridge span across Meiji-dori arterial road
      if (uSpan >= 0.315 && uSpan <= 0.365) {
        for (const side of [-1, 1]) {
          builder.box(side * 5.1, 1.4, 0, 0.38, 2.2, length, "#234434", MATERIAL.METAL);
          builder.beam([side * 5.1, 0.4, -length / 2], [side * 5.1, 2.4, length / 2], 0.08, "#2d5642", MATERIAL.METAL);
          builder.beam([side * 5.1, 2.4, -length / 2], [side * 5.1, 0.4, length / 2], 0.08, "#2d5642", MATERIAL.METAL);
        }
      }

      // Japanese acoustic noise barrier walls (防音壁) approaching Daikanyama residential corridor
      if (uSpan >= 0.46 && uSpan <= 0.63) {
        for (const side of [-1, 1]) {
          // Lower ribbed acoustic barrier concrete panel
          builder.box(side * 5.0, 1.62, 0, 0.26, 1.1, length, "#78716c", MATERIAL.MATTE);
          // Upper transparent acoustic acrylic panels
          builder.box(side * 5.0, 2.75, 0, 0.10, 1.2, length, "#38bdf8", MATERIAL.GLASS);
          // Steel H-beam uprights
          builder.box(side * 5.0, 2.2, 0, 0.30, 2.3, 0.18, "#475569", MATERIAL.METAL);
        }
      }

      // Track worker inspection / refuge platforms (待避所) every 6 spans
      if (index % 6 === 2) {
        const refugeSide = (index % 12 === 2) ? 1 : -1;
        // Cantilevered steel grid floor platform
        builder.box(refugeSide * 5.85, -0.12, 0, 1.1, 0.10, 2.2, "#475569", MATERIAL.METAL);
        // Under-platform diagonal steel bracket
        builder.beam([refugeSide * 4.9, -0.75, 0], [refugeSide * 6.3, -0.12, 0], 0.08, "#334155", MATERIAL.METAL);
        // Safety handrails along 3 outer edges
        builder.box(refugeSide * 6.36, 0.42, 0, 0.06, 0.95, 2.2, "#cbd5e1", MATERIAL.METAL);
        builder.box(refugeSide * 5.85, 0.42, -1.06, 1.08, 0.95, 0.06, "#cbd5e1", MATERIAL.METAL);
        builder.box(refugeSide * 5.85, 0.42, 1.06, 1.08, 0.95, 0.06, "#cbd5e1", MATERIAL.METAL);
        // Grey weatherproof signalling relay cabinet (継電器箱) on alternate refuge platforms
        if (index % 12 === 2) {
          builder.box(refugeSide * 5.75, 0.42, 0, 0.58, 0.88, 0.82, "#94a3b8", MATERIAL.METAL);
          builder.box(refugeSide * 5.75, 0.88, 0, 0.66, 0.08, 0.90, "#64748b", MATERIAL.METAL);
        }
      }

      builder.pop();
    }
    builder.endAsset();
  }

  // Viaduct columns and seismic reinforcement
  builder.beginAsset("viaduct piers");
  for (let u = 0.13; u < 0.64; u += 0.045) {
    const point = routeCurve.getPointAt(u);
    const height = Math.max(1, point.y - 1);
    const lateral = lateralAt(u);
    const legalSides = [-1, 1].filter((side) => {
      const x = point.x + lateral.x * 3.7 * side;
      const z = point.z + lateral.z * 3.7 * side;
      return distanceToRoad(x, z) > 0.8 && !overlapsBuilding(x, z, 0.7, 0.8, 0.5);
    });
    if (!legalSides.length) continue;
    builder.push(point.x, 0, point.z, 0, yawAt(u));
    for (const side of legalSides) {
      // Main concrete pier column
      builder.box(side * 3.7, (height - 0.4) / 2, 0, 0.9, height - 0.4, 1.2, "#8b8d89");
      // Heavy ground concrete footing pad
      builder.box(side * 3.7, 0.22, 0, 1.35, 0.44, 1.6, "#52525b");
      // Steel seismic retrofit jacket (耐震補強鋼板) on lower column section
      if (height > 3.0) {
        builder.box(side * 3.7, 1.6, 0, 0.98, 2.2, 1.28, "#475569", MATERIAL.METAL);
      }
      railInfrastructureRects.push({
        label: `viaduct pier ${u.toFixed(3)} ${side}`,
        x: point.x + lateral.x * 3.7 * side,
        z: point.z + lateral.z * 3.7 * side,
        radius: 0.8,
        ground: true
      });
    }
    // Crosshead beam supporting deck
    builder.box(0, height - 0.55, 0, 9, 1.1, 1.4, "#777b79");
    builder.pop();
  }
  builder.endAsset();
}

function addRailwaySignallingAndEquipment(builder) {
  builder.beginAsset("railway balises and bonds");

  // 1. ATS Transponders (地上子) placed between rails
  const balisePositions = [0.03, 0.08, 0.16, 0.25, 0.38, 0.50, 0.62, 0.74, 0.88];
  for (const curve of trackCurves) {
    for (const u of balisePositions) {
      const pt = curve.getPointAt(u);
      const tg = curve.getTangentAt(u);
      const yaw = Math.atan2(tg.x, tg.z);
      builder.push(pt.x, pt.y, pt.z, 0, yaw);
      // ATS-P / ATS-S transponder box between rails
      builder.box(0, 0.08, 0, 0.44, 0.10, 0.82, "#94a3b8", MATERIAL.MATTE);
      // Yellow warning stripe quads
      builder.box(0, 0.135, -0.22, 0.40, 0.015, 0.14, "#eab308", MATERIAL.EMISSIVE);
      builder.box(0, 0.135, 0.22, 0.40, 0.015, 0.14, "#eab308", MATERIAL.EMISSIVE);
      // Mounting bracket feet
      builder.box(0, 0.03, -0.42, 0.50, 0.06, 0.08, "#475569", MATERIAL.METAL);
      builder.box(0, 0.03, 0.42, 0.50, 0.06, 0.08, "#475569", MATERIAL.METAL);
      builder.pop();
    }
  }

  // 2. Track Circuit Impedance Bonds (インピーダンスボンド) between track pairs
  const bondPositions = [0.10, 0.28, 0.48, 0.70];
  for (const u of bondPositions) {
    const pt = routeCurve.getPointAt(u);
    const tg = routeCurve.getTangentAt(u);
    const yaw = Math.atan2(tg.x, tg.z);
    builder.push(pt.x, pt.y, pt.z, 0, yaw);
    // Heavy cast iron bond box
    builder.box(0, 0.18, 0, 0.85, 0.32, 0.65, "#1f2937", MATERIAL.METAL);
    builder.box(0, 0.35, 0, 0.92, 0.05, 0.72, "#374151", MATERIAL.METAL);
    // Heavy flexible copper bonding cables connecting to rails
    for (const side of [-1, 1]) {
      builder.box(side * 1.0, 0.12, 0, 1.1, 0.04, 0.06, "#78350f", MATERIAL.METAL);
    }
    builder.pop();
  }
  builder.endAsset();

  builder.beginAsset("railway signals and kiloposts");

  // 3. Multi-Aspect Colour-Light Signals (鉄道信号機) along corridor
  // A. Shibuya Station Departure Signal Gantry (出発信号機) at u = 0.05
  const pt0 = routeCurve.getPointAt(0.05);
  const tg0 = routeCurve.getTangentAt(0.05);
  const yaw0 = Math.atan2(tg0.x, tg0.z);
  builder.push(pt0.x, pt0.y, pt0.z, 0, yaw0);
  // Gantry spanning across both tracks
  builder.cylinder(-TRACK_SEPARATION / 2 - 1.8, 2.8, 0, 0.08, 0.10, 5.6, "#475569", MATERIAL.METAL, 8);
  builder.cylinder(TRACK_SEPARATION / 2 + 1.8, 2.8, 0, 0.08, 0.10, 5.6, "#475569", MATERIAL.METAL, 8);
  builder.box(0, 5.2, 0, TRACK_SEPARATION + 4.0, 0.36, 0.45, "#334155", MATERIAL.METAL);
  // Two 4-aspect signal heads over each track
  for (const trackSide of [-1, 1]) {
    const sigX = trackSide * (TRACK_SEPARATION / 2);
    builder.box(sigX, 4.4, 0.25, 0.34, 1.25, 0.24, "#1e293b", MATERIAL.METAL);
    // Black background plate with white border
    builder.box(sigX, 4.4, 0.22, 0.52, 1.45, 0.03, "#0f172a", MATERIAL.METAL);
    // 4 aspects: Red, Yellow, Amber, Green
    const colors = ["#ef4444", "#fbbf24", "#f59e0b", "#34d399"];
    colors.forEach((c, idx) => {
      const ly = 4.85 - idx * 0.30;
      const isLit = idx === 3; // Green lit
      builder.beam([sigX, ly, 0.34], [sigX, ly, 0.37], 0.08, c, isLit ? MATERIAL.EMISSIVE : MATERIAL.MATTE, 8);
      builder.box(sigX, ly + 0.08, 0.40, 0.26, 0.04, 0.14, "#0f172a", MATERIAL.METAL);
    });
  }
  builder.pop();

  // B. Namikibashi Viaduct Block Signal (並木橋 閉塞信号機) at u = 0.25
  const pt1 = routeCurve.getPointAt(0.25);
  const tg1 = routeCurve.getTangentAt(0.25);
  const yaw1 = Math.atan2(tg1.x, tg1.z);
  builder.push(pt1.x, pt1.y, pt1.z, 0, yaw1);
  const sigSide = -TRACK_SEPARATION / 2 - 1.8;
  builder.cylinder(sigSide, 2.6, 0, 0.07, 0.09, 5.2, "#475569", MATERIAL.METAL, 8);
  builder.box(sigSide, 4.2, 0.2, 0.34, 1.05, 0.22, "#1e293b", MATERIAL.METAL);
  builder.box(sigSide, 4.2, 0.18, 0.48, 1.25, 0.03, "#0f172a", MATERIAL.METAL);
  // 3 aspects: Red, Yellow, Green (Green lit)
  ["#ef4444", "#fbbf24", "#34d399"].forEach((c, idx) => {
    const ly = 4.55 - idx * 0.32;
    const isLit = idx === 2;
    builder.beam([sigSide, ly, 0.28], [sigSide, ly, 0.31], 0.085, c, isLit ? MATERIAL.EMISSIVE : MATERIAL.MATTE, 8);
    builder.box(sigSide, ly + 0.08, 0.34, 0.26, 0.04, 0.12, "#0f172a", MATERIAL.METAL);
  });
  // White identification plate
  builder.box(sigSide, 3.2, 0.18, 0.28, 0.36, 0.03, "#f8fafc", MATERIAL.MATTE);
  builder.pop();

  // 4. White Kilopost Distance Markers (距離標) on viaduct parapet
  const kiloposts = [
    { u: 0.12, text: "0.2" },
    { u: 0.28, text: "0.5" },
    { u: 0.45, text: "0.8" },
    { u: 0.60, text: "1.0" }
  ];
  for (const kp of kiloposts) {
    const pt = routeCurve.getPointAt(kp.u);
    const tg = routeCurve.getTangentAt(kp.u);
    const yaw = Math.atan2(tg.x, tg.z);
    builder.push(pt.x, pt.y, pt.z, 0, yaw);
    // Triangular white distance plate mounted to parapet
    builder.box(5.05, 1.45, 0, 0.06, 0.55, 0.42, "#f8fafc", MATERIAL.MATTE);
    builder.box(5.05, 1.15, 0, 0.04, 0.35, 0.06, "#334155", MATERIAL.METAL);
    // Black numeral accent bar
    builder.box(5.02, 1.48, 0, 0.02, 0.08, 0.24, "#0f172a", MATERIAL.MATTE);
    builder.pop();
  }

  builder.endAsset();
}

function addShibuyaTerminus(builder) {
  const origin = stationPoints[0];
  const yaw = yawAt(stationU[0]);
  const trackY = origin.y;
  builder.push(origin.x, 0, origin.z, 0, yaw);

  builder.beginAsset("Shibuya platforms");
  for (const x of [-8.5, -4.25, 0, 4.25, 8.5]) {
    builder.box(x, trackY + PLATFORM_HEIGHT / 2, -18, 2.1, PLATFORM_HEIGHT, 92, "#a9a79f");
    builder.box(x, trackY + PLATFORM_HEIGHT + 0.06, -18, 1.55, 0.12, 91, "#e3d7b7");
  }
  for (const x of [-6.3, -2.1, 2.1, 6.3]) {
    builder.box(x, trackY + 0.14, -18, 0.14, 0.28, 88, "#8c9294", MATERIAL.METAL);
    builder.box(x + 1.435, trackY + 0.14, -18, 0.14, 0.28, 88, "#8c9294", MATERIAL.METAL);
    builder.box(x + 0.72, trackY + 0.55, -63, 2.6, 1.1, 0.5, "#3d4142", MATERIAL.METAL);
    // Red reflector warning disc on buffer stop face
    builder.beam([x + 0.72, trackY + 0.55, -62.8], [x + 0.72, trackY + 0.55, -62.6], 0.22, "#ef4444", MATERIAL.EMISSIVE, 8);
  }
  builder.endAsset();

  builder.beginAsset("Shibuya platform boards");
  // Station Nameboards suspended over platforms
  for (const x of [-4.25, 4.25]) {
    addStationBoard(builder, "TY01", "SHIBUYA", x, trackY + PLATFORM_HEIGHT + 2.2, -10, 3.2, 0.85);
  }
  builder.endAsset();

  builder.beginAsset("Shibuya departures");
  // Large Departure indicator board suspended at central concourse
  addDepartureBoard(builder, 0, trackY + PLATFORM_HEIGHT + 3.2, -45, 4.4, 1.35);
  builder.endAsset();

  builder.beginAsset("Shibuya station clock");
  // Station master clock
  addStationClock(builder, 0, trackY + PLATFORM_HEIGHT + 3.2, -35, 0.42);
  builder.endAsset();

  builder.beginAsset("Shibuya station furniture");
  // Waiting benches along platforms
  for (const x of [-8.5, -4.25, 0, 4.25, 8.5]) {
    for (const z of [-28, 6]) {
      builder.box(x, trackY + PLATFORM_HEIGHT + 0.30, z, 0.55, 0.40, 1.8, "#6b4f3a", MATERIAL.MATTE);
      builder.box(x, trackY + PLATFORM_HEIGHT + 0.58, z - 0.22, 0.55, 0.35, 0.08, "#523c2c", MATERIAL.MATTE);
    }
  }
  builder.endAsset();

  builder.beginAsset("Shibuya barrel vault");
  const vaultBase = trackY + 1.1;
  for (let z = -43; z <= 24; z += 8.5) {
    builder.arch(0, vaultBase, z, 13.5, 0.28, 0.32, "#87918f", MATERIAL.METAL, 12);
  }
  for (const side of [-1, 1]) {
    builder.box(side * 13.3, trackY + 6.8, -10, 0.55, 13.6, 68, "#777f7c", MATERIAL.METAL);
  }
  for (let z = -43; z < 24; z += 8.5) {
    for (let step = 0; step < 8; step += 1) {
      const a = Math.PI * step / 8;
      const b = Math.PI * (step + 1) / 8;
      const ax = Math.cos(a) * 13.2;
      const ay = vaultBase + Math.sin(a) * 13.2;
      const bx = Math.cos(b) * 13.2;
      const by = vaultBase + Math.sin(b) * 13.2;
      builder.quad([ax, ay, z], [bx, by, z], [bx, by, z + 8.2], [ax, ay, z + 8.2], "#9fb9b8", MATERIAL.GLASS);
      builder.wire([ax, ay, z], [bx, by, z + 8.2], 0.045, "#677574");
    }
  }
  builder.endAsset();

  builder.beginAsset("Terminal department store");
  // Main Department store massing
  builder.box(-38, 17, -30, 48, 34, 68, "#c8bdab");
  for (let floor = 0; floor < 8; floor += 1) {
    builder.box(-13.9, 3 + floor * 3.7, -30, 0.45, 0.45, 64, "#827c73");
  }
  // Corporate green and red accent bands
  builder.box(-13.85, 31.5, -30, 0.35, 0.9, 64, "#006837");
  builder.box(-13.85, 30.3, -30, 0.35, 0.9, 64, "#e60012");
  // Rooftop perimeter glass parapet
  builder.box(-38, 34.6, -30, 47.6, 1.2, 67.6, "#7a9cb0", MATERIAL.GLASS);
  // Rooftop restaurant pavilion / penthouse
  builder.box(-46, 36.2, -22, 18, 3.2, 22, "#e2e8f0", MATERIAL.MATTE);
  builder.box(-46, 36.2, -22, 18.2, 1.8, 22.2, "#1e293b", MATERIAL.GLASS);
  // Rooftop corporate illuminated pylon signboard
  builder.box(-28, 38.8, -45, 1.2, 7.0, 14, "#e60012", MATERIAL.MATTE);
  builder.box(-27.9, 38.8, -45, 1.2, 6.2, 13.2, "#006837", MATERIAL.MATTE);
  builder.box(-27.8, 38.8, -45, 1.2, 5.0, 11.5, "#ffffff", MATERIAL.EMISSIVE);
  builder.endAsset();

  builder.beginAsset("Terminal station concourse");
  // East Face (facing platforms and station concourse)
  // 2-story glass entrance concourse with warm illumination
  builder.box(-13.85, 3.6, -30, 0.32, 6.8, 48, "#0f172a", MATERIAL.METAL);
  builder.box(-13.78, 3.6, -30, 0.22, 6.4, 46, "#fef3c7", MATERIAL.EMISSIVE);
  // Cantilevered entrance canopy
  builder.box(-12.5, 7.2, -30, 2.8, 0.36, 50, "#1e293b", MATERIAL.METAL);
  builder.box(-12.5, 7.0, -30, 2.4, 0.05, 48, "#fef08a", MATERIAL.EMISSIVE);
  // Railway Line station entrance signage on canopy
  addTokyoSign(builder, "RAILWAY LINE", -11.0, 7.8, -30, 10.5, 1.0, "#006837", "#ffffff", "#e60012");
  builder.endAsset();

  builder.beginAsset("Terminal east facade");
  // East upper floor ribbon windows (floors 2 to 7)
  for (let fl = 2; fl < 8; fl += 1) {
    const fy = 3.6 + fl * 3.7;
    builder.box(-13.86, fy + 1.2, -30, 0.25, 1.6, 62, "#1e293b", MATERIAL.GLASS);
    for (const sec of [-20, 0, 20]) {
      builder.box(-13.82, fy + 1.2, sec, 0.28, 1.4, 8.5, "#fef08a", MATERIAL.EMISSIVE);
    }
  }
  builder.endAsset();

  builder.beginAsset("Terminal north facade");
  // North Face (facing Shibuya Scramble Crossing, z = -64)
  // Ground level Scramble entrance & display windows
  builder.box(-38, 3.6, -64.08, 34, 6.8, 0.32, "#0f172a", MATERIAL.METAL);
  builder.box(-38, 3.6, -64.15, 32, 6.4, 0.22, "#fef3c7", MATERIAL.EMISSIVE);
  builder.box(-38, 7.2, -65.2, 36, 0.36, 2.4, "#1e293b", MATERIAL.METAL);
  // North upper ribbon windows facing Scramble
  for (let fl = 2; fl < 8; fl += 1) {
    const fy = 3.6 + fl * 3.7;
    builder.box(-38, fy + 1.2, -64.08, 42, 1.6, 0.25, "#1e293b", MATERIAL.GLASS);
    builder.box(-38, fy + 1.2, -64.12, 16, 1.4, 0.28, "#fef08a", MATERIAL.EMISSIVE);
  }
  // Department Store Signboard
  addTokyoSign(builder, "TERMINAL", -38, 29.5, -64.20, 14.0, 2.2, "#006837", "#ffffff", "#e60012");
  // Iconic Shibuya Station Master Clock facing Scramble
  addStationClock(builder, -38, 23.5, -64.28, 2.0);
  builder.endAsset();
  builder.pop();

  const storeX = origin.x - 38 * Math.cos(yaw);
  const storeZ = origin.z - 30 * Math.cos(yaw);
  registerClearance("Terminal department store", 48, 41, 68, storeX, 20.5, storeZ, yaw);

  // Shibuya Scramble crossing: Authentic 5-way pedestrian scramble crossing
  // Center: (-45, -544), spanning across the wide station-front intersection
  builder.beginAsset("Shibuya scramble zebra");

  // 1. Four Perimeter Zebra Crosswalks (北・南・東・西 外周横断歩道)
  // North Crosswalk (along z = -562, x from -62 to -28)
  for (let x = -62; x <= -28; x += 2.2) {
    builder.box(x, 0.05, -562, 1.1, 0.04, 5.5, "#f8fafc");
  }
  // South Crosswalk (along z = -526, x from -62 to -28)
  for (let x = -62; x <= -28; x += 2.2) {
    builder.box(x, 0.05, -526, 1.1, 0.04, 5.5, "#f8fafc");
  }
  // West Crosswalk (along x = -64, z from -559 to -529)
  for (let z = -559; z <= -529; z += 2.2) {
    builder.box(-64, 0.05, z, 5.5, 0.04, 1.1, "#f8fafc");
  }
  // East Crosswalk (Station front, along x = -26, z from -559 to -529)
  for (let z = -559; z <= -529; z += 2.2) {
    builder.box(-26, 0.05, z, 5.5, 0.04, 1.1, "#f8fafc");
  }

  // 2. The Iconic Diagonal Scramble "X" Crossings (対角線スクランブル斜め横断歩道)
  const scCenter = { x: -45.0, z: -544.0 };
  const diagSpan = 17.0; // Half-length of the diagonal span (~34m total)

  // Diagonal A: NW to SE (Angle = PI/4)
  for (let t = -diagSpan; t <= diagSpan; t += 2.2) {
    const x = scCenter.x + t * Math.SQRT1_2;
    const z = scCenter.z + t * Math.SQRT1_2;
    builder.push(x, 0.05, z, 0, Math.PI / 4);
    builder.box(0, 0, 0, 5.2, 0.04, 1.1, "#f8fafc");
    builder.pop();
  }

  // Diagonal B: SW to NE (Angle = -PI/4)
  for (let t = -diagSpan; t <= diagSpan; t += 2.2) {
    const x = scCenter.x + t * Math.SQRT1_2;
    const z = scCenter.z - t * Math.SQRT1_2;
    builder.push(x, 0.05, z, 0, -Math.PI / 4);
    builder.box(0, 0, 0, 5.2, 0.04, 1.1, "#f8fafc");
    builder.pop();
  }

  // 3. Corner Sidewalk Curb Islands, Yellow Tactile Braille Blocks & Pedestrian Traffic Signals
  const corners = [
    { x: -64.5, z: -562.5, yaw: Math.PI / 4 },
    { x: -25.5, z: -562.5, yaw: -Math.PI / 4 },
    { x: -64.5, z: -525.5, yaw: 3 * Math.PI / 4 },
    { x: -25.5, z: -525.5, yaw: -3 * Math.PI / 4 }
  ];

  for (const c of corners) {
    // Yellow tactile warning strip (点字警告ブロック)
    builder.box(c.x, 0.06, c.z, 3.2, 0.02, 0.9, "#f59e0b");

    // Japanese Pedestrian Traffic Signal Pole (歩行者用信号柱)
    builder.box(c.x, 1.8, c.z, 0.14, 3.6, 0.14, "#475569", MATERIAL.METAL);
    builder.push(c.x, 3.2, c.z, 0, c.yaw);
    builder.box(0, 0, 0.22, 0.32, 0.72, 0.24, "#1e293b", MATERIAL.METAL);
    builder.box(0, 0.38, 0.28, 0.34, 0.06, 0.16, "#0f172a", MATERIAL.METAL);
    builder.box(0, -0.16, 0.34, 0.22, 0.22, 0.02, "#22c55e", MATERIAL.EMISSIVE);
    builder.box(0, 0.16, 0.34, 0.22, 0.22, 0.02, "#ef4444", MATERIAL.EMISSIVE);
    builder.pop();
  }

  builder.endAsset();
}

function addDaikanyama(builder) {
  const point = stationPoints[1];
  const yaw = yawAt(stationU[1]);

  // 1. Main Platform Structure & Canopies
  builder.beginAsset("Daikanyama station").push(point.x, 0, point.z, 0, yaw);
  for (const side of [-1, 1]) {
    const x = side * (TRACK_SEPARATION / 2 + 2.7);
    // Platform concrete deck
    builder.box(x, point.y + PLATFORM_HEIGHT / 2, 0, 2.5, PLATFORM_HEIGHT, 72, "#aaa9a3");
    // Platform edge curb / nosing
    builder.box(side * (TRACK_SEPARATION / 2 + 1.48), point.y + PLATFORM_HEIGHT - 0.05, 0, 0.08, 0.12, 72, "#78716c");
    // Yellow tactile Braille warning line (点字警告ブロック)
    builder.box(side * (TRACK_SEPARATION / 2 + 1.62), point.y + PLATFORM_HEIGHT + 0.01, 0, 0.24, 0.02, 70, "#f59e0b");
    // Platform canopy roof
    builder.box(x, point.y + PLATFORM_HEIGHT + 3.4, 0, 3.2, 0.25, 58, "#cbd5e1", MATERIAL.METAL);
    // Canopy fascia valance / trim
    builder.box(side * (TRACK_SEPARATION / 2 + 1.15), point.y + PLATFORM_HEIGHT + 3.32, 0, 0.12, 0.35, 58, "#64748b", MATERIAL.METAL);
    builder.box(side * (TRACK_SEPARATION / 2 + 4.25), point.y + PLATFORM_HEIGHT + 3.32, 0, 0.12, 0.35, 58, "#64748b", MATERIAL.METAL);

    // Canopy steel stanchions & transverse rafters
    for (let z = -25; z <= 25; z += 10) {
      builder.box(x, point.y + PLATFORM_HEIGHT + 1.6, z, 0.18, 3.4, 0.18, "#475569", MATERIAL.METAL);
      builder.box(x, point.y + PLATFORM_HEIGHT + 3.25, z, 3.0, 0.14, 0.16, "#334155", MATERIAL.METAL);
    }
    // Canopy underside warm fluorescent lighting luminaires
    for (let z = -20; z <= 20; z += 10) {
      builder.box(x, point.y + PLATFORM_HEIGHT + 3.2, z, 0.22, 0.06, 3.5, "#fef08a", MATERIAL.EMISSIVE);
    }
  }
  builder.pop().endAsset();

  // 2. Platform Furniture & Equipment (West & East)
  for (const side of [-1, 1]) {
    builder.beginAsset(`Daikanyama platform ${side < 0 ? "west" : "east"}`).push(point.x, 0, point.z, 0, yaw);
    const x = side * (TRACK_SEPARATION / 2 + 2.7);

    // Station nameboard (TY02 DAIKANYAMA)
    addStationBoard(builder, "TY02", "DAIKANYAMA", x, point.y + PLATFORM_HEIGHT + 1.8, 0, 2.8, 0.75);

    // Platform waiting benches
    for (const z of [-16, 12]) {
      builder.box(x, point.y + PLATFORM_HEIGHT + 0.30, z, 0.55, 0.40, 1.8, "#6b4f3a", MATERIAL.MATTE);
      builder.box(x, point.y + PLATFORM_HEIGHT + 0.58, z - 0.22, 0.55, 0.35, 0.08, "#523c2c", MATERIAL.MATTE);
    }

    // Suspended departure information displays (発車標)
    for (const z of [-6, 18]) {
      const boardY = point.y + PLATFORM_HEIGHT + 2.7;
      builder.box(x, boardY + 0.35, z, 0.08, 0.55, 0.08, "#1e293b", MATERIAL.METAL);
      builder.box(x, boardY, z, 0.22, 0.48, 1.6, "#0f172a", MATERIAL.METAL);
      builder.box(x, boardY + 0.08, z, 0.24, 0.12, 1.4, "#f97316", MATERIAL.EMISSIVE);
      builder.box(x, boardY - 0.08, z, 0.24, 0.12, 1.4, "#22c55e", MATERIAL.EMISSIVE);
    }

    // Beverage vending machine (自動販売機) and recycling receptacle
    const vendZ = 4.0;
    const vendX = side * (TRACK_SEPARATION / 2 + 3.4);
    const vendColor = side < 0 ? "#1d4ed8" : "#b91c1c";
    builder.box(vendX, point.y + PLATFORM_HEIGHT + 0.95, vendZ, 0.85, 1.9, 0.75, vendColor, MATERIAL.METAL);
    builder.box(vendX - side * 0.02, point.y + PLATFORM_HEIGHT + 1.25, vendZ, 0.75, 0.85, 0.78, "#f8fafc", MATERIAL.EMISSIVE);
    builder.box(vendX, point.y + PLATFORM_HEIGHT + 0.35, vendZ, 0.65, 0.32, 0.77, "#0f172a", MATERIAL.METAL);
    builder.box(vendX, point.y + PLATFORM_HEIGHT + 0.45, vendZ + 0.65, 0.38, 0.90, 0.38, "#64748b", MATERIAL.METAL);
    builder.box(vendX, point.y + PLATFORM_HEIGHT + 0.92, vendZ + 0.65, 0.22, 0.08, 0.22, "#334155", MATERIAL.METAL);

    // Glass windbreak waiting shelter (待合室) at z = 12
    const shelterZ = 12;
    const shelterX = side * (TRACK_SEPARATION / 2 + 2.8);
    builder.box(shelterX, point.y + PLATFORM_HEIGHT + 0.05, shelterZ, 1.8, 0.1, 4.2, "#cbd5e1");
    builder.box(shelterX, point.y + PLATFORM_HEIGHT + 2.45, shelterZ, 2.0, 0.12, 4.4, "#475569", MATERIAL.METAL);
    builder.box(shelterX, point.y + PLATFORM_HEIGHT + 1.25, shelterZ + 2.0, 1.7, 2.3, 0.06, "#60a5fa", MATERIAL.GLASS);
    builder.box(shelterX, point.y + PLATFORM_HEIGHT + 1.25, shelterZ - 2.0, 1.7, 2.3, 0.06, "#60a5fa", MATERIAL.GLASS);
    builder.box(side * (TRACK_SEPARATION / 2 + 3.6), point.y + PLATFORM_HEIGHT + 1.25, shelterZ, 0.06, 2.3, 4.0, "#60a5fa", MATERIAL.GLASS);
    for (const dz of [-2.0, 2.0]) {
      for (const dx of [-0.85, 0.85]) {
        builder.box(shelterX + dx, point.y + PLATFORM_HEIGHT + 1.25, shelterZ + dz, 0.08, 2.4, 0.08, "#334155", MATERIAL.METAL);
      }
    }
    builder.box(shelterX, point.y + PLATFORM_HEIGHT + 0.35, shelterZ, 0.45, 0.35, 2.8, "#b45309", MATERIAL.MATTE);

    builder.pop().endAsset();
  }

  // 3. Daikanyama Station Concourse Overpass Bridge (代官山駅連絡跨線橋)
  builder.beginAsset("Daikanyama station overpass").push(point.x, 0, point.z, 0, yaw);
  const overpassZ = -14.0;
  const concourseY = point.y + 5.6; // 1.8m above train max clearance (point.y + 3.8)
  builder.box(0, concourseY - 0.25, overpassZ, 17.0, 0.5, 5.2, "#cbd5e1");
  builder.box(0, concourseY + 3.1, overpassZ, 17.4, 0.3, 5.6, "#475569", MATERIAL.METAL);
  builder.box(0, concourseY + 2.9, overpassZ, 16.0, 0.06, 1.2, "#fef3c7", MATERIAL.EMISSIVE);
  builder.box(0, concourseY + 1.4, overpassZ - 2.5, 16.8, 2.8, 0.1, "#93c5fd", MATERIAL.GLASS);
  builder.box(0, concourseY + 1.4, overpassZ + 2.5, 16.8, 2.8, 0.1, "#93c5fd", MATERIAL.GLASS);
  for (const fx of [-8.2, -3.0, 3.0, 8.2]) {
    builder.box(fx, concourseY + 1.4, overpassZ - 2.5, 0.22, 2.9, 0.22, "#1e293b", MATERIAL.METAL);
    builder.box(fx, concourseY + 1.4, overpassZ + 2.5, 0.22, 2.9, 0.22, "#1e293b", MATERIAL.METAL);
    builder.box(fx, concourseY + 2.9, overpassZ, 0.22, 0.22, 5.1, "#1e293b", MATERIAL.METAL);
  }
  for (const gateX of [-1.2, 0, 1.2]) {
    builder.box(gateX, concourseY + 0.45, overpassZ, 0.26, 0.90, 1.4, "#0284c7", MATERIAL.METAL);
    builder.box(gateX, concourseY + 0.92, overpassZ + 0.2, 0.24, 0.04, 0.28, "#38bdf8", MATERIAL.EMISSIVE);
  }
  for (const side of [-1, 1]) {
    const stairX = side * (TRACK_SEPARATION / 2 + 2.7);
    for (let step = 0; step < 6; step += 1) {
      const t = step / 5;
      const sz = overpassZ + 1.8 + t * 5.4;
      const sy = concourseY - t * (concourseY - (point.y + PLATFORM_HEIGHT));
      builder.box(stairX, sy, sz, 1.6, 0.4, 1.1, "#94a3b8");
    }
    const midStairZ = overpassZ + 4.5;
    const midStairY = (concourseY + point.y + PLATFORM_HEIGHT) / 2 + 1.6;
    builder.box(stairX, midStairY + 1.2, midStairZ, 1.8, 0.12, 6.2, "#475569", MATERIAL.METAL);
    builder.box(side * (TRACK_SEPARATION / 2 + 1.8), midStairY, midStairZ, 0.06, 1.1, 5.8, "#64748b", MATERIAL.METAL);
    builder.box(side * (TRACK_SEPARATION / 2 + 3.6), midStairY, midStairZ, 0.06, 1.1, 5.8, "#64748b", MATERIAL.METAL);
  }
  builder.pop().endAsset();

  // 4. Daikanyama Hillside Retaining Walls & Cutting (代官山切通し・擁壁)
  builder.beginAsset("Daikanyama cutting walls").push(point.x, 0, point.z, 0, yaw);
  for (const side of [-1, 1]) {
    const wallX = side * (TRACK_SEPARATION / 2 + 4.9);
    builder.box(wallX, point.y + 0.4, 0, 0.9, 0.8, 76, "#78716c");
    const wallHeight = 3.6;
    builder.box(wallX + side * 0.15, point.y + wallHeight / 2, 0, 0.6, wallHeight, 76, "#9ca3af");
    builder.box(wallX + side * 0.25, point.y + wallHeight + 0.12, 0, 0.8, 0.24, 76, "#cbd5e1");
    for (let z = -32; z <= 32; z += 8) {
      builder.box(wallX - side * 0.18, point.y + wallHeight / 2, z, 0.22, wallHeight, 0.55, "#6b7280");
    }
    const railY = point.y + wallHeight + 0.65;
    builder.box(wallX + side * 0.45, railY, 0, 0.06, 0.85, 76, "#475569", MATERIAL.METAL);
    builder.box(wallX + side * 0.95, point.y + wallHeight + 0.35, 0, 0.75, 0.70, 72, "#2d4a22", MATERIAL.MATTE);
  }
  builder.pop().endAsset();

  // 5. Daikanyama Boutique Terrace (代官山テラス・カフェ)
  builder.beginAsset("Daikanyama boutique terrace").push(point.x, 0, point.z, 0, yaw);
  const shopX = - (TRACK_SEPARATION / 2 + 7.2);
  const shopY = point.y + 3.8;
  const shopZ = 6.0;
  // Timber outdoor terrace deck
  builder.box(shopX, shopY + 0.1, shopZ, 4.4, 0.2, 16.0, "#92400e", MATERIAL.MATTE);
  // Compact boutique espresso kiosk
  builder.box(shopX - 1.2, shopY + 1.6, shopZ + 4.5, 2.2, 3.0, 4.8, "#1e293b", MATERIAL.METAL);
  // Warm pastry & coffee display glow
  builder.box(shopX + 0.0, shopY + 1.4, shopZ + 4.5, 0.2, 1.6, 3.8, "#fef3c7", MATERIAL.EMISSIVE);
  builder.box(shopX + 0.1, shopY + 1.4, shopZ + 4.5, 0.05, 1.6, 3.8, "#60a5fa", MATERIAL.GLASS);
  // Striped awning
  builder.box(shopX + 0.6, shopY + 2.9, shopZ + 4.5, 1.4, 0.08, 4.4, "#1e3a8a", MATERIAL.MATTE);
  // Glass windbreak railing along terrace edge
  builder.box(shopX + 2.1, shopY + 0.6, shopZ, 0.06, 1.0, 15.6, "#93c5fd", MATERIAL.GLASS);
  builder.box(shopX + 2.1, shopY + 1.15, shopZ, 0.08, 0.08, 15.6, "#475569", MATERIAL.METAL);
  // Cafe round tables with sun parasols
  for (const dz of [-4.5, -0.5]) {
    const tableZ = shopZ + dz;
    const tableX = shopX + 0.6;
    builder.cylinder(tableX, shopY + 0.45, tableZ, 0.04, 0.04, 0.7, "#475569", MATERIAL.METAL, 8);
    builder.cylinder(tableX, shopY + 0.82, tableZ, 0.55, 0.55, 0.04, "#f8fafc", MATERIAL.MATTE, 12);
    builder.cylinder(tableX, shopY + 1.6, tableZ, 0.03, 0.03, 1.5, "#475569", MATERIAL.METAL, 8);
    builder.arch(tableX, shopY + 2.3, tableZ, 1.5, 0.30, 1.5, "#0284c7", MATERIAL.MATTE, 12);
  }
  builder.pop().endAsset();

  // 6. Daikanyama Railway Signalling & Tunnel Portal
  const portal = portalPose();
  builder.beginAsset("Daikanyama railway signal")
    .push(portal.point.x, 0, portal.point.z, 0, portal.yaw);
  // Mast on the side of track
  const sigX = -TRACK_SEPARATION / 2 - 1.8;
  builder.cylinder(sigX, 2.8, 3.0, 0.07, 0.09, 5.6, "#475569", MATERIAL.METAL, 8);
  // Signal head housing
  builder.box(sigX, 4.4, 3.0, 0.34, 1.1, 0.24, "#1e293b", MATERIAL.METAL);
  // Signal hood visor
  builder.box(sigX, 5.0, 2.85, 0.38, 0.12, 0.20, "#0f172a", MATERIAL.METAL);
  // 3 aspects: Red (top), Amber (mid), Green (bot - lit)
  builder.beam([sigX, 4.75, 2.95], [sigX, 4.75, 2.85], 0.09, "#ef4444", MATERIAL.MATTE, 8);
  builder.beam([sigX, 4.40, 2.95], [sigX, 4.40, 2.85], 0.09, "#fbbf24", MATERIAL.MATTE, 8);
  builder.beam([sigX, 4.05, 2.95], [sigX, 4.05, 2.85], 0.09, "#34d399", MATERIAL.EMISSIVE, 8);
  // Identification plate (白地に黒 "2R")
  builder.box(sigX, 3.2, 2.9, 0.28, 0.36, 0.03, "#f8fafc", MATERIAL.MATTE);
  builder.pop().endAsset();

  builder.beginAsset("Daikanyama south portal")
    .push(portal.point.x, 0, portal.point.z, 0, portal.yaw);
  builder.box(0, 3.4, 0, 15, 6.8, 2.2, "#817f78");
  builder.box(0, 3, -1.2, 10.5, 5.8, 2.6, "#1d2426");
  builder.arch(0, 3, -2.6, 5.25, 0.7, 1.1, "#96938a", MATERIAL.MATTE, 12);
  builder.pop().endAsset();
}

function lateralAt(u) {
  const tangent = routeCurve.getTangentAt(u);
  const length = Math.hypot(tangent.x, tangent.z) || 1;
  return { x: tangent.z / length, z: -tangent.x / length };
}

function addCatenary(builder) {
  const mastOffset = TRACK_SEPARATION / 2 + 2.6;
  const mastHeight = CATENARY_HEIGHT + 1.4;
  let index = 0;

  for (let u = 0.12; u <= 0.95; u += 0.045, index += 1) {
    const point = routeCurve.getPointAt(u);
    const lateral = lateralAt(u);
    const preferred = index % 2 === 0 ? 1 : -1;
    const side = [preferred, -preferred].find((candidate) => {
      const x = point.x + lateral.x * mastOffset * candidate;
      const z = point.z + lateral.z * mastOffset * candidate;
      const groundConflict = point.y < 2 && distanceToRoad(x, z) < 0.5;
      return !groundConflict && !overlapsBuilding(x, z, 0.35, 0.35, 0.4);
    });
    if (!side) continue;
    const baseX = point.x + lateral.x * mastOffset * side;
    const baseZ = point.z + lateral.z * mastOffset * side;
    const armY = point.y + CATENARY_HEIGHT + 0.9;
    const tipX = point.x - lateral.x * (TRACK_SEPARATION / 2 + 0.5) * side;
    const tipZ = point.z - lateral.z * (TRACK_SEPARATION / 2 + 0.5) * side;

    builder.cylinder(baseX, point.y + mastHeight / 2 - 0.5, baseZ,
      0.17, 0.11, mastHeight, "#57646a", MATERIAL.METAL, 6);
    builder.beam([baseX, armY, baseZ], [tipX, armY, tipZ], 0.07, "#5f6d74", MATERIAL.METAL, 5);

    registerClearance(`catenary mast ${index}`, 0.5, mastHeight, 0.5,
      baseX, point.y + mastHeight / 2 - 0.5, baseZ);
    railInfrastructureRects.push({
      label: `catenary mast ${index}`,
      x: baseX,
      z: baseZ,
      radius: 0.35,
      ground: point.y < 2
    });
    registerClearance(`catenary cantilever ${index}`,
      Math.abs(tipX - baseX) + 0.2, 0.2, Math.abs(tipZ - baseZ) + 0.2,
      (baseX + tipX) / 2, armY, (baseZ + tipZ) / 2);
  }

  for (const curve of trackCurves) {
    let previousContact = null;
    let previousMessenger = null;
    for (let u = 0.12; u <= 0.95; u += 0.015) {
      const point = curve.getPointAt(u);
      const contact = [point.x, point.y + CATENARY_HEIGHT, point.z];
      const messenger = [point.x, point.y + CATENARY_HEIGHT + 0.9, point.z];
      if (previousContact) {
        builder.wire(previousContact, contact, 0.035, "#3c4749");
        builder.wire(previousMessenger, messenger, 0.025, "#3c4749");
      }
      builder.wire(messenger, contact, 0.015, "#4b5659");
      previousContact = contact;
      previousMessenger = messenger;
    }
  }
}

export function createWorld(scene) {
  clearanceItems.length = 0;
  cityFootprints.length = 0;
  railInfrastructureRects.length = 0;

  scene.background = new THREE.Color(0x8ea7b4);
  // Linear fog matching the sky background softly blends the horizon without darkening the diorama table
  scene.fog = new THREE.Fog(0x8ea7b4, 1200, 3800);
  const hemi = new THREE.HemisphereLight(0xbcd3d6, 0x2d251c, 0.62);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffddab, 1.3);
  sun.position.set(-180, 260, 120);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -270;
  sun.shadow.camera.right = 270;
  sun.shadow.camera.top = 380;
  sun.shadow.camera.bottom = -380;
  sun.shadow.camera.near = 20;
  sun.shadow.camera.far = 700;
  sun.shadow.bias = -0.0003;
  sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun);
  scene.add(sun.target);

  const builder = new Builder();
  addGroundAndRoads(builder);
  addShibuyaRiver(builder);
  addShibuyaRiverPromenadeDetails(builder);
  addViaduct(builder);
  addRailwaySignallingAndEquipment(builder);
  addShibuyaTerminus(builder);
  addDaikanyama(builder);
  addCity(builder);
  addCityFabric(builder);
  addUrbanInfill(builder);
  addCatenary(builder);
  populateTokyoStreetlife(builder);

  const world = builder.toThreeGroup({
    [MATERIAL.MATTE]: createUrbanGroundMaterial()
  });
  world.name = "Train 3D diorama";
  scene.add(world);
  builderStats = {
    ...builder.getStats(),
    aabb: builder.getAABB(),
    assets: builder.getAssetStats()
  };
  return { world, sun, hemi };
}

export function getClearanceItems() {
  return clearanceItems.map((item) => ({ ...item }));
}

export function getRailInfrastructureRects() {
  return railInfrastructureRects.map((rect) => ({ ...rect }));
}

// Carries the `fabric` flag: only the generated blocks are held to the street grid, since
// PLATEAU footprints are real and may legitimately sit where this model's invented roads run.
export function getCityFootprints() {
  return cityFootprints.map((item) => ({ ...item }));
}

export function getMapMetadata() {
  return { ...MAP_METADATA };
}

export function getBuilderStats() {
  return builderStats ? structuredClone(builderStats) : null;
}
