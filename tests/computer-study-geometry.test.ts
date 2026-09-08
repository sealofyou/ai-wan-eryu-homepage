import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { disposeObjectGraph } from "../src/desktop/core/renderer";
import { DESK_LAYOUT } from "../src/desktop/layout";
import { createComputerStudyVisual } from "../src/desktop/studies/computer-study-model";

const deskTop = DESK_LAYOUT.desk.surface.position.y + DESK_LAYOUT.desk.surface.size.height / 2;
const tower = DESK_LAYOUT.computer.tower;
const note = DESK_LAYOUT.decorations.note;

const getBounds = (root: THREE.Object3D, name: string) => {
  const object = root.getObjectByName(name);
  expect(object, name).toBeDefined();
  return new THREE.Box3().setFromObject(object!);
};

const collectMeshes = (root: THREE.Object3D) => {
  const meshes: THREE.Mesh[] = [];
  root.traverse((node) => {
    if (node instanceof THREE.Mesh) meshes.push(node);
  });
  return meshes;
};

describe("computer study visual geometry", () => {
  it("uses the existing tower anchor, envelope, top height, and grounded feet", () => {
    const model = createComputerStudyVisual();
    expect(model.position.toArray()).toEqual(Object.values(tower.position));
    model.updateMatrixWorld(true);

    const envelope = new THREE.Box3().setFromObject(model);
    const size = envelope.getSize(new THREE.Vector3());
    expect(envelope.max.y).toBeCloseTo(tower.position.y + tower.size.height / 2, 4);
    expect(envelope.min.y).toBeCloseTo(deskTop, 4);
    expect(size.x).toBeLessThanOrEqual(tower.size.width + 0.08);
    expect(size.z).toBeLessThanOrEqual(tower.size.depth + 0.08);
    expect(size.y).toBeGreaterThan(tower.size.height - 0.08);

    for (const name of ["front-left-foot", "front-right-foot", "rear-left-foot", "rear-right-foot"]) {
      expect(getBounds(model, name).min.y, name).toBeCloseTo(deskTop, 4);
    }
    disposeObjectGraph(model);
  });

  it("keeps the external quote note in front of every new mesh covering its XY area", () => {
    const model = createComputerStudyVisual();
    model.updateMatrixWorld(true);
    const noteBox = new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(note.position.x, note.position.y, note.position.z),
      new THREE.Vector3(note.size.width, note.size.height, 0.001),
    );

    for (const mesh of collectMeshes(model)) {
      const box = new THREE.Box3().setFromObject(mesh);
      const overlapsNoteX = box.max.x > noteBox.min.x && box.min.x < noteBox.max.x;
      const overlapsNoteY = box.max.y > noteBox.min.y && box.min.y < noteBox.max.y;
      if (overlapsNoteX && overlapsNoteY) {
        expect(box.max.z, mesh.name).toBeLessThanOrEqual(note.position.z - 0.002);
      }
    }
    expect(model.getObjectByName("quote-note")).toBeUndefined();
    disposeObjectGraph(model);
  });

  it("builds layered front, side, and top panels with restrained detail instead of one glossy block", () => {
    const model = createComputerStudyVisual();
    expect(getBounds(model, "front-panel").max.z).toBeGreaterThan(getBounds(model, "front-recess").max.z);
    expect(getBounds(model, "glass-side-panel").min.x).toBeGreaterThan(tower.position.x - tower.size.width / 2);
    expect(getBounds(model, "top-panel").max.y).toBeCloseTo(tower.position.y + tower.size.height / 2, 4);
    expect(model.getObjectByName("front-vent-bank")).toBeDefined();
    expect(model.getObjectByName("eryu-e-mark")).toBeDefined();
    expect(getBounds(model, "glass-side-panel").min.x).toBeGreaterThan(getBounds(model, "rear-shell").max.x + 0.002);
    disposeObjectGraph(model);
  });

  it("keeps generated geometry finite with outward-facing front and side normals", () => {
    const model = createComputerStudyVisual();
    for (const mesh of collectMeshes(model)) {
      const positions = mesh.geometry.getAttribute("position");
      const normals = mesh.geometry.getAttribute("normal");
      expect(Array.from(positions.array).every(Number.isFinite), mesh.name).toBe(true);
      expect(Array.from(normals.array).every(Number.isFinite), mesh.name).toBe(true);
    }

    const frontPanel = model.getObjectByName("front-panel") as THREE.Mesh;
    const frontNormals = frontPanel.geometry.getAttribute("normal");
    let forwardNormalCount = 0;
    for (let index = 0; index < frontNormals.count; index++) {
      if (frontNormals.getZ(index) > 0.8) forwardNormalCount += 1;
    }
    expect(forwardNormalCount).toBeGreaterThan(12);

    const sidePanel = model.getObjectByName("glass-side-panel") as THREE.Mesh;
    const sideNormals = sidePanel.geometry.getAttribute("normal");
    let outwardSideCount = 0;
    for (let index = 0; index < sideNormals.count; index++) {
      if (sideNormals.getX(index) > 0.8) outwardSideCount += 1;
    }
    expect(outwardSideCount).toBeGreaterThan(8);
    disposeObjectGraph(model);
  });

  it("stays within visual budgets and keeps detailed meshes out of pointer hits", () => {
    const model = createComputerStudyVisual();
    let triangles = 0;
    const materials = new Set<THREE.Material>();
    for (const mesh of collectMeshes(model)) {
      const positions = mesh.geometry.getAttribute("position");
      triangles += (mesh.geometry.index?.count ?? positions.count) / 3;
      (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((material) => materials.add(material));
      if (mesh.userData.pointerDetail === true) {
        const intersections: THREE.Intersection[] = [];
        mesh.raycast(new THREE.Raycaster(), intersections);
        expect(intersections, mesh.name).toHaveLength(0);
      }
    }
    expect(triangles).toBeLessThanOrEqual(8_000);
    expect(materials.size).toBeLessThanOrEqual(8);
    disposeObjectGraph(model);
  });
});
