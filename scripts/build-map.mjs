import { readFile, writeFile } from "node:fs/promises";
import { PLATEAU_BLOCKS } from "../src/data/blocks.js";

// One projection for the whole diorama. Everything -- railway, roads, buildings -- is
// resolved in this single frame, so no dataset can disagree with another about where a
// place is. Metres per degree are held constant across the corridor; over 1.5 km the
// error against a proper projection is far below the 0.1 m we round to.
const METRES_PER_LATITUDE = 111_000;
const METRES_PER_LONGITUDE = 90_300;
const ORIGIN = { lat: 35.6534, lon: 139.7024 };
export const LAND = { halfX: 380, minZ: -720, maxZ: 720 };

// The frames the committed PLATEAU snapshot was baked in. Inverting these recovers the
// original coordinates, so the footprints can be re-projected without the source CityGML.
const LEGACY_STATION_FRAMES = {
  shibuya: { lat: 35.6580, lon: 139.7016, x: -8, z: -300 },
  daikanyama: { lat: 35.6488, lon: 139.7032, x: 0, z: 230 }
};

const ROAD_WIDTHS = {
  motorway: 18, trunk: 16, primary: 14, secondary: 11, tertiary: 9,
  residential: 6, living_street: 4.5, unclassified: 5.5, service: 4, pedestrian: 4.5,
  footway: 3, steps: 3
};
const BUILDING_BUDGET = 2400;
const MIN_BUILDING_AREA = 26;

function project(lat, lon) {
  return [
    Math.round((lon - ORIGIN.lon) * METRES_PER_LONGITUDE * 10) / 10,
    Math.round((ORIGIN.lat - lat) * METRES_PER_LATITUDE * 10) / 10
  ];
}

function unproject(station, [x, z]) {
  const frame = LEGACY_STATION_FRAMES[station];
  return {
    lat: frame.lat - (z - frame.z) / METRES_PER_LATITUDE,
    lon: frame.lon + (x - frame.x) / METRES_PER_LONGITUDE
  };
}

function onBoard([x, z]) {
  return Math.abs(x) <= LAND.halfX && z >= LAND.minZ && z <= LAND.maxZ;
}

function clampToBoard([x, z]) {
  return [
    Math.max(-LAND.halfX, Math.min(LAND.halfX, x)),
    Math.max(LAND.minZ, Math.min(LAND.maxZ, z))
  ];
}

function signedArea(polygon) {
  let total = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const [x1, z1] = polygon[i];
    const [x2, z2] = polygon[(i + 1) % polygon.length];
    total += x1 * z2 - x2 * z1;
  }
  return total / 2;
}

// Collapses the near-duplicate vertices that CityGML and OSM both carry. Each retained
// vertex costs two wall triangles, so this is what keeps the building budget affordable.
function simplify(polygon, tolerance = 0.6) {
  const output = [];
  for (const point of polygon) {
    const last = output.at(-1);
    if (!last || Math.hypot(point[0] - last[0], point[1] - last[1]) > tolerance) {
      output.push(point);
    }
  }
  while (output.length > 3
    && Math.hypot(output[0][0] - output.at(-1)[0], output[0][1] - output.at(-1)[1]) <= tolerance) {
    output.pop();
  }
  return output;
}

