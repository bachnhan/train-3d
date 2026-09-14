import { MAP } from "./data/map.js";
import { routeCurve } from "./layout.js";
import {
  distanceToPolygon, pointSegmentDistance, segmentDistance, segmentsIntersect
} from "./spatial-geometry.mjs";

export const RAILWAY_CORRIDOR_HALF_WIDTH = 7;
export const CITY_CORRIDOR = 380;
export const BOARD_RIM = 36;
export const PORTAL_U = 0.965;
export const CARRIAGEWAYS = Object.freeze([
  "motorway", "trunk", "primary", "secondary", "tertiary", "residential", "unclassified"
]);

const railwayPoly = MAP.alignment.map((point) => [point[0], point[2]]);

function distanceToPolyline(x, z, points) {
  let nearest = Infinity;
  for (let index = 1; index < points.length; index += 1) {
    nearest = Math.min(nearest, pointSegmentDistance([x, z], points[index - 1], points[index]));
  }
  return nearest;
}

export function distanceToRailway(x, z) {
  return distanceToPolyline(x, z, railwayPoly);
}

export const SHIBUYA_RIVER = Object.freeze([
  [35.0, -480],
  [36, -460],
  [44, -380],
  [54, -300],
  [66, -210],
  [78, -130],
  [94, -40],
  [116, 60],
  [142, 170],
  [170, 280],
  [194, 370],
  [222, 470],
  [254, 570],
  [282, 660]
]);

export function distanceToRiver(x, z) {
  return distanceToPolyline(x, z, SHIBUYA_RIVER);
}

export const LANDMARK_IDS = Object.freeze({
  ADDRESS_TOWER: "bldg_0067ef13-95dc-4d33-b489-c104110b601c",
  CERULEAN_TOWER: "bldg_3ad6aaeb-26f8-4716-a8ec-cb2504b94674",
  SHIBUYA_SCRAMBLE: "osm-617560918"
});

export const NAMIKIBASHI_POINT = Object.freeze([-34, 9.7, -210]);

export function isInsideBoard(x, z, radius = 0) {
  return Math.abs(x) + radius <= MAP.land.halfX - BOARD_RIM
    && z - radius >= MAP.land.minZ + BOARD_RIM
    && z + radius <= MAP.land.maxZ - BOARD_RIM;
}

export function isInCity(x, z, radius = 0) {
  return isInsideBoard(x, z, radius) && distanceToRailway(x, z) <= CITY_CORRIDOR + radius;
}

function polygonInCity(polygon) {
  return polygon.every((point) => isInCity(point[0], point[1], 0));
}

const railwaySamples = Array.from({ length: 1201 }, (_, index) => {
  const point = routeCurve.getPointAt(index / 1200);
  return [point.x, point.z];
});

export function distanceToRailwayFootprint(polygon) {
  return railwaySamples.reduce(
    (distance, point) => Math.min(distance, distanceToPolygon(point, polygon)),
    Infinity
  );
}

export function roadCrossesRiver(a, b) {
  for (let index = 1; index < SHIBUYA_RIVER.length; index += 1) {
    if (segmentsIntersect(a, b, SHIBUYA_RIVER[index - 1], SHIBUYA_RIVER[index])) return true;
  }
  return false;
}

export const CANAL_BOUNDARY = 7.5;

