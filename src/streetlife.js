import { MATERIAL } from "./builder.js";
import { distanceToRiver, distanceToRailway } from "./map-model.js";
import { renderGlyphText, addTokyoSign } from "./signage.js";

// Authentic Japanese Traffic Signal Gantry (車両・歩行者用信号機)
export function addJapaneseTrafficLight(builder, x, y, z, yaw = 0, isGreen = true) {
  builder.push(x, y, z, 0, yaw);
  // Main vertical steel post (grey)
  builder.cylinder(0, 2.6, 0, 0.08, 0.10, 5.2, "#475569", MATERIAL.METAL, 8);
  builder.cylinder(0, 0.15, 0, 0.18, 0.22, 0.30, "#334155", MATERIAL.METAL, 8);

  // Horizontal cantilever arm extending 2.8m over the road
  builder.beam([0, 4.8, 0], [2.6, 4.8, 0], 0.045, "#475569", MATERIAL.METAL, 4);
  builder.beam([0, 4.2, 0], [1.4, 4.8, 0], 0.035, "#475569", MATERIAL.METAL, 4);

  // Vehicular Signal Head (3 horizontal circular lenses: Blue/Green, Amber, Red)
  builder.box(2.2, 4.8, 0.12, 1.35, 0.44, 0.18, "#334155", MATERIAL.METAL);
  // Back visors (hoods)
  for (let i = -1; i <= 1; i += 1) {
    const lx = 2.2 + i * 0.40;
    const lensColor = i === -1 ? (isGreen ? "#34d399" : "#1e293b") :
                      i === 0 ? "#1e293b" :
                      (!isGreen ? "#ef4444" : "#1e293b");
    const isLit = (i === -1 && isGreen) || (i === 1 && !isGreen);
    builder.beam([lx, 4.8, 0.20], [lx, 4.8, 0.23], 0.14, lensColor, isLit ? MATERIAL.EMISSIVE : MATERIAL.MATTE, 8);
    // Upper hood visor
    builder.box(lx, 4.95, 0.25, 0.32, 0.06, 0.14, "#1e293b", MATERIAL.METAL);
  }

  // Pedestrian Signal Box (歩行者用信号機: 2 vertical lenses) on the sidewalk post
  builder.box(0, 2.6, 0.16, 0.32, 0.65, 0.16, "#334155", MATERIAL.METAL);
  // Red standing figure lens (top)
  builder.beam([0, 2.78, 0.23], [0, 2.78, 0.25], 0.10, !isGreen ? "#ef4444" : "#1e293b", !isGreen ? MATERIAL.EMISSIVE : MATERIAL.MATTE, 8);
  // Green walking figure lens (bottom)
  builder.beam([0, 2.42, 0.23], [0, 2.42, 0.25], 0.10, isGreen ? "#34d399" : "#1e293b", isGreen ? MATERIAL.EMISSIVE : MATERIAL.MATTE, 8);

  builder.pop();
}

// Tokyo Curbside Streetlamp (街路灯) with curved luminaire head
export function addCurbsideStreetLamp(builder, x, y, z, yaw = 0) {
  builder.push(x, y, z, 0, yaw);
  // Base flange
  builder.cylinder(0, 0.12, 0, 0.14, 0.16, 0.24, "#334155", MATERIAL.METAL, 8);
  // Slender vertical pole (H = 4.4m)
  builder.cylinder(0, 2.2, 0, 0.05, 0.07, 4.4, "#475569", MATERIAL.METAL, 8);
  // Curved upper arm extending forward over the curb
  builder.beam([0, 4.3, 0], [0.55, 4.75, 0], 0.04, "#475569", MATERIAL.METAL, 4);
  builder.beam([0.55, 4.75, 0], [1.10, 4.65, 0], 0.035, "#475569", MATERIAL.METAL, 4);
  // Luminaire fixture
  builder.box(1.05, 4.62, 0, 0.44, 0.10, 0.22, "#1e293b", MATERIAL.METAL);
  // Downward warm light diffuser
  builder.box(1.05, 4.56, 0, 0.38, 0.03, 0.18, "#fef08a", MATERIAL.EMISSIVE);
  builder.pop();
}

// Iconic Japanese Drink Vending Machines (自動販売機 - Jihanki)
export function addVendingMachines(builder, x, y, z, yaw = 0) {
  builder.push(x, y, z, 0, yaw);
  // Concrete base pad
  builder.box(0, 0.05, 0, 2.2, 0.10, 0.85, "#94a3b8", MATERIAL.MATTE);

  // Machine 1: Red Coca-Cola / Hot & Cold beverage machine
  builder.box(-0.55, 0.95, 0, 0.85, 1.70, 0.65, "#dc2626", MATERIAL.MATTE);
  // Product display window with warm glow
  builder.box(-0.55, 1.25, 0.33, 0.72, 0.65, 0.03, "#fef9c3", MATERIAL.EMISSIVE);
  // Cans dispenser slot
  builder.box(-0.55, 0.45, 0.33, 0.55, 0.22, 0.04, "#1e293b", MATERIAL.MATTE);
  // Coin slot / return lever
  builder.box(-0.25, 0.85, 0.33, 0.08, 0.12, 0.02, "#fbbf24", MATERIAL.METAL);

  // Machine 2: Dark Blue Boss Coffee / Tea machine
  builder.box(0.40, 0.95, 0, 0.85, 1.70, 0.65, "#1d4ed8", MATERIAL.MATTE);
  // Product display window
  builder.box(0.40, 1.25, 0.33, 0.72, 0.65, 0.03, "#dbeafe", MATERIAL.EMISSIVE);
  // Dispenser slot
  builder.box(0.40, 0.45, 0.33, 0.55, 0.22, 0.04, "#1e293b", MATERIAL.MATTE);

  // Beverage Can & Bottle Recycling Bin (リサイクルBOX)
  builder.box(1.02, 0.48, 0, 0.36, 0.86, 0.42, "#059669", MATERIAL.MATTE);
  // Twin circular drop holes
  builder.beam([0.96, 0.80, 0.19], [0.96, 0.80, 0.22], 0.05, "#0f172a", MATERIAL.MATTE, 6);
  builder.beam([1.08, 0.80, 0.19], [1.08, 0.80, 0.22], 0.05, "#0f172a", MATERIAL.MATTE, 6);

  builder.pop();
}

