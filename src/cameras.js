import { routeCurve, stationPoints } from "./layout.js";

const STATIC_TARGETS = {
  room: new THREE.Vector3(-36, 12, -495),
  layout: new THREE.Vector3(0, 0, 0)
};

export const LANDMARK_VIEWS = {
  0: { target: [-90, 15, -570], offset: [-60, 130, 240], look: [0, -10, -30] },
  1: { target: [72.2, 2.5, 510.6], offset: [-30, 24, 30], look: [0, -1, -12] },
  shibuya: { target: [-90, 15, -570], offset: [-60, 130, 240], look: [0, -10, -30] },
  namikibashi: { target: [-34, 9.7, -210], offset: [32, 22, -26], look: [-6, 0, 4] },
  address: { target: [106.2, 58, 470.2], offset: [110, 85, 95], look: [-10, -2, -10] },
  daikanyama: { target: [72.2, 2.5, 510.6], offset: [-30, 24, 30], look: [0, -1, -12] }
};

const VEHICLE_CAMERA_PROFILES = {
  train: {
    followBack: 20,
    followUp: 9,
    followLookahead: 16,
    cabForward: 6.4,
    cabUp: 2.1,
    cabLookahead: 34,
    orbitDistance: 28,
    tracksideSide: 18,
    tracksideForward: -10,
    tracksideUp: 5
  },
  plane: {
    followBack: 36,
    followUp: 10,
    followLookahead: 45,
    cabForward: 4.8,
    cabUp: 1.1,
    cabLookahead: 60,
    orbitDistance: 45,
    tracksideSide: 50,
    tracksideForward: -20,
    tracksideUp: 12
  },
  boat: {
    followBack: 15,
    followUp: 6.5,
    followLookahead: 18,
    cabForward: 2.2,
    cabUp: 1.1,
    cabLookahead: 25,
    orbitDistance: 16,
    tracksideSide: 14,
    tracksideForward: -8,
    tracksideUp: 4
  },
  bus: {
    followBack: 15,
    followUp: 6.5,
    followLookahead: 18,
    cabForward: 4.4,
    cabUp: 2.0,
    cabLookahead: 28,
    orbitDistance: 18,
    tracksideSide: 12,
    tracksideForward: -6,
    tracksideUp: 3.8
  },
  taxi: {
    followBack: 11,
    followUp: 4.8,
    followLookahead: 14,
    cabForward: 0.9,
    cabUp: 1.15,
    cabLookahead: 22,
    orbitDistance: 13,
    tracksideSide: 9,
    tracksideForward: -5,
    tracksideUp: 2.8
  }
};

