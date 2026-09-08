import * as THREE from "three";
import { disposeObjectGraph } from "../core/renderer";
import {
  createGlbAssetStore,
  DESKTOP_MODEL_URLS,
  type GlbAssetStore,
} from "../core/model-assets";
import { makeCanvas } from "../screens/canvas-utils";
import { createMousepadController } from "../interactions/mousepad";
import { createComputerStudyVisual } from "./computer-study-model";
import { createLampStudyVisual } from "./lamp-study-model";
import { createSoundbarStudyVisual } from "./soundbar-study-model";
import { createKeyboardStudyModel } from "./keyboard-study-model";
import { createMonitorStudyVisual } from "./monitor-study-model";
import { applyEnvironmentFinish, type EnvironmentFinishRefs } from "./environment-finish";
import { createDecorationsObject } from "../objects/decorations";
import { createDeskObject } from "../objects/desk";
import { createPegboardsObject } from "../objects/pegboards";
import { createDesktopMaterials } from "../objects/primitives";
import { createRoomObject } from "../objects/room";
import { DESK_LAYOUT } from "../layout";

export interface GalleryItem {
  id: string;
  label: string;
}

export interface GalleryModel {
  root: THREE.Group;
  dispose: () => void;
  label: string;
  note?: string;
}

interface GalleryLoaderOptions {
  mouseAssetStore?: Pick<GlbAssetStore, "acquire">;
}

type GalleryModelFactory = () => Promise<GalleryModel> | GalleryModel;

export const GALLERY_ITEMS = [
  { id: "computer", label: "机箱" },
  { id: "lamp", label: "台灯" },
  { id: "soundbar", label: "音箱" },
  { id: "keyboard", label: "键盘" },
  { id: "mouse", label: "鼠标" },
  { id: "main-monitor", label: "主显示器" },
  { id: "portrait-monitor", label: "竖屏" },
  { id: "desk", label: "桌面环境" },
] as const satisfies readonly GalleryItem[];

const defaultMouseAssetStore = createGlbAssetStore();

const once = (dispose: () => void) => {
  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    dispose();
  };
};

const createDisposableModel = (
  root: THREE.Group,
  label: string,
  note?: string,
  dispose = () => disposeObjectGraph(root),
): GalleryModel => ({
  root,
  label,
  note,
  dispose: once(dispose),
});

const prepareCanvas = (width: number, height: number, draw: (context: CanvasRenderingContext2D) => void) => {
  const surface = makeCanvas(width, height);
  draw(surface.context);
  surface.texture.needsUpdate = true;
  return surface;
};

const collectRootMaterials = (root: THREE.Object3D) => {
  const materials = new Set<THREE.Material>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => materials.add(material));
  });
  return materials;
};

const createMonitorGalleryModel = (variant: "main" | "portrait") => {
  const root = createMonitorStudyVisual(variant);
  const screenSize = variant === "portrait" ? DESK_LAYOUT.leftMonitor.screen.size : DESK_LAYOUT.mainMonitor.screen.size;
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(screenSize.width, screenSize.height),
    new THREE.MeshBasicMaterial({ color: "#141719", toneMapped: false }),
  );
  screen.name = "gallery-dark-screen";
  screen.position.z = 0.002;
  root.add(screen);
  return createDisposableModel(
    root,
    variant === "portrait" ? "竖屏" : "主显示器",
    variant === "portrait"
      ? "竖屏结构样件；暗屏用于检查边框不穿孔，完整内容去整桌查看。"
      : "主显示器结构样件；暗屏用于检查边框不穿孔，完整内容去整桌查看。",
  );
};