// Japanese Red Postal Collection Box (郵便ポスト 〒)
export function addPostBox(builder, x, y, z, yaw = 0) {
  builder.push(x, y, z, 0, yaw);
  // Steel pedestal post
  builder.cylinder(0, 0.25, 0, 0.08, 0.10, 0.50, "#64748b", MATERIAL.METAL, 8);
  // Bright red postal box body
  builder.box(0, 0.85, 0, 0.62, 0.70, 0.45, "#e11d48", MATERIAL.MATTE);
  // Curved top cap
  builder.box(0, 1.22, 0, 0.66, 0.06, 0.49, "#be123c", MATERIAL.MATTE);
  // Dual letter drop slots (standard mail & express mail)
  builder.box(-0.14, 1.05, 0.23, 0.18, 0.035, 0.02, "#1e293b", MATERIAL.MATTE);
  builder.box(0.14, 1.05, 0.23, 0.18, 0.035, 0.02, "#1e293b", MATERIAL.MATTE);
  // Japan Post "〒" mark
  renderGlyphText(builder, "〒", 0, 0.78, 0.23, 0.18, "#ffffff", MATERIAL.MATTE);
  builder.pop();
}

// Tokyo Mamachari Bicycles in Curbside Rack (駐輪ラック)
export function addBicycleRack(builder, x, y, z, yaw = 0, count = 3) {
  builder.push(x, y, z, 0, yaw);
  // Steel ground rail
  builder.box(0, 0.03, 0, count * 0.65 + 0.4, 0.06, 0.24, "#475569", MATERIAL.METAL);

  for (let i = 0; i < count; i += 1) {
    const bx = -((count - 1) * 0.65) / 2 + i * 0.65;
    const bikeColor = i % 3 === 0 ? "#b91c1c" : i % 3 === 1 ? "#1e40af" : "#0f766e";

    builder.push(bx, 0, 0);
    // Rear wheel
    builder.beam([0, 0.32, -0.47], [0, 0.32, -0.43], 0.28, "#0f172a", MATERIAL.MATTE, 8);
    builder.beam([0, 0.32, -0.46], [0, 0.32, -0.44], 0.22, "#94a3b8", MATERIAL.METAL, 6);
    // Front wheel
    builder.beam([0, 0.32, 0.43], [0, 0.32, 0.47], 0.28, "#0f172a", MATERIAL.MATTE, 8);
    builder.beam([0, 0.32, 0.44], [0, 0.32, 0.46], 0.22, "#94a3b8", MATERIAL.METAL, 6);

    // Frame tubes (diamond/step-through)
    builder.beam([0, 0.32, -0.45], [0, 0.32, 0], 0.018, bikeColor, MATERIAL.MATTE, 4);
    builder.beam([0, 0.32, 0], [0, 0.68, -0.12], 0.018, bikeColor, MATERIAL.MATTE, 4);
    builder.beam([0, 0.32, 0], [0, 0.72, 0.35], 0.018, bikeColor, MATERIAL.MATTE, 4);
    builder.beam([0, 0.32, 0.45], [0, 0.72, 0.35], 0.018, bikeColor, MATERIAL.MATTE, 4);

    // Saddle
    builder.box(0, 0.70, -0.12, 0.14, 0.04, 0.22, "#18181b", MATERIAL.MATTE);
    // Handlebars with front wire basket
    builder.beam([-0.22, 0.85, 0.32], [0.22, 0.85, 0.32], 0.014, "#cbd5e1", MATERIAL.METAL, 4);
    builder.box(0, 0.66, 0.46, 0.28, 0.20, 0.18, "#64748b", MATERIAL.METAL);

    builder.pop();
  }
  builder.pop();
}

