import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sceneSource = readFileSync(
  new URL("../src/desktop/scene.ts", import.meta.url),
  "utf8",
);
const sectionsSource = readFileSync(
  new URL("../src/desktop/screens/sections.ts", import.meta.url),
  "utf8",
);
const mainScreenSource = readFileSync(
  new URL("../src/desktop/screens/main-screen.ts", import.meta.url),
  "utf8",
);

describe("desktop screen content integration", () => {
  it("renders fixed sections instead of hard-coded event records", () => {
    expect(sceneSource).not.toContain("const activities");
    expect(sectionsSource).toContain('id: "articles"');
    expect(sectionsSource).toContain('id: "activities"');
    expect(sectionsSource).toContain('id: "recent"');
    expect(mainScreenSource).toContain("drawContentList");
    expect(mainScreenSource).toContain("drawContentPreview");
  });

  it("adds list, preview, back, paging and safe full-content actions", () => {
    expect(sceneSource).toContain("section:");
    expect(sceneSource).toContain("content:");
    expect(sceneSource).toContain('"content-back"');
    expect(sceneSource).toContain('"content-open"');
    expect(sceneSource).toContain('"page-prev"');
    expect(sceneSource).toContain('"page-next"');
    expect(sceneSource).toContain('window.open(targetUrl, "_blank", "noopener,noreferrer")');
  });
});
