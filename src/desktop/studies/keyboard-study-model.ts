import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createKeyboardLayout, type KeySpec, type KeyTone } from "../keyboard";

export const KEYBOARD_STUDY_FLOOR_Y = -0.1225;
const KEY_RIM_Y = 0.286;
const TOP_INSET = 0.052;
const TOP_RINGS = [1, 0.7, 0.4, 0.15, 0];

const outline = (width: number, depth: number, radius: number, y: number) => {
  const corners = [
    [width / 2 - radius, depth / 2 - radius, 0],
    [-width / 2 + radius, depth / 2 - radius, Math.PI / 2],
    [-width / 2 + radius, -depth / 2 + radius, Math.PI],
    [width / 2 - radius, -depth / 2 + radius, Math.PI * 1.5],
  ];
  return corners.flatMap(([x, z, start]) => Array.from({ length: 4 }, (_, step) => {
    const angle = start + step * Math.PI / 6;
    return new THREE.Vector3(x + radius * Math.cos(angle), y, z + radius * Math.sin(angle));
  }));
};

const topHeight = (width: number, depth: number, dish: number, x: number, z: number) => {
  const r = Math.min(1, Math.max(Math.abs(x) / ((width - TOP_INSET) / 2), Math.abs(z) / ((depth - TOP_INSET) / 2)));
  for (let i = 0; i < TOP_RINGS.length - 1; i++) {
    const high = TOP_RINGS[i];
    const low = TOP_RINGS[i + 1];
    if (r <= high && r >= low) {
      const blend = (r - low) / (high - low);
      return KEY_RIM_Y - dish * (1 - (low * low + (high * high - low * low) * blend));
    }
  }
  return KEY_RIM_Y - dish;
};

