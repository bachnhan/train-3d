import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";

const inputs = process.argv.slice(2);
if (inputs.length !== 2) {
  console.error("Usage: node scripts/extract-osm-roads.mjs <shibuya.json> <daikanyama.json>");
  process.exit(1);
}

const STATIONS = [
  { id: "shibuya", lat: 35.6580, lon: 139.7016, x: -8, z: -300 },
  { id: "daikanyama", lat: 35.6488, lon: 139.7032, x: 0, z: 230 }
];
const METRES_PER_LATITUDE = 111_000;
const METRES_PER_LONGITUDE = 90_300;
const KEEP_RADIUS = 210;
const WIDTHS = {
  motorway: 18,
  trunk: 16,
  primary: 14,
  secondary: 11,
  tertiary: 9,
  residential: 6.5,
  living_street: 5,
  unclassified: 6,
  service: 4.5,
  pedestrian: 5
};

function localPoint(station, point) {
  return [
    Math.round((station.x + (point.lon - station.lon) * METRES_PER_LONGITUDE) * 10) / 10,
    Math.round((station.z + (station.lat - point.lat) * METRES_PER_LATITUDE) * 10) / 10
  ];
}

const roads = [];
for (let index = 0; index < inputs.length; index += 1) {
  const station = STATIONS[index];
  const source = JSON.parse(await readFile(inputs[index], "utf8"));
  for (const way of source.elements) {
    const highway = way.tags?.highway;
    const width = WIDTHS[highway];
    if (!width || !Array.isArray(way.geometry) || way.geometry.length < 2) continue;
    const points = way.geometry
      .map((point) => localPoint(station, point))
      .filter(([x, z]) => Math.hypot(x - station.x, z - station.z) <= KEEP_RADIUS);
    if (points.length < 2) continue;
    roads.push({
      id: `osm-${way.id}-${station.id}`,
      station: station.id,
      highway,
      name: way.tags.name || null,
      width,
      points
    });
  }
}

const output = {
  source: "OpenStreetMap contributors, ODbL 1.0",
  fetched: "2026-09-10",
  sourceFiles: inputs.map((input) => basename(input)),
  transform: "Same local station metre frames as the PLATEAU building footprints",
  roads
};
const json = JSON.stringify(output);
await Promise.all([
  writeFile("src/data/roads.json", `${json}\n`),
  writeFile("src/data/roads.js", `export const OSM_ROADS = ${json};\n`)
]);
console.log(`Wrote ${roads.length} road ways`);
