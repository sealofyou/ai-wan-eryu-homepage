import * as THREE from "three";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  createGlbAssetStore,
  DESKTOP_MODEL_URLS,
  resolveDesktopMouseVariant,
} from "../src/desktop/core/model-assets";

describe("desktop GLB asset pipeline", () => {
  it("keeps GLTFLoader out of the default desktop entry", () => {
    const source = readFileSync(
      new URL("../src/desktop/core/model-assets.ts", import.meta.url),
      "utf8",
    );

    expect(source).not.toMatch(/^import .*GLTFLoader.*$/m);
    expect(source).toContain(
      'await import("three/addons/loaders/GLTFLoader.js")',
    );
  });

  it("keeps the accepted procedural mouse unless the internal GLB selector is explicit", () => {
    expect(resolveDesktopMouseVariant("")).toBe("procedural");
    expect(resolveDesktopMouseVariant("?mouse=procedural")).toBe("procedural");
    expect(resolveDesktopMouseVariant("?mouse=unknown")).toBe("procedural");
    expect(resolveDesktopMouseVariant("?mouse=glb")).toBe("glb");
    expect(DESKTOP_MODEL_URLS.mouse).toBe("/models/desktop/gaming-mouse.glb");
  });

  it("shares one byte download while returning independently disposable model instances", async () => {
    const loadBytes = vi.fn(async () => new ArrayBuffer(8));
    const parse = vi.fn(async () => new THREE.Group());
    const dispose = vi.fn();
    const store = createGlbAssetStore({ loadBytes, parse, dispose });

    const [first, second] = await Promise.all([
      store.acquire(DESKTOP_MODEL_URLS.mouse),
      store.acquire(DESKTOP_MODEL_URLS.mouse),
    ]);

    expect(loadBytes).toHaveBeenCalledTimes(1);
    expect(parse).toHaveBeenCalledTimes(2);
    expect(first.scene).not.toBe(second.scene);

    first.release();
    first.release();
    second.release();

    expect(dispose).toHaveBeenCalledTimes(2);
  });

  it("evicts a failed download so a later request can retry", async () => {
    const loadBytes = vi
      .fn<() => Promise<ArrayBuffer>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(new ArrayBuffer(8));
    const store = createGlbAssetStore({
      loadBytes,
      parse: async () => new THREE.Group(),
      dispose: vi.fn(),
    });

    await expect(store.acquire(DESKTOP_MODEL_URLS.mouse)).rejects.toThrow("offline");
    const lease = await store.acquire(DESKTOP_MODEL_URLS.mouse);

    expect(loadBytes).toHaveBeenCalledTimes(2);
    lease.release();
  });

  it("aborts an unfinished download when its last requester is disposed", async () => {
    let downloadSignal: AbortSignal | undefined;
    const loadBytes = vi.fn(
      (_url: string, signal?: AbortSignal) =>
        new Promise<ArrayBuffer>((_resolve, reject) => {
          downloadSignal = signal;
          signal?.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        }),
    );
    const store = createGlbAssetStore({
      loadBytes,
      parse: async () => new THREE.Group(),
      dispose: vi.fn(),
    });
    const controller = new AbortController();
    const pending = store.acquire(DESKTOP_MODEL_URLS.mouse, {
      signal: controller.signal,
    });

    await vi.waitFor(() => expect(downloadSignal).toBeDefined());
    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(downloadSignal?.aborted).toBe(true);
  });
});
