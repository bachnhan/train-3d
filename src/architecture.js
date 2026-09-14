import { MATERIAL } from "./builder.js";
import { addTokyoSign } from "./signage.js";
import { SHIBUYA_RIVER, distanceToRiver, distanceToRailway, distanceToRoad } from "./map-model.js";

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Authentic Tokyo Rooftop Mechanical Life (屋上設備)
export function addRooftopEquipment(builder, x, y, z, width, depth, seed = 0) {
  const rand = mulberry32(seed + Math.round(Math.abs(x) * 17 + Math.abs(z) * 31));
  const rVal = rand();

  // 1. Elevated Water Storage Tank (高架水槽) on 4-legged steel stilt frame (~22% of buildings)
  if (rVal < 0.22 && width >= 7 && depth >= 7) {
    const tx = x + (rand() - 0.5) * (width * 0.30);
    const tz = z + (rand() - 0.5) * (depth * 0.30);
    const legSpan = 1.35;
    // 4 steel angle-iron support legs
    for (const sx of [-legSpan / 2, legSpan / 2]) {
      for (const sz of [-legSpan / 2, legSpan / 2]) {
        builder.cylinder(tx + sx, y + 0.75, tz + sz, 0.045, 0.045, 1.5, "#475569", MATERIAL.METAL, 4);
      }
    }
    // Cross-braces
    builder.beam([tx - legSpan / 2, y + 0.2, tz - legSpan / 2], [tx + legSpan / 2, y + 1.3, tz - legSpan / 2], 0.022, "#475569", MATERIAL.METAL, 4);
    builder.beam([tx - legSpan / 2, y + 1.3, tz - legSpan / 2], [tx + legSpan / 2, y + 0.2, tz - legSpan / 2], 0.022, "#475569", MATERIAL.METAL, 4);

    // Cylindrical water tank body (weathered FRP or galvanized steel)
    const tankColor = rand() > 0.5 ? "#cbd5e1" : "#94a3b8";
    builder.cylinder(tx, y + 2.25, tz, 1.05, 1.05, 1.5, tankColor, MATERIAL.METAL, 6);
    // Reinforcing steel hoops
    builder.cylinder(tx, y + 1.8, tz, 1.08, 1.08, 0.05, "#334155", MATERIAL.METAL, 6);
    builder.cylinder(tx, y + 2.65, tz, 1.08, 1.08, 0.05, "#334155", MATERIAL.METAL, 6);
    // Conical roof cap (dark charcoal industrial metal)
    builder.cylinder(tx, y + 3.25, tz, 0.1, 1.12, 0.5, "#475569", MATERIAL.METAL, 6);
    // Vertical maintenance ladder
    builder.beam([tx + 1.12, y, tz], [tx + 1.12, y + 3.2, tz], 0.018, "#94a3b8", MATERIAL.METAL, 4);
  } else if (rVal < 0.55 && width >= 6 && depth >= 6) {
    // 2. HVAC Chiller Compressor Banks (室外機) (~33% of buildings)
    const hx = x - width * 0.22;
    const hz = z - depth * 0.22;
    builder.box(hx, y + 0.45, hz, 1.5, 0.9, 0.8, "#94a3b8", MATERIAL.METAL);
    // Dual fan louvers with circular dark grilles
    for (const fx of [-0.38, 0.38]) {
      builder.beam([hx + fx, y + 0.45, hz + 0.39], [hx + fx, y + 0.45, hz + 0.42], 0.28, "#1e293b", MATERIAL.METAL, 6);
    }
  } else if (rVal < 0.78 && width >= 8 && depth >= 8) {
    // 3. Elevator Overrun Penthouse (階段室・機械室) & Rooftop Antenna (~23% of buildings)
    const px = x + width * 0.20;
    const pz = z + depth * 0.20;
    // Concrete penthouse cube
    builder.box(px, y + 1.05, pz, 2.6, 2.1, 2.6, "#64748b", MATERIAL.MATTE);
    builder.box(px, y + 2.15, pz, 2.9, 0.12, 2.9, "#475569", MATERIAL.MATTE);
    // Metal access door
    builder.box(px, y + 0.9, pz + 1.31, 0.75, 1.6, 0.04, "#334155", MATERIAL.METAL);
    // Steel antenna mast
    builder.beam([px, y + 2.2, pz], [px, y + 5.8, pz], 0.03, "#cbd5e1", MATERIAL.METAL, 4);
    builder.cylinder(px, y + 5.85, pz, 0.065, 0.065, 0.08, "#fbbf24", MATERIAL.EMISSIVE, 6);
  }
}

