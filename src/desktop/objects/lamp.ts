import * as THREE from "three";
import { addAction } from "../core/actions";
import type { SceneObjectResult } from "../core/types";
import { DESK_LAYOUT } from "../layout";
import { roundedMesh, type DesktopMaterials } from "./primitives";

export const createLampObject = (materials: DesktopMaterials): SceneObjectResult => {
  const group = new THREE.Group();
  const { lamp } = DESK_LAYOUT;
  group.position.set(lamp.position.x, lamp.position.y, lamp.position.z);

  const lampBase = roundedMesh(
    lamp.base.size.width,
    lamp.base.size.height,
    lamp.base.size.depth,
    lamp.base.radius,
    materials.charcoal,
  );
  lampBase.castShadow = true;
  group.add(lampBase);

  const lowerArm = new THREE.Mesh(
    new THREE.CylinderGeometry(lamp.lowerArm.radius, lamp.lowerArm.radius, lamp.lowerArm.height, 18),
    materials.charcoalSoft,
  );
  lowerArm.position.set(lamp.lowerArm.position.x, lamp.lowerArm.position.y, lamp.lowerArm.position.z);
  lowerArm.rotation.z = lamp.lowerArm.rotationZ;
  group.add(lowerArm);

  const upperArm = new THREE.Mesh(
    new THREE.CylinderGeometry(lamp.upperArm.radius, lamp.upperArm.radius, lamp.upperArm.height, 18),
    materials.charcoalSoft,
  );
  upperArm.position.set(lamp.upperArm.position.x, lamp.upperArm.position.y, lamp.upperArm.position.z);
  upperArm.rotation.z = lamp.upperArm.rotationZ;
  group.add(upperArm);

  const shadeMaterial = new THREE.MeshStandardMaterial({
    color: "#242624",
    roughness: 0.6,
    metalness: 0.28,
    side: THREE.DoubleSide,
  });
  const shade = addAction(
    new THREE.Mesh(
      new THREE.CylinderGeometry(
        lamp.shade.radiusTop,
        lamp.shade.radiusBottom,
        lamp.shade.height,
        28,
        1,
        true,
      ),
      shadeMaterial,
    ),
    "lamp",
  );
  shade.position.set(lamp.shade.position.x, lamp.shade.position.y, lamp.shade.position.z);
  shade.rotation.z = lamp.shade.rotationZ;
  group.add(shade);

  const bulb = new THREE.Mesh(
    new THREE.CylinderGeometry(lamp.bulb.radius, lamp.bulb.radius, lamp.bulb.height, 24),
    new THREE.MeshBasicMaterial({ color: "#ffd69a" }),
  );
  bulb.position.set(lamp.bulb.position.x, lamp.bulb.position.y, lamp.bulb.position.z);
  bulb.rotation.z = lamp.bulb.rotationZ;
  group.add(bulb);

  return { group, interactiveTargets: [shade] };
};
