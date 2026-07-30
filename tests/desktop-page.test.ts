import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(new URL("../src/pages/index.astro", import.meta.url), "utf8");
const scenePath = new URL("../src/desktop/scene.ts", import.meta.url);
const canvasUtilsPath = new URL(
  "../src/desktop/screens/canvas-utils.ts",
  import.meta.url,
);
const rendererPath = new URL("../src/desktop/core/renderer.ts", import.meta.url);
const pointerPath = new URL("../src/desktop/interactions/pointer.ts", import.meta.url);
const layoutSource = readFileSync(new URL("../src/layouts/SiteLayout.astro", import.meta.url), "utf8");
const faviconSource = readFileSync(new URL("../public/favicon.svg", import.meta.url), "utf8");

describe("desktop homepage structure", () => {
  it("mounts an immersive desktop with build-time public content", () => {
    expect(pageSource).toContain("data-desktop-root");
    expect(pageSource).toContain("data-desktop-content");
    expect(pageSource).toContain('getCollection("articles"');
    expect(pageSource).toContain('getCollection("notes"');
    expect(pageSource).toContain("mountDesktopScene(root, desktopContent)");
    expect(pageSource).toContain("文章");
    expect(pageSource).toContain("分享与活动");
    expect(pageSource).toContain("最近在做");
    expect(pageSource).toContain("桌面版体验准备中");
  });

  it("uses Three.js, canvas screen textures, raycasting, and reduced-motion support", () => {
    const sceneSource = readFileSync(scenePath, "utf8");
    const canvasUtilsSource = readFileSync(canvasUtilsPath, "utf8");
    const rendererSource = readFileSync(rendererPath, "utf8");
    const pointerSource = readFileSync(pointerPath, "utf8");

    expect(rendererSource).toContain("WebGLRenderer");
    expect(canvasUtilsSource).toContain("CanvasTexture");
    expect(pointerSource).toContain("Raycaster");
    expect(sceneSource).toContain("prefers-reduced-motion");
    expect(sceneSource).toContain("webgl-fallback");
  });

  it("cleans up animation, WebGL resources, and listeners when the page is replaced", () => {
    const sceneSource = readFileSync(scenePath, "utf8");

    expect(pageSource).toContain("const dispose = root ? mountDesktopScene(root, desktopContent) : undefined");
    expect(pageSource).toContain('window.addEventListener("pagehide", dispose, { once: true })');
    expect(pageSource).toContain("import.meta.hot?.dispose(dispose)");
    expect(sceneSource).toContain("cancelAnimationFrame(animationFrame)");
    expect(sceneSource).toContain("renderer.dispose()");
    expect(sceneSource).toContain("disposeObjectGraph(world)");
  });

  it("publishes the reusable angular E brand mark as browser icons", () => {
    expect(layoutSource).toContain('href="/brand/eryu-e-icon.svg" type="image/svg+xml"');
    expect(layoutSource).toContain('href="/brand/eryu-e-icon-32.png" type="image/png"');
    expect(layoutSource).toContain('rel="apple-touch-icon" href="/brand/eryu-e-icon-180.png"');
    expect(faviconSource).toContain('aria-label="Eryu angular E mark"');
    expect(faviconSource).toContain("#2fae99");
  });
});
