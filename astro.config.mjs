import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://eryu.fun",
  output: "static",
  devToolbar: { enabled: false },
  integrations: [sitemap()],
});
