import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { createMouseStudyModel } from "./modeling/eryu-mouse.mjs";
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

class NodeFileReader {
  result = null;
  onloadend = null;
  onerror = null;
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((result) => {
      this.result = result;
      this.onloadend?.({ target: this });
    }).catch((error) => this.onerror?.(error));
  }
}
globalThis.FileReader ??= NodeFileReader;
const editableModel = createMouseStudyModel();
editableModel.updateMatrixWorld(true);
const batches = new Map();
editableModel.traverse((node) => {
  if (!(node instanceof THREE.Mesh)) return;
  const geometry = node.geometry.clone().applyMatrix4(node.matrixWorld);
  if (!geometry.index) geometry.setIndex(Array.from({length:geometry.getAttribute("position").count}, (_, index) => index));
  const batch = batches.get(node.material) ?? {geometries:[],parts:[]};
  batch.geometries.push(geometry); batch.parts.push(node.name);
  batches.set(node.material, batch);
});
const model = new THREE.Group();
model.name = editableModel.name;
for (const [material, batch] of batches) {
  const merged = mergeGeometries(batch.geometries, false);
  if (!merged) throw new Error("Incompatible mouse geometry attributes");
  const geometry = mergeVertices(merged, 0.000001);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = material.name;
  mesh.userData.parts = batch.parts;
  model.add(mesh);
  batch.geometries.forEach((entry) => entry.dispose());
  merged.dispose();
}
let triangles = 0, vertices = 0, meshes = 0;
const materials = new Set();
model.traverse((node) => {
  if (!(node instanceof THREE.Mesh)) return;
  meshes += 1;
  vertices += node.geometry.getAttribute("position").count;
  triangles += (node.geometry.index?.count ?? node.geometry.getAttribute("position").count) / 3;
  materials.add(node.material);
});
const glb = await new GLTFExporter().parseAsync(model, { binary: true, onlyVisible: true });
if (!(glb instanceof ArrayBuffer)) throw new Error("Expected binary GLB");
if (glb.byteLength > 500_000) throw new Error(`Mouse study exceeds 500KB: ${glb.byteLength}`);
const output = resolve("public/models/desktop/eryu-mouse-study.glb");
await mkdir(dirname(output), { recursive: true });
await writeFile(output, new Uint8Array(glb));
console.log(JSON.stringify({file:"eryu-mouse-study.glb",bytes:glb.byteLength,triangles,vertices,meshes,materials:materials.size}, null, 2));
