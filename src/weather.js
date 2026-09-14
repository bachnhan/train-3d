// Procedural Weather & Atmospheric Engine for Train 3D
// Zero-dependency Three.js r125 system supporting Clear, Sunset, Night, Rain, Snow, and Storm presets.

export const WEATHER_PRESETS = {
  clear: {
    id: "clear",
    skyColor: 0x8ea7b4,
    fogColor: 0x8ea7b4,
    fogNear: 1200,
    fogFar: 3800,
    sunColor: 0xffddab,
    sunIntensity: 1.30,
    sunPosition: [-180, 260, 120],
    hemiSky: 0xbcd3d6,
    hemiGround: 0x2d251c,
    hemiIntensity: 0.62,
    exposure: 0.95,
    hasRain: false,
    hasSnow: false
  },
  sunset: {
    id: "sunset",
    skyColor: 0xbd5a3a,
    fogColor: 0xbc5b3e,
    fogNear: 600,
    fogFar: 2800,
    sunColor: 0xff7a36,
    sunIntensity: 1.45,
    sunPosition: [-260, 75, 140],
    hemiSky: 0xfb923c,
    hemiGround: 0x3b1812,
    hemiIntensity: 0.55,
    exposure: 0.95,
    hasRain: false,
    hasSnow: false
  },
  night: {
    id: "night",
    skyColor: 0x090d16,
    fogColor: 0x090d16,
    fogNear: 400,
    fogFar: 2200,
    sunColor: 0x38bdf8,
    sunIntensity: 0.28,
    sunPosition: [120, 220, -100],
    hemiSky: 0x1e293b,
    hemiGround: 0x09090b,
    hemiIntensity: 0.30,
    exposure: 0.65, // Low exposure lets neon, shop windows, and headlights pop
    hasRain: false,
    hasSnow: false
  },
  rain: {
    id: "rain",
    skyColor: 0x475569,
    fogColor: 0x475569,
    fogNear: 350,
    fogFar: 1800,
    sunColor: 0x94a3b8,
    sunIntensity: 0.50,
    sunPosition: [-120, 200, 80],
    hemiSky: 0x64748b,
    hemiGround: 0x1e293b,
    hemiIntensity: 0.50,
    exposure: 0.80,
    hasRain: true,
    hasSnow: false
  },
  snow: {
    id: "snow",
    skyColor: 0x94a3b8,
    fogColor: 0x94a3b8,
    fogNear: 400,
    fogFar: 2200,
    sunColor: 0xe2e8f0,
    sunIntensity: 0.65,
    sunPosition: [-140, 220, 100],
    hemiSky: 0xdbeafe,
    hemiGround: 0x334155,
    hemiIntensity: 0.65,
    exposure: 0.80,
    hasRain: false,
    hasSnow: true
  },
  storm: {
    id: "storm",
    skyColor: 0x111827,
    fogColor: 0x111827,
    fogNear: 200,
    fogFar: 1400,
    sunColor: 0x334155,
    sunIntensity: 0.35,
    sunPosition: [-120, 200, 80],
    hemiSky: 0x1e293b,
    hemiGround: 0x0f172a,
    hemiIntensity: 0.32,
    exposure: 0.75,
    hasRain: true,
    hasSnow: false
  }
};

const RAIN_COUNT = 1200;
const SNOW_COUNT = 900;
const BOX_HALF_X = 65;
const BOX_TOP_Y = 55;
const BOX_BOTTOM_Y = -1;
const BOX_HALF_Z = 65;

