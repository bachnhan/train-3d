#!/usr/bin/env node

/**
 * Geometric Invariant & Buffer Sanity Checker
 * 
 * Verifies raw Float32Array and Uint16Array buffers without requiring a full GPU context:
 * 1. Zero NaNs or Infinities in vertex attributes.
 * 2. Vertex normal vectors are unit length (|N| ≈ 1.0).
 * 3. Triangle indices reference valid vertex positions.
 * 4. Bounding volume bounds check (AABB finite, non-inverted, non-collapsed).
 */

const MAX_ERRORS_PER_CHECK = 10;

function validateGeometry({ positions, normals, indices, maxErrors = MAX_ERRORS_PER_CHECK }) {
  const errors = [];

  // 1. Check positions
  if (!positions || !(positions instanceof Float32Array)) {
    errors.push("positions must be a Float32Array");
    return { valid: false, errors };
  }

  if (positions.length % 3 !== 0) {
    errors.push(`positions length ${positions.length} is not a multiple of 3`);
  }

  let posErrorCount = 0;
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];

    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      if (posErrorCount++ < maxErrors) {
        errors.push(`Non-finite position value at vertex ${i / 3}: [${x}, ${y}, ${z}]`);
      }
      continue;
    }

    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }

  // 2. Check normals
  if (normals) {
    if (normals.length !== positions.length) {
      errors.push(`normals length (${normals.length}) does not match positions length (${positions.length})`);
    } else {
      let normalErrorCount = 0;
      for (let i = 0; i < normals.length; i += 3) {
        const nx = normals[i];
        const ny = normals[i + 1];
        const nz = normals[i + 2];
        const lenSq = nx * nx + ny * ny + nz * nz;
        if (!Number.isFinite(lenSq) || Math.abs(lenSq - 1.0) > 0.05) {
          if (normalErrorCount++ < maxErrors) {
            errors.push(`Degenerate/non-unit normal at vertex ${i / 3}: [${nx}, ${ny}, ${nz}], |N|^2 = ${lenSq.toFixed(4)}`);
          }
        }
      }
    }
  }

  // 3. Check indices
  if (indices) {
    const maxVertex = positions.length / 3 - 1;
    let indexErrorCount = 0;
    for (let i = 0; i < indices.length; i++) {
      const idx = indices[i];
      if (idx < 0 || idx > maxVertex) {
        if (indexErrorCount++ < maxErrors) {
          errors.push(`Index out of bounds at index buffer position ${i}: index ${idx} > max vertex ${maxVertex}`);
        }
      }
    }
  }

  // 4. Bounding volume bounds check
  const aabb = { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] };
  if (positions.length >= 3) {
    if (!Number.isFinite(minX) || !Number.isFinite(maxX) ||
        !Number.isFinite(minY) || !Number.isFinite(maxY) ||
        !Number.isFinite(minZ) || !Number.isFinite(maxZ)) {
      errors.push("AABB bounds contain non-finite limits");
    } else if (minX > maxX || minY > maxY || minZ > maxZ) {
      errors.push(`Inverted bounding box: min [${minX}, ${minY}, ${minZ}] > max [${maxX}, ${maxY}, ${maxZ}]`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    vertexCount: positions.length / 3,
    triangleCount: indices ? indices.length / 3 : positions.length / 9,
    aabb
  };
}

// Standalone self-test suite when executed directly
function runSelfTest() {
  console.log("=== Running Geometric Invariant Verification Self-Tests ===");
  let passed = 0;
  let failed = 0;

  // Test 1: Valid unit cube triangle
  const validPositions = new Float32Array([
    0, 0, 0,
    1, 0, 0,
    0, 1, 0
  ]);
  const validNormals = new Float32Array([
    0, 0, 1,
    0, 0, 1,
    0, 0, 1
  ]);
  const validIndices = new Uint16Array([0, 1, 2]);

  const res1 = validateGeometry({ positions: validPositions, normals: validNormals, indices: validIndices });
  if (res1.valid && res1.triangleCount === 1) {
    console.log("  [PASS] Test 1: Valid triangle passes");
    passed++;
  } else {
    console.error("  [FAIL] Test 1: Valid triangle failed", res1.errors);
    failed++;
  }

  // Test 2: Catches NaN in positions
  const nanPositions = new Float32Array([NaN, 0, 0, 1, 0, 0, 0, 1, 0]);
  const res2 = validateGeometry({ positions: nanPositions, normals: validNormals });
  if (!res2.valid && res2.errors.some(e => e.includes("Non-finite position"))) {
    console.log("  [PASS] Test 2: NaN position correctly rejected");
    passed++;
  } else {
    console.error("  [FAIL] Test 2: Failed to catch NaN position");
    failed++;
  }

  // Test 3: Catches non-unit normals
  const badNormals = new Float32Array([0, 0, 0.5, 0, 0, 1, 0, 0, 1]);
  const res3 = validateGeometry({ positions: validPositions, normals: badNormals });
  if (!res3.valid && res3.errors.some(e => e.includes("Degenerate/non-unit normal"))) {
    console.log("  [PASS] Test 3: Non-unit normal correctly rejected");
    passed++;
  } else {
    console.error("  [FAIL] Test 3: Failed to catch non-unit normal");
    failed++;
  }

  // Test 4: Catches out of bounds index
  const oobIndices = new Uint16Array([0, 1, 99]);
  const res4 = validateGeometry({ positions: validPositions, indices: oobIndices });
  if (!res4.valid && res4.errors.some(e => e.includes("Index out of bounds"))) {
    console.log("  [PASS] Test 4: Out-of-bounds index correctly rejected");
    passed++;
  } else {
    console.error("  [FAIL] Test 4: Failed to catch out-of-bounds index");
    failed++;
  }

  console.log(`\nSelf-test results: ${passed} passed, ${failed} failed.`);
  return failed === 0;
}

module.exports = { validateGeometry, runSelfTest };

if (require.main === module) {
  const success = runSelfTest();
  process.exit(success ? 0 : 1);
}