// Tokyo Crown Taxi (東京タクシー) with glowing rooftop taxi lamp
export function addTokyoTaxi(builder, x, y, z, yaw = 0, bodyColor = "#155e75") {
  builder.push(x, y, z, 0, yaw);
  // Lower chassis
  builder.box(0, 0.32, 0, 1.82, 0.38, 4.4, bodyColor, MATERIAL.MATTE);
  // Bumpers
  builder.box(0, 0.22, 2.22, 1.76, 0.14, 0.12, "#cbd5e1", MATERIAL.METAL);
  builder.box(0, 0.22, -2.22, 1.76, 0.14, 0.12, "#cbd5e1", MATERIAL.METAL);

  // Passenger greenhouse cabin & tinted glazing
  builder.box(0, 0.88, -0.15, 1.62, 0.74, 2.4, "#0f172a", MATERIAL.GLASS);
  // Roof slab
  builder.box(0, 1.28, -0.15, 1.66, 0.08, 2.3, bodyColor, MATERIAL.MATTE);

  // Headlights & Taillights
  for (const side of [-1, 1]) {
    builder.box(side * 0.68, 0.38, 2.21, 0.32, 0.12, 0.02, "#fef08a", MATERIAL.EMISSIVE);
    builder.box(side * 0.68, 0.38, -2.21, 0.32, 0.12, 0.02, "#ef4444", MATERIAL.EMISSIVE);
  }

  // 4 Wheels
  for (const side of [-1, 1]) {
    for (const wz of [-1.3, 1.3]) {
      builder.beam([side * 0.80, 0.30, wz], [side * 0.96, 0.30, wz], 0.30, "#09090b", MATERIAL.MATTE, 8);
      builder.beam([side * 0.92, 0.30, wz], [side * 0.97, 0.30, wz], 0.16, "#94a3b8", MATERIAL.METAL, 6);
    }
  }

  // Glowing Rooftop Taxi Lamp (行灯 - あんどん)
  builder.box(0, 1.40, -0.15, 0.44, 0.16, 0.24, "#fef08a", MATERIAL.EMISSIVE);
  renderGlyphText(builder, "TAXI", 0, 1.39, -0.02, 0.28, "#0f172a", MATERIAL.MATTE);

  builder.pop();
}

// City Bus in classic white with crimson corporate stripe
export function addCityBus(builder, x, y, z, yaw = 0) {
  builder.push(x, y, z, 0, yaw);
  // Main bus body (White/Silver)
  builder.box(0, 1.45, 0, 2.45, 2.20, 8.8, "#f8fafc", MATERIAL.MATTE);
  // Crimson red corporate stripe
  builder.box(0, 0.88, 0, 2.47, 0.32, 8.82, "#d71920", MATERIAL.MATTE);
  // Lower dark skirt
  builder.box(0, 0.45, 0, 2.46, 0.55, 8.81, "#334155", MATERIAL.MATTE);

  // Large tinted panoramic passenger windows
  builder.box(0, 1.72, 0.3, 2.48, 0.85, 6.8, "#0f172a", MATERIAL.GLASS);
  // Front windshield
  builder.box(0, 1.72, 4.38, 2.30, 0.95, 0.08, "#0f172a", MATERIAL.GLASS);
  // Front destination LED sign (渋谷駅 SHIBUYA STA)
  builder.box(0, 2.32, 4.41, 1.4, 0.24, 0.02, "#090d10", MATERIAL.MATTE);
  renderGlyphText(builder, "SHIBUYA", 0, 2.31, 4.43, 1.1, "#fbbf24", MATERIAL.EMISSIVE);

  // Front headlights & fog lamps
  for (const side of [-1, 1]) {
    builder.box(side * 0.92, 0.58, 4.41, 0.35, 0.18, 0.04, "#fef08a", MATERIAL.EMISSIVE);
    builder.box(side * 0.92, 0.58, -4.41, 0.35, 0.18, 0.04, "#ef4444", MATERIAL.EMISSIVE);
  }

  // 6 Heavy Wheels
  for (const side of [-1, 1]) {
    for (const wz of [-2.6, -1.5, 2.8]) {
      builder.beam([side * 1.07, 0.46, wz], [side * 1.29, 0.46, wz], 0.44, "#09090b", MATERIAL.MATTE, 8);
      builder.beam([side * 1.24, 0.46, wz], [side * 1.30, 0.46, wz], 0.24, "#94a3b8", MATERIAL.METAL, 6);
    }
  }

  // Rooftop AC Pods
  builder.box(0, 2.70, 0.5, 1.5, 0.30, 2.6, "#cbd5e1", MATERIAL.MATTE);
  builder.pop();
}

// Compact Japanese Delivery Van (宅急便 / 軽バン)
export function addDeliveryVan(builder, x, y, z, yaw = 0, bodyColor = "#f1f5f9") {
  builder.push(x, y, z, 0, yaw);
  // Lower chassis
  builder.box(0, 0.32, 0, 1.70, 0.35, 3.8, bodyColor, MATERIAL.MATTE);
  // Cargo box (white)
  builder.box(0, 1.15, -0.4, 1.72, 1.40, 2.4, "#ffffff", MATERIAL.MATTE);
  // Delivery brand side band (Yamato green/yellow style)
  builder.box(0, 1.15, -0.4, 1.74, 0.25, 2.41, "#15803d", MATERIAL.MATTE);
  // Driver cab
  builder.box(0, 0.95, 1.15, 1.68, 1.05, 1.2, bodyColor, MATERIAL.MATTE);
  // Windshield
  builder.box(0, 1.05, 1.76, 1.54, 0.55, 0.04, "#0f172a", MATERIAL.GLASS);
  // 4 Wheels
  for (const side of [-1, 1]) {
    for (const wz of [-1.0, 1.1]) {
      builder.beam([side * 0.75, 0.28, wz], [side * 0.89, 0.28, wz], 0.28, "#09090b", MATERIAL.MATTE, 8);
    }
  }
  builder.pop();
}

