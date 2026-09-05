import { describe, expect, it } from "vitest";
import { resolveDesktopFinish } from "../src/desktop/core/finish-mode";

describe("isolated material demo", () => {
  it("keeps the current homepage as the default", () => {
    for (const search of ["", "?mouse=glb", "?finish=unknown", "?finish="]) {
      expect(resolveDesktopFinish(search)).toBe("baseline");
    }
  });

  it("enables the studio finish only through its explicit preview URL", () => {
    expect(resolveDesktopFinish("?finish=studio")).toBe("studio");
    expect(resolveDesktopFinish("?mouse=glb&finish=studio")).toBe("studio");
    expect(resolveDesktopFinish("?finish=Studio")).toBe("baseline");
  });
});
