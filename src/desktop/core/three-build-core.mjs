// Keep the published WebGL renderer/shaders, but restore core module boundaries for tree shaking.
// These internal exports match Three 0.185.1; the compatibility test must be checked on upgrades.
export * from "three/src/Three.Core.js";
export {
  UniformsUtils,
  mergeUniforms,
  cloneUniforms,
  getUnlitUniformColorSpace,
} from "three/src/renderers/shaders/UniformsUtils.js";
export {
  ReversedDepthFuncs,
  createElementNS,
  probeAsync,
} from "three/src/utils.js";
export { getByteLength } from "three/src/extras/TextureUtils.js";
export { RAD2DEG } from "three/src/math/MathUtils.js";
