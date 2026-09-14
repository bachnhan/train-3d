/**
 * Reference Implementation: Web 3D Project Workflow Finite State Machine
 * 
 * Manages cyclical transitions and feedback loops across 3D development states.
 * Enforces fail-closed guard predicates (requires explicit positive evidence).
 */

const States = {
  SPEC_BLOCKOUT: 'STATE_SPEC_BLOCKOUT',
  KINEMATICS: 'STATE_KINEMATICS',
  SENSORY_A11Y: 'STATE_SENSORY_A11Y',
  QA_AUDIT: 'STATE_QA_AUDIT',
  GOVERNANCE: 'STATE_GOVERNANCE',
  RELEASED: 'STATE_RELEASED'
};

class Web3DWorkflowFSM {
  constructor(initialState = States.SPEC_BLOCKOUT) {
    this.state = initialState;
    this.history = [initialState];
  }

  getCurrentState() {
    return this.state;
  }

  getRecommendedSkill() {
    switch (this.state) {
      case States.SPEC_BLOCKOUT:
        return 'procedural-mesh-builder';
      case States.KINEMATICS:
        return 'spatial-track-solver';
      case States.SENSORY_A11Y:
        return 'resilient-web-audio / accessible-diorama-ui';
      case States.QA_AUDIT:
        return 'headless-geometry-qa / check_geometry_invariants';
      case States.GOVERNANCE:
        return 'agent-task-router';
      case States.RELEASED:
        return 'None (Project Released)';
      default:
        return 'web3d-engineering';
    }
  }

  transition(event, context = {}) {
    const prev = this.state;
    let next = prev;

    switch (this.state) {
      case States.SPEC_BLOCKOUT:
        if (event === 'BLOCKOUT_READY') {
          // Fail-closed guard: scale must be explicitly verified
          if (context.scaleDefined === true) {
            next = States.KINEMATICS;
          }
        }
        break;

      case States.KINEMATICS:
        if (event === 'KINEMATICS_VALID') {
          // Fail-closed guard: kinematics must be explicitly validated and no derailment
          if (context.kinematicsValid === true && !context.derailment) {
            next = States.SENSORY_A11Y;
          }
        } else if (event === 'LOOP_CLEARANCE_FAIL') {
          // Backward loop to blockout (e.g. curve too tight or tunnel clearance failure)
          next = States.SPEC_BLOCKOUT;
        }
        break;

      case States.SENSORY_A11Y:
        if (event === 'SENSORY_COMPLETE') {
          // Fail-closed guard: both accessible twin and audio verification must be confirmed
          if (context.hasA11yTwin === true && context.audioVerified === true && !context.hasAudio404) {
            next = States.QA_AUDIT;
          }
        } else if (event === 'LOOP_SYNC_JITTER') {
          // Backward loop to kinematics (accumulator/Doppler sync)
          next = States.KINEMATICS;
        } else if (event === 'LOOP_FRAMING_FAIL') {
          // Backward loop to blockout (camera clipping through diorama geometry at 320px/390px)
          next = States.SPEC_BLOCKOUT;
        }
        break;

      case States.QA_AUDIT:
        if (event === 'QA_PASS') {
          // Fail-closed guards: explicit numeric values for VRAM, draw calls, and geometry validity
          const vramOk = typeof context.vramMB === 'number' && context.vramMB <= 128;
          const drawCallsOk = typeof context.drawCalls === 'number' && context.drawCalls <= 50;
          const geomOk = context.geometryValid === true;

          if (vramOk && drawCallsOk && geomOk) {
            next = States.GOVERNANCE;
          } else {
            console.warn(`[FSM Guard Blocked] VRAM: ${context.vramMB}MB (<=128), DrawCalls: ${context.drawCalls} (<=50), GeomValid: ${geomOk}`);
          }
        } else if (event === 'LOOP_TRIANGLE_OVERRUN') {
          next = States.SPEC_BLOCKOUT;
        } else if (event === 'LOOP_VRAM_OVERFLOW') {
          next = States.SENSORY_A11Y;
        }
        break;

      case States.GOVERNANCE:
        if (event === 'GATE_VERIFIED') {
          // Fail-closed guard: evidence and checks must be explicitly confirmed
          if (context.evidenceComplete === true && context.checksPassed === true) {
            next = States.RELEASED;
          }
        } else if (event === 'LOOP_EVIDENCE_MISSING') {
          next = States.QA_AUDIT;
        }
        break;

      case States.RELEASED:
        // Terminal state
        break;
    }

    if (next !== prev) {
      this.state = next;
      this.history.push(next);
      console.log(`[FSM Transition] ${prev} --(${event})--> ${next} (Active Skill: ${this.getRecommendedSkill()})`);
      return true;
    }

    console.log(`[FSM Guard Hold] In state ${this.state}, event "${event}" rejected.`);
    return false;
  }
}

