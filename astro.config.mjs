import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import { fileURLToPath } from "node:url";

const threeBuildCoreFacade = fileURLToPath(
  new URL("./src/desktop/core/three-build-core.mjs", import.meta.url),
);

const desktopThreeCoreFacade = () => ({
  name: "desktop-three-core-facade",
  apply: "build",
  enforce: "pre",
  resolveId(source, importer) {
    if (
      source === "./three.core.js" &&
      importer?.replaceAll("\\", "/").endsWith("/three/build/three.module.js")
    ) {
      return threeBuildCoreFacade;
    }
    return null;
  },
});

export default defineConfig({
  site: "https://eryu.fun",
  output: "static",
  devToolbar: { enabled: false },
  integrations: [sitemap()],
  vite: {
    plugins: [desktopThreeCoreFacade()],
  },
});