function clipRoadSegmentToCanal(a, b) {
  const SAMPLES = 16;
  const inside = [];
  for (let i = 0; i <= SAMPLES; i += 1) {
    const t = i / SAMPLES;
    const x = a[0] + (b[0] - a[0]) * t;
    const z = a[1] + (b[1] - a[1]) * t;
    inside.push(distanceToRiver(x, z) < CANAL_BOUNDARY);
  }

  if (inside.every(Boolean)) return [];
  if (inside.every((v) => !v)) return [[a, b]];

  const segments = [];
  let inOutside = !inside[0];
  let startT = inOutside ? 0 : null;

  for (let i = 1; i <= SAMPLES; i += 1) {
    const wasOutside = !inside[i - 1];
    const isOutside = !inside[i];
    if (!wasOutside && isOutside) {
      let t0 = (i - 1) / SAMPLES;
      let t1 = i / SAMPLES;
      for (let k = 0; k < 6; k += 1) {
        const tm = (t0 + t1) / 2;
        const xm = a[0] + (b[0] - a[0]) * tm;
        const zm = a[1] + (b[1] - a[1]) * tm;
        if (distanceToRiver(xm, zm) < CANAL_BOUNDARY) t0 = tm;
        else t1 = tm;
      }
      startT = t1;
    } else if (wasOutside && !isOutside) {
      let t0 = (i - 1) / SAMPLES;
      let t1 = i / SAMPLES;
      for (let k = 0; k < 6; k += 1) {
        const tm = (t0 + t1) / 2;
        const xm = a[0] + (b[0] - a[0]) * tm;
        const zm = a[1] + (b[1] - a[1]) * tm;
        if (distanceToRiver(xm, zm) >= CANAL_BOUNDARY) t0 = tm;
        else t1 = tm;
      }
      const ptA = [a[0] + (b[0] - a[0]) * startT, a[1] + (b[1] - a[1]) * startT];
      const ptB = [a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0];
      if (Math.hypot(ptB[0] - ptA[0], ptB[1] - ptA[1]) >= 2.4) {
        segments.push([ptA, ptB]);
      }
      startT = null;
    }
  }

  if (startT !== null) {
    const ptA = [a[0] + (b[0] - a[0]) * startT, a[1] + (b[1] - a[1]) * startT];
    const ptB = [b[0], b[1]];
    if (Math.hypot(ptB[0] - ptA[0], ptB[1] - ptA[1]) >= 2.4) {
      segments.push([ptA, ptB]);
    }
  }

  return segments;
}

function riverFrameAtZ(z) {
  for (let i = 1; i < SHIBUYA_RIVER.length; i += 1) {
    const p0 = SHIBUYA_RIVER[i - 1];
    const p1 = SHIBUYA_RIVER[i];
    if ((z >= p0[1] && z <= p1[1]) || (z >= p1[1] && z <= p0[1])) {
      const t = (z - p0[1]) / (p1[1] - p0[1]);
      const x = p0[0] + (p1[0] - p0[0]) * t;
      const dx = p1[0] - p0[0];
      const dz = p1[1] - p0[1];
      const yaw = Math.atan2(dx, dz);
      return { x, z, yaw, segIndex: i };
    }
  }
  return { x: 0, z, yaw: 0, segIndex: 1 };
}

const CANONICAL_BRIDGES_CONFIG = Object.freeze([
  { id: "bridge-inari", name: "稲荷橋", highway: "pedestrian", z: -470.0, width: 7.0, crossYaw: null },
  { id: "bridge-konno", name: "金王橋", highway: "secondary", z: -400.0, width: 8, crossYaw: 0.918 },
  { id: "bridge-sakura", name: "桜橋", highway: "tertiary", z: -268.1, width: 9, crossYaw: 0.808 },
  { id: "bridge-namikibashi", name: "並木橋", highway: "tertiary", z: -89.2, width: 10, crossYaw: 1.559 },
  { id: "bridge-koshin", name: "庚申橋", highway: "tertiary", z: 53.5, width: 8, crossYaw: 2.221 },
  { id: "bridge-daikanyama", name: "代官山橋", highway: "tertiary", z: 209.7, width: 10, crossYaw: 2.644 },
  { id: "bridge-ebisu", name: "恵比寿橋", highway: "tertiary", z: 363.0, width: 8.5, crossYaw: 2.515 },
  { id: "bridge-shinbashi", name: "新橋", highway: "tertiary", z: 401.5, width: 8.0, crossYaw: 1.644 },
  { id: "bridge-shibuyabashi", name: "渋谷橋", highway: "tertiary", z: 475.0, width: 9.0, crossYaw: 1.379 }
]);

const BRIDGE_SPAN = 17.6;

export const RIVER_BRIDGES = Object.freeze(CANONICAL_BRIDGES_CONFIG.map((cfg) => {
  const frame = riverFrameAtZ(cfg.z);
  const crossYaw = cfg.crossYaw !== null ? cfg.crossYaw : frame.yaw + Math.PI / 2;
  const halfSpan = BRIDGE_SPAN / 2;
  const sin = Math.sin(crossYaw);
  const cos = Math.cos(crossYaw);
  const a = [frame.x - sin * halfSpan, frame.z - cos * halfSpan];
  const b = [frame.x + sin * halfSpan, frame.z + cos * halfSpan];
  return {
    id: cfg.id,
    name: cfg.name,
    highway: cfg.highway,
    width: cfg.width,
    span: BRIDGE_SPAN,
    cx: frame.x,
    cz: frame.z,
    yaw: crossYaw,
    riverYaw: frame.yaw,
    segIndex: frame.segIndex,
    a,
    b,
    isBridge: true
  };
}));

