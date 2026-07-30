import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const rows = [];

const addBudget = (label, path, maxBytes) => {
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

addBudget(
  "desktop portrait",
  join(root, "public/desktop/main-avatar.webp"),
  250_000,
);
addBudget(
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
    addBudget("desktop JS entry", join(astroDir, desktopEntry), 650_000);
  } else {
    rows.push({
      label: "desktop JS entry",
      path: "dist/_astro",
      bytes: null,
      maxBytes: 650_000,
      status: "missing",
    });
  }
} else {
  rows.push({
    label: "desktop JS entry",
    path: "dist/_astro",
    bytes: null,
    maxBytes: 650_000,
    status: "missing",
  });
}

const modelDir = join(root, "public/models/desktop");
if (existsSync(modelDir)) {
  for (const name of readdirSync(modelDir).filter((entry) => entry.endsWith(".glb"))) {
    addBudget(`GLB ${name}`, join(modelDir, name), 3_000_000);
  }
}

console.table(rows);

if (rows.some((row) => row.status !== "ok")) {
  process.exitCode = 1;
}
