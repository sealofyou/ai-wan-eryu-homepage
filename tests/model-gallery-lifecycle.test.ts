import * as THREE from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountModelGallery } from "../src/desktop/studies/model-gallery";

const mocks = vi.hoisted(() => ({
  failRenderer: false,
  failRoom: false,
  failEnvironment: false,
  render: vi.fn(),
  rendererDispose: vi.fn(),
  remove: vi.fn(),
  controlsDispose: vi.fn(),
  observerDisconnect: vi.fn(),
  environmentDispose: vi.fn(),
  pmremDispose: vi.fn(),
  loadGalleryModel: vi.fn(),
  modelDisposes: new Map<string, ReturnType<typeof vi.fn>>(),
  controls: [] as Array<THREE.EventDispatcher & { target: THREE.Vector3; update: () => void }>,
  createdMeshes: [] as THREE.Mesh[],
  reloaded: vi.fn(),
}));

vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal<typeof THREE>();
  return {
    ...actual,
    WebGLRenderer: class {
      domElement = { remove: mocks.remove };
      shadowMap = {};
      info = { render: { calls: 23 } };
      render = mocks.render;
      dispose = mocks.rendererDispose;
      constructor() {
        if (mocks.failRenderer) throw new Error("injected renderer failure");
      }
      setPixelRatio() {}
      setSize() {}
    },
    PMREMGenerator: class {
      fromScene() {
        if (mocks.failEnvironment) throw new Error("injected pmrem failure");
        return { texture: new actual.Texture(), dispose: mocks.environmentDispose };
      }
      dispose = mocks.pmremDispose;
    },
  };
});

vi.mock("three/addons/controls/OrbitControls.js", async () => {
  const actual = await vi.importActual<typeof THREE>("three");
  return {
    OrbitControls: class extends actual.EventDispatcher {
      target = new actual.Vector3();
      enableDamping = false;
      enablePan = false;
      minDistance = 0;
      maxDistance = 0;
      maxPolarAngle = 0;
      dispose = mocks.controlsDispose;
      constructor() {
        super();
        mocks.controls.push(this);
      }
      update() {}
    },
  };
});

vi.mock("three/addons/environments/RoomEnvironment.js", () => ({
  RoomEnvironment: class {
    constructor() {
      if (mocks.failRoom) throw new Error("injected room failure");
    }
    dispose() {}
  },
}));

const catalog = {
  GALLERY_ITEMS: [
    { id: "computer", label: "机箱" },
    { id: "keyboard", label: "键盘" },
    { id: "mouse", label: "鼠标" },
  ],
  loadGalleryModel: mocks.loadGalleryModel,
};

interface DeferredModel {
  promise: Promise<{ root: THREE.Group; dispose: () => void; label: string; note?: string }>;
  resolve: (value: { root: THREE.Group; dispose: () => void; label: string; note?: string }) => void;
  reject: (reason?: unknown) => void;
}

class Element extends EventTarget {
  dataset: Record<string, string> = {};
  hidden = false;
  textContent = "";
  value = "";
  children: unknown[] = [];
  clientWidth = 960;
  clientHeight = 680;
  appendChild = vi.fn();
  replaceChildren(...children: unknown[]) {
    this.children = children;
    const first = children[0] as { value?: string } | undefined;
    if (first?.value) this.value = first.value;
  }
  setAttribute(name: string, value: string) { this.dataset[name] = value; }
  getAttribute(name: string) { return this.dataset[name] ?? this.dataset[name.replace(/^data-/, "").replace(/-([a-z])/g, (_, c) => c.toUpperCase())]; }
}

const createModel = (id: string, note = `${id} note`) => {
  const dispose = vi.fn();
  mocks.modelDisposes.set(id, dispose);
  const root = new THREE.Group();
  root.name = id;
  const baseMaterial = new THREE.MeshStandardMaterial({ color: "#223322" });
  const base = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1), baseMaterial);
  base.name = `${id}-body`;
  base.castShadow = true;
  base.receiveShadow = true;
  root.add(base);

  const labelMaterial = new THREE.MeshBasicMaterial({ map: new THREE.Texture() });
  const label = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.02), labelMaterial);
  label.name = `${id}-logo-label`;
  label.visible = true;
  label.castShadow = false;
  label.receiveShadow = false;
  root.add(label);
  mocks.createdMeshes.push(base, label);

  const instanced = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial(), 3);
  instanced.name = `${id}-instances`;
  root.add(instanced);

  return { root, dispose, label: id, note };
};

const createTranslatedScaledModel = () => {
  const model = createModel("translated");
  model.root.position.set(5, 2, -4);
  model.root.scale.set(2, 1.5, 0.75);
  return model;
};