// Street-level Shopfront with Fabric Awning and Warm Display Windows (商店・カフェ)
export function addStreetShopfront(builder, x, y, z, width, depth, yaw, label = "CAFE", awningColor = "#b91c1c") {
  builder.push(x, y, z, 0, yaw);
  // Dark charcoal aluminum entrance storefront frame
  builder.box(0, 1.45, depth / 2 + 0.05, Math.min(width * 0.85, 5.4), 2.9, 0.10, "#1e293b", MATERIAL.METAL);
  // Large glowing display window (warm indoor lighting)
  builder.box(0.9, 1.40, depth / 2 + 0.09, Math.min(width * 0.45, 2.8), 2.1, 0.04, "#fef3c7", MATERIAL.EMISSIVE);
  // Glass entrance door
  builder.box(-1.1, 1.35, depth / 2 + 0.09, 1.1, 2.3, 0.04, "#0f172a", MATERIAL.GLASS);
  // Chrome door push bar
  builder.beam([-0.65, 1.25, depth / 2 + 0.12], [-0.65, 1.55, depth / 2 + 0.12], 0.02, "#f8fafc", MATERIAL.METAL, 4);

  // Striped Fabric Awning (日よけオーニング) projecting 1.4m over sidewalk
  const awWidth = Math.min(width * 0.90, 5.6);
  const awDepth = 1.35;
  // Slanted fabric roof
  builder.quad(
    [-awWidth / 2, 2.9, depth / 2 + 0.05],
    [awWidth / 2, 2.9, depth / 2 + 0.05],
    [awWidth / 2, 2.2, depth / 2 + awDepth],
    [-awWidth / 2, 2.2, depth / 2 + awDepth],
    awningColor,
    MATERIAL.MATTE
  );
  // Vertical scalloped valance
  builder.box(0, 2.05, depth / 2 + awDepth, awWidth, 0.34, 0.04, awningColor, MATERIAL.MATTE);
  // Alternating white stripes on the valance (quads for zero triangle waste)
  for (let s = -3; s <= 3; s += 2) {
    const sx = s * (awWidth / 8);
    const sw = awWidth / 16;
    builder.quad(
      [sx - sw, 1.88, depth / 2 + awDepth + 0.022],
      [sx + sw, 1.88, depth / 2 + awDepth + 0.022],
      [sx + sw, 2.22, depth / 2 + awDepth + 0.022],
      [sx - sw, 2.22, depth / 2 + awDepth + 0.022],
      "#ffffff",
      MATERIAL.MATTE
    );
  }

  // Micro-typography storefront sign
  addTokyoSign(builder, label, 0, 2.65, depth / 2 + 0.08, Math.min(awWidth * 0.65, 3.2), 0.52, "#0f172a", "#f8fafc", "#fbbf24");

  builder.pop();
}

// Shibuya River Promenade Detailing (渋谷川遊歩道): Staggered natural rhythm, no twin clones
export function addShibuyaRiverPromenadeDetails(builder) {
  const halfRiver = Math.floor(SHIBUYA_RIVER.length / 2);

  for (const part of ["north", "south"]) {
    builder.beginAsset(`Shibuya promenade ${part}`);
    const startIdx = part === "north" ? 1 : halfRiver;
    const endIdx = part === "north" ? halfRiver : SHIBUYA_RIVER.length;

    for (let i = startIdx; i < endIdx; i += 4) {
      const p = SHIBUYA_RIVER[i];
      // Alternating single side per step (never twin identical clones across the water)
      const lampSide = (i % 8 === 0) ? 1 : -1;
      const bx = p[0] + lampSide * 8.8;
      const bz = p[1];

      if (distanceToRiver(bx, bz) >= 8.2 && distanceToRailway(bx, bz) >= 7.5) {
        // Granite promenade bollard lamp with warm glowing slit
        builder.box(bx, 0.45, bz, 0.28, 0.90, 0.28, "#475569", MATERIAL.MATTE);
        builder.box(bx, 0.72, bz + lampSide * 0.12, 0.22, 0.12, 0.06, "#fef08a", MATERIAL.EMISSIVE);
      }

      // Staggered planter box with varied tree scale (only every 6-8 segments)
      if (i % 6 === 1) {
        const treeSide = -lampSide;
        const px = p[0] + treeSide * 8.8 + (i % 3 === 0 ? 1.4 : -1.4);
        const pz = p[1] + 2.0;
        if (distanceToRiver(px, pz) >= 9.0 && distanceToRailway(px, pz) >= 7.5) {
          const treeH = 1.4 + (i % 3) * 0.35;
          // Stone planter box
          builder.box(px, 0.24, pz, 1.8, 0.48, 1.8, "#64748b", MATERIAL.MATTE);
          builder.box(px, 0.46, pz, 1.6, 0.08, 1.6, "#334155", MATERIAL.MATTE);
          // Tree trunk
          builder.cylinder(px, treeH * 0.6, pz, 0.09, 0.12, treeH, "#78350f", MATERIAL.MATTE, 6);
          // Foliage tiers
          builder.cylinder(px, treeH * 1.15, pz, 1.1, 0.8, 0.9, "#15803d", MATERIAL.MATTE, 8);
          builder.cylinder(px, treeH * 1.55, pz, 0.85, 0.3, 0.8, "#16a34a", MATERIAL.MATTE, 8);
        }
      }
    }
    builder.endAsset();
  }
}

