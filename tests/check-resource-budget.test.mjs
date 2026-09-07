import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { collectStaticJsClosure } from "../scripts/check-resource-budget.mjs";

const temporaryDirectories = [];

const createOutput = (files) => {
  const directory = mkdtempSync(join(tmpdir(), "eryu-resource-budget-"));
  temporaryDirectories.push(directory);

  for (const [relativePath, content] of Object.entries(files)) {
    const outputPath = join(directory, relativePath);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, content, "utf8");
  }

  return directory;
};

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("static JS closure budgets", () => {
  it("counts each static dependency once while ignoring dynamic imports", () => {
    const astroDirectory = createOutput({
      "entry.js": `
        import"./shared.js";
        import { value } from "./feature.js";
        import("./lazy.js");
        console.log(value);
      `,
      "feature.js": 'export{value}from"./export-only.js";',
      "export-only.js": 'export*from"./shared.js";',
      "shared.js": "export const value = 1;",
      "lazy.js": "export const lazy = true;",
    });

    const closure = collectStaticJsClosure({
      entryPath: join(astroDirectory, "entry.js"),
      rootDirectory: astroDirectory,
    });

    expect(closure.issues).toEqual([]);
    expect(closure.files.map(({ relativePath }) => relativePath).sort()).toEqual([
      "entry.js",
      "export-only.js",
      "feature.js",
      "shared.js",
    ]);
    expect(closure.bytes).toBe(
      closure.files.reduce((total, file) => total + file.bytes, 0),
    );
  });

  it("reports missing or escaping static dependencies instead of passing them silently", () => {
    const astroDirectory = createOutput({
      "entry.js": `
        import "./missing.js";
        export * from "../outside.js";
      `,
    });

    const closure = collectStaticJsClosure({
      entryPath: join(astroDirectory, "entry.js"),
      rootDirectory: astroDirectory,
    });

    expect(closure.issues.map(({ code }) => code).sort()).toEqual([
      "escaping-static-import",
      "missing-static-import",
    ]);
  });
});
