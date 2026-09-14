---
name: web3d-engineering
description: >-
  Comprehensive guide and runbook for designing, building, auditing, and optimizing
  interactive Web 3D applications (WebGPU, WebGL 2, Three.js, TSL, Babylon.js, or custom engines).
  Use when developing 3D transportation, train simulations, city dioramas, asset optimization
  pipelines (Meshopt, KTX2), fixed-timestep simulation loops, 3D canvas accessibility
  (Accessible Twin), spatial audio (Web Audio HRTF), or performing mobile VRAM and 60fps performance audits.
---

# Interactive Web 3D & Diorama Engineering Skill

This skill provides an end-to-end engineering playbook for developing, reviewing, and optimizing high-performance interactive 3D web experiences (transportation simulations, urban dioramas, architectural exhibits).

---

## When to Use This Skill

Activate this skill when:
- Designing or implementing Web 3D scenes (Three.js, WebGPURenderer, TSL, Babylon.js, or lightweight WebGL 2 engines).
- Setting up 3D asset optimization pipelines (`gltf-transform`, `EXT_meshopt_compression`, KTX2 / Basis Universal).
- Implementing vehicle kinematics (Catmull-Rom arc-length spline LUTs, dual-bogie chord tracking, track banking).
- Implementing the **Accumulator Pattern** (fixed-timestep simulation vs. variable render loop).
- Building **3D Canvas Accessibility** (Parallel DOM / Accessible Twin, screen-reader ARIA announcements, keyboard focus in 3D).
- Designing spatial audio graphs (Web Audio `PannerNode` HRTF, explicit line-of-sight Doppler, procedural motor whine).
- Auditing mobile VRAM budgets ($\le 128\text{ MB}$ Jetsam limit), zero-allocation render loops, and headless CI verification.

## Not For

Do **not** activate this skill for:
- **Pure 2D canvas visualization** (Chart.js, D3.js, PixiJS 2D sprites) — use standard frontend skills or `modern-web-guidance`.
- **Server-side 3D rendering** (Blender Python batch rendering, server raytracing farms) — this skill targets real-time browser runtimes.
- **Native engine exports** (Unity WebGL export wrapper, Unreal Pixel Streaming) — use engine-specific build guides.
- **General web performance & SEO** (LCP hero image loading, CLS, INP) — use `debug-optimize-lcp` or `modern-web-guidance`.

---

## The 7-Phase Production Workflow

```
 [1. Pre-Production] ──► [2. Asset Pipeline] ──► [3. Simulation Architecture]
                                                            │
 ┌──────────────────────────────────────────────────────────┘
 ▼
 [4. Rendering & Shaders] ──► [5. 3D Canvas a11y] ──► [6. Audio & Interaction]
                                                            │
 ┌──────────────────────────────────────────────────────────┘
 ▼
 [7. QA, VRAM & CI Gates]
```

---

## Phase 1: Pre-Production & Greybox Prototyping

1. **Establish Metric World Standards:**
   - Define canonical scene units: $1.0\text{ unit} = 1.0\text{ meter}$.
   - Define track gauge (standard gauge: $1.435\text{ m}$), loading gauge clearance height ($4.5\text{ m}$), and catenary wire height ($5.2\text{ m}$).
2. **Greybox Blockout:**
   - Assemble primitives (boxes, cylinders, extruded track curves) to validate camera framing, sightlines, and travel speeds *before* authoring high-poly geometry.
3. **Establish Technical Style Guide:**
   - Choose between **PBR Authored Models** (Meshopt + KTX2) or **Procedural Palette Models** (quantized vertex colors + $512\times 512$ canvas atlas for zero-VRAM footprints).

**Verification Step:**
* Assert that the camera frustum at low FOV ($18^\circ–22^\circ$) frames the focal subject without clipping through bounding envelopes.
* Confirm world coordinate scale: verify that a $1\text{ m}$ test cube matches the expected visual scale of rolling stock and tracks.

---

## Phase 2: Asset Optimization & DCC Pipeline

Never serve raw Blender/Maya exports directly to the web. Always process 3D assets through an automated pipeline:

