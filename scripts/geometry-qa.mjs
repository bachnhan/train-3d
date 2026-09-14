import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { readFile } from "node:fs/promises";
import { Builder } from "../src/builder.js";
import { SpatialTrackGrid } from "../src/spatial-grid.js";
import { SimulationLoop } from "../src/simulation-loop.js";

function assertBuffer(builder, label) {
  const buffer = builder.toFloat32Array();
  assert.equal(buffer.length % 12, 0, `${label}: buffer must align to 12 floats`);
  for (let offset = 0; offset < buffer.length; offset += 12) {
    for (let index = 0; index < 12; index += 1) {
      assert.ok(Number.isFinite(buffer[offset + index]), `${label}: non-finite value at ${offset + index}`);
    }
    const normalLength = Math.hypot(buffer[offset + 3], buffer[offset + 4], buffer[offset + 5]);
    assert.ok(Math.abs(normalLength - 1) < 1e-5, `${label}: normal is not unit length`);
  }
  const bounds = builder.getAABB();
  assert.ok(bounds.min.every(Number.isFinite) && bounds.max.every(Number.isFinite), `${label}: finite AABB`);
  bounds.min.forEach((minimum, index) => {
    assert.ok(minimum <= bounds.max[index], `${label}: non-inverted AABB`);
  });
  builder.getAssetStats().forEach((asset) => {
    assert.ok(asset.triangles <= 1500, `${asset.label}: ${asset.triangles} triangles exceeds 1500`);
  });
}

const car = new Builder();
car.beginAsset("Series 2026 cab").buildCommuterCar({ length: 12, carType: "cab" }).endAsset();
assertBuffer(car, "Commuter car");
assert.ok(car.getStats().triangleCount <= 800);

const primitives = new Builder();
primitives.beginAsset("primitive regression");
primitives.box(0, 1, 0, 2, 2, 2, "#ffffff");
primitives.cylinder(0, 3, 0, 1, 0.8, 2, "#808080");
primitives.beam([0, 0, 0], [2, 3, 4], 0.1, "#303030");
primitives.arch(0, 0, 0, 4, 0.4, 0.3, "#707070");
primitives.wire([0, 4, 0], [8, 5, 9], 0.03, "#202020");
primitives.endAsset();
assertBuffer(primitives, "Builder primitives");

const horizontalBeam = new Builder();
horizontalBeam.beginAsset("horizontal beam regression");
horizontalBeam.beam([0, 5, 0], [10, 5, 0], 0.1, "#505050");
horizontalBeam.endAsset();
assertBuffer(horizontalBeam, "horizontal beam");
const beamAABB = horizontalBeam.getAABB();
assert.ok(beamAABB.min[0] <= 0 && beamAABB.max[0] >= 10, "beam must span horizontally along X");
assert.ok(beamAABB.min[1] >= 4.8 && beamAABB.max[1] <= 5.2, "horizontal beam must not extend vertically along Y");

const grid = new SpatialTrackGrid({ cellSize: 2 });
for (let z = 0; z <= 20; z += 1.3) {
  grid.insert({ x: 0, z, tangent: [0, 0, 1], routeOffset: z, edgeId: "test" });
}
assert.ok(grid.nearestTrack(0.4, 8.2).dist < 1);

function simulate(frameRate) {
  let distance = 0;
  const loop = new SimulationLoop({
    onUpdate: (delta) => { distance += 12 * delta; },
    onRender: () => {}
  });
  for (let frame = 0; frame < frameRate * 10; frame += 1) loop.advance(1 / frameRate);
  return distance;
}
assert.ok(Math.abs(simulate(30) - simulate(144)) < 1e-5, "60 Hz simulation must be refresh-rate deterministic");

const source = await readFile(new URL("../src/builder.js", import.meta.url));
const gzipBytes = gzipSync(source).byteLength;
assert.ok(gzipBytes < 20 * 1024, `Builder gzip payload ${gzipBytes} exceeds 20 KB`);

console.log(JSON.stringify({
  valid: true,
  stride: 12,
  carTriangles: car.getStats().triangleCount,
  builderGzipBytes: gzipBytes,
  deterministicDistance: simulate(30)
}));