const createDeferred = () => {
  const deferred = {} as DeferredModel;
  deferred.promise = new Promise((resolve, reject) => {
    deferred.resolve = resolve;
    deferred.reject = reject;
  });
  return deferred;
};

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const createRoot = () => {
  const root = new Element();
  const mount = new Element();
  const select = new Element();
  const loading = new Element();
  const loadingText = new Element();
  const error = new Element();
  const errorMessage = new Element();
  const retry = new Element();
  const status = new Element();
  error.hidden = true;
  const stats = { triangles: new Element(), materials: new Element(), calls: new Element() };
  const buttons: Element[] = [];
  for (const [attribute, values] of Object.entries({
    cameraPreset: ["angled", "front", "side", "back", "top"],
    shadingMode: ["material", "clay"],
  })) {
    for (const value of values) {
      const button = new Element();
      button.dataset[attribute] = value;
      buttons.push(button);
    }
  }
  Object.assign(root, {
    querySelector: (selector: string) => ({
      "[data-gallery-canvas]": mount,
      "[data-gallery-select]": select,
      "[data-gallery-loading]": loading,
      "[data-gallery-loading-text]": loadingText,
      "[data-gallery-error]": error,
      "[data-gallery-error-message]": errorMessage,
      "[data-gallery-retry]": retry,
      "[data-gallery-status]": status,
      '[data-stat="triangles"]': stats.triangles,
      '[data-stat="materials"]': stats.materials,
      '[data-stat="calls"]': stats.calls,
    }[selector] ?? null),
    querySelectorAll: (selector: string) => buttons.filter((button) => Object.keys(button.dataset).some((key) => `[data-${key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)}]` === selector)),
  });
  const click = (value: string) => buttons.find((button) => Object.values(button.dataset).includes(value))!.dispatchEvent(new Event("click"));
  const changeSelect = (value: string) => {
    select.value = value;
    select.dispatchEvent(new Event("change"));
  };
  return { root, mount, select, loading, loadingText, error, errorMessage, retry, status, stats, click, changeSelect };
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.failRenderer = false;
  mocks.failRoom = false;
  mocks.failEnvironment = false;
  mocks.controls.length = 0;
  mocks.createdMeshes.length = 0;
  mocks.modelDisposes.clear();
  mocks.reloaded.mockReset();
  vi.stubGlobal("window", { devicePixelRatio: 1, location: { reload: mocks.reloaded } });
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect = mocks.observerDisconnect; });
  vi.stubGlobal("requestAnimationFrame", vi.fn());
  vi.stubGlobal("document", {
    createElement: (tag: string) => {
      const element = new Element();
      if (tag === "option") element.value = "";
      return element;
    },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("model gallery lifecycle", () => {
  it("switches models safely and disposes a late result without showing it", async () => {
    const pending = { computer: createDeferred(), keyboard: createDeferred() };
    mocks.loadGalleryModel.mockImplementation((id: keyof typeof pending) => pending[id].promise);
    const ui = createRoot();
    mountModelGallery(ui.root as unknown as HTMLElement, catalog);

    expect(ui.root.dataset.galleryState).toBe("loading");
    expect(ui.loadingText.textContent).toContain("机箱");
    ui.changeSelect("keyboard");
    expect(ui.loadingText.textContent).toContain("键盘");

    pending.keyboard.resolve(createModel("keyboard"));
    await flush();
    expect(ui.root.dataset.galleryState).toBe("ready");
    expect(ui.root.dataset.selectedModel).toBe("keyboard");
    expect(ui.status.textContent).toBe("keyboard note");
    expect(ui.stats.triangles.textContent).not.toBe("-");

    pending.computer.resolve(createModel("computer"));
    await flush();
    expect(ui.root.dataset.selectedModel).toBe("keyboard");
    expect(mocks.modelDisposes.get("computer")).toHaveBeenCalledOnce();
    expect(mocks.modelDisposes.get("keyboard")).not.toHaveBeenCalled();
  });

  it("reports a current loading failure with a retryable safe stage", async () => {
    const pending = { computer: createDeferred() };
    mocks.loadGalleryModel.mockImplementation(() => pending.computer.promise);
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const ui = createRoot();
    mountModelGallery(ui.root as unknown as HTMLElement, catalog);
    pending.computer.reject(new Error("injected load failure"));
    await flush();

    expect(ui.error.hidden).toBe(false);
    expect(ui.loading.hidden).toBe(true);
    expect(ui.root.dataset.galleryState).toBe("error");
    expect(ui.root.dataset.errorStage).toBe("model:computer");
    expect(ui.errorMessage.textContent).toContain("model:computer");
    expect(warning.mock.calls.flat().join(" ")).not.toContain("injected load failure");

    const retry = createDeferred();
    mocks.loadGalleryModel.mockReturnValueOnce(retry.promise);
    ui.retry.dispatchEvent(new Event("click"));
    retry.resolve(createModel("computer"));
    await flush();
    expect(ui.root.dataset.galleryState).toBe("ready");
    expect(ui.root.dataset.selectedModel).toBe("computer");
  });

  it("renders only on demand and reacts to orbit changes", async () => {
    const computer = createDeferred();
    mocks.loadGalleryModel.mockReturnValue(computer.promise);
    const ui = createRoot();
    mountModelGallery(ui.root as unknown as HTMLElement, catalog);
    computer.resolve(createModel("computer"));
    await flush();

    const renderCount = Number(ui.root.dataset.renderCount);
    expect(renderCount).toBeGreaterThan(0);
    expect(globalThis.requestAnimationFrame).not.toHaveBeenCalled();
    await flush();
    expect(Number(ui.root.dataset.renderCount)).toBe(renderCount);

    mocks.controls[0].dispatchEvent({ type: "change" } as never);
    expect(Number(ui.root.dataset.renderCount)).toBe(renderCount + 1);
  });

  it("wraps translated and scaled roots without mutating their original transform", async () => {
    const computer = createDeferred();
    mocks.loadGalleryModel.mockReturnValue(computer.promise);
    const ui = createRoot();
    mountModelGallery(ui.root as unknown as HTMLElement, catalog);
    const model = createTranslatedScaledModel();
    const originalPosition = model.root.position.clone();
    const originalScale = model.root.scale.clone();
    computer.resolve(model);
    await flush();

    const scene = mocks.render.mock.lastCall?.[0] as THREE.Scene;
    const host = scene.getObjectByName("model-gallery-host") as THREE.Group;
    const displayRoot = host.children[0] as THREE.Group;
    const bounds = new THREE.Box3().setFromObject(displayRoot);
    const center = bounds.getCenter(new THREE.Vector3());

    expect(displayRoot).not.toBe(model.root);
    expect(displayRoot.children[0]).toBe(model.root);
    expect(model.root.position.equals(originalPosition)).toBe(true);
    expect(model.root.scale.equals(originalScale)).toBe(true);
    expect(bounds.min.y).toBeCloseTo(0, 5);
    expect(center.x).toBeCloseTo(0, 5);
    expect(center.z).toBeCloseTo(0, 5);
  });

  it("restores clay-hidden state and releases model and viewer resources once", async () => {
    const computer = createDeferred();
    mocks.loadGalleryModel.mockReturnValue(computer.promise);
    const ui = createRoot();
    const dispose = mountModelGallery(ui.root as unknown as HTMLElement, catalog)!;
    computer.resolve(createModel("computer"));
    await flush();
    const label = mocks.createdMeshes.find((mesh) => mesh.name.includes("logo-label"))!;
    expect(label.visible).toBe(true);
    expect(label.castShadow).toBe(false);

    ui.click("clay");
    expect(label.visible).toBe(false);
    dispose();
    dispose();
    ui.click("front");

    expect(label.visible).toBe(true);
    expect(label.castShadow).toBe(false);
    expect(mocks.modelDisposes.get("computer")).toHaveBeenCalledOnce();
    expect(mocks.controlsDispose).toHaveBeenCalledOnce();
    expect(mocks.observerDisconnect).toHaveBeenCalledOnce();
    expect(mocks.environmentDispose).toHaveBeenCalledOnce();
    expect(mocks.rendererDispose).toHaveBeenCalledOnce();
    expect(mocks.remove).toHaveBeenCalledOnce();
    expect(ui.root.dataset.galleryState).toBe("disposed");
  });

  it("cleans a partial scene when environment construction fails", () => {
    mocks.failRoom = true;
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const ui = createRoot();
    mountModelGallery(ui.root as unknown as HTMLElement);

    expect(ui.error.hidden).toBe(false);
    expect(ui.loading.hidden).toBe(true);
    expect(ui.root.dataset.galleryState).toBe("error");
    expect(ui.root.dataset.errorStage).toBe("environment");
    expect(mocks.pmremDispose).toHaveBeenCalledOnce();
    expect(mocks.rendererDispose).toHaveBeenCalledOnce();
    expect(mocks.remove).toHaveBeenCalledOnce();
    expect(warning.mock.calls.flat().join(" ")).not.toContain("injected room failure");
  });

  it("reloads the page when initialization fails and the retry control is pressed", () => {
    mocks.failRoom = true;
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const ui = createRoot();
    mountModelGallery(ui.root as unknown as HTMLElement);

    ui.retry.dispatchEvent(new Event("click"));

    expect(mocks.reloaded).toHaveBeenCalledOnce();
  });
});
