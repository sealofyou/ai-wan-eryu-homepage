import * as THREE from "three";
import type { SceneObjectResult } from "../core/types";
import { DESK_LAYOUT } from "../layout";
import { roundedMesh, type DesktopMaterials } from "./primitives";

export const createComputerObject = (materials: DesktopMaterials): SceneObjectResult => {
  const group = new THREE.Group();
  const { tower, inset, glow, mark } = DESK_LAYOUT.computer;

  const towerMesh = roundedMesh(
    tower.size.width,
    tower.size.height,
    tower.size.depth,
    tower.radius,
    materials.charcoal,
  );
  towerMesh.position.set(tower.position.x, tower.position.y, tower.position.z);
  towerMesh.castShadow = true;
  group.add(towerMesh);

  const towerInset = roundedMesh(
    inset.size.width,
    inset.size.height,
    inset.size.depth,
    inset.radius,
    new THREE.MeshStandardMaterial({ color: "#151716", roughness: 0.7 }),
  );
  towerInset.position.set(inset.position.x, inset.position.y, inset.position.z);
  group.add(towerInset);

  const towerGlow = roundedMesh(
    glow.size.width,
    glow.size.height,
    glow.size.depth,
    glow.radius,
    new THREE.MeshBasicMaterial({ color: "#60ab79" }),
  );
  towerGlow.position.set(glow.position.x, glow.position.y, glow.position.z);
  group.add(towerGlow);

  const eMark = new THREE.Group();
  const eMaterial = new THREE.MeshBasicMaterial({ color: "#d9d2c4" });
  const eVertical = roundedMesh(
    mark.stem.size.width,
    mark.stem.size.height,
    mark.stem.size.depth,
    mark.stem.radius,
    eMaterial,
  );
  eVertical.position.x = mark.stem.x;
  eMark.add(eVertical);
  mark.bars.forEach((bar) => {
    const barMesh = roundedMesh(
      bar.size.width,
      bar.size.height,
      bar.size.depth,
      bar.radius,
      eMaterial,
    );
    barMesh.position.set(bar.position.x, bar.position.y, bar.position.z);
    eMark.add(barMesh);
  });
  eMark.position.set(mark.position.x, mark.position.y, mark.position.z);
  group.add(eMark);

  return { group };
};
