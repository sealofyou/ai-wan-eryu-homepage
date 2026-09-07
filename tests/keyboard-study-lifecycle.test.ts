import * as THREE from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountKeyboardStudy } from "../src/desktop/studies/keyboard-study";

const mocks = vi.hoisted(() => ({
  failRoom: false,
  pmremDispose: vi.fn(),
  failModel: false,
  failEnvironment: false,
  render: vi.fn(),
  rendererDispose: vi.fn(),
  remove: vi.fn(),
  controlsDispose: vi.fn(),
  observerDisconnect: vi.fn(),
  environmentDispose: vi.fn(),
  specialMeshes: [] as THREE.Mesh[],
}));

vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal<typeof THREE>();
  return {
    ...actual,
    WebGLRenderer: class {
      domElement = { remove: mocks.remove };
      shadowMap = {};
      info = { render: { calls: 11 } };
      render = mocks.render;
      dispose = mocks.rendererDispose;
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
      update() {}
    },
  };
});

vi.mock("three/addons/environments/RoomEnvironment.js", () => ({ RoomEnvironment: class {
  constructor() { if (mocks.failRoom) throw new Error("injected room failure"); }
  dispose() {}
} }));

vi.mock("../src/desktop/studies/keyboard-study-model", async () => {
  const actual = await vi.importActual<typeof THREE>("three");
  const createMesh = (name: string, material: THREE.Material) => {
    const mesh = new actual.Mesh(new actual.BoxGeometry(1, 1, 1), material);
    mesh.name = name;
    return mesh;
  };
  return {
    KEYBOARD_STUDY_FLOOR_Y: -0.1225,
    createKeyboardStudyModel: ({ withLegends }: { withLegends?: boolean } = {}) => {
      if (mocks.failModel) throw new Error("injected model failure");
      const group = new actual.Group();
      group.name = "keyboard-study-model";
      const keyboardCase = createMesh("keyboard-case", new actual.MeshStandardMaterial());
      keyboardCase.geometry = new actual.BoxGeometry(6.13, 0.45, 1.993);
      group.add(keyboardCase);
      group.add(createMesh("keycap-a", new actual.MeshStandardMaterial()));
      if (withLegends) {
        for (const name of ["key-legends", "keyboard-brand", "status-lights"]) {
          const mesh = createMesh(name, new actual.MeshBasicMaterial());
          mesh.castShadow = false;
          mesh.receiveShadow = false;
          mocks.specialMeshes.push(mesh);
          group.add(mesh);
        }
      }
      return group;
    },
  };
});

class Element extends EventTarget {
  dataset: Record<string, string> = {};
  hidden = false;
  textContent = "";
  clientWidth = 960;
  clientHeight = 680;
  appendChild = vi.fn();
  setAttribute(name: string, value: string) { this.dataset[name] = value; }
  getAttribute(name: string) { return this.dataset[name] ?? this.dataset[name.replace(/^data-/, "").replace(/-([a-z])/g, (_, c) => c.toUpperCase())]; }
}

