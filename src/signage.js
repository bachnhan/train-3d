import { MATERIAL } from "./builder.js";

// 5x5 pixel-matrix font glyphs for micro-typography (A-Z, 0-9, symbols)
const GLYPHS = Object.freeze({
  A: ["01110", "10001", "11111", "10001", "10001"],
  B: ["11110", "10001", "11110", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "11110", "10000", "11111"],
  F: ["11111", "10000", "11110", "10000", "10000"],
  G: ["01111", "10000", "10111", "10001", "01110"],
  H: ["10001", "10001", "11111", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "11111"],
  J: ["00111", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "11100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001"],
  O: ["01110", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "11110", "10000", "10000"],
  Q: ["01110", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "11110", "10010", "10001"],
  S: ["01111", "10000", "01110", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10101", "11011", "10001"],
  X: ["10001", "01010", "00100", "01010", "10001"],
  Y: ["10001", "01010", "00100", "00100", "00100"],
  Z: ["11111", "00010", "00100", "01000", "11111"],
  "0": ["01110", "10011", "10101", "11001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "01110"],
  "2": ["11110", "00001", "01110", "10000", "11111"],
  "3": ["11110", "00001", "01110", "00001", "11110"],
  "4": ["10010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "11110"],
  "6": ["01111", "10000", "11110", "10001", "01110"],
  "7": ["11111", "00010", "00100", "01000", "01000"],
  "8": ["01110", "10001", "01110", "10001", "01110"],
  "9": ["01110", "10001", "01111", "00001", "11110"],
  "-": ["00000", "00000", "11111", "00000", "00000"],
  ":": ["00000", "00100", "00000", "00100", "00000"],
  "/": ["00001", "00010", "00100", "01000", "10000"],
  ".": ["00000", "00000", "00000", "00000", "00100"],
  "〒": ["11111", "00100", "11111", "00100", "00100"],
  " ": ["00000", "00000", "00000", "00000", "00000"]
});

export function renderGlyphText(builder, text, x, y, z, width, color = "#f8fafc", mat = MATERIAL.MATTE, normal = [0, 0, 1]) {
  const chars = String(text).toUpperCase().split("");
  const glyphPitch = 6;
  const totalSlots = Math.max(1, chars.length * glyphPitch - 1);
  const pixelSize = width / totalSlots;
  const left = x - width / 2;

  chars.forEach((ch, charIndex) => {
    const glyph = GLYPHS[ch];
    if (!glyph) return;
    glyph.forEach((row, rowIndex) => {
      for (let colIndex = 0; colIndex < 5; colIndex += 1) {
        if (row[colIndex] === "1") {
          const px = left + (charIndex * glyphPitch + colIndex) * pixelSize;
          const py = y + (2 - rowIndex) * pixelSize;
          // Render a crisp quad for each pixel glyph
          builder.quad(
            [px, py, z],
            [px + pixelSize * 0.88, py, z],
            [px + pixelSize * 0.88, py + pixelSize * 0.88, z],
            [px, py + pixelSize * 0.88, z],
            color,
            mat,
            normal
          );
        }
      }
    });
  });
}

// Renders an authentic sign plate with mounting frame and micro-typography
export function addTokyoSign(builder, text, x, y, z, width, height = 0.55, bgColor = "#1d2830", textColor = "#f8fafc", frameColor = "#a09885") {
  // Main backplate
  builder.box(x, y, z, width + 0.12, height, 0.05, bgColor, MATERIAL.MATTE);
  // Upper and lower brass/steel frame trims
  builder.box(x, y + height / 2, z + 0.026, width + 0.10, 0.02, 0.015, frameColor, MATERIAL.METAL);
  builder.box(x, y - height / 2, z + 0.026, width + 0.10, 0.02, 0.015, frameColor, MATERIAL.METAL);
  // Text
  const maxTextWidth = Math.min(width * 0.88, (height * 0.72 / 5) * Math.max(1, text.length * 6 - 1));
  renderGlyphText(builder, text, x, y - 0.02, z + 0.032, maxTextWidth, textColor, textColor === "#fbbf24" ? MATERIAL.EMISSIVE : MATERIAL.MATTE);
}

// Station Name Board (駅名標): Station red header with bilingual station code
export function addStationBoard(builder, stationCode, stationNameRomaji, x, y, z, width = 3.2, height = 0.85) {
  // Station signboard backplate (white)
  builder.box(x, y, z, width, height, 0.06, "#f8fafc", MATERIAL.MATTE);
  // Station red header strip
  builder.box(x, y + height * 0.35, z + 0.032, width, height * 0.28, 0.015, "#d71920", MATERIAL.MATTE);
  // Station code (e.g. TY01) in white on red
  renderGlyphText(builder, stationCode, x - width * 0.32, y + height * 0.33, z + 0.045, width * 0.24, "#ffffff", MATERIAL.MATTE);
  // Station name in navy/dark charcoal
  renderGlyphText(builder, stationNameRomaji, x, y - height * 0.14, z + 0.045, width * 0.75, "#1e293b", MATERIAL.MATTE);
  // Mounting posts
  for (const side of [-1, 1]) {
    builder.box(x + side * (width * 0.44), y - height * 0.5 - 0.4, z, 0.06, 0.8, 0.06, "#475569", MATERIAL.METAL);
  }
}

// Station Departure Board (発車案内表示器): Dark electronic board with amber/green text
export function addDepartureBoard(builder, x, y, z, width = 4.2, height = 1.35) {
  // Enclosing steel case
  builder.box(x, y, z, width + 0.16, height + 0.12, 0.18, "#182129", MATERIAL.METAL);
  // Inner dark display screen
  builder.box(x, y, z + 0.095, width, height, 0.01, "#090d10", MATERIAL.MATTE);
  // Header: "DEPARTURES" in cyan
  renderGlyphText(builder, "DEPARTURES", x, y + height * 0.36, z + 0.105, width * 0.65, "#38bdf8", MATERIAL.EMISSIVE);
  // Row 1: "14:02 EXP" in amber
  renderGlyphText(builder, "14:02 EXP", x, y + height * 0.05, z + 0.105, width * 0.72, "#fbbf24", MATERIAL.EMISSIVE);
  // Row 2: "14:05 LOC" in light green
  renderGlyphText(builder, "14:05 LOC", x, y - height * 0.28, z + 0.105, width * 0.72, "#4ade80", MATERIAL.EMISSIVE);
}

// Station Master Clock (駅時計): Round brass bezel with hour/minute hands
export function addStationClock(builder, x, y, z, radius = 0.42) {
  // Bezel ring
  builder.beam([x, y, z - 0.045], [x, y, z + 0.045], radius, "#b4975a", MATERIAL.METAL, 16);
  // White clock face
  builder.beam([x, y, z + 0.04], [x, y, z + 0.055], radius * 0.88, "#f8fafc", MATERIAL.MATTE, 16);
  // Center pinion
  builder.beam([x, y, z + 0.055], [x, y, z + 0.07], 0.03, "#182129", MATERIAL.METAL, 8);
  // Hour hand (pointing towards 2 o'clock)
  builder.beam([x, y, z + 0.06], [x + radius * 0.38, y + radius * 0.22, z + 0.06], 0.014, "#0f172a", MATERIAL.MATTE, 4);
  // Minute hand (pointing towards 12 o'clock)
  builder.beam([x, y, z + 0.064], [x + radius * 0.05, y + radius * 0.64, z + 0.064], 0.010, "#0f172a", MATERIAL.MATTE, 4);
}
