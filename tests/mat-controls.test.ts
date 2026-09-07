import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { createMatControlsObject } from "../src/desktop/objects/mat-controls";
import { createDesktopMaterials } from "../src/desktop/objects/primitives";
import { createInitialDesktopState } from "../src/desktop/model";

vi.mock("../src/desktop/screens/canvas-utils", () => ({ makeCanvas: () => ({ texture: new THREE.Texture(), context: { fillRect() {}, fillText() {} } }) }));

describe("mat control removal", () => {
  it("creates no buttons, labels or hit targets when explicitly disabled", () => {
    const controls = createMatControlsObject(createDesktopMaterials(), { visible: false });
    expect(controls.group.children).toHaveLength(0);
    expect(controls.interactiveTargets).toEqual([]);
    expect(() => controls.update?.(createInitialDesktopState())).not.toThrow();
  });
  it("preserves the original comparison when no removal option is supplied", () => {
    const controls = createMatControlsObject(createDesktopMaterials());
    expect(controls.group.children).toHaveLength(8);
    expect(controls.interactiveTargets).toHaveLength(4);
  });
});