// Iconic Tokyo Green Public Telephone Booth (公衆電話ボックス)
export function addTelephoneBooth(builder, x, y, z, yaw = 0) {
  builder.push(x, y, z, 0, yaw);
  // Concrete base curb
  builder.box(0, 0.05, 0, 1.1, 0.10, 1.1, "#94a3b8", MATERIAL.MATTE);
  // Aluminum frame corner posts
  for (const sx of [-0.45, 0.45]) {
    for (const sz of [-0.45, 0.45]) {
      builder.cylinder(sx, 1.15, sz, 0.025, 0.025, 2.2, "#475569", MATERIAL.METAL, 4);
    }
  }
  // Roof cap
  builder.box(0, 2.28, 0, 1.05, 0.14, 1.05, "#334155", MATERIAL.METAL);
  // Glass side & rear panels (tinted green glass)
  builder.box(-0.45, 1.25, 0, 0.02, 1.8, 0.88, "#059669", MATERIAL.GLASS);
  builder.box(0.45, 1.25, 0, 0.02, 1.8, 0.88, "#059669", MATERIAL.GLASS);
  builder.box(0, 1.25, -0.45, 0.88, 1.8, 0.02, "#059669", MATERIAL.GLASS);
  // Folding glass door (front)
  builder.box(0, 1.25, 0.45, 0.88, 1.8, 0.02, "#059669", MATERIAL.GLASS);
  // Interior shelf & green NTT payphone unit
  builder.box(0, 0.88, -0.15, 0.55, 0.06, 0.45, "#cbd5e1", MATERIAL.MATTE);
  builder.box(0, 1.12, -0.22, 0.28, 0.38, 0.22, "#15803d", MATERIAL.MATTE);
  builder.box(0, 1.16, -0.10, 0.14, 0.16, 0.02, "#fef08a", MATERIAL.EMISSIVE);
  // Ceiling warm downlight
  builder.box(0, 2.20, 0, 0.24, 0.02, 0.24, "#fef08a", MATERIAL.EMISSIVE);
  builder.pop();
}

// Bus Stop Shelter & Signpost (バス停留所)
export function addBusStop(builder, x, y, z, yaw = 0, stopName = "NAMIKIBASHI") {
  builder.push(x, y, z, 0, yaw);
  // Bus Stop Signpost with circular emblem head
  builder.cylinder(-1.6, 1.3, 0, 0.04, 0.04, 2.6, "#475569", MATERIAL.METAL, 6);
  // Round sign head disc
  builder.cylinder(-1.6, 2.5, 0, 0.32, 0.32, 0.04, "#ffffff", MATERIAL.MATTE, 12);
  builder.cylinder(-1.6, 2.5, 0.025, 0.28, 0.28, 0.02, "#d71920", MATERIAL.MATTE, 12);
  // Timetable display box on post
  builder.box(-1.6, 1.35, 0, 0.38, 0.72, 0.12, "#334155", MATERIAL.METAL);
  builder.box(-1.6, 1.35, 0.07, 0.32, 0.65, 0.01, "#f8fafc", MATERIAL.MATTE);

  // Modern passenger shelter canopy
  builder.cylinder(0.6, 1.3, -0.6, 0.05, 0.05, 2.6, "#334155", MATERIAL.METAL, 6);
  builder.cylinder(-0.6, 1.3, -0.6, 0.05, 0.05, 2.6, "#334155", MATERIAL.METAL, 6);
  // Cantilevered glass roof canopy
  builder.box(0, 2.65, 0, 2.2, 0.08, 1.6, "#7a9cb0", MATERIAL.GLASS);
  builder.box(0, 2.70, -0.6, 2.22, 0.12, 0.12, "#1e293b", MATERIAL.METAL);
  // Waiting bench under shelter
  builder.box(0, 0.44, -0.35, 1.5, 0.06, 0.38, "#6b4f3a", MATERIAL.MATTE);
  for (const bx of [-0.6, 0.6]) {
    builder.cylinder(bx, 0.22, -0.35, 0.03, 0.03, 0.44, "#334155", MATERIAL.METAL, 4);
  }
  builder.pop();
}