const createDeskGalleryModel = () => {
  const root = new THREE.Group();
  root.name = "desk-gallery-environment";
  const materials = createDesktopMaterials();
  const ownedDisposers: Array<() => void> = [];
  const looseTextures = new Set<THREE.Texture>();
  let finishDispose: (() => void) | undefined;
  const dispose = () => {
    finishDispose?.();
    ownedDisposers.splice(0).forEach(disposeEntry => disposeEntry());
    const rootMaterials = collectRootMaterials(root);
    disposeObjectGraph(root);
    looseTextures.forEach(texture => texture.dispose());
    Object.values(materials).forEach(material => {
      if (!rootMaterials.has(material)) material.dispose();
    });
  };

  try {
    const room = createRoomObject();
    root.add(room.group);
    const desk = createDeskObject(materials);
    root.add(desk.group);
    const mousepad = createMousepadController(desk.matCanvas);
    mousepad.draw();
    ownedDisposers.push(() => mousepad.dispose());

    const messageBoardCanvas = prepareCanvas(640, 440, (context) => {
      context.fillStyle = "#eee4d5";
      context.fillRect(0, 0, 640, 440);
      context.fillStyle = "#5f675d";
      context.font = '500 54px "Microsoft YaHei", sans-serif';
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText("内容整理中", 320, 220);
    });
    looseTextures.add(messageBoardCanvas.texture);
    const noteCanvas = prepareCanvas(420, 300, (context) => {
      context.fillStyle = "#f4d77c";
      context.fillRect(0, 0, 420, 300);
      context.fillStyle = "#4a3f2d";
      context.font = '500 34px "Microsoft YaHei", sans-serif';
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText("保持好奇", 210, 130);
      context.fillText("继续动手", 210, 180);
    });
    looseTextures.add(noteCanvas.texture);
    const pegboard = createPegboardsObject(messageBoardCanvas);
    root.add(pegboard.group);
    looseTextures.delete(messageBoardCanvas.texture);
    const decorations = createDecorationsObject(noteCanvas, materials);
    root.add(decorations.group);
    looseTextures.delete(noteCanvas.texture);
    const computerCase = createComputerStudyVisual();
    root.add(computerCase);
    ownedDisposers.push(
      () => room.dispose?.(),
      () => desk.dispose?.(),
      () => pegboard.dispose?.(),
      () => decorations.dispose?.(),
    );

    const refs: EnvironmentFinishRefs = {
      deskBody: desk.deskBody,
      deskApron: desk.deskApron,
      matBase: desk.matBase,
      matSurface: desk.matSurface,
      wall: room.wall,
      pegboard: pegboard.board,
      pegHoles: pegboard.holes,
      messagePaper: pegboard.messagePaper,
      badges: pegboard.badges,
      quotePaper: decorations.note,
      toyBase: decorations.toyBase,
      toyBacking: decorations.toyBacking,
      toySurface: decorations.toySurface,
    };
    const finish = applyEnvironmentFinish(refs);
    finishDispose = finish.dispose;
    root.add(finish.group);

    return createDisposableModel(root, "桌面环境", "桌面、墙面、洞洞板和立牌材质检查；隐藏结构为合理近似。", dispose);
  } catch (error) {
    dispose();
    throw error;
  }
};

const createMouseGalleryModel = async (assetStore: Pick<GlbAssetStore, "acquire">) => {
  const lease = await assetStore.acquire(DESKTOP_MODEL_URLS.mouseStudy);
  lease.scene.name = "mouse-gallery-glb";
  lease.scene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  return createDisposableModel(lease.scene, "鼠标", "复用现有 GLB store lease；释放时只 release 一次。", lease.release);
};

export const createGalleryModelLoader = (
  options: GalleryLoaderOptions = {},
) => {
  const mouseAssetStore = options.mouseAssetStore ?? defaultMouseAssetStore;
  const factories: Record<(typeof GALLERY_ITEMS)[number]["id"], GalleryModelFactory> = {
    computer: () => createDisposableModel(createComputerStudyVisual(), "机箱", "机箱结构样件；便利贴与顶部立牌由桌面环境项统一检查。"),
    lamp: () => {
      const visual = createLampStudyVisual();
      return createDisposableModel(visual.group, "台灯", "台灯结构样件；灯光强度只用于材质外观检查。");
    },
    soundbar: () => createDisposableModel(createSoundbarStudyVisual({ withBrand: true }), "音箱", "音箱结构样件；正面品牌字样在素模中隐藏。"),
    keyboard: () => createDisposableModel(createKeyboardStudyModel({ withLegends: true }), "键盘", "键盘结构样件；键帽文字在素模中隐藏。"),
    mouse: () => createMouseGalleryModel(mouseAssetStore),
    "main-monitor": () => createMonitorGalleryModel("main"),
    "portrait-monitor": () => createMonitorGalleryModel("portrait"),
    desk: createDeskGalleryModel,
  };

  return async (id: string): Promise<GalleryModel> => {
    const factory = factories[id as keyof typeof factories];
    if (!factory) throw new Error(`Unknown gallery model: ${id}`);
    return factory();
  };
};

export const loadGalleryModel = createGalleryModelLoader();
