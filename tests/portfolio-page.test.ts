import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  getProjectCover,
  getPublicProjects,
} from "../src/lib/content";

const portfolioSource = readFileSync(
  new URL("../src/pages/portfolio.astro", import.meta.url),
  "utf8",
);
const contentConfig = readFileSync(
  new URL("../src/content.config.ts", import.meta.url),
  "utf8",
);
const globalStyles = readFileSync(
  new URL("../src/styles/global.css", import.meta.url),
  "utf8",
);
const featuredProject = readFileSync(
  new URL(
    "../src/content/projects/personal-homepage-build-in-public.md",
    import.meta.url,
  ),
  "utf8",
);

describe("portfolio project index", () => {
  it("filters drafts and orders featured projects before recent projects", () => {
    const entries = [
      {
        id: "recent",
        data: {
          draft: false,
          featured: false,
          updated: new Date("2026-07-31"),
        },
      },
      {
        id: "featured",
        data: {
          draft: false,
          featured: true,
          updated: new Date("2026-07-20"),
        },
      },
      {
        id: "draft",
        data: {
          draft: true,
          featured: true,
          updated: new Date("2026-08-01"),
        },
      },
    ] as const;

    expect(getPublicProjects(entries).map(({ id }) => id)).toEqual([
      "featured",
      "recent",
    ]);
    expect(entries.map(({ id }) => id)).toEqual([
      "recent",
      "featured",
      "draft",
    ]);
  });

  it("uses the public project collection instead of static placeholder rows", () => {
    expect(portfolioSource).toContain('getCollection("projects"');
    expect(portfolioSource).toContain("getPublicProjects");
    expect(portfolioSource).toContain("project.data.internalUrl");
    expect(portfolioSource).not.toContain("../data/projects");
  });

  it("puts a real project in the first viewport without the old poster hero", () => {
    expect(portfolioSource).toContain('class="portfolio-intro"');
    expect(portfolioSource).toContain('"portfolio-feature"');
    expect(portfolioSource).toContain('class="portfolio-index"');
    expect(portfolioSource).toContain('split("｜", 2)');
    expect(portfolioSource).toContain('class="portfolio-feature-title-note"');
    expect(portfolioSource).not.toContain("portfolio-hero");
    expect(portfolioSource).not.toContain("portfolio-cover");
    expect(portfolioSource).not.toContain("techCover");
  });

  it("supports an optional real cover without requiring placeholder artwork", () => {
    expect(contentConfig).toContain("cover: internalPath.optional()");
    expect(contentConfig).toContain("coverAlt: z.string().optional()");
    expect(contentConfig).toContain(
      "Project cover and coverAlt must be provided together",
    );
    expect(featuredProject).toContain(
      'cover: "/portfolio/personal-homepage-desktop.webp"',
    );
    expect(featuredProject).toContain(
      'coverAlt: "AI玩尔玉个人主页的 3D 电脑桌面"',
    );
  });

  it("uses a text-only featured layout when a project has no complete cover", () => {
    expect(getProjectCover({})).toBeNull();
    expect(
      getProjectCover({
        cover: "/portfolio/demo.webp",
      }),
    ).toBeNull();
    expect(
      getProjectCover({
        cover: "/portfolio/demo.webp",
        coverAlt: "项目截图",
      }),
    ).toEqual({
      src: "/portfolio/demo.webp",
      alt: "项目截图",
    });
    expect(portfolioSource).toContain('"is-text-only": !featuredCover');
    expect(portfolioSource).toContain("{featuredCover && (");
  });

  it("keeps existing content-page heading scales outside the portfolio", () => {
    expect(globalStyles).toMatch(
      /\.soft-page-hero h1,[\s\S]{0,220}?font-size: clamp\(46px, 6vw, 76px\);/,
    );
  });
});