// Japanese Kei Truck (軽トラ - Keitora) with open cargo bed & blue tarp
export function addKeiTruck(builder, x, y, z, yaw = 0, bodyColor = "#f8fafc") {
  builder.push(x, y, z, 0, yaw);
  // Cab body
  builder.box(0, 0.75, 0.85, 1.45, 1.05, 1.25, bodyColor, MATERIAL.MATTE);
  // Cab windshield
  builder.box(0, 0.95, 1.45, 1.32, 0.52, 0.04, "#0f172a", MATERIAL.GLASS);
  // Headlights & bumper
  builder.box(0, 0.32, 1.48, 1.42, 0.24, 0.10, "#475569", MATERIAL.MATTE);
  for (const side of [-1, 1]) {
    builder.box(side * 0.55, 0.40, 1.52, 0.22, 0.12, 0.02, "#fef08a", MATERIAL.EMISSIVE);
  }

  // Open cargo bed
  builder.box(0, 0.50, -0.65, 1.42, 0.12, 1.95, "#94a3b8", MATERIAL.MATTE);
  // Cargo bed side drop-gates
  for (const side of [-1, 1]) {
    builder.box(side * 0.69, 0.68, -0.65, 0.04, 0.28, 1.95, bodyColor, MATERIAL.MATTE);
  }
  builder.box(0, 0.68, -1.61, 1.42, 0.28, 0.04, bodyColor, MATERIAL.MATTE);
  // Cargo: Folded blue waterproof tarp / cargo boxes
  builder.box(0, 0.72, -0.55, 1.15, 0.32, 1.45, "#1d4ed8", MATERIAL.MATTE);

  // 4 Small Kei wheels
  for (const side of [-1, 1]) {
    for (const wz of [-0.85, 0.85]) {
      builder.beam([side * 0.64, 0.25, wz], [side * 0.78, 0.25, wz], 0.25, "#09090b", MATERIAL.MATTE, 8);
    }
  }
  builder.pop();
}

// Japanese Passenger Car / Hatchback (一般乗用車)
export function addTokyoSedan(builder, x, y, z, yaw = 0, bodyColor = "#334155") {
  builder.push(x, y, z, 0, yaw);
  // Lower chassis
  builder.box(0, 0.32, 0, 1.76, 0.36, 4.2, bodyColor, MATERIAL.MATTE);
  // Cabin & windows
  builder.box(0, 0.84, -0.15, 1.55, 0.68, 2.3, "#0f172a", MATERIAL.GLASS);
  builder.box(0, 1.20, -0.22, 1.58, 0.06, 2.0, bodyColor, MATERIAL.MATTE);
  // Front & rear lights
  for (const side of [-1, 1]) {
    builder.box(side * 0.64, 0.38, 2.11, 0.28, 0.12, 0.02, "#fef08a", MATERIAL.EMISSIVE);
    builder.box(side * 0.64, 0.38, -2.11, 0.28, 0.12, 0.02, "#ef4444", MATERIAL.EMISSIVE);
  }
  // 4 Wheels
  for (const side of [-1, 1]) {
    for (const wz of [-1.25, 1.25]) {
      builder.beam([side * 0.76, 0.28, wz], [side * 0.90, 0.28, wz], 0.28, "#09090b", MATERIAL.MATTE, 8);
    }
  }
  builder.pop();
}

// Traditional Tokyo Street Koban Police Box (交番)
export function addKobanPoliceBox(builder, x, y, z, yaw = 0) {
  builder.push(x, y, z, 0, yaw);
  // Building body
  builder.box(0, 1.6, 0, 3.8, 3.2, 3.4, "#f1f5f9", MATERIAL.MATTE);
  // Overhanging roof slab
  builder.box(0, 3.28, 0, 4.2, 0.18, 3.8, "#334155", MATERIAL.METAL);
  // Entrance door & window
  builder.box(0.6, 1.2, 1.71, 1.1, 2.2, 0.04, "#0f172a", MATERIAL.GLASS);
  builder.box(-0.8, 1.4, 1.71, 1.4, 1.4, 0.04, "#0f172a", MATERIAL.GLASS);
  // Iconic round red police globe light over the door
  builder.beam([0.6, 2.55, 1.71], [0.6, 2.55, 1.88], 0.12, "#ef4444", MATERIAL.EMISSIVE, 8);
  // Koban Gold Star emblem / sign
  builder.box(0, 2.92, 1.72, 1.8, 0.32, 0.04, "#1e293b", MATERIAL.METAL);
  renderGlyphText(builder, "KOBAN", 0, 2.91, 1.75, 1.4, "#fbbf24", MATERIAL.EMISSIVE);
  builder.pop();
}

// Tokyo Low-Poly Pedestrian (歩行者) with stride and attire variants
export function addPedestrian(builder, x, y, z, yaw = 0, options = {}) {
  const {
    shirtColor = "#3b82f6",
    pantsColor = "#1e293b",
    skinColor = "#fed7aa",
    hairColor = "#0f172a",
    hasBag = false,
    stride = 0.22,
    isFemale = false
  } = options;

  builder.push(x, y, z, 0, yaw);

  // Shoes & Feet
  builder.box(-0.10, 0.05, stride * 0.45, 0.11, 0.10, 0.22, "#0f172a", MATERIAL.MATTE);
  builder.box(0.10, 0.05, -stride * 0.45, 0.11, 0.10, 0.22, "#0f172a", MATERIAL.MATTE);

  // Legs (trousers / slacks)
  builder.box(-0.10, 0.44, stride * 0.22, 0.12, 0.70, 0.14, pantsColor, MATERIAL.MATTE);
  builder.box(0.10, 0.44, -stride * 0.22, 0.12, 0.70, 0.14, pantsColor, MATERIAL.MATTE);

  // Hips / Pelvis
  builder.box(0, 0.81, 0, 0.34, 0.14, 0.19, pantsColor, MATERIAL.MATTE);

  // Torso / Jacket / Shirt
  builder.box(0, 1.12, 0, 0.36, 0.50, 0.21, shirtColor, MATERIAL.MATTE);

  // Collar / Neck
  builder.box(0, 1.40, 0, 0.13, 0.10, 0.13, skinColor, MATERIAL.MATTE);

  // Head
  builder.box(0, 1.55, 0, 0.19, 0.21, 0.19, skinColor, MATERIAL.MATTE);
  // Hair / Cap
  builder.box(0, 1.66, -0.02, 0.21, 0.08, 0.21, hairColor, MATERIAL.MATTE);
  if (isFemale) {
    builder.box(0, 1.57, -0.11, 0.17, 0.17, 0.08, hairColor, MATERIAL.MATTE);
  }

  // Arms (swinging opposite to leg stride)
  builder.box(-0.23, 1.08, -stride * 0.38, 0.09, 0.46, 0.09, shirtColor, MATERIAL.MATTE);
  builder.box(-0.23, 0.80, -stride * 0.38, 0.07, 0.10, 0.07, skinColor, MATERIAL.MATTE);

  builder.box(0.23, 1.08, stride * 0.38, 0.09, 0.46, 0.09, shirtColor, MATERIAL.MATTE);
  builder.box(0.23, 0.80, stride * 0.38, 0.07, 0.10, 0.07, skinColor, MATERIAL.MATTE);

  // Optional Bag / Briefcase
  if (hasBag) {
    builder.box(0.28, 0.72, stride * 0.38, 0.07, 0.24, 0.28, "#78350f", MATERIAL.MATTE);
    builder.beam([0.26, 0.82, stride * 0.38], [0.26, 0.86, stride * 0.38], 0.02, "#451a03", MATERIAL.METAL, 4);
  }

  builder.pop();
}