// Building Facade Fenestration (4 distinct archetypes to eliminate repetition)
export function addBuildingFacade(builder, width, depth, height, floors, seed = 0, hasShop = false) {
  const floorH = height / floors;
  const archetype = seed % 4; // 0: Ribbon Glazing, 1: Balconies, 2: Punched Stone Grid, 3: Boutique Showcase
  const startFloor = hasShop ? 1 : 0;

  // Horizontal floor belt courses (cornices / stringers) between floors
  for (let f = 1; f < floors; f++) {
    const fy = f * floorH;
    builder.box(0, fy, depth / 2 + 0.035, width + 0.08, 0.14, 0.07, "#94a3b8", MATERIAL.MATTE);
  }

  if (archetype === 0) {
    // Archetype 0: Modern Commercial Ribbon Glazing (連続水平帯窓)
    for (let f = startFloor; f < floors; f++) {
      const fy = (f + 0.5) * floorH;
      const winH = floorH * 0.52;
      const ribbonW = width * 0.86;
      // Dark glass ribbon
      builder.quad(
        [-ribbonW / 2, fy - winH / 2, depth / 2 + 0.015],
        [ribbonW / 2, fy - winH / 2, depth / 2 + 0.015],
        [ribbonW / 2, fy + winH / 2, depth / 2 + 0.015],
        [-ribbonW / 2, fy + winH / 2, depth / 2 + 0.015],
        "#1e293b",
        MATERIAL.GLASS
      );
      // Warm lit office section (~35% width)
      const litOffset = ((seed + f) % 3 - 1) * (ribbonW * 0.25);
      const litW = ribbonW * 0.35;
      builder.quad(
        [litOffset - litW / 2, fy - winH / 2, depth / 2 + 0.018],
        [litOffset + litW / 2, fy - winH / 2, depth / 2 + 0.018],
        [litOffset + litW / 2, fy + winH / 2, depth / 2 + 0.018],
        [litOffset - litW / 2, fy + winH / 2, depth / 2 + 0.018],
        "#fef08a",
        MATERIAL.EMISSIVE
      );
      // Vertical aluminum mullions (quads for efficiency)
      for (let mx = -ribbonW / 2 + 1.8; mx < ribbonW / 2; mx += 1.8) {
        builder.quad(
          [mx - 0.025, fy - winH / 2, depth / 2 + 0.022],
          [mx + 0.025, fy - winH / 2, depth / 2 + 0.022],
          [mx + 0.025, fy + winH / 2, depth / 2 + 0.022],
          [mx - 0.025, fy + winH / 2, depth / 2 + 0.022],
          "#64748b",
          MATERIAL.METAL
        );
      }
    }
  } else if (archetype === 1) {
    // Archetype 1: Tokyo Residential Apartment with Cantilevered Balconies (マンションベランダ)
    const cols = Math.max(2, Math.floor(width / 2.6));
    const colW = width / cols;
    for (let f = startFloor; f < floors; f++) {
      const fy = (f + 0.5) * floorH;
      const winH = floorH * 0.55;
      const winW = colW * 0.65;
      for (let c = 0; c < cols; c++) {
        const wx = -width / 2 + (c + 0.5) * colW;
        const isLit = mulberry32(seed * 29 + f * 17 + c * 31)() < 0.28;
        // Sliding glass balcony door
        builder.quad(
          [wx - winW / 2, fy - winH / 2, depth / 2 + 0.015],
          [wx + winW / 2, fy - winH / 2, depth / 2 + 0.015],
          [wx + winW / 2, fy + winH / 2, depth / 2 + 0.015],
          [wx - winW / 2, fy + winH / 2, depth / 2 + 0.015],
          isLit ? "#fef08a" : "#1e293b",
          isLit ? MATERIAL.EMISSIVE : MATERIAL.GLASS
        );
        if (c === 0) {
          // Concrete Balcony Slab
          const balW = winW + 0.35;
          const balY = f * floorH + 0.06;
          builder.box(wx, balY, depth / 2 + 0.45, balW, 0.10, 0.85, "#cbd5e1", MATERIAL.MATTE);
          // Balcony Front Railing
          builder.quad(
            [wx - balW / 2, balY + 0.05, depth / 2 + 0.86],
            [wx + balW / 2, balY + 0.05, depth / 2 + 0.86],
            [wx + balW / 2, balY + 0.72, depth / 2 + 0.86],
            [wx - balW / 2, balY + 0.72, depth / 2 + 0.86],
            "#475569",
            MATERIAL.METAL
          );
          // Top handrail (quad strip for efficiency)
          builder.quad(
            [wx - balW / 2, balY + 0.70, depth / 2 + 0.865],
            [wx + balW / 2, balY + 0.70, depth / 2 + 0.865],
            [wx + balW / 2, balY + 0.74, depth / 2 + 0.865],
            [wx - balW / 2, balY + 0.74, depth / 2 + 0.865],
            "#1e293b",
            MATERIAL.METAL
          );
        } else {
          // Standard window sill on secondary bay
          builder.quad(
            [wx - winW / 2 - 0.05, fy - winH / 2, depth / 2 + 0.015],
            [wx + winW / 2 + 0.05, fy - winH / 2, depth / 2 + 0.015],
            [wx + winW / 2 + 0.05, fy - winH / 2 - 0.06, depth / 2 + 0.07],
            [wx - winW / 2 - 0.05, fy - winH / 2 - 0.06, depth / 2 + 0.07],
            "#64748b",
            MATERIAL.MATTE
          );
        }
      }
    }
  } else if (archetype === 2) {
    // Archetype 2: Classical Punched Stone Window Grid (窓グリッド・石庇)
    const cols = Math.max(2, Math.floor(width / 2.2));
    const colW = width / cols;
    for (let f = startFloor; f < floors; f++) {
      const fy = (f + 0.5) * floorH;
      const winH = floorH * 0.46;
      const winW = colW * 0.52;
      for (let c = 0; c < cols; c++) {
        const wx = -width / 2 + (c + 0.5) * colW;
        const isLit = mulberry32(seed * 37 + f * 19 + c * 43)() < 0.28;
        // Window pane quad
        builder.quad(
          [wx - winW / 2, fy - winH / 2, depth / 2 + 0.015],
          [wx + winW / 2, fy - winH / 2, depth / 2 + 0.015],
          [wx + winW / 2, fy + winH / 2, depth / 2 + 0.015],
          [wx - winW / 2, fy + winH / 2, depth / 2 + 0.015],
          isLit ? "#fef08a" : "#1e293b",
          isLit ? MATERIAL.EMISSIVE : MATERIAL.GLASS
        );
        // Slanted stone window sill
        builder.quad(
          [wx - winW / 2 - 0.05, fy - winH / 2, depth / 2 + 0.015],
          [wx + winW / 2 + 0.05, fy - winH / 2, depth / 2 + 0.015],
          [wx + winW / 2 + 0.05, fy - winH / 2 - 0.06, depth / 2 + 0.07],
          [wx - winW / 2 - 0.05, fy - winH / 2 - 0.06, depth / 2 + 0.07],
          "#64748b",
          MATERIAL.MATTE
        );
      }
    }
  } else {
    // Archetype 3: Daikanyama Minimalist Boutique / Design Studio Showcase (ブティック・大開口)
    const winH = Math.min(height * 0.70, 7.5);
    const winW = width * 0.75;
    const fy = winH / 2 + 0.6;
    // Tall architectural display window
    builder.quad(
      [-winW / 2, fy - winH / 2, depth / 2 + 0.015],
      [winW / 2, fy - winH / 2, depth / 2 + 0.015],
      [winW / 2, fy + winH / 2, depth / 2 + 0.015],
      [-winW / 2, fy + winH / 2, depth / 2 + 0.015],
      "#0f172a",
      MATERIAL.GLASS
    );
    // Interior warm showcase lighting
    builder.quad(
      [-winW * 0.35, fy - winH * 0.35, depth / 2 + 0.02],
      [winW * 0.35, fy - winH * 0.35, depth / 2 + 0.02],
      [winW * 0.35, fy + winH * 0.35, depth / 2 + 0.02],
      [-winW * 0.35, fy + winH * 0.35, depth / 2 + 0.02],
      "#fef3c7",
      MATERIAL.EMISSIVE
    );
    // Minimalist concrete lintel
    builder.box(0, fy + winH / 2 + 0.12, depth / 2 + 0.06, winW + 0.4, 0.22, 0.12, "#cbd5e1", MATERIAL.MATTE);
  }

  // Side wall windows for corner buildings (~40% of buildings)
  if (seed % 3 === 0 && depth >= 6.5) {
    const sideX = (seed % 2 === 0) ? width / 2 : -width / 2;
    const sideZ = (seed % 5 === 0) ? depth * 0.15 : -depth * 0.15;
    const sideW = Math.min(2.0, depth * 0.32);
    for (let f = startFloor; f < floors; f++) {
      const fy = (f + 0.5) * floorH;
      const winH = floorH * 0.44;
      const isLit = mulberry32(seed * 41 + f * 23)() < 0.25;
      const sOffset = sideX > 0 ? 0.015 : -0.015;
      builder.quad(
        [sideX + sOffset, fy - winH / 2, sideZ - sideW / 2],
        [sideX + sOffset, fy - winH / 2, sideZ + sideW / 2],
        [sideX + sOffset, fy + winH / 2, sideZ + sideW / 2],
        [sideX + sOffset, fy + winH / 2, sideZ - sideW / 2],
        isLit ? "#fef08a" : "#1e293b",
        isLit ? MATERIAL.EMISSIVE : MATERIAL.GLASS
      );
    }
  }
}

