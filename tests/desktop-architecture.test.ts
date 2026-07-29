import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const scenePath = new URL("../src/desktop/scene.ts", import.meta.url);
const canvasUtilsPath = new URL(
  "../src/desktop/screens/canvas-utils.ts",
  import.meta.url,
);

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
});
