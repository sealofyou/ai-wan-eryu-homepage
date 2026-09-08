import { describe, expect, it } from "vitest";
import { resolveDesktopPreview } from "../src/desktop/core/preview-options";

describe("unified desktop preview selection", () => {
  it("preserves the original no-query comparison", () => {
    expect(resolveDesktopPreview("")).toEqual({ full: false, mouse: "procedural", monitors: "baseline", keyboard: "baseline", matControls: true, studio: false });
  });
  it("keeps existing independent preview parameters", () => {
    expect(resolveDesktopPreview("?mouse=glb&keyboard=study&finish=studio")).toEqual({ full: false, mouse: "glb", monitors: "baseline", keyboard: "study", matControls: true, studio: true });
    expect(resolveDesktopPreview("?monitors=study").matControls).toBe(false);
  });
  it("enables the full accepted set and removes controls without a second finish owner", () => {
    expect(resolveDesktopPreview("?desktop=refined&monitors=baseline&mouse=glb&keyboard=baseline&finish=studio")).toEqual({ full: true, mouse: "study", monitors: "study", keyboard: "study", matControls: false, studio: false });
  });
});
