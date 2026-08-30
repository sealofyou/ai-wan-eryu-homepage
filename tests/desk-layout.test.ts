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
const pegboardObjectSource = readFileSync(
  new URL("../src/desktop/objects/pegboards.ts", import.meta.url),
  "utf8",
);
const mouseObjectSource = readFileSync(
  new URL("../src/desktop/objects/mouse.ts", import.meta.url),
  "utf8",
);

describe("approved desktop composition layout", () => {
  it("keeps the side screen readable instead of narrowing it with perspective", () => {
    expect(DESK_LAYOUT.leftMonitor.yaw).toBeGreaterThan(0.16);
    expect(DESK_LAYOUT.leftMonitor.yaw).toBeLessThan(0.34);
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

  it("uses one compact pegboard behind the lamp instead of a second empty wall", () => {
    expect("large" in DESK_LAYOUT.pegboards).toBe(false);
    expect(DESK_LAYOUT.pegboards.small.width).toBeLessThan(2.5);
    expect(DESK_LAYOUT.pegboards.small.x).toBeGreaterThan(5.5);
    expect(pegboardObjectSource).not.toContain("angledPegboard");
    expect(pegboardObjectSource).not.toContain("largeBoard");
    expect(sceneSource).toContain("messageBoardCanvas");
  });

  it("keeps the message interaction on the physical mat instead of the main screen", () => {
    expect(sceneSource).not.toContain("桌面留言：${state.message}");
    expect(sceneSource).not.toContain("const note = DESK_LAYOUT.matMessage");
    expect(sceneSource).not.toContain('context.fillText("留言板"');
    expect(sceneSource).toContain('"message"');
    expect(sceneSource).toContain("messageInput.focus()");
  });

  it("keeps invisible screen hit targets out of the rendered color and depth buffers", () => {
    expect(monitorObjectSource).toContain("colorWrite: false");
    expect(monitorObjectSource).toContain("depthWrite: false");
    expect(monitorObjectSource).toContain("depthTest: false");
  });

  it("preserves the portrait image ratio and gives the mouse gaming details", () => {
    expect(canvasUtilsSource).toContain("export const drawImageCover = (");
    expect(mainScreenSource).toContain("drawImageCover(context, avatarImage");
    expect(mouseObjectSource).toContain("const rearHump");
    expect(mouseObjectSource).toContain("const dpiButton");
    expect(mouseObjectSource).toContain("const sideButton");
    expect(mouseObjectSource).toContain("const mouseLogo");
    expect(deskObjectSource).toContain("const deskApron");
  });
});
