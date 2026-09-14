---
name: agent-task-router
description: >-
  Establishes a discoverable CLI task router and recipe map for human contributors and AI coding agents.
  Maps task categories to exact file paths, recipe documentation, required test suites, and review checklists.
  Eliminates agent hallucinations of directory structures and prevents missing mandatory CI test gates.
  Use when architecting agentic repositories, multi-agent workflows, or establishing contribution governance.
---

# Agent Task Router Skill

This skill provides the CLI task router used by Train 3D (`scripts/contribute-3d.mjs`, `node scripts/contribute-3d.mjs <kind>`). It is a single discoverable task map that guides both human developers and autonomous AI agents without modifying any files.

---

## The Problem It Solves

When an AI coding agent enters a large repository:
- It frequently guesses which files to edit, often touching the wrong modules.
- It doesn't know which specific tests must run for a given feature area.
- It forgets required PR review checklists, licensing attribution, or evidence directories.

## The Solution: A Discoverable Task Router

By running `node scripts/contribute.mjs --list` or `pnpm run contribute -- <task>`, the agent receives structured JSON guidance:
```json
{
  "kind": "train",
  "recipe": "docs/contributing/trains.md",
  "files": ["src/lib/3d/trains/", "src/lib/3d/builder.ts"],
  "checks": ["pnpm run test:geometry", "pnpm run lint"],
  "review": "docs/contributing/review.md",
  "evidence": "evidence/<work-id>/"
}
```

---

## When to Use

- Setting up developer and AI agent workflows in medium-to-large codebases.
- Standardizing contributor recipes across distinct domain features (e.g. models, levels, audio, UI).
- Preventing agents from bypassing repository-specific test suites before opening PRs.

## Not For

- Automated file scaffolding or code generation (the router prints guidance; it does not generate files).
- CI runner execution orchestration (use GitHub Actions / Makefiles).

---

## Quick Start Template

A portable task router script is provided in:
👉 [scripts/router_template.mjs](./scripts/router_template.mjs)

Copy this script into your project's `scripts/contribute.mjs` and register task routes for your feature areas.
