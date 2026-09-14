---
name: spatial-track-solver
description: >-
  Implements an O(1) 2D spatial hash grid for rapid nearest-track queries, vehicle snapping,
  route progress tracking, and tangent vector derivation along complex railway networks.
  Use when calculating vehicle placement on tracks, snapping rolling stock to rails, or querying rail junctions.
---

# Spatial Track Solver Skill

This skill provides the O(1) spatial hash grid used by Train 3D (`src/spatial-grid.js`). This SKILL.md and `references/spatial_grid.js` are the runnable counterpart for headless Node.js QA and agent guidance.

---

## When to Use

- Snapping moving trains, bogies, or cars to the nearest track centerline.
- Raycasting user pointer clicks against rail networks.
- Querying track tangent vectors ($\mathbf{f}$) and elevation ($y$) at arbitrary world $(x, z)$ coordinates.
- Route finding and switch point (turnout) branch detection.

## Not For

- General 3D physics collision detection (rigid-body mesh collision) — use Rapier, Cannon, or Ammo.js.
- NavMesh pathfinding for free-roaming humanoid characters.

---

## Core Architecture

Instead of evaluating spline distances against every segment:
1. Rail networks are discretized into point/tangent samples along track segments.
2. Samples are bucketed into a **2D Spatial Hash Grid** with cell size $S = 2.0\text{ m}$:
   $$\text{cellKey} = \left\lfloor \frac{x}{S} \right\rfloor + ',' + \left\lfloor \frac{z}{S} \right\rfloor$$
3. Querying `nearestTrack(x, z)` inspects only the $3\times 3$ cell neighborhood (9 buckets), yielding $O(1)$ lookup times.

See the complete reference implementation:
👉 [references/spatial_grid.js](./references/spatial_grid.js)

---

## Quick Start Example

```javascript
import { SpatialTrackGrid } from '.agents/skills/spatial-track-solver/references/spatial_grid.js';
// In Next.js (TypeScript): import { SpatialTrackGrid } from '@/lib/3d';

// 1. Create grid with 2-meter buckets
const trackGrid = new SpatialTrackGrid({ cellSize: 2.0 });

// 2. Populate track waypoints (or sample from splines)
trackGrid.insert({
  x: 10.0,
  y: 0.5,
  z: 15.0,
  tangent: [1, 0, 0], // direction vector
  routeOffset: 124.5,  // distance along route
  edgeId: 'mainline-track-1'
});

// 3. Query nearest track to any world coordinate in O(1)
const query = trackGrid.nearestTrack(10.2, 15.1);

console.log(`Nearest distance: ${query.dist.toFixed(3)} m`);
console.log(`Snap point: [${query.p[0]}, ${query.p[1]}, ${query.p[2]}]`);
console.log(`Tangent vector: [${query.f[0]}, ${query.f[1]}, ${query.f[2]}]`);
console.log(`Route progress: ${query.d} m`);
```

---

## Verification & Performance Invariants

* **Sampling Density Invariant:** Track waypoints must be discretized and inserted at intervals $\le \text{cellSize}$ (e.g. 1.0m to 2.0m). This guarantees that spatial hash buckets remain contiguously populated along the entire rail corridor with zero missed boundary queries.
* **Time Complexity:** Query time is strictly $O(1)$ within the local $3\times 3$ bucket neighborhood regardless of whether the total network has 10 tracks or 100,000 tracks.
* **Deterministic Tie-Breaking:** In the event of coincident junctions, the solver preserves insertion candidate ordering.