// Tokyo Low-Poly Jogger / Runner (ランナー・ジョガー) with dynamic running posture
export function addJogger(builder, x, y, z, yaw = 0, options = {}) {
  const {
    shirtColor = "#0284c7",
    shortsColor = "#0f172a",
    shoeColor = "#fbbf24",
    skinColor = "#fed7aa",
    hairColor = "#1e293b",
    visorColor = "#f8fafc"
  } = options;

  // 0.10 rad (~6 deg) forward lean of athletic runner
  builder.push(x, y, z, 0.10, yaw);

  // Running shoes with white foam mid-soles
  builder.box(-0.11, 0.06, 0.22, 0.11, 0.09, 0.24, shoeColor, MATERIAL.MATTE);
  builder.box(-0.11, 0.02, 0.22, 0.12, 0.03, 0.25, "#ffffff", MATERIAL.MATTE);

  builder.box(0.11, 0.18, -0.25, 0.11, 0.09, 0.24, shoeColor, MATERIAL.MATTE);
  builder.box(0.11, 0.14, -0.25, 0.12, 0.03, 0.25, "#ffffff", MATERIAL.MATTE);

  // Lower legs (shins/calves in stride)
  builder.box(-0.11, 0.32, 0.16, 0.09, 0.40, 0.09, skinColor, MATERIAL.MATTE);
  builder.box(0.11, 0.42, -0.20, 0.09, 0.38, 0.09, skinColor, MATERIAL.MATTE);

  // Upper legs (running shorts)
  builder.box(-0.10, 0.65, 0.07, 0.13, 0.28, 0.14, shortsColor, MATERIAL.MATTE);
  builder.box(0.10, 0.68, -0.07, 0.13, 0.28, 0.14, shortsColor, MATERIAL.MATTE);

  // Pelvis
  builder.box(0, 0.81, 0, 0.32, 0.14, 0.19, shortsColor, MATERIAL.MATTE);

  // Torso in athletic singlet/tee
  builder.box(0, 1.10, 0, 0.34, 0.46, 0.19, shirtColor, MATERIAL.MATTE);

  // Neck
  builder.box(0, 1.36, 0, 0.11, 0.08, 0.11, skinColor, MATERIAL.MATTE);

  // Head with sports headband/visor
  builder.box(0, 1.50, 0.04, 0.18, 0.19, 0.18, skinColor, MATERIAL.MATTE);
  builder.box(0, 1.58, 0.04, 0.20, 0.07, 0.20, hairColor, MATERIAL.MATTE);
  builder.box(0, 1.54, 0.11, 0.21, 0.05, 0.13, visorColor, MATERIAL.MATTE);

  // Bent Running Arms (90 degree elbow bend)
  builder.beam([-0.21, 1.22, 0], [-0.21, 0.98, 0.16], 0.045, skinColor, MATERIAL.MATTE, 4);
  builder.box(-0.21, 0.98, 0.22, 0.07, 0.07, 0.07, skinColor, MATERIAL.MATTE);

  builder.beam([0.21, 1.22, 0], [0.21, 0.98, -0.16], 0.045, skinColor, MATERIAL.MATTE, 4);
  builder.box(0.21, 0.98, -0.22, 0.07, 0.07, 0.07, skinColor, MATERIAL.MATTE);

  builder.pop();
}

