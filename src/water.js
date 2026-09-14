// Procedural Dynamic Shibuya River Water Simulation for Train 3D
// High-performance procedural ribbon mesh with flowing current, physical wave heaving,
// specular caustics, shoreline foam, patrol boat wake interaction, and dynamic weather reactivity.

import { SHIBUYA_RIVER } from "./map-model.js";

export class RiverWater {
  constructor(scene) {
    this.scene = scene;
    this.mesh = null;
    this.material = null;
    this.elapsed = 0;

    this._initGeometry();
    this._initMaterial();
    this._createMesh();
  }

  _initGeometry() {
    // Generate smooth curve through SHIBUYA_RIVER control points
    const points = SHIBUYA_RIVER.map(([x, z]) => new THREE.Vector3(x, 0, z));
    const curve = new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.15);

    const CANAL_WIDTH = 11.6; // Canal width between retaining walls (11.8m opening)
    const HALF_WIDTH = CANAL_WIDTH / 2;
    const NUM_LENGTH_SEGS = 64;
    const NUM_WIDTH_SEGS = 8;

    const positions = [];
    const normals = [];
    const uvs = [];
    const localXs = [];
    const indices = [];

    // Sample cross sections along curve
    for (let i = 0; i <= NUM_LENGTH_SEGS; i += 1) {
      const u = i / NUM_LENGTH_SEGS;
      const pt = curve.getPointAt(u);
      const tangent = curve.getTangentAt(u).normalize();
      // Normal perpendicular to tangent in X-Z plane
      const normalX = -tangent.z;
      const normalZ = tangent.x;

      for (let j = 0; j <= NUM_WIDTH_SEGS; j += 1) {
        const lateralT = (j / NUM_WIDTH_SEGS) * 2 - 1; // -1 to 1
        const lateralDist = lateralT * HALF_WIDTH;

        const vx = pt.x + normalX * lateralDist;
        const vy = -0.01; // Water surface elevation
        const vz = pt.z + normalZ * lateralDist;

        positions.push(vx, vy, vz);
        normals.push(0, 1, 0);
        uvs.push(j / NUM_WIDTH_SEGS, u * 24.0);
        localXs.push(lateralDist);
      }
    }

