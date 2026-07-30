import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import type { GlbModelLease } from "../src/desktop/core/model-assets";
import { createInitialDesktopState, movePhysicalMouse } from "../src/desktop/model";
import { createMouseObject } from "../src/desktop/objects/mouse";
import { createDesktopMaterials } from "../src/desktop/objects/primitives";

describe("replaceable desktop mouse", () => {
  it("uses the procedural visual by default without requesting a model", async () => {
    const acquire = vi.fn();
    const mouse = createMouseObject(createDesktopMaterials(), {
      assetStore: { acquire },
    });

    expect(await mouse.ready).toBe("procedural");
    expect(acquire).not.toHaveBeenCalled();
    expect(mouse.group.userData.modelVariant).toBe("procedural");
    expect(mouse.interactiveTargets).toHaveLength(1);
    expect(mouse.interactiveTargets?.[0]).toBeInstanceOf(THREE.Mesh);
  });

  it("swaps only the visual layer after a GLB model loads and releases it on dispose", async () => {
    const model = new THREE.Group();
    model.name = "loaded-model";
    const release = vi.fn();
    const mouse = createMouseObject(createDesktopMaterials(), {
      variant: "glb",
      assetStore: {
        acquire: vi.fn(async () => ({ scene: model, release })),
      },
    });

    expect(mouse.group.userData.modelVariant).toBe("procedural");
    expect(await mouse.ready).toBe("glb");
    expect(mouse.group.userData.modelVariant).toBe("glb");
    expect(mouse.group.getObjectByName("gaming-mouse-glb")).toBe(model);

    const moved = movePhysicalMouse(createInitialDesktopState(), { x: 0.8, y: 0.6 });
    mouse.update?.(moved);
    expect(mouse.group.position.x).not.toBe(0);

    mouse.dispose?.();
    mouse.dispose?.();
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("keeps the procedural visual when GLB loading fails", async () => {
    const mouse = createMouseObject(createDesktopMaterials(), {
      variant: "glb",
      assetStore: {
        acquire: vi.fn(async () => {
          throw new Error("bad model");
        }),
      },
    });

    await expect(mouse.ready).resolves.toBe("procedural");
    expect(mouse.group.userData.modelVariant).toBe("procedural");
    expect(mouse.group.userData.modelError).toBe("bad model");
    expect(mouse.group.getObjectByName("procedural-mouse")).toBeTruthy();
  });

  it("cancels a pending model request when the mouse is disposed", async () => {
    let modelSignal: AbortSignal | undefined;
    const mouse = createMouseObject(createDesktopMaterials(), {
      variant: "glb",
      assetStore: {
        acquire: vi.fn(
          (
            _url: string,
            options?: { signal?: AbortSignal },
          ) =>
            new Promise<GlbModelLease>((_resolve, reject) => {
              modelSignal = options?.signal;
              modelSignal?.addEventListener(
                "abort",
                () => reject(new DOMException("Aborted", "AbortError")),
                { once: true },
              );
            }),
        ),
      },
    });

    await vi.waitFor(() => expect(modelSignal).toBeDefined());
    mouse.dispose?.();

    await expect(mouse.ready).resolves.toBe("procedural");
    expect(modelSignal?.aborted).toBe(true);
    expect(mouse.group.userData.modelError).toBeUndefined();
  });
});
