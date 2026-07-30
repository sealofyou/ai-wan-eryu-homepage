import { describe, expect, it } from "vitest";
import {
  createDesktopContentItem,
  filterNotesByType,
  getPublicProjectUpdates,
  serializeDesktopContentPayload,
  sortByDateDesc,
  sortProjectUpdatesByDateDesc,
} from "../src/lib/content";

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

describe("sortProjectUpdatesByDateDesc", () => {
  it("returns only public updates for one project in newest-first order", () => {
    const updates = [
      {
        id: "architecture",
        data: {
          date: new Date("2026-07-30"),
          projectId: "homepage",
          draft: false,
        },
      },
      {
        id: "visual-baseline",
        data: {
          date: new Date("2026-07-29"),
          projectId: "homepage",
          draft: false,
        },
      },
      {
        id: "model-pipeline",
        data: {
          date: new Date("2026-07-31"),
          projectId: "homepage",
          draft: false,
        },
      },
      {
        id: "private-note",
        data: {
          date: new Date("2026-08-01"),
          projectId: "homepage",
          draft: true,
        },
      },
      {
        id: "other-project",
        data: {
          date: new Date("2026-08-02"),
          projectId: "another-project",
          draft: false,
        },
      },
    ];

    expect(getPublicProjectUpdates(updates, "homepage").map(({ id }) => id)).toEqual([
      "model-pipeline",
      "architecture",
      "visual-baseline",
    ]);
    expect(updates.map(({ id }) => id)).toEqual([
      "architecture",
      "visual-baseline",
      "model-pipeline",
      "private-note",
      "other-project",
    ]);
    expect(sortProjectUpdatesByDateDesc(updates.slice(0, 3)).map(({ id }) => id)).toEqual([
      "model-pipeline",
      "architecture",
      "visual-baseline",
    ]);
  });
});

describe("desktop content serialization", () => {
  it("creates public desktop records only when a complete target exists", () => {
    const publicItem = createDesktopContentItem("articles", {
      id: "public-article",
      data: {
        title: "Public article",
        description: "List summary",
        preview: "Monitor preview",
        date: new Date("2026-07-23"),
        category: "AI",
        draft: false,
        featured: true,
        target: "feishu",
        externalUrl: "https://my.feishu.cn/wiki/public",
      },
    });
    const draft = createDesktopContentItem("articles", {
      id: "draft-article",
      data: {
        title: "Draft",
        description: "Draft",
        preview: "Draft",
        date: new Date("2026-07-23"),
        draft: true,
        featured: false,
        target: "feishu",
        externalUrl: "https://my.feishu.cn/wiki/draft",
      },
    });
    const missingTarget = createDesktopContentItem("articles", {
      id: "missing-target",
      data: {
        title: "Missing",
        description: "Missing",
        preview: "Missing",
        date: new Date("2026-07-23"),
        draft: false,
        featured: false,
      },
    });

    expect(publicItem).toMatchObject({
      id: "public-article",
      section: "articles",
      date: "2026-07-23",
      target: "feishu",
      featured: true,
    });
    expect(draft).toBeNull();
    expect(missingTarget).toBeNull();
  });

  it("escapes script-closing characters in the homepage payload", () => {
    expect(
      serializeDesktopContentPayload({
        items: [
          {
            id: "safe",
            section: "articles",
            title: "</script><script>alert(1)</script>",
            description: "safe",
            preview: "safe",
            date: "2026-07-23",
            target: "internal",
            internalUrl: "/articles/safe/",
            featured: false,
          },
        ],
      }),
    ).not.toContain("</script>");
  });
});
