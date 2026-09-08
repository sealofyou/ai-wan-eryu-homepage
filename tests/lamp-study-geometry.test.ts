import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { DESK_LAYOUT } from "../src/desktop/layout";
import { disposeObjectGraph } from "../src/desktop/core/renderer";
import { createLampStudyVisual } from "../src/desktop/studies/lamp-study-model";

const lamp = DESK_LAYOUT.lamp;
const deskTop = DESK_LAYOUT.desk.surface.position.y + DESK_LAYOUT.desk.surface.size.height / 2;
const root = new THREE.Vector3(lamp.position.x, lamp.position.y, lamp.position.z);
const basePivot = new THREE.Vector3(0.15, 0.23, 0);
const elbow = new THREE.Vector3(0.36, 2.3, 0);
const shadeCenter = new THREE.Vector3(lamp.shade.position.x, lamp.shade.position.y, lamp.shade.position.z);
const shadeAxis = new THREE.Vector3(0, 1, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), lamp.shade.rotationZ).normalize();
const shadeSmallEnd = shadeCenter.clone().addScaledVector(shadeAxis, lamp.shade.height / 2);

const bounds = (rootObject: THREE.Object3D, name: string) => {
  const part = rootObject.getObjectByName(name);
  expect(part, name).toBeDefined();
  return new THREE.Box3().setFromObject(part!);
};

const localAnchor = (object: THREE.Object3D, name: string) => {
  const anchor = object.userData[name];
  expect(anchor, `${object.name}.${name}`).toBeDefined();
  return new THREE.Vector3(anchor[0], anchor[1], anchor[2]);
};

