import * as THREE from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createKeycapGeometry, createKeyboardStudyModel, KEYBOARD_STUDY_FLOOR_Y } from "../src/desktop/studies/keyboard-study-model";
import { createKeyboardLayout } from "../src/desktop/keyboard";
import { disposeObjectGraph } from "../src/desktop/core/renderer";
afterEach(() => vi.unstubAllGlobals());

describe("refined keyboard geometry", () => {
  it("keeps the actual browser model within one atlas, eight materials and ten batches", () => {
    vi.stubGlobal("document", { createElement: () => ({ getContext: () => ({ clearRect() {}, fillText() {} }) }) });
    const model = createKeyboardStudyModel({ withLegends: true });
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    let triangles = 0;
    let meshes = 0;
    model.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return;
      meshes++;
      triangles += (node.geometry.index?.count ?? node.geometry.getAttribute("position").count) / 3;
      (Array.isArray(node.material) ? node.material : [node.material]).forEach(material => {
        materials.add(material);
        Object.values(material).forEach(value => { if (value instanceof THREE.Texture) textures.add(value); });
      });
    });
    expect(model.userData.legendAtlas).toBe("1024×1024");
    expect(textures.size).toBe(1);
    const texture = [...textures][0];
    expect(texture.image).toMatchObject({ width: 1024, height: 1024 });
    expect(materials.size).toBeLessThanOrEqual(8);
    expect(meshes).toBeLessThanOrEqual(10);
    expect(triangles).toBeLessThanOrEqual(30000);
    disposeObjectGraph(model);
  });
  it("has a shallow dished top and tapered sidewalls instead of stacked boxes", () => {
    const geometry = createKeycapGeometry(0.22, 0.22, 0.014);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
    mesh.updateMatrixWorld(true);
    const heightAt = (x: number) => new THREE.Raycaster(new THREE.Vector3(x, 1, 0), new THREE.Vector3(0, -1, 0)).intersectObject(mesh)[0]?.point.y ?? NaN;
    const center = heightAt(0);
    const nearRim = heightAt(0.075);
    expect(Number.isFinite(center)).toBe(true);
    expect(nearRim - center).toBeGreaterThan(0.007);
    expect(nearRim - center).toBeLessThan(0.03);
    const position = geometry.getAttribute("position");
    let bottomWidth = 0;
    let topWidth = 0;
    for (let i = 0; i < position.count; i++) {
      if (position.getY(i) < 0.15) bottomWidth = Math.max(bottomWidth, Math.abs(position.getX(i)));
      if (position.getY(i) > 0.27) topWidth = Math.max(topWidth, Math.abs(position.getX(i)));
    }
    expect(bottomWidth - topWidth).toBeGreaterThan(0.015);
    disposeObjectGraph(mesh);
  });
  it("keeps the existing key layout and full-size footprint", () => {
    const model = createKeyboardStudyModel();
    expect(model.userData.keyIds).toEqual(createKeyboardLayout().keys.map(key => key.id));
    const bounds = new THREE.Box3().setFromObject(model);
    expect(bounds.min.y).toBeCloseTo(KEYBOARD_STUDY_FLOOR_Y, 5);
    expect(bounds.getSize(new THREE.Vector3()).x).toBeCloseTo(6.13, 2);
    expect(bounds.getSize(new THREE.Vector3()).z).toBeLessThan(2.1);
    disposeObjectGraph(model);
  });
  it("uses finite outward normals and shared batches within the model budget", () => {
    const model = createKeyboardStudyModel();
    let triangles = 0;
    let meshes = 0;
    const materials = new Set<THREE.Material>();
    model.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return;
      meshes++;
      const positions = node.geometry.getAttribute("position");
      const normals = node.geometry.getAttribute("normal");
      expect(Array.from(positions.array).every(Number.isFinite), node.name).toBe(true);
      for (let i = 0; i < normals.count; i++) {
        expect(new THREE.Vector3().fromBufferAttribute(normals, i).length(), node.name).toBeGreaterThan(0.9);
      }
      triangles += (node.geometry.index?.count ?? positions.count) / 3;
      (Array.isArray(node.material) ? node.material : [node.material]).forEach(material => materials.add(material));
    });
    expect(triangles).toBeLessThanOrEqual(30000);
    expect(materials.size).toBeLessThanOrEqual(8);
    expect(meshes).toBeLessThanOrEqual(10);
    disposeObjectGraph(model);
  });
});
