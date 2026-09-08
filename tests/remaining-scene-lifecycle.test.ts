import * as THREE from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountDesktopScene } from "../src/desktop/scene";

const mocks = vi.hoisted(() => ({
  rafCallbacks: [] as FrameRequestCallback[],
  nextRaf: 1,
  rendererRemove: vi.fn(),
  rendererDispose: vi.fn(),
  render: vi.fn(),
  resize: vi.fn(),
  pointerDispose: vi.fn(),
  draggingDispose: vi.fn(),
  mousepadDispose: vi.fn(),
  messageDispose: vi.fn(),
  disposeObjectGraph: vi.fn(),
  applyRemainingVisuals: vi.fn(),
  applyStudyVisuals: vi.fn(() => true),
  applyKeyboardStudyVisual: vi.fn(() => true),
  createKeyboardStudyModel: vi.fn(() => new THREE.Group()),
  createMonitorVisualSet: vi.fn(() => ({})),
  pointerOptions: undefined as
    | {
        interactiveTargets: THREE.Object3D[];
        applyAction: (action: string) => void;
      }
    | undefined,
  mouseReady: undefined as Promise<"study" | "glb" | "procedural"> | undefined,
  mouseReadyResolve: undefined as ((value: "study" | "glb" | "procedural") => void) | undefined,
}));

const makeGroupResult = (name: string, interactiveTargets: THREE.Object3D[] = []) => {
  const group = new THREE.Group();
  group.name = name;
  return { group, interactiveTargets, dispose: vi.fn() };
};

const makeMesh = (name: string) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
  mesh.name = name;
  return mesh;
};

vi.mock("../src/desktop/core/renderer", async () => {
  const actual = await vi.importActual<typeof import("../src/desktop/core/renderer")>("../src/desktop/core/renderer");
  return {
    ...actual,
    createDesktopRendererEnvironment: () => {
      const scene = new THREE.Scene();
      const world = new THREE.Group();
      scene.add(world);
      return {
        renderer: {
          domElement: { remove: mocks.rendererRemove },
          render: mocks.render,
          dispose: mocks.rendererDispose,
        },
        scene,
        camera: new THREE.PerspectiveCamera(),
        world,
        cameraPoses: {
          intro: { position: new THREE.Vector3(0, 0, 10), target: new THREE.Vector3() },
          overview: { position: new THREE.Vector3(0, 0, 8), target: new THREE.Vector3() },
          content: { position: new THREE.Vector3(0, 0, 6), target: new THREE.Vector3() },
        },
        lights: {
          lampLight: new THREE.PointLight("#ffd8a5", 42),
          screenLight: new THREE.PointLight(),
          hemisphereLight: new THREE.HemisphereLight(),
          keyLight: new THREE.DirectionalLight(),
        },
        resize: mocks.resize,
      };
    },
    disposeObjectGraph: mocks.disposeObjectGraph,
  };
});

vi.mock("../src/desktop/core/assets", () => ({
  DESKTOP_IMAGE_URLS: {
    avatar: "/avatar.webp",
    avatarFallback: "/avatar.png",
  },
  createDesktopImage: () => {
    const listeners = new Map<string, () => void>();
    return {
      addEventListener: (event: string, callback: () => void) => listeners.set(event, callback),
      removeEventListener: (event: string) => listeners.delete(event),
    };
  },
}));

vi.mock("../src/desktop/core/model-assets", () => ({
  createGlbAssetStore: () => ({}),
  resolveDesktopMouseVariant: (search: string) => search.includes("mouse=glb") ? "glb" : "procedural",
}));

vi.mock("../src/desktop/screens/canvas-utils", () => ({
  makeCanvas: () => ({
    canvas: {},
    context: {
      clearRect() {},
      fillText() {},
      fillRect() {},
      save() {},
      restore() {},
      clip() {},
      drawImage() {},
    },
    texture: new THREE.Texture(),
  }),
  roundRect: vi.fn(),
}));
vi.mock("../src/desktop/screens/main-screen", () => ({ renderMainScreen: vi.fn() }));
vi.mock("../src/desktop/screens/message-board", () => ({ renderMessageBoard: vi.fn() }));
vi.mock("../src/desktop/screens/note-screen", () => ({ renderNoteScreen: vi.fn() }));
vi.mock("../src/desktop/screens/side-screen", () => ({ renderSideScreen: vi.fn() }));

vi.mock("../src/desktop/objects/primitives", () => ({
  createDesktopMaterials: () => ({
    charcoal: new THREE.MeshStandardMaterial(),
    charcoalSoft: new THREE.MeshStandardMaterial(),
    warmWhite: new THREE.MeshStandardMaterial(),
    paleGreen: new THREE.MeshStandardMaterial(),
    wood: new THREE.MeshStandardMaterial(),
  }),
}));

vi.mock("../src/desktop/objects/room", () => ({
  createRoomObject: () => {
    const result = makeGroupResult("room");
    return { ...result, wall: makeMesh("wall") };
  },
}));

