import * as THREE from "three";
import { disposeObjectGraph } from "../core/renderer";
import { createComputerStudyVisual } from "./computer-study-model";
import { applyEnvironmentFinish, type EnvironmentFinishRefs } from "./environment-finish";
import { createLampStudyVisual } from "./lamp-study-model";
import { createSoundbarStudyVisual } from "./soundbar-study-model";
import { applyRemainingReflections } from "./remaining-reflections";
import { DESK_LAYOUT } from "../layout";

interface RemainingVisualOptions {
  world: THREE.Group;
  refs: EnvironmentFinishRefs;
  originals: THREE.Object3D[];
  lampLight: THREE.PointLight;
  withBrand?: boolean;
  reflectionEnvironment?: { renderer: THREE.WebGLRenderer; scene: THREE.Scene };
}

export function applyRemainingVisuals({ world, refs, originals, lampLight, withBrand = true, reflectionEnvironment }: RemainingVisualOptions) {
  const group = new THREE.Group();
  group.name = "remaining-desktop-visuals";
  const visibility = originals.map(object => object.visible);
  const lampPosition = lampLight.position.clone();
  let finish: ReturnType<typeof applyEnvironmentFinish> | undefined;
  let disposed = false;
  let reflections: ReturnType<typeof applyRemainingReflections> | undefined;
  let backdropGeometry: THREE.BoxGeometry | undefined;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    reflections?.dispose();
    group.removeFromParent();
    finish?.group.removeFromParent();
    finish?.dispose();
    backdropGeometry?.dispose();
    disposeObjectGraph(group);
    group.clear();
    originals.forEach((object, index) => { object.visible = visibility[index]; });
    lampLight.position.copy(lampPosition);
  };
  try {
    group.add(createComputerStudyVisual());
    const lamp = createLampStudyVisual();
    group.add(lamp.group);
    const soundbar = createSoundbarStudyVisual({ withBrand });
    group.add(soundbar);
    let modelTriangles = 0;
    group.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const vertices = object.geometry.index?.count ?? object.geometry.getAttribute("position").count;
      modelTriangles += vertices / 3 * (object instanceof THREE.InstancedMesh ? object.count : 1);
    });
    finish = applyEnvironmentFinish(refs);
    // Only the room backdrop extends outside the fixed camera. Foreground anchors stay untouched.
    backdropGeometry = new THREE.BoxGeometry(34, 18.4, DESK_LAYOUT.room.wall.size.depth);
    refs.wall.geometry = backdropGeometry;
    if (reflectionEnvironment) reflections = applyRemainingReflections(reflectionEnvironment.renderer, reflectionEnvironment.scene);
    group.add(finish.group);
    world.add(group);
    originals.forEach(object => { object.visible = false; });
    lampLight.position.copy(lamp.bulbPosition);
    lamp.setBrightness(lampLight.intensity / 55);
    return {
      group,
      stats: {
        triangles: modelTriangles + finish.stats.triangles + 12,
        textureBytes: (soundbar.userData.textureBytes as number) + finish.stats.textureBytes + (reflections?.textureBytes ?? 0),
      },
      setLampBrightness: (intensity: number) => { if (!disposed) lamp.setBrightness(intensity / 55); },
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
