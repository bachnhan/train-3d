/**
 * Reference Implementation: Zero-Dependency Procedural 3D Mesh Builder
 * 
 * Interleaved Vertex Format (12 floats per vertex):
 * [x, y, z,   nx, ny, nz,   r, g, b,   materialId,   u, v]
 */

class Builder {
  constructor() {
    this.data = []; // flat array of floats
    this.stack = [];
    this.m = this.ident(); // 4x4 matrix stored in 16 floats (row-major)
  }

  // --- Matrix Math Helpers ---
  ident() {
    return [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ];
  }

  mm(a, b) {
    const out = new Array(16);
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        out[r * 4 + c] =
          a[r * 4 + 0] * b[0 * 4 + c] +
          a[r * 4 + 1] * b[1 * 4 + c] +
          a[r * 4 + 2] * b[2 * 4 + c] +
          a[r * 4 + 3] * b[3 * 4 + c];
      }
    }
    return out;
  }

  trans(x, y, z) {
    return [
      1, 0, 0, x,
      0, 1, 0, y,
      0, 0, 1, z,
      0, 0, 0, 1
    ];
  }

  rotX(a) {
    const c = Math.cos(a), s = Math.sin(a);
    return [
      1, 0, 0, 0,
      0, c, -s, 0,
      0, s, c, 0,
      0, 0, 0, 1
    ];
  }

  rotY(a) {
    const c = Math.cos(a), s = Math.sin(a);
    return [
      c, 0, s, 0,
      0, 1, 0, 0,
      -s, 0, c, 0,
      0, 0, 0, 1
    ];
  }

  rotZ(a) {
    const c = Math.cos(a), s = Math.sin(a);
    return [
      c, -s, 0, 0,
      s, c, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ];
  }

  scale(sx, sy, sz) {
    return [
      sx, 0, 0, 0,
      0, sy, 0, 0,
      0, 0, sz, 0,
      0, 0, 0, 1
    ];
  }

  // --- Stack Operations ---
  push(x = 0, y = 0, z = 0, ax = 0, ay = 0, az = 0, sx = 1, sy = sx, sz = sx) {
    this.stack.push([...this.m]);
    let t = this.trans(x, y, z);
    if (ay) t = this.mm(t, this.rotY(ay));
    if (ax) t = this.mm(t, this.rotX(ax));
    if (az) t = this.mm(t, this.rotZ(az));
    if (sx !== 1 || sy !== 1 || sz !== 1) t = this.mm(t, this.scale(sx, sy, sz));
    this.m = this.mm(this.m, t);
    return this;
  }

  pop() {
    this.m = this.stack.pop() || this.ident();
    return this;
  }

  // --- Vector & Normal Transformations ---
  transform(p) {
    const m = this.m;
    return [
      m[0] * p[0] + m[1] * p[1] + m[2] * p[2] + m[3],
      m[4] * p[0] + m[5] * p[1] + m[6] * p[2] + m[7],
      m[8] * p[0] + m[9] * p[1] + m[10] * p[2] + m[11]
    ];
  }

  /**
   * Transforms surface normal vectors using the cofactor matrix (inverse-transpose).
   * Guarantees unit-length, perpendicular normals even under non-uniform scaling or shearing.
   */
  normalTransform(n) {
    const m = this.m;
    // Row vectors of upper 3x3
    const a = [m[0], m[1], m[2]];
    const b = [m[4], m[5], m[6]];
    const c = [m[8], m[9], m[10]];

    // Cross products of row pairs compute cofactor columns
    const bc = [b[1]*c[2] - b[2]*c[1], b[2]*c[0] - b[0]*c[2], b[0]*c[1] - b[1]*c[0]];
    const ca = [c[1]*a[2] - c[2]*a[1], c[2]*a[0] - c[0]*a[2], c[0]*a[1] - c[1]*a[0]];
    const ab = [a[1]*b[2] - a[2]*b[1], a[2]*b[0] - a[0]*b[2], a[0]*b[1] - a[1]*b[0]];

    const nx = bc[0] * n[0] + ca[0] * n[1] + ab[0] * n[2];
    const ny = bc[1] * n[0] + ca[1] * n[1] + ab[1] * n[2];
    const nz = bc[2] * n[0] + ca[2] * n[1] + ab[2] * n[2];

    const len = Math.hypot(nx, ny, nz) || 1.0;
    return [nx / len, ny / len, nz / len];
  }

  // --- Color Parser ---
  parseColor(c) {
    if (Array.isArray(c)) return c;
    if (typeof c === 'string' && c.startsWith('#')) {
      const hex = parseInt(c.slice(1), 16);
      return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
    }
    return [0.7, 0.7, 0.7];
  }

  // --- Vertex & Primitive Writing ---
  vertex(p, n, color, mat = 0, uv = [0, 0]) {
    const tp = this.transform(p);
    const tn = this.normalTransform(n);
    const rgb = this.parseColor(color);
    this.data.push(tp[0], tp[1], tp[2], tn[0], tn[1], tn[2], rgb[0], rgb[1], rgb[2], mat, uv[0], uv[1]);
  }

  tri(a, b, c, color, mat = 0, ns = null, uvs = null) {
    let n = this.calcNormal(a, b, c);
    this.vertex(a, ns ? ns[0] : n, color, mat, uvs ? uvs[0] : [0, 0]);
    this.vertex(b, ns ? ns[1] : n, color, mat, uvs ? uvs[1] : [0, 0]);
    this.vertex(c, ns ? ns[2] : n, color, mat, uvs ? uvs[2] : [0, 0]);
    return this;
  }

  quad(a, b, c, d, color, mat = 0, n = null, uvs = null) {
    const fn = n || this.calcNormal(a, b, c);
    const u0 = uvs ? uvs[0] : [0, 0], u1 = uvs ? uvs[1] : [1, 0];
    const u2 = uvs ? uvs[2] : [1, 1], u3 = uvs ? uvs[3] : [0, 1];
    this.tri(a, b, c, color, mat, [fn, fn, fn], [u0, u1, u2]);
    this.tri(a, c, d, color, mat, [fn, fn, fn], [u0, u2, u3]);
    return this;
  }

  calcNormal(a, b, c) {
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const nx = ab[1] * ac[2] - ab[2] * ac[1];
    const ny = ab[2] * ac[0] - ab[0] * ac[2];
    const nz = ab[0] * ac[1] - ab[1] * ac[0];
    const len = Math.hypot(nx, ny, nz) || 1.0;
    return [nx / len, ny / len, nz / len];
  }

  box(x, y, z, w, h, d, color, mat = 0) {
    const hw = w / 2, hh = h / 2, hd = d / 2;
    this.push(x, y, z);
    // Front & Back
    this.quad([-hw, -hh, hd], [hw, -hh, hd], [hw, hh, hd], [-hw, hh, hd], color, mat, [0, 0, 1]);
    this.quad([hw, -hh, -hd], [-hw, -hh, -hd], [-hw, hh, -hd], [hw, hh, -hd], color, mat, [0, 0, -1]);
    // Top & Bottom
    this.quad([-hw, hh, hd], [hw, hh, hd], [hw, hh, -hd], [-hw, hh, -hd], color, mat, [0, 1, 0]);
    this.quad([-hw, -hh, -hd], [hw, -hh, -hd], [hw, -hh, hd], [-hw, -hh, hd], color, mat, [0, -1, 0]);
    // Left & Right
    this.quad([-hw, -hh, -hd], [-hw, -hh, hd], [-hw, hh, hd], [-hw, hh, -hd], color, mat, [-1, 0, 0]);
    this.quad([hw, -hh, hd], [hw, -hh, -hd], [hw, hh, -hd], [hw, hh, hd], color, mat, [1, 0, 0]);
    this.pop();
    return this;
  }

  cylinder(x, y, z, r1, r2, h, color, mat = 0, segs = 12) {
    this.push(x, y, z);
    const hh = h / 2;
    for (let i = 0; i < segs; i++) {
      const a0 = (i * Math.PI * 2) / segs;
      const a1 = ((i + 1) * Math.PI * 2) / segs;
      const x0 = Math.cos(a0), z0 = Math.sin(a0);
      const x1 = Math.cos(a1), z1 = Math.sin(a1);

      const p0 = [x0 * r1, -hh, z0 * r1];
      const p1 = [x1 * r1, -hh, z1 * r1];
      const p2 = [x1 * r2, hh, z1 * r2];
      const p3 = [x0 * r2, hh, z0 * r2];

      const n0 = [x0, (r1 - r2) / h, z0];
      const n1 = [x1, (r1 - r2) / h, z1];
      const len0 = Math.hypot(...n0) || 1, len1 = Math.hypot(...n1) || 1;
      const na = [n0[0] / len0, n0[1] / len0, n0[2] / len0];
      const nb = [n1[0] / len1, n1[1] / len1, n1[2] / len1];

      this.tri(p0, p1, p2, color, mat, [na, nb, nb]);
      this.tri(p0, p2, p3, color, mat, [na, nb, na]);

      // Top cap (facing +Y)
      if (r2 > 0) this.tri([0, hh, 0], p2, p3, color, mat, [[0, 1, 0], [0, 1, 0], [0, 1, 0]]);
      // Bottom cap (facing -Y): reversed winding [0, -hh, 0], p1, p0 guarantees outward CCW normal
      if (r1 > 0) this.tri([0, -hh, 0], p1, p0, color, mat, [[0, -1, 0], [0, -1, 0], [0, -1, 0]]);
    }
    this.pop();
    return this;
  }

  beam(from, to, radius, color, mat = 0, segs = 8) {
    const dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2];
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-4) return this;
    const mx = (from[0] + to[0]) / 2, my = (from[1] + to[1]) / 2, mz = (from[2] + to[2]) / 2;
    const ay = Math.atan2(dx, dz);
    const ax = -Math.asin(dy / len);
    this.push(mx, my, mz, ax, ay, 0);
    this.cylinder(0, 0, 0, radius, radius, len, color, mat, segs);
    this.pop();
    return this;
  }

  // --- Output Accessors ---
  toFloat32Array() {
    return new Float32Array(this.data);
  }

  getStats() {
    const vertexCount = this.data.length / 12;
    return {
      vertexCount,
      triangleCount: vertexCount / 3,
      byteLength: this.data.length * 4
    };
  }

  clear() {
    this.data.length = 0;
    this.stack.length = 0;
    this.m = this.ident();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Builder };
}
// ESM named export for direct import in Next.js / bundlers
export { Builder };
if (typeof window !== 'undefined') {
  window.Builder = Builder;
}