// Standalone self-test
function runSelfTest() {
  console.log("=== Running Web 3D Workflow FSM Self-Test ===");
  const fsm = new Web3DWorkflowFSM();
  let passed = 0;

  // 1. Initial State
  if (fsm.getCurrentState() === States.SPEC_BLOCKOUT) passed++;

  // 2. Test Fail-Closed Guard: empty context rejected
  const emptyContextRejected = !fsm.transition('BLOCKOUT_READY', {});
  if (emptyContextRejected && fsm.getCurrentState() === States.SPEC_BLOCKOUT) {
    console.log("  [PASS] Fail-closed guard correctly blocked empty context");
    passed++;
  }

  // 3. Transition to Kinematics with explicit evidence
  fsm.transition('BLOCKOUT_READY', { scaleDefined: true });
  if (fsm.getCurrentState() === States.KINEMATICS) passed++;

  // 4. Test Backward Loop: Clearance failure triggers loopback to blockout
  fsm.transition('LOOP_CLEARANCE_FAIL');
  if (fsm.getCurrentState() === States.SPEC_BLOCKOUT) {
    console.log("  [PASS] Backward loop to SPEC_BLOCKOUT verified");
    passed++;
  }

  // 5. Move forward through Kinematics to Sensory
  fsm.transition('BLOCKOUT_READY', { scaleDefined: true });
  fsm.transition('KINEMATICS_VALID', { kinematicsValid: true, derailment: false });
  if (fsm.getCurrentState() === States.SENSORY_A11Y) passed++;

  // 6. Test W-03 Backward Loop: Framing failure loops from SENSORY back to BLOCKOUT
  fsm.transition('LOOP_FRAMING_FAIL');
  if (fsm.getCurrentState() === States.SPEC_BLOCKOUT) {
    console.log("  [PASS] LOOP_FRAMING_FAIL correctly returns to SPEC_BLOCKOUT");
    passed++;
  }

  // 7. Recover back to SENSORY_A11Y
  fsm.transition('BLOCKOUT_READY', { scaleDefined: true });
  fsm.transition('KINEMATICS_VALID', { kinematicsValid: true, derailment: false });
  if (fsm.getCurrentState() === States.SENSORY_A11Y) passed++;

  // 8. Move to QA with explicit sensory evidence
  fsm.transition('SENSORY_COMPLETE', { hasA11yTwin: true, audioVerified: true, hasAudio404: false });
  if (fsm.getCurrentState() === States.QA_AUDIT) passed++;

  // 9. Test Guard Rejection (VRAM too high)
  const guardBlocked = !fsm.transition('QA_PASS', { vramMB: 280, drawCalls: 30, geometryValid: true });
  if (guardBlocked && fsm.getCurrentState() === States.QA_AUDIT) {
    console.log("  [PASS] Guard condition correctly blocked VRAM overflow");
    passed++;
  }

  // 10. Test Backward Loop: VRAM Overflow triggers loopback to SENSORY_A11Y
  fsm.transition('LOOP_VRAM_OVERFLOW');
  if (fsm.getCurrentState() === States.SENSORY_A11Y) {
    console.log("  [PASS] Backward loop to SENSORY_A11Y verified");
    passed++;
  }

  // 11. Recover and push to RELEASED with explicit positive evidence
  fsm.transition('SENSORY_COMPLETE', { hasA11yTwin: true, audioVerified: true, hasAudio404: false });
  fsm.transition('QA_PASS', { vramMB: 96, drawCalls: 24, geometryValid: true });
  fsm.transition('GATE_VERIFIED', { evidenceComplete: true, checksPassed: true });
  if (fsm.getCurrentState() === States.RELEASED) {
    console.log("  [PASS] Reached final RELEASED state with full history");
    passed++;
  }

  console.log(`\nFSM Self-Test Complete: ${passed}/11 checks passed.`);
  return passed === 11;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { States, Web3DWorkflowFSM, runSelfTest };
}
if (typeof window !== 'undefined') {
  window.States = States;
  window.Web3DWorkflowFSM = Web3DWorkflowFSM;
}

if (typeof process !== 'undefined' && process.argv[1] && process.argv[1].endsWith('workflow_fsm.js')) {
  const ok = runSelfTest();
  process.exit(ok ? 0 : 1);
}
