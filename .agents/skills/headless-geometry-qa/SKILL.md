---
name: headless-geometry-qa
description: >-
  Executes lightning-fast headless regression testing of procedural 3D geometry in Node.js
  using isolated VM contexts. Verifies vertex buffer integrity, polygon budgets, and byte-for-byte
  invariance without launching Puppeteer, Playwright, or WebGL canvases.
  Use when writing unit tests for 3D procedural generators, verifying mesh budgets, or catching geometry regressions.
---

# Headless Geometry QA Skill

This skill provides the headless geometry QA runner used by Train 3D (`scripts/geometry-qa.mjs`, `npm test`). It runs client-side 3D procedural generation code inside Node.js to perform sub-second regression and budget testing in CI.

---

## When to Use

- Writing automated unit tests for 3D procedural mesh generation.
- Running CI regression gates where launching a full browser (Playwright/Puppeteer) is too slow or resource-heavy.
- Enforcing strict byte budgets and gzip compressed sizes on 3D geometry.
- Validating that mathematical optimizations (shear, matrix multiplication) produce identical vertex streams to previous releases.

## Not For

- Visual screenshot regression testing (use Playwright + Mesa `llvmpipe` for rendering pixels).
- Testing WebGL shader fragment programs or GPU blend modes.
- Auditing 2D HTML/CSS layout.

---

## Core Architecture

Instead of mocking DOM `<canvas>` and WebGL context state machines, this pattern:
1. Loads client procedural files in a clean `node:vm` context.
2. Injects minimal mathematical globals (`Math`, `Float32Array`, matrix math).
3. Executes mesh builders directly into memory.
4. Asserts byte-for-byte equivalence against golden snapshots and measures gzip compression.

---

## Quick Start / Running the Test Runner

Run the project geometry QA suite:
```bash
pnpm run test:geometry
```

Or run the skill's standalone runner directly:
```bash
node .agents/skills/headless-geometry-qa/scripts/run_vm_geometry_qa.mjs
```

### Writing a VM Geometry Test

```javascript
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';

// 1. Setup isolated sandbox with Builder injected
const sandbox = {
  Float32Array,
  Math,
  console,
  Builder // imported from references/builder.js
};
const context = vm.createContext(sandbox);

// 2. Execute geometry builder inside VM
const code = `
  const b = new Builder();
  b.box(0, 0, 0, 2, 2, 2, '#ff0000');
  b.toFloat32Array();
`;
const buffer = vm.runInContext(code, context);

// 3. Assert invariants
assert.equal(buffer.length % 12, 0, 'Must have 12 floats per vertex stride');
assert.ok(buffer.length > 0, 'Buffer must not be empty');

// 4. Assert byte budget & compression
const compressed = gzipSync(Buffer.from(buffer.buffer));
console.log(`Raw size: ${buffer.byteLength} B | Gzip: ${compressed.length} B`);
assert.ok(compressed.length < 5000, 'Mesh must compress under 5KB');
```

---

## Verification & Output

A passing run validates:
* **Topology Invariance:** Number of triangles matches expected count.
* **Normal Correctness:** Normal vectors stay unit length under arbitrary matrix transforms.
* **Gzip Ratio:** Geometry compresses efficiently with Brotli/Zstandard.
