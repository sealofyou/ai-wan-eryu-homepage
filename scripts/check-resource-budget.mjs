import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import {
  dirname,
  isAbsolute,
  join,
  normalize,
  relative,
  resolve,
  sep,
} from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_DESKTOP_JS_CLOSURE_BUDGET = 625_000;

const isOutsideDirectory = (relativePath) =>
  relativePath === ".." ||
  relativePath.startsWith(`..${sep}`) ||
  isAbsolute(relativePath);

const toRelative = (from, to) => normalize(relative(from, to));

const findStaticJsSpecifiers = (source) => {
  const specifiers = [];
  const importPattern =
    /(?:^|[;\n])\s*import(?!\()\s*(?:[^;]*?\s*from\s*)?["']([^"']+)["']/g;
  const exportPattern =
    /(?:^|[;\n])\s*export\s*(?:\*|\{[^;]*?\})\s*from\s*["']([^"']+)["']/g;

  for (const match of source.matchAll(importPattern)) {
    specifiers.push(match[1]);
  }
  for (const match of source.matchAll(exportPattern)) {
    specifiers.push(match[1]);
  }

  return specifiers;
};

export function collectStaticJsClosure({ entryPath, rootDirectory }) {
  const root = resolve(rootDirectory);
  const pending = [resolve(entryPath)];
  const visited = new Set();
  const files = [];
  const issues = [];

  while (pending.length > 0) {
    const path = pending.pop();
    if (visited.has(path)) continue;
    visited.add(path);

    const relativePath = toRelative(root, path);
    if (isOutsideDirectory(relativePath)) {
      issues.push({
        code: "escaping-static-import",
        importer: null,
        specifier: relativePath,
        path,
      });
      continue;
    }
    if (!existsSync(path)) {
      issues.push({
        code: "missing-static-import",
        importer: null,
        specifier: relativePath,
        path,
      });
      continue;
    }

    const bytes = statSync(path).size;
    files.push({ path, relativePath, bytes });

    const source = readFileSync(path, "utf8");
    for (const specifier of findStaticJsSpecifiers(source)) {
      if (!specifier.startsWith("./") && !specifier.startsWith("../")) continue;

      const resolvedPath = resolve(dirname(path), specifier);
      const dependencyRelativePath = toRelative(root, resolvedPath);
      if (isOutsideDirectory(dependencyRelativePath)) {
        issues.push({
          code: "escaping-static-import",
          importer: relativePath,
          specifier,
          path: resolvedPath,
        });
        continue;
      }
      if (!existsSync(resolvedPath)) {
        issues.push({
          code: "missing-static-import",
          importer: relativePath,
          specifier,
          path: resolvedPath,
        });
        continue;
      }
      pending.push(resolvedPath);
    }
  }

  return {
    bytes: files.reduce((total, file) => total + file.bytes, 0),
    files,
    issues,
  };
}

const addBudget = (rows, root, label, path, maxBytes) => {
  if (!existsSync(path)) {
    rows.push({ label, path: relative(root, path), bytes: null, maxBytes, status: "missing" });
    return;
  }

  const bytes = statSync(path).size;
  rows.push({
    label,
    path: relative(root, path),
    bytes,
    maxBytes,
    status: bytes <= maxBytes ? "ok" : "over",
  });
};

export function collectResourceBudgets({ root = process.cwd() } = {}) {
  const rows = [];

  addBudget(
    rows,
    root,
    "desktop portrait",
    join(root, "public/desktop/main-avatar.webp"),
    250_000,
  );
  addBudget(
    rows,
    root,
    "desktop toy",
    join(root, "public/desktop/q-avatar.webp"),
    150_000,
  );
  const portraitPath = join(root, "public/desktop/main-avatar.webp");
  const toyPath = join(root, "public/desktop/q-avatar.webp");
  if (existsSync(portraitPath) && existsSync(toyPath)) {
    const bytes = statSync(portraitPath).size + statSync(toyPath).size;
    rows.push({
      label: "first-load images",
      path: "public/desktop/*.webp",
      bytes,
      maxBytes: 400_000,
      status: bytes <= 400_000 ? "ok" : "over",
    });
  }
  addBudget(
    rows,
    root,
    "WebGL fallback",
    join(root, "public/desktop/fallback-composition.png"),
    2_200_000,
  );

  const astroDir = join(root, "dist/_astro");
  if (existsSync(astroDir)) {
    const desktopEntry = readdirSync(astroDir).find(
      (name) =>
        name.startsWith("index.astro_astro_type_script_index_0_lang.") &&
        name.endsWith(".js"),
    );
    if (desktopEntry) {
      const closure = collectStaticJsClosure({
        entryPath: join(astroDir, desktopEntry),
        rootDirectory: astroDir,
      });
      const status =
        closure.issues.length > 0
          ? "invalid"
          : closure.bytes <= DEFAULT_DESKTOP_JS_CLOSURE_BUDGET
            ? "ok"
            : "over";
      rows.push({
        label: "desktop JS static closure",
        path: relative(root, join(astroDir, desktopEntry)),
        bytes: closure.bytes,
        maxBytes: DEFAULT_DESKTOP_JS_CLOSURE_BUDGET,
        status,
        issues: closure.issues,
        files: closure.files.map(({ relativePath }) => relativePath),
      });
    } else {
      rows.push({
        label: "desktop JS static closure",
        path: "dist/_astro",
        bytes: null,
        maxBytes: DEFAULT_DESKTOP_JS_CLOSURE_BUDGET,
        status: "missing",
      });
    }
  } else {
    rows.push({
      label: "desktop JS static closure",
      path: "dist/_astro",
      bytes: null,
      maxBytes: DEFAULT_DESKTOP_JS_CLOSURE_BUDGET,
      status: "missing",
    });
  }

  const indexHtmlPath = join(root, "dist/index.html");
  if (existsSync(indexHtmlPath)) {
    const indexHtml = readFileSync(indexHtmlPath, "utf8");
    const hasDefaultModelPreload =
      indexHtml.includes("GLTFLoader") ||
      indexHtml.includes("gaming-mouse.glb");
    rows.push({
      label: "default model preload",
      path: relative(root, indexHtmlPath),
      bytes: hasDefaultModelPreload ? 1 : 0,
      maxBytes: 0,
      status: hasDefaultModelPreload ? "over" : "ok",
    });
  } else {
    rows.push({
      label: "default model preload",
      path: "dist/index.html",
      bytes: null,
      maxBytes: 0,
      status: "missing",
    });
  }

  const modelDir = join(root, "public/models/desktop");
  if (existsSync(modelDir)) {
    for (const name of readdirSync(modelDir).filter((entry) => entry.endsWith(".glb"))) {
      addBudget(rows, root, `GLB ${name}`, join(modelDir, name), 3_000_000);
    }
  }

  return rows;
}

const run = () => {
  const rows = collectResourceBudgets();
  console.table(rows);

  if (rows.some((row) => row.status !== "ok")) {
    process.exitCode = 1;
  }
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  run();
}