const BRIDGE_CONNECTORS = Object.freeze([
  { id: "connector-sakura-a", highway: "tertiary", name: "SAKURAストリート", width: 9, a: [42.3, -283.4], b: [51.9, -274.2], isBridge: false },
  { id: "connector-inari-b", highway: "pedestrian", name: "稲荷橋通り", width: 6.5, a: [44.3, -470.0], b: [54.4, -481.4], isBridge: false },
  { id: "connector-inari-a", highway: "pedestrian", name: "渋谷ストリーム", width: 6.5, a: [16.0, -470.0], b: [26.7, -470.0], isBridge: false },
  { id: "connector-daikanyama-b", highway: "tertiary", name: "八幡通り", width: 10, a: [156.3, 202.0], b: [161.0, 192.8], isBridge: false },
  { id: "connector-ebisu-a", highway: "tertiary", name: "恵比寿通り", width: 8.5, a: [184.8, 364.4], b: [187.0, 370.1], isBridge: false },
  { id: "connector-ebisu-b", highway: "tertiary", name: "恵比寿通り", width: 8.5, a: [197.3, 355.9], b: [201.8, 341.0], isBridge: false },
  { id: "connector-tamagawa-shibuya", highway: "trunk", name: "玉川通り", width: 16, a: [-67.6, -477.6], b: [-54.3, -458.2], isBridge: false },
  { id: "connector-tamagawa-westbound", highway: "trunk", name: "玉川通り", width: 16, a: [-23.2, -488.4], b: [-18.0, -474.4], isBridge: false }
]);

const candidateRoadSegments = [
  ...MAP.roads.flatMap((road) =>
    road.points.slice(1).map((point, index) => ({
      id: `${road.id}-${index}`,
      highway: road.highway,
      name: road.name,
      width: road.width,
      a: [road.points[index][0], road.points[index][1]],
      b: [point[0], point[1]]
    }))
  ).filter((road) =>
    CARRIAGEWAYS.includes(road.highway)
    && isInsideBoard(road.a[0], road.a[1], 0)
    && isInsideBoard(road.b[0], road.b[1], 0)
    && isInCity((road.a[0] + road.b[0]) / 2, (road.a[1] + road.b[1]) / 2, 0)
  ).flatMap((road) => {
    const clipped = clipRoadSegmentToCanal(road.a, road.b);
    return clipped.map((pts, idx) => ({
      ...road,
      id: idx === 0 ? road.id : `${road.id}-c${idx}`,
      a: [pts[0][0], pts[0][1]],
      b: [pts[1][0], pts[1][1]],
      isBridge: false
    }));
  }).filter((road) => Math.hypot(road.b[0] - road.a[0], road.b[1] - road.a[1]) >= 1.0),
  ...BRIDGE_CONNECTORS.map((c) => ({
    ...c,
    a: [c.a[0], c.a[1]],
    b: [c.b[0], c.b[1]]
  }))
];

