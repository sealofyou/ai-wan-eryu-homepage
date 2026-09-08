import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { applyRemainingVisuals } from "../src/desktop/studies/remaining-visuals";
import type { EnvironmentFinishRefs } from "../src/desktop/studies/environment-finish";

function fixture() {
  const mesh = () => new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
  const refs: EnvironmentFinishRefs = {
    deskBody: mesh(), deskApron: mesh(), matBase: mesh(), matSurface: mesh(), wall: mesh(),
    pegboard: mesh(), pegHoles: [mesh()], messagePaper: mesh(), badges: [mesh()],
    quotePaper: mesh(), toyBase: mesh(), toyBacking: mesh(), toySurface: mesh(),
  };
  const world = new THREE.Group();
  const originals = [new THREE.Group(), new THREE.Group(), mesh(), mesh()];
  originals.forEach(object => world.add(object));
  originals[2].visible = false;
  const lampLight = new THREE.PointLight("white", 42);
  lampLight.position.set(4.55, 3.7, .35);
  return { world, refs, originals, lampLight };
}

describe("remaining visual assembly", () => {
  it("replaces visual layers only and restores exact originals on idempotent disposal", () => {
    const input = fixture();
    const originalMaterial = input.refs.matSurface.material;
    const oldLightPosition = input.lampLight.position.clone();
    const oldWallGeometry = input.refs.wall.geometry;
    const materialDispose = vi.spyOn(originalMaterial as THREE.Material, "dispose");
    const result = applyRemainingVisuals({ ...input, withBrand: false });
    expect(input.originals.every(object => !object.visible)).toBe(true);
    expect(result.group.parent).toBe(input.world);
    expect(input.refs.wall.geometry).not.toBe(oldWallGeometry);
    input.refs.wall.geometry.computeBoundingBox();
    expect(input.refs.wall.geometry.boundingBox!.getSize(new THREE.Vector3()).x).toBeGreaterThanOrEqual(30);
    expect(result.group.getObjectByName("computer-study-visual")).toBeDefined();
    expect(result.stats.textureBytes).toBeLessThanOrEqual(8 * 1024 * 1024);
    let actions = 0;
    result.group.traverse(object => { if (object.userData.action) actions++; });
    expect(actions).toBe(0);
    result.setLampBrightness(14);
    const bulb = result.group.getObjectByName("visible-bulb") as THREE.Mesh;
    const dim = (bulb.material as THREE.MeshStandardMaterial).emissiveIntensity;
    result.setLampBrightness(55);
    expect((bulb.material as THREE.MeshStandardMaterial).emissiveIntensity).toBeGreaterThan(dim);
    result.dispose(); result.dispose();
    expect(input.originals.map(object => object.visible)).toEqual([true, true, false, true]);
    expect(input.refs.matSurface.material).toBe(originalMaterial);
    expect(input.refs.wall.geometry).toBe(oldWallGeometry);
    expect(input.lampLight.position.equals(oldLightPosition)).toBe(true);
    expect(input.world.children).toEqual(input.originals);
    expect(materialDispose).not.toHaveBeenCalled();
  });

  it("rolls back model resources and borrowed state when environment setup fails", () => {
    const input = fixture();
    input.refs.pegHoles.push({} as THREE.Mesh);
    const originalMaterial = input.refs.deskBody.material;
    const oldLightPosition = input.lampLight.position.clone();
    const dispose = vi.spyOn(THREE.BufferGeometry.prototype, "dispose");
    expect(() => applyRemainingVisuals({ ...input, withBrand: false })).toThrow();
    expect(input.world.children).toEqual(input.originals);
    expect(input.originals.map(object => object.visible)).toEqual([true, true, false, true]);
    expect(input.refs.deskBody.material).toBe(originalMaterial);
    expect(input.lampLight.position.equals(oldLightPosition)).toBe(true);
    expect(dispose).toHaveBeenCalled();
  });
});