export function createCameraController(camera, targetProvider, orbit) {
  const state = {
    view: "room",
    targetVehicle: "train",
    landmark: null,
    desiredPosition: new THREE.Vector3(),
    desiredTarget: new THREE.Vector3(-36, 12, -495),
    currentTarget: new THREE.Vector3(-36, 12, -495)
  };

  const targetPos = new THREE.Vector3();
  const heading = new THREE.Vector3();
  const side = new THREE.Vector3();
  const landmarkOffset = new THREE.Vector3();
  const landmarkLook = new THREE.Vector3();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  orbit.state.pitch = 0.52;
  orbit.state.yaw = 0.44;
  orbit.state.distance = 185;
  camera.position.copy(orbit.getPosition(STATIC_TARGETS.room));
  state.desiredPosition.copy(camera.position);

  function setView(view) {
    state.view = view;
    state.landmark = null;
    state.followYaw = null;

    if (view === "layout") {
      orbit.state.pitch = 1.05;
      orbit.state.distance = 1750;
    } else if (view === "room") {
      orbit.state.pitch = 0.52;
      orbit.state.yaw = 0.44;
      orbit.state.distance = 185;
    } else if (view === "locomotive" || view === "orbit") {
      const profile = VEHICLE_CAMERA_PROFILES[state.targetVehicle] || VEHICLE_CAMERA_PROFILES.train;
      orbit.state.distance = profile.orbitDistance;
      orbit.state.pitch = 0.38;
    }
  }

  function setTargetVehicle(vehicleKey) {
    if (VEHICLE_CAMERA_PROFILES[vehicleKey]) {
      state.targetVehicle = vehicleKey;
      state.followYaw = null;

      // If in a static room/layout view, switch to follow view for immediate engagement
      if (state.view === "room" || state.view === "layout" || state.view === "landmark") {
        setView("follow");
      } else if (state.view === "locomotive" || state.view === "orbit") {
        const profile = VEHICLE_CAMERA_PROFILES[vehicleKey];
        orbit.state.distance = profile.orbitDistance;
      }
    }
  }

  function focusStation(index) {
    state.landmark = index;
    state.view = "landmark";
    state.followYaw = null;
  }

  function focusLandmark(key) {
    state.landmark = key;
    state.view = "landmark";
    state.followYaw = null;
  }

  function getActivePose() {
    if (typeof targetProvider.getPose === "function") {
      return targetProvider.getPose(state.targetVehicle);
    }
    // Fallback: direct trainController
    if (targetProvider.leadCar) {
      const lead = targetProvider.leadCar();
      return {
        position: lead.position,
        yaw: lead.rotation.y,
        speed: targetProvider.state?.speed || 10,
        height: 3.2
      };
    }
    return null;
  }

  function update() {
    const pose = getActivePose();
    if (pose) {
      targetPos.copy(pose.position);
      heading.set(Math.sin(pose.yaw), 0, Math.cos(pose.yaw));
      side.set(heading.z, 0, -heading.x);
    }

    const profile = VEHICLE_CAMERA_PROFILES[state.targetVehicle] || VEHICLE_CAMERA_PROFILES.train;

    if (state.view === "room" || state.view === "layout") {
      const target = STATIC_TARGETS[state.view];
      orbit.getPosition(target, state.desiredPosition);
      state.desiredTarget.copy(target);
    } else if (state.view === "trackside") {
      state.desiredPosition.copy(targetPos)
        .addScaledVector(side, profile.tracksideSide)
        .addScaledVector(heading, profile.tracksideForward);
      state.desiredPosition.y = targetPos.y + profile.tracksideUp;
      state.desiredTarget.copy(targetPos).addScaledVector(heading, 4);
      state.desiredTarget.y = targetPos.y + 1.2;
    } else if (state.view === "locomotive" || state.view === "orbit") {
      // Free Orbit around moving vehicle
      orbit.getPosition(targetPos, state.desiredPosition);
      state.desiredTarget.copy(targetPos);
      state.desiredTarget.y = targetPos.y + (profile.cabUp || 1.5) * 0.5;
    } else if (state.view === "follow") {
      const vYaw = pose ? pose.yaw : 0;
      if (!Number.isFinite(state.followYaw)) state.followYaw = vYaw;

      let yawDiff = vYaw - state.followYaw;
      while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
      while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
      state.followYaw += yawDiff * (reducedMotion.matches ? 1 : 0.08);

      const chX = Math.sin(state.followYaw);
      const chZ = Math.cos(state.followYaw);

      camera.position.set(
        targetPos.x - chX * profile.followBack,
        targetPos.y + profile.followUp,
        targetPos.z - chZ * profile.followBack
      );
      state.currentTarget.set(
        targetPos.x + chX * profile.followLookahead,
        targetPos.y + 1.4,
        targetPos.z + chZ * profile.followLookahead
      );
      camera.lookAt(state.currentTarget);
      return;
    } else if (state.view === "cab" || state.view === "cockpit") {
      state.desiredPosition.copy(targetPos).addScaledVector(heading, profile.cabForward);
      state.desiredPosition.y = targetPos.y + profile.cabUp;
      state.desiredTarget.copy(targetPos).addScaledVector(heading, profile.cabLookahead);
      state.desiredTarget.y = targetPos.y + profile.cabUp * 0.9;
    } else if (state.view === "landmark") {
      const view = LANDMARK_VIEWS[state.landmark] || (Number.isFinite(state.landmark) ? LANDMARK_VIEWS[state.landmark] : LANDMARK_VIEWS.shibuya);
      const targetPoint = view.target ? new THREE.Vector3(...view.target) : (stationPoints[state.landmark] || stationPoints[0]);
      landmarkOffset.set(...view.offset);
      landmarkLook.set(...view.look);
      state.desiredPosition.copy(targetPoint).add(landmarkOffset);
      state.desiredTarget.copy(targetPoint).add(landmarkLook);
    }

    const near = (state.view === "cab" || state.view === "cockpit") ? 0.3 : 2;
    if (camera.near !== near) {
      camera.near = near;
      camera.updateProjectionMatrix();
    }

    const easing = reducedMotion.matches ? 1 : (state.view === "cab" || state.view === "cockpit") ? 0.22 : (state.view === "layout" || state.view === "room") ? 0.16 : 0.10;
    camera.position.lerp(state.desiredPosition, easing);
    state.currentTarget.lerp(state.desiredTarget, easing + 0.02);
    camera.lookAt(state.currentTarget);
  }

  return {
    state,
    setView,
    setTargetVehicle,
    focusStation,
    focusLandmark,
    update,
    LANDMARK_VIEWS
  };
}

export { routeCurve };
