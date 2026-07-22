import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

export type KeyboardCluster = "function" | "typing" | "navigation" | "arrows" | "numpad";
export type KeyTone = "dark" | "accent" | "utility";

export interface KeySpec {
  id: string;
  label: string;
  cluster: KeyboardCluster;
  x: number;
  z: number;
  width: number;
  depth: number;
  tone: KeyTone;
}

export interface KeyboardLayout {
  width: number;
  depth: number;
  keys: KeySpec[];
}

const key = (
  id: string,
  label: string,
  cluster: KeyboardCluster,
  x: number,
  z: number,
  width = 1,
  depth = 1,
  tone: KeyTone = "dark",
): KeySpec => ({ id, label, cluster, x, z, width, depth, tone });

const row = (
  labels: string[],
  cluster: KeyboardCluster,
  startX: number,
  z: number,
  idPrefix: string,
): KeySpec[] => labels.map((label, index) => key(`${idPrefix}-${label}`, label, cluster, startX + index, z));

export const createKeyboardLayout = (): KeyboardLayout => {
  const keys: KeySpec[] = [];

  keys.push(key("escape", "Esc", "function", 0.5, 0.55, 1, 1, "accent"));
  keys.push(...row(["F1", "F2", "F3", "F4"], "function", 2.25, 0.55, "function-a"));
  keys.push(...row(["F5", "F6", "F7", "F8"], "function", 6.75, 0.55, "function-b"));
  keys.push(...row(["F9", "F10", "F11", "F12"], "function", 11.25, 0.55, "function-c"));
  keys.push(...row(["Prt", "Scr", "Pse"], "function", 16.25, 0.55, "system"));
  keys.push(...row(["Num", "/", "*", "-"], "numpad", 19.5, 0.55, "numpad-top"));

  keys.push(...row(["`", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "="], "typing", 0.5, 2, "number"));
  keys.push(key("backspace", "Back", "typing", 14, 2, 2));
  keys.push(...row(["Ins", "Home", "PgUp"], "navigation", 16.25, 2, "navigation-top"));
  keys.push(...row(["7", "8", "9"], "numpad", 19.5, 2, "numpad-seven"));
  keys.push(key("numpad-plus", "+", "numpad", 22.5, 2.5, 1, 2, "utility"));

  keys.push(key("tab", "Tab", "typing", 0.75, 3, 1.5));
  keys.push(...row(["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "[", "]"], "typing", 2, 3, "q-row"));
  keys.push(key("backslash", "\\", "typing", 14.25, 3, 1.5));
  keys.push(...row(["Del", "End", "PgDn"], "navigation", 16.25, 3, "navigation-bottom"));
  keys.push(...row(["4", "5", "6"], "numpad", 19.5, 3, "numpad-four"));

  keys.push(key("caps-lock", "Caps", "typing", 0.875, 4, 1.75, 1, "utility"));
  keys.push(...row(["A", "S", "D", "F", "G", "H", "J", "K", "L", ";", "'"], "typing", 2.25, 4, "home-row"));
  keys.push(key("enter", "Enter", "typing", 13.875, 4, 2.25, 1, "accent"));
  keys.push(...row(["1", "2", "3"], "numpad", 19.5, 4, "numpad-one"));
  keys.push(key("numpad-enter", "Enter", "numpad", 22.5, 4.5, 1, 2, "accent"));

  keys.push(key("left-shift", "Shift", "typing", 1.125, 5, 2.25));
  keys.push(...row(["Z", "X", "C", "V", "B", "N", "M", ",", ".", "/"], "typing", 2.75, 5, "shift-row"));
  keys.push(key("right-shift", "Shift", "typing", 13.625, 5, 2.75));
  keys.push(key("arrow-up", "↑", "arrows", 17.25, 5));
  keys.push(key("numpad-zero", "0", "numpad", 20, 5.5, 2, 1));
  keys.push(key("numpad-decimal", ".", "numpad", 21.5, 5.5));

  keys.push(key("left-control", "Ctrl", "typing", 0.625, 6, 1.25, 1, "utility"));
  keys.push(key("left-meta", "E", "typing", 1.875, 6, 1.25, 1, "utility"));
  keys.push(key("left-alt", "Alt", "typing", 3.125, 6, 1.25, 1, "utility"));
  keys.push(key("space", "Eryu", "typing", 6.875, 6, 6.25, 1, "utility"));
  keys.push(key("right-alt", "Alt", "typing", 10.625, 6, 1.25, 1, "utility"));
  keys.push(key("function", "Fn", "typing", 11.875, 6, 1.25, 1, "utility"));
  keys.push(key("menu", "Menu", "typing", 13.125, 6, 1.25, 1, "utility"));
  keys.push(key("right-control", "Ctrl", "typing", 14.375, 6, 1.25, 1, "utility"));
  keys.push(...row(["←", "↓", "→"], "arrows", 16.25, 6, "arrow-bottom"));

  return { width: 24, depth: 7.15, keys };
};

export const keyboardExtents = (layout: KeyboardLayout) => {
  const minX = Math.min(...layout.keys.map((item) => item.x - item.width / 2));
  const maxX = Math.max(...layout.keys.map((item) => item.x + item.width / 2));
  const minZ = Math.min(...layout.keys.map((item) => item.z - item.depth / 2));
  const maxZ = Math.max(...layout.keys.map((item) => item.z + item.depth / 2));
  return { width: maxX - minX, depth: maxZ - minZ };
};

const roundedMesh = (
  width: number,
  height: number,
  depth: number,
  radius: number,
  material: THREE.Material,
) => new THREE.Mesh(new RoundedBoxGeometry(width, height, depth, 4, radius), material);

const legendMaterials = new Map<string, THREE.MeshBasicMaterial>();

const makeLegendMaterial = (label: string, color: string) => {
  const cacheKey = `${label}:${color}`;
  const cached = legendMaterials.get(cacheKey);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = 192;
  canvas.height = 96;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D canvas is unavailable");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = color;
  context.font = `${label.length > 4 ? 500 : 700} ${label.length > 4 ? 26 : 34}px "Segoe UI", "Microsoft YaHei", sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, canvas.width / 2, canvas.height / 2 + 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    toneMapped: false,
    depthWrite: false,
  });
  legendMaterials.set(cacheKey, material);
  return material;
};

export const createKeyboardModel = () => {
  const layout = createKeyboardLayout();
  const group = new THREE.Group();
  const worldWidth = 5.95;
  const unit = worldWidth / layout.width;
  const worldDepth = layout.depth * unit;

  const shell = new THREE.MeshStandardMaterial({ color: "#e7e0d3", roughness: 0.72, metalness: 0.06 });
  const shellEdge = new THREE.MeshStandardMaterial({ color: "#c8c1b5", roughness: 0.78 });
  const plate = new THREE.MeshStandardMaterial({ color: "#232522", roughness: 0.76, metalness: 0.14 });
  const dark = new THREE.MeshStandardMaterial({ color: "#30322f", roughness: 0.68 });
  const darkTop = new THREE.MeshStandardMaterial({ color: "#3b3d39", roughness: 0.62 });
  const utility = new THREE.MeshStandardMaterial({ color: "#4b4e49", roughness: 0.66 });
  const utilityTop = new THREE.MeshStandardMaterial({ color: "#5a5d57", roughness: 0.62 });
  const accent = new THREE.MeshStandardMaterial({ color: "#829b88", roughness: 0.64 });
  const accentTop = new THREE.MeshStandardMaterial({ color: "#94ad9a", roughness: 0.58 });

  const base = roundedMesh(worldWidth + 0.18, 0.3, worldDepth + 0.22, 0.16, shell);
  base.position.y = 0.02;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const lowerEdge = roundedMesh(worldWidth + 0.08, 0.09, worldDepth + 0.3, 0.11, shellEdge);
  lowerEdge.position.set(0, -0.09, 0.03);
  lowerEdge.castShadow = true;
  group.add(lowerEdge);

  const insetPlate = roundedMesh(worldWidth - 0.08, 0.08, worldDepth - 0.02, 0.08, plate);
  insetPlate.position.y = 0.18;
  insetPlate.receiveShadow = true;
  group.add(insetPlate);

  for (const spec of layout.keys) {
    const keyGroup = new THREE.Group();
    const keyWidth = Math.max(0.12, spec.width * unit - 0.035);
    const keyDepth = Math.max(0.12, spec.depth * unit - 0.035);
    const lowerMaterial = spec.tone === "accent" ? accent : spec.tone === "utility" ? utility : dark;
    const topMaterial = spec.tone === "accent" ? accentTop : spec.tone === "utility" ? utilityTop : darkTop;
    const lower = roundedMesh(keyWidth, 0.11, keyDepth, 0.035, lowerMaterial);
    lower.castShadow = true;
    keyGroup.add(lower);

    const top = roundedMesh(Math.max(0.09, keyWidth - 0.045), 0.045, Math.max(0.09, keyDepth - 0.045), 0.025, topMaterial);
    top.position.y = 0.074;
    top.castShadow = true;
    keyGroup.add(top);

    const legendWidth = Math.min(keyWidth * 0.72, spec.label.length > 4 ? 0.34 : 0.24);
    const legendDepth = Math.min(keyDepth * 0.54, 0.12);
    const legend = new THREE.Mesh(
      new THREE.PlaneGeometry(Math.max(0.08, legendWidth), Math.max(0.055, legendDepth)),
      makeLegendMaterial(spec.label, spec.tone === "accent" ? "#f5f1e7" : "#d8d3c8"),
    );
    legend.rotation.x = -Math.PI / 2;
    legend.position.y = 0.099;
    keyGroup.add(legend);

    keyGroup.position.set(
      (spec.x - layout.width / 2) * unit,
      0.31 + Math.max(0, 4.8 - spec.z) * 0.008,
      (spec.z - layout.depth / 2) * unit,
    );
    group.add(keyGroup);
  }

  const brand = new THREE.Mesh(
    new THREE.PlaneGeometry(0.52, 0.16),
    makeLegendMaterial("Eryu", "#353a36"),
  );
  brand.position.set(1.9, 0.12, worldDepth / 2 + 0.125);
  group.add(brand);

  const ledMaterial = new THREE.MeshBasicMaterial({ color: "#9cc4a4", toneMapped: false });
  [-0.07, 0, 0.07].forEach((offset) => {
    const led = new THREE.Mesh(new THREE.CircleGeometry(0.018, 14), ledMaterial);
    led.rotation.x = -Math.PI / 2;
    led.position.set(2.08 + offset, 0.245, -worldDepth / 2 + 0.16);
    group.add(led);
  });

  group.userData.dimensions = { width: worldWidth + 0.18, depth: worldDepth + 0.22 };
  return group;
};