function centroid(polygon) {
  return [
    polygon.reduce((sum, p) => sum + p[0], 0) / polygon.length,
    polygon.reduce((sum, p) => sum + p[1], 0) / polygon.length
  ];
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, zi] = polygon[i];
    const [xj, zj] = polygon[j];
    if ((zi > point[1]) !== (zj > point[1])
      && point[0] < (xj - xi) * (point[1] - zi) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

function dist(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

// --- railway -------------------------------------------------------------------------
// The railway corridor here is the pre-2013 elevated railway line. The post-2013 replacement
// dives underground and swings east to meet the subway lines. The elevated heritage route
// this diorama models is modelled here pinned to surveyed station positions.
const SHIBUYA = project(35.6580, 139.7016);
const DAIKANYAMA = project(35.6488, 139.7032);

const alignment = [
  [SHIBUYA[0], 10.8, SHIBUYA[1] - 130],
  [SHIBUYA[0], 10.8, SHIBUYA[1] - 55],
  [SHIBUYA[0], 10.8, SHIBUYA[1]],
  [SHIBUYA[0] + 5, 10.8, SHIBUYA[1] + 80],
  [SHIBUYA[0] + 21, 10.5, SHIBUYA[1] + 210],
  [SHIBUYA[0] + 53, 8.6, SHIBUYA[1] + 390],
  [SHIBUYA[0] + 83, 6.1, SHIBUYA[1] + 550],
  [DAIKANYAMA[0] - 32, 3.6, DAIKANYAMA[1] - 290],
  [DAIKANYAMA[0] - 8, 1.8, DAIKANYAMA[1] - 110],
  [DAIKANYAMA[0], 1.25, DAIKANYAMA[1]],
  [DAIKANYAMA[0] + 4, 1.25, DAIKANYAMA[1] + 90],
  [DAIKANYAMA[0] + 6, 1.25, DAIKANYAMA[1] + 140]
];

// --- roads ---------------------------------------------------------------------------
const roadPath = process.env.ROADS_JSON || new URL("../src/data/roads.json", import.meta.url).pathname;
const roadSource = JSON.parse(await readFile(roadPath, "utf8"));
const roads = [];
for (const way of roadSource.elements) {
  const width = ROAD_WIDTHS[way.tags?.highway];
  if (!width || !Array.isArray(way.geometry) || way.geometry.length < 2) continue;
  if (way.tags.layer && Number(way.tags.layer) < 0) continue;
  if (way.tags.tunnel) continue;
  const points = simplify(way.geometry.map((p) => project(p.lat, p.lon)), 1.5);
  // Split where a way leaves the board so the remainder still draws, rather than being
  // clamped into a false straight line along the edge.
  let run = [];
  for (const point of points) {
    if (onBoard(point)) {
      run.push(point);
    } else {
      if (run.length >= 2) roads.push({ way, width, points: run });
      run = [];
    }
  }
  if (run.length >= 2) roads.push({ way, width, points: run });
}

const roadOutput = roads.map(({ way, width, points }, index) => ({
  id: `osm-${way.id}-${index}`,
  highway: way.tags.highway,
  name: way.tags.name || null,
  width,
  points
}));

// --- buildings -------------------------------------------------------------------------
const plateau = [];
for (const building of PLATEAU_BLOCKS.buildings) {
  const polygon = simplify(
    building.points.map((point) => {
      const { lat, lon } = unproject(building.station, point);
      return project(lat, lon);
    })
  );
  if (polygon.length < 3 || !polygon.every(onBoard)) continue;
  if (Math.abs(signedArea(polygon)) < MIN_BUILDING_AREA) continue;
  plateau.push({
    id: building.id,
    source: "plateau",
    height: building.height,
    storeys: building.storeys > 0 && building.storeys < 60 ? building.storeys : null,
    usage: building.usage,
    polygon
  });
}

function osmHeight(tags, area) {
  const explicit = Number.parseFloat(tags["height"] ?? tags["building:height"]);
  if (Number.isFinite(explicit)) return explicit;
  const levels = Number.parseFloat(tags["building:levels"]);
  if (Number.isFinite(levels)) return levels * 3.1;
  return area > 900 ? 22 : area > 300 ? 14 : 8.5;
}

const buildingPath = process.env.BUILDINGS_JSON || new URL("../src/data/blocks.json", import.meta.url).pathname;
const buildingSource = JSON.parse(await readFile(buildingPath, "utf8"));
const osmCandidates = [];
for (const way of buildingSource.elements) {
  if (!Array.isArray(way.geometry) || way.geometry.length < 4) continue;
  const polygon = simplify(way.geometry.map((p) => project(p.lat, p.lon)));
  if (polygon.length < 3 || !polygon.every(onBoard)) continue;
  const area = Math.abs(signedArea(polygon));
  if (area < MIN_BUILDING_AREA) continue;
  osmCandidates.push({
    id: `osm-${way.id}`,
    source: "osm",
    height: osmHeight(way.tags, area),
    storeys: Number.parseFloat(way.tags["building:levels"]) || null,
    usage: way.tags.building,
    polygon,
    area
  });
}

// PLATEAU carries surveyed heights, so it wins wherever the two sources describe the same
// structure. OSM only fills the corridor between the two station neighbourhoods.
const plateauCentroids = plateau.map((building) => ({
  centre: centroid(building.polygon), polygon: building.polygon
}));
const deduped = osmCandidates.filter((candidate) => {
  const centre = centroid(candidate.polygon);
  return !plateauCentroids.some((existing) =>
    pointInPolygon(centre, existing.polygon)
    || pointInPolygon(existing.centre, candidate.polygon)
    || dist(centre, existing.centre) < 4);
});
deduped.sort((a, b) => b.area - a.area);
const osmKept = deduped.slice(0, Math.max(0, BUILDING_BUDGET - plateau.length))
  .map(({ area, ...building }) => building);

const buildings = [...plateau, ...osmKept];

const output = {
  sources: {
    buildings: "Project PLATEAU Shibuya-ku 2025 (CC BY 4.0) and OpenStreetMap contributors (ODbL 1.0)",
    roads: "OpenStreetMap contributors, ODbL 1.0",
    railway: "Pre-2013 elevated railway alignment, locally modelled and pinned to surveyed station positions"
  },
  origin: ORIGIN,
  metresPerDegree: { latitude: METRES_PER_LATITUDE, longitude: METRES_PER_LONGITUDE },
  land: LAND,
  stations: [
    { id: "shibuya", code: "TY01", point: SHIBUYA },
    { id: "daikanyama", code: "TY02", point: DAIKANYAMA }
  ],
  alignment,
  roads: roadOutput,
  buildings
};

const json = JSON.stringify(output);
await Promise.all([
  writeFile("src/data/map.json", `${json}\n`),
  writeFile("src/data/map.js", `export const MAP = ${json};\n`)
]);
const vertices = buildings.reduce((sum, building) => sum + building.polygon.length, 0);
console.log(JSON.stringify({
  alignment: alignment.length,
  roads: roadOutput.length,
  roadSegments: roadOutput.reduce((sum, road) => sum + road.points.length - 1, 0),
  buildings: buildings.length,
  plateau: plateau.length,
  osm: osmKept.length,
  buildingVertices: vertices,
  estimatedBuildingTriangles: buildings.reduce(
    (sum, b) => sum + (b.polygon.length - 2) + b.polygon.length * 2, 0
  ),
  bytes: json.length
}, null, 2));
