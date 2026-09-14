---
name: web3d-workflow
description: >-
  Iterative state-machine orchestrator for 3D web simulations and dioramas.
  Replaces linear step-by-step pipelines with cyclical state transitions (Blockout,
  Kinematics, Sensory/Audio/A11y, QA Auditing, Governance) and explicit feedback loops.
  Dispatches to specialized child skills (procedural-mesh-builder, spatial-track-solver,
  resilient-web-audio, accessible-diorama-ui, headless-geometry-qa, agent-task-router).
---

# Web 3D Project Workflow State Machine

Unlike linear waterfall pipelines, interactive 3D development is **cyclical and iterative**. This skill models the project lifecycle as a **Finite State Machine (FSM)** with explicit transition guards and feedback loops.

---

## When to Use

- Planning, building, or refactoring interactive 3D web applications and dioramas.
- Determining the current state of a 3D feature and identifying the next required action.
- Handling regression feedback loops (e.g. mobile VRAM budget failure $\to$ geometry decimation loop).
- Orchestrating multi-agent collaboration across 3D modeling, kinematics, audio, and QA.

## Not For

- Pure 2D web app workflows without spatial rendering.
- Static documentation or content-only updates.

---

## State Transition Map

```
 [STATE_SPEC_BLOCKOUT] ──► [STATE_KINEMATICS] ──► [STATE_SENSORY_A11Y]
        ▲                         │                         │
        │ (Clearance failure)     │                         │ (Audio/camera jitter)
        └─────────────────────────┘                         ▼
        ▲                                            [STATE_QA_AUDIT]
        │ (Polygon budget overrun)                          │
        └───────────────────────────────────────────────────┤
        ▲                                                   │
        │ (VRAM > 128MB / Draw calls > 50)                  │
        └───────────────────────────────────────────────────┘
                                                            │ (All guards pass)
                                                            ▼
                                                   [STATE_GOVERNANCE]
                                                            │ (Missing evidence)
                                                            ▼
                                                   [STATE_RELEASED]
```

---

## The 5 Operational States & Skill Dispatch

### 1. `STATE_SPEC_BLOCKOUT` (Scene Architecture & Geometry)
* **Goal:** Establish world scale ($1.0\text{ unit} = 1.0\text{ m}$), diorama bounds, and low-poly meshes.
* **Dispatched Skill:** `procedural-mesh-builder`
* **Exit Guard:** All models have defined bounding envelopes; building triangle count $\le 800$.
* **Transition Trigger:** `BLOCKOUT_READY` $\to$ `STATE_KINEMATICS`.

### 2. `STATE_KINEMATICS` (Vehicle Motion & Spatial Routing)
* **Goal:** Discretize spline curves, setup arc-length LUTs, and implement dual-bogie chord tracking.
* **Dispatched Skill:** `spatial-track-solver`
* **Exit Guard:** Monotonic distance progression; bogie spacing constant $\|P_f - P_r\| = C$; 60Hz fixed accumulator loop.
* **Feedback Loops:**
  * If track curve radius $R$ is too sharp for rolling stock wheelbase $\to$ `LOOP_CLEARANCE_FAIL` back to `STATE_SPEC_BLOCKOUT`.
* **Transition Trigger:** `KINEMATICS_VALID` $\to$ `STATE_SENSORY_A11Y`.

### 3. `STATE_SENSORY_A11Y` (Rendering, Audio & Accessibility)
* **Goal:** Attach materials/shaders, configure Web Audio buses, and wire the Accessible Twin.
* **Dispatched Skills:** `resilient-web-audio`, `accessible-diorama-ui`, `web3d-engineering`
* **Exit Guard (Fail-Closed):** Requires positive evidence: `hasA11yTwin === true`, `audioVerified === true`, and `!hasAudio404`.
* **Feedback Loops:**
  * If audio pitch shifts erratically or camera jitter occurs $\to$ `LOOP_SYNC_JITTER` back to `STATE_KINEMATICS`.
  * If camera framing clips through diorama geometry on 320px/390px mobile screens $\to$ `LOOP_FRAMING_FAIL` back to `STATE_SPEC_BLOCKOUT`.
* **Transition Trigger:** `SENSORY_COMPLETE` $\to$ `STATE_QA_AUDIT`.

### 4. `STATE_QA_AUDIT` (Performance & Budget Verification)
* **Goal:** Enforce mobile VRAM caps, zero GC allocations in rAF, and geometry integrity.
* **Dispatched Skills:** `headless-geometry-qa`, `check_geometry_invariants`
* **Exit Guard:**
  * Active VRAM $\le 128\text{ MB}$ (iOS Safari Jetsam watchdog safe).
  * Draw calls $\le 50$ (mobile), $\le 250$ (desktop).
  * Zero NaNs/Infinities, unit-length normals ($|N| \approx 1.0$).
* **Feedback Loops:**
  * If triangle count exceeds budget $\to$ `LOOP_TRIANGLE_OVERRUN` back to `STATE_SPEC_BLOCKOUT`.
  * If VRAM or draw calls exceed budget $\to$ `LOOP_VRAM_OVERFLOW` back to `STATE_SENSORY_A11Y` (quantize atlas / batch draw calls).
* **Transition Trigger:** `QA_PASS` $\to$ `STATE_GOVERNANCE`.

### 5. `STATE_GOVERNANCE` (Contribution Router & PR Gate)
* **Goal:** Ensure contributor recipes, copyright attribution, and multi-device evidence are verified.
* **Dispatched Skill:** `agent-task-router`
* **Exit Guard:** `pnpm run contribute -- <kind>` checklist complete; desktop + 390px + 320px viewport evidence captured.
* **Feedback Loops:**
  * If automated tests fail or evidence missing $\to$ `LOOP_EVIDENCE_MISSING` back to `STATE_QA_AUDIT`.
* **Transition Trigger:** `GATE_VERIFIED` $\to$ `STATE_RELEASED`.

---

## Programmatic FSM Controller

A portable, runnable FSM engine is provided in:
👉 [references/workflow_fsm.js](./references/workflow_fsm.js)

Run the controller self-test:
```bash
node .agents/skills/web3d-workflow/references/workflow_fsm.js
```
