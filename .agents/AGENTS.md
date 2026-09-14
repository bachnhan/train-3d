# Agent Guide — Tokyo 3D (Procedural Multi-Vehicle Urban Simulation & Diorama)

Zero-dependency procedural Three.js / WebGL multi-vehicle urban simulation and diorama platform. Features procedural geometry batching, multi-modal vehicle kinematics (Series 2026 commuter train, commercial airliner, Shibuya River patrol boat, city buses, taxis, and walking pedestrians), dynamic atmospheric weather (clear, sunset, night, rain, snow, storm with lightning), synthesized Web Audio, geographic GIS terrain integration (PLATEAU & OpenStreetMap), and accessible screen-reader navigation.

## Stack at a Glance

| Area | Detail |
|------|--------|
| Type | Vanilla ES modules; No bundler; `python3 -m http.server 8008` |
| Web3D | Three.js r125; 12-float interleaved procedural `Builder` buffers; ACES tone mapping |
| Kinematics | Multi-vehicle tracking (rail, airspace, waterway, road network); 60Hz fixed accumulator loop |
| Audio | Zero asset downloads; synthesized Web Audio (VVVF inverter, flange squeal, rail joints, rain & storm thunder) |
| Weather | Real-time atmospheric simulation (sun, sunset glow, night city lights, rain, snow, dynamic lightning) |
| A11y | `accessible-twin.js`: Semantic 2D HTML navigation twin with ARIA live regions |
| GIS Data | Project PLATEAU Shibuya-ku 2025 (CC BY 4.0) + OpenStreetMap (ODbL 1.0) |

**Key paths:** `index.html`, `css/train-3d.css`, `src/*`, `scripts/*`, `package.json`, `README.md`.

## Core Rules & Verification Gates

1. **Strict Performance Budgets**:
   - Total builder triangles $\le 420,000$ (enhanced high-graphic target).
   - Maximum triangles per individual asset $\le 1,500$.
   - Draw calls $\le 60$ (currently 12–30).
   - Estimated VRAM $\le 256\text{ MB}$.
   - Loading gauge clearance violations: **0**.
   - Browser console errors: **0**.
2. **Mandatory QA Gates Before Proposing Changes**:
   ```bash
   npm test
   # Runs:
   # node scripts/qa.mjs
   # node scripts/geometry-qa.mjs
   ```
3. **In-Browser Verification**:
   - Start server: `npm start` (port 8008).
   - Navigate to `http://localhost:8008/index.html?v=N`.
   - Run `window.run_qa()` (or `window.run_demo3d_qa()`) in DevTools console to audit clearance, non-uniform scales, and triangle bounds.
4. **Cache Busting**:
   - Bump every `?v=N` in the `index.html` Import Map together whenever modifying `src/*` modules or `css/*`.
5. **Git Commit Rule**:
   - **Never run `git commit` without explicit human request.**

## Skill Map (`.agents/skills/`)

- `web3d-engineering`: Three.js / WebGL performance runbook, 60fps budgets, loading gauge clearances.
- `web3d-workflow`: Cyclical state-machine orchestrator for 3D web simulations.
- `procedural-mesh-builder`: Low-poly procedural geometry generator using Float32Array builders.
- `spatial-track-solver`: 2D spatial hash grid for track queries and rolling stock alignment.
- `resilient-web-audio`: Production-resilient Web Audio graph with user-gesture unlock.
- `accessible-diorama-ui`: Accessible 2D HTML twin and camera framing synchronization.
- `headless-geometry-qa`: Headless Node.js geometry testing.
- `agent-task-router`: Recipe and test map for contributor governance (`node scripts/contribute-3d.mjs`).
