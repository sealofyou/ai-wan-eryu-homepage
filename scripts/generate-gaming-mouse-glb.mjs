import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

class NodeFileReader {
  result = null;
  error = null;
  onloadend = null;
  onerror = null;

  readAsArrayBuffer(blob) {
    blob
      .arrayBuffer()
      .then((result) => {
        this.result = result;
        this.onloadend?.({ target: this });
      })
      .catch((error) => {
        this.error = error;
        this.onerror?.(error);
      });
  }

  readAsDataURL(blob) {
    blob
      .arrayBuffer()
      .then((result) => {
        const base64 = Buffer.from(result).toString("base64");
        this.result = `data:${blob.type};base64,${base64}`;
        this.onloadend?.({ target: this });
      })
      .catch((error) => {
        this.error = error;
        this.onerror?.(error);
      });
  }
}

globalThis.FileReader ??= NodeFileReader;

const charcoal = new THREE.MeshStandardMaterial({
  name: "charcoal-shell",
  color: "#242624",
  roughness: 0.5,
  metalness: 0.28,
});
const charcoalSoft = new THREE.MeshStandardMaterial({
  name: "charcoal-soft",
  color: "#373a37",
  roughness: 0.72,
  metalness: 0.12,
});
const graphite = new THREE.MeshStandardMaterial({
  name: "graphite-grip",
  color: "#171918",
  roughness: 0.9,
  metalness: 0.04,
});
const green = new THREE.MeshStandardMaterial({
  name: "eryu-green",
  color: "#91aa98",
  emissive: "#31463a",
  emissiveIntensity: 0.38,
  roughness: 0.45,
});
const warmMark = new THREE.MeshStandardMaterial({
  name: "warm-mark",
  color: "#d8cfbd",
  roughness: 0.62,
});

const mouse = new THREE.Group();
mouse.name = "eryu-generic-gaming-mouse";

const addMesh = (name, geometry, material, position, scale, rotation) => {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(...position);
  if (scale) mesh.scale.set(...scale);
  if (rotation) mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mouse.add(mesh);
  return mesh;
};

addMesh(
  "main-shell",
  new THREE.SphereGeometry(0.55, 30, 18),
  charcoal,
  [0.05, -0.03, 0.02],
  [0.84, 0.42, 1.2],
);
addMesh(
  "rear-palm-hump",
  new THREE.SphereGeometry(0.45, 24, 14),
  charcoalSoft,
  [0.04, 0.04, 0.2],
  [0.82, 0.5, 0.96],
);

addMesh(
  "left-click",
  new RoundedBoxGeometry(0.21, 0.035, 0.31, 2, 0.04),
  charcoalSoft,
  [-0.085, 0.14, -0.25],
  undefined,
  [-0.02, 0.015, -0.008],
);
addMesh(
  "right-click",
  new RoundedBoxGeometry(0.21, 0.035, 0.31, 2, 0.04),
  charcoalSoft,
  [0.145, 0.14, -0.25],
  undefined,
  [-0.02, -0.015, 0.008],
);
addMesh(
  "center-spine",
  new RoundedBoxGeometry(0.105, 0.06, 0.49, 2, 0.034),
  charcoal,
  [0.03, 0.175, -0.18],
);

addMesh(
  "scroll-wheel",
  new THREE.CylinderGeometry(0.05, 0.05, 0.095, 18),
  graphite,
  [0.03, 0.225, -0.25],
  undefined,
  [0, 0, Math.PI / 2],
);

addMesh(
  "dpi-button-main",
  new RoundedBoxGeometry(0.11, 0.05, 0.14, 2, 0.028),
  green,
  [0.03, 0.2, -0.02],
);
addMesh(
  "dpi-button-secondary",
  new RoundedBoxGeometry(0.085, 0.04, 0.1, 2, 0.024),
  graphite,
  [0.03, 0.195, 0.105],
);

addMesh(
  "left-side-grip",
  new RoundedBoxGeometry(0.028, 0.09, 0.34, 2, 0.014),
  graphite,
  [-0.402, -0.025, 0.13],
  undefined,
  [0, -0.035, 0.015],
);
addMesh(
  "right-side-grip",
  new RoundedBoxGeometry(0.028, 0.09, 0.34, 2, 0.014),
  graphite,
  [0.502, -0.025, 0.13],
  undefined,
  [0, 0.035, -0.015],
);
[-0.08, 0.11].forEach((z, index) => {
  addMesh(
    `thumb-button-${index + 1}`,
    new RoundedBoxGeometry(0.035, 0.055, 0.1, 2, 0.014),
    charcoalSoft,
    [-0.408, 0.05, z],
  );
});

addMesh(
  "eryu-mark-stem",
  new RoundedBoxGeometry(0.026, 0.018, 0.13, 2, 0.007),
  warmMark,
  [0.005, 0.275, 0.34],
);
[
  { width: 0.1, z: 0.285 },
  { width: 0.078, z: 0.34 },
  { width: 0.1, z: 0.395 },
].forEach(({ width, z }, index) => {
  addMesh(
    `eryu-mark-bar-${index + 1}`,
    new RoundedBoxGeometry(width, 0.018, 0.023, 2, 0.007),
    warmMark,
    [0.045, 0.275, z],
  );
});

const outputPath = resolve("public/models/desktop/gaming-mouse.glb");
await mkdir(dirname(outputPath), { recursive: true });

const exporter = new GLTFExporter();
const result = await exporter.parseAsync(mouse, {
  binary: true,
  onlyVisible: true,
  trs: false,
});
if (!(result instanceof ArrayBuffer)) {
  throw new Error("Expected GLTFExporter to return a binary ArrayBuffer");
}

await writeFile(outputPath, new Uint8Array(result));
console.log(`Generated ${outputPath} (${result.byteLength} bytes)`);