function snapEndpoints(roadSegments, bridgeSegments, snapDist = 3.5) {
  const endpoints = [];
  roadSegments.forEach((seg, sIdx) => {
    endpoints.push({ sIdx, end: "a", pt: seg.a, isBridge: false });
    endpoints.push({ sIdx, end: "b", pt: seg.b, isBridge: false });
  });
  bridgeSegments.forEach((bridge, bIdx) => {
    endpoints.push({ bIdx, end: "a", pt: bridge.a, isBridge: true });
    endpoints.push({ bIdx, end: "b", pt: bridge.b, isBridge: true });
  });

  const parent = endpoints.map((_, i) => i);
  function find(i) {
    if (parent[i] === i) return i;
    parent[i] = find(parent[i]);
    return parent[i];
  }
  function canUnion(i, j) {
    const ri = find(i);
    const rj = find(j);
    if (ri === rj) return true;
    for (let sIdx = 0; sIdx < roadSegments.length; sIdx += 1) {
      const rootA = find(sIdx * 2);
      const rootB = find(sIdx * 2 + 1);
      if ((rootA === ri && rootB === rj) || (rootA === rj && rootB === ri)) {
        return false;
      }
    }
    return true;
  }
  function union(i, j) {
    const ri = find(i);
    const rj = find(j);
    if (ri !== rj) parent[ri] = rj;
  }

  const pairs = [];
  for (let i = 0; i < endpoints.length; i += 1) {
    for (let j = i + 1; j < endpoints.length; j += 1) {
      const d = Math.hypot(endpoints[i].pt[0] - endpoints[j].pt[0], endpoints[i].pt[1] - endpoints[j].pt[1]);
      if (d <= snapDist) {
        pairs.push({ i, j, d });
      }
    }
  }
  pairs.sort((p1, p2) => p1.d - p2.d);
  for (const pair of pairs) {
    if (canUnion(pair.i, pair.j)) {
      union(pair.i, pair.j);
    }
  }

  const clusters = new Map();
  for (let i = 0; i < endpoints.length; i += 1) {
    const root = find(i);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root).push(endpoints[i]);
  }

  clusters.forEach((group) => {
    if (group.length <= 1) return;
    const bridgePt = group.find((e) => e.isBridge);
    let targetX;
    let targetZ;
    if (bridgePt) {
      targetX = bridgePt.pt[0];
      targetZ = bridgePt.pt[1];
    } else {
      targetX = group.reduce((sum, e) => sum + e.pt[0], 0) / group.length;
      targetZ = group.reduce((sum, e) => sum + e.pt[1], 0) / group.length;
    }
    group.forEach((e) => {
      if (!e.isBridge) {
        roadSegments[e.sIdx][e.end][0] = targetX;
        roadSegments[e.sIdx][e.end][1] = targetZ;
      }
    });
  });

  // T-junction projection pass: project disconnected endpoints onto intersecting road centerline
  for (let sIdx = 0; sIdx < roadSegments.length; sIdx += 1) {
    const seg = roadSegments[sIdx];
    for (const end of ["a", "b"]) {
      const pt = seg[end];
      let isConnected = false;
      for (let oIdx = 0; oIdx < roadSegments.length; oIdx += 1) {
        if (sIdx === oIdx) continue;
        const other = roadSegments[oIdx];
        if (Math.hypot(pt[0] - other.a[0], pt[1] - other.a[1]) < 0.1
          || Math.hypot(pt[0] - other.b[0], pt[1] - other.b[1]) < 0.1) {
          isConnected = true;
          break;
        }
      }
      if (!isConnected) {
        for (const bridge of bridgeSegments) {
          if (Math.hypot(pt[0] - bridge.a[0], pt[1] - bridge.a[1]) < 0.1
            || Math.hypot(pt[0] - bridge.b[0], pt[1] - bridge.b[1]) < 0.1) {
            isConnected = true;
            break;
          }
        }
      }
      if (isConnected) continue;

      let bestProj = null;
      for (let oIdx = 0; oIdx < roadSegments.length; oIdx += 1) {
        if (sIdx === oIdx) continue;
        const other = roadSegments[oIdx];
        const dx = other.b[0] - other.a[0];
        const dz = other.b[1] - other.a[1];
        const len2 = dx * dx + dz * dz;
        if (len2 === 0) continue;
        const t = ((pt[0] - other.a[0]) * dx + (pt[1] - other.a[1]) * dz) / len2;
        if (t > 0.05 && t < 0.95) {
          const px = other.a[0] + t * dx;
          const pz = other.a[1] + t * dz;
          const perp = Math.hypot(pt[0] - px, pt[1] - pz);
          const reach = (other.width || 7) / 2 + 3.0;
          if (perp <= reach && (!bestProj || perp < bestProj.perp)) {
            bestProj = { px, pz, perp };
          }
        }
      }
      if (bestProj) {
        seg[end][0] = bestProj.px;
        seg[end][1] = bestProj.pz;
      }
    }
  }
}

snapEndpoints(candidateRoadSegments, RIVER_BRIDGES, 3.5);

const allSegments = [
  ...candidateRoadSegments,
  ...RIVER_BRIDGES.map((b) => ({ ...b, isBridge: true }))
];

const roadAdj = new Map();
allSegments.forEach((_, idx) => roadAdj.set(idx, []));

