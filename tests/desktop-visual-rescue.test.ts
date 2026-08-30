import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { DESK_LAYOUT } from "../src/desktop/layout";
import {
  createDesktopCameraPose,
  resolveDesktopCameraMode,
} from "../src/desktop/core/renderer";
import {
  MAIN_SCREEN_BUTTON,
  MAIN_SCREEN_TYPOGRAPHY,
} from "../src/desktop/screens/main-screen";

const rendererSource = readFileSync(
  new URL("../src/desktop/core/renderer.ts", import.meta.url),
  "utf8",
);

describe("desktop visual rescue contract", () => {
  it("moves the overview camera closer while keeping a separate content focus pose", () => {
    const overview = createDesktopCameraPose(16 / 9, "overview");
    const content = createDesktopCameraPose(16 / 9, "content");

    expect(overview.position.z).toBeGreaterThanOrEqual(13.4);
    expect(overview.position.z).toBeLessThanOrEqual(14.2);
    expect(content.position.z).toBeLessThan(overview.position.z - 1.2);
    expect(content.position.z).toBeGreaterThanOrEqual(11.4);
    expect(content.position.z).toBeLessThanOrEqual(12.2);
    expect(content.target.x).toBeCloseTo(DESK_LAYOUT.mainMonitor.screen.position.x, 1);
    expect(content.target.y).toBeCloseTo(DESK_LAYOUT.mainMonitor.screen.position.y, 1);

    const compactOverview = createDesktopCameraPose(1440 / 900, "overview");
    expect(compactOverview.position.z).toBeGreaterThanOrEqual(14.7);
    expect(compactOverview.position.z).toBeLessThanOrEqual(15.4);
  });

  it("keeps reduced-motion users on the stable overview camera", () => {
    expect(resolveDesktopCameraMode(false, true)).toBe("overview");
    expect(resolveDesktopCameraMode(true, true)).toBe("overview");
    expect(resolveDesktopCameraMode(false, false)).toBe("overview");
    expect(resolveDesktopCameraMode(true, false)).toBe("content");
  });

  it("makes the two displays the dominant composition", () => {
    expect(DESK_LAYOUT.mainMonitor.frame.size.width).toBeGreaterThanOrEqual(8.2);
    expect(DESK_LAYOUT.mainMonitor.screen.size.width).toBeGreaterThanOrEqual(7.8);
    expect(DESK_LAYOUT.leftMonitor.frame.size.width).toBeGreaterThanOrEqual(2.5);
    expect(
      DESK_LAYOUT.mainMonitor.screen.size.width / DESK_LAYOUT.leftMonitor.screen.size.width,
    ).toBeGreaterThan(3);
  });

  it("keeps screen typography readable after projection into the scene", () => {
    expect(MAIN_SCREEN_TYPOGRAPHY.homeTitle).toBeGreaterThanOrEqual(78);
    expect(MAIN_SCREEN_TYPOGRAPHY.homeBody).toBeGreaterThanOrEqual(28);
    expect(MAIN_SCREEN_TYPOGRAPHY.listItemTitle).toBeGreaterThanOrEqual(28);
    expect(MAIN_SCREEN_TYPOGRAPHY.listItemDescription).toBeGreaterThanOrEqual(20);
  });

  it("integrates mat tools without recreating four dominant black blocks", () => {
    expect(DESK_LAYOUT.matControls.button.size.width).toBeLessThanOrEqual(0.72);
    expect(DESK_LAYOUT.matControls.button.size.height).toBeLessThanOrEqual(0.11);
  });

  it("keeps the desk edge and toy frame subordinate to the screens", () => {
    expect(DESK_LAYOUT.desk.apron.size.height).toBeLessThanOrEqual(0.35);
    expect(DESK_LAYOUT.decorations.toy.backing.size.width).toBeLessThanOrEqual(1);
    expect(DESK_LAYOUT.decorations.toy.screen.size.width).toBeLessThanOrEqual(0.92);
  });

  it("uses a readable, low-contrast screen button instead of a black block", () => {
    expect(MAIN_SCREEN_BUTTON.fontSize).toBeGreaterThanOrEqual(26);
    expect(MAIN_SCREEN_BUTTON.background).not.toBe("#000000");
    expect(MAIN_SCREEN_BUTTON.foreground).not.toBe(MAIN_SCREEN_BUTTON.background);
  });

  it("avoids the deprecated soft-shadow alias that emits a browser warning", () => {
    expect(rendererSource).not.toContain("PCFSoftShadowMap");
    expect(rendererSource).toContain("PCFShadowMap");
  });
});