    for (let i = 0; i < NUM_LENGTH_SEGS; i += 1) {
      for (let j = 0; j < NUM_WIDTH_SEGS; j += 1) {
        const row1 = i * (NUM_WIDTH_SEGS + 1);
        const row2 = (i + 1) * (NUM_WIDTH_SEGS + 1);

        const a = row1 + j;
        const b = row1 + j + 1;
        const c = row2 + j;
        const d = row2 + j + 1;

        indices.push(a, b, c);
        indices.push(b, d, c);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute("aLocalX", new THREE.Float32BufferAttribute(localXs, 1));
    geometry.setIndex(indices);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    this.geometry = geometry;
  }

  _initMaterial() {
    const vertexShader = `
      attribute float aLocalX;

      uniform float uTime;
      uniform vec3 uBoatPos;
      uniform float uBoatSpeed;
      uniform float uStormIntensity;

      varying vec3 vWorldPosition;
      varying vec3 vNormal;
      varying vec2 vUv;
      varying float vLocalX;
      varying float vWaveHeight;
      varying float vBoatWake;

      void main() {
        vUv = uv;
        vLocalX = aLocalX;

        vec4 worldPos = modelMatrix * vec4(position, 1.0);

        // Flowing current waves streaming south along the canal
        float flowSpeed = 1.6 + uStormIntensity * 1.4;
        float w1 = sin(worldPos.z * 0.22 - uTime * flowSpeed + worldPos.x * 0.15) * (0.024 + uStormIntensity * 0.022);
        float w2 = cos(worldPos.z * 0.52 - uTime * (flowSpeed * 1.35) - worldPos.x * 0.32) * (0.014 + uStormIntensity * 0.016);
        float w3 = sin(worldPos.x * 0.75 + uTime * 1.1) * 0.008;

        // Dynamic Patrol Boat Wake Waves (radiating Kelvin wake)
        float distToBoat = distance(worldPos.xz, uBoatPos.xz);
        float boatWake = 0.0;
        if (distToBoat < 26.0 && uBoatSpeed > 0.4) {
          float wakePhase = distToBoat * 1.7 - uTime * 5.5;
          float decay = clamp(1.0 - distToBoat / 26.0, 0.0, 1.0);
          boatWake = sin(wakePhase) * 0.038 * decay;
        }

        float totalWave = w1 + w2 + w3 + boatWake;
        worldPos.y += totalWave;

        // Analytic normal perturbation from wave derivatives
        float dwdx = cos(worldPos.z * 0.22 - uTime * flowSpeed + worldPos.x * 0.15) * 0.15 * 0.024
                   + cos(worldPos.x * 0.75 + uTime * 1.1) * 0.75 * 0.008;
        float dwdz = cos(worldPos.z * 0.22 - uTime * flowSpeed + worldPos.x * 0.15) * 0.22 * 0.024
                   - sin(worldPos.z * 0.52 - uTime * (flowSpeed * 1.35) - worldPos.x * 0.32) * 0.52 * 0.014;

        vec3 normal = normalize(vec3(-dwdx, 1.0, -dwdz));
        vNormal = normal;
        vWorldPosition = worldPos.xyz;
        vWaveHeight = totalWave;
        vBoatWake = abs(boatWake);

        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `;

    const fragmentShader = `
      uniform float uTime;
      uniform vec3 uSunDirection;
      uniform vec3 uSunColor;
      uniform vec3 uSkyColor;
      uniform vec3 uDeepWaterColor;
      uniform vec3 uShallowWaterColor;
      uniform vec3 uFoamColor;
      uniform float uStormIntensity;

      varying vec3 vWorldPosition;
      varying vec3 vNormal;
      varying vec2 vUv;
      varying float vLocalX;
      varying float vWaveHeight;
      varying float vBoatWake;

      void main() {
        vec3 normal = normalize(vNormal);
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);

        // 1. Center-to-quay water depth transition
        float edgeFactor = abs(vLocalX) / 5.8;
        vec3 waterBase = mix(uDeepWaterColor, uShallowWaterColor, smoothstep(0.3, 0.95, edgeFactor));

        // 2. Procedural dynamic caustics and wave shimmer
        float caustic1 = sin(vWorldPosition.x * 2.8 + sin(vWorldPosition.z * 3.4 - uTime * 2.2));
        float caustic2 = cos(vWorldPosition.z * 3.8 + sin(vWorldPosition.x * 2.2 + uTime * 1.8));
        float caustics = clamp((caustic1 + caustic2) * 0.5, 0.0, 1.0) * 0.25;
        waterBase += caustics * uSunColor * 0.35;

        // 3. Shoreline foam line along concrete retaining walls
        float bankFoam = smoothstep(4.9, 5.65, abs(vLocalX));
        float foamNoise = sin(vWorldPosition.z * 4.2 + uTime * 2.0) * 0.5 + 0.5;
        float totalFoam = bankFoam * (0.6 + 0.4 * foamNoise);

        // 4. Boat wake froth trail
        float wakeFoam = smoothstep(0.015, 0.035, vBoatWake) * 0.65;
        totalFoam = clamp(totalFoam + wakeFoam, 0.0, 1.0);

        // 5. Specular sun and sky reflection (Fresnel effect)
        float fresnel = clamp(1.0 - dot(viewDir, normal), 0.0, 1.0);
        fresnel = pow(fresnel, 3.2);

        vec3 lightDir = normalize(uSunDirection);
        vec3 halfVector = normalize(lightDir + viewDir);
        float spec = pow(max(dot(normal, halfVector), 0.0), 48.0);
        vec3 specularColor = uSunColor * spec * 0.85;

        // Final color assembly
        vec3 finalColor = mix(waterBase, uSkyColor, fresnel * 0.55);
        finalColor += specularColor;
        finalColor = mix(finalColor, uFoamColor, totalFoam * 0.85);

        // Storm rain disturbance darkening
        if (uStormIntensity > 0.05) {
          float rainRipple = sin(vWorldPosition.x * 12.0 + uTime * 8.0) * sin(vWorldPosition.z * 12.0 - uTime * 7.0);
          finalColor += vec3(rainRipple * 0.04 * uStormIntensity);
        }

        gl_FragColor = vec4(finalColor, 0.88);
      }
    `;

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uSunDirection: { value: new THREE.Vector3(0.5, 0.8, 0.3).normalize() },
        uSunColor: { value: new THREE.Color(0xfff5e6) },
        uSkyColor: { value: new THREE.Color(0x38bdf8) },
        uDeepWaterColor: { value: new THREE.Color(0x0a3242) },
        uShallowWaterColor: { value: new THREE.Color(0x14b8a6) },
        uFoamColor: { value: new THREE.Color(0xe0f2fe) },
        uBoatPos: { value: new THREE.Vector3(0, -999, 0) },
        uBoatSpeed: { value: 0 },
        uStormIntensity: { value: 0 }
      }
    });
  }

  _createMesh() {
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.name = "Dynamic Shibuya River Surface";
    this.mesh.renderOrder = 2; // Render after canal floor
    this.scene.add(this.mesh);
  }

  update(delta, boatPose = null, weatherController = null) {
    const dt = Math.min(delta, 0.1);
    this.elapsed += dt;

    if (!this.material) return;
    const u = this.material.uniforms;
    u.uTime.value = this.elapsed;

    // 1. Boat wake interaction
    if (boatPose && boatPose.position) {
      u.uBoatPos.value.copy(boatPose.position);
      u.uBoatSpeed.value = boatPose.speed || 0;
    } else {
      u.uBoatPos.value.set(0, -999, 0);
      u.uBoatSpeed.value = 0;
    }

    // 2. Weather lighting reactivity
    if (weatherController) {
      const mode = weatherController.currentMode || "clear";
      if (mode === "sunset") {
        u.uSkyColor.value.setHex(0xf97316);
        u.uSunColor.value.setHex(0xfba260);
        u.uDeepWaterColor.value.setHex(0x1a2e3b);
        u.uShallowWaterColor.value.setHex(0x286375);
        u.uStormIntensity.value = 0.0;
      } else if (mode === "night") {
        u.uSkyColor.value.setHex(0x0f172a);
        u.uSunColor.value.setHex(0x94a3b8);
        u.uDeepWaterColor.value.setHex(0x04131d);
        u.uShallowWaterColor.value.setHex(0x0a2636);
        u.uStormIntensity.value = 0.0;
      } else if (mode === "rain") {
        u.uSkyColor.value.setHex(0x475569);
        u.uSunColor.value.setHex(0x94a3b8);
        u.uDeepWaterColor.value.setHex(0x0d2633);
        u.uShallowWaterColor.value.setHex(0x164e63);
        u.uStormIntensity.value = 0.65;
      } else if (mode === "snow") {
        u.uSkyColor.value.setHex(0x94a3b8);
        u.uSunColor.value.setHex(0xf1f5f9);
        u.uDeepWaterColor.value.setHex(0x13394a);
        u.uShallowWaterColor.value.setHex(0x38bdf8);
        u.uStormIntensity.value = 0.15;
      } else if (mode === "storm") {
        u.uSkyColor.value.setHex(0x1e293b);
        u.uSunColor.value.setHex(0x64748b);
        u.uDeepWaterColor.value.setHex(0x051622);
        u.uShallowWaterColor.value.setHex(0x0e3a4d);
        u.uStormIntensity.value = 1.0;
      } else {
        // Clear
        u.uSkyColor.value.setHex(0x38bdf8);
        u.uSunColor.value.setHex(0xfff5e6);
        u.uDeepWaterColor.value.setHex(0x0a3242);
        u.uShallowWaterColor.value.setHex(0x14b8a6);
        u.uStormIntensity.value = 0.0;
      }
    }
  }
}
