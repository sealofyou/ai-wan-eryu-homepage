import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { DESK_LAYOUT } from "../src/desktop/layout";

const sceneSource = readFileSync(new URL("../src/desktop/scene.ts", import.meta.url), "utf8");
const canvasUtilsSource = readFileSync(
  new URL("../src/desktop/screens/canvas-utils.ts", import.meta.url),
  "utf8",
);
const mainScreenSource = readFileSync(
  new URL("../src/desktop/screens/main-screen.ts", import.meta.url),
  "utf8",
);
const deskObjectSource = readFileSync(
  new URL("../src/desktop/objects/desk.ts", import.meta.url),
  "utf8",
);
const monitorObjectSource = readFileSync(
  new URL("../src/desktop/objects/monitors.ts", import.meta.url),
  "utf8",
);

describe("approved desktop composition layout", () => {
  it("turns the left monitor slightly toward the main viewing position", () => {
    expect(DESK_LAYOUT.leftMonitor.yaw).toBeGreaterThan(0.42);
    expect(DESK_LAYOUT.leftMonitor.yaw).toBeLessThan(0.58);
    expect(monitorObjectSource).toContain("sideMonitor.rotation.y = DESK_LAYOUT.leftMonitor.yaw");
    expect(monitorObjectSource).not.toContain("sideMonitor.rotation.z");
  });

  it("gives the left monitor a visible vertical support and stable foot", () => {
    expect(DESK_LAYOUT.leftMonitor.support.height).toBeGreaterThan(0.8);
    expect(DESK_LAYOUT.leftMonitor.support.footWidth).toBeGreaterThan(1.2);
    expect(DESK_LAYOUT.leftMonitor.support.topY).toBeGreaterThan(
      DESK_LAYOUT.leftMonitor.support.baseY,
    );
  });

  it("keeps the small pegboard and places a separate angled board on the desk edge", () => {
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
    expect(Math.abs(large.yaw)).toBeGreaterThan(1.5);
    expect(Math.abs(Math.abs(large.yaw) - Math.PI / 2)).toBeLessThan(0.01);
    expect(sceneSource).toContain("const angledPegboard = new THREE.Group()");
    expect(sceneSource).toContain("angledPegboard.rotation.y = DESK_LAYOUT.pegboards.large.yaw");
    expect(sceneSource).toContain("angledPegboard.add(largeBoard)");
    expect(sceneSource).toContain("angledPegboard.add(hole)");
    expect(sceneSource).toContain("messageBoardCanvas");
  });

  it("keeps the message interaction on the physical mat instead of the main screen", () => {
    expect(sceneSource).not.toContain("桌面留言：${state.message}");
    expect(sceneSource).not.toContain("const note = DESK_LAYOUT.matMessage");
    expect(sceneSource).not.toContain('context.fillText("留言板"');
    expect(sceneSource).toContain('"message"');
    expect(sceneSource).toContain("messageInput.focus()");
  });

  it("preserves the portrait image ratio and gives the mouse gaming details", () => {
    expect(canvasUtilsSource).toContain("export const drawImageCover = (");
    expect(mainScreenSource).toContain("drawImageCover(context, avatarImage, 48, 52, 440, 576)");
    expect(sceneSource).toContain("const rearHump");
    expect(sceneSource).toContain("const dpiButton");
    expect(sceneSource).toContain("const sideButton");
    expect(sceneSource).toContain("const mouseLogo");
    expect(deskObjectSource).toContain("const deskApron");
  });
});
