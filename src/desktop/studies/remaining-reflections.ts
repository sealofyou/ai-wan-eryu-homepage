import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

/** One bounded, generated reflection map; no additional lights or render pass per frame. */
export function applyRemainingReflections(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
  const previousMap = scene.environment;
  const previousIntensity = scene.environmentIntensity;
  const generator = new THREE.PMREMGenerator(renderer);
  let room: RoomEnvironment | undefined;
  let target: THREE.WebGLRenderTarget;
  try {
    room = new RoomEnvironment();
    target = generator.fromScene(room, 0.06, 0.1, 100, { size: 128 });
  } finally {
    room?.dispose();
    generator.dispose();
  }
  scene.environment = target.texture;
  scene.environmentIntensity = 0.28;
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    scene.environment = previousMap;
    scene.environmentIntensity = previousIntensity;
    target.dispose();
  };
  return { dispose, textureBytes: target.width * target.height * 4 * 2 };
}
