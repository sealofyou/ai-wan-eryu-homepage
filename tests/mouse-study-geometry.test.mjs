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
  it("removes all marked side controls while retaining the unmarked center keys", () => {
    const model = createMouseStudyModel();
    for (const name of ["upper-left-control-1", "upper-left-control-2", "thumb-trigger", "side-button-forward", "side-button-back"]) {
      expect(Boolean(model.getObjectByName(name)), name).toBe(false);
    }
    expect(model.getObjectByName("wheel-mode-button")).toBeDefined();
    expect(model.getObjectByName("dpi-button")).toBeDefined();
  });
  it("uses the palm plastic on the main and retained control buttons", () => {
    const model = createMouseStudyModel();
    const palm = model.getObjectByName("palm-shell").material;
    for (const name of ["left-main-button", "right-main-button", "wheel-mode-button", "dpi-button"]) {
      expect(model.getObjectByName(name).material === palm, name).toBe(true);
    }
  });
  it("keeps a slimmer wheel without losing its readable diameter", () => {
    const wheel = createMouseStudyModel().getObjectByName("scroll-wheel");
    const size = new THREE.Box3().setFromObject(wheel).getSize(new THREE.Vector3());
    expect(size.x).toBeGreaterThan(0.05);
    expect(size.x).toBeLessThan(0.075);
    expect(size.y).toBeGreaterThan(0.11);
    expect(size.y).toBeLessThan(0.13);
  });
  it("keeps center controls low-profile rather than raised blocks", () => {
    const model = createMouseStudyModel();
    for (const name of ["wheel-mode-button", "dpi-button"]) {
      const size = new THREE.Box3().setFromObject(model.getObjectByName(name)).getSize(new THREE.Vector3());
      expect(size.y, name).toBeLessThan(0.034);
    }
  });
  it("keeps the seam liner below the rear corners of the main keys", () => {
    const model = createMouseStudyModel();
    model.updateMatrixWorld(true);
    const liner = model.getObjectByName("front-seam-liner");
    for (const [name, x] of [["left-main-button", -0.23], ["right-main-button", 0.25]]) {
      const key = model.getObjectByName(name);
      const ray = new THREE.Raycaster(new THREE.Vector3(x, 0.3, -0.015), new THREE.Vector3(0, -1, 0));
      expect(ray.intersectObjects([key, liner], false)[0]?.object.name).toBe(name);
    }
  });
});
