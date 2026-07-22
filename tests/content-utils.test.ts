import { describe, expect, it } from "vitest";
import { filterNotesByType, sortByDateDesc } from "../src/lib/content";

const entries = [
  { data: { date: new Date("2026-05-31"), type: "share" } },
  { data: { date: new Date("2026-07-04"), type: "share" } },
  { data: { date: new Date("2026-06-13"), type: "project" } },
];

describe("sortByDateDesc", () => {
  it("returns newest entries first without mutating the source array", () => {
    const sorted = sortByDateDesc(entries);

    expect(sorted.map((entry) => entry.data.date.toISOString().slice(0, 10))).toEqual([
      "2026-07-04",
      "2026-06-13",
      "2026-05-31",
    ]);
    expect(entries[0].data.date.toISOString().slice(0, 10)).toBe("2026-05-31");
  });
});

describe("filterNotesByType", () => {
  it("returns all entries for the all filter", () => {
    expect(filterNotesByType(entries, "all")).toHaveLength(3);
  });

  it("returns only entries matching a note type", () => {
    expect(filterNotesByType(entries, "share")).toHaveLength(2);
    expect(filterNotesByType(entries, "activity")).toEqual([]);
  });
});
