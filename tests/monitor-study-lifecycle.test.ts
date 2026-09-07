import * as THREE from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountMonitorStudy } from "../src/desktop/studies/monitor-study";

const mocks = vi.hoisted(() => ({ failCanvas: false, render: vi.fn(), rendererDispose: vi.fn(), remove: vi.fn(), controlsDispose: vi.fn(), observerDisconnect: vi.fn(), environmentDispose: vi.fn(), textures: [] as Array<{ dispose: ReturnType<typeof vi.fn> }>, images: [] as Array<{ src: string; onload: (() => void) | null; onerror: (() => void) | null }> }));
vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal<typeof THREE>();
  return {
    ...actual,
    WebGLRenderer: class {
      domElement = { remove: mocks.remove };
      shadowMap = {};
      info = { render: { calls: 19 } };
      render = mocks.render;
      dispose = mocks.rendererDispose;
      setPixelRatio() {}
      setSize() {}
    },
    PMREMGenerator: class {
      fromScene() { return { texture: new actual.Texture(), dispose: mocks.environmentDispose }; }
      dispose() {}
    },
  };
});
vi.mock("three/addons/controls/OrbitControls.js", async () => {
  const actual = await vi.importActual<typeof THREE>("three");
  return { OrbitControls: class extends actual.EventDispatcher {
    target = new actual.Vector3();
    dispose = mocks.controlsDispose;
    update() {}
  } };
});
vi.mock("three/addons/environments/RoomEnvironment.js", () => ({ RoomEnvironment: class { dispose() {} } }));
vi.mock("../src/desktop/screens/main-screen", () => ({ renderMainScreen: vi.fn() }));
vi.mock("../src/desktop/screens/canvas-utils", async () => {
  const actual = await vi.importActual<typeof THREE>("three");
  return { makeCanvas: (width: number, height: number) => {
    if (mocks.failCanvas) throw new Error("injected canvas failure");
    const texture = new actual.Texture();
    vi.spyOn(texture, "dispose");
    mocks.textures.push(texture as unknown as { dispose: ReturnType<typeof vi.fn> });
    return { canvas: { width, height }, texture, context: { clearRect() {}, fillText() {} } };
  } };
});

class Element extends EventTarget {
  dataset: Record<string, string> = {};
  hidden = false;
  textContent = "";
  clientWidth = 1040;
  clientHeight = 780;
  appendChild = vi.fn();
  setAttribute(name: string, value: string) { this.dataset[name] = value; }
  getAttribute(name: string) { return this.dataset[name] ?? this.dataset[name.replace(/^data-/, "").replace(/-([a-z])/g, (_, c) => c.toUpperCase())]; }
}

const createRoot = () => {
  const root = new Element();
  const mount = new Element();
  const loading = new Element();
  const error = new Element();
  error.hidden = true;
  const status = new Element();
  const buttons: Element[] = [];
  for (const [attribute, values] of Object.entries({ cameraPreset: ["front", "real", "side", "back"], shadingMode: ["clay", "material"], screenMode: ["on", "off"] })) {
    for (const value of values) { const button = new Element(); button.dataset[attribute] = value; buttons.push(button); }
  }
  Object.assign(root, {
    querySelector: (selector: string) => ({ "[data-monitor-canvas]": mount, "[data-monitor-loading]": loading, "[data-monitor-error]": error, "[data-study-status]": status }[selector] ?? new Element()),
    querySelectorAll: (selector: string) => buttons.filter(button => Object.keys(button.dataset).some(key => `[data-${key.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}]` === selector)),
  });
  const click = (value: string) => buttons.find(button => Object.values(button.dataset).includes(value))!.dispatchEvent(new Event("click"));
  return { root, loading, error, status, click };
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.failCanvas = false;
  mocks.textures.length = 0;
  mocks.images.length = 0;
  vi.stubGlobal("window", { devicePixelRatio: 1 });
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect = mocks.observerDisconnect; });
  vi.stubGlobal("Image", class {
    src = "";
    onload = null;
    onerror = null;
    constructor() { mocks.images.push(this); }
  });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("monitor study lifecycle", () => {
  it("releases hidden screen textures and callbacks after shading and power toggles", () => {
    const ui = createRoot();
    const dispose = mountMonitorStudy(ui.root as unknown as HTMLElement)!;
    expect(ui.root.dataset.studyState).toBe("ready");
    ui.click("off");
    ui.click("clay");
    const renders = mocks.render.mock.calls.length;
    dispose();
    dispose();
    ui.click("on");
    ui.click("front");
    expect(mocks.render).toHaveBeenCalledTimes(renders);
    expect(mocks.textures).toHaveLength(2);
    mocks.textures.forEach(texture => expect(texture.dispose).toHaveBeenCalledOnce());
    expect(mocks.controlsDispose).toHaveBeenCalledOnce();
    expect(mocks.observerDisconnect).toHaveBeenCalledOnce();
    expect(mocks.rendererDispose).toHaveBeenCalledOnce();
    expect(mocks.environmentDispose).toHaveBeenCalledOnce();
    expect(mocks.remove).toHaveBeenCalledOnce();
    expect(mocks.images[0].onload).toBeNull();
    expect(mocks.images[0].onerror).toBeNull();
  });

  it("cleans a partial scene on screen initialization failure and records a safe stage", () => {
    mocks.failCanvas = true;
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const geometryDispose = vi.spyOn(THREE.BufferGeometry.prototype, "dispose");
    const ui = createRoot();
    mountMonitorStudy(ui.root as unknown as HTMLElement);
    expect(ui.error.hidden).toBe(false);
    expect(ui.loading.hidden).toBe(true);
    expect(ui.root.dataset.studyState).toBe("error");
    expect(ui.root.dataset.errorStage).toBe("screen");
    expect(mocks.remove).toHaveBeenCalledOnce();
    expect(mocks.rendererDispose).toHaveBeenCalledOnce();
    expect(mocks.environmentDispose).toHaveBeenCalledOnce();
    expect(geometryDispose).toHaveBeenCalled();
    expect(warning.mock.calls.flat().join(" ")).not.toContain("injected canvas failure");
  });

  it("tries the existing avatar fallback once without keeping callbacks after disposal", () => {
    const ui = createRoot();
    const dispose = mountMonitorStudy(ui.root as unknown as HTMLElement)!;
    const image = mocks.images[0];
    expect(image.src).toBe("/desktop/main-avatar.webp");
    image.onerror!();
    expect(image.src).toBe("/desktop/main-avatar.png");
    image.onerror!();
    expect(ui.status.textContent).toContain("暂未加载");
    dispose();
    expect(image.onerror).toBeNull();
  });
});
