import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createSoundbarStudyVisual } from "../src/desktop/studies/soundbar-study-model";
import { DESK_LAYOUT } from "../src/desktop/layout";
import { disposeObjectGraph } from "../src/desktop/core/renderer";

describe("soundbar study", () => {
  it("keeps the grille forward of the solid shell but behind the raised rim", () => {
    const group = createSoundbarStudyVisual();
    const bounds = (name: string) => new THREE.Box3().setFromObject(group.getObjectByName(name)!);
    expect(bounds("soundbar-grille").min.z).toBeGreaterThan(bounds("soundbar-shell").max.z + 0.002);
    expect(bounds("soundbar-grille").max.z).toBeLessThan(bounds("soundbar-front-rim").max.z - 0.002);
    disposeObjectGraph(group);
  });
  it("maps the entire grille texture across the face with normalized UVs", () => {
    const group = createSoundbarStudyVisual();
    const grille = group.getObjectByName("soundbar-grille") as THREE.Mesh;
    const uv = grille.geometry.getAttribute("uv");
    expect(Math.min(...Array.from(uv.array))).toBeGreaterThanOrEqual(0);
    expect(Math.max(...Array.from(uv.array))).toBeLessThanOrEqual(1);
    disposeObjectGraph(group);
  });
  it("keeps the accepted grounded envelope with separate feet and a recessed grille", () => {
    const group = createSoundbarStudyVisual();
    const bounds = new THREE.Box3().setFromObject(group);
    const size = bounds.getSize(new THREE.Vector3());
    expect(bounds.min.y).toBeCloseTo(0.22, 5);
    expect(size.x).toBeCloseTo(DESK_LAYOUT.mainMonitor.soundbar.size.width, 2);
    expect(size.y).toBeLessThanOrEqual(0.59);
    expect(size.z).toBeLessThan(0.81);
    expect(group.getObjectByName("soundbar-grille")).toBeDefined();
    expect(group.getObjectByName("soundbar-feet")).toBeDefined();
    disposeObjectGraph(group);
  });
  it("bounds geometry and texture resources without downloading assets", () => {
    const group = createSoundbarStudyVisual();
    let triangles = 0;
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    group.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return;
      const positions = node.geometry.getAttribute("position");
      expect(Array.from(positions.array).every(Number.isFinite)).toBe(true);
      triangles += (node.geometry.index?.count ?? positions.count) / 3 * (node instanceof THREE.InstancedMesh ? node.count : 1);
      (Array.isArray(node.material) ? node.material : [node.material]).forEach(material => {
        materials.add(material);
        Object.values(material).forEach(value => { if (value instanceof THREE.Texture) textures.add(value); });
      });
    });
    expect(triangles).toBeLessThanOrEqual(5000);
    expect(materials.size).toBeLessThanOrEqual(6);
    for (const texture of textures) {
      const image = texture.image as {width:number;height:number};
      expect(image.width).toBeLessThanOrEqual(1024);
      expect(image.height).toBeLessThanOrEqual(1024);
    }
    disposeObjectGraph(group);
  });
});
