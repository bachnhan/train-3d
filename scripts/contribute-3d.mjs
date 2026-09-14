#!/usr/bin/env node

/**
 * Train 3D — Contributor task router.
 *
 * Prints guidance only; does not scaffold or edit files.
 *
 * Usage:
 *   node scripts/contribute-3d.mjs --list
 *   node scripts/contribute-3d.mjs train
 *   node scripts/contribute-3d.mjs -- station
 */

const args = process.argv.slice(2);
const isList = args.includes("--list");
const kind = args.find((arg) => !arg.startsWith("--"));

const routes = {
  train: {
    title: "Commuter rolling stock",
    recipe: "docs/simulation-feedback.md",
    files: [
      "src/train.js",
      "src/main.js",
      "index.html"
    ],
    checks: [
      "node scripts/geometry-qa.mjs",
      "node scripts/qa.mjs",
      "python3 -m http.server 8008  # then open /index.html"
    ],
    review: "Verify dual-bogie pose, car envelope vs scenery, and cache-bust every ?v= in index.html together.",
    evidence: "evidence/trains/"
  },
  station: {
    title: "Stations and landmark kits",
    recipe: "docs/simulation-feedback.md",
    files: [
      "src/scene.js",
      "src/layout.js",
      "stations.js",
      "src/hud.js",
      "translations.js"
    ],
    checks: [
      "node scripts/geometry-qa.mjs",
      "node scripts/qa.mjs",
      "python3 -m http.server 8008  # then window.run_qa() on /index.html"
    ],
    review: "Verify platform clearance, landmark footprints, JA/EN HUD via TRANSLATIONS.diorama, and import-map ?v= bump.",
    evidence: "evidence/stations/"
  },
  track: {
    title: "Route spline, cameras, and clearance",
    recipe: "docs/simulation-feedback.md",
    files: [
      "src/layout.js",
      "src/clearance.mjs",
      "src/cameras.js",
      "src/main.js"
    ],
    checks: [
      "node scripts/geometry-qa.mjs",
      "node scripts/qa.mjs"
    ],
    review: "Verify monotonic stationU, rotated footprint clearance, and camera views that do not clip the tabletop.",
    evidence: "evidence/tracks/"
  },
  audio: {
    title: "Gesture-gated Web Audio on the train",
    recipe: ".agents/skills/resilient-web-audio/SKILL.md",
    files: [
      "src/audio.js",
      "src/hud.js"
    ],
    checks: [
      "node scripts/geometry-qa.mjs",
      "python3 -m http.server 8008  # then open /index.html and trigger audio after a click"
    ],
    review: "Verify AudioContext starts only after a user gesture and does not throw on Safari autoplay policy.",
    evidence: "evidence/audio/"
  },
  ui: {
    title: "Accessible HUD and camera controls",
    recipe: ".agents/skills/accessible-diorama-ui/SKILL.md",
    files: [
      "src/hud.js",
      "src/accessible-twin.js",
      "src/controls.js",
      "src/cameras.js",
      "index.html",
      "css/train-3d.css"
    ],
    checks: [
      "python3 -m http.server 8008  # then check 320px and 390px viewports on /index.html"
    ],
    review: "Verify canvas aria-label, camera/landmark controls, and HUD station card i18n.",
    evidence: "evidence/ui/"
  },
  docs: {
    title: "Simulation documentation",
    recipe: "docs/index.md",
    files: [
      "docs/simulation-feedback.md",
      "docs/dev-guide.md",
      "docs/architecture.md",
      "docs/index.md",
      "docs/log.md"
    ],
    checks: [
      "node scripts/qa.mjs"
    ],
    review: "Keep index.html / src/* paths accurate.",
    evidence: "evidence/docs/"
  }
};

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

if (isList) {
  printJson(routes);
} else if (!kind) {
  printJson({
    usage: [
      "node scripts/contribute-3d.mjs --list",
      "node scripts/contribute-3d.mjs <task-kind>"
    ],
    kinds: Object.keys(routes)
  });
} else if (!routes[kind]) {
  console.error(JSON.stringify({
    error: `Unknown task kind: "${kind}"`,
    kinds: Object.keys(routes)
  }, null, 2));
  process.exit(1);
} else {
  printJson({ kind, ...routes[kind] });
}
