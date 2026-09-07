import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { DESK_LAYOUT } from "../src/desktop/layout";
import { createMonitorStudyVisual } from "../src/desktop/studies/monitor-study-model";
import { disposeObjectGraph } from "../src/desktop/core/renderer";

const screenLayout = DESK_LAYOUT.mainMonitor.screen;
const bounds = (root: THREE.Object3D, name: string) => {
  const part = root.getObjectByName(name);
  expect(part, name).toBeDefined();
  return new THREE.Box3().setFromObject(part!);
};

describe("main monitor study geometry", () => {
  it("preserves the screen reference and keeps the entire readable aperture open", () => {
    const model = createMonitorStudyVisual();
    expect(model.position.toArray()).toEqual(Object.values(screenLayout.position));
    model.updateMatrixWorld(true);
    // Cast inward from the existing content plane: no frame may sit in front of content.
    for (const x of [-0.499, 0, 0.499]) {
      for (const y of [-0.499, 0, 0.499]) {
        const ray = new THREE.Raycaster(new THREE.Vector3(
          screenLayout.position.x + x * screenLayout.size.width,
          screenLayout.position.y + y * screenLayout.size.height,
          screenLayout.position.z + 1,
        ), new THREE.Vector3(0, 0, -1));
        expect(ray.intersectObject(model, true)[0]?.point.z ?? -Infinity)
          .toBeLessThan(screenLayout.position.z);
      }
    }
    disposeObjectGraph(model);
  });

  it("puts the front lip ahead of the panel without a protruding stand", () => {
    const model = createMonitorStudyVisual();
    const frame = bounds(model, "front-bezel");
    expect(frame.max.z - screenLayout.position.z).toBeGreaterThan(0.015);
    expect(frame.max.z - screenLayout.position.z).toBeLessThan(0.06);
    for (const name of ["stand-post", "stand-hinge", "stand-mount"]) {
      expect(bounds(model, name).max.z, name).toBeLessThan(screenLayout.position.z - 0.1);
    }
    disposeObjectGraph(model);
  });

  it("rests the base on the existing desk and connects the post to it", () => {
    const model = createMonitorStudyVisual();
    const deskTop = DESK_LAYOUT.desk.surface.position.y + DESK_LAYOUT.desk.surface.size.height / 2;
    const base = bounds(model, "stand-foot");
    const post = bounds(model, "stand-post");
    expect(base.min.y).toBeCloseTo(deskTop, 5);
    expect(base.max.y - base.min.y).toBeLessThan(0.2);
    expect(post.min.y).toBeLessThanOrEqual(base.max.y);
    expect(post.max.y).toBeGreaterThan(screenLayout.position.y - screenLayout.size.height / 2);
    expect(base.getSize(new THREE.Vector3()).x).toBeGreaterThan(2.4);
    disposeObjectGraph(model);
  });

  it("keeps the model finite and within its geometry and material budget", () => {
    const model = createMonitorStudyVisual();
    let triangles = 0;
    const materials = new Set<THREE.Material>();
    model.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      const positions = node.geometry.getAttribute("position");
      triangles += (node.geometry.index?.count ?? positions.count) / 3;
      expect(Array.from(positions.array).every(Number.isFinite), node.name).toBe(true);
      expect(Array.from(node.geometry.getAttribute("normal").array).every(Number.isFinite), node.name).toBe(true);
      (Array.isArray(node.material) ? node.material : [node.material]).forEach(m => materials.add(m));
    });
    expect(triangles).toBeLessThanOrEqual(8_000);
    expect(materials.size).toBeLessThanOrEqual(6);
    const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
    expect(size.x).toBeGreaterThan(8.1);
    expect(size.x).toBeLessThan(8.5);
    disposeObjectGraph(model);
  });

  it("uses a tapered rear housing with outward-facing side normals", () => {
    const model = createMonitorStudyVisual();
    const housing = model.getObjectByName("rear-housing") as THREE.Mesh;
    const positions = housing.geometry.getAttribute("position");
    const normals = housing.geometry.getAttribute("normal");
    let frontWidth = 0;
    let rearWidth = 0;
    for (let index = 0; index < positions.count; index++) {
      const z = positions.getZ(index);
      if (z > -0.20) frontWidth = Math.max(frontWidth, Math.abs(positions.getX(index)));
      if (z < -0.42) rearWidth = Math.max(rearWidth, Math.abs(positions.getX(index)));
      if (positions.getX(index) > 2.5 && z < -0.2 && z > -0.4) {
        expect(normals.getX(index)).toBeGreaterThan(0);
      }
    }
    expect(frontWidth).toBeGreaterThan(2.65);
    expect(rearWidth).toBeGreaterThan(2.2);
    expect(frontWidth - rearWidth).toBeGreaterThan(0.2);
    disposeObjectGraph(model);
  });
});
