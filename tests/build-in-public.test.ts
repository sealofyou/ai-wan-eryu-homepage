import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { resolveContentUrl } from "../src/desktop/content";
import {
  createDesktopContentItem,
  getPublicProjectUpdates,
} from "../src/lib/content";

const readOptional = (relativePath: string) => {
  const url = new URL(`../${relativePath}`, import.meta.url);
  return existsSync(fileURLToPath(url)) ? readFileSync(url, "utf8") : "";
};

const contentConfig = readOptional("src/content.config.ts");
const homepage = readOptional("src/pages/index.astro");
const projectPage = readOptional("src/pages/projects/[id].astro");
const mainScreen = readOptional("src/desktop/screens/main-screen.ts");
const project = readOptional(
  "src/content/projects/personal-homepage-build-in-public.md",
);
const updatesDirectory = fileURLToPath(
  new URL("../src/content/project-updates", import.meta.url),
);
const updateFiles = existsSync(updatesDirectory)
  ? readdirSync(updatesDirectory).filter((name) => name.endsWith(".md"))
  : [];

const parseFrontmatter = <T>(source: string): T => {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) throw new Error("Markdown file is missing frontmatter");
  return parse(match[1]) as T;
};

type ProjectFrontmatter = {
  title: string;
  description: string;
  date: string;
  draft: boolean;
  featured: boolean;
  phase: string;
  preview: string;
  category: string;
  target: "internal";
  internalUrl: string;
  results: Array<{ label: string; value: string }>;
};

type UpdateFrontmatter = {
  date: string;
  projectId: string;
  draft: boolean;
};

describe("Build in Public content contract", () => {
  it("defines separate project and project update collections", () => {
    expect(contentConfig).toContain("const projects = defineCollection");
    expect(contentConfig).toContain("const projectUpdates = defineCollection");
    expect(contentConfig).toContain("Public URLs must use HTTPS");
    expect(contentConfig).toContain("Internal URLs must be root-relative");
    expect(contentConfig).toContain(
      "export const collections = { articles, notes, projects, projectUpdates }",
    );
  });

  it("publishes one internal featured personal-homepage project", () => {
    const data = parseFrontmatter<ProjectFrontmatter>(project);
    const item = createDesktopContentItem("recent", {
      id: "personal-homepage-build-in-public",
      data: {
        ...data,
        date: new Date(data.date),
      },
    });

    expect(data).toMatchObject({
      title: "个人主页实现｜Build in Public",
      draft: false,
      featured: true,
      phase: "发布候选",
      target: "internal",
      internalUrl: "/projects/personal-homepage-build-in-public/",
    });
    expect(data.preview).toContain("发布候选");
    expect(data.results).toHaveLength(4);
    expect(data.results).toContainEqual({
      label: "当前测试",
      value: "107 项通过",
    });
    expect(item).not.toBeNull();
    expect(resolveContentUrl(item!)).toBe(
      "/projects/personal-homepage-build-in-public/",
    );
  });

  it("keeps the first public timeline factual and free of local or secret placeholders", () => {
    expect(updateFiles.length).toBeGreaterThanOrEqual(5);
    expect(updateFiles).toContain(
      "2026-07-31-release-candidate-hardening.md",
    );
    expect(updateFiles).toContain(
      "2026-07-31-model-intake-gate.md",
    );

    const updateSources = updateFiles.map((name) =>
      readOptional(`src/content/project-updates/${name}`),
    );
    const updateEntries = updateSources.map((source, index) => {
      const data = parseFrontmatter<UpdateFrontmatter>(source);
      return {
        id: updateFiles[index],
        data: {
          ...data,
          date: new Date(data.date),
        },
      };
    });
    const projectId = "personal-homepage-build-in-public";
    const publicUpdates = getPublicProjectUpdates(
      [
        ...updateEntries,
        {
          id: "draft.md",
          data: {
            date: new Date("2026-08-02"),
            projectId,
            draft: true,
          },
        },
        {
          id: "other-project.md",
          data: {
            date: new Date("2026-08-03"),
            projectId: "other-project",
            draft: false,
          },
        },
      ],
      projectId,
    );
    const publicContent = [project, ...updateSources].join("\n");

    expect(publicUpdates).toHaveLength(updateFiles.length);
    expect(publicUpdates.every(({ data }) => data.projectId === projectId)).toBe(true);
    expect(publicUpdates.every(({ data }) => !data.draft)).toBe(true);
    expect(publicUpdates.map(({ data }) => data.date.getTime())).toEqual(
      [...updateEntries]
        .sort((a, b) => b.data.date.getTime() - a.data.date.getTime())
        .map(({ data }) => data.date.getTime()),
    );

    expect(publicContent).not.toMatch(
      /[A-Z]:\\|\/Users\/|\/home\/|localhost|127\.0\.0\.1/,
    );
    expect(publicContent).not.toMatch(
      /\b(?:api[_ -]?key|access[_ -]?token|password|secret)\b\s*[:=]/i,
    );
    expect(publicContent).not.toContain("内容整理中");
    expect(publicContent).not.toContain("待确认");
  });

  it("maps public projects into the existing recent desktop section", () => {
    expect(homepage).toContain('getCollection("projects"');
    expect(homepage).toContain('createDesktopContentItem("recent"');
  });

  it("provides a dedicated project route and project-specific desktop action", () => {
    expect(projectPage).toMatch(/getCollection\(\s*"projectUpdates"/);
    expect(projectPage).toContain("getPublicProjectUpdates");
    expect(projectPage).not.toContain("<dt>场景入口</dt>");
    expect(mainScreen).toMatch(
      /item\.section === "recent"[\s\S]*?\? "查看项目"/,
    );
  });
});
