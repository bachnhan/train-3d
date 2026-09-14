const STRIDE = 12;

export const MATERIAL = Object.freeze({
  MATTE: 0,
  GLASS: 1,
  METAL: 2,
  EMISSIVE: 3
});

// Palette values are authored as sRGB hex but the renderer samples vertex colours as
// linear, so every channel is decoded once here instead of at draw time.
function srgbToLinear(channel) {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

export class Builder {
  constructor() {
    this.data = [];
    this.stack = [];
    this.matrix = this.identity();
    this.assets = [];
    this.activeAsset = null;
  }

  identity() {
    return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  }

  multiply(a, b) {
    const out = new Array(16);
    for (let row = 0; row < 4; row += 1) {
      for (let column = 0; column < 4; column += 1) {
        out[row * 4 + column] =
          a[row * 4] * b[column] +
          a[row * 4 + 1] * b[4 + column] +
          a[row * 4 + 2] * b[8 + column] +
          a[row * 4 + 3] * b[12 + column];
      }
    }
    return out;
  }

  translation(x, y, z) {
    return [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z, 0, 0, 0, 1];
  }

  rotationX(angle) {
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    return [1, 0, 0, 0, 0, cosine, -sine, 0, 0, sine, cosine, 0, 0, 0, 0, 1];
  }

  rotationY(angle) {
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    return [cosine, 0, sine, 0, 0, 1, 0, 0, -sine, 0, cosine, 0, 0, 0, 0, 1];
  }

  rotationZ(angle) {
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    return [cosine, -sine, 0, 0, sine, cosine, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  }

  scaling(x, y, z) {
    return [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1];
  }

  push(x = 0, y = 0, z = 0, rotationX = 0, rotationY = 0, rotationZ = 0, scaleX = 1, scaleY = scaleX, scaleZ = scaleX) {
    this.stack.push([...this.matrix]);
    let transform = this.translation(x, y, z);
    if (rotationY) transform = this.multiply(transform, this.rotationY(rotationY));
    if (rotationX) transform = this.multiply(transform, this.rotationX(rotationX));
    if (rotationZ) transform = this.multiply(transform, this.rotationZ(rotationZ));
    if (scaleX !== 1 || scaleY !== 1 || scaleZ !== 1) {
      transform = this.multiply(transform, this.scaling(scaleX, scaleY, scaleZ));
    }
    this.matrix = this.multiply(this.matrix, transform);
    return this;
  }

  pop() {
    if (!this.stack.length) throw new Error("Builder matrix stack underflow");
    this.matrix = this.stack.pop();
    return this;
  }

  beginAsset(label) {
    if (this.activeAsset) throw new Error(`Builder asset "${this.activeAsset.label}" is still open`);
    this.activeAsset = { label, start: this.data.length };
    return this;
  }

  endAsset() {
    if (!this.activeAsset) throw new Error("Builder has no active asset");
    const triangles = (this.data.length - this.activeAsset.start) / STRIDE / 3;
    this.assets.push({ label: this.activeAsset.label, triangles });
    this.activeAsset = null;
    return this;
  }

  transformPoint(point) {
    const [x, y, z] = point;
    const m = this.matrix;
    return [
      m[0] * x + m[1] * y + m[2] * z + m[3],
      m[4] * x + m[5] * y + m[6] * z + m[7],
      m[8] * x + m[9] * y + m[10] * z + m[11]
    ];
  }

  transformNormal(normal) {
    const m = this.matrix;
    const a = [m[0], m[1], m[2]];
    const b = [m[4], m[5], m[6]];
    const c = [m[8], m[9], m[10]];
    const bc = [b[1] * c[2] - b[2] * c[1], b[2] * c[0] - b[0] * c[2], b[0] * c[1] - b[1] * c[0]];
    const ca = [c[1] * a[2] - c[2] * a[1], c[2] * a[0] - c[0] * a[2], c[0] * a[1] - c[1] * a[0]];
    const ab = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const x = bc[0] * normal[0] + ca[0] * normal[1] + ab[0] * normal[2];
    const y = bc[1] * normal[0] + ca[1] * normal[1] + ab[1] * normal[2];
    const z = bc[2] * normal[0] + ca[2] * normal[1] + ab[2] * normal[2];
    const length = Math.hypot(x, y, z) || 1;
    return [x / length, y / length, z / length];
  }

  parseColor(color) {
    if (Array.isArray(color)) return color.map(srgbToLinear);
    const value = Number.parseInt(String(color).replace("#", ""), 16);
    return [
      srgbToLinear(((value >> 16) & 255) / 255),
      srgbToLinear(((value >> 8) & 255) / 255),
      srgbToLinear((value & 255) / 255)
    ];
  }

  vertex(point, normal, color, material = MATERIAL.MATTE, uv = [0, 0]) {
    const p = this.transformPoint(point);
    const n = this.transformNormal(normal);
    const rgb = this.parseColor(color);
    this.data.push(...p, ...n, ...rgb, material, ...uv);
  }

  normal(a, b, c) {
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const x = ab[1] * ac[2] - ab[2] * ac[1];
    const y = ab[2] * ac[0] - ab[0] * ac[2];
    const z = ab[0] * ac[1] - ab[1] * ac[0];
    const length = Math.hypot(x, y, z) || 1;
    return [x / length, y / length, z / length];
  }

  tri(a, b, c, color, material = MATERIAL.MATTE, normals = null, uvs = null) {
    const faceNormal = this.normal(a, b, c);
    this.vertex(a, normals?.[0] || faceNormal, color, material, uvs?.[0]);
    this.vertex(b, normals?.[1] || faceNormal, color, material, uvs?.[1]);
    this.vertex(c, normals?.[2] || faceNormal, color, material, uvs?.[2]);
    return this;
  }

  quad(a, b, c, d, color, material = MATERIAL.MATTE, normal = null) {
    const faceNormal = normal || this.normal(a, b, c);
    this.tri(a, b, c, color, material, [faceNormal, faceNormal, faceNormal], [[0, 0], [1, 0], [1, 1]]);
    this.tri(a, c, d, color, material, [faceNormal, faceNormal, faceNormal], [[0, 0], [1, 1], [0, 1]]);
    return this;
  }

  box(x, y, z, width, height, depth, color, material = MATERIAL.MATTE) {
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    const halfDepth = depth / 2;
    this.push(x, y, z);
    this.quad([-halfWidth, -halfHeight, halfDepth], [halfWidth, -halfHeight, halfDepth], [halfWidth, halfHeight, halfDepth], [-halfWidth, halfHeight, halfDepth], color, material, [0, 0, 1]);
    this.quad([halfWidth, -halfHeight, -halfDepth], [-halfWidth, -halfHeight, -halfDepth], [-halfWidth, halfHeight, -halfDepth], [halfWidth, halfHeight, -halfDepth], color, material, [0, 0, -1]);
    this.quad([-halfWidth, halfHeight, halfDepth], [halfWidth, halfHeight, halfDepth], [halfWidth, halfHeight, -halfDepth], [-halfWidth, halfHeight, -halfDepth], color, material, [0, 1, 0]);
    this.quad([-halfWidth, -halfHeight, -halfDepth], [halfWidth, -halfHeight, -halfDepth], [halfWidth, -halfHeight, halfDepth], [-halfWidth, -halfHeight, halfDepth], color, material, [0, -1, 0]);
    this.quad([-halfWidth, -halfHeight, -halfDepth], [-halfWidth, -halfHeight, halfDepth], [-halfWidth, halfHeight, halfDepth], [-halfWidth, halfHeight, -halfDepth], color, material, [-1, 0, 0]);
    this.quad([halfWidth, -halfHeight, halfDepth], [halfWidth, -halfHeight, -halfDepth], [halfWidth, halfHeight, -halfDepth], [halfWidth, halfHeight, halfDepth], color, material, [1, 0, 0]);
    this.pop();
    return this;
  }

  prism(points, height, color, material = MATERIAL.MATTE) {
    if (typeof THREE === "undefined") throw new Error("Builder.prism requires Three.js");
    if (points.length < 3) return this;
    const shape = points.map(([x, z]) => new THREE.Vector2(x, z));
    const triangles = THREE.ShapeUtils.triangulateShape(shape, []);
    for (const triangle of triangles) {
      const top = triangle.map((index) => [points[index][0], height, points[index][1]]);
      if (this.normal(top[0], top[1], top[2])[1] < 0) top.reverse();
      this.tri(top[0], top[1], top[2], color, material,
        [[0, 1, 0], [0, 1, 0], [0, 1, 0]]);
    }
    const clockwise = THREE.ShapeUtils.isClockWise(shape);
    for (let index = 0; index < points.length; index += 1) {
      const a = points[index];
      const b = points[(index + 1) % points.length];
      const wall = clockwise
        ? [[a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], height, b[1]], [a[0], height, a[1]]]
        : [[b[0], 0, b[1]], [a[0], 0, a[1]], [a[0], height, a[1]], [b[0], height, b[1]]];
      this.quad(...wall, color, material);
    }
    return this;
  }

  cylinder(x, y, z, bottomRadius, topRadius, height, color, material = MATERIAL.MATTE, segments = 10) {
    this.push(x, y, z);
    const halfHeight = height / 2;
    for (let index = 0; index < segments; index += 1) {
      const angleA = index / segments * Math.PI * 2;
      const angleB = (index + 1) / segments * Math.PI * 2;
      const cosineA = Math.cos(angleA);
      const sineA = Math.sin(angleA);
      const cosineB = Math.cos(angleB);
      const sineB = Math.sin(angleB);
      const a = [cosineA * bottomRadius, -halfHeight, sineA * bottomRadius];
      const b = [cosineB * bottomRadius, -halfHeight, sineB * bottomRadius];
      const c = [cosineB * topRadius, halfHeight, sineB * topRadius];
      const d = [cosineA * topRadius, halfHeight, sineA * topRadius];
      this.quad(a, b, c, d, color, material);
      if (topRadius) this.tri([0, halfHeight, 0], c, d, color, material, [[0, 1, 0], [0, 1, 0], [0, 1, 0]]);
      if (bottomRadius) this.tri([0, -halfHeight, 0], b, a, color, material, [[0, -1, 0], [0, -1, 0], [0, -1, 0]]);
    }
    this.pop();
    return this;
  }

  beam(from, to, radius, color, material = MATERIAL.MATTE, segments = 6) {
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const dz = to[2] - from[2];
    const length = Math.hypot(dx, dy, dz);
    if (length < 0.0001) return this;

    const uy = [dx / length, dy / length, dz / length];
    let ux, uz;
    if (Math.abs(uy[1]) < 0.99) {
      const horizLen = Math.hypot(uy[0], uy[2]);
      ux = [uy[2] / horizLen, 0, -uy[0] / horizLen];
      uz = [
        uy[1] * ux[2] - uy[2] * ux[1],
        uy[2] * ux[0] - uy[0] * ux[2],
        uy[0] * ux[1] - uy[1] * ux[0]
      ];
    } else {
      ux = [1, 0, 0];
      uz = [
        uy[1] * ux[2] - uy[2] * ux[1],
        uy[2] * ux[0] - uy[0] * ux[2],
        uy[0] * ux[1] - uy[1] * ux[0]
      ];
      const uzLen = Math.hypot(uz[0], uz[1], uz[2]) || 1;
      uz[0] /= uzLen; uz[1] /= uzLen; uz[2] /= uzLen;
      ux = [
        uz[1] * uy[2] - uz[2] * uy[1],
        uz[2] * uy[0] - uz[0] * uy[2],
        uz[0] * uy[1] - uz[1] * uy[0]
      ];
    }

    const cx = (from[0] + to[0]) / 2;
    const cy = (from[1] + to[1]) / 2;
    const cz = (from[2] + to[2]) / 2;

    const transform = [
      ux[0], uy[0], uz[0], cx,
      ux[1], uy[1], uz[1], cy,
      ux[2], uy[2], uz[2], cz,
      0,     0,     0,     1
    ];

    this.stack.push([...this.matrix]);
    this.matrix = this.multiply(this.matrix, transform);
    this.cylinder(0, 0, 0, radius, radius, length, color, material, segments);
    this.matrix = this.stack.pop();
    return this;
  }

  wire(from, to, width, color, material = MATERIAL.METAL) {
    const dx = to[0] - from[0];
    const dz = to[2] - from[2];
    const horizLen = Math.hypot(dx, dz);
    let sx, sz;
    if (horizLen > 1e-4) {
      sx = -dz / horizLen * width;
      sz = dx / horizLen * width;
    } else {
      sx = width;
      sz = 0;
    }
    this.quad(
      [from[0] - sx, from[1], from[2] - sz],
      [from[0] + sx, from[1], from[2] + sz],
      [to[0] + sx, to[1], to[2] + sz],
      [to[0] - sx, to[1], to[2] - sz],
      color,
      material
    );
    const sy = horizLen > 1e-4 ? width : 0;
    const sz2 = horizLen > 1e-4 ? 0 : width;
    this.quad(
      [from[0], from[1] - sy, from[2] - sz2],
      [from[0], from[1] + sy, from[2] + sz2],
      [to[0], to[1] + sy, to[2] + sz2],
      [to[0], to[1] - sy, to[2] - sz2],
      color,
      material
    );
    return this;
  }

  arch(x, y, z, radius, thickness, depth, color, material = MATERIAL.MATTE, segments = 10) {
    this.push(x, y, z);
    for (let index = 0; index < segments; index += 1) {
      const a = Math.PI * index / segments;
      const b = Math.PI * (index + 1) / segments;
      const outerA = [Math.cos(a) * radius, Math.sin(a) * radius, depth / 2];
      const outerB = [Math.cos(b) * radius, Math.sin(b) * radius, depth / 2];
      const innerB = [Math.cos(b) * (radius - thickness), Math.sin(b) * (radius - thickness), depth / 2];
      const innerA = [Math.cos(a) * (radius - thickness), Math.sin(a) * (radius - thickness), depth / 2];
      this.quad(outerA, outerB, innerB, innerA, color, material);
      this.quad(
        [outerB[0], outerB[1], -depth / 2],
        [outerA[0], outerA[1], -depth / 2],
        [innerA[0], innerA[1], -depth / 2],
        [innerB[0], innerB[1], -depth / 2],
        color,
        material
      );
    }
    this.pop();
    return this;
  }

  buildCommuterCar({ length = 12, carType = "cab" } = {}) {
    // 1. Main Stainless Steel Body & Profile
    this.box(0, 1.62, 0, 2.76, 2.22, length - 0.1, "#cbd5e1", MATERIAL.METAL);
    this.box(0, 2.76, 0, 2.62, 0.16, length - 0.1, "#94a3b8", MATERIAL.METAL);
    this.box(0, 0.54, 0, 2.72, 0.12, length - 0.15, "#1e293b", MATERIAL.METAL);

    // 2. Livery Stripes: Commuter Rapid Design
    // Crimson red waist ribbon
    this.box(0, 1.18, 0, 2.80, 0.20, length - 0.05, "#da0442", MATERIAL.MATTE);
    // Green accent pinstripe
    this.box(0, 1.32, 0, 2.80, 0.05, length - 0.05, "#009140", MATERIAL.MATTE);
    // Signature green roofline ribbon
    this.box(0, 2.45, 0, 2.80, 0.08, length - 0.05, "#009140", MATERIAL.MATTE);

    // 3. Passenger Windows & 4 Modular Entry Doors per side
    const doorZOffsets = [-3.8, -1.25, 1.25, 3.8];
    for (const dz of doorZOffsets) {
      // Door opening with dark tinted glass
      this.box(0, 1.72, dz, 2.82, 0.86, 0.95, "#0f172a", MATERIAL.GLASS);
      // Yellow safety indicator bar above door
      this.box(0, 2.18, dz, 2.83, 0.04, 0.95, "#eab308", MATERIAL.MATTE);
    }
    // 3 Window bays between doors
    const windowZOffsets = [-2.52, 0, 2.52];
    for (const wz of windowZOffsets) {
      this.box(0, 1.78, wz, 2.82, 0.62, 1.45, "#0f172a", MATERIAL.GLASS);
    }

    // 4. Rooftop Air Conditioners: AU726B Streamlined Pods
    for (const acZ of [-1.8, 1.8]) {
      this.box(0, 2.96, acZ, 1.7, 0.24, 2.4, "#cbd5e1", MATERIAL.METAL);
    }

    // 5. Underfloor VVVF Equipment
    this.box(-0.85, 0.46, 0.2, 0.65, 0.36, 2.4, "#1e293b", MATERIAL.METAL);
    this.box(0.85, 0.46, -0.4, 0.65, 0.34, 2.0, "#334155", MATERIAL.METAL);

    // 6. Bolsterless Bogies & Standard 1.435m Wheelsets
    const bogieZOffsets = [-length / 2 + 2, length / 2 - 2];
    const wheelZOffsets = [-0.55, 0.55];
    for (const bz of bogieZOffsets) {
      this.box(0, 0.42, bz, 1.8, 0.28, 1.8, "#334155", MATERIAL.METAL);
      for (const wz of wheelZOffsets) {
        const centerZ = bz + wz;
        // Transverse axle connecting wheels (4 segments = 16 tris)
        this.push(0, 0.35, centerZ, 0, 0, Math.PI / 2);
        this.cylinder(0, 0, 0, 0.045, 0.045, 1.44, "#1e293b", MATERIAL.METAL, 4);
        this.pop();

        for (const side of [-1, 1]) {
          const railX = side * 0.7175;
          // Wheel rolling cylinder seated on railhead (radius 0.39m, width 0.12m, 5 segments = 20 tris)
          this.push(railX, 0.35, centerZ, 0, 0, Math.PI / 2);
          this.cylinder(0, 0, 0, 0.39, 0.39, 0.12, "#0f172a", MATERIAL.METAL, 5);
          this.pop();
        }
      }
    }

    // 7. Front/Rear Cab & Single-Arm Pantograph
    const isLead = carType === "lead" || carType === "cab";
    const isTail = carType === "tail";

    if (isLead || isTail) {
      const zDir = isLead ? 1 : -1;
      const noseZ = (length / 2) * zDir;

      // Aerodynamic "Incubation White" Cowl
      this.box(0, 2.12, noseZ + 0.10 * zDir, 2.70, 1.16, 0.28, "#f8fafc", MATERIAL.MATTE);
      this.box(0, 1.15, noseZ + 0.12 * zDir, 2.66, 0.95, 0.26, "#f8fafc", MATERIAL.MATTE);

      // "Smile" Cockpit Mask & Windshield
      this.box(0, 2.05, noseZ + 0.26 * zDir, 2.44, 0.88, 0.08, "#0f172a", MATERIAL.GLASS);
      this.box(0, 1.50, noseZ + 0.28 * zDir, 2.38, 0.22, 0.08, "#0f172a", MATERIAL.MATTE);
      this.box(0, 1.36, noseZ + 0.30 * zDir, 1.3, 0.08, 0.08, "#da0442", MATERIAL.MATTE);

      // LED Headlights (bright white for lead, ruby red for tail)
      const lightColor = isLead ? "#ffffff" : "#ef4444";
      for (const sx of [-0.88, 0.88]) {
        this.box(sx, 1.48, noseZ + 0.33 * zDir, 0.34, 0.10, 0.06, lightColor, MATERIAL.EMISSIVE);
      }

      // Full-Color Destination Indicator
      this.box(0, 2.55, noseZ + 0.26 * zDir, 0.95, 0.22, 0.06, "#f59e0b", MATERIAL.EMISSIVE);

      // Front/Rear Obstacle Deflector (Skirt) & Coupler
      this.box(0, 0.36, noseZ + 0.24 * zDir, 2.24, 0.30, 0.22, "#1e293b", MATERIAL.METAL);
      this.box(0, 0.46, noseZ + 0.40 * zDir, 0.26, 0.20, 0.24, "#334155", MATERIAL.METAL);
    }

    if (isLead) {
      // Modern Single-Arm Pantograph (シングルアームパンタグラフ)
      this.box(0, 2.86, -3.2, 1.3, 0.06, 0.9, "#475569", MATERIAL.METAL);
      for (const px of [-0.45, 0.45]) {
        this.box(px, 2.91, -3.2, 0.12, 0.06, 0.7, "#e2e8f0", MATERIAL.METAL);
      }
      // Articulated single-arm Z-linkage
      this.beam([0, 2.92, -3.5], [0, 3.82, -2.8], 0.035, "#94a3b8", MATERIAL.METAL, 4);
      this.beam([0, 3.82, -2.8], [0, 4.62, -3.4], 0.030, "#94a3b8", MATERIAL.METAL, 4);
      this.beam([0, 2.92, -3.1], [0, 4.15, -3.15], 0.018, "#94a3b8", MATERIAL.METAL, 4);
      // Collector shoe contacting catenary wire at y = 4.62 (world 4.80m)
      this.beam([-0.95, 4.62, -3.4], [0.95, 4.62, -3.4], 0.032, "#e2e8f0", MATERIAL.METAL, 4);
    }
    return this;
  }

  toFloat32Array() {
    return new Float32Array(this.data);
  }

  getStats() {
    const vertexCount = this.data.length / STRIDE;
    return { vertexCount, triangleCount: vertexCount / 3, byteLength: this.data.length * 4 };
  }

  getAABB() {
    if (!this.data.length) return { min: [0, 0, 0], max: [0, 0, 0] };
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let offset = 0; offset < this.data.length; offset += STRIDE) {
      for (let axis = 0; axis < 3; axis += 1) {
        min[axis] = Math.min(min[axis], this.data[offset + axis]);
        max[axis] = Math.max(max[axis], this.data[offset + axis]);
      }
    }
    return { min, max };
  }

  getAssetStats() {
    return this.assets.map((asset) => ({ ...asset }));
  }

  toThreeGroup(materials = {}) {
    if (typeof THREE === "undefined") throw new Error("Builder.toThreeGroup requires Three.js");
    const buckets = new Map();
    for (let offset = 0; offset < this.data.length; offset += STRIDE) {
      const material = this.data[offset + 9];
      if (!buckets.has(material)) buckets.set(material, { positions: [], normals: [], colors: [], uvs: [] });
      const bucket = buckets.get(material);
      bucket.positions.push(...this.data.slice(offset, offset + 3));
      bucket.normals.push(...this.data.slice(offset + 3, offset + 6));
      bucket.colors.push(...this.data.slice(offset + 6, offset + 9));
      bucket.uvs.push(...this.data.slice(offset + 10, offset + 12));
    }
    const group = new THREE.Group();
    for (const [materialId, bucket] of buckets) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(bucket.positions, 3));
      geometry.setAttribute("normal", new THREE.Float32BufferAttribute(bucket.normals, 3));
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(bucket.colors, 3));
      geometry.setAttribute("uv", new THREE.Float32BufferAttribute(bucket.uvs, 2));
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      const defaults = {
        vertexColors: true,
        roughness: materialId === MATERIAL.GLASS ? 0.22 : 0.75,
        metalness: materialId === MATERIAL.METAL ? 0.22 : 0.02,
        transparent: materialId === MATERIAL.GLASS,
        opacity: materialId === MATERIAL.GLASS ? 0.82 : 1,
        emissive: materialId === MATERIAL.EMISSIVE ? 0xffffff : 0x000000,
        emissiveIntensity: materialId === MATERIAL.EMISSIVE ? 0.55 : 0
      };
      const mesh = new THREE.Mesh(
        geometry,
        materials[materialId] || new THREE.MeshStandardMaterial(defaults)
      );
      mesh.castShadow = materialId !== MATERIAL.GLASS;
      mesh.receiveShadow = true;
      mesh.userData.materialId = materialId;
      group.add(mesh);
    }
    group.userData.builderStats = this.getStats();
    group.userData.assetStats = this.getAssetStats();
    return group;
  }
}
