import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { DESK_LAYOUT } from "../layout";

const roundedOutline = (width: number, height: number, radius: number, centerY = 0) => {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = centerY - height / 2;
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.absarc(x + width - radius, y + radius, radius, -Math.PI / 2, 0, false);
  shape.lineTo(x + width, y + height - radius);
  shape.absarc(x + width - radius, y + height - radius, radius, 0, Math.PI / 2, false);
  shape.lineTo(x + radius, y + height);
  shape.absarc(x + radius, y + height - radius, radius, Math.PI / 2, Math.PI, false);
  shape.lineTo(x, y + radius);
  shape.absarc(x + radius, y + radius, radius, Math.PI, Math.PI * 1.5, false);
  shape.closePath();
  return shape;
};

const extrudedPlate = (
  outline: THREE.Shape,
  depth: number,
  bevel: number,
) => new THREE.ExtrudeGeometry(outline, {
  depth,
  steps: 1,
  bevelEnabled: bevel > 0,
  bevelThickness: bevel,
  bevelSize: bevel,
  bevelSegments: 2,
  curveSegments: 6,
});

const taperedRearHousing = (widthScale = 1, heightScale = 1) => {
  const sections = [
    { width: 5.46, height: 3.24, radius: 0.25, z: -0.164 },
    { width: 5.40, height: 3.18, radius: 0.24, z: -0.19 },
    { width: 5.23, height: 3.02, radius: 0.23, z: -0.25 },
    { width: 5.00, height: 2.82, radius: 0.21, z: -0.35 },
    { width: 4.82, height: 2.68, radius: 0.19, z: -0.42 },
    { width: 4.77, height: 2.63, radius: 0.18, z: -0.445 },
  ];
  const rings = sections.map(section => {
    const points = roundedOutline(section.width, section.height, section.radius, -0.48).getPoints(6);
    if (points[0].distanceTo(points[points.length - 1]) < 1e-7) points.pop();
    return points.map(point => new THREE.Vector3(point.x, point.y, section.z));
  });
  const count = rings[0].length;
  const positions = rings.flatMap(ring => ring.flatMap(point => point.toArray()));
  const indices: number[] = [];
  for (let layer = 0; layer < rings.length - 1; layer++) {
    for (let index = 0; index < count; index++) {
      const a = layer * count + index;
      const b = layer * count + (index + 1) % count;
      indices.push(a, a + count, b, b, a + count, b + count);
    }
  }
  // Duplicate cap vertices to keep the large rear face planar, independent of side normals.
  for (const layer of [0, rings.length - 1]) {
    const center = positions.length / 3;
    positions.push(0, -0.48, sections[layer].z);
    rings[layer].forEach(point => positions.push(...point.toArray()));
    for (let index = 0; index < count; index++) {
      const a = center + 1 + index;
      const b = center + 1 + (index + 1) % count;
      indices.push(...(layer === 0 ? [center, a, b] : [center, b, a]));
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  if (widthScale !== 1 || heightScale !== 1) geometry.scale(widthScale, heightScale, 1);
  return geometry;
};

/** Structural visual only. The caller supplies content and interaction planes separately. */
export const createMonitorStudyVisual = (variant: "main" | "portrait" = "main") => {
  const group = new THREE.Group();
  group.name = "monitor-study-visual";
  const portrait = variant === "portrait";
  const side = DESK_LAYOUT.leftMonitor;
  const screen = portrait ? {
    size: side.screen.size,
    position: { x: side.center.x + Math.sin(side.yaw) * side.screen.z, y: side.center.y, z: side.center.z + Math.cos(side.yaw) * side.screen.z },
  } : DESK_LAYOUT.mainMonitor.screen;
  group.position.set(screen.position.x, screen.position.y, screen.position.z);
  if (portrait) { group.rotation.y = side.yaw; group.name = "portrait-monitor-study-visual"; }
  const floorY = DESK_LAYOUT.desk.surface.position.y
    + DESK_LAYOUT.desk.surface.size.height / 2 - screen.position.y;

  const shell = new THREE.MeshStandardMaterial({ color: "#242629", roughness: 0.64, metalness: 0.04 });
  const inner = new THREE.MeshStandardMaterial({ color: "#101214", roughness: 0.84, metalness: 0 });
  const support = shell;

  const add = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  const box = (name: string, w: number, h: number, d: number, r: number, material: THREE.Material, x: number, y: number, z: number) =>
    add(name, new RoundedBoxGeometry(w, h, d, 2, r), material, x, y, z);

  // The live screen remains at local z=0. A hollow forward lip creates recess without moving it.
  const front = roundedOutline(portrait ? screen.size.width + 0.27 : 8.32, portrait ? screen.size.height + 0.30 : 4.64, 0.065, -0.06);
  front.holes.push(roundedOutline(screen.size.width + 0.046, screen.size.height + 0.046, 0.014));
  add("front-bezel", extrudedPlate(front, 0.074, 0.009), shell, 0, 0, -0.034);

  const inset = roundedOutline(portrait ? screen.size.width + 0.15 : 8.20, portrait ? screen.size.height + 0.19 : 4.53, 0.035, -0.035);
  inset.holes.push(roundedOutline(screen.size.width - 0.015, screen.size.height - 0.015, 0.01));
  add("panel-gasket", extrudedPlate(inset, 0.016, 0), inner, 0, 0, -0.024);

  add("rear-shell", extrudedPlate(roundedOutline(portrait ? screen.size.width + 0.24 : 8.29, portrait ? screen.size.height + 0.27 : 4.61, 0.068, -0.06), 0.095, 0.018), shell, 0, 0, -0.173);
  add("rear-housing", portrait ? taperedRearHousing(screen.size.width / 8.05, screen.size.height / 4.34) : taperedRearHousing(), shell);
  box("stand-mount", 0.84, 0.86, 0.20, 0.065, support, 0, -0.89, -0.47);

  const hinge = add("stand-hinge", new THREE.CylinderGeometry(0.16, 0.16, 0.62, 24), inner, 0, -1.03, -0.61);
  hinge.rotation.z = Math.PI / 2;
  const baseTop = floorY + 0.16;
  const postTop = -1.02;
  box("stand-post", portrait ? 0.30 : 0.44, postTop - baseTop + 0.03, 0.24, 0.038, support, 0, (postTop + baseTop - 0.03) / 2, -0.69);
  box("stand-foot", portrait ? 1.58 : 2.95, 0.16, portrait ? 1.05 : 1.78, 0.045, support, 0, floorY + 0.08, -0.40);

  group.updateMatrixWorld(true);
  return group;
};