for (let i = 0; i < allSegments.length; i += 1) {
  for (let j = i + 1; j < allSegments.length; j += 1) {
    const r1 = allSegments[i];
    const r2 = allSegments[j];
    const dAA = Math.hypot(r1.a[0] - r2.a[0], r1.a[1] - r2.a[1]);
    const dAB = Math.hypot(r1.a[0] - r2.b[0], r1.a[1] - r2.b[1]);
    const dBA = Math.hypot(r1.b[0] - r2.a[0], r1.b[1] - r2.a[1]);
    const dBB = Math.hypot(r1.b[0] - r2.b[0], r1.b[1] - r2.b[1]);
    if (dAA < 3.0 || dAB < 3.0 || dBA < 3.0 || dBB < 3.0) {
      roadAdj.get(i).push(j);
      roadAdj.get(j).push(i);
    }
  }
}

const visitedRoads = new Set();
const culledRoadIds = new Set();

for (let i = 0; i < allSegments.length; i += 1) {
  if (!visitedRoads.has(i)) {
    const comp = [];
    const queue = [i];
    visitedRoads.add(i);
    while (queue.length > 0) {
      const u = queue.shift();
      comp.push(u);
      for (const v of roadAdj.get(u)) {
        if (!visitedRoads.has(v)) {
          visitedRoads.add(v);
          queue.push(v);
        }
      }
    }
    const hasBridge = comp.some((idx) => allSegments[idx].isBridge);
    const totalLen = comp.reduce((sum, idx) => {
      const s = allSegments[idx];
      return sum + Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]);
    }, 0);
    // Cull isolated disconnected road islands < 25m not connected to any bridge
    if (!hasBridge && totalLen < 25.0) {
      comp.forEach((idx) => culledRoadIds.add(allSegments[idx].id));
    }
  }
}

const landRoadSegments = candidateRoadSegments.filter((road) => {
  if (culledRoadIds.has(road.id)) return false;
  if (road.id.startsWith("connector-")) return true;

  let aConn = 0;
  let bConn = 0;
  for (const other of candidateRoadSegments) {
    if (other === road || culledRoadIds.has(other.id)) continue;
    const dAA = Math.hypot(road.a[0] - other.a[0], road.a[1] - other.a[1]);
    const dAB = Math.hypot(road.a[0] - other.b[0], road.a[1] - other.b[1]);
    const dBA = Math.hypot(road.b[0] - other.a[0], road.b[1] - other.a[1]);
    const dBB = Math.hypot(road.b[0] - other.b[0], road.b[1] - other.b[1]);
    if (dAA < 3.0 || dAB < 3.0) aConn += 1;
    if (dBA < 3.0 || dBB < 3.0) bConn += 1;
  }
  for (const bridge of RIVER_BRIDGES) {
    const dAA = Math.hypot(road.a[0] - bridge.a[0], road.a[1] - bridge.a[1]);
    const dAB = Math.hypot(road.a[0] - bridge.b[0], road.a[1] - bridge.b[1]);
    const dBA = Math.hypot(road.b[0] - bridge.a[0], road.b[1] - bridge.a[1]);
    const dBB = Math.hypot(road.b[0] - bridge.b[0], road.b[1] - bridge.b[1]);
    if (dAA < 3.0 || dAB < 3.0) aConn += 1;
    if (dBA < 3.0 || dBB < 3.0) bConn += 1;
  }

  const len = Math.hypot(road.b[0] - road.a[0], road.b[1] - road.a[1]);

  // 1. Cull completely isolated orphan road segments
  if (aConn === 0 && bConn === 0) return false;

  // 2. Cull severed dead-end micro-stubs (< 4.0m) caused by boundary clipping (except motorway)
  if ((aConn === 0 || bConn === 0) && len < 4.0 && road.highway !== "motorway") {
    return false;
  }

  // 3. Cull short dead-end stubs (< 15m) that penetrate or terminate within 1.0m of building footprints
  if ((aConn === 0 || bConn === 0) && len < 15) {
    for (const b of MAP.buildings) {
      let minDist = Infinity;
      for (let i = 0; i < b.polygon.length; i += 1) {
        const p1 = b.polygon[i];
        const p2 = b.polygon[(i + 1) % b.polygon.length];
        minDist = Math.min(minDist, segmentDistance(p1, p2, road.a, road.b));
      }
      if (minDist < road.width / 2 + 1.0) {
        return false;
      }
    }
  }
  return true;
});

