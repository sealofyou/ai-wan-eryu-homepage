import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { DESK_LAYOUT } from "../src/desktop/layout";

const sceneSource = readFileSync(new URL("../src/desktop/scene.ts", import.meta.url), "utf8");

describe("approved desktop composition layout", () => {
  it("turns the left monitor slightly toward the main viewing position", () => {
    expect(DESK_LAYOUT.leftMonitor.yaw).toBeGreaterThan(0.08);
    expect(DESK_LAYOUT.leftMonitor.yaw).toBeLessThan(0.24);
  });

  it("gives the left monitor a visible vertical support and stable foot", () => {
    expect(DESK_LAYOUT.leftMonitor.support.height).toBeGreaterThan(0.8);
    expect(DESK_LAYOUT.leftMonitor.support.footWidth).toBeGreaterThan(1.2);
    expect(DESK_LAYOUT.leftMonitor.support.topY).toBeGreaterThan(
      DESK_LAYOUT.leftMonitor.support.baseY,
    );
  });

  it("keeps the original pegboard and adds a larger badge surface", () => {
    expect(DESK_LAYOUT.pegboards.large.width).toBeGreaterThan(
      DESK_LAYOUT.pegboards.small.width,
    );
    expect(DESK_LAYOUT.pegboards.large.height).toBeGreaterThan(
      DESK_LAYOUT.pegboards.small.height,
    );
    expect(DESK_LAYOUT.pegboards.large.x).toBeGreaterThan(6.45);
  });

  it("keeps the message interaction on the physical mat instead of the main screen", () => {
    expect(sceneSource).not.toContain("桌面留言：${state.message}");
    expect(sceneSource).toContain('context.fillText("留言板", 24, 48)');
  });
});
