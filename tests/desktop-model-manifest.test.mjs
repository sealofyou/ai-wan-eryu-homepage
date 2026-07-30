import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  findDesktopModelIssues,
  loadDesktopModelManifest,
} from "../scripts/check-model-assets.mjs";

const temporaryDirectories = [];

const validModel = (overrides = {}) => ({
  id: "gaming-mouse-v0-5",
  object: "mouse",
  file: "gaming-mouse.glb",
  provenance: {
    sourceType: "repository-generated",
    tool: "Three.js GLTFExporter",
    generatedAt: "2026-07-31",
    inputRights: "Repository-owned procedural geometry; no external input.",
    license: "Project-owned asset.",
  },
  geometry: {
    upAxis: "Y",
    forwardAxis: "-Z",
    origin: "interaction-container-center",
    unit: "meter",
    sceneScale: 1,
  },
  budgetBytes: 500_000,
  defaultEnabled: false,
  approval: {
    status: "candidate",
  },
  previewQuery: "mouse=glb",
  ...overrides,
});

const createModelsDirectory = (files = {}) => {
  const directory = mkdtempSync(join(tmpdir(), "eryu-model-manifest-"));
  temporaryDirectories.push(directory);
  for (const [relativePath, content] of Object.entries(files)) {
    const outputPath = join(directory, relativePath);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, content);
  }
  return directory;
};

const codesFor = (modelsDirectory, models) =>
  findDesktopModelIssues({
    modelsDirectory,
    manifest: { version: 1, models },
  }).map(({ code }) => code);

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("desktop model asset manifest", () => {
  it("accepts the repository manifest and records the existing mouse as opt-in", () => {
    const modelsDirectory = new URL(
      "../public/models/desktop/",
      import.meta.url,
    );
    const manifest = loadDesktopModelManifest(modelsDirectory);
    const issues = findDesktopModelIssues({
      modelsDirectory,
      manifest,
    });

    expect(issues).toEqual([]);
    expect(manifest.models).toContainEqual(
      expect.objectContaining({
        file: "gaming-mouse.glb",
        defaultEnabled: false,
        previewQuery: "mouse=glb",
      }),
    );
  });

  it("rejects duplicate ids and object-preview selectors", () => {
    const directory = createModelsDirectory({
      "gaming-mouse.glb": Buffer.alloc(8),
      "gaming-mouse-alt.glb": Buffer.alloc(8),
    });
    const issues = findDesktopModelIssues({
      modelsDirectory: directory,
      manifest: {
        version: 1,
        models: [
          validModel(),
          validModel({
            file: "gaming-mouse-alt.glb",
          }),
        ],
      },
    });

    expect(issues.map(({ code }) => code)).toEqual(
      expect.arrayContaining(["duplicate-id", "duplicate-preview-query"]),
    );
  });

  it("rejects traversal, non-GLB files, missing files, and case mismatches", () => {
    const directory = createModelsDirectory({
      "gaming-mouse.glb": Buffer.alloc(8),
      "notes.txt": "not a model",
    });
    const codes = codesFor(directory, [
      validModel({ id: "escape", file: "../outside.glb" }),
      validModel({ id: "wrong-type", file: "notes.txt" }),
      validModel({ id: "missing", file: "missing.glb" }),
      validModel({ id: "wrong-case", file: "Gaming-Mouse.glb" }),
    ]);

    expect(codes).toEqual(
      expect.arrayContaining([
        "invalid-model-path",
        "invalid-model-extension",
        "missing-model-file",
      ]),
    );
  });

  it("requires complete provenance and HTTPS source links", () => {
    const directory = createModelsDirectory({
      "gaming-mouse.glb": Buffer.alloc(8),
    });
    const model = validModel({
      provenance: {
        sourceType: "user-photo-generated",
        tool: "",
        generatedAt: "07/31/2026",
        inputRights: "",
        license: "",
        sourceUrl: "http://example.com/model",
      },
    });
    const codes = codesFor(directory, [model]);

    expect(codes).toEqual(
      expect.arrayContaining([
        "missing-provenance",
        "invalid-generated-date",
        "invalid-source-url",
      ]),
    );
  });

  it("enforces coordinate, scale, and per-model byte budgets", () => {
    const directory = createModelsDirectory({
      "gaming-mouse.glb": Buffer.alloc(32),
    });
    const model = validModel({
      geometry: {
        upAxis: "Z",
        forwardAxis: "Y",
        origin: "",
        unit: "centimeter",
        sceneScale: 0,
      },
      budgetBytes: 16,
    });
    const codes = codesFor(directory, [model]);

    expect(codes).toEqual(
      expect.arrayContaining([
        "invalid-geometry-contract",
        "model-over-budget",
      ]),
    );
  });

  it("requires explicit acceptance metadata before a model can be default", () => {
    const directory = createModelsDirectory({
      "gaming-mouse.glb": Buffer.alloc(8),
    });
    const candidateCodes = codesFor(directory, [
      validModel({ defaultEnabled: true }),
    ]);
    const acceptedCodes = codesFor(directory, [
      validModel({
        defaultEnabled: true,
        approval: {
          status: "accepted",
          approvedAt: "2026-07-31",
          approvedBy: "eryu",
        },
      }),
    ]);

    expect(candidateCodes).toContain("unapproved-default-model");
    expect(acceptedCodes).not.toContain("unapproved-default-model");
  });

  it("rejects unlisted GLB files and every symlink or junction", () => {
    const directory = createModelsDirectory({
      "gaming-mouse.glb": Buffer.alloc(8),
      "unlisted.glb": Buffer.alloc(8),
    });
    const externalDirectory = createModelsDirectory({
      "external.glb": Buffer.alloc(8),
    });
    symlinkSync(
      externalDirectory,
      join(directory, "linked-models"),
      "junction",
    );

    const codes = codesFor(directory, [validModel()]);

    expect(codes).toContain("unlisted-model-file");
    expect(codes).toContain("unsafe-model-link");
  });

  it("keeps the model Gate in the full release command", () => {
    const packageJson = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    );

    expect(packageJson.scripts["check:models"]).toBe(
      "node scripts/check-model-assets.mjs",
    );
    expect(packageJson.scripts["verify:release"]).toContain(
      "npm run check:models",
    );
  });
});
