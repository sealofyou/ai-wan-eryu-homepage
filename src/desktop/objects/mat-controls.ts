import * as THREE from "three";
import { addAction } from "../core/actions";
import type { SceneObjectResult } from "../core/types";
import { DESK_LAYOUT } from "../layout";
import { makeTextMaterial, roundedMesh, type DesktopMaterials } from "./primitives";

export const createMatControlsObject = (
  materials: DesktopMaterials,
): SceneObjectResult => {
  const group = new THREE.Group();
  const buttonMeshes: Array<{ action: string; mesh: THREE.Mesh }> = [];

  DESK_LAYOUT.matControls.buttons.forEach(({ label, action, x }) => {
    const button = addAction(
      roundedMesh(
        DESK_LAYOUT.matControls.button.size.width,
        DESK_LAYOUT.matControls.button.size.height,
        DESK_LAYOUT.matControls.button.size.depth,
        DESK_LAYOUT.matControls.button.radius,
        materials.charcoalSoft,
      ),
      action,
    );
    button.position.set(x, DESK_LAYOUT.matControls.button.y, DESK_LAYOUT.matControls.button.z);
    button.castShadow = true;
    group.add(button);
    const labelMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(
        DESK_LAYOUT.matControls.label.size.width,
        DESK_LAYOUT.matControls.label.size.height,
      ),
      makeTextMaterial(label),
    );
    labelMesh.rotation.x = DESK_LAYOUT.matControls.label.rotationX;
    labelMesh.position.set(x, DESK_LAYOUT.matControls.label.y, DESK_LAYOUT.matControls.label.z);
    group.add(labelMesh);
    buttonMeshes.push({ action, mesh: button });
  });

  return {
    group,
    interactiveTargets: buttonMeshes.map(({ mesh }) => mesh),
    update: (state) => {
      buttonMeshes.forEach(({ action, mesh }) => {
        const active = action === `mode:${state.matMode}`;
        (mesh.material as THREE.MeshStandardMaterial).color.set(active ? "#759481" : "#353633");
      });
    },
  };
};
