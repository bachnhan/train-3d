export class SpatialTrackGrid {
  constructor({ cellSize = 2 } = {}) {
    this.cellSize = cellSize;
    this.grid = new Map();
    this.edges = new Map();
  }

  key(x, z) {
    return `${Math.floor(x / this.cellSize)},${Math.floor(z / this.cellSize)}`;
  }

  insert({ x, y = 0, z, tangent = [0, 0, 1], routeOffset = 0, edgeId = null, u = 0 }) {
    const key = this.key(x, z);
    if (!this.grid.has(key)) this.grid.set(key, []);
    const point = { p: [x, y, z], f: tangent, d: routeOffset, edge: edgeId, u };
    this.grid.get(key).push(point);
    if (edgeId) {
      if (!this.edges.has(edgeId)) this.edges.set(edgeId, []);
      this.edges.get(edgeId).push(point);
    }
  }

  sampleCurve(curve, edgeId, spacing = 1.3) {
    const length = curve.getLength();
    const segments = Math.max(2, Math.ceil(length / Math.min(spacing, this.cellSize)));
    let previous = curve.getPointAt(0);
    let distance = 0;
    for (let index = 0; index <= segments; index += 1) {
      const u = index / segments;
      const point = curve.getPointAt(u);
      if (index) distance += point.distanceTo(previous);
      const tangent = curve.getTangentAt(u);
      this.insert({
        x: point.x,
        y: point.y,
        z: point.z,
        tangent: [tangent.x, tangent.y, tangent.z],
        routeOffset: distance,
        edgeId,
        u
      });
      previous = point;
    }
    return distance;
  }

  nearestTrack(x, z, searchRadiusCells = 1, output = null) {
    const gx = Math.floor(x / this.cellSize);
    const gz = Math.floor(z / this.cellSize);
    const best = output || { dist: Infinity, p: null, f: null, edge: null, d: 0, u: 0 };
    best.dist = Infinity;
    best.p = null;
    best.f = null;
    best.edge = null;
    best.d = 0;
    best.u = 0;
    const search = (radius) => {
      for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
        for (let offsetZ = -radius; offsetZ <= radius; offsetZ += 1) {
          const cell = this.grid.get(`${gx + offsetX},${gz + offsetZ}`);
          if (!cell) continue;
          for (const candidate of cell) {
            const distance = Math.hypot(x - candidate.p[0], z - candidate.p[2]);
            if (distance < best.dist) {
              best.dist = distance;
              best.p = candidate.p;
              best.f = candidate.f;
              best.edge = candidate.edge;
              best.d = candidate.d;
              best.u = candidate.u;
            }
          }
        }
      }
    };
    search(searchRadiusCells);
    if (!Number.isFinite(best.dist) && this.grid.size) search(searchRadiusCells + 2);
    if (!best.p) {
      best.p = [x, 0, z];
      best.f = [0, 0, 1];
    }
    return best;
  }

  getEdge(edgeId) {
    return this.edges.get(edgeId) || [];
  }

  size() {
    let count = 0;
    for (const cell of this.grid.values()) count += cell.length;
    return count;
  }
}
