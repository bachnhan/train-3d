---
type: plan
title: "Train 3D Simulation Web3D Workflow"
description: "FSM-governed implementation record for the heritage Shibuya–Daikanyama procedural diorama."
tags: [train-3d, three.js, web3d, geometry, accessibility]
status: stable
audience: [developer, designer, agent]
---

# Train 3D Simulation Web3D Workflow

**Scope:** [`index.html`](../index.html) and `src/*`. Not the play-screen spinner.

**Benchmark:** High-performance procedural craft under strict Web3D mobile budgets.

**Workflow:** `.agents/skills/web3d-workflow`: `SPEC_BLOCKOUT → KINEMATICS → SENSORY_A11Y → QA_AUDIT → GOVERNANCE`.

---

## Current state

- Scope narrowed from 21 stations to heritage **TY01 Shibuya–TY02 Daikanyama**.
- `1 unit = 1 metre`; gauge `1.435 m`; platform height `1.1 m`; camera FOV `20°`.
- `src/builder.js` emits 12-float interleaved procedural geometry and batches it into four material meshes.
- One baked map frame in `src/data/map.js`: PLATEAU + OSM footprints, OSM carriageways, heritage railway pinned to surveyed TY01/TY02. `map-model.js` is the placement authority.
- Four-track Shibuya terminal, partial triangulated barrel vault, dual-track viaduct, Daikanyama through platforms and portal are authored procedurally.
- Real map terrain features added: Shibuya River (渋谷川) concrete canal with retaining walls and water channel; heritage steel through-truss bridge superstructure at Namikibashi in railway green.
- Iconic surveyed landmarks: Shibuya Scramble Square with Shibuya Sky observation crown, Cerulean Tower with curved curtain wall and helipad, Daikanyama Address Tower (36-storey residential tower with retail podium and stepped penthouse), and Shibuya Scramble zebra crossings with department store bands.
- Telephoto landmark camera navigation (`cameraController.focusLandmark()`) with calibrated offsets and station card info locking.
- Two three-car commuter trains run on separate tracks with dual-bogie chord placement and a deterministic 60 Hz accumulator.
- Gesture-gated procedural motor/whistle audio and a keyboard/screen-reader canvas twin are installed.
- Browser audit: 26 draw calls, 98,184 triangles, 67.2 MB VRAM, zero clearance / road / railway / off-board violations, Series 2026 commuter cab (720 tris <= 800) with Incubation White smile face, single-arm pantograph contacting 4.8 m catenary wire, SmoothOffsetCurve kinematics eliminating forward-backward shaking, overhauled Shibuya River canal crossings with continuous bank-to-bank decks, stone newels (親柱), lane markings, clean railing gap openings, and orthonormal basis `Builder.beam` resolving horizontal catenary cantilever orientation and eliminating all vertical overhead stick intrusions into the train envelope.

---

## Target

A **heritage model railway**, not a symbolic whole-line map:

- the pre-2013 elevated Shibuya terminal and Daikanyama approach;
- real Japanese block placement from PLATEAU, with procedural facade interpretation;
- Web3D budgets that hold at 320 px, 390 px and desktop;
- deterministic train operation with accessible non-canvas controls.

---

## Constraints

- One post effect maximum; currently none. `PCFSoftShadowMap` measured ~33 ms vs ~0.7 ms PCF.
- Do not recast the train into the baked shadow map.
- Cache-bust: bump every `index.html` import-map `?v=` together after each slice that changes `src/*`.
- Every named building/asset is at most 800 triangles; mobile draw calls at most 50; estimated active VRAM at most 128 MB.
- FPS: judge in a **normal browser tab**, not embedded webview developer tools.

---

## Historical full-line iterations

The following completed P0–P4 record predates the two-station Web3D rebuild and is retained for provenance.

## Task 1 — P0 Lighting and tone mapping (complete)

Reviewed 2026-09-10: ACES, three workshop lamps, softer key, matching fog. Ride, baked PCF shadows, and the train contact plane survive. No post effect. Room camera is still distance 24 — surfaces will not read there; that is Task 4. P0 is closed; the remaining cheap look is materials, not lights.

**Acceptance:** Room still looks like a photograph of a model, not a default Three.js scene. Table and train edges have contact contrast. Landmarks in the middle of the board do not dissolve into fog.

**Files:** `src/scene.js`, `src/main.js`, `index.html` (`?v=`).

**Scope:** S