### Automated `gltf-transform` Optimization Command
```bash
# Compress meshes with Meshopt and transcode textures to KTX2
gltf-transform optimize input_scene.glb output_scene.glb \
  --weld \
  --simplify --ratio 0.5 --error 0.001 \
  --compress meshopt \
  --texture-compress ktx2 \
  --slots "baseColor:uastc,normal:uastc,metallicRoughness:uastc,*:etc1s"
```

### Key Invariants:
* **Decompression Speed:** Enforce `EXT_meshopt_compression` over Draco. Meshopt decodes at 500–1200 MB/s directly into GPU VBOs.
* **Texture Budgets:** Clamp mobile textures to $1024\times 1024$ or $2048\times 2048$ max. Transcode to KTX2 on background web workers.
* **Coordinate Conversion:** Blender exports $+Z$-up; ensure root transforms flip to $+Y$-up during asset build rather than incurring runtime matrix multiplications.

**Verification Step:**
* Run `gltf-transform inspect output_scene.glb` and confirm:
  1. `EXT_meshopt_compression` is present in `extensionsUsed`.
  2. No individual texture exceeds $2048\times 2048$.
  3. Total `.glb` file size is $\le 5\text{ MB}$ for mobile targets.

---

## Phase 3: Simulation & Kinematic Architecture

### 1. The Fixed-Timestep Accumulator Loop
Physics, kinematics, and traffic signaling MUST run at a deterministic fixed timestep (`FIXED_DT = 1/60s`) decoupled from the display refresh rate.

See [references/accumulator_loop.js](./references/accumulator_loop.js) for the complete production implementation:
* Consumes time in discrete `FIXED_DT` increments.
* Enforces `MAX_FRAME_TIME = 0.25s` to eliminate the "Spiral of Death" during tab lag.
* Passes $\alpha = \frac{\text{accumulator}}{\text{FIXED\_DT}}$ to the renderer for smooth sub-frame transform interpolation.

### 2. Dual-Bogie Spline Kinematics
* **Arc-Length LUT:** Precompute cumulative chord lengths over $N=1000$ points along Catmull-Rom splines for $O(1)$ constant-speed traversal.
* **Bogie Chord Constraint:** Space front and rear bogies along the spline by fixed wheelbase distance $C$:
  $$\|P(s_f) - P(s_r)\| = C$$
* **Car Body Midpoint & Yaw:**
  $$\mathbf{P}_{\text{body}} = \frac{P(s_f) + P(s_r)}{2}, \quad \psi = \operatorname{atan2}(P_{f,z} - P_{r,z}, \; P_{f,x} - P_{r,x})$$
* **Equilibrium Cant (Banking):** Incline car body by $\tan\theta = \frac{v^2}{gR}$ on curves of radius $R$.

**Verification Step:**
* Verify physics determinism: run a simulated train across 600 ticks at 30 FPS vs 144 FPS; vehicle final distance $s$ along the track spline must be identical to within $10^{-5}\text{ m}$.

---

## Phase 4: WebGPU & WebGL Rendering

1. **Target WebGPU with WebGL 2 Fallback:**
   * Use Three.js `WebGPURenderer` with TSL (Three Shading Language) node materials that cross-compile to WGSL and GLSL.
2. **Static Shadow Caching:**
   * Render static city geometry once into `shadowCacheFbo`.
   * Only re-render dynamic moving train meshes each frame into the light's active shadow pass, saving 85–90% of shadow overhead.
3. **Diorama Aesthetics:**
   * Set camera FOV to telephoto miniature range: $15^\circ–22^\circ$.
   * Apply depth-aware Circle of Confusion (CoC) tilt-shift blur and AgX tonemapping to eliminate specular burnout on rails and glass.

**Verification Step:**
* Test GPU context fallback: simulate WebGPU unavailability; confirm the renderer cleanly falls back to WebGL 2 without console uncaught rejections.
* Profile shadow passes: ensure static geometry is not re-rendered into shadow maps while the camera is stationary.

---

## Phase 5: 3D Canvas Accessibility (a11y)

