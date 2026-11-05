import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// 备案号必须出现在每一个公开页面底部。去掉过一次，收到过整改通知。
const ICP = "豫ICP备2024077892号-2";
const root = fileURLToPath(new URL("..", import.meta.url));

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : full.endsWith(".astro") ? [full] : [];
  });

describe("ICP filing number", () => {
  it("is rendered by both page layouts", () => {
    expect(readFileSync(join(root, "src/components/SiteFooter.astro"), "utf8")).toContain(ICP);
    expect(readFileSync(join(root, "src/layouts/HomeLayout.astro"), "utf8")).toContain(ICP);
    expect(readFileSync(join(root, "src/layouts/SiteLayout.astro"), "utf8")).toContain("<SiteFooter");
  });

  it("is reached from every page through one of those layouts", () => {
    const pages = walk(join(root, "src/pages"));
    expect(pages.length).toBeGreaterThan(0);
    for (const page of pages) {
      const source = readFileSync(page, "utf8");
      expect(/SiteLayout|HomeLayout/.test(source), page).toBe(true);
    }
  });
});
