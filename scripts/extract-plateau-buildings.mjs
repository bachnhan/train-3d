import { createReadStream } from "node:fs";
import { writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { createInterface } from "node:readline";

const sources = process.argv.slice(2);
if (!sources.length) {
  console.error("Usage: node scripts/extract-plateau-buildings.mjs <PLATEAU bldg.gml> [...]");
  process.exit(1);
}

const STATIONS = [
  { id: "shibuya", lat: 35.6580, lon: 139.7016, x: -8, z: -300 },
  { id: "daikanyama", lat: 35.6488, lon: 139.7032, x: 0, z: 230 }
];
const METRES_PER_LATITUDE = 111_000;
const METRES_PER_LONGITUDE = 90_300;
const KEEP_RADIUS = 185;
const KEEP_PER_STATION = 42;

function extractTag(xml, tag) {
  return xml.match(new RegExp(`<bldg:${tag}(?: [^>]*)?>([^<]+)</bldg:${tag}>`))?.[1] || null;
}

function extractBuilding(xml) {
  const id = xml.match(/<bldg:Building gml:id="([^"]+)"/)?.[1];
  const roofEdge = xml.match(/<bldg:lod0RoofEdge>[\s\S]*?<gml:posList>([^<]+)<\/gml:posList>/)?.[1];
  if (!id || !roofEdge) return null;
  const numbers = roofEdge.trim().split(/\s+/).map(Number);
  const geographic = [];
  for (let index = 0; index + 2 < numbers.length; index += 3) {
    geographic.push([numbers[index], numbers[index + 1]]);
  }
  if (geographic.length > 1) {
    const first = geographic[0];
    const last = geographic.at(-1);
    if (first[0] === last[0] && first[1] === last[1]) geographic.pop();
  }
  if (geographic.length < 3) return null;
  const centroid = geographic.reduce((sum, point) => [sum[0] + point[0], sum[1] + point[1]], [0, 0])
    .map((value) => value / geographic.length);
  let station = STATIONS[0];
  let nearest = Infinity;
  for (const candidate of STATIONS) {
    const x = (centroid[1] - candidate.lon) * METRES_PER_LONGITUDE;
    const z = (candidate.lat - centroid[0]) * METRES_PER_LATITUDE;
    const distance = Math.hypot(x, z);
    if (distance < nearest) {
      nearest = distance;
      station = candidate;
    }
  }
  if (nearest > KEEP_RADIUS) return null;
  const points = geographic.map(([lat, lon]) => [
    Math.round((station.x + (lon - station.lon) * METRES_PER_LONGITUDE) * 10) / 10,
    Math.round((station.z + (station.lat - lat) * METRES_PER_LATITUDE) * 10) / 10
  ]);
  return {
    id,
    station: station.id,
    distance: Math.round(nearest * 10) / 10,
    height: Math.round((Number(extractTag(xml, "measuredHeight")) || 7) * 10) / 10,
    storeys: Number(extractTag(xml, "storeysAboveGround")) || null,
    usage: extractTag(xml, "usage"),
    points
  };
}

async function parseFile(path) {
  const input = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
  const buildings = [];
  let collecting = false;
  let xml = "";
  for await (const line of input) {
    if (!collecting && line.includes("<bldg:Building ")) {
      collecting = true;
      xml = line;
    } else if (collecting) {
      xml += `\n${line}`;
    }
    if (collecting && line.includes("</bldg:Building>")) {
      const building = extractBuilding(xml);
      if (building) buildings.push(building);
      collecting = false;
      xml = "";
    }
  }
  console.log(`${basename(path)}: selected ${buildings.length} corridor buildings`);
  return buildings;
}

const candidates = (await Promise.all(sources.map(parseFile))).flat();
const selected = STATIONS.flatMap((station) =>
  candidates
    .filter((building) => building.station === station.id)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, KEEP_PER_STATION)
);

const output = {
  source: "Project PLATEAU Shibuya-ku 2025, building LOD0/LOD1, CC BY 4.0",
  sourceMeshes: sources.map((source) => basename(source)),
  transform: "True local metre offsets around each station; inter-station distance selectively compressed",
  buildings: selected
};
const json = JSON.stringify(output);
await Promise.all([
  writeFile("src/data/blocks.json", `${json}\n`),
  writeFile("src/data/blocks.js", `export const PLATEAU_BLOCKS = ${json};\n`)
]);
console.log(`Wrote ${selected.length} buildings to src/data/blocks.json`);