// Authentic Tokyo Steel Fire Escape (非常階段) zigzagging along the exterior wall
export function addTokyoFireEscape(builder, x, y, z, width, depth, height, floors, side = 1) {
  const stairWidth = 1.35;
  const stairDepth = 2.4;
  const floorH = height / floors;
  const sx = x + side * (width / 2 + stairWidth / 2 + 0.05);

  // Vertical steel tubular corner columns
  for (const cx of [-stairWidth / 2 + 0.05, stairWidth / 2 - 0.05]) {
    for (const cz of [-stairDepth / 2 + 0.05, stairDepth / 2 - 0.05]) {
      builder.cylinder(sx + cx, y + height / 2, z + cz, 0.04, 0.04, height, "#334155", MATERIAL.METAL, 4);
    }
  }

  for (let f = 1; f < floors; f++) {
    const fy = y + f * floorH;
    // Cantilever steel landing platform
    builder.box(sx, fy, z, stairWidth, 0.08, stairDepth, "#475569", MATERIAL.METAL);
    // Outer safety railings (quads for zero waste)
    for (const cz of [-stairDepth / 2 + 0.04, stairDepth / 2 - 0.04]) {
      builder.box(sx, fy + 0.45, z + cz, stairWidth, 0.85, 0.04, "#cbd5e1", MATERIAL.METAL);
    }
    builder.box(sx + side * (stairWidth / 2 - 0.04), fy + 0.45, z, 0.04, 0.85, stairDepth, "#cbd5e1", MATERIAL.METAL);
    // Exit door from building
    builder.box(x + side * (width / 2 + 0.02), fy + 1.05, z, 0.04, 1.9, 0.85, "#1e293b", MATERIAL.METAL);
    // Diagonal flight stairs connecting floors
    if (f < floors - 1) {
      const dir = (f % 2 === 0) ? 1 : -1;
      builder.beam(
        [sx, fy + 0.05, z - dir * (stairDepth * 0.35)],
        [sx, fy + floorH - 0.05, z + dir * (stairDepth * 0.35)],
        0.08,
        "#334155",
        MATERIAL.METAL,
        4
      );
    }
  }
}

