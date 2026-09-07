import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { createKeyboardObject } from "../src/desktop/objects/keyboard-object";
import { createInitialDesktopState } from "../src/desktop/model";
import { DESK_LAYOUT } from "../src/desktop/layout";
import { disposeObjectGraph } from "../src/desktop/core/renderer";

vi.mock("../src/desktop/keyboard", () => ({ createKeyboardModel: () => {
  const group = new THREE.Group();
  group.name = "legacy-keyboard";
  group.add(new THREE.Mesh(new THREE.BoxGeometry(6.13, 0.3, 1.99), new THREE.MeshStandardMaterial()));
  group.userData.dimensions = { width: 6.13, depth: 1.99 };
  return group;
} }));

describe("keyboard candidate visual replacement", () => {
  it("keeps the drag container and uses one proxy instead of detailed keycap raycasts", () => {
    const keyboard = createKeyboardObject();
    const target = keyboard.interactiveTargets![0];
    const visual = new THREE.Group();
    const detail = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    visual.add(detail);
    expect(keyboard.applyStudyVisual(visual, -0.1225)).toBe(true);
    expect(keyboard.interactiveTargets![0]).toBe(target);
    expect(keyboard.group.getObjectByName("legacy-keyboard")).toBeUndefined();
    keyboard.update!(createInitialDesktopState());
    expect(keyboard.group.position.y).toBe(DESK_LAYOUT.keyboard.y);
    expect(keyboard.group.position.y + visual.position.y - 0.1225).toBeCloseTo(DESK_LAYOUT.desk.mat.surface.position.y);
    const hit = keyboard.group.getObjectByName("keyboard-study-hit") as THREE.Mesh;
    expect(hit.userData.action).toBe("keyboard");
    const intersections: THREE.Intersection[] = [];
    detail.raycast(new THREE.Raycaster(), intersections);
    expect(intersections).toHaveLength(0);
    keyboard.dispose!();
    disposeObjectGraph(keyboard.group);
  });
  it("releases a late candidate and never attaches it after disposal", () => {
    const keyboard = createKeyboardObject();
    keyboard.dispose!();
    const visual = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    visual.add(mesh);
    const dispose = vi.spyOn(mesh.geometry, "dispose");
    expect(keyboard.applyStudyVisual(visual, -0.1225)).toBe(false);
    expect(visual.parent).toBeNull();
    expect(dispose).toHaveBeenCalledOnce();
    disposeObjectGraph(keyboard.group);
  });
});
