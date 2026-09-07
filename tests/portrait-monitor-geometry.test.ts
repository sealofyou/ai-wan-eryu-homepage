import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { DESK_LAYOUT } from "../src/desktop/layout";
import { createMonitorStudyVisual } from "../src/desktop/studies/monitor-study-model";
import { disposeObjectGraph } from "../src/desktop/core/renderer";

describe("portrait monitor follows the accepted hardware language", () => {
  it("keeps the original portrait screen center, yaw and unobstructed aperture", () => {
    const model = createMonitorStudyVisual("portrait");
    const layout = DESK_LAYOUT.leftMonitor;
    expect(model.rotation.y).toBe(layout.yaw);
    expect(model.position.x).toBeCloseTo(layout.center.x + Math.sin(layout.yaw) * layout.screen.z);
    expect(model.position.y).toBe(layout.center.y);
    expect(model.position.z).toBeCloseTo(layout.center.z + Math.cos(layout.yaw) * layout.screen.z);
    model.updateMatrixWorld(true);
    for (const x of [-0.499, 0, 0.499]) {
      for (const y of [-0.499, 0, 0.499]) {
        const origin = model.localToWorld(new THREE.Vector3(x * layout.screen.size.width, y * layout.screen.size.height, 1));
        const direction = new THREE.Vector3(0, 0, -1).transformDirection(model.matrixWorld);
        const hit = new THREE.Raycaster(origin, direction).intersectObject(model, true)[0];
        expect(hit?.distance ?? Infinity).toBeGreaterThan(1);
      }
    }
    disposeObjectGraph(model);
  });
  it("has a portrait-sized case and a rear stand on the desk", () => {
    const model = createMonitorStudyVisual("portrait");
    const base = new THREE.Box3().setFromObject(model.getObjectByName("stand-foot")!);
    expect(base.min.y).toBeCloseTo(0.22, 5);
    const front = model.getObjectByName("front-bezel") as THREE.Mesh;
    front.geometry.computeBoundingBox();
    const size = front.geometry.boundingBox!.getSize(new THREE.Vector3());
    expect(size.x).toBeGreaterThan(2.5);
    expect(size.x).toBeLessThan(2.8);
    expect(size.y).toBeGreaterThan(4.7);
    expect(size.y).toBeLessThan(5.1);
    const post = model.getObjectByName("stand-post") as THREE.Mesh;
    expect(post.position.z + 0.12).toBeLessThan(-0.1);
    disposeObjectGraph(model);
  });
});
