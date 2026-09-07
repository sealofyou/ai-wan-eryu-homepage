import { addAction } from "../core/actions";
import type { SceneObjectResult } from "../core/types";
import { createKeyboardModel } from "../keyboard";
import { DESK_LAYOUT } from "../layout";
import { mapRange } from "./primitives";
import * as THREE from "three";
import { disposeObjectGraph } from "../core/renderer";

interface KeyboardObjectResult extends SceneObjectResult {
  applyStudyVisual: (visual: THREE.Group, floorY: number) => boolean;
}

export const createKeyboardObject = (): KeyboardObjectResult => {
  const baseline = createKeyboardModel();
  const group = addAction(new THREE.Group(), "keyboard");
  group.userData.dimensions = baseline.userData.dimensions;
  group.add(baseline);
  let disposed = false;
  let studyVisual: THREE.Group | undefined;
  return {
    group,
    interactiveTargets: [group],
    applyStudyVisual: (visual, floorY) => {
      if (disposed || studyVisual) {
        if (visual !== studyVisual) disposeObjectGraph(visual);
        return false;
      }
      visual.position.y = DESK_LAYOUT.desk.mat.surface.position.y - DESK_LAYOUT.keyboard.y - floorY;
      visual.traverse(node => {
        if (node instanceof THREE.Mesh) node.raycast = () => {};
      });
      const hit = addAction(new THREE.Mesh(
        new THREE.BoxGeometry(6.13, 0.46, 1.993),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, colorWrite: false, depthWrite: false }),
      ), "keyboard");
      hit.name = "keyboard-study-hit";
      hit.position.y = visual.position.y + 0.1;
      group.add(visual, hit);
      group.remove(baseline);
      disposeObjectGraph(baseline);
      studyVisual = visual;
      group.updateWorldMatrix(true, true);
      return true;
    },
    dispose: () => { disposed = true; },
    update: (state) => {
      const { keyboard } = DESK_LAYOUT;
      group.position.set(
        mapRange(state.keyboard.x, keyboard.inputX.start, keyboard.inputX.end, keyboard.x.start, keyboard.x.end),
        keyboard.y,
        mapRange(state.keyboard.y, keyboard.inputY.start, keyboard.inputY.end, keyboard.z.start, keyboard.z.end),
      );
    },
  };
};