1. Key: keep `0xffe4c4`–`0xfff0d2`, slightly lower the light. Keep 2048 shadow map, baked, PCF (not PCFSoft).
2. Add 2–3 warm `PointLight`s over the table (workshop lamps), short distance, quadratic falloff.
3. `renderer.toneMapping = THREE.ACESFilmicToneMapping` (r125 has it). `toneMappingExposure` ~0.9–1.15.
4. One cheap fullscreen vignette/grain quad **or** skip post if ACES + lamps are enough.
5. Fog color matches background; lower density.

**Verification:**

- [ ] Manual: `python3 -m http.server 8008` — room, Tamagawa, cab. No blown whites, no muddy mid-board.
- [ ] Cache-bust: all `index.html` `?v=` bumped together.
- [ ] Screenshot: room **after P0** vs current (store beside this doc or in `progress.md`).

**Dependencies:** none.

**Checkpoint:** ride still works; baked shadows still static; train contact plane still visible.

---

## Task 2 — P1 Two procedural materials (complete)

Implemented in cache version 29: world-space masonry, timber, field, and water patterns on `MeshStandardMaterial`. Field plots sit flush, use a darker palette, and pick up furrow noise so they no longer read as paper. Water uses a shared timed uniform for a slow wave.

**Acceptance:** Cab or trackside still shows pattern on platforms and the oak table, not flat fill. Field plots read as farmland, not as loose paper sheets on the grass.

**Files:** new `src/materials.js`; wire from `src/layout.js`, `src/scene.js`; `index.html`.

**Scope:** M

Do **not** write monolithic custom fragment shaders. Ship two `ShaderMaterial`s **or** Canvas-textured `MeshStandardMaterial`s:

| ID | Use | Minimum |
|----|-----|---------|
| Masonry | retaining, platforms, some towers | repeating brick/mortar from UV or world XZ |
| Timber | table top, sleepers, shop fronts | grain along one axis |

Water: slow UV scroll or vertex sine on existing river/bay boxes. Glass: keep metalness/roughness.

Field plots (`addPlots` in `src/scene.js`) are the third surface to fix here. They currently read as cut paper for three reasons, all cheap to correct alongside the material work:

- They float. Each is a `0.012`-tall box at `GROUND_Y + 0.004` plus up to `0.005` of random jitter, so plots stack visibly where they overlap. The jitter exists only to avoid z-fighting; a shared height plus explicit `renderOrder` or `polygonOffset` removes both problems.
- The palette is brighter than the ground. `PLOT_COLORS` reaches `0x93a06a` against land slabs of `0x6f8f63` / `0x74945f`, so plots advance instead of receding.
- They are untextured flat fill with hard straight edges. A field texture or a soft edge is what actually sells them.

**Verification:**

- [ ] Manual: trackside + cab — brick/grain readable; instancing still works (do not explode draw calls).
- [ ] Cache-bust import map includes `./src/materials.js`.
- [ ] Real-tab fps still ≥45 in room view.

**Dependencies:** Task 1 (close camera + ACES so the pattern is visible).

---

## Task 3 — P2 Authored landmarks and train kit (complete)

Landed at `?v=33`. Shibuya gained floor bands, two lit screens, a Hachiko plinth and 26 crowd
figures on the scramble. Jiyugaoka gained a plaza clock, benches and lit shop windows. A new
`addTamagawa` puts a shelter, bench row and picnic figures on the floodplain. Musashi-Kosugi
towers gained crowns, antennae, balcony bands, a podium and a link deck. Yokohama gained tower
bands, a stepped bayside hotel and window rows on the brick warehouses. Station houses gained a
platform canopy and two lit panes. The train gained five window panes a side, roof ribs, bogie
frames and a destination curtain. Suburb attempts cut 620 → 430.

Two corrections made during verification, both worth keeping in mind:

- Masonry on the Kosugi towers read as brick chimneys. Removed; the balcony bands carry the
  facade instead. Masonry stays on platforms, retaining walls and the brick warehouses.
- The car body used `metalness: 0.65`. With no environment map in the scene a high metalness
  renders near black, so the whole train read dark grey rather than stainless. Now `0.18`.

Mobile 390 clips the camera row, but `.camera-panel` is `overflow-x: auto` by design and Cab is
reachable by scrolling. Not a bug.

**Acceptance:** Shibuya, Jiyugaoka, Tamagawa, Musashi-Kosugi, Yokohama identifiable without HUD labels. Train reads as a modern Series 2026 commuter set from trackside.

