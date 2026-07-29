import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const scenePath = new URL("../src/desktop/scene.ts", import.meta.url);
const canvasUtilsPath = new URL(
  "../src/desktop/screens/canvas-utils.ts",
  import.meta.url,
);
const screenModulePaths = [
  "main-screen.ts",
  "side-screen.ts",
  "note-screen.ts",
  "message-board.ts",
].map((fileName) => new URL(`../src/desktop/screens/${fileName}`, import.meta.url));
const actionModulePath = new URL("../src/desktop/core/actions.ts", import.meta.url);
const typeModulePath = new URL("../src/desktop/core/types.ts", import.meta.url);
const rendererModulePath = new URL("../src/desktop/core/renderer.ts", import.meta.url);
const assetsModulePath = new URL("../src/desktop/core/assets.ts", import.meta.url);

describe("desktop scene architecture", () => {
  it("delegates reusable canvas drawing helpers to the screens layer", () => {
    expect(existsSync(canvasUtilsPath)).toBe(true);

    const sceneSource = readFileSync(scenePath, "utf8");
    expect(sceneSource).toContain('from "./screens/canvas-utils"');
    expect(sceneSource).not.toContain("const makeCanvas =");
    expect(sceneSource).not.toContain("const roundRect =");
    expect(sceneSource).not.toContain("const wrapText =");
    expect(sceneSource).not.toContain("const truncateToWidth =");
    expect(sceneSource).not.toContain("const drawImageCover =");
  });

  it("delegates monitor and paper-surface rendering to focused screen modules", () => {
    screenModulePaths.forEach((modulePath) => {
      expect(existsSync(modulePath)).toBe(true);
    });

    const sceneSource = readFileSync(scenePath, "utf8");
    expect(sceneSource).toContain('from "./screens/main-screen"');
    expect(sceneSource).toContain('from "./screens/side-screen"');
    expect(sceneSource).toContain('from "./screens/note-screen"');
    expect(sceneSource).toContain('from "./screens/message-board"');
    expect(sceneSource).not.toContain("const drawBadgeScreen =");
    expect(sceneSource).not.toContain("const drawContentList =");
    expect(sceneSource).not.toContain("const drawContentPreview =");
  });

  it("delegates scene action metadata and shared object contracts to core modules", () => {
    expect(existsSync(actionModulePath)).toBe(true);
    expect(existsSync(typeModulePath)).toBe(true);

    const sceneSource = readFileSync(scenePath, "utf8");
    expect(sceneSource).toContain('from "./core/actions"');
    expect(sceneSource).toContain('from "./core/types"');
    expect(sceneSource).not.toContain("type SceneAction =");
    expect(sceneSource).not.toContain("const addAction =");
    expect(sceneSource).not.toContain("const actionFromObject =");
  });

  it("delegates WebGL setup, camera framing, fixed lights, and image creation to core", () => {
    expect(existsSync(rendererModulePath)).toBe(true);
    expect(existsSync(assetsModulePath)).toBe(true);

    const sceneSource = readFileSync(scenePath, "utf8");
    expect(sceneSource).toContain('from "./core/renderer"');
    expect(sceneSource).toContain('from "./core/assets"');
    expect(sceneSource).not.toContain("new THREE.WebGLRenderer");
    expect(sceneSource).not.toContain("const getFramedCamera =");
    expect(sceneSource).not.toContain("const resize =");
    expect(sceneSource).not.toContain("const screenLight =");
    expect(sceneSource).not.toContain("const keyLight =");
    expect(sceneSource).not.toContain("new Image()");
  });
});
