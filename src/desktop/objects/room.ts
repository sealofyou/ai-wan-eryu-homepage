import * as THREE from "three";
import { DESK_LAYOUT } from "../layout";
import type { SceneObjectResult } from "../core/types";
import { roundedMesh } from "./primitives";

export const createRoomObject = (): SceneObjectResult => {
  const group = new THREE.Group();
  const { wall } = DESK_LAYOUT.room;
  const wallMesh = roundedMesh(
    wall.size.width,
    wall.size.height,
    wall.size.depth,
    wall.radius,
    new THREE.MeshStandardMaterial({ color: "#9b846c", roughness: 0.96 }),
  );
  wallMesh.position.set(wall.position.x, wall.position.y, wall.position.z);
  wallMesh.receiveShadow = true;
  group.add(wallMesh);
  return { group };
};