const createRoot = () => {
  const root = new Element();
  const mount = new Element();
  const loading = new Element();
  const error = new Element();
  const errorMessage = new Element();
  error.hidden = true;
  const stats = { triangles: new Element(), materials: new Element(), calls: new Element() };
  const buttons: Element[] = [];
  for (const [attribute, values] of Object.entries({ cameraPreset: ["angled", "top", "front", "side"], shadingMode: ["material", "clay"] })) {
    for (const value of values) {
      const button = new Element();
      button.dataset[attribute] = value;
      buttons.push(button);
    }
  }
  Object.assign(root, {
    querySelector: (selector: string) => ({
      "[data-keyboard-canvas]": mount,
      "[data-keyboard-loading]": loading,
      "[data-keyboard-error]": error,
      "[data-keyboard-error-message]": errorMessage,
      '[data-stat="triangles"]': stats.triangles,
      '[data-stat="materials"]': stats.materials,
      '[data-stat="calls"]': stats.calls,
    }[selector] ?? null),
    querySelectorAll: (selector: string) => buttons.filter((button) => Object.keys(button.dataset).some((key) => `[data-${key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)}]` === selector)),
  });
  const click = (value: string) => buttons.find((button) => Object.values(button.dataset).includes(value))!.dispatchEvent(new Event("click"));
  const pressed = (value: string) => buttons.find((button) => Object.values(button.dataset).includes(value))?.dataset["aria-pressed"];
  return { root, loading, error, errorMessage, stats, click, pressed };
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.failModel = false;
  mocks.failEnvironment = false;
  mocks.failRoom = false;
  mocks.specialMeshes.length = 0;
  vi.stubGlobal("window", { devicePixelRatio: 1 });
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect = mocks.observerDisconnect; });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("keyboard study lifecycle", () => {
  it("releases PMREM when constructing the room itself fails", () => {
    mocks.failRoom = true;
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const ui = createRoot();
    mountKeyboardStudy(ui.root as unknown as HTMLElement);
    expect(ui.root.dataset.studyState).toBe("error");
    expect(mocks.pmremDispose).toHaveBeenCalledOnce();
    expect(mocks.rendererDispose).toHaveBeenCalledOnce();
  });
  it("renders material mode by default, supports clay toggles, and disposes once", () => {
    const ui = createRoot();
    const dispose = mountKeyboardStudy(ui.root as unknown as HTMLElement)!;
    expect(ui.root.dataset.studyState).toBe("ready");
    expect(Number(ui.root.dataset.renderCount)).toBeGreaterThan(0);
    expect(ui.loading.hidden).toBe(true);
    expect(ui.stats.triangles.textContent).not.toBe("—");
    expect(ui.stats.materials.textContent).toBe("5");
    expect(ui.pressed("material")).toBe("true");
    const camera = mocks.render.mock.lastCall?.[1] as THREE.PerspectiveCamera;
    expect(camera.position.distanceTo(new THREE.Vector3(0, 0, 0))).toBeGreaterThan(8);
    mocks.specialMeshes.forEach((mesh) => {
      expect(mesh.castShadow, mesh.name).toBe(false);
      expect(mesh.receiveShadow, mesh.name).toBe(false);
    });
    ui.click("clay");
    expect(ui.pressed("clay")).toBe("true");
    expect(Number(ui.root.dataset.renderCount)).toBeGreaterThan(1);
    mocks.specialMeshes.forEach((mesh) => expect(mesh.visible, mesh.name).toBe(false));
    const renders = mocks.render.mock.calls.length;
    dispose();
    dispose();
    ui.click("top");
    expect(mocks.render).toHaveBeenCalledTimes(renders);
    expect(mocks.controlsDispose).toHaveBeenCalledOnce();
    expect(mocks.observerDisconnect).toHaveBeenCalledOnce();
    expect(mocks.environmentDispose).toHaveBeenCalledOnce();
    expect(mocks.rendererDispose).toHaveBeenCalledOnce();
    expect(mocks.remove).toHaveBeenCalledOnce();
  });

  it("cleans a partial scene and reports the safe stage when model creation fails", () => {
    mocks.failModel = true;
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const ui = createRoot();
    mountKeyboardStudy(ui.root as unknown as HTMLElement);
    expect(ui.error.hidden).toBe(false);
    expect(ui.loading.hidden).toBe(true);
    expect(ui.root.dataset.studyState).toBe("error");
    expect(ui.root.dataset.errorStage).toBe("geometry");
    expect(ui.errorMessage.textContent).toContain("geometry");
    expect(mocks.rendererDispose).toHaveBeenCalledOnce();
    expect(warning.mock.calls.flat().join(" ")).not.toContain("injected model failure");
  });

  it("releases renderer resources when environment setup fails before mount returns an environment", () => {
    mocks.failEnvironment = true;
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const ui = createRoot();
    mountKeyboardStudy(ui.root as unknown as HTMLElement);
    expect(ui.error.hidden).toBe(false);
    expect(ui.loading.hidden).toBe(true);
    expect(ui.root.dataset.studyState).toBe("error");
    expect(ui.root.dataset.errorStage).toBe("environment");
    expect(mocks.rendererDispose).toHaveBeenCalledOnce();
    expect(mocks.remove).toHaveBeenCalledOnce();
    expect(warning.mock.calls.flat().join(" ")).not.toContain("injected pmrem failure");
  });
});
