import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createMouseStudyModel } from "../scripts/modeling/eryu-mouse.mjs";
import { resolveDesktopMouseVariant } from "../src/desktop/core/model-assets";

describe("reference-led mouse geometry", () => {
  it("is an opt-in candidate and keeps the original default", () => {
    expect(resolveDesktopMouseVariant("")).toBe("procedural");
    expect(resolveDesktopMouseVariant("?mouse=study")).toBe("study");
    expect(resolveDesktopMouseVariant("?mouse=glb")).toBe("glb");
  });
  it("has the photographed low, elongated footprint with a wider left thumb wing", () => {
    const model = createMouseStudyModel();
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    expect(size.z / size.x).toBeGreaterThan(1.55);
    expect(size.z / size.x).toBeLessThan(2.1);
    expect(size.y / size.z).toBeGreaterThan(0.23);
    expect(size.y / size.z).toBeLessThan(0.37);
    expect(-bounds.min.x).toBeGreaterThan(bounds.max.x);
    expect(bounds.min.y).toBeCloseTo(-0.30, 2);
  });
  it("contains separate curved shell, button, scroll-well and thumb-rest components", () => {
    const model = createMouseStudyModel();
    for (const name of ["lower-chassis", "palm-shell", "left-main-button", "right-main-button", "scroll-wheel", "thumb-rest", "left-grip", "eryu-mark"]) {
      expect(model.getObjectByName(name), name).toBeDefined();
    }
    let triangles = 0;
    model.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      const position = node.geometry.getAttribute("position");
      triangles += (node.geometry.index?.count ?? position.count) / 3;
      expect(Array.from(position.array).every(Number.isFinite), node.name).toBe(true);
      expect(Array.from(node.geometry.getAttribute("normal").array).every(Number.isFinite), node.name).toBe(true);
    });
    expect(triangles).toBeLessThanOrEqual(20_000);
  });
  it("faces the scroll barrel outward so it renders as one treaded wheel", () => {
    const wheel = createMouseStudyModel().getObjectByName("scroll-wheel");
    const barrel = wheel.children[0];
    expect(barrel.geometry.getAttribute("normal").getY(0)).toBeGreaterThan(0);
  });
});
