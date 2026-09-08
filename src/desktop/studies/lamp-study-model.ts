import * as THREE from "three";
import { DESK_LAYOUT } from "../layout";

export type LampStudyVisual = {
  group: THREE.Group;
  bulbPosition: THREE.Vector3;
  setBrightness: (ratio: number) => void;
};

export function createLampStudyVisual(): LampStudyVisual {
  const group = new THREE.Group();
  group.name = "lamp-study-visual";
  const { lamp } = DESK_LAYOUT;
  group.position.set(lamp.position.x, lamp.position.y, lamp.position.z);

  const metal = new THREE.MeshStandardMaterial({
    color: "#171716",
    roughness: 0.58,
    metalness: 0.52,
  });
  const jointMetal = new THREE.MeshStandardMaterial({
    color: "#2b2a27",
    roughness: 0.46,
    metalness: 0.62,
  });
  const liner = new THREE.MeshStandardMaterial({
    color: "#fff0cf",
    roughness: 0.78,
    metalness: 0.02,
    emissive: "#ffd28f",
    emissiveIntensity: 0.38,
    side: THREE.BackSide,
  });
  const bulbMaterial = new THREE.MeshStandardMaterial({
    color: "#ffe3a7",
    roughness: 0.24,
    metalness: 0,
    emissive: "#ffd28a",
    emissiveIntensity: 0.95,
  });

  const prepareMesh = <T extends THREE.Mesh>(mesh: T) => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };

  const add = <T extends THREE.Object3D>(object: T) => {
    object.traverse((node) => {
      if (node instanceof THREE.Mesh) prepareMesh(node);
    });
    group.add(object);
    return object;
  };

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.16, 64, 1, false), metal);
  base.name = "lamp-oval-base";
  base.scale.set(lamp.base.size.width, 1, lamp.base.size.depth);
  base.position.y = 0.02 + 0.08;
  add(base);

  const baseRim = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.022, 8, 64), jointMetal);
  baseRim.name = "base-soft-rolled-edge";
  baseRim.scale.set(lamp.base.size.width, lamp.base.size.depth, 1);
  baseRim.rotation.x = Math.PI / 2;
  baseRim.position.y = 0.195;
  add(baseRim);

  const basePivot = new THREE.Vector3(0.15, 0.23, 0);
  const elbow = new THREE.Vector3(0.36, 2.3, 0);
  const shadeCenter = new THREE.Vector3(lamp.shade.position.x, lamp.shade.position.y, lamp.shade.position.z);
  const shadeAxis = new THREE.Vector3(0, 1, 0)
    .applyAxisAngle(new THREE.Vector3(0, 0, 1), lamp.shade.rotationZ)
    .normalize();
  const headAnchor = shadeCenter.clone().addScaledVector(shadeAxis, lamp.shade.height / 2);

  const cylinderBetween = (
    name: string,
    start: THREE.Vector3,
    end: THREE.Vector3,
    radius: number,
    material: THREE.Material,
    zOffset = 0,
  ) => {
    const localStart = start.clone().add(new THREE.Vector3(0, 0, zOffset));
    const localEnd = end.clone().add(new THREE.Vector3(0, 0, zOffset));
    const direction = localEnd.clone().sub(localStart);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), 16), material);
    mesh.name = name;
    mesh.position.copy(localStart).add(localEnd).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
    mesh.userData.start = start.toArray();
    mesh.userData.end = end.toArray();
    return add(mesh);
  };

  cylinderBetween("lower-arm-left", basePivot, elbow, 0.027, metal, -0.075);
  cylinderBetween("lower-arm-right", basePivot, elbow, 0.027, metal, 0.075);
  cylinderBetween("upper-arm-left", elbow, headAnchor, 0.026, metal, -0.075);
  cylinderBetween("upper-arm-right", elbow, headAnchor, 0.026, metal, 0.075);

  const joint = (name: string, position: THREE.Vector3, radius: number) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 20, 12), jointMetal);
    mesh.name = name;
    mesh.position.copy(position);
    return add(mesh);
  };
  joint("base-pivot-joint", basePivot, 0.095);
  joint("elbow-joint", elbow, 0.125);
  joint("head-yoke-joint", headAnchor, 0.105);

  const shade = new THREE.Group();
  shade.name = "shade-assembly";
  shade.position.copy(shadeCenter);
  shade.rotation.z = lamp.shade.rotationZ;
  add(shade);

  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(lamp.shade.radiusTop, lamp.shade.radiusBottom, lamp.shade.height, 64, 1, true),
    metal,
  );
  shell.name = "shade-outer-shell";
  shell.userData.radiusTop = lamp.shade.radiusTop;
  shell.userData.radiusBottom = lamp.shade.radiusBottom;
  shade.add(prepareMesh(shell));

  const linerThickness = 0.045;
  const inner = new THREE.Mesh(
    new THREE.CylinderGeometry(
      lamp.shade.radiusTop - linerThickness,
      lamp.shade.radiusBottom - linerThickness,
      lamp.shade.height - 0.035,
      64,
      1,
      true,
    ),
    liner,
  );
  inner.name = "shade-inner-liner";
  inner.userData.radiusTop = lamp.shade.radiusTop - linerThickness;
  inner.userData.radiusBottom = lamp.shade.radiusBottom - linerThickness;
  shade.add(prepareMesh(inner));

  const backCap = new THREE.Mesh(new THREE.CylinderGeometry(0.045, lamp.shade.radiusTop, 0.035, 48), metal);
  backCap.name = "shade-back-cap";
  backCap.position.y = lamp.shade.height / 2;
  shade.add(prepareMesh(backCap));

  const frontRim = new THREE.Mesh(new THREE.TorusGeometry(lamp.shade.radiusBottom - 0.012, 0.026, 10, 64), jointMetal);
  frontRim.name = "shade-front-rolled-rim";
  frontRim.rotation.x = Math.PI / 2;
  frontRim.position.y = -lamp.shade.height / 2;
  shade.add(prepareMesh(frontRim));

  const bulbPosition = shadeCenter.clone().addScaledVector(shadeAxis, -0.2);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(lamp.bulb.radius * 0.62, 32, 18), bulbMaterial);
  bulb.name = "visible-bulb";
  bulb.position.copy(bulbPosition);
  add(bulb);
  bulb.castShadow = false;

  const setBrightness = (ratio: number) => {
    const clamped = Math.min(1, Math.max(0, Number.isFinite(ratio) ? ratio : 0));
    bulbMaterial.emissiveIntensity = 0.35 + clamped * 1.1;
    liner.emissiveIntensity = 0.08 + clamped * 0.54;
  };
  setBrightness(42 / 55);

  group.updateMatrixWorld(true);
  return {
    group,
    bulbPosition: bulb.localToWorld(new THREE.Vector3(0, 0, 0)),
    setBrightness,
  };
}
