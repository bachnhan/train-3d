const timedShaders = [];

function injectWorld(shader, snippet, timed = false) {
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", "#include <common>\nvarying vec3 vWp;\nvarying vec3 vWn;")
    .replace("#include <project_vertex>", `#include <project_vertex>
      vec4 wp = vec4(transformed, 1.0);
      mat3 instanceRotation = mat3(1.0);
      #ifdef USE_INSTANCING
        wp = instanceMatrix * wp;
        instanceRotation = mat3(instanceMatrix);
      #endif
      vWp = (modelMatrix * wp).xyz;
      vWn = normalize(mat3(modelMatrix) * instanceRotation * objectNormal);`);
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", `#include <common>
      varying vec3 vWp;
      varying vec3 vWn;
      ${timed ? "uniform float uTime;" : ""}`)
    .replace("#include <color_fragment>", `#include <color_fragment>
      ${snippet}`);
  if (timed) {
    shader.uniforms.uTime = { value: 0 };
    timedShaders.push(shader);
  }
}

function patterned(options, key, snippet, timed = false) {
  const material = new THREE.MeshStandardMaterial({
    color: options.color ?? 0xffffff,
    roughness: options.roughness ?? 0.9,
    metalness: options.metalness ?? 0,
    vertexColors: options.vertexColors ?? false,
    polygonOffset: options.polygonOffset ?? false,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1
  });
  material.customProgramCacheKey = () => key;
  material.onBeforeCompile = (shader) => injectWorld(shader, snippet, timed);
  return material;
}

export function createUrbanGroundMaterial(options = {}) {
  return patterned({
    vertexColors: true,
    roughness: 0.88,
    metalness: 0.02,
    ...options
  }, "urban-ground", `
    if (vWn.y > 0.65 && vWp.y < 0.15) {
      // Screen-space derivative anti-aliasing: fade micro-grain at grazing angles and long distance
      float pixelSpan = length(vec2(dFdx(vWp.x), dFdy(vWp.z)));
      float grainFade = smoothstep(0.20, 0.02, pixelSpan);

      // Micro aggregate grain (crisp up-close, smoothly suppressed at distant camera angles)
      float grain1 = sin(vWp.x * 28.0) * cos(vWp.z * 28.0);
      float grain2 = sin(vWp.x * 53.0 + vWp.z * 41.0) * 0.5;
      float microGrain = (grain1 + grain2) * 0.028 * grainFade;

      // Soft low-frequency macro urban tone mottling
      float macroNoise = sin(vWp.x * 0.02 + sin(vWp.z * 0.015)) * cos(vWp.z * 0.02 + sin(vWp.x * 0.015));
      float tone = 0.96 + 0.07 * (macroNoise * 0.5 + 0.5);

      diffuseColor.rgb *= tone;
      diffuseColor.rgb += vec3(microGrain);
    }
  `);
}

export function createMasonryMaterial(options = {}) {
  return patterned(options, "masonry", `
    float row = floor(vWp.y * 28.0);
    float along = abs(vWn.z) > 0.55 ? vWp.x : vWp.z;
    vec2 brick = vec2(fract(along * 14.0 + mod(row, 2.0) * 0.5), fract(vWp.y * 28.0));
    float mortar = 1.0 - smoothstep(0.05, 0.11, min(brick.x, brick.y));
    diffuseColor.rgb *= mix(vec3(1.0), vec3(0.66, 0.6, 0.54), mortar * 0.9);
  `);
}

export function createTimberMaterial(options = {}) {
  return patterned({ roughness: 0.92, ...options }, "timber", `
    float along = vWp.x * 0.92 + vWp.z * 0.08;
    float grain = sin(along * 36.0) * 0.07 + sin(along * 88.0 + vWp.z * 4.0) * 0.03;
    float ring = sin(vWp.z * 6.0 + along * 1.4) * 0.02;
    diffuseColor.rgb *= 0.9 + grain + ring;
  `);
}

export function createFieldMaterial(options = {}) {
  return patterned({
    roughness: 0.97,
    polygonOffset: true,
    ...options
  }, "field", `
    float furrow = 0.93 + 0.07 * sin(vWp.x * 18.0 + vWp.z * 2.4);
    float blot = 0.97 + 0.03 * sin(vWp.x * 6.5 + vWp.z * 9.1);
    diffuseColor.rgb *= furrow * blot;
  `);
}

export function createWaterMaterial(options = {}) {
  const {
    color = 0x3d7c98,
    depthAxis = "z",
    depthStart = 0,
    depthEnd = 1,
    depthMode = "linear",
    ...materialOptions
  } = options;
  const coordinate = depthAxis === "x" ? "vWp.x" : "vWp.z";
  const span = Math.max(Math.abs(depthEnd - depthStart), 0.0001);
  const depth = depthMode === "channel"
    ? `clamp(1.0 - abs(${coordinate} - ${depthStart.toFixed(4)}) / ${span.toFixed(4)}, 0.0, 1.0)`
    : `clamp((${coordinate} - ${depthStart.toFixed(4)}) / ${(depthEnd - depthStart).toFixed(4)}, 0.0, 1.0)`;
  return patterned({
    color,
    roughness: 0.55,
    metalness: 0.08,
    ...materialOptions
  }, `water-${depthAxis}-${depthMode}-${depthStart}-${depthEnd}`, `
    float waterDepth = ${depth};
    diffuseColor.rgb *= mix(vec3(1.08, 1.06, 0.96), vec3(0.68, 0.83, 0.92), waterDepth);
    float wave = sin(vWp.x * 9.0 + uTime * 0.55) * 0.035 + sin(vWp.z * 7.0 - uTime * 0.4) * 0.03;
    diffuseColor.rgb += vec3(-0.025, 0.02, 0.045) * wave;
  `, true);
}

export function updateMaterials(elapsed) {
  timedShaders.forEach((shader) => {
    shader.uniforms.uTime.value = elapsed;
  });
}