vi.mock("../src/desktop/objects/desk", () => ({
  createDeskObject: () => {
    const matSurface = makeMesh("mat-surface");
    const result = makeGroupResult("desk", [matSurface]);
    return {
      ...result,
      matCanvas: {},
      matSurface,
      deskBody: makeMesh("desk-body"),
      deskApron: makeMesh("desk-apron"),
      matBase: makeMesh("mat-base"),
    };
  },
}));

vi.mock("../src/desktop/objects/monitors", () => ({
  createMonitorsObject: () => {
    const mainScreen = makeMesh("main-screen");
    return {
      ...makeGroupResult("monitors", [mainScreen]),
      mainScreen,
      soundbar: makeMesh("soundbar"),
      soundbarLabel: makeMesh("soundbar-label"),
      applyStudyVisuals: mocks.applyStudyVisuals,
      updateMainActions: vi.fn(),
      beginMainTransition: vi.fn(),
      updateMainTransition: vi.fn(),
    };
  },
}));

vi.mock("../src/desktop/objects/computer", () => ({
  createComputerObject: () => makeGroupResult("computer"),
}));
vi.mock("../src/desktop/objects/decorations", () => ({
  createDecorationsObject: () => ({
    ...makeGroupResult("decorations", [makeMesh("quote"), makeMesh("toy-surface")]),
    note: makeMesh("quote-paper"),
    toyBase: makeMesh("toy-base"),
    toyBacking: makeMesh("toy-backing"),
    toySurface: makeMesh("toy-surface"),
  }),
}));
vi.mock("../src/desktop/objects/pegboards", () => ({
  createPegboardsObject: () => ({
    ...makeGroupResult("pegboards", [makeMesh("message-paper"), makeMesh("badge")]),
    board: makeMesh("pegboard"),
    holes: [makeMesh("peg-hole")],
    messagePaper: makeMesh("message-paper"),
    badges: [makeMesh("badge")],
  }),
}));
vi.mock("../src/desktop/objects/lamp", () => ({
  createLampObject: () => makeGroupResult("lamp", [makeMesh("lamp-hit")]),
}));
vi.mock("../src/desktop/objects/keyboard-object", () => ({
  createKeyboardObject: () => ({
    ...makeGroupResult("keyboard", [makeMesh("keyboard-hit")]),
    applyStudyVisual: mocks.applyKeyboardStudyVisual,
    update: vi.fn(),
  }),
}));
vi.mock("../src/desktop/objects/mouse", () => ({
  createMouseObject: () => ({
    ...makeGroupResult("mouse", [makeMesh("mouse-hit")]),
    ready: mocks.mouseReady ?? Promise.resolve("study"),
    update: vi.fn(),
  }),
}));
vi.mock("../src/desktop/objects/mat-controls", () => ({
  createMatControlsObject: () => makeGroupResult("mat-controls", [makeMesh("mat-control")]),
}));

vi.mock("../src/desktop/interactions/dragging", () => ({
  createDraggingController: () => ({ dispose: mocks.draggingDispose }),
}));
vi.mock("../src/desktop/interactions/message", () => ({
  createMessageController: () => ({ dispose: mocks.messageDispose }),
}));
vi.mock("../src/desktop/interactions/mousepad", () => ({
  createMousepadController: () => ({
    draw: vi.fn(),
    addStroke: vi.fn(),
    clear: vi.fn(),
    dispose: mocks.mousepadDispose,
  }),
}));
vi.mock("../src/desktop/interactions/pointer", () => ({
  createPointerController: (options: typeof mocks.pointerOptions) => {
    mocks.pointerOptions = options;
    return { dispose: mocks.pointerDispose, getParallax: () => ({ x: 0, y: 0 }) };
  },
}));

vi.mock("../src/desktop/studies/keyboard-study-model", () => ({
  KEYBOARD_STUDY_FLOOR_Y: 0,
  createKeyboardStudyModel: mocks.createKeyboardStudyModel,
}));
vi.mock("../src/desktop/studies/monitor-visual-set", () => ({
  createMonitorVisualSet: mocks.createMonitorVisualSet,
}));
vi.mock("../src/desktop/studies/remaining-visuals", () => ({
  applyRemainingVisuals: mocks.applyRemainingVisuals,
}));

