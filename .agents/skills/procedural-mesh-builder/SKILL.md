---
name: procedural-mesh-builder
description: >-
  Builds high-performance, zero-dependency 3D procedural geometry in pure JavaScript
  using an affine transformation matrix stack and low-poly primitives. Emits interleaved
  Float32Array buffers ready for WebGL/WebGPU with zero runtime asset download overhead.
  Use when generating buildings, railway tracks, urban scenery, dioramas, or low-poly assets in code.
---

# Procedural Mesh Builder Skill

This skill provides the zero-dependency procedural geometry architecture used by Train 3D (`src/builder.js`). This SKILL.md and `references/builder.js` are the runnable counterpart for headless Node.js QA and agent guidance.

---

## When to Use

- Generating procedural 3D buildings, railway networks, bridges, or urban scenery directly in code.
- Building WebGL/WebGPU applications where asset download size must be near-zero (sub-millisecond loads).
- Creating single-draw-call batched geometry with palette-quantized vertex colors.
- Running headless geometry generation in Node.js for CLI tools or server-side procedural synthesis.

## Not For

- Loading or editing pre-authored binary 3D assets (glTF, FBX, OBJ) — use standard loaders or `web3d-engineering`.
- High-polygon digital sculpting or organic character modeling with skeletal bone weighting.
- Standard 2D canvas graphics — use 2D canvas APIs or SVG.

---

## Core Architecture: The `Builder` Pattern

The `Builder` maintains:
1. **Affine Transformation Stack:** `push()`, `pop()`, `matrix()`, `translate()`, `rotX()`, `rotY()`, `rotZ()`, `scale()`.
2. **Interleaved Buffer Array:** Emits flat 12-float vertex strides:
   `[x, y, z,  nx, ny, nz,  r, g, b,  materialId,  u, v]`
3. **Primitive Generators:** `box`, `cylinder`, `sphere`, `beam`, `tri`, `quad`.

See the complete reference implementation:
👉 [references/builder.js](./references/builder.js)

---

## Step-by-Step Usage

### 1. Initialize Builder
```javascript
import { Builder } from '.agents/skills/procedural-mesh-builder/references/builder.js';

const b = new Builder();
```

### 2. Construct Model with Matrix Hierarchies
```javascript
// Build a Series 2026 Commuter Train Car
b.push(0, 0, 0);

// 1. Stainless steel car body (silver #d0d5dd)
b.box(0, 1.6, 0, 2.8, 2.4, 12.0, '#d0d5dd', 1);

// 2. Signature red accent stripe (#e60012) along flanks
b.box(0, 1.2, 0, 2.84, 0.25, 11.9, '#e60012', 2);

// 3. Dark tinted commuter windows & cab windshield (#1e293b)
b.box(0, 1.8, 0, 2.84, 0.6, 11.0, '#1e293b', 3);

// 4. Undercarriage & bogie wheelsets (front & rear at ±4.0m)
for (const zOffset of [-4.0, 4.0]) {
  b.cylinder(0, 0.45, zOffset, 1.2, 1.2, 0.5, '#334155', 4, 12);
  b.cylinder(-0.7, 0.4, zOffset - 0.9, 0.4, 0.4, 0.15, '#0f172a', 4, 12);
  b.cylinder(-0.7, 0.4, zOffset + 0.9, 0.4, 0.4, 0.15, '#0f172a', 4, 12);
  b.cylinder(0.7, 0.4, zOffset - 0.9, 0.4, 0.4, 0.15, '#0f172a', 4, 12);
  b.cylinder(0.7, 0.4, zOffset + 0.9, 0.4, 0.4, 0.15, '#0f172a', 4, 12);
}

// 5. Roof pantograph frame (#94a3b8)
b.beam([0, 2.8, -3.0], [0, 3.4, -2.5], 0.04, '#94a3b8', 5);
b.beam([0, 3.4, -2.5], [0, 2.8, -2.0], 0.04, '#94a3b8', 5);

b.pop();
```

### 3. Export to WebGL/WebGPU Buffer
```javascript
const float32Array = b.toFloat32Array();
const stats = b.getStats();

console.log(`Generated ${stats.vertexCount} vertices, ${stats.triangleCount} triangles.`);
// Upload float32Array directly into gl.ARRAY_BUFFER or GPUDevice.createBuffer()
```

---

## Verification & Budget Guidelines

- **Attribute Verification:** Run `check_geometry_invariants.js` on the exported buffer to assert no NaNs, finite bounds, and unit-length normals.
- **Triangle Budget:** Keep procedural buildings under 800 triangles each; scenery props under 150 triangles.
- **Palette Quantization:** Use discrete hex color codes (e.g., `#7a7672`, `#8b4513`) or palette column indices to allow sharing a single $512\times 512$ canvas atlas across all materials.