// Vertical Illuminated Japanese Tenant Signboard (袖看板)
export function addTenantSign(builder, x, y, z, depth, yaw = 0, isLit = true) {
  builder.push(x, y, z, 0, yaw);
  // Steel support bracket arms extending from wall
  builder.box(0, 1.2, depth / 2 + 0.35, 0.08, 0.08, 0.70, "#334155", MATERIAL.METAL);
  builder.box(0, 3.2, depth / 2 + 0.35, 0.08, 0.08, 0.70, "#334155", MATERIAL.METAL);
  // Vertical sign box
  builder.box(0, 2.2, depth / 2 + 0.75, 0.16, 2.4, 0.65, "#f8fafc", isLit ? MATERIAL.EMISSIVE : MATERIAL.MATTE);
  // Side dark trim frame
  builder.box(0, 2.2, depth / 2 + 0.75, 0.18, 2.46, 0.69, "#1e293b", MATERIAL.METAL);
  // Colorful vertical banner stripe (representing Tokyo tenant signage like 歯科, 塾, サロン, etc.)
  builder.box(0.10, 2.2, depth / 2 + 0.75, 0.02, 2.1, 0.45, "#dc2626", MATERIAL.EMISSIVE);
  builder.box(-0.10, 2.2, depth / 2 + 0.75, 0.02, 2.1, 0.45, "#dc2626", MATERIAL.EMISSIVE);
  builder.pop();
}

