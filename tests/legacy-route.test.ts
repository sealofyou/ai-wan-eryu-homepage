import { describe, expect, it } from "vitest";
import { legacyHashToPath } from "../src/lib/routes";

describe("legacyHashToPath", () => {
  it("maps prototype hashes to production routes", () => {
    expect(legacyHashToPath("#portfolio")).toBe("/portfolio/");
    expect(legacyHashToPath("#notes")).toBe("/notes/");
    expect(legacyHashToPath("#articles")).toBeNull();
    expect(legacyHashToPath("#method")).toBeNull();
    expect(legacyHashToPath("#about")).toBeNull();
  });

  it("returns null for unknown hashes", () => {
    expect(legacyHashToPath("#unknown")).toBeNull();
    expect(legacyHashToPath("")).toBeNull();
  });
});