Do not leave `<canvas>` as a black box. Implement the **Accessible Twin Pattern**:

See [references/accessible_twin.js](./references/accessible_twin.js) for the full implementation:
1. **Parallel Hidden DOM:** Maintain visually hidden native HTML `<button>` elements for all interactive 3D objects (trains, stations, signals) with modern `clip-path: inset(50%)` styling.
2. **Screen Reader Live Regions:** Use `<div role="status" aria-live="polite">` strictly for dynamic transit status events (e.g., station arrivals). Avoid double-announcing element focus through live regions.
3. **3D Keyboard Focus Ring:** When a user tabs into the hidden DOM element, project a visible 3D selection box around the corresponding mesh in WebGL/WebGPU space.
4. **Motion Sensitivity:** Respect `window.matchMedia('(prefers-reduced-motion: reduce)')` by disabling camera shakes, tilt-shift post-processing, and instant-teleporting the camera.

**Verification Step:**
* Open Chrome DevTools > Accessibility tab. Verify that all interactive 3D objects appear in the Accessibility Tree with valid accessible names.
* Navigate using only the keyboard (`Tab`, `Shift+Tab`, `Enter`). Verify that 3D focus indicators update accurately in sync with keyboard focus.

---

## Phase 6: Spatial Audio & Interaction

1. **Web Audio Graph:**
   * Use `PannerNode` with `panningModel = 'HRTF'`, `distanceModel = 'inverse'`, and air absorption lowpass filters.
   * Provide a fallback for Firefox (`setPosition(x,y,z)` instead of `positionX.setValueAtTime`).
2. **Manual Doppler Ratio:**
   * Since `panner.setVelocity()` is deprecated, calculate line-of-sight relative velocity in JS and apply it to `playbackRate`:
     $$\text{DopplerRatio} = \text{clamp}\left( \frac{c - (\mathbf{v}_l \cdot \hat{\mathbf{r}})}{c - (\mathbf{v}_s \cdot \hat{\mathbf{r}})}, \; 0.5, \; 2.0 \right)$$
3. **Traction Motor Synthesis:**
   * Blend micro-sample loops (iron track hum) with procedural oscillators (VVVF carrier pulse sweeping with velocity $v$).
4. **Picking Optimization:**
   * Use `three-mesh-bvh` CPU raycasting on bounding proxy meshes. Avoid `gl.readPixels()` on `mousemove` to prevent pipeline stalls.

**Verification Step:**
* Position the camera listener near the tracks while a train approaches and passes. Verify that `playbackRate` shifts cleanly between $[0.5, 2.0]$ without audio glitching or NaN errors.

---

## Phase 7: QA, Performance Budgets & CI Verification

### Production Performance Checklist
- [ ] **Mobile VRAM Budget:** Active textures + geometry + FBOs $\le 128\text{ MB}$ (prevents iOS WebKit Jetsam kills).
- [ ] **Draw Call Budget:** $\le 50$ calls on mobile, $\le 250$ on desktop.
- [ ] **Device Pixel Ratio:** Clamped to `Math.min(window.devicePixelRatio, 2.0)`.
- [ ] **Zero GC Allocations:** Zero `new` object allocations inside `requestAnimationFrame` (reusable scratch vectors/matrices).
- [ ] **Context Loss Recovery:** Handled `webglcontextlost` (with `event.preventDefault()`) and WebGPU `device.lost`.
- [ ] **React 19 / Next.js Lifecycle:** Cleanup WebGL context, geometries, and cancel `requestAnimationFrame` on unmount inside `useEffect`.

### Automated Verification Commands
1. **Geometric Invariants & Buffer Sanity:**
   ```bash
   pnpm run test:geometry
   # Or directly:
   node .agents/skills/web3d-engineering/scripts/check_geometry_invariants.js
   ```
   Asserts zero NaNs/Infinities, unit-length normals, non-inverted AABB bounding boxes, and valid index references.
2. **Headless CI Rendering:**
   Run Playwright tests with Mesa `llvmpipe` (`--use-angle=gl`) for deterministic pixelmatch visual regression tests.