// Facade Fenestration and architectural detailing for PLATEAU GIS buildings
export function addPlateauBuildingDetail(builder, x, z, width, depth, height, floors, index) {
  const floorH = height / floors;
  if (floorH < 2.2) return;

  // Horizontal floor spandrel belt courses (帯・胴差)
  for (let f = 1; f < floors; f++) {
    const fy = f * floorH;
    builder.box(x, fy, z, width + 0.14, 0.18, depth + 0.14, "#475569", MATERIAL.MATTE);
  }

  // Street/Railway facing window rows on front and back
  const cols = Math.max(2, Math.min(8, Math.floor(width / 2.8)));
  const colW = width / cols;
  const winW = colW * 0.62;
  const winH = floorH * 0.50;

  for (let f = 1; f < floors; f++) {
    const fy = (f + 0.5) * floorH;
    for (let c = 0; c < cols; c++) {
      const wx = x - width / 2 + (c + 0.5) * colW;
      const isLit = mulberry32(index * 53 + f * 29 + c * 17)() < 0.30;
      // Front facade window
      builder.quad(
        [wx - winW / 2, fy - winH / 2, z + depth / 2 + 0.02],
        [wx + winW / 2, fy - winH / 2, z + depth / 2 + 0.02],
        [wx + winW / 2, fy + winH / 2, z + depth / 2 + 0.02],
        [wx - winW / 2, fy + winH / 2, z + depth / 2 + 0.02],
        isLit ? "#fef08a" : "#1e293b",
        isLit ? MATERIAL.EMISSIVE : MATERIAL.GLASS
      );
      // Front window sill
      builder.quad(
        [wx - winW / 2 - 0.04, fy - winH / 2, z + depth / 2 + 0.02],
        [wx + winW / 2 + 0.04, fy - winH / 2, z + depth / 2 + 0.02],
        [wx + winW / 2 + 0.04, fy - winH / 2 - 0.06, z + depth / 2 + 0.08],
        [wx - winW / 2 - 0.04, fy - winH / 2 - 0.06, z + depth / 2 + 0.08],
        "#64748b",
        MATERIAL.MATTE
      );

      // Back facade window (if building isn't excessively deep)
      if (depth < 40) {
        builder.quad(
          [wx + winW / 2, fy - winH / 2, z - depth / 2 - 0.02],
          [wx - winW / 2, fy - winH / 2, z - depth / 2 - 0.02],
          [wx - winW / 2, fy + winH / 2, z - depth / 2 - 0.02],
          [wx + winW / 2, fy + winH / 2, z - depth / 2 - 0.02],
          isLit ? "#fef08a" : "#1e293b",
          isLit ? MATERIAL.EMISSIVE : MATERIAL.GLASS
        );
      }
    }
  }

  // External steel fire escape on selected corner/commercial buildings (with road clearance)
  if (index % 4 === 1 && width >= 8 && depth >= 9 && floors >= 3 && floors <= 9) {
    if (distanceToRoad(x, z) > 2.0) {
      addTokyoFireEscape(builder, x, 0, z, width, depth, height, floors, index % 2 === 0 ? 1 : -1);
    }
  }

  // Vertical tenant sign on selected street-facing buildings (with road clearance)
  if (index % 3 === 0 && width >= 7 && floors >= 3) {
    if (distanceToRoad(x, z) > 1.8) {
      addTenantSign(builder, x + width * 0.35, 1.5, z, depth, 0, true);
    }
  }
}

