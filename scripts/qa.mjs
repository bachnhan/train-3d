import assert from "node:assert/strict";
import { auditTrackClearance, pointToOrientedRectDistance } from "../src/clearance.mjs";
import { PLATEAU_BLOCKS } from "../src/data/blocks.js";
import { MAP } from "../src/data/map.js";
import { OSM_ROADS } from "../src/data/roads.js";
import {
  distanceToPolygon, segmentDistance, segmentsIntersect
} from "../src/spatial-geometry.mjs";

const straightRoute = Array.from({ length: 21 }, (_, index) => ({
  x: 0,
  z: -1 + index * 0.1
}));
const vehicle = { halfWidth: 0.15, minY: 1.28, maxY: 1.64 };

assert.equal(
  pointToOrientedRectDistance({ x: 0, z: 0 }, {
    x: 0.5, z: 0, width: 0.4, depth: 0.4, yaw: 0
  }),
  0.3,
  "distance uses the nearest footprint edge, not its centre"
);

const oldKosugiDeck = {
  label: "old Kosugi deck",
  x: 0,
  z: 0,
  width: 1.42,
  depth: 0.26,
  yaw: 0,
  minY: 1.5,
  maxY: 1.56
};
assert.equal(
  auditTrackClearance(straightRoute, [oldKosugiDeck], vehicle).violations.length,
  1,
  "a slab crossing the running line at car height must fail"
);

assert.equal(
  auditTrackClearance(straightRoute, [{ ...oldKosugiDeck, minY: 1.72, maxY: 1.77 }], vehicle).violations.length,
  0,
  "an overhead deck above the train envelope must pass"
);

const rotatedBuilding = {
  label: "rotated building",
  x: 0.52,
  z: 0,
  width: 0.36,
  depth: 0.28,
  yaw: Math.PI / 4,
  minY: 1.2,
  maxY: 2
};
assert.equal(
  auditTrackClearance(straightRoute, [rotatedBuilding], vehicle).violations.length,
  0,
  "a rotated footprint outside the vehicle envelope must pass"
);

const climbingRoute = Array.from({ length: 41 }, (_, index) => ({
  x: 0,
  y: index * 0.25,
  z: -2 + index * 0.1
}));
const railRelativeVehicle = { halfWidth: 1.55, railOffsetMin: -0.6, railOffsetMax: 3.8 };

const centrelineMast = {
  label: "catenary mast on the running line",
  x: 0,
  z: 0,
  width: 0.5,
  depth: 0.5,
  yaw: 0,
  minY: 5,
  maxY: 11.6
};
assert.equal(
  auditTrackClearance(climbingRoute, [centrelineMast], railRelativeVehicle).violations.length,
  1,
  "a mast standing on the running line must fail even where the rail head is high"
);

assert.equal(
  auditTrackClearance(climbingRoute, [{ ...centrelineMast, x: 4.7 }], railRelativeVehicle).violations.length,
  0,
  "a mast set beside the running line must pass"
);

assert.equal(
  auditTrackClearance(
    [{ x: 0, y: 0, z: 0 }],
    [{ ...centrelineMast, minY: 4.2, maxY: 4.6 }],
    railRelativeVehicle
  ).violations.length,
  0,
  "a cantilever above the pantograph must pass"
);

const square = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
assert.equal(distanceToPolygon([0, 0], square), 0, "points inside a footprint have zero distance");
assert.equal(distanceToPolygon([3, 0], square), 2, "polygon distance uses its edge");
assert.equal(segmentsIntersect([-1, 0], [1, 0], [0, -1], [0, 1]), true,
  "crossing map segments must intersect");
assert.equal(segmentDistance([-1, 0], [1, 0], [-1, 2], [1, 2]), 2,
  "parallel map segments preserve their separation");

assert.equal(PLATEAU_BLOCKS.buildings.length, 84, "the committed PLATEAU snapshot is complete");
assert.ok(OSM_ROADS.roads.length >= 200, "the committed road snapshot covers both station areas");
for (const road of OSM_ROADS.roads) {
  assert.ok(road.width > 0 && road.points.length >= 2, `${road.id} has renderable geometry`);
  assert.ok(road.points.flat().every(Number.isFinite), `${road.id} contains finite local coordinates`);
}

const land = MAP.land;
const rim = 36;
assert.ok(MAP.buildings.length >= 200, "the unified map has a corridor of footprints");
assert.ok(MAP.roads.length >= 200, "the unified map has a corridor of roads");
for (const building of MAP.buildings) {
  for (const [x, z] of building.polygon) {
    assert.ok(Math.abs(x) <= land.halfX && z >= land.minZ && z <= land.maxZ,
      `${building.id} must sit on the tabletop`);
  }
}
const carriageways = new Set([
  "motorway", "trunk", "primary", "secondary", "tertiary", "residential", "unclassified"
]);
let drawn = 0;
for (const road of MAP.roads) {
  for (const [x, z] of road.points) {
    assert.ok(Math.abs(x) <= land.halfX && z >= land.minZ && z <= land.maxZ,
      `${road.id} must sit on the tabletop`);
  }
  if (carriageways.has(road.highway)) drawn += 1;
}
assert.ok(drawn > 40, "the map still has a network of real carriageways");
assert.ok(rim > 0, "the city is inset from the table rim");

console.log("3D physical QA passed: clearance and sourced-map topology.");
