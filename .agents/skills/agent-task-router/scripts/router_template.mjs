#!/usr/bin/env node

/**
 * Portable Agent Task Router Template
 * 
 * Contributor CLI task router template.
 * Usage:
 *   node scripts/contribute.mjs --list [--json]
 *   node scripts/contribute.mjs -- <task-kind> [--json]
 */

const args = process.argv.slice(2);
const isJson = args.includes('--json');
const isList = args.includes('--list');
const kind = args.find(a => !a.startsWith('--'));

// Define project routes: task kind -> recipe, files, checks, review doc
const routes = {
  train: {
    recipe: 'docs/contributing/trains.md',
    files: ['src/lib/3d/trains/', 'src/lib/3d/builder.ts'],
    checks: ['pnpm run test:geometry', 'pnpm run lint'],
    review: 'docs/contributing/review.md',
    evidence: 'evidence/<work-id>/'
  },
  station: {
    recipe: 'docs/contributing/stations.md',
    files: ['src/lib/3d/stations/', 'src/components/3d/station-picker.tsx', 'messages/'],
    checks: ['pnpm run test:geometry', 'pnpm run build'],
    review: 'docs/contributing/review.md',
    evidence: 'evidence/<work-id>/'
  },
  track: {
    recipe: 'docs/contributing/tracks.md',
    files: ['src/lib/3d/track-network.ts', 'src/lib/3d/spatial-grid.ts'],
    checks: ['pnpm run test:geometry', 'pnpm run lint'],
    review: 'docs/contributing/review.md',
    evidence: 'evidence/<work-id>/'
  },
  audio: {
    recipe: 'docs/contributing/audio.md',
    files: ['src/lib/3d/audio.ts', 'public/audio/'],
    checks: ['pnpm run lint'],
    review: 'docs/contributing/review.md',
    evidence: 'evidence/<work-id>/'
  },
  ui: {
    recipe: 'docs/contributing/ui.md',
    files: ['src/components/3d/', 'src/app/[locale]/'],
    checks: ['pnpm run lint', 'pnpm run build'],
    review: 'docs/contributing/review.md',
    evidence: 'evidence/<work-id>/'
  },
  docs: {
    recipe: 'docs/contributing/documentation.md',
    files: ['docs/', 'README.md'],
    checks: ['pnpm run lint'],
    review: 'docs/contributing/review.md',
    evidence: 'evidence/<work-id>/'
  }
};

if (isList) {
  if (isJson) {
    console.log(JSON.stringify(routes, null, 2));
  } else {
    console.log("Available contribution task routes:\n");
    for (const [key, r] of Object.entries(routes)) {
      console.log(`  ${key.padEnd(12)} -> ${r.recipe}`);
    }
    console.log("\nRun: node scripts/contribute.mjs -- <kind> for full guidance.");
  }
} else if (!kind) {
  console.log("Usage:\n  node scripts/contribute.mjs --list\n  node scripts/contribute.mjs -- <task-kind> [--json]");
} else if (!routes[kind]) {
  console.error(`Unknown task kind: "${kind}". Run with --list to see available routes.`);
  process.exit(1);
} else {
  const route = { kind, ...routes[kind] };
  if (isJson) {
    console.log(JSON.stringify(route, null, 2));
  } else {
    console.log(`=== Contributor Guidance for [${kind}] ===`);
    console.log(`Recipe:   ${route.recipe}`);
    console.log(`Files:    ${route.files.join(', ')}`);
    console.log(`Checks:   ${route.checks.join('; ')}`);
    console.log(`Review:   ${route.review}`);
    console.log(`Evidence: ${route.evidence}`);
    console.log(`\nNote: This tool prints guidance only; it does not scaffold or edit files.`);
  }
}
