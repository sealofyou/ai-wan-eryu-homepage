import { describe, expect, it } from "vitest";
import {
  getContentPage,
  resolveContentUrl,
  sortDesktopItems,
  type DesktopContentItem,
} from "../src/desktop/content";

const item = (
  id: string,
  date: string,
  overrides: Partial<DesktopContentItem> = {},
): DesktopContentItem => ({
  id,
  section: "articles",
  title: id,
  date,
  description: `${id} description`,
  preview: `${id} preview`,
  target: "feishu",
  featured: false,
  externalUrl: `https://my.feishu.cn/wiki/${id}`,
  ...overrides,
});

describe("desktop content helpers", () => {
  it("sorts featured items first and then newest first without mutating input", () => {
    const items = [
      item("old", "2026-05-01"),
      item("featured", "2026-04-01", { featured: true }),
      item("new", "2026-07-01"),
    ];

    expect(sortDesktopItems(items).map(({ id }) => id)).toEqual([
      "featured",
      "new",
      "old",
    ]);
    expect(items.map(({ id }) => id)).toEqual(["old", "featured", "new"]);
  });

  it("returns bounded content pages", () => {
    const items = Array.from({ length: 9 }, (_, index) =>
      item(`item-${index}`, `2026-07-${String(index + 1).padStart(2, "0")}`),
    );

    expect(getContentPage(items, 0, 4).items).toHaveLength(4);
    expect(getContentPage(items, 2, 4)).toMatchObject({
      page: 2,
      pageCount: 3,
      items: [{ id: "item-8" }],
    });
    expect(getContentPage(items, 99, 4).page).toBe(2);
  });

  it("resolves only safe public targets", () => {
    expect(resolveContentUrl(item("feishu", "2026-07-01"))).toBe(
      "https://my.feishu.cn/wiki/feishu",
    );
    expect(
      resolveContentUrl(
        item("internal", "2026-07-01", {
          target: "internal",
          externalUrl: undefined,
          internalUrl: "/articles/internal/",
        }),
      ),
    ).toBe("/articles/internal/");
    expect(
      resolveContentUrl(
        item("unsafe", "2026-07-01", { externalUrl: "javascript:alert(1)" }),
      ),
    ).toBeNull();
  });
});
