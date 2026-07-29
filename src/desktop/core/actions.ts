import type * as THREE from "three";
import type { SceneAction } from "./types";

export const addAction = <T extends THREE.Object3D>(object: T, action: SceneAction): T => {
  object.userData.action = action;
  return object;
};

export const actionFromObject = (object: THREE.Object3D | null): SceneAction | undefined => {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (current.userData.action) return current.userData.action as SceneAction;
    current = current.parent;
  }
  return undefined;
};
