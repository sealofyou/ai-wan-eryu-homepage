import * as THREE from "three";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as primitives from "../src/desktop/objects/primitives";
import {
  GALLERY_ITEMS,
  createGalleryModelLoader,
} from "../src/desktop/studies/model-gallery-catalog";

const canvasElements: Array<{ width: number; height: number; operations: string[] }> = [];

const makeCanvasElement = () => {
  const canvas = {
    width: 0,
    height: 0,
    operations: [] as string[],
    getContext: () => ({
    clearRect() { canvas.operations.push("clearRect"); },
    fillRect() { canvas.operations.push(`fillRect:${this.fillStyle}`); },
    fillText(text: string) { canvas.operations.push(`fillText:${text}`); },
    drawImage() { canvas.operations.push("drawImage"); },
    beginPath() { canvas.operations.push("beginPath"); },
    roundRect() { canvas.operations.push("roundRect"); },
    save() { canvas.operations.push("save"); },
    clip() { canvas.operations.push("clip"); },
    restore() { canvas.operations.push("restore"); },
    moveTo() {},
    lineTo() {},
    stroke() { canvas.operations.push(`stroke:${this.strokeStyle}`); },
    arc() { canvas.operations.push("arc"); },
    fill() { canvas.operations.push(`fill:${this.fillStyle}`); },
    measureText: (text: string) => ({ width: text.length * 12 }),
    font: "",
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    lineCap: "butt",
    lineJoin: "miter",
    textAlign: "left",
    textBaseline: "alphabetic",
    }),
  };
  canvasElements.push(canvas);
  return canvas;
};

const createMouseLease = () => {
  const scene = new THREE.Group();
  scene.name = "leased-mouse-root";
  const geometry = new THREE.BoxGeometry(1, 0.35, 1.4);
  const material = new THREE.MeshStandardMaterial();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "leased-mouse-body";
  scene.add(mesh);
  return { scene, release: vi.fn() };
};

