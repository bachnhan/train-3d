# Contributing to Tokyo 3D

Thank you for your interest in contributing to Tokyo 3D! We welcome improvements to procedural geometry, vehicle kinematics, atmospheric weather shaders, accessibility, and performance optimizations.

---

## Architectural Overview

- **Engine**: Zero-dependency vanilla ES modules with Three.js r125.
- **Geometry Pipeline**: 12-float interleaved procedural `Builder` buffers (`[x, y, z, nx, ny, nz, r, g, b, matId, u, v]`).
- **Kinematics**: Deterministic 60 Hz fixed accumulator loop (`src/simulation-loop.js`).
- **Audio**: 100% synthesized Web Audio API (zero external sound downloads).
- **Accessibility**: Semantic 2D HTML twin (`accessible-twin.js`) synchronized with WebGL camera framing.

---

## Development Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/bachnhan/train-3d.git
   cd train-3d
   ```

2. **Start the local server**:
   ```bash
   npm start
   # Starts python3 -m http.server on port 8008
   # Open http://localhost:8008/index.html
   ```

3. **Run the automated QA test suite**:
   ```bash
   npm test
   # Runs: node scripts/qa.mjs && node scripts/geometry-qa.mjs
   ```

---

## Core Performance Budgets & Quality Gates

All contributions must strictly adhere to the following budgets:

| Metric | Budget Limit | Current Benchmark |
| :--- | :--- | :--- |
| **Total Builder Triangles** | $\le 420,000$ | ~332,000 |
| **Max Triangles Per Asset** | $\le 1,500$ | 1,392 |
| **WebGL Draw Calls** | $\le 60$ | 13–26 |
| **Estimated VRAM** | $\le 256\text{ MB}$ | ~80 MB |
| **Clearance Violations** | **0** | 0 |
| **Browser Console Errors** | **0** | 0 |

---

## Cache-Busting Rule (Important)

Because Tokyo 3D uses native ES module imports via `<script type="importmap">` in `index.html` with zero bundlers:
- **Whenever you modify files in `src/*` or `css/*`, you must bump all `?v=N` query strings in `index.html` simultaneously.**
- This ensures browsers do not serve stale cached module versions during development and review.

---

## Contributor Task Router

You can explore task categories and run recipe-guided verification via:
```bash
npm run contribute -- --list
```
