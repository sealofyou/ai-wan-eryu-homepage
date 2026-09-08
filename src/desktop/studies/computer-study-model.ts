import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { DESK_LAYOUT } from "../layout";

const markAsVisualDetail = (mesh: THREE.Mesh) => {
  mesh.userData.pointerDetail = true;
  mesh.raycast = () => undefined;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
};

const createMaterials = () => ({
  shell: new THREE.MeshStandardMaterial({ color: "#252724", roughness: 0.82, metalness: 0.05 }),
  front: new THREE.MeshStandardMaterial({ color: "#171817", roughness: 0.88, metalness: 0.04 }),
  recess: new THREE.MeshStandardMaterial({ color: "#0d0f0e", roughness: 0.94, metalness: 0.02 }),
  glass: new THREE.MeshStandardMaterial({
    color: "#101415",
    roughness: 0.2,
    metalness: 0.22,
    transparent: true,
    opacity: 0.68,
  }),
  vent: new THREE.MeshStandardMaterial({ color: "#080908", roughness: 0.96, metalness: 0 }),
  foot: new THREE.MeshStandardMaterial({ color: "#10110f", roughness: 0.9, metalness: 0.02 }),
  mark: new THREE.MeshBasicMaterial({ color: "#d8d1c4", toneMapped: false }),
  status: new THREE.MeshBasicMaterial({ color: "#79b98c", toneMapped: false }),
});

const addBox = (
  parent: THREE.Group,
  name: string,
  size: { width: number; height: number; depth: number },
  radius: number,
  material: THREE.Material,
  position: { x: number; y: number; z: number },
) => {
  const mesh = markAsVisualDetail(new THREE.Mesh(
    new RoundedBoxGeometry(size.width, size.height, size.depth, 1, radius),
    material,
  ));
  mesh.name = name;
  mesh.position.set(position.x, position.y, position.z);
  parent.add(mesh);
  return mesh;
};

const addPanelLine = (
  parent: THREE.Group,
  name: string,
  x: number,
  y: number,
  height: number,
  material: THREE.Material,
) => addBox(
  parent,
  name,
  { width: 0.025, height, depth: 0.018 },
  0.006,
  material,
  { x, y, z: 0.951 },
);

const addEMark = (parent: THREE.Group, material: THREE.Material) => {
  const mark = new THREE.Group();
  mark.name = "eryu-e-mark";
  markAsVisualDetail(addBox(mark, "eryu-e-stem", { width: 0.08, height: 0.46, depth: 0.024 }, 0.012, material, { x: -0.11, y: 0, z: 0 }));
  [
    { width: 0.31, y: 0.17 },
    { width: 0.24, y: 0 },
    { width: 0.31, y: -0.17 },
  ].forEach((bar, index) => {
    addBox(
      mark,
      `eryu-e-bar-${index + 1}`,
      { width: bar.width, height: 0.07, depth: 0.024 },
      0.012,
      material,
      { x: 0.02, y: bar.y, z: 0 },
    );
  });
  mark.position.set(-0.48, -1.2, 0.985);
  parent.add(mark);
};

const addVentBank = (parent: THREE.Group, material: THREE.Material) => {
  const bank = new THREE.Group();
  bank.name = "front-vent-bank";
  for (let row = 0; row < 7; row += 1) {
    addBox(
      bank,
      `front-vent-${row + 1}`,
      { width: 0.4, height: 0.034, depth: 0.022 },
      0.008,
      material,
      { x: -0.22, y: 1.2 - row * 0.12, z: 0.99 },
    );
  }
  parent.add(bank);
};

/** Pure visual study model. It owns all geometry/material resources and has no lights or interactions. */
export const createComputerStudyVisual = (): THREE.Group => {
  const group = new THREE.Group();
  group.name = "computer-study-visual";
  const { tower } = DESK_LAYOUT.computer;
  const deskTop = DESK_LAYOUT.desk.surface.position.y + DESK_LAYOUT.desk.surface.size.height / 2;
  const materials = createMaterials();
  group.userData.resourceOwner = "computer-study-visual";
  group.position.set(tower.position.x, tower.position.y, tower.position.z);

  const halfHeight = tower.size.height / 2;
  const footHeight = 0.14;
  const bodyHeight = tower.position.y + halfHeight - (deskTop + footHeight);
  const bodyCenterY = deskTop + footHeight + bodyHeight / 2 - tower.position.y;

  addBox(group, "rear-shell", { width: 1.72, height: bodyHeight, depth: 1.76 }, 0.16, materials.shell, { x: 0, y: bodyCenterY, z: -0.02 });
  addBox(group, "front-recess", { width: 1.54, height: bodyHeight - 0.28, depth: 0.075 }, 0.1, materials.recess, { x: -0.04, y: bodyCenterY - 0.04, z: 0.902 });
  addBox(group, "front-panel", { width: 1.38, height: bodyHeight - 0.44, depth: 0.05 }, 0.095, materials.front, { x: -0.08, y: bodyCenterY - 0.09, z: 0.952 });
  addBox(group, "top-panel", { width: 1.72, height: 0.12, depth: 1.76 }, 0.1, materials.shell, { x: 0, y: halfHeight - 0.06, z: -0.02 });

  addBox(group, "glass-side-panel", { width: 0.048, height: bodyHeight - 0.5, depth: 1.34 }, 0.02, materials.glass, { x: 0.89, y: bodyCenterY - 0.04, z: -0.04 });
  addBox(group, "side-rear-rail", { width: 0.065, height: bodyHeight - 0.3, depth: 0.08 }, 0.025, materials.front, { x: 0.913, y: bodyCenterY - 0.03, z: -0.72 });
  addBox(group, "side-front-rail", { width: 0.065, height: bodyHeight - 0.3, depth: 0.08 }, 0.025, materials.front, { x: 0.913, y: bodyCenterY - 0.03, z: 0.65 });
  addBox(group, "side-top-rail", { width: 0.065, height: 0.08, depth: 1.34 }, 0.025, materials.front, { x: 0.913, y: halfHeight - 0.32, z: -0.04 });
  addBox(group, "side-bottom-rail", { width: 0.065, height: 0.08, depth: 1.34 }, 0.025, materials.front, { x: 0.913, y: -halfHeight + 0.48, z: -0.04 });

  addPanelLine(group, "front-left-seam", -0.67, bodyCenterY - 0.05, bodyHeight - 0.58, materials.shell);
  addPanelLine(group, "front-right-seam", 0.63, bodyCenterY - 0.05, bodyHeight - 0.58, materials.shell);
  addVentBank(group, materials.vent);
  addBox(group, "status-light-channel", { width: 0.075, height: 1.62, depth: 0.042 }, 0.02, materials.recess, { x: -0.78, y: bodyCenterY - 0.38, z: 0.986 });
  addBox(group, "status-light", { width: 0.038, height: 1.56, depth: 0.026 }, 0.018, materials.status, { x: -0.78, y: bodyCenterY - 0.38, z: 1.008 });
  addEMark(group, materials.mark);

  const footY = deskTop - tower.position.y + footHeight / 2;
  [
    ["front-left-foot", -0.64, 0.64],
    ["front-right-foot", 0.64, 0.64],
    ["rear-left-foot", -0.64, -0.66],
    ["rear-right-foot", 0.64, -0.66],
  ].forEach(([name, x, z]) => {
    addBox(group, name as string, { width: 0.38, height: footHeight, depth: 0.34 }, 0.055, materials.foot, { x: x as number, y: footY, z: z as number });
  });

  group.updateMatrixWorld(true);
  return group;
};
