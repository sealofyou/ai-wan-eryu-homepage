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
  createDesktopRendererEnvironment,
  disposeObjectGraph,
  type DesktopRendererEnvironment,
} from "./core/renderer";
import type { SceneAction } from "./core/types";
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
  const { renderer, scene, camera, world, cameraTarget } = environment;
  const { lampLight } = environment.lights;

  const materials = createDesktopMaterials();
  world.add(createRoomObject().group);
  const deskObject = createDeskObject(materials);
  world.add(deskObject.group);
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

  const monitors = createMonitorsObject({
    mainCanvas,
    sideCanvas,
    materials,
    contentById,
    itemsForSection,
  });
  world.add(monitors.group);
  const { mainScreen } = monitors;

  world.add(createComputerObject(materials).group);
  world.add(createDecorationsObject(noteCanvas, materials).group);
  world.add(createPegboardsObject(messageBoardCanvas).group);
  world.add(createLampObject(materials).group);

  const keyboardObject = createKeyboardObject();
  const mouseObject = createMouseObject(materials);
  const keyboard = keyboardObject.group;
  const mouse = mouseObject.group;
  world.add(keyboard, mouse);

  const matControls = createMatControlsObject(materials);
  world.add(matControls.group);

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
    announce(screen === "home" ? "已返回主屏首页" : "主屏内容已切换");
  };

  const setSection = (section: ContentSectionId) => {
    state = selectSection(state, section);
    updateScreens();
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
      announce("已打开内容预览");
    } else if (action.startsWith("mode:")) {
      setMode(action.slice(5) as MatMode);
    } else if (action === "content-back") {
      state = returnFromContent(state);
      updateScreens();
    } else if (action === "page-prev" || action === "page-next") {
      if (state.contentView.kind === "list") {
        const nextPage = state.contentView.page + (action === "page-next" ? 1 : -1);
        state = setContentPage(state, nextPage);
        updateScreens();
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
    world,
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
  let animationFrame = 0;
  const animate = (time: number) => {
    const elapsed = time - startTime;
    if (!reducedMotion && elapsed < 1400) {
      const progress = 1 - Math.pow(1 - Math.min(elapsed / 1400, 1), 3);
      camera.position.lerpVectors(environment.introCamera, environment.finalCamera, progress);
    } else {
      const parallax = pointerController.getParallax();
      camera.position.x += (environment.finalCamera.x + parallax.x - camera.position.x) * 0.035;
      camera.position.y += (environment.finalCamera.y - parallax.y - camera.position.y) * 0.035;
    }
    camera.lookAt(cameraTarget);
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
    cancelAnimationFrame(animationFrame);
    cancelAnimationFrame(readyFrame);
    pointerController.dispose();
    dragging.dispose();
    mousepad.dispose();
    messageController.dispose();
    window.removeEventListener("resize", environment.resize);
    avatarImage.removeEventListener("load", drawMainScreen);
    window.clearTimeout(statusTimer);
    disposeObjectGraph(world);
    renderer.dispose();
    renderer.domElement.remove();
    delete window.__ERYU_DESKTOP__;
    delete root.dataset.ready;
  };
}
