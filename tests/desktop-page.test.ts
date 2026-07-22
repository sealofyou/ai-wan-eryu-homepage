import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(new URL("../src/pages/index.astro", import.meta.url), "utf8");
const scenePath = new URL("../src/desktop/scene.ts", import.meta.url);

describe("desktop homepage structure", () => {
  it("mounts an immersive desktop with keyboard-accessible interaction entry points", () => {
    expect(pageSource).toContain("data-desktop-root");
    expect(pageSource).toContain("07.04 分享");
    expect(pageSource).toContain("07.18 活动");
    expect(pageSource).toContain("最近在做");
    expect(pageSource).toContain("更换每日格言");
    expect(pageSource).toContain("打开徽章故事");
    expect(pageSource).toContain("桌面版体验准备中");
  });

  it("uses Three.js, canvas screen textures, raycasting, and reduced-motion support", () => {
    const sceneSource = readFileSync(scenePath, "utf8");

    expect(sceneSource).toContain("WebGLRenderer");
    expect(sceneSource).toContain("CanvasTexture");
    expect(sceneSource).toContain("Raycaster");
    expect(sceneSource).toContain("prefers-reduced-motion");
    expect(sceneSource).toContain("webgl-fallback");
  });
});
