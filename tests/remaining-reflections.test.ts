import * as THREE from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyRemainingReflections } from "../src/desktop/studies/remaining-reflections";
const mocks = vi.hoisted(() => ({ targetDispose: vi.fn(), roomDispose: vi.fn(), generatorDispose: vi.fn(), fail: false }));
vi.mock("three", async original => ({
  ...await original<object>(),
  PMREMGenerator: class {
    fromScene() { if (mocks.fail) throw new Error("reflection failure"); return { width: 384, height: 512, texture: { name: "generated" }, dispose: mocks.targetDispose }; }
    dispose() { mocks.generatorDispose(); }
  },
}));
vi.mock("three/addons/environments/RoomEnvironment.js", () => ({ RoomEnvironment: class { dispose() { mocks.roomDispose(); } } }));
afterEach(() => { vi.clearAllMocks(); mocks.fail = false; });
describe("remaining desk reflection transaction", () => {
  it("restores the previous environment without disposing borrowed texture", () => {
    const scene = new THREE.Scene();
    const borrowed = new THREE.Texture();
    const borrowedDispose = vi.spyOn(borrowed, "dispose");
    scene.environment = borrowed; scene.environmentIntensity = .73;
    const result = applyRemainingReflections({} as THREE.WebGLRenderer, scene);
    expect(scene.environment).not.toBe(borrowed);
    expect(scene.environmentIntensity).toBeLessThan(.73);
    expect(result.textureBytes).toBe(384 * 512 * 8);
    result.dispose(); result.dispose();
    expect(scene.environment).toBe(borrowed);
    expect(scene.environmentIntensity).toBe(.73);
    expect(mocks.targetDispose).toHaveBeenCalledOnce();
    expect(borrowedDispose).not.toHaveBeenCalled();
    expect(mocks.roomDispose).toHaveBeenCalledOnce();
    expect(mocks.generatorDispose).toHaveBeenCalledOnce();
  });
  it("leaves scene unchanged and releases temporary generator on failure", () => {
    const scene = new THREE.Scene(); mocks.fail = true;
    expect(() => applyRemainingReflections({} as THREE.WebGLRenderer, scene)).toThrow("reflection failure");
    expect(scene.environment).toBeNull();
    expect(scene.environmentIntensity).toBe(1);
    expect(mocks.roomDispose).toHaveBeenCalledOnce();
    expect(mocks.generatorDispose).toHaveBeenCalledOnce();
  });
});