export class WeatherController {
  constructor({ scene, sun, hemi, renderer, onThunder, onRainSoundChange }) {
    this.scene = scene;
    this.sun = sun;
    this.hemi = hemi;
    this.renderer = renderer;
    this.onThunder = onThunder;
    this.onRainSoundChange = onRainSoundChange;

    this.currentPreset = "clear";
    this.targetPreset = "clear";
    this.lerpProgress = 1.0;

    // Current interpolated lighting colors
    this.currentSky = new THREE.Color(WEATHER_PRESETS.clear.skyColor);
    this.currentFog = new THREE.Color(WEATHER_PRESETS.clear.fogColor);
    this.currentSunColor = new THREE.Color(WEATHER_PRESETS.clear.sunColor);
    this.currentSunIntensity = WEATHER_PRESETS.clear.sunIntensity;
    this.currentSunPos = new THREE.Vector3(...WEATHER_PRESETS.clear.sunPosition);
    this.currentHemiSky = new THREE.Color(WEATHER_PRESETS.clear.hemiSky);
    this.currentHemiGround = new THREE.Color(WEATHER_PRESETS.clear.hemiGround);
    this.currentHemiIntensity = WEATHER_PRESETS.clear.hemiIntensity;
    this.currentExposure = WEATHER_PRESETS.clear.exposure;
    this.currentFogNear = WEATHER_PRESETS.clear.fogNear;
    this.currentFogFar = WEATHER_PRESETS.clear.fogFar;

    // Target colors for lerp
    this.sourceState = { ...WEATHER_PRESETS.clear };
    this.targetState = { ...WEATHER_PRESETS.clear };

    // Lightning flash state
    this.lightningTimer = 0;
    this.nextLightningInterval = 7 + Math.random() * 6;
    this.flashPhase = 0; // 0: idle, >0: flashing sequence
    this.flashElapsed = 0;
    this.flashIntensity = 0;

    this._initParticles();
  }

