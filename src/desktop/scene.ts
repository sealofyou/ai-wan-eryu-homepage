import * as THREE from "three";
import { resolveDesktopPreview } from "./core/preview-options";
import {
  DAILY_QUOTES,
  createInitialDesktopState,
  cycleQuote,
  moveKeyboard,
  movePhysicalMouse,
  returnFromContent,
  selectContentItem,
  selectSection,
  selectScreen,
  setContentPage,
  setMatMode,
  setMessage,
  type DesktopState,
  type MatMode,
  type Point,
  type ScreenId,
} from "./model";
import { createDesktopImage, DESKTOP_IMAGE_URLS } from "./core/assets";
import {
  createGlbAssetStore,
} from "./core/model-assets";
import {
  createDesktopRendererEnvironment,
  disposeObjectGraph,
  resolveDesktopCameraMode,
  type DesktopRendererEnvironment,
} from "./core/renderer";
import type { SceneAction, SceneObjectResult } from "./core/types";
import {
  resolveContentUrl,
  sortDesktopItems,
  type ContentSectionId,
  type DesktopContentPayload,
} from "./content";
import { makeCanvas } from "./screens/canvas-utils";
import { renderMainScreen } from "./screens/main-screen";
import { renderMessageBoard } from "./screens/message-board";
import { renderNoteScreen } from "./screens/note-screen";
import { renderSideScreen } from "./screens/side-screen";
import { createComputerObject } from "./objects/computer";
import { createDecorationsObject } from "./objects/decorations";
import { createDeskObject } from "./objects/desk";
import { createLampObject } from "./objects/lamp";
import { createKeyboardObject } from "./objects/keyboard-object";
import { createMatControlsObject } from "./objects/mat-controls";
import { createMonitorsObject } from "./objects/monitors";
import { createMouseObject } from "./objects/mouse";
import { createPegboardsObject } from "./objects/pegboards";
import { createDesktopMaterials } from "./objects/primitives";
import { createRoomObject } from "./objects/room";
import { createDraggingController } from "./interactions/dragging";
import { createMessageController } from "./interactions/message";
import { createMousepadController } from "./interactions/mousepad";
import { createPointerController } from "./interactions/pointer";

declare global {
  interface Window {
    __ERYU_DESKTOP__?: {
      getState: () => DesktopState;
      selectScreen: (screen: ScreenId) => void;
      selectSection: (section: ContentSectionId) => void;
      selectContentItem: (itemId: string) => void;
      moveMouseNormalized: (x: number, y: number) => void;
      moveKeyboardNormalized: (x: number, y: number) => void;
      setMatMode: (mode: MatMode) => void;
      setMessage: (message: string) => void;
      addStroke: (points: Point[]) => void;
      clearDrawing: () => void;
      cycleQuote: () => void;
      clickBadge: () => void;
    };
  }
}