beforeEach(() => {
  canvasElements.length = 0;
  vi.stubGlobal("document", {
    createElement: (tag: string) => {
      if (tag === "canvas") return makeCanvasElement();
      return {};
    },
  });
  vi.stubGlobal("Image", class extends EventTarget {
    decoding = "";
    src = "";
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("model gallery catalog", () => {
  it("releases every original desk material, including unused ones, on normal disposal", async () => {
    const factory = primitives.createDesktopMaterials;
    const originalMaterials: THREE.Material[] = [];
    vi.spyOn(primitives, "createDesktopMaterials").mockImplementation(() => {
      const materials = factory();
      Object.values(materials).forEach(material => {
        originalMaterials.push(material);
        vi.spyOn(material, "dispose");
      });
      return materials;
    });
    const model = await createGalleryModelLoader()("desk");
    model.dispose(); model.dispose();
    expect(originalMaterials).toHaveLength(5);
    originalMaterials.forEach(material => expect(material.dispose).toHaveBeenCalledOnce());
  });
  it("exposes the unified desktop model list in the viewer order", () => {
    expect(GALLERY_ITEMS.map((item) => item.id)).toEqual([
      "computer",
      "lamp",
      "soundbar",
      "keyboard",
      "mouse",
      "main-monitor",
      "portrait-monitor",
      "desk",
    ]);
    expect(new Set(GALLERY_ITEMS.map((item) => item.label)).size).toBe(GALLERY_ITEMS.length);
  });

  it("loads every gallery entry as an independently owned group", async () => {
    const lease = createMouseLease();
    const acquire = vi.fn().mockResolvedValue(lease);
    const loadGalleryModel = createGalleryModelLoader({ mouseAssetStore: { acquire } });
    const models = await Promise.all(GALLERY_ITEMS.map((item) => loadGalleryModel(item.id)));

    expect(models.map((model) => model.label)).toEqual(GALLERY_ITEMS.map((item) => item.label));
    expect(new Set(models.map((model) => model.root))).toHaveProperty("size", GALLERY_ITEMS.length);
    models.forEach((model) => {
      expect(model.root).toBeInstanceOf(THREE.Group);
      expect(model.root.children.length).toBeGreaterThan(0);
      expect(model.note).toBeTruthy();
    });

    models.forEach((model) => {
      model.dispose();
      model.dispose();
    });
    expect(lease.release).toHaveBeenCalledOnce();
  });

  it("adds dark screen planes for monitor shell inspection", async () => {
    const loadGalleryModel = createGalleryModelLoader({
      mouseAssetStore: { acquire: vi.fn().mockResolvedValue(createMouseLease()) },
    });
    const main = await loadGalleryModel("main-monitor");
    const portrait = await loadGalleryModel("portrait-monitor");

    expect(main.root.getObjectByName("gallery-dark-screen")).toBeInstanceOf(THREE.Mesh);
    expect(portrait.root.getObjectByName("gallery-dark-screen")).toBeInstanceOf(THREE.Mesh);

    main.dispose();
    portrait.dispose();
  });

  it("draws the desk mousepad canvas with the real pad base treatment and no new brand string", async () => {
    const loadGalleryModel = createGalleryModelLoader({
      mouseAssetStore: { acquire: vi.fn().mockResolvedValue(createMouseLease()) },
    });
    const model = await loadGalleryModel("desk");
    const matCanvas = canvasElements.find((canvas) => canvas.width === 1400 && canvas.height === 460);

    expect(matCanvas?.operations).toContain("fillRect:#eee7dc");
    expect(matCanvas?.operations).toContain("stroke:#a9baad");
    expect(matCanvas?.operations.some((operation) => operation.includes("Eryu"))).toBe(false);

    model.dispose();
  });

  it("uses the GLB store lease for the mouse and never disposes it outside release", async () => {
    const lease = createMouseLease();
    const geometryDispose = vi.spyOn((lease.scene.children[0] as THREE.Mesh).geometry, "dispose");
    const acquire = vi.fn().mockResolvedValue(lease);
    const loadGalleryModel = createGalleryModelLoader({ mouseAssetStore: { acquire } });

    const model = await loadGalleryModel("mouse");

    expect(acquire).toHaveBeenCalledWith("/models/desktop/eryu-mouse-study.glb");
    expect(model.root).toBe(lease.scene);
    model.dispose();
    model.dispose();
    expect(lease.release).toHaveBeenCalledOnce();
    expect(geometryDispose).not.toHaveBeenCalled();
  });

  it("disposes non-lease model graphs exactly once through their descriptor", async () => {
    const loadGalleryModel = createGalleryModelLoader({
      mouseAssetStore: { acquire: vi.fn().mockResolvedValue(createMouseLease()) },
    });
    const geometryDispose = vi.spyOn(THREE.BufferGeometry.prototype, "dispose");
    const materialDispose = vi.spyOn(THREE.Material.prototype, "dispose");

    const model = await loadGalleryModel("keyboard");
    model.dispose();
    const geometryCalls = geometryDispose.mock.calls.length;
    const materialCalls = materialDispose.mock.calls.length;
    model.dispose();

    expect(geometryCalls).toBeGreaterThan(0);
    expect(materialCalls).toBeGreaterThan(0);
    expect(geometryDispose).toHaveBeenCalledTimes(geometryCalls);
    expect(materialDispose).toHaveBeenCalledTimes(materialCalls);
  });

  it("rejects unknown ids and keeps the viewer dynamic import literal", async () => {
    const loadGalleryModel = createGalleryModelLoader({
      mouseAssetStore: { acquire: vi.fn().mockResolvedValue(createMouseLease()) },
    });
    await expect(loadGalleryModel("missing")).rejects.toThrow("Unknown gallery model");

    const viewerSource = readFileSync(resolve("src/desktop/studies/model-gallery.ts"), "utf8");
    const catalogSource = readFileSync(resolve("src/desktop/studies/model-gallery-catalog.ts"), "utf8");
    expect(viewerSource).toContain('import("./model-gallery-catalog")');
    expect(viewerSource).not.toContain("import.meta.glob");
    expect(catalogSource).not.toContain("getMeshChild");
    expect(catalogSource).not.toContain(".children[");
  });
});