export const createKeycapGeometry = (width: number, depth: number, dish = 0.014) => {
  const topWidth = width - TOP_INSET;
  const topDepth = depth - TOP_INSET;
  const rings = [
    outline(width, depth, 0.022, 0.134),
    outline(width - 0.006, depth - 0.006, 0.022, 0.148),
    outline(width - 0.042, depth - 0.042, 0.020, KEY_RIM_Y - 0.02),
    ...TOP_RINGS.slice(0, -1).map(r => outline(topWidth * r, topDepth * r, 0.018 * r, KEY_RIM_Y - dish * (1 - r * r))),
  ];
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
  const topCenter = positions.length / 3;
  positions.push(0, KEY_RIM_Y - dish, 0);
  for (let index = 0; index < count; index++) {
    const a = (rings.length - 1) * count + index;
    const b = (rings.length - 1) * count + (index + 1) % count;
    indices.push(topCenter, b, a);
  }
  const bottomCenter = positions.length / 3;
  positions.push(0, 0.134, 0);
  rings[0].forEach(point => positions.push(...point.toArray()));
  for (let index = 0; index < count; index++) {
    indices.push(bottomCenter, bottomCenter + 1 + index, bottomCenter + 1 + (index + 1) % count);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
};

const createLegendAtlas = (keys: KeySpec[]) => {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Keyboard legend canvas unavailable");
  context.clearRect(0, 0, 1024, 1024);
  [...keys.map(spec => ({ label: spec.label, brand: false })), { label: "Eryu", brand: true }].forEach(({ label, brand }, index) => {
    const x = index % 8 * 128;
    const y = Math.floor(index / 8) * 64;
    context.fillStyle = brand ? "#4e564a" : "#deddd3";
    const fontSize = label.length > 4 ? 26 : label.length > 1 ? 32 : 40;
    context.font = `500 ${fontSize}px "Segoe UI", "Microsoft YaHei", sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(label, x + 64, y + 33);
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false });
};

const atlasUv = (index: number, u: number, v: number) => [
  (index % 8 * 128 + u * 128) / 1024,
  1 - (Math.floor(index / 8) * 64 + (1 - v) * 64) / 1024,
];

const createLegendGeometry = (width: number, depth: number, dish: number, index: number) => {
  const legendWidth = Math.min((width - TOP_INSET) * 0.85, (depth - TOP_INSET) * 1.35);
  const legendDepth = legendWidth / 2;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let z = 0; z <= 2; z++) {
    for (let x = 0; x <= 2; x++) {
      const px = (x / 2 - 0.5) * legendWidth;
      const pz = (z / 2 - 0.5) * legendDepth;
      positions.push(px, topHeight(width, depth, dish, px, pz) + 0.0015, pz);
      uvs.push(...atlasUv(index, x / 2, 1 - z / 2));
    }
  }
  for (let z = 0; z < 2; z++) for (let x = 0; x < 2; x++) {
    const a = z * 3 + x;
    indices.push(a, a + 3, a + 1, a + 1, a + 3, a + 4);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
};

export const createKeyboardStudyModel = ({ withLegends = false }: { withLegends?: boolean } = {}) => {
  const layout = createKeyboardLayout();
  // Create fallible canvas resources before geometry to avoid a partially allocated model.
  const legendMaterial = withLegends ? createLegendAtlas(layout.keys) : undefined;
  const allocated = new Set<{ dispose: () => void }>();
  const own = <T extends { dispose: () => void }>(resource: T): T => {
    allocated.add(resource);
    return resource;
  };
  if (legendMaterial) {
    own(legendMaterial);
    if (legendMaterial.map) own(legendMaterial.map);
  }
  const group = new THREE.Group();
  group.name = "keyboard-study-visual";
  const worldWidth = 5.95;
  const unit = worldWidth / layout.width;
  const worldDepth = layout.depth * unit;
  try {
  const shell = own(new THREE.MeshStandardMaterial({ color: "#e9e1d5", roughness: 0.69, metalness: 0.02 }));
  const edge = own(new THREE.MeshStandardMaterial({ color: "#bbb3a7", roughness: 0.82 }));
  const plate = own(new THREE.MeshStandardMaterial({ color: "#20221f", roughness: 0.82 }));
  const capMaterials: Record<KeyTone, THREE.MeshStandardMaterial> = {
    dark: own(new THREE.MeshStandardMaterial({ color: "#292b27", roughness: 0.72 })),
    utility: own(new THREE.MeshStandardMaterial({ color: "#3b3e36", roughness: 0.74 })),
    accent: own(new THREE.MeshStandardMaterial({ color: "#8a9f8c", roughness: 0.75 })),
  };
  const add = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material) => {
    own(geometry);
    own(material);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  const box = (name: string, w: number, h: number, d: number, r: number, material: THREE.Material, y: number) => {
    const mesh = add(name, new RoundedBoxGeometry(w, h, d, 2, r), material);
    mesh.position.y = y;
    return mesh;
  };
  box("case-upper", worldWidth + 0.18, 0.156, worldDepth + 0.22, 0.06, shell, 0.018);
  box("case-lower", worldWidth + 0.10, 0.05, worldDepth + 0.18, 0.04, edge, KEYBOARD_STUDY_FLOOR_Y + 0.025);
  box("case-seam", worldWidth + 0.12, 0.014, worldDepth + 0.18, 0.04, plate, -0.066);
  box("key-plate", worldWidth + 0.02, 0.024, worldDepth + 0.035, 0.035, plate, 0.118);

  const caps: Record<KeyTone, THREE.BufferGeometry[]> = { dark: [], utility: [], accent: [] };
  const legends: THREE.BufferGeometry[] = [];
  layout.keys.forEach((spec, index) => {
    const width = Math.max(0.12, spec.width * unit - 0.028);
    const depth = Math.max(0.12, spec.depth * unit - 0.028);
    const dish = spec.id === "space" ? 0.004 : 0.014;
    const x = (spec.x - layout.width / 2) * unit;
    const z = (spec.z - layout.depth / 2) * unit;
    const y = Math.max(0, 4.8 - spec.z) * 0.005;
    const cap = own(createKeycapGeometry(width, depth, dish));
    cap.translate(x, y, z);
    caps[spec.tone].push(cap);
    if (legendMaterial) {
      const legend = own(createLegendGeometry(width, depth, dish, index));
      legend.translate(x, y, z);
      legends.push(legend);
    }
  });
  const merge = (name: string, geometries: THREE.BufferGeometry[], material: THREE.Material) => {
    own(material);
    const merged = mergeGeometries(geometries, false);
    geometries.forEach(geometry => { geometry.dispose(); allocated.delete(geometry); });
    if (!merged) throw new Error("Keyboard geometry batch unavailable");
    return add(name, merged, material);
  };
  (Object.keys(caps) as KeyTone[]).forEach(tone => merge(`keycaps-${tone}`, caps[tone], capMaterials[tone]));
  if (legendMaterial) {
    const keyLegends = merge("key-legends", legends, legendMaterial);
    keyLegends.castShadow = false;
    keyLegends.receiveShadow = false;
    const brandGeometry = own(new THREE.PlaneGeometry(0.32, 0.13));
    const uv = brandGeometry.getAttribute("uv");
    for (let index = 0; index < uv.count; index++) uv.setXY(index, ...atlasUv(layout.keys.length, uv.getX(index), uv.getY(index)) as [number, number]);
    const brand = add("keyboard-brand", brandGeometry, legendMaterial);
    brand.position.set(1.9, 0.01, worldDepth / 2 + 0.115);
    brand.castShadow = false;
    brand.receiveShadow = false;
  }
  const ledGeometries = [-0.07, 0, 0.07].map(offset => {
    const geometry = own(new THREE.CircleGeometry(0.016, 12));
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(2.08 + offset, 0.134, -worldDepth / 2 + 0.16);
    return geometry;
  });
  const lights = merge("status-lights", ledGeometries, new THREE.MeshBasicMaterial({ color: "#93b59d", toneMapped: false }));
  lights.castShadow = false;
  lights.receiveShadow = false;
  group.userData.dimensions = { width: worldWidth + 0.18, depth: worldDepth + 0.22 };
  group.userData.keyIds = layout.keys.map(spec => spec.id);
  group.userData.legendAtlas = withLegends ? "1024×1024" : "none";
  group.updateMatrixWorld(true);
  return group;
  } catch (error) {
    allocated.forEach(resource => resource.dispose());
    throw error;
  }
};