class ElementStub extends EventTarget {
  dataset: Record<string, string> = {};
  hidden = false;
  value = "";
  textContent = "";
  classList = { add: vi.fn(), remove: vi.fn() };
  appendChild = vi.fn();
  focus = vi.fn();
  querySelector(selector: string) {
    return this.childrenBySelector.get(selector) ?? null;
  }
  childrenBySelector = new Map<string, ElementStub>();
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const createRoot = () => {
  const root = new ElementStub();
  const mount = new ElementStub();
  const loading = new ElementStub();
  const fallback = new ElementStub();
  const fallbackImage = new ElementStub();
  const status = new ElementStub();
  const messagePanel = new ElementStub();
  const messageInput = new ElementStub();
  fallback.childrenBySelector.set("[data-fallback-image]", fallbackImage);
  root.childrenBySelector.set("[data-scene-mount]", mount);
  root.childrenBySelector.set("[data-scene-loading]", loading);
  root.childrenBySelector.set("[data-webgl-fallback]", fallback);
  root.childrenBySelector.set("[data-interaction-status]", status);
  root.childrenBySelector.set("[data-message-panel]", messagePanel);
  root.childrenBySelector.set("#mat-message", messageInput);
  return { root, status };
};

const mountFullScene = () => {
  vi.stubGlobal("window", {
    innerWidth: 1280,
    innerHeight: 720,
    devicePixelRatio: 1,
    location: { search: "?desktop=refined" },
    matchMedia: () => ({ matches: true }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    clearTimeout,
    setTimeout,
    open: vi.fn(),
  });
  const ui = createRoot();
  const dispose = mountDesktopScene(ui.root as unknown as HTMLElement);
  expect(dispose).toBeTypeOf("function");
  return { ...ui, dispose: dispose! };
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rafCallbacks = [];
  mocks.nextRaf = 1;
  mocks.mouseReady = Promise.resolve("study");
  mocks.mouseReadyResolve = undefined;
  mocks.applyRemainingVisuals.mockReturnValue({
    group: new THREE.Group(),
    stats: { triangles: 321, textureBytes: 654 },
    setLampBrightness: vi.fn(),
    dispose: vi.fn(),
  });
  vi.stubGlobal("performance", { now: () => 0 });
  vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
    mocks.rafCallbacks.push(callback);
    return mocks.nextRaf++;
  }));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("remaining scene lifecycle", () => {
  it("keeps full preset unavailable when remaining visual setup fails without changing original targets", async () => {
    mocks.applyRemainingVisuals.mockImplementation(() => {
      throw new Error("injected remaining failure");
    });
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { root, dispose } = mountFullScene();
    const originalTargets = [...mocks.pointerOptions!.interactiveTargets];
    await flush();
    await flush();

    expect(root.dataset.desktopModel).toBe("unavailable");
    expect(warning).toHaveBeenCalledWith(
      "Complete desk preview could not be applied; existing visuals retained.",
      expect.any(Error),
    );
    expect(mocks.pointerOptions!.interactiveTargets).toEqual(originalTargets);
    expect(mocks.pointerOptions!.interactiveTargets).toHaveLength(originalTargets.length);

    dispose();
  });

  it("ignores late full-preset readiness after the pagehide dispose path runs", async () => {
    mocks.mouseReady = new Promise((resolve) => {
      mocks.mouseReadyResolve = resolve;
    });
    const { root, dispose } = mountFullScene();
    expect(root.dataset.desktopModel).toBe("loading");

    dispose();
    mocks.mouseReadyResolve!("study");
    await flush();
    await flush();

    expect(mocks.applyRemainingVisuals).not.toHaveBeenCalled();
    expect(root.dataset.desktopModel).toBeUndefined();
    expect(root.dataset.remainingTextureBytes).toBeUndefined();
    expect(root.dataset.remainingTriangles).toBeUndefined();
    expect(mocks.pointerDispose).toHaveBeenCalledOnce();
    expect(mocks.rendererDispose).toHaveBeenCalledOnce();
    expect(mocks.rendererRemove).toHaveBeenCalledOnce();
  });

  it("applies the ready full preset, syncs lamp actions, and does not add remaining visuals to pointer targets", async () => {
    const remainingDispose = vi.fn();
    const setLampBrightness = vi.fn();
    const remainingGroup = new THREE.Group();
    remainingGroup.add(makeMesh("visual-only-mesh"));
    mocks.applyRemainingVisuals.mockReturnValue({
      group: remainingGroup,
      stats: { triangles: 4321, textureBytes: 1024 },
      setLampBrightness,
      dispose: remainingDispose,
    });

    const { root, dispose } = mountFullScene();
    const originalTargets = [...mocks.pointerOptions!.interactiveTargets];
    await flush();
    await flush();

    expect(root.dataset.desktopModel).toBe("refined");
    expect(root.dataset.remainingTriangles).toBe("4321");
    expect(root.dataset.remainingTextureBytes).toBe("1024");
    expect(mocks.applyRemainingVisuals).toHaveBeenCalledOnce();
    expect(mocks.pointerOptions!.interactiveTargets).toEqual(originalTargets);
    expect(mocks.pointerOptions!.interactiveTargets).not.toContain(remainingGroup.children[0]);

    mocks.pointerOptions!.applyAction("lamp");
    expect(setLampBrightness).toHaveBeenLastCalledWith(14);
    mocks.pointerOptions!.applyAction("lamp");
    expect(setLampBrightness).toHaveBeenLastCalledWith(55);

    dispose();
    dispose();
    expect(remainingDispose).toHaveBeenCalledOnce();
    expect(mocks.rendererDispose).toHaveBeenCalledOnce();
    expect(mocks.pointerDispose).toHaveBeenCalledOnce();
  });
});
