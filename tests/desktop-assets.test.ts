import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const pageSource = readFileSync(join(root, "src/pages/index.astro"), "utf8");
const sceneSource = readFileSync(join(root, "src/desktop/scene.ts"), "utf8");
const assetSource = readFileSync(join(root, "src/desktop/core/assets.ts"), "utf8");

describe("desktop first-load assets", () => {
  it("loads the WebGL fallback composition only after renderer startup fails", () => {
    expect(pageSource).toContain("data-fallback-image");
    expect(pageSource).toContain('data-src="/desktop/fallback-composition.png"');
    expect(pageSource).not.toMatch(
      /<img[^>]*\ssrc="\/desktop\/fallback-composition\.png"/,
    );
    expect(sceneSource).toContain("fallbackImage?.dataset.src");
    expect(sceneSource).toContain("fallbackImage.src = fallbackSource");
  });

  it("uses compact WebP images for the desktop portrait and toy", () => {
    expect(assetSource).toContain('avatar: "/desktop/main-avatar.webp"');
    expect(assetSource).toContain('toy: "/desktop/q-avatar.webp"');

    const avatarBytes = statSync(
      join(root, "public/desktop/main-avatar.webp"),
    ).size;
    const toyBytes = statSync(join(root, "public/desktop/q-avatar.webp")).size;

    expect(avatarBytes).toBeLessThan(250_000);
    expect(toyBytes).toBeLessThan(150_000);
    expect(avatarBytes + toyBytes).toBeLessThan(400_000);
  });
});