describe("lamp study geometry", () => {
  it("exports an independent root at the existing lamp position with a thin grounded oval base", () => {
    const visual = createLampStudyVisual();
    expect(visual.group.position.toArray()).toEqual(Object.values(lamp.position));
    visual.group.updateMatrixWorld(true);

    const base = bounds(visual.group, "lamp-oval-base");
    expect(base.min.y).toBeCloseTo(deskTop, 5);
    expect(base.max.y - base.min.y).toBeLessThanOrEqual(0.22);
    expect(base.getSize(new THREE.Vector3()).x).toBeGreaterThan(base.getSize(new THREE.Vector3()).z);
    const pivotWorld = root.clone().add(basePivot);
    expect(pivotWorld.x).toBeGreaterThan(base.min.x);
    expect(pivotWorld.x).toBeLessThan(base.max.x);
    expect(pivotWorld.z).toBeGreaterThan(base.min.z);
    expect(pivotWorld.z).toBeLessThan(base.max.z);
    expect(Math.abs(pivotWorld.y - base.max.y)).toBeLessThan(0.06);
    disposeObjectGraph(visual.group);
  });

  it("connects both arm spans to the base pivot, elbow, and shade small end", () => {
    const visual = createLampStudyVisual();
    for (const name of ["lower-arm-left", "lower-arm-right"]) {
      const rod = visual.group.getObjectByName(name)!;
      expect(localAnchor(rod, "start").distanceTo(basePivot)).toBeLessThan(0.02);
      expect(localAnchor(rod, "end").distanceTo(elbow)).toBeLessThan(0.02);
      expect(bounds(visual.group, name).getSize(new THREE.Vector3()).x).toBeLessThan(0.35);
    }
    for (const name of ["upper-arm-left", "upper-arm-right"]) {
      const rod = visual.group.getObjectByName(name)!;
      expect(localAnchor(rod, "start").distanceTo(elbow)).toBeLessThan(0.02);
      expect(localAnchor(rod, "end").distanceTo(shadeSmallEnd)).toBeLessThan(0.03);
    }
    expect(bounds(visual.group, "base-pivot-joint").containsPoint(root.clone().add(basePivot))).toBe(true);
    expect(bounds(visual.group, "elbow-joint").containsPoint(root.clone().add(elbow))).toBe(true);
    expect(bounds(visual.group, "head-yoke-joint").containsPoint(root.clone().add(shadeSmallEnd))).toBe(true);
    disposeObjectGraph(visual.group);
  });

  it("keeps the shade center and tilt while adding shell thickness, liner, back cap, front rim, and a visible bulb", () => {
    const visual = createLampStudyVisual();
    const shade = visual.group.getObjectByName("shade-assembly")!;
    expect(shade.position.distanceTo(shadeCenter)).toBeLessThan(1e-6);
    expect(shade.rotation.z).toBeCloseTo(lamp.shade.rotationZ, 6);

    const outer = visual.group.getObjectByName("shade-outer-shell") as THREE.Mesh;
    const inner = visual.group.getObjectByName("shade-inner-liner") as THREE.Mesh;
    const cap = visual.group.getObjectByName("shade-back-cap") as THREE.Mesh;
    const rim = visual.group.getObjectByName("shade-front-rolled-rim") as THREE.Mesh;
    const bulb = visual.group.getObjectByName("visible-bulb") as THREE.Mesh;
    expect(outer).toBeInstanceOf(THREE.Mesh);
    expect(inner).toBeInstanceOf(THREE.Mesh);
    expect(cap).toBeInstanceOf(THREE.Mesh);
    expect(rim).toBeInstanceOf(THREE.Mesh);
    expect(bulb).toBeInstanceOf(THREE.Mesh);
    expect(outer.userData.radiusBottom - inner.userData.radiusBottom).toBeGreaterThan(0.035);
    expect((cap.position.y - lamp.shade.height / 2)).toBeCloseTo(0, 5);
    expect((rim.position.y + lamp.shade.height / 2)).toBeCloseTo(0, 5);

    const bulbFromApi = visual.bulbPosition.clone().sub(root);
    const alongShade = bulbFromApi.clone().sub(shadeCenter).dot(shadeAxis);
    const radialShade = bulbFromApi.clone().sub(shadeCenter).addScaledVector(shadeAxis, -alongShade).length();
    expect(alongShade).toBeGreaterThan(-lamp.shade.height / 2);
    expect(alongShade).toBeLessThan(lamp.shade.height / 2);
    expect(radialShade).toBeLessThan(lamp.shade.radiusBottom - 0.12);
    disposeObjectGraph(visual.group);
  });

  it("reports the bulb world position for the parent lamp light", () => {
    const visual = createLampStudyVisual();
    const bulb = visual.group.getObjectByName("visible-bulb")!;
    visual.group.updateMatrixWorld(true);
    const bulbWorld = new THREE.Vector3();
    bulb.getWorldPosition(bulbWorld);
    expect(visual.bulbPosition.distanceTo(bulbWorld)).toBeLessThan(1e-6);
    expect(visual.bulbPosition.y).toBeGreaterThan(3.5);
    disposeObjectGraph(visual.group);
  });

  it("brightness only changes emissive appearance and clamps the parent intensity ratio", () => {
    const visual = createLampStudyVisual();
    visual.group.updateMatrixWorld(true);
    const matrixBefore = visual.group.matrixWorld.clone();
    const geometryIds: string[] = [];
    visual.group.traverse((node) => {
      if (node instanceof THREE.Mesh) geometryIds.push(node.geometry.uuid);
    });

    visual.setBrightness(-1);
    const dimBulb = (visual.group.getObjectByName("visible-bulb") as THREE.Mesh).material as THREE.MeshStandardMaterial;
    const dimLiner = (visual.group.getObjectByName("shade-inner-liner") as THREE.Mesh).material as THREE.MeshStandardMaterial;
    expect(dimBulb.emissiveIntensity).toBeCloseTo(0.35, 5);
    expect(dimLiner.emissiveIntensity).toBeCloseTo(0.08, 5);

    visual.setBrightness(2);
    const brightBulb = (visual.group.getObjectByName("visible-bulb") as THREE.Mesh).material as THREE.MeshStandardMaterial;
    const brightLiner = (visual.group.getObjectByName("shade-inner-liner") as THREE.Mesh).material as THREE.MeshStandardMaterial;
    expect(brightBulb.emissiveIntensity).toBeCloseTo(1.45, 5);
    expect(brightLiner.emissiveIntensity).toBeCloseTo(0.62, 5);
    expect(visual.group.matrixWorld.equals(matrixBefore)).toBe(true);

    const geometryAfter: string[] = [];
    visual.group.traverse((node) => {
      if (node instanceof THREE.Mesh) geometryAfter.push(node.geometry.uuid);
    });
    expect(geometryAfter).toEqual(geometryIds);
    disposeObjectGraph(visual.group);
  });

  it("stays finite and under the study geometry/material budget", () => {
    const visual = createLampStudyVisual();
    let triangles = 0;
    const materials = new Set<THREE.Material>();
    visual.group.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      const positions = node.geometry.getAttribute("position");
      const normals = node.geometry.getAttribute("normal");
      triangles += (node.geometry.index?.count ?? positions.count) / 3;
      expect(Array.from(positions.array).every(Number.isFinite), node.name).toBe(true);
      expect(Array.from(normals.array).every(Number.isFinite), node.name).toBe(true);
      (Array.isArray(node.material) ? node.material : [node.material]).forEach(material => materials.add(material));
    });
    expect(triangles).toBeLessThanOrEqual(8_000);
    expect(materials.size).toBeLessThanOrEqual(8);
    disposeObjectGraph(visual.group);
  });
});