**Files:** `src/scene.js` landmark functions + suburb counts; `src/layout.js` station houses; `src/train.js`; `index.html`.

**Scope:** M (split to 3a landmarks / 3b train if the diff exceeds ~5 files of real change)

1. Cut suburb instances ~30–40% **after** landmarks are denser.
2. Each of the five landmarks: 8–20 primitives (window insets, canopy, sign, one tree cluster).
3. Station houses: canopy slab + two window panes.
4. Train: window panes (not one slab), destination curtain, two bogie boxes per car, roof ribs. Still primitives. Keep contact plane.

**Verification:**

- [x] Manual: five landmark buttons + trackside. Cab not inside the car.
- [x] Desktop 1280×800 and 390-wide: HUD still usable (`progress.md` mobile pass).
- [x] JA and EN (`?lang=en`).

**Dependencies:** Task 2 (masonry on platforms/towers).

---

## Task 4 — P3 Ground and room camera (complete)

Landed at `?v=36`. Two paired cutting runs now follow the route at progress `0.17–0.29`
and `0.54–0.66`. Each side rises from `GROUND_Y + 0.012` at a `0.34` offset to
`GROUND_Y + 0.26` at `0.78`, keeping the rails and train clear while breaking the flat
tabletop silhouette. The layout camera pitch changed `1.3 → 1.05` so the slopes remain
visible in the overview.

The room orbit now starts and resets at distance `14` instead of `24–25`. Camera position
is initialized from the orbit before the first frame, avoiding a slow fly-in from the old
wide shot.

**Acceptance:** Layout view shows at least one slope or cutting. Default room shot fills train + nearest town, not the whole line.

**Files:** `src/scene.js` land; `src/cameras.js`; `index.html`.

**Scope:** S

1. Coarse height grid (even 8×20) or a few berms along the track so the rail sits in a cutting.
2. Room orbit distance 14–18 (from 24). Do not change cab/trackside unless they clip.

**Verification:**

- [x] Manual: room + layout; train still on rails; no camera in geometry.
- [x] Cache-bust.

**Dependencies:** Task 3 (otherwise a closer room camera stares at scatter boxes).

---

## Task 5 — P4 Physical QA and water depth (complete)

Landed at `?v=39`.

- [`src/clearance.mjs`](../src/clearance.mjs) measures route distance against rotated
  footprint edges and ignores structures outside the train's vertical envelope.
- `window.run_qa()` audits the actual generated scene. The first verified run checked
  262 building, awning and Kosugi structure footprints with zero violations.
- [`scripts/qa.mjs`](../scripts/qa.mjs) locks the regression cases: the original
  track-height Kosugi slab fails, while the raised deck and a clear rotated building pass.
- River water now grades from lighter banks to a deeper channel centre. Harbour water darkens
  away from its north shoreline. Both retain the existing animated wave.

**Verification:**

- [x] `node scripts/qa.mjs`
- [x] Browser: `window.run_qa()` reports zero violations.
- [x] Tamagawa and Yokohama water views; no WebGL or window errors.
- [x] Cache-bust.

---

## Suggested file order (matches tasks)

1. `src/scene.js` — **lights first**, landmark kits in Task 3.
2. `src/main.js` — ACES / exposure / optional one post effect.
3. `src/materials.js` — masonry + timber.
4. `src/layout.js` — platform/house detail; river water.
5. `src/train.js` — panes and bogies.
6. `src/cameras.js` — room distance last.

---

## Explicit non-goals

- glTF city packs, photogrammetry, OSM extrusion.
- Real-time shadow updates every frame.
- Matching monolithic desktop simulator engines.
- Wiring this simulation into an external game loop.

---

## Reference Architecture

| Feature | Architectural Pattern | Applied Implementation |
|---|---|---|
| Material Grouping | Multi-material procedural batching | Native Three.js materials (`src/materials.js`) |
| Lighting & Tone Mapping | Directional sun + ACESFilmic | Warm directional key + ACES tone mapping |
| Procedural Landmarks | Low-poly procedural assembly | Landmark kits (`src/architecture.js`) |
| Macro Diorama Camera | Telephoto depth & framing | Calibrated diorama perspective (`src/cameras.js`) |
| Zero External Assets | Pure procedural vertex generation | 12-float interleaved Builder (`src/builder.js`) |
