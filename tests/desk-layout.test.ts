import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { DESK_LAYOUT } from "../src/desktop/layout";

const sceneSource = readFileSync(new URL("../src/desktop/scene.ts", import.meta.url), "utf8");

describe("approved desktop composition layout", () => {
  it("turns the left monitor slightly toward the main viewing position", () => {
    expect(DESK_LAYOUT.leftMonitor.yaw).toBeGreaterThan(0.17);
    expect(DESK_LAYOUT.leftMonitor.yaw).toBeLessThan(0.24);
    expect(DESK_LAYOUT.leftMonitor.roll).toBeGreaterThan(0.15);
  });

  it("gives the left monitor a visible vertical support and stable foot", () => {
    expect(DESK_LAYOUT.leftMonitor.support.height).toBeGreaterThan(0.8);
    expect(DESK_LAYOUT.leftMonitor.support.footWidth).toBeGreaterThan(1.2);
    expect(DESK_LAYOUT.leftMonitor.support.topY).toBeGreaterThan(
      DESK_LAYOUT.leftMonitor.support.baseY,
    );
  });

  it("keeps the small pegboard and separates a second leaning pegboard on the right", () => {
    const small = DESK_LAYOUT.pegboards.small;
    const large = DESK_LAYOUT.pegboards.large;
    const smallRight = small.x + small.width / 2;
    const largeLeft = large.x - large.width / 2;

    expect(large.x).toBeGreaterThan(small.x);
    expect(largeLeft).toBeGreaterThan(smallRight);
    expect(largeLeft).toBeGreaterThan(smallRight + 0.4);
    expect(Math.abs(large.roll)).toBeGreaterThan(0.15);
    expect(sceneSource).toContain("const angledPegboard = new THREE.Group()");
    expect(sceneSource).toContain("angledPegboard.rotation.z = DESK_LAYOUT.pegboards.large.roll");
  });

  it("keeps the message interaction on the physical mat instead of the main screen", () => {
    expect(sceneSource).not.toContain("桌面留言：${state.message}");
    expect(sceneSource).not.toContain("const note = DESK_LAYOUT.matMessage");
    expect(sceneSource).toContain("messageBoardCanvas");
  });
});
