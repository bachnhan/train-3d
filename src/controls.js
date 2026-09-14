export function createOrbitControls(canvas) {
  const state = { yaw: 0.52, pitch: 0.72, distance: 620, dragging: false };
  const pointers = new Map();
  let lastPinch = 0;

  canvas.addEventListener("pointerdown", (event) => {
    canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    state.dragging = true;
  });

  canvas.addEventListener("pointermove", (event) => {
    const prior = pointers.get(event.pointerId);
    if (!prior) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 1) {
      state.yaw -= (event.clientX - prior.x) * .005;
      state.pitch = THREE.MathUtils.clamp(state.pitch + (event.clientY - prior.y) * .004, .25, 1.28);
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const pinch = Math.hypot(a.x - b.x, a.y - b.y);
      if (lastPinch) state.distance = THREE.MathUtils.clamp(state.distance + (lastPinch - pinch) * 1.2, 45, 3600);
      lastPinch = pinch;
    }
  });

  function release(event) {
    pointers.delete(event.pointerId);
    state.dragging = pointers.size > 0;
    if (pointers.size < 2) lastPinch = 0;
  }
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);
  canvas.addEventListener("wheel", (event) => {
    state.distance = THREE.MathUtils.clamp(state.distance + event.deltaY * .65, 45, 3600);
  }, { passive: true });

  function getPosition(target, output = new THREE.Vector3()) {
    const horizontal = Math.cos(state.pitch) * state.distance;
    output.set(
      target.x + Math.sin(state.yaw) * horizontal,
      target.y + Math.sin(state.pitch) * state.distance,
      target.z + Math.cos(state.yaw) * horizontal
    );
    return output;
  }

  return { state, getPosition };
}