export const ROAD_SEGMENTS = Object.freeze([
  ...landRoadSegments,
  ...RIVER_BRIDGES.map((bridge) => ({
    id: bridge.id,
    highway: bridge.highway,
    name: bridge.name,
    width: bridge.width,
    a: bridge.a,
    b: bridge.b,
    isBridge: true
  }))
]);

export function distanceToRoad(x, z) {
  let nearest = Infinity;
  for (const road of ROAD_SEGMENTS) {
    nearest = Math.min(nearest, pointSegmentDistance([x, z], road.a, road.b) - road.width / 2);
  }
  return nearest;
}

export function distanceFootprintToRoads(polygon) {
  let nearest = Infinity;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < polygon.length; i += 1) {
    const pt = polygon[i];
    if (pt[0] < minX) minX = pt[0];
    if (pt[0] > maxX) maxX = pt[0];
    if (pt[1] < minZ) minZ = pt[1];
    if (pt[1] > maxZ) maxZ = pt[1];
  }
  const bMinX = minX - 16;
  const bMaxX = maxX + 16;
  const bMinZ = minZ - 16;
  const bMaxZ = maxZ + 16;

  for (const road of ROAD_SEGMENTS) {
    const rMinX = Math.min(road.a[0], road.b[0]) - road.width / 2;
    const rMaxX = Math.max(road.a[0], road.b[0]) + road.width / 2;
    const rMinZ = Math.min(road.a[1], road.b[1]) - road.width / 2;
    const rMaxZ = Math.max(road.a[1], road.b[1]) + road.width / 2;
    if (rMaxX < bMinX || rMinX > bMaxX || rMaxZ < bMinZ || rMinZ > bMaxZ) continue;

    for (let index = 0; index < polygon.length; index += 1) {
      nearest = Math.min(nearest, segmentDistance(
        polygon[index], polygon[(index + 1) % polygon.length], road.a, road.b
      ) - road.width / 2);
    }
  }
  return nearest;
}

export function distanceFootprintToRiver(polygon) {
  let nearest = Infinity;
  for (let index = 1; index < SHIBUYA_RIVER.length; index += 1) {
    for (let p = 0; p < polygon.length; p += 1) {
      nearest = Math.min(nearest, segmentDistance(
        polygon[p], polygon[(p + 1) % polygon.length],
        SHIBUYA_RIVER[index - 1], SHIBUYA_RIVER[index]
      ));
    }
  }
  return nearest;
}

export const BUILDINGS = MAP.buildings
  .map((building) => ({
    ...building,
    railwayDistance: distanceToRailwayFootprint(building.polygon),
    roadDistance: distanceFootprintToRoads(building.polygon),
    riverDistance: distanceFootprintToRiver(building.polygon)
  }))
  .filter((building) =>
    polygonInCity(building.polygon)
    && building.railwayDistance >= RAILWAY_CORRIDOR_HALF_WIDTH
    && building.roadDistance >= 0
    && building.riverDistance >= 8);

export function overlapsBuilding(x, z, halfWidth = 0, halfDepth = halfWidth, gap = 0) {
  const radius = Math.hypot(halfWidth, halfDepth) + gap;
  return BUILDINGS.some((building) => distanceToPolygon([x, z], building.polygon) < radius);
}

export function portalPose() {
  const point = routeCurve.getPointAt(PORTAL_U);
  const tangent = routeCurve.getTangentAt(PORTAL_U);
  return { point, yaw: Math.atan2(tangent.x, tangent.z) };
}

export function featuresOutsideBoard() {
  const land = MAP.land;
  const outside = [];
  for (const road of ROAD_SEGMENTS) {
    for (const point of [road.a, road.b]) {
      if (Math.abs(point[0]) > land.halfX || point[1] < land.minZ || point[1] > land.maxZ) {
        outside.push({ kind: "road", x: point[0], z: point[1] });
      }
    }
  }
  for (const building of BUILDINGS) {
    for (const [x, z] of building.polygon) {
      if (Math.abs(x) > land.halfX || z < land.minZ || z > land.maxZ) {
        outside.push({ kind: "building", x, z });
      }
    }
  }
  return outside;
}

export const MAP_METADATA = Object.freeze({
  ...MAP.sources,
  origin: MAP.origin,
  land: MAP.land,
  rim: BOARD_RIM,
  corridor: CITY_CORRIDOR,
  coordinateRule: "One metre per unit; a single projected frame shared by every dataset"
});
