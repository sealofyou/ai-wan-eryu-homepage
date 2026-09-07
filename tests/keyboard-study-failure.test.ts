import * as THREE from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createKeyboardStudyModel } from "../src/desktop/studies/keyboard-study-model";
import { createKeyboardLayout } from "../src/desktop/keyboard";

vi.mock("three/addons/utils/BufferGeometryUtils.js", async importOriginal => ({
  ...await importOriginal<object>(), mergeGeometries: () => null,
}));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("keyboard construction failure", () => {
  it("releases all allocated geometry and the atlas if a later batch cannot merge", () => {
    vi.stubGlobal("document", { createElement: () => ({ getContext: () => ({ clearRect() {}, fillText() {} }) }) });
    const geometryDispose = vi.spyOn(THREE.BufferGeometry.prototype, "dispose");
    const materialDispose = vi.spyOn(THREE.Material.prototype, "dispose");
    const textureDispose = vi.spyOn(THREE.Texture.prototype, "dispose");
    expect(() => createKeyboardStudyModel({ withLegends: true })).toThrow("Keyboard geometry batch unavailable");
    expect(geometryDispose.mock.calls.length).toBeGreaterThanOrEqual(createKeyboardLayout().keys.length * 2 + 4);
    expect(materialDispose.mock.calls.length).toBeGreaterThanOrEqual(7);
    expect(textureDispose).toHaveBeenCalledOnce();
  });
});