  _initParticles() {
    // 1. Rain Streak Geometry & Mesh (Lines)
    const rainPositions = new Float32Array(RAIN_COUNT * 6); // 2 vertices per line (x, y, z)
    this.rainOffsets = [];
    for (let i = 0; i < RAIN_COUNT; i += 1) {
      const rx = (Math.random() - 0.5) * (BOX_HALF_X * 2);
      const ry = Math.random() * (BOX_TOP_Y - BOX_BOTTOM_Y) + BOX_BOTTOM_Y;
      const rz = (Math.random() - 0.5) * (BOX_HALF_Z * 2);
      const dropLen = 1.4 + Math.random() * 0.8;
      const speed = 42.0 + Math.random() * 12.0;

      this.rainOffsets.push({ rx, ry, rz, dropLen, speed });

      const idx = i * 6;
      rainPositions[idx + 0] = rx;
      rainPositions[idx + 1] = ry;
      rainPositions[idx + 2] = rz;
      rainPositions[idx + 3] = rx - 0.08;
      rainPositions[idx + 4] = ry - dropLen;
      rainPositions[idx + 5] = rz + 0.04;
    }

    this.rainGeom = new THREE.BufferGeometry();
    this.rainGeom.setAttribute("position", new THREE.BufferAttribute(rainPositions, 3));
    this.rainMat = new THREE.LineBasicMaterial({
      color: 0xa5b4fc,
      transparent: true,
      opacity: 0.52,
      depthWrite: false
    });
    this.rainMesh = new THREE.LineSegments(this.rainGeom, this.rainMat);
    this.rainMesh.name = "Weather Rain System";
    this.rainMesh.visible = false;
    this.rainMesh.frustumCulled = false;
    this.scene.add(this.rainMesh);

    // 2. Snow Flake Geometry & Mesh (Points)
    const snowPositions = new Float32Array(SNOW_COUNT * 3);
    this.snowOffsets = [];
    for (let i = 0; i < SNOW_COUNT; i += 1) {
      const sx = (Math.random() - 0.5) * (BOX_HALF_X * 2);
      const sy = Math.random() * (BOX_TOP_Y - BOX_BOTTOM_Y) + BOX_BOTTOM_Y;
      const sz = (Math.random() - 0.5) * (BOX_HALF_Z * 2);
      const speed = 2.2 + Math.random() * 1.6;
      const flutterPhase = Math.random() * Math.PI * 2;
      const flutterSpeed = 1.8 + Math.random() * 2.0;

      this.snowOffsets.push({ sx, sy, sz, speed, flutterPhase, flutterSpeed });

      const idx = i * 3;
      snowPositions[idx + 0] = sx;
      snowPositions[idx + 1] = sy;
      snowPositions[idx + 2] = sz;
    }

    this.snowGeom = new THREE.BufferGeometry();
    this.snowGeom.setAttribute("position", new THREE.BufferAttribute(snowPositions, 3));
    this.snowMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.65,
      transparent: true,
      opacity: 0.85,
      depthWrite: false
    });
    this.snowMesh = new THREE.Points(this.snowGeom, this.snowMat);
    this.snowMesh.name = "Weather Snow System";
    this.snowMesh.visible = false;
    this.snowMesh.frustumCulled = false;
    this.scene.add(this.snowMesh);
  }

  setWeather(presetId) {
    if (!WEATHER_PRESETS[presetId]) return;
    if (this.currentPreset === presetId && this.lerpProgress >= 1.0) return;

    this.sourceState = {
      skyColor: this.currentSky.getHex(),
      fogColor: this.currentFog.getHex(),
      fogNear: this.currentFogNear,
      fogFar: this.currentFogFar,
      sunColor: this.currentSunColor.getHex(),
      sunIntensity: this.currentSunIntensity,
      sunPosition: [this.currentSunPos.x, this.currentSunPos.y, this.currentSunPos.z],
      hemiSky: this.currentHemiSky.getHex(),
      hemiGround: this.currentHemiGround.getHex(),
      hemiIntensity: this.currentHemiIntensity,
      exposure: this.currentExposure
    };

    this.targetPreset = presetId;
    this.targetState = WEATHER_PRESETS[presetId];
    this.currentPreset = presetId;
    this.lerpProgress = 0.0;

    // Enable/disable particle meshes
    this.rainMesh.visible = this.targetState.hasRain;
    this.snowMesh.visible = this.targetState.hasSnow;

    // Rain material intensity
    if (presetId === "storm") {
      this.rainMat.opacity = 0.72;
    } else {
      this.rainMat.opacity = 0.52;
    }

    // Audio callback
    if (this.onRainSoundChange) {
      this.onRainSoundChange(this.targetState.hasRain, presetId === "storm");
    }

    // Always re-bake shadows when sun vector transitions
    if (this.renderer?.shadowMap) {
      this.renderer.shadowMap.needsUpdate = true;
    }
  }

  triggerLightning() {
    this.flashPhase = 1;
    this.flashElapsed = 0;
    this.flashIntensity = 3.6;

    // Simulate sound of thunder arriving slightly after lightning flash
    if (this.onThunder) {
      setTimeout(() => {
        this.onThunder();
      }, 260 + Math.random() * 200);
    }
  }

  update(delta, focusPosition) {
    const dt = Math.min(delta, 0.1);

    // 1. Smooth Atmospheric Transition Lerp
    if (this.lerpProgress < 1.0) {
      this.lerpProgress = Math.min(1.0, this.lerpProgress + dt / 0.85);
      const t = this.lerpProgress;
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

      // Lerp Sky background & Fog
      this.currentSky.set(this.sourceState.skyColor).lerp(new THREE.Color(this.targetState.skyColor), ease);
      this.currentFog.set(this.sourceState.fogColor).lerp(new THREE.Color(this.targetState.fogColor), ease);
      this.currentFogNear = THREE.MathUtils.lerp(this.sourceState.fogNear, this.targetState.fogNear, ease);
      this.currentFogFar = THREE.MathUtils.lerp(this.sourceState.fogFar, this.targetState.fogFar, ease);

      // Lerp Sun
      this.currentSunColor.set(this.sourceState.sunColor).lerp(new THREE.Color(this.targetState.sunColor), ease);
      this.currentSunIntensity = THREE.MathUtils.lerp(this.sourceState.sunIntensity, this.targetState.sunIntensity, ease);
      this.currentSunPos.x = THREE.MathUtils.lerp(this.sourceState.sunPosition[0], this.targetState.sunPosition[0], ease);
      this.currentSunPos.y = THREE.MathUtils.lerp(this.sourceState.sunPosition[1], this.targetState.sunPosition[1], ease);
      this.currentSunPos.z = THREE.MathUtils.lerp(this.sourceState.sunPosition[2], this.targetState.sunPosition[2], ease);

      // Lerp Hemisphere
      this.currentHemiSky.set(this.sourceState.hemiSky).lerp(new THREE.Color(this.targetState.hemiSky), ease);
      this.currentHemiGround.set(this.sourceState.hemiGround).lerp(new THREE.Color(this.targetState.hemiGround), ease);
      this.currentHemiIntensity = THREE.MathUtils.lerp(this.sourceState.hemiIntensity, this.targetState.hemiIntensity, ease);

      // Exposure
      this.currentExposure = THREE.MathUtils.lerp(this.sourceState.exposure, this.targetState.exposure, ease);
    }

    // 2. Lightning Flash Sequencing (Storm mode or manual)
    if (this.currentPreset === "storm") {
      this.lightningTimer += dt;
      if (this.lightningTimer >= this.nextLightningInterval) {
        this.lightningTimer = 0;
        this.nextLightningInterval = 8 + Math.random() * 8;
        this.triggerLightning();
      }
    }

    if (this.flashPhase > 0) {
      this.flashElapsed += dt;
      // Multi-burst lightning sequence:
      // Burst 1: 0.00s - 0.06s (peak 3.5)
      // Dip:     0.06s - 0.10s (drop to 0.4)
      // Burst 2: 0.10s - 0.20s (peak 2.8)
      // Decay:   0.20s - 0.35s (fade to 0)
      if (this.flashElapsed < 0.06) {
        this.flashIntensity = 3.6;
      } else if (this.flashElapsed < 0.10) {
        this.flashIntensity = 0.5;
      } else if (this.flashElapsed < 0.20) {
        this.flashIntensity = 2.7;
      } else if (this.flashElapsed < 0.35) {
        const decay = 1.0 - (this.flashElapsed - 0.20) / 0.15;
        this.flashIntensity = decay * 2.0;
      } else {
        this.flashIntensity = 0;
        this.flashPhase = 0;
      }
    }

    // 3. Apply Lighting & Atmosphere to Scene
    this.scene.background.copy(this.currentSky);
    if (this.scene.fog) {
      this.scene.fog.color.copy(this.currentFog);
      this.scene.fog.near = this.currentFogNear;
      this.scene.fog.far = this.currentFogFar;
    }

    if (this.sun) {
      this.sun.position.copy(this.currentSunPos);
      if (this.flashPhase > 0 && this.flashIntensity > 0) {
        // Blinding white flash during lightning
        this.sun.color.setRGB(1.0, 1.0, 1.0);
        this.sun.intensity = this.currentSunIntensity + this.flashIntensity;
      } else {
        this.sun.color.copy(this.currentSunColor);
        this.sun.intensity = this.currentSunIntensity;
      }
    }

    if (this.hemi) {
      if (this.flashPhase > 0 && this.flashIntensity > 0) {
        this.hemi.color.setRGB(0.9, 0.95, 1.0);
        this.hemi.intensity = this.currentHemiIntensity + this.flashIntensity * 0.4;
      } else {
        this.hemi.color.copy(this.currentHemiSky);
        this.hemi.groundColor.copy(this.currentHemiGround);
        this.hemi.intensity = this.currentHemiIntensity;
      }
    }

    if (this.renderer) {
      this.renderer.toneMappingExposure = this.currentExposure;
    }

    // 4. Update Precipitation Particles Centered on Target
    const cx = focusPosition ? focusPosition.x : 0;
    const cy = focusPosition ? Math.max(0, focusPosition.y) : 10;
    const cz = focusPosition ? focusPosition.z : 0;

    if (this.rainMesh.visible) {
      this._updateRain(dt, cx, cy, cz);
    }
    if (this.snowMesh.visible) {
      this._updateSnow(dt, cx, cy, cz);
    }
  }

  _updateRain(dt, cx, cy, cz) {
    const posAttr = this.rainGeom.getAttribute("position");
    const arr = posAttr.array;
    const windX = this.currentPreset === "storm" ? -5.5 : -1.8;
    const windZ = this.currentPreset === "storm" ? 2.6 : 0.8;

    for (let i = 0; i < RAIN_COUNT; i += 1) {
      const drop = this.rainOffsets[i];
      drop.ry -= drop.speed * dt;
      drop.rx += windX * dt;
      drop.rz += windZ * dt;

      // Wrap vertically and horizontally around moving camera focus
      if (drop.ry < BOX_BOTTOM_Y) {
        drop.ry = BOX_TOP_Y + Math.random() * 5.0;
        drop.rx = (Math.random() - 0.5) * (BOX_HALF_X * 2);
        drop.rz = (Math.random() - 0.5) * (BOX_HALF_Z * 2);
      }
      if (drop.rx < -BOX_HALF_X) drop.rx += BOX_HALF_X * 2;
      if (drop.rx > BOX_HALF_X) drop.rx -= BOX_HALF_X * 2;
      if (drop.rz < -BOX_HALF_Z) drop.rz += BOX_HALF_Z * 2;
      if (drop.rz > BOX_HALF_Z) drop.rz -= BOX_HALF_Z * 2;

      const wx = cx + drop.rx;
      const wy = cy + drop.ry;
      const wz = cz + drop.rz;

      const idx = i * 6;
      arr[idx + 0] = wx;
      arr[idx + 1] = wy;
      arr[idx + 2] = wz;
      arr[idx + 3] = wx + windX * 0.035;
      arr[idx + 4] = wy - drop.dropLen;
      arr[idx + 5] = wz + windZ * 0.035;
    }
    posAttr.needsUpdate = true;
  }

  _updateSnow(dt, cx, cy, cz) {
    const posAttr = this.snowGeom.getAttribute("position");
    const arr = posAttr.array;

    for (let i = 0; i < SNOW_COUNT; i += 1) {
      const flake = this.snowOffsets[i];
      flake.flutterPhase += flake.flutterSpeed * dt;
      flake.sy -= flake.speed * dt;
      flake.sx += Math.sin(flake.flutterPhase) * 1.2 * dt;
      flake.sz += Math.cos(flake.flutterPhase * 0.8) * 0.9 * dt;

      // Wrap around focus box
      if (flake.sy < BOX_BOTTOM_Y) {
        flake.sy = BOX_TOP_Y + Math.random() * 4.0;
        flake.sx = (Math.random() - 0.5) * (BOX_HALF_X * 2);
        flake.sz = (Math.random() - 0.5) * (BOX_HALF_Z * 2);
      }
      if (flake.sx < -BOX_HALF_X) flake.sx += BOX_HALF_X * 2;
      if (flake.sx > BOX_HALF_X) flake.sx -= BOX_HALF_X * 2;
      if (flake.sz < -BOX_HALF_Z) flake.sz += BOX_HALF_Z * 2;
      if (flake.sz > BOX_HALF_Z) flake.sz -= BOX_HALF_Z * 2;

      const idx = i * 3;
      arr[idx + 0] = cx + flake.sx;
      arr[idx + 1] = cy + flake.sy;
      arr[idx + 2] = cz + flake.sz;
    }
    posAttr.needsUpdate = true;
  }

  getWeatherState() {
    return {
      preset: this.currentPreset,
      isStorm: this.currentPreset === "storm",
      isRain: this.targetState.hasRain,
      isSnow: this.targetState.hasSnow
    };
  }
}