export function mountDesktopScene(
  root: HTMLElement,
  contentPayload: DesktopContentPayload = { items: [] },
) {
  if (window.innerWidth <= 900) return;

  const mount = root.querySelector<HTMLElement>("[data-scene-mount]");
  const loading = root.querySelector<HTMLElement>("[data-scene-loading]");
  const fallback = root.querySelector<HTMLElement>("[data-webgl-fallback]");
  const fallbackImage = fallback?.querySelector<HTMLImageElement>(
    "[data-fallback-image]",
  );
  const status = root.querySelector<HTMLElement>("[data-interaction-status]");
  const messagePanel = root.querySelector<HTMLFormElement>("[data-message-panel]");
  const messageInput = root.querySelector<HTMLInputElement>("#mat-message");
  if (!mount || !loading || !fallback || !status || !messagePanel || !messageInput) return;

  const contentItems = sortDesktopItems(contentPayload.items);
  const contentById = new Map(contentItems.map((item) => [item.id, item]));
  const itemsForSection = (section: ContentSectionId) =>
    contentItems.filter((item) => item.section === section);

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let environment: DesktopRendererEnvironment;
  try {
    environment = createDesktopRendererEnvironment(mount, reducedMotion);
  } catch {
    const fallbackSource = fallbackImage?.dataset.src;
    if (fallbackImage && fallbackSource) fallbackImage.src = fallbackSource;
    fallback.hidden = false;
    loading.hidden = true;
    return;
  }
  const { renderer, scene, camera, world } = environment;
  const { lampLight } = environment.lights;
  const currentCameraTarget = (
    reducedMotion ? environment.cameraPoses.overview.target : environment.cameraPoses.intro.target
  ).clone();

  const sceneObjects: SceneObjectResult[] = [];
  const addSceneObject = <T extends SceneObjectResult>(object: T) => {
    sceneObjects.push(object);
    world.add(object.group);
    return object;
  };

  const materials = createDesktopMaterials();
  const preview = resolveDesktopPreview(window.location.search);
  const roomObject = addSceneObject(createRoomObject());
  const deskObject = addSceneObject(createDeskObject(materials));
  const { matCanvas, matSurface } = deskObject;
  const mousepad = createMousepadController(matCanvas);

  const mainCanvas = makeCanvas(1200, 680);
  const sideCanvas = makeCanvas(440, 880);
  const noteCanvas = makeCanvas(420, 300);
  const messageBoardCanvas = makeCanvas(640, 440);
  const avatarImage = createDesktopImage(
    DESKTOP_IMAGE_URLS.avatar,
    DESKTOP_IMAGE_URLS.avatarFallback,
  );

  const drawMainScreen = () => {
    renderMainScreen({
      surface: mainCanvas,
      state,
      avatarImage,
      contentById,
      itemsForSection,
    });
  };

  const drawSideScreen = () => renderSideScreen(sideCanvas, state.activeScreen);

  const drawNote = () => renderNoteScreen(noteCanvas, DAILY_QUOTES[state.quoteIndex]);

  const drawMessageBoard = () => renderMessageBoard(messageBoardCanvas, state.message);

  const monitors = addSceneObject(createMonitorsObject({
    mainCanvas,
    sideCanvas,
    materials,
    contentById,
    itemsForSection,
  }));
  const { mainScreen } = monitors;

  const computerObject = addSceneObject(createComputerObject(materials));
  const decorationsObject = addSceneObject(createDecorationsObject(noteCanvas, materials));
  const pegboardsObject = addSceneObject(createPegboardsObject(messageBoardCanvas));
  const lampObject = addSceneObject(createLampObject(materials));

  const keyboardObject = addSceneObject(createKeyboardObject());
  const mouseVariant = preview.mouse;
  const modelAssets = mouseVariant !== "procedural" ? createGlbAssetStore() : undefined;
  const mouseObject = addSceneObject(createMouseObject(materials, {
    variant: mouseVariant,
    assetStore: modelAssets,
  }));
  const keyboard = keyboardObject.group;
  let sceneDisposed = false;
  const previewReady: Promise<unknown>[] = [mouseObject.ready];
  root.dataset.keyboardModel = "baseline";
  if (preview.keyboard === "study") {
    previewReady.push(import("./studies/keyboard-study-model").then(({ createKeyboardStudyModel, KEYBOARD_STUDY_FLOOR_Y }) => {
      if (sceneDisposed) return;
      const visual = createKeyboardStudyModel({ withLegends: true });
      if (keyboardObject.applyStudyVisual(visual, KEYBOARD_STUDY_FLOOR_Y)) root.dataset.keyboardModel = "study";
    }).catch(() => {
      if (!sceneDisposed) {
        root.dataset.keyboardModel = "unavailable";
        console.warn("Keyboard preview could not be applied; baseline retained.");
      }
    }));
  }
  root.dataset.monitorModel = "baseline";
  if (preview.monitors === "study") {
    previewReady.push(import("./studies/monitor-visual-set").then(({ createMonitorVisualSet }) => {
      if (sceneDisposed) return;
      const visuals = createMonitorVisualSet();
      if (monitors.applyStudyVisuals(visuals)) root.dataset.monitorModel = "study";
    }).catch(() => {
      if (!sceneDisposed) {
        root.dataset.monitorModel = "unavailable";
        console.warn("Monitor preview could not be applied; baseline retained.");
      }
    }));
  }
  root.dataset.mouseModel = "procedural";
  void mouseObject.ready.then((resolvedVariant) => {
    if (!sceneDisposed) root.dataset.mouseModel = resolvedVariant;
  });

  const matControls = addSceneObject(createMatControlsObject(materials, {
    visible: preview.matControls,
  }));
  const interactiveTargets = sceneObjects.flatMap(
    (object) => object.interactiveTargets ?? [],
  );
  let disposeFinish: (() => void) | undefined;
  let remainingVisuals: ReturnType<typeof import("./studies/remaining-visuals").applyRemainingVisuals> | undefined;
  root.dataset.desktopModel = preview.full ? "loading" : "baseline";
  if (preview.full) {
    void Promise.all([import("./studies/remaining-visuals"), ...previewReady]).then(([{ applyRemainingVisuals }]) => {
      if (sceneDisposed) return;
      if (root.dataset.keyboardModel !== "study" || root.dataset.monitorModel !== "study" || root.dataset.mouseModel !== "study") {
        throw new Error("An accepted model was unavailable; remaining preview not applied.");
      }
      remainingVisuals = applyRemainingVisuals({
        world, lampLight,
        reflectionEnvironment: environment,
        originals: [computerObject.group, lampObject.group, monitors.soundbar, monitors.soundbarLabel],
        refs: {
          deskBody: deskObject.deskBody, deskApron: deskObject.deskApron,
          matBase: deskObject.matBase, matSurface, wall: roomObject.wall,
          pegboard: pegboardsObject.board, pegHoles: pegboardsObject.holes,
          messagePaper: pegboardsObject.messagePaper, badges: pegboardsObject.badges,
          quotePaper: decorationsObject.note, toyBase: decorationsObject.toyBase,
          toyBacking: decorationsObject.toyBacking, toySurface: decorationsObject.toySurface,
        },
      });
      root.dataset.desktopModel = "refined";
      root.dataset.remainingTextureBytes = String(remainingVisuals.stats.textureBytes);
      root.dataset.remainingTriangles = String(remainingVisuals.stats.triangles);
    }).catch((error: unknown) => {
      if (sceneDisposed) return;
      root.dataset.desktopModel = "unavailable";
      console.warn("Complete desk preview could not be applied; existing visuals retained.", error);
    });
  }
  root.dataset.finish = "baseline";
  if (preview.studio) {
    void import("./finishes/studio").then(({ applyStudioFinish }) => {
      if (sceneDisposed) return;
      disposeFinish = applyStudioFinish({
        environment, materials, matSurface,
        monitors: monitors.group, lamp: lampObject.group,
      });
      root.dataset.finish = "studio";
    }).catch((error: unknown) => {
      if (!sceneDisposed) {
        root.dataset.finish = "unavailable";
        console.warn("Material preview could not be applied; baseline retained.", error);
      }
    });
  }

  let state = createInitialDesktopState();
  let statusTimer = 0;
  const announce = (message: string) => {
    status.textContent = message;
    status.classList.add("is-visible");
    window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => status.classList.remove("is-visible"), 1500);
  };

  const updatePositions = () => {
    mouseObject.update?.(state);
    keyboardObject.update?.(state);
  };

  const updateModeButtons = () => {
    matControls.update?.(state);
    messagePanel.hidden = false;
    if (state.matMode === "message") window.setTimeout(() => messageInput.focus(), 30);
  };

  const updateScreens = () => {
    drawMainScreen();
    drawSideScreen();
    monitors.updateMainActions(state);
    drawNote();
    drawMessageBoard();
    mousepad.draw();
    updatePositions();
    updateModeButtons();
  };

  const setScreen = (screen: ScreenId) => {
    state = selectScreen(state, screen);
    updateScreens();
    monitors.beginMainTransition(reducedMotion);
    announce(screen === "home" ? "已返回主屏首页" : "主屏内容已切换");
  };

  const setSection = (section: ContentSectionId) => {
    state = selectSection(state, section);
    updateScreens();
    monitors.beginMainTransition(reducedMotion);
    announce("主屏已打开内容列表");
  };

  const setMode = (mode: MatMode) => {
    state = setMatMode(state, mode);
    updateModeButtons();
    announce(mode === "draw" ? "画笔已拿起" : mode === "message" ? "留言纸已展开" : "现在可以拖动物件");
  };

  const clearDrawing = () => {
    mousepad.clear();
    announce("鼠标垫笔迹已清空");
  };

  avatarImage.addEventListener("load", drawMainScreen);
  updateScreens();

  const applyAction = (action: SceneAction | undefined) => {
    if (!action) return;
    if (action.startsWith("screen:")) {
      setScreen(action.slice(7) as ScreenId);
    } else if (action.startsWith("section:")) {
      setSection(action.slice(8) as ContentSectionId);
    } else if (action.startsWith("content:")) {
      state = selectContentItem(state, action.slice(8));
      updateScreens();
      monitors.beginMainTransition(reducedMotion);
      announce("已打开内容预览");
    } else if (action.startsWith("mode:")) {
      setMode(action.slice(5) as MatMode);
    } else if (action === "content-back") {
      state = returnFromContent(state);
      updateScreens();
      monitors.beginMainTransition(reducedMotion);
    } else if (action === "page-prev" || action === "page-next") {
      if (state.contentView.kind === "list") {
        const nextPage = state.contentView.page + (action === "page-next" ? 1 : -1);
        state = setContentPage(state, nextPage);
        updateScreens();
        monitors.beginMainTransition(reducedMotion);
      }
    } else if (action === "content-open") {
      if (state.contentView.kind === "preview") {
        const item = contentById.get(state.contentView.itemId);
        const targetUrl = item ? resolveContentUrl(item) : null;
        if (targetUrl) window.open(targetUrl, "_blank", "noopener,noreferrer");
      }
    } else if (action === "quote") {
      state = cycleQuote(state);
      drawNote();
      announce(DAILY_QUOTES[state.quoteIndex]);
    } else if (action === "message") {
      setMode("message");
      messageInput.focus();
      announce("已选中洞洞板纸条，输入后按回车写入");
    } else if (action === "badge") {
      setScreen("badge");
    } else if (action === "clear") {
      clearDrawing();
    } else if (action === "lamp") {
      lampLight.intensity = lampLight.intensity > 30 ? 14 : 55;
      remainingVisuals?.setLampBrightness(lampLight.intensity);
      announce(lampLight.intensity > 30 ? "台灯已调亮" : "台灯已调暗");
    }
  };

  const getState = () => state;
  const setState = (nextState: DesktopState) => {
    state = nextState;
  };
  const dragging = createDraggingController({
    element: renderer.domElement,
    keyboard,
    getState,
    setState,
    updatePositions,
    drawMainScreen,
    announce,
  });
  const pointerController = createPointerController({
    root,
    renderer,
    camera,
    interactiveTargets,
    matSurface,
    mainScreen,
    reducedMotion,
    dragging,
    mousepad,
    getState,
    setState,
    itemsForSection,
    updateScreens,
    applyAction,
  });
  const messageController = createMessageController({
    root,
    messagePanel,
    messageInput,
    getState,
    setState,
    setScreen,
    setSection,
    setMode,
    applyAction,
    clearDrawing,
    drawMainScreen,
    drawMessageBoard,
    announce,
  });

  window.__ERYU_DESKTOP__ = {
    getState: () => structuredClone(state),
    selectScreen: setScreen,
    selectSection: setSection,
    selectContentItem: (itemId) => {
      state = selectContentItem(state, itemId);
      updateScreens();
      monitors.beginMainTransition(reducedMotion);
    },
    moveMouseNormalized: (x, y) => {
      state = movePhysicalMouse(state, { x, y });
      updatePositions();
      drawMainScreen();
    },
    moveKeyboardNormalized: (x, y) => {
      state = moveKeyboard(state, { x, y });
      updatePositions();
    },
    setMatMode: setMode,
    setMessage: (message) => {
       state = setMessage(state, message);
       messageInput.value = state.message;
       drawMainScreen();
       drawMessageBoard();
    },
    addStroke: (points) => {
      mousepad.addStroke(points);
    },
    clearDrawing,
    cycleQuote: () => applyAction("quote"),
    clickBadge: () => applyAction("badge"),
  };

  const startTime = performance.now();
  const desiredCameraPosition = new THREE.Vector3();
  let animationFrame = 0;
  const animate = (time: number) => {
    const elapsed = time - startTime;
    if (reducedMotion) {
      const pose = environment.cameraPoses.overview;
      camera.position.copy(pose.position);
      currentCameraTarget.copy(pose.target);
    } else if (elapsed < 1200) {
      const progress = 1 - Math.pow(1 - Math.min(elapsed / 1200, 1), 3);
      camera.position.lerpVectors(
        environment.cameraPoses.intro.position,
        environment.cameraPoses.overview.position,
        progress,
      );
      currentCameraTarget.lerpVectors(
        environment.cameraPoses.intro.target,
        environment.cameraPoses.overview.target,
        progress,
      );
    } else {
      const mode = resolveDesktopCameraMode(state.activeScreen !== "home", reducedMotion);
      const pose = environment.cameraPoses[mode];
      const parallax = mode === "overview" ? pointerController.getParallax() : { x: 0, y: 0 };
      desiredCameraPosition.copy(pose.position);
      desiredCameraPosition.x += parallax.x;
      desiredCameraPosition.y -= parallax.y;
      camera.position.lerp(desiredCameraPosition, 0.065);
      currentCameraTarget.lerp(pose.target, 0.075);
    }
    monitors.updateMainTransition(time);
    camera.lookAt(currentCameraTarget);
    renderer.render(scene, camera);
    animationFrame = requestAnimationFrame(animate);
  };
  animationFrame = requestAnimationFrame(animate);

  window.addEventListener("resize", environment.resize);

  const readyFrame = requestAnimationFrame(() => {
    loading.classList.add("is-ready");
    root.dataset.ready = "true";
  });

  return () => {
    if (sceneDisposed) return;
    sceneDisposed = true;
    cancelAnimationFrame(animationFrame);
    cancelAnimationFrame(readyFrame);
    pointerController.dispose();
    dragging.dispose();
    mousepad.dispose();
    messageController.dispose();
    window.removeEventListener("resize", environment.resize);
    avatarImage.removeEventListener("load", drawMainScreen);
    window.clearTimeout(statusTimer);
    remainingVisuals?.dispose();
    disposeFinish?.();
    sceneObjects.forEach((object) => object.dispose?.());
    disposeObjectGraph(world);
    renderer.dispose();
    renderer.domElement.remove();
    delete window.__ERYU_DESKTOP__;
    delete root.dataset.ready;
    delete root.dataset.mouseModel;
    delete root.dataset.keyboardModel;
    delete root.dataset.monitorModel;
    delete root.dataset.finish;
    delete root.dataset.desktopModel;
    delete root.dataset.remainingTextureBytes;
    delete root.dataset.remainingTriangles;
  };
}
