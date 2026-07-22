import { describe, expect, it } from "vitest";
import { createKeyboardLayout, keyboardExtents } from "../src/desktop/keyboard";

describe("full-size Eryu keyboard layout", () => {
  it("contains the five recognizable full-size keyboard clusters", () => {
    const layout = createKeyboardLayout();

    expect(new Set(layout.keys.map((key) => key.cluster))).toEqual(
      new Set(["function", "typing", "navigation", "arrows", "numpad"]),
    );
    expect(layout.keys.length).toBeGreaterThanOrEqual(100);
    expect(layout.keys.length).toBeLessThanOrEqual(110);
  });

  it("uses real wide-key proportions for the most recognizable keycaps", () => {
    const keys = new Map(createKeyboardLayout().keys.map((key) => [key.id, key]));

    expect(keys.get("space")?.width).toBe(6.25);
    expect(keys.get("backspace")?.width).toBe(2);
    expect(keys.get("enter")?.width).toBe(2.25);
    expect(keys.get("left-shift")?.width).toBe(2.25);
    expect(keys.get("right-shift")?.width).toBe(2.75);
    expect(keys.get("numpad-enter")?.depth).toBe(2);
  });

  it("keeps every key unique and inside the declared chassis", () => {
    const layout = createKeyboardLayout();
    const ids = layout.keys.map((key) => key.id);
    const extents = keyboardExtents(layout);

    expect(new Set(ids).size).toBe(ids.length);
    expect(extents.width).toBeLessThanOrEqual(layout.width);
    expect(extents.depth).toBeLessThanOrEqual(layout.depth);
  });

  it("reserves accent caps for the Eryu interaction anchors", () => {
    const keys = new Map(createKeyboardLayout().keys.map((key) => [key.id, key]));

    expect(keys.get("escape")?.tone).toBe("accent");
    expect(keys.get("enter")?.tone).toBe("accent");
    expect(keys.get("numpad-enter")?.tone).toBe("accent");
  });
});