// Populate the diorama with architecturally aligned street furniture & vehicles
export function populateTokyoStreetlife(builder) {
  // 1. Traffic Signals at surveyed major street junctions (strictly on sidewalk curbs, well-spaced)
  const SIGNALS = [
    { x: -44, y: 0.06, z: -460, yaw: 0.42, green: true },
    { x: 38, y: 0.06, z: -350, yaw: 0.85, green: true },
    { x: 71.4, y: 0.06, z: -251.8, yaw: 0.72, green: false },
    { x: 122, y: 0.06, z: -115, yaw: 1.15, green: true },
    { x: 148, y: 0.06, z: 20, yaw: 1.48, green: true },
    { x: 176.6, y: 0.06, z: 177.6, yaw: 1.82, green: false },
    { x: 112, y: 0.06, z: 472, yaw: 2.15, green: true }
  ];

  const validSignals = SIGNALS.filter((s) => distanceToRiver(s.x, s.z) >= 8.5 && distanceToRailway(s.x, s.z) >= 7.0);
  const SIG_BATCH = 2;
  for (let i = 0; i < validSignals.length; i += SIG_BATCH) {
    builder.beginAsset(`traffic signals ${Math.floor(i / SIG_BATCH)}`);
    validSignals.slice(i, i + SIG_BATCH).forEach((s) => {
      addJapaneseTrafficLight(builder, s.x, s.y, s.z, s.yaw, s.green);
    });
    builder.endAsset();
  }

  // 2. Curbside Streetlamps along arterial avenues & shopping streets (separated >= 45m)
  const LAMPS = [
    // Shibuya Station West
    { x: -71.2, z: -486.3, yaw: 0.5 },
    { x: -106.1, z: -387.8, yaw: 0.7 },
    // Namikibashi corridor
    { x: 18, z: -330, yaw: 0.8 },
    { x: 58, z: -210, yaw: 1.0 },
    { x: 92.1, z: -95.5, yaw: 1.3 },
    // Hachiman-dori corridor (Daikanyama)
    { x: 142, z: 70, yaw: 1.5 },
    { x: 165, z: 220, yaw: 1.9 },
    // Daikanyama Station precinct
    { x: 95, z: 460, yaw: 2.1 },
    { x: 72, z: 535, yaw: 2.4 }
  ];

  const validLamps = LAMPS.filter((l) => distanceToRiver(l.x, l.z) >= 8.5 && distanceToRailway(l.x, l.z) >= 7.0);
  const LAMP_BATCH = 5;
  for (let i = 0; i < validLamps.length; i += LAMP_BATCH) {
    builder.beginAsset(`streetlamps ${Math.floor(i / LAMP_BATCH)}`);
    validLamps.slice(i, i + LAMP_BATCH).forEach((l) => {
      addCurbsideStreetLamp(builder, l.x, 0.06, l.z, l.yaw);
    });
    builder.endAsset();
  }

  // 3. Vending Machines (spatially dispersed >= 150m, unique colors/types, NO twin postboxes)
  const VENDORS = [
    { x: -40, z: -492, yaw: -1.57 },  // Shibuya dual machine (backed flush against building facade)
    { x: 105, z: -75, yaw: 1.2 },   // Mid-avenue green tea machine
    { x: 94, z: 455, yaw: 2.1 }     // Daikanyama sports drink machine
  ];

  const validVendors = VENDORS.filter((v) => distanceToRiver(v.x, v.z) >= 8.5 && distanceToRailway(v.x, v.z) >= 7.0);
  validVendors.forEach((v, idx) => {
    builder.beginAsset(`vending machine ${idx}`);
    addVendingMachines(builder, v.x, 0.06, v.z, v.yaw);
    builder.endAsset();
  });

  // 4. Standalone Red Post Boxes (〒) - only 2 across the 1.1km line, separated by 800m!
  builder.beginAsset("tokyo post box namikibashi");
  addPostBox(builder, 36, 0.06, -275, 0.85);
  builder.endAsset();

  builder.beginAsset("tokyo post box daikanyama");
  addPostBox(builder, 68, 0.06, 540, 2.45);
  builder.endAsset();

  // 5. Tokyo Public Telephone Booths (公衆電話) - 2 locations separated by 940m!
  builder.beginAsset("telephone booth shibuya");
  addTelephoneBooth(builder, -32, 0.06, -465, 0.35);
  builder.endAsset();

  builder.beginAsset("telephone booth daikanyama");
  addTelephoneBooth(builder, 102, 0.06, 475, 2.10);
  builder.endAsset();

  // 6. Bus Stop Shelter - unique transit landmark at Namikibashi
  builder.beginAsset("bus stop namikibashi");
  addBusStop(builder, 52, 0.06, -230, 0.95, "NAMIKIBASHI");
  builder.endAsset();

  // 7. Tokyo Koban Police Box - unique corner landmark near Namikibashi
  builder.beginAsset("tokyo koban");
  addKobanPoliceBox(builder, 24, 0.06, -320, 0.82);
  builder.endAsset();

  // 8. Bicycle Parking Racks - varying counts (3, 2, 3) well-spaced
  builder.beginAsset("bicycle rack shibuya");
  addBicycleRack(builder, -28, 0.06, -497, 0.30, 3);
  builder.endAsset();

  builder.beginAsset("bicycle rack namikibashi");
  addBicycleRack(builder, 92, 0.06, -105, 1.25, 2);
  builder.endAsset();

  builder.beginAsset("bicycle rack daikanyama");
  addBicycleRack(builder, 88, 0.06, 505, 2.25, 3);
  builder.endAsset();

  // 9. Tokyo Neighborhood Curbside Vehicles
  // Namikibashi shopping street: Japanese Kei Truck with cargo tarp (in-lane)
  builder.beginAsset("japanese kei truck");
  addKeiTruck(builder, 85.6, 0.06, -177.8, -2.505, "#f8fafc");
  builder.endAsset();

  // Mid-avenue delivery van (in-lane on tertiary avenue)
  builder.beginAsset("tokyo delivery van");
  addDeliveryVan(builder, 132.4, 0.06, 36.8, -0.899, "#fef08a");
  builder.endAsset();

  // Daikanyama residential approach: Passenger Sedan (in-lane)
  builder.beginAsset("tokyo passenger sedan");
  addTokyoSedan(builder, 161.4, 0.06, 188.0, -0.512, "#334155");
  builder.endAsset();

  // Daikanyama station rotary: Daikanyama Taxi (in-lane)
  builder.beginAsset("tokyo taxi daikanyama");
  addTokyoTaxi(builder, 59.9, 0.06, 538.1, -2.266, "#0f766e");  // Forest green taxi
  builder.endAsset();

  // 10. Shibuya Station & Scramble Crossing Pedestrians (渋谷駅前・スクランブル交差点歩行者)
  builder.beginAsset("pedestrians shibuya scramble");
  // Diagonal Scramble A (NW to SE)
  addPedestrian(builder, -52, 0.06, -551, 0.78, { shirtColor: "#3b82f6", hasBag: true });
  addPedestrian(builder, -45, 0.06, -544, 0.78, { shirtColor: "#10b981", isFemale: true });
  addPedestrian(builder, -38, 0.06, -537, 0.78, { shirtColor: "#e11d48" });
  // Diagonal Scramble B (SW to NE)
  addPedestrian(builder, -51, 0.06, -538, -0.78, { shirtColor: "#f59e0b", pantsColor: "#1e293b" });
  addPedestrian(builder, -42, 0.06, -547, -0.78, { shirtColor: "#8b5cf6", hasBag: true });
  addPedestrian(builder, -36, 0.06, -553, -0.78, { shirtColor: "#0284c7", isFemale: true });
  // Perimeter Crosswalks
  addPedestrian(builder, -46, 0.06, -562, 0.0, { shirtColor: "#f43f5e" });
  addPedestrian(builder, -26, 0.06, -542, 1.57, { shirtColor: "#0ea5e9", hasBag: true });
  // Commuters crossing at viaduct approach
  addPedestrian(builder, -45, 0.06, -446, 0.44, { shirtColor: "#334155", pantsColor: "#1e293b", hasBag: true });
  addPedestrian(builder, -43, 0.06, -444, 0.44, { shirtColor: "#f472b6", isFemale: true });
  // Pedestrians waiting on sidewalk curb corners
  addPedestrian(builder, -64, 0.06, -562, 0.78, { shirtColor: "#38bdf8", pantsColor: "#1e293b" });
  addPedestrian(builder, -26, 0.06, -562, -0.78, { shirtColor: "#fbbf24", isFemale: true });
  addPedestrian(builder, -64, 0.06, -526, 2.35, { shirtColor: "#64748b" });
  builder.endAsset();

  // 11. Shibuya River Promenade Pedestrians & Waterfront Joggers (渋谷川遊歩道・ランナー)
  builder.beginAsset("pedestrians river promenade");
  // Strollers and cafe pedestrians along the quiet water promenade
  addPedestrian(builder, 32, 0.06, -355, 0.82, { shirtColor: "#059669", pantsColor: "#1e293b" });
  addPedestrian(builder, 52, 0.06, -240, 0.95, { shirtColor: "#6366f1", pantsColor: "#334155", isFemale: true });
  addPedestrian(builder, 74, 0.06, -145, 1.15, { shirtColor: "#0284c7", pantsColor: "#0f172a", hasBag: true });
  // Dynamic runners along the riverside promenade path
  addJogger(builder, 34, 0.06, -338, 0.85, { shirtColor: "#ea580c", shoeColor: "#facc15" });
  addJogger(builder, 68, 0.06, -178, -2.10, { shirtColor: "#0284c7", shoeColor: "#4ade80" });
  builder.endAsset();

  // 12. Daikanyama Precinct & Namikibashi Sidewalk Pedestrians (代官山・並木橋歩行者)
  builder.beginAsset("pedestrians daikanyama and namikibashi");
  // Namikibashi shopping street
  addPedestrian(builder, 44, 0.06, -260, 0.88, { shirtColor: "#e11d48", pantsColor: "#1e293b", isFemale: true });
  addPedestrian(builder, 82, 0.06, -120, 1.20, { shirtColor: "#1e293b", pantsColor: "#475569", hasBag: true });
  // Daikanyama boutique shopping avenue
  addPedestrian(builder, 138, 0.06, 50, 1.50, { shirtColor: "#d97706", pantsColor: "#1e293b" });
  addPedestrian(builder, 173.5, 0.06, 183, 1.80, { shirtColor: "#4338ca", pantsColor: "#0f172a", isFemale: true });
  addPedestrian(builder, 92, 0.06, 495, 2.15, { shirtColor: "#047857", pantsColor: "#334155" });
  addPedestrian(builder, 66, 0.06, 532, 2.40, { shirtColor: "#be185d", pantsColor: "#1e293b", isFemale: true });
  builder.endAsset();
}
