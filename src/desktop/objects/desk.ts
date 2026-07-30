import * as THREE from "three";
import { addAction } from "../core/actions";
import type { SceneObjectResult } from "../core/types";
import { DESK_LAYOUT } from "../layout";
import { makeCanvas, type CanvasSurface } from "../screens/canvas-utils";
import { roundedMesh, type DesktopMaterials } from "./primitives";

export interface DeskObjectResult extends SceneObjectResult {
  matCanvas: CanvasSurface;
  matSurface: THREE.Mesh;
}

export const createDeskObject = (materials: DesktopMaterials): DeskObjectResult => {
  const group = new THREE.Group();
  const { surface, apron, mat } = DESK_LAYOUT.desk;

  const desk = roundedMesh(
    surface.size.width,
    surface.size.height,
    surface.size.depth,
    surface.radius,
    materials.wood,
  );
  desk.position.set(surface.position.x, surface.position.y, surface.position.z);
  desk.receiveShadow = true;
  desk.castShadow = true;
  group.add(desk);

  const deskApron = roundedMesh(
    apron.size.width,
    apron.size.height,
    apron.size.depth,
    apron.radius,
    materials.wood,
  );
  deskApron.position.set(apron.position.x, apron.position.y, apron.position.z);
  deskApron.receiveShadow = true;
  deskApron.castShadow = true;
  group.add(deskApron);

  const matCanvas = makeCanvas(mat.canvas.width, mat.canvas.height);
  const matBase = roundedMesh(
    mat.base.size.width,
    mat.base.size.height,
    mat.base.size.depth,
    mat.base.radius,
    new THREE.MeshStandardMaterial({ color: "#ded7ca", roughness: 0.92 }),
  );
  matBase.position.set(mat.base.position.x, mat.base.position.y, mat.base.position.z);
  matBase.receiveShadow = true;
  group.add(matBase);

  const matSurface = addAction(
    new THREE.Mesh(
      new THREE.PlaneGeometry(mat.surface.size.width, mat.surface.size.height),
      new THREE.MeshStandardMaterial({ map: matCanvas.texture, roughness: 0.92 }),
    ),
    "mat",
  );
  matSurface.rotation.x = mat.surface.rotationX;
  matSurface.position.set(
    mat.surface.position.x,
    mat.surface.position.y,
    mat.surface.position.z,
  );
  group.add(matSurface);

  return { group, matCanvas, matSurface, interactiveTargets: [matSurface] };
};
