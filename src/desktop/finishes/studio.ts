import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import type { DesktopRendererEnvironment } from "../core/renderer";
import type { DesktopMaterials } from "../objects/primitives";
import { roundedMesh } from "../objects/primitives";
import { DESK_LAYOUT } from "../layout";
import { withVisualTransaction } from "./transaction";

interface StudioFinishOptions {
  environment: Pick<DesktopRendererEnvironment, "renderer" | "scene" | "world" | "lights">;
  materials: DesktopMaterials;
  matSurface: THREE.Mesh;
  monitors: THREE.Group;
  lamp: THREE.Group;
}

const noise = (x: number, y: number) => {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return value - Math.floor(value);
};

const texture = (
  size: number,
  sample: (x: number, y: number) => readonly number[],
  color = false,
) => {
  const bytes = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const pixel = sample(x, y);
      const offset = (y * size + x) * 4;
      bytes[offset] = pixel[0];
      bytes[offset + 1] = pixel[1] ?? pixel[0];
      bytes[offset + 2] = pixel[2] ?? pixel[0];
      bytes[offset + 3] = 255;
    }
  }
  const map = new THREE.DataTexture(bytes, size, size);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.magFilter = THREE.LinearFilter;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.generateMipmaps = true;
  map.anisotropy = 8;
  if (color) map.colorSpace = THREE.SRGBColorSpace;
  map.needsUpdate = true;
  return map;
};

const smoothNoise = (x: number, y: number) => {
  const ix = Math.floor(x), iy = Math.floor(y);
  const dx = x - ix, dy = y - iy;
  const sx = dx * dx * (3 - 2 * dx), sy = dy * dy * (3 - 2 * dy);
  const a = THREE.MathUtils.lerp(noise(ix, iy), noise(ix + 1, iy), sx);
  const b = THREE.MathUtils.lerp(noise(ix, iy + 1), noise(ix + 1, iy + 1), sx);
  return THREE.MathUtils.lerp(a, b, sy);
};

const woodGrain = (x: number, y: number) =>
  (smoothNoise(x * 0.02, y * 0.4) - 0.5) * 0.65 +
  (smoothNoise(x * 0.004, y * 0.025) - 0.5) * 1.1 +
  (noise(x, y) - 0.5) * 0.08;

const addLampDetails = (lamp: THREE.Group) => {
  const shade = lamp.children.find(
    (child) => child.userData.action === "lamp",
  );
  if (!(shade instanceof THREE.Mesh)) return;
  const { lamp: layout } = DESK_LAYOUT;
  const shell = shade.material as THREE.MeshStandardMaterial;
  shell.roughness = 0.46;
  shell.metalness = 0.26;

  const liner = new THREE.Mesh(
    new THREE.CylinderGeometry(
      layout.shade.radiusTop - 0.025,
      layout.shade.radiusBottom - 0.03,
      layout.shade.height - 0.025,
      48, 1, true,
    ),
    new THREE.MeshStandardMaterial({ color: "#e6d9bd", roughness: 0.58, side: THREE.BackSide }),
  );
  shade.add(liner);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(layout.shade.radiusBottom - 0.014, 0.025, 10, 64),
    shell,
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = -layout.shade.height / 2;
  shade.add(rim);

  const jointMaterial = new THREE.MeshStandardMaterial({
    color: "#343630", metalness: 0.34, roughness: 0.42,
  });
  for (const [x, y] of [[0.33, 2.16], [-0.57, 3.77], [0.03, 0.22]]) {
    const joint = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.24, 32), jointMaterial);
    joint.rotation.x = Math.PI / 2;
    joint.position.set(x, y, 0);
    joint.castShadow = true;
    lamp.add(joint);
    const fastener = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 20), shell);
    fastener.rotation.x = Math.PI / 2;
    fastener.position.set(x, y, 0.13);
    lamp.add(fastener);
  }
};

