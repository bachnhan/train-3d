/**
 * Reference Implementation: O(1) 2D Spatial Hash Grid for Railway Track Snapping
 * 
 * Implements an O(1) trackGrid & nearestTrack pattern for railway rolling stock snapping.
 * 
 * Invariant: Track curves and straight segments must be discretized into point samples
 * spaced no further apart than `cellSize` (default <= 2.0m) to guarantee that any query
 * within the neighborhood finds a valid track candidate without skipping empty cells.
 */

class SpatialTrackGrid {
  constructor({ cellSize = 2.0 } = {}) {
    this.cellSize = cellSize;
    this.grid = new Map(); // key -> Array of points
  }

  _key(gx, gz) {
    return `${gx},${gz}`;
  }

  insert({ x, y = 0, z, tangent = [0, 0, 1], routeOffset = 0, edgeId = null }) {
    const gx = Math.floor(x / this.cellSize);
    const gz = Math.floor(z / this.cellSize);
    const key = this._key(gx, gz);

    if (!this.grid.has(key)) {
      this.grid.set(key, []);
    }

    this.grid.get(key).push({
      p: [x, y, z],
      f: tangent,
      d: routeOffset,
      edge: edgeId
    });
  }

  nearestTrack(x, z, searchRadiusCells = 1) {
    const gx = Math.floor(x / this.cellSize);
    const gz = Math.floor(z / this.cellSize);

    let best = {
      dist: Infinity,
      p: [x, 0, z],
      f: [0, 0, 1],
      edge: null,
      d: 0
    };

    // Primary search: inspect (2*searchRadiusCells + 1)^2 neighborhood (default 3x3 = 9 cells)
    const searchNeighborhood = (radius) => {
      for (let j = -radius; j <= radius; j++) {
        for (let i = -radius; i <= radius; i++) {
          const key = this._key(gx + i, gz + j);
          const cell = this.grid.get(key);
          if (cell) {
            for (let k = 0; k < cell.length; k++) {
              const candidate = cell[k];
              const dist = Math.hypot(x - candidate.p[0], z - candidate.p[2]);
              if (dist < best.dist) {
                best = {
                  dist,
                  p: candidate.p,
                  f: candidate.f,
                  edge: candidate.edge,
                  d: candidate.d
                };
              }
            }
          }
        }
      }
    };

    searchNeighborhood(searchRadiusCells);

    // Fallback: If no candidate was found in immediate 3x3 cells, expand search radius by 2 cells
    if (!Number.isFinite(best.dist) && this.grid.size > 0) {
      searchNeighborhood(searchRadiusCells + 2);
    }

    return best;
  }

  /**
   * Helper: Discretize a circular or oval board-game loop with named station stops.
   * Inserts waypoints at uniform angle intervals <= cellSize to satisfy the sampling invariant.
   * @param {object} opts
   * @param {number} opts.radiusX - Half-width of the oval in X (meters)
   * @param {number} opts.radiusZ - Half-depth of the oval in Z (meters)
   * @param {number} opts.segments - Number of discrete waypoints
   * @param {Array<{name:string, stationId:string, angle:number}>} opts.stations - Named stop positions
   */
  generateLoop({ radiusX = 25, radiusZ = 25, segments = 120, stations = [] } = {}) {
    let cumulativeDist = 0;
    let prevX = radiusX;
    let prevZ = 0;

    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const x = Math.cos(theta) * radiusX;
      const z = Math.sin(theta) * radiusZ;

      if (i > 0) {
        cumulativeDist += Math.hypot(x - prevX, z - prevZ);
      }
      prevX = x;
      prevZ = z;

      const tx = -Math.sin(theta) * radiusX;
      const tz = Math.cos(theta) * radiusZ;
      const tLen = Math.hypot(tx, tz) || 1;
      const tangent = [tx / tLen, 0, tz / tLen];

      let stationId = null;
      for (const st of stations) {
        const angleDiff = Math.abs((theta % (Math.PI * 2)) - (st.angle % (Math.PI * 2)));
        if (angleDiff < (Math.PI * 2) / segments / 2) {
          stationId = st.stationId;
          break;
        }
      }

      this.insert({ x, y: 0, z, tangent, routeOffset: cumulativeDist, edgeId: 'track-loop-main', stationId });
    }
  }

  clear() {
    this.grid.clear();
  }

  size() {
    let count = 0;
    for (const cell of this.grid.values()) {
      count += cell.length;
    }
    return count;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SpatialTrackGrid };
}
// ESM named export for direct import in Next.js / bundlers
export { SpatialTrackGrid };
if (typeof window !== 'undefined') {
  window.SpatialTrackGrid = SpatialTrackGrid;
}
