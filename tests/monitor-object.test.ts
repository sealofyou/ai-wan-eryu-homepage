import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { createMonitorsObject } from "../src/desktop/objects/monitors";
import { createDesktopMaterials } from "../src/desktop/objects/primitives";
import { createInitialDesktopState, selectSection } from "../src/desktop/model";
import { disposeObjectGraph } from "../src/desktop/core/renderer";
import { resolveMonitorVariant } from "../src/desktop/core/monitor-variant";

vi.mock("../src/desktop/screens/canvas-utils", () => ({ makeCanvas: () => ({ texture: new THREE.Texture(), context: { fillRect() {}, fillText() {} } }) }));
const surface = { texture: new THREE.Texture() } as any;
const create = () => createMonitorsObject({ mainCanvas: surface, sideCanvas: surface, materials: createDesktopMaterials(), contentById: new Map(), itemsForSection: () => [] });
const candidate = () => new THREE.Group().add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));

describe("explicit monitor visual replacement", () => {
  it("does not enable the candidate without the explicit query", () => {
    expect(resolveMonitorVariant("")).toBe("baseline");
    expect(resolveMonitorVariant("?mouse=study")).toBe("baseline");
    expect(resolveMonitorVariant("?monitors=unknown")).toBe("baseline");
    expect(resolveMonitorVariant("?monitors=study&mouse=study")).toBe("study");
  });
  it("replaces only visual shells and preserves screens and hit targets", () => {
    const monitors = create();
    const before = monitors.mainScreen;
    const targets = [...monitors.interactiveTargets!];
    const position = before.position.clone();
    const main = candidate();
    const portrait = candidate();
    expect(monitors.applyStudyVisuals({ main, portrait })).toBe(true);
    expect(monitors.mainScreen).toBe(before);
    expect(before.position.equals(position)).toBe(true);
    expect(monitors.interactiveTargets).toEqual(targets);
    expect(monitors.group.getObjectByName("baseline-main-frame")!.visible).toBe(false);
    expect(monitors.group.getObjectByName("baseline-side-support")!.visible).toBe(false);
    const soundbar = monitors.group.getObjectByName("monitor-soundbar")!;
    expect(new THREE.Box3().setFromObject(soundbar).min.y).toBeCloseTo(0.22, 5);
    monitors.updateMainActions(selectSection(createInitialDesktopState(), "activities"));
    expect(targets[0].children.some(node => node.userData.action === "content-back")).toBe(true);
    disposeObjectGraph(monitors.group);
  });
  it("disposes incoming visual resources if they arrive after teardown", () => {
    const monitors = create();
    monitors.dispose!();
    const main = candidate();
    const portrait = candidate();
    const dispose = vi.spyOn((main.children[0] as THREE.Mesh).geometry, "dispose");
    expect(monitors.applyStudyVisuals({ main, portrait })).toBe(false);
    expect(dispose).toHaveBeenCalledOnce();
    expect(main.parent).toBeNull();
    disposeObjectGraph(monitors.group);
  });
  it("makes newly rebuilt screen buttons hittable before the next render frame", () => {
    const monitors = create();
    monitors.updateMainActions(selectSection(createInitialDesktopState(), "activities"));
    const hits = monitors.interactiveTargets![0];
    const back = hits.children.find(node => node.userData.action === "content-back")!;
    const ray = new THREE.Raycaster(back.position.clone().add(new THREE.Vector3(0, 0, 1)), new THREE.Vector3(0, 0, -1));
    expect(ray.intersectObject(hits, true)[0]?.object === back).toBe(true);
    disposeObjectGraph(monitors.group);
  });
});