/** A visual-only layer: no camera, layout or interaction state is changed. */
export const applyStudioFinish = ({
  environment, materials, matSurface, monitors, lamp,
}: StudioFinishOptions): (() => void) => withVisualTransaction(environment.world, (own) => {
  const { renderer, scene, world, lights } = environment;
  const makeTexture: typeof texture = (...args) => own(texture(...args));
  const micro = makeTexture(256, (x, y) => [125 + noise(x, y) * 18]);
  micro.repeat.set(4, 4);
  const roughness = makeTexture(256, (x, y) => [195 + noise(x, y) * 25]);
  roughness.repeat.set(4, 4);

  const visited = new Set<THREE.MeshStandardMaterial>();
  world.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of objectMaterials) {
      if (!(material instanceof THREE.MeshStandardMaterial) || visited.has(material) || material.roughness >= 0.96) continue;
      visited.add(material);
      material.roughness = Math.min(material.roughness, 0.69);
      material.roughnessMap = roughness;
      material.bumpMap = micro;
      material.bumpScale = 0.006;
      material.needsUpdate = true;
    }
  });

  materials.charcoal.roughness = 0.59;
  materials.charcoal.metalness = 0.12;
  materials.charcoalSoft.roughness = 0.74;
  materials.warmWhite.roughness = 0.71;
  materials.wood.color.set("#ffffff");
  materials.wood.map = makeTexture(512, (x, y) => {
    const grain = woodGrain(x, y) * 17;
    return [116 + grain, 85 + grain * 0.8, 64 + grain * 0.55];
  }, true);
  materials.wood.bumpMap = makeTexture(512, (x, y) => [128 + woodGrain(x, y) * 22]);
  materials.wood.bumpScale = 0.012;
  materials.wood.roughness = 0.74;
  materials.wood.metalness = 0.025;
  // Use the same physical grain scale on the tabletop and its thin front edge.
  const desktop = DESK_LAYOUT.desk.surface;
  world.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || object.material !== materials.wood) return;
    const position = object.geometry.getAttribute("position");
    const normal = object.geometry.getAttribute("normal");
    const uv = object.geometry.getAttribute("uv").clone();
    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index) + object.position.x;
      const y = position.getY(index) + object.position.y;
      const z = position.getZ(index) + object.position.z;
      const topV = (z - desktop.position.z) / desktop.size.depth + 0.5;
      const edgeOffset = Math.abs(normal.getY(index)) > 0.7
        ? 0 : (y - desktop.position.y - desktop.size.height / 2) / desktop.size.depth;
      uv.setXY(index, x / desktop.size.width + 0.5, topV + edgeOffset);
    }
    object.geometry.setAttribute("uv", uv);
  });

  const weave = makeTexture(256, (x, y) => [
    128 + Math.sin(x * Math.PI / 2) * 12 + Math.sin(y * Math.PI / 2) * 12 + noise(x, y) * 4,
  ]);
  weave.repeat.set(12, 5);
  const matMaterial = matSurface.material as THREE.MeshStandardMaterial;
  matMaterial.bumpMap = weave;
  matMaterial.bumpScale = 0.008;
  matMaterial.roughness = 0.98;
  matSurface.receiveShadow = true;

  const soundbar = DESK_LAYOUT.mainMonitor.soundbar;
  const grille = roundedMesh(4.05, 0.43, 0.045, 0.12,
    new THREE.MeshStandardMaterial({
      color: "#30312d", roughness: 0.93, bumpMap: weave, bumpScale: 0.012,
    }),
  );
  grille.position.set(soundbar.position.x, soundbar.position.y, soundbar.position.z + 0.363);
  grille.receiveShadow = true;
  monitors.add(grille);
  addLampDetails(lamp);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  let environmentTarget: THREE.WebGLRenderTarget;
  try {
    environmentTarget = own(pmrem.fromScene(room, 0.04));
  } finally {
    room.dispose();
    pmrem.dispose();
  }
  scene.environment = environmentTarget.texture;
  scene.environmentIntensity = 0.28;
  lights.hemisphereLight.intensity = 1.6;
  lights.hemisphereLight.color.set("#fff8ec");
  lights.hemisphereLight.groundColor.set("#736253");
  lights.keyLight.intensity = 3.1;
  lights.keyLight.color.set("#fff3df");
  lights.keyLight.shadow.radius = 3;
  lights.keyLight.shadow.bias = -0.0001;
  lights.keyLight.shadow.normalBias = 0.025;
  lights.lampLight.castShadow = false;
  lights.screenLight.intensity = 10;
  renderer.toneMappingExposure = 1.02;

  return () => {
    scene.environment = null;
    environmentTarget.dispose();
  };
});
