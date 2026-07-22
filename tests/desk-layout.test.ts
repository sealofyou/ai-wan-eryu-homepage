import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { DESK_LAYOUT } from "../src/desktop/layout";

const sceneSource = readFileSync(new URL("../src/desktop/scene.ts", import.meta.url), "utf8");

describe("approved desktop composition layout", () => {
  it("turns the left monitor slightly toward the main viewing position", () => {
    expect(DESK_LAYOUT.leftMonitor.yaw).toBeGreaterThan(0.42);
    expect(DESK_LAYOUT.leftMonitor.yaw).toBeLessThan(0.58);
    expect(sceneSource).toContain("sideMonitor.rotation.y = DESK_LAYOUT.leftMonitor.yaw");
    expect(sceneSource).not.toContain("sideMonitor.rotation.z");
  });

  it("gives the left monitor a visible vertical support and stable foot", () => {
    expect(DESK_LAYOUT.leftMonitor.support.height).toBeGreaterThan(0.8);
    expect(DESK_LAYOUT.leftMonitor.support.footWidth).toBeGreaterThan(1.2);
    expect(DESK_LAYOUT.leftMonitor.support.topY).toBeGreaterThan(
      DESK_LAYOUT.leftMonitor.support.baseY,
    );
  });

  it("keeps the small pegboard and places a separate angled board on the desk edge", () => {
    const small = DESK_LAYOUT.pegboards.small;
    const large = DESK_LAYOUT.pegboards.large;
    expect(DESK_LAYOUT.pegboards.large.width).toBeGreaterThan(
      DESK_LAYOUT.pegboards.small.width,
    );
    expect(DESK_LAYOUT.pegboards.large.height).toBeGreaterThan(
      DESK_LAYOUT.pegboards.small.height,
    );
    expect(large.x).toBeGreaterThan(8);
    expect(large.width).toBeGreaterThan(5);
    expect(large.y - large.height / 2).toBeGreaterThan(0.15);
    expect(Math.abs(large.yaw)).toBeGreaterThan(0.9);
    expect(sceneSource).toContain("const angledPegboard = new THREE.Group()");
    expect(sceneSource).toContain("angledPegboard.rotation.y = DESK_LAYOUT.pegboards.large.yaw");
    expect(sceneSource).toContain("angledPegboard.add(largeBoard)");
    expect(sceneSource).toContain("angledPegboard.add(hole)");
  });

  it("keeps the message interaction on the physical mat instead of the main screen", () => {
    expect(sceneSource).not.toContain("桌面留言：${state.message}");
    expect(sceneSource).not.toContain("const note = DESK_LAYOUT.matMessage");
    expect(sceneSource).toContain("messageBoardCanvas");
  });
});
