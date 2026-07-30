import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import {
  basename,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const MAX_DESKTOP_MODEL_BYTES = 3_000_000;

const MODEL_SOURCE_TYPES = new Set([
  "licensed-external",
  "repository-generated",
  "user-photo-generated",
]);
const FORWARD_AXES = new Set(["+X", "-X", "+Z", "-Z"]);
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const toPath = (value) =>
  value instanceof URL ? fileURLToPath(value) : String(value);

const isOutsideDirectory = (relativePath) =>
  relativePath === ".." ||
  relativePath.startsWith(`..${sep}`) ||
  isAbsolute(relativePath);

const isNonEmptyString = (value) =>
  typeof value === "string" && value.trim().length > 0;

const isIsoDate = (value) => {
  if (!isNonEmptyString(value) || !DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
};

const isHttpsUrl = (value) => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

const hasExactRegularFile = (directory, fileName) => {
  if (!existsSync(directory) || !readdirSync(directory).includes(fileName)) {
    return false;
  }
  const path = join(directory, fileName);
  const metadata = lstatSync(path);
  return !metadata.isSymbolicLink() && metadata.isFile();
};

const listModelDirectory = (directory) => {
  if (!existsSync(directory)) return { glbFiles: [], unsafeLinks: [] };

  const glbFiles = [];
  const unsafeLinks = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    const metadata = lstatSync(path);
    if (metadata.isSymbolicLink()) {
      unsafeLinks.push(entry.name);
      continue;
    }
    if (metadata.isFile() && extname(entry.name).toLowerCase() === ".glb") {
      glbFiles.push(entry.name);
    }
  }
  return { glbFiles, unsafeLinks };
};

export const loadDesktopModelManifest = (modelsDirectory) => {
  const directory = toPath(modelsDirectory);
  return JSON.parse(readFileSync(join(directory, "manifest.json"), "utf8"));
};

export function findDesktopModelIssues({ modelsDirectory, manifest }) {
  const directory = resolve(toPath(modelsDirectory));
  const issues = [];
  const addIssue = (code, model, detail) => {
    issues.push({
      code,
      model: model?.id ?? null,
      file: model?.file ?? "manifest.json",
      detail,
    });
  };

  const { glbFiles, unsafeLinks } = listModelDirectory(directory);
  for (const file of unsafeLinks) {
    issues.push({
      code: "unsafe-model-link",
      model: null,
      file,
      detail: "Symbolic links and junctions are not allowed",
    });
  }

  if (
    !manifest ||
    manifest.version !== 1 ||
    !Array.isArray(manifest.models)
  ) {
    addIssue(
      "invalid-manifest",
      null,
      "Manifest must use version 1 and contain a models array",
    );
    return issues;
  }

  const seenIds = new Set();
  const seenPreviewQueries = new Set();
  const listedFiles = new Set();

  for (const model of manifest.models) {
    if (!model || typeof model !== "object") {
      addIssue("invalid-model-entry", null, "Model entry must be an object");
      continue;
    }

    if (!isNonEmptyString(model.id) || !ID_PATTERN.test(model.id)) {
      addIssue(
        "invalid-model-id",
        model,
        "Model id must be lowercase kebab-case",
      );
    } else if (seenIds.has(model.id)) {
      addIssue("duplicate-id", model, `Duplicate model id: ${model.id}`);
    } else {
      seenIds.add(model.id);
    }

    if (!isNonEmptyString(model.object) || !ID_PATTERN.test(model.object)) {
      addIssue(
        "invalid-object-id",
        model,
        "Object id must be lowercase kebab-case",
      );
    }

    const fileIsLocal =
      isNonEmptyString(model.file) &&
      basename(model.file) === model.file &&
      !isOutsideDirectory(relative(directory, resolve(directory, model.file)));
    if (!fileIsLocal) {
      addIssue(
        "invalid-model-path",
        model,
        "Model file must be a direct child of the desktop model directory",
      );
    } else {
      listedFiles.add(model.file);
      if (extname(model.file).toLowerCase() !== ".glb") {
        addIssue(
          "invalid-model-extension",
          model,
          "Desktop model assets must use the .glb extension",
        );
      }
      if (!hasExactRegularFile(directory, model.file)) {
        addIssue(
          "missing-model-file",
          model,
          "Model file is missing, has different casing, or is not a regular file",
        );
      }
    }

    const provenance = model.provenance;
    if (
      !provenance ||
      !MODEL_SOURCE_TYPES.has(provenance.sourceType) ||
      !isNonEmptyString(provenance.tool) ||
      !isNonEmptyString(provenance.inputRights) ||
      !isNonEmptyString(provenance.license)
    ) {
      addIssue(
        "missing-provenance",
        model,
        "Source type, tool, input rights, and license are required",
      );
    }
    if (!isIsoDate(provenance?.generatedAt)) {
      addIssue(
        "invalid-generated-date",
        model,
        "Generation date must be a real YYYY-MM-DD date",
      );
    }
    if (
      provenance?.sourceUrl !== undefined &&
      !isHttpsUrl(provenance.sourceUrl)
    ) {
      addIssue(
        "invalid-source-url",
        model,
        "External source URLs must use HTTPS",
      );
    }

    const geometry = model.geometry;
    if (
      !geometry ||
      geometry.upAxis !== "Y" ||
      !FORWARD_AXES.has(geometry.forwardAxis) ||
      !isNonEmptyString(geometry.origin) ||
      geometry.unit !== "meter" ||
      !Number.isFinite(geometry.sceneScale) ||
      geometry.sceneScale <= 0
    ) {
      addIssue(
        "invalid-geometry-contract",
        model,
        "Geometry must use Y-up meters with a horizontal forward axis, named origin, and positive scene scale",
      );
    }

    if (
      !Number.isInteger(model.budgetBytes) ||
      model.budgetBytes <= 0 ||
      model.budgetBytes > MAX_DESKTOP_MODEL_BYTES
    ) {
      addIssue(
        "invalid-model-budget",
        model,
        `Budget must be an integer between 1 and ${MAX_DESKTOP_MODEL_BYTES}`,
      );
    } else if (
      fileIsLocal &&
      hasExactRegularFile(directory, model.file) &&
      statSync(join(directory, model.file)).size > model.budgetBytes
    ) {
      addIssue(
        "model-over-budget",
        model,
        `Model exceeds its ${model.budgetBytes}-byte budget`,
      );
    }

    if (typeof model.defaultEnabled !== "boolean") {
      addIssue(
        "invalid-default-state",
        model,
        "defaultEnabled must be a boolean",
      );
    }
    const acceptedDefault =
      model.approval?.status === "accepted" &&
      isIsoDate(model.approval?.approvedAt) &&
      isNonEmptyString(model.approval?.approvedBy);
    if (model.defaultEnabled === true && !acceptedDefault) {
      addIssue(
        "unapproved-default-model",
        model,
        "A default model requires explicit acceptance metadata",
      );
    }

    if (!isNonEmptyString(model.previewQuery)) {
      addIssue(
        "missing-preview-query",
        model,
        "Every candidate needs an explicit preview query",
      );
    } else if (seenPreviewQueries.has(model.previewQuery)) {
      addIssue(
        "duplicate-preview-query",
        model,
        `Duplicate preview query: ${model.previewQuery}`,
      );
    } else {
      seenPreviewQueries.add(model.previewQuery);
    }
  }

  for (const file of glbFiles) {
    if (!listedFiles.has(file)) {
      issues.push({
        code: "unlisted-model-file",
        model: null,
        file,
        detail: "Every GLB in the public model directory must be listed",
      });
    }
  }

  return issues;
}

const run = () => {
  const modelsDirectory = join(process.cwd(), "public", "models", "desktop");
  let manifest;
  try {
    manifest = loadDesktopModelManifest(modelsDirectory);
  } catch (error) {
    console.error(
      `Desktop model check failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    process.exitCode = 1;
    return;
  }

  const issues = findDesktopModelIssues({ modelsDirectory, manifest });
  if (issues.length === 0) {
    console.log(
      `Desktop model check passed: ${manifest.models.length} listed model asset(s).`,
    );
    return;
  }

  console.error(`Desktop model check failed with ${issues.length} issue(s).`);
  console.table(issues);
  process.exitCode = 1;
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  run();
}
