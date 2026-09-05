import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { withVisualTransaction } from "../src/desktop/finishes/transaction";

describe("material demo failure recovery", () => {
  it("restores shared materials and removes partial detail meshes on failure", () => {
    const root = new THREE.Group();
    const original = new THREE.MeshStandardMaterial({ color: "#123456", roughness: 0.9 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), original);
    mesh.userData.action = "lamp";
    root.add(mesh);
    const texture = new THREE.Texture();
    const dispose = vi.spyOn(texture, "dispose");
    const originalDispose = vi.spyOn(original, "dispose");
    expect(() => withVisualTransaction(root, (own) => {
      own(texture);
      original.color.set("#ffffff");
      original.map = texture;
      mesh.add(new THREE.Mesh(new THREE.BoxGeometry(), original));
      throw new Error("forced finish failure");
    })).toThrow("forced finish failure");
    expect(original.color.getHexString()).toBe("123456");
    expect(original.map).toBeNull();
    expect(mesh.children).toHaveLength(0);
    expect(mesh.userData.action).toBe("lamp");
    expect(dispose).toHaveBeenCalledOnce();
    expect(originalDispose).not.toHaveBeenCalled();
  });

  it("keeps successful changes for the existing scene disposal path", () => {
    const root = new THREE.Group();
    const resource = { dispose: vi.fn() };
    const result = withVisualTransaction(root, (own) => {
      own(resource);
      root.add(new THREE.Group());
      return "ready";
    });
    expect(result).toBe("ready");
    expect(root.children).toHaveLength(1);
    expect(resource.dispose).not.toHaveBeenCalled();
  });
});
