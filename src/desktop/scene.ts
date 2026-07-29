import * as THREE from "three";
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
import { createKeyboardModel } from "./keyboard";
import { DESK_LAYOUT } from "./layout";
import { actionFromObject, addAction } from "./core/actions";
import { createDesktopImage, DESKTOP_IMAGE_URLS } from "./core/assets";
import {
  createDesktopRendererEnvironment,
  type DesktopRendererEnvironment,
} from "./core/renderer";
import type { SceneAction } from "./core/types";
import {
  getContentPage,
  resolveContentUrl,
  sortDesktopItems,
  type ContentSectionId,
  type DesktopContentPayload,
} from "./content";
import {
  makeCanvas,
  roundRect,
} from "./screens/canvas-utils";
import { renderMainScreen } from "./screens/main-screen";
import { renderMessageBoard } from "./screens/message-board";
import { renderNoteScreen } from "./screens/note-screen";
import { renderSideScreen } from "./screens/side-screen";
import { createComputerObject } from "./objects/computer";
import { createDeskObject } from "./objects/desk";
import { createMonitorsObject } from "./objects/monitors";
import {
  createDesktopMaterials,
  makeTextMaterial,
  roundedMesh,
} from "./objects/primitives";
import { createRoomObject } from "./objects/room";

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

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const lerpRange = (value: number, start: number, end: number, nextStart: number, nextEnd: number) =>
  nextStart + ((value - start) / (end - start)) * (nextEnd - nextStart);

export function mountDesktopScene(
  root: HTMLElement,
  contentPayload: DesktopContentPayload = { items: [] },
) {
  if (window.innerWidth <= 900) return;

  const mount = root.querySelector<HTMLElement>("[data-scene-mount]");
  const loading = root.querySelector<HTMLElement>("[data-scene-loading]");
  const fallback = root.querySelector<HTMLElement>("[data-webgl-fallback]");
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
    fallback.hidden = false;
    loading.hidden = true;
    return;
  }
  const { renderer, scene, camera, world, cameraTarget } = environment;
  const { lampLight } = environment.lights;

  const materials = createDesktopMaterials();
  const { charcoal, charcoalSoft, warmWhite, paleGreen } = materials;
  world.add(createRoomObject().group);
  const deskObject = createDeskObject(materials);
  world.add(deskObject.group);
  const { matCanvas, matSurface } = deskObject;
  const strokes: Point[][] = [];
  let activeStroke: Point[] | null = null;

  const mainCanvas = makeCanvas(1200, 680);
  const sideCanvas = makeCanvas(440, 880);
  const noteCanvas = makeCanvas(420, 300);
  const messageBoardCanvas = makeCanvas(640, 440);
  const avatarImage = createDesktopImage(DESKTOP_IMAGE_URLS.avatar);

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

  const drawMat = () => {
    const { context, canvas, texture } = matCanvas;
    context.fillStyle = "#dfd8cc";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "#95a9a0";
    context.lineWidth = 12;
    roundRect(context, 10, 10, canvas.width - 20, canvas.height - 20, 38);
    context.stroke();
    context.fillStyle = "rgba(119,145,132,0.12)";
    for (let x = 88; x < canvas.width; x += 200) {
      context.fillRect(x, 62 + ((x / 200) % 2) * 246, 24, 24);
      context.fillRect(x + 32, 62 + ((x / 200) % 2) * 246, 24, 24);
      context.fillRect(x + 16, 86 + ((x / 200) % 2) * 246, 24, 24);
    }
    context.strokeStyle = "#4f7264";
    context.lineWidth = 7;
    context.lineCap = "round";
    context.lineJoin = "round";
    strokes.forEach((stroke) => {
      if (stroke.length < 2) return;
      context.beginPath();
      context.moveTo(stroke[0].x * canvas.width, (1 - stroke[0].y) * canvas.height);
      stroke.slice(1).forEach((point) => {
        context.lineTo(point.x * canvas.width, (1 - point.y) * canvas.height);
      });
      context.stroke();
    });
    texture.needsUpdate = true;
  };

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

  const note = addAction(
    new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.72), new THREE.MeshBasicMaterial({ map: noteCanvas.texture, toneMapped: false })),
    "quote",
  );
  note.position.set(-6.2, 2.7, 1.29);
  note.rotation.z = -0.05;
  world.add(note);

  const toyBase = roundedMesh(1.0, 0.18, 0.75, 0.1, charcoalSoft);
  toyBase.position.set(-6.45, 4.21, 0.12);
  toyBase.castShadow = true;
  world.add(toyBase);
  const toyCanvas = makeCanvas(420, 520);
  const toyImage = createDesktopImage(DESKTOP_IMAGE_URLS.toy);
  toyImage.addEventListener("load", () => {
    const { context, canvas, texture } = toyCanvas;
    context.clearRect(0, 0, canvas.width, canvas.height);
    roundRect(context, 8, 8, canvas.width - 16, canvas.height - 16, 54);
    context.save();
    context.clip();
    context.fillStyle = "#eee7dc";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(toyImage, -28, 0, 476, 476);
    context.restore();
    texture.needsUpdate = true;
  });
  const toyBacking = roundedMesh(1.18, 1.45, 0.08, 0.12, warmWhite);
  toyBacking.position.set(-6.45, 4.92, 0.2);
  toyBacking.castShadow = true;
  world.add(toyBacking);
  const toy = addAction(
    new THREE.Mesh(
      new THREE.PlaneGeometry(1.08, 1.34),
      new THREE.MeshBasicMaterial({ map: toyCanvas.texture, transparent: true, toneMapped: false }),
    ),
    "message",
  );
  toy.position.set(-6.45, 4.92, 0.255);
  world.add(toy);

  const board = roundedMesh(
    DESK_LAYOUT.pegboards.small.width,
    DESK_LAYOUT.pegboards.small.height,
    0.25,
    0.08,
    new THREE.MeshStandardMaterial({ color: "#292b29", roughness: 0.82 }),
  );
  board.position.set(
    DESK_LAYOUT.pegboards.small.x,
    DESK_LAYOUT.pegboards.small.y,
    DESK_LAYOUT.pegboards.small.z,
  );
  board.castShadow = true;
  world.add(board);
  for (let x = -0.9; x <= 0.9; x += 0.3) {
    for (let y = -1.85; y <= 1.85; y += 0.32) {
      const hole = new THREE.Mesh(new THREE.CircleGeometry(0.035, 10), new THREE.MeshBasicMaterial({ color: "#111311" }));
      hole.position.set(6.45 + x, 3.35 + y, -1.84);
      world.add(hole);
    }
  }
  const messageBoard = addAction(
    new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 0.82),
      new THREE.MeshBasicMaterial({ map: messageBoardCanvas.texture, toneMapped: false }),
    ),
    "message",
  );
  messageBoard.position.set(6.45, 4.42, -1.72);
  messageBoard.rotation.z = -0.02;
  world.add(messageBoard);

  const badgeColors = ["#86a28f", "#9d8797"];
  badgeColors.forEach((color, index) => {
    const badge = addAction(
      roundedMesh(0.58, 0.58, 0.08, 0.12, new THREE.MeshStandardMaterial({ color, roughness: 0.65 })),
      "badge",
    );
    badge.position.set(6.82 + (index % 2) * 0.22, 3.98 - index * 0.82, -1.78);
    world.add(badge);
  });

  const angledPegboard = new THREE.Group();
  angledPegboard.position.set(
    DESK_LAYOUT.pegboards.large.x,
    DESK_LAYOUT.pegboards.large.y,
    DESK_LAYOUT.pegboards.large.z,
  );
  angledPegboard.rotation.y = DESK_LAYOUT.pegboards.large.yaw;
  world.add(angledPegboard);

  const largeBoard = roundedMesh(
    DESK_LAYOUT.pegboards.large.width,
    DESK_LAYOUT.pegboards.large.height,
    0.22,
    0.08,
    new THREE.MeshStandardMaterial({ color: "#555a55", roughness: 0.86 }),
  );
  largeBoard.position.set(0, 0, 0);
  largeBoard.castShadow = true;
  angledPegboard.add(largeBoard);
  for (let x = -2.65; x <= 2.65; x += 0.3) {
    for (let y = -3.4; y <= 3.4; y += 0.32) {
      const hole = new THREE.Mesh(
        new THREE.CircleGeometry(0.035, 10),
        new THREE.MeshBasicMaterial({ color: "#272a27" }),
      );
      hole.position.set(x, y, 0.14);
      angledPegboard.add(hole);
    }
  }

  const lamp = new THREE.Group();
  lamp.position.set(5.62, 0.2, 0.05);
  const lampBase = roundedMesh(1.55, 0.22, 1.15, 0.22, charcoal);
  lampBase.castShadow = true;
  lamp.add(lampBase);
  const lowerArm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.35, 18), charcoalSoft);
  lowerArm.position.set(0.15, 1.15, 0);
  lowerArm.rotation.z = -0.18;
  lamp.add(lowerArm);
  const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.0, 18), charcoalSoft);
  upperArm.position.set(-0.12, 2.88, 0);
  upperArm.rotation.z = 0.47;
  lamp.add(upperArm);
  const shadeMaterial = new THREE.MeshStandardMaterial({ color: "#242624", roughness: 0.6, metalness: 0.28, side: THREE.DoubleSide });
  const shade = addAction(new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.68, 0.76, 28, 1, true), shadeMaterial), "lamp");
  shade.position.set(-0.7, 3.82, 0.2);
  shade.rotation.z = -0.92;
  lamp.add(shade);
  const bulb = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.04, 24), new THREE.MeshBasicMaterial({ color: "#ffd69a" }));
  bulb.position.set(-1.0, 3.58, 0.2);
  bulb.rotation.z = -0.92;
  lamp.add(bulb);
  world.add(lamp);

  const keyboard = addAction(createKeyboardModel(), "keyboard");
  world.add(keyboard);

  const mouse = addAction(new THREE.Group(), "mouse");
  const mouseBody = new THREE.Mesh(new THREE.SphereGeometry(0.55, 40, 24), charcoal);
  mouseBody.scale.set(0.84, 0.38, 1.2);
  mouseBody.position.set(0.05, -0.05, 0.02);
  mouseBody.castShadow = true;
  mouse.add(mouseBody);

  const rearHump = new THREE.Mesh(new THREE.SphereGeometry(0.45, 36, 20), charcoalSoft);
  rearHump.scale.set(0.82, 0.46, 0.96);
  rearHump.position.set(0.04, 0.02, 0.2);
  rearHump.castShadow = true;
  mouse.add(rearHump);

  const clickDeck = roundedMesh(0.64, 0.035, 0.4, 0.075, charcoalSoft);
  clickDeck.position.set(0.03, 0.115, -0.34);
  clickDeck.castShadow = true;
  mouse.add(clickDeck);

  const clickSeam = roundedMesh(0.018, 0.012, 0.32, 0.006, charcoal);
  clickSeam.position.set(0.03, 0.14, -0.34);
  mouse.add(clickSeam);

  const centerSpine = roundedMesh(0.1, 0.055, 0.46, 0.035, charcoal);
  centerSpine.position.set(0.03, 0.17, -0.19);
  mouse.add(centerSpine);

  const mouseWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.12, 20), paleGreen);
  mouseWheel.rotation.z = Math.PI / 2;
  mouseWheel.position.set(0.03, 0.23, -0.28);
  mouse.add(mouseWheel);

  const dpiButton = roundedMesh(0.1, 0.045, 0.15, 0.03, charcoalSoft);
  dpiButton.position.set(0.03, 0.19, -0.02);
  mouse.add(dpiButton);

  [-0.07, 0.12].forEach((z) => {
    const sideButton = roundedMesh(0.05, 0.075, 0.13, 0.02, charcoalSoft);
    sideButton.position.set(-0.43, 0.035, z);
    mouse.add(sideButton);
  });

  const mouseLogo = new THREE.Group();
  const mouseLogoMaterial = new THREE.MeshBasicMaterial({ color: "#d8cfbd", toneMapped: false });
  const logoStem = roundedMesh(0.025, 0.018, 0.12, 0.008, mouseLogoMaterial);
  logoStem.position.x = -0.035;
  mouseLogo.add(logoStem);
  [-0.045, 0, 0.045].forEach((z, index) => {
    const bar = roundedMesh(index === 1 ? 0.075 : 0.095, 0.018, 0.022, 0.007, mouseLogoMaterial);
    bar.position.set(0.005, 0, z);
    mouseLogo.add(bar);
  });
  mouseLogo.position.set(0.04, 0.2, 0.32);
  mouse.add(mouseLogo);
  world.add(mouse);

  const modeButtons: Array<{ label: string; action: SceneAction; x: number }> = [
    { label: "移动", action: "mode:move", x: -4.55 },
    { label: "画笔", action: "mode:draw", x: -3.58 },
    { label: "留言", action: "mode:message", x: -2.61 },
    { label: "清空", action: "clear", x: -1.64 },
  ];
  const buttonMeshes: Array<{ action: SceneAction; mesh: THREE.Mesh }> = [];
  modeButtons.forEach(({ label, action, x }) => {
    const button = addAction(roundedMesh(0.82, 0.16, 0.48, 0.08, charcoalSoft), action);
    button.position.set(x, 0.41, 3.55);
    button.castShadow = true;
    world.add(button);
    const labelMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.24), makeTextMaterial(label));
    labelMesh.rotation.x = -Math.PI / 2;
    labelMesh.position.set(x, 0.505, 3.55);
    world.add(labelMesh);
    buttonMeshes.push({ action, mesh: button });
  });

  let state = createInitialDesktopState();
  let statusTimer = 0;
  const announce = (message: string) => {
    status.textContent = message;
    status.classList.add("is-visible");
    window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => status.classList.remove("is-visible"), 1500);
  };

  const updatePositions = () => {
    mouse.position.set(
      lerpRange(state.physicalMouse.x, 0.66, 0.93, 2.65, 4.72),
      0.63,
      lerpRange(state.physicalMouse.y, 0.35, 0.72, 1.22, 3.02),
    );
    keyboard.position.set(
      lerpRange(state.keyboard.x, 0.2, 0.7, -0.95, -0.2),
      0.54,
      lerpRange(state.keyboard.y, 0.48, 0.82, 1.82, 2.34),
    );
  };

  const updateModeButtons = () => {
    buttonMeshes.forEach(({ action, mesh }) => {
      const active = action === `mode:${state.matMode}`;
      (mesh.material as THREE.MeshStandardMaterial).color.set(active ? "#759481" : "#353633");
    });
    messagePanel.hidden = false;
    if (state.matMode === "message") window.setTimeout(() => messageInput.focus(), 30);
  };

  const updateScreens = () => {
    drawMainScreen();
    drawSideScreen();
    monitors.updateMainActions(state);
    drawNote();
    drawMessageBoard();
    drawMat();
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
    strokes.length = 0;
    drawMat();
    announce("鼠标垫笔迹已清空");
  };

  avatarImage.addEventListener("load", drawMainScreen);
  updateScreens();

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.54);
  const dragPoint = new THREE.Vector3();
  let dragTarget: "mouse" | "keyboard" | null = null;
  let pointerDown = new THREE.Vector2();
  let movedPixels = 0;

  const updatePointer = (event: PointerEvent) => {
    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
  };

  const intersections = () => raycaster.intersectObjects(world.children, true);
  const matIntersection = () => raycaster.intersectObject(matSurface, false)[0];

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

  renderer.domElement.addEventListener("pointerdown", (event: PointerEvent) => {
    updatePointer(event);
    pointerDown.set(event.clientX, event.clientY);
    movedPixels = 0;
    const hit = intersections()[0];
    const action = actionFromObject(hit?.object ?? null);

    if (action === "mouse" || action === "keyboard") {
      dragTarget = action;
      renderer.domElement.classList.add("is-dragging");
      renderer.domElement.setPointerCapture(event.pointerId);
      if (dragTarget === "keyboard") keyboard.position.y += 0.16;
      return;
    }

    if (action === "mat" && state.matMode === "draw") {
      const matHit = matIntersection();
      if (matHit?.uv) {
        activeStroke = [{ x: matHit.uv.x, y: matHit.uv.y }];
        strokes.push(activeStroke);
        renderer.domElement.setPointerCapture(event.pointerId);
      }
      return;
    }

    applyAction(action);
  });

  renderer.domElement.addEventListener("pointermove", (event: PointerEvent) => {
    updatePointer(event);
    movedPixels = Math.max(movedPixels, Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y));

    if (dragTarget && raycaster.ray.intersectPlane(dragPlane, dragPoint)) {
      if (dragTarget === "mouse") {
        state = movePhysicalMouse(state, {
          x: lerpRange(clamp(dragPoint.x, 2.65, 4.72), 2.65, 4.72, 0.66, 0.93),
          y: lerpRange(clamp(dragPoint.z, 1.22, 3.02), 1.22, 3.02, 0.35, 0.72),
        });
        updatePositions();
        drawMainScreen();
      } else {
        state = moveKeyboard(state, {
          x: lerpRange(clamp(dragPoint.x, -0.95, -0.2), -0.95, -0.2, 0.2, 0.7),
          y: lerpRange(clamp(dragPoint.z, 1.82, 2.34), 1.82, 2.34, 0.48, 0.82),
        });
        updatePositions();
        keyboard.position.y += 0.16;
      }
      return;
    }

    if (activeStroke) {
      const matHit = matIntersection();
      if (matHit?.uv) {
        activeStroke.push({ x: matHit.uv.x, y: matHit.uv.y });
        drawMat();
      }
      return;
    }

    const action = actionFromObject(intersections()[0]?.object ?? null);
    renderer.domElement.classList.toggle("is-interactive", Boolean(action));
  });

  renderer.domElement.addEventListener(
    "wheel",
    (event: WheelEvent) => {
      if (state.contentView.kind !== "list" || Math.abs(event.deltaY) < 8) return;
      updatePointer(event as unknown as PointerEvent);
      if (!raycaster.intersectObject(mainScreen, false).length) return;

      const page = getContentPage(
        itemsForSection(state.contentView.section),
        state.contentView.page,
        4,
      );
      const nextPage = clamp(page.page + (event.deltaY > 0 ? 1 : -1), 0, page.pageCount - 1);
      if (nextPage === page.page) return;

      event.preventDefault();
      state = setContentPage(state, nextPage);
      updateScreens();
    },
    { passive: false },
  );

  const finishPointer = (event: PointerEvent) => {
    if (dragTarget === "keyboard") updatePositions();
    if (dragTarget && movedPixels > 6) announce(dragTarget === "mouse" ? "鼠标位置已更新" : "键盘位置已更新");
    dragTarget = null;
    activeStroke = null;
    renderer.domElement.classList.remove("is-dragging");
    if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
  };
  renderer.domElement.addEventListener("pointerup", finishPointer);
  renderer.domElement.addEventListener("pointercancel", finishPointer);

  root.querySelectorAll<HTMLButtonElement>("[data-screen]").forEach((button) => {
    button.addEventListener("click", () => setScreen(button.dataset.screen as ScreenId));
  });
  root.querySelectorAll<HTMLButtonElement>("[data-section]").forEach((button) => {
    button.addEventListener("click", () => setSection(button.dataset.section as ContentSectionId));
  });
  root.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.mode as MatMode));
  });
  root.querySelector<HTMLButtonElement>('[data-action="quote"]')?.addEventListener("click", () => applyAction("quote"));
  root.querySelector<HTMLButtonElement>('[data-action="badge"]')?.addEventListener("click", () => applyAction("badge"));
  root.querySelector<HTMLButtonElement>('[data-action="clear"]')?.addEventListener("click", clearDrawing);

  messagePanel.addEventListener("submit", (event) => {
    event.preventDefault();
    state = setMessage(state, messageInput.value.trim());
    drawMainScreen();
    drawMessageBoard();
    announce(state.message ? "留言已经写在洞洞板上" : "留言已清空");
  });

  let parallaxX = 0;
  let parallaxY = 0;
  root.addEventListener("pointermove", (event) => {
    if (reducedMotion || dragTarget || activeStroke) return;
    parallaxX = (event.clientX / window.innerWidth - 0.5) * 0.32;
    parallaxY = (event.clientY / window.innerHeight - 0.5) * 0.18;
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
      strokes.push(points.map((point) => ({ x: clamp(point.x, 0, 1), y: clamp(point.y, 0, 1) })));
      drawMat();
    },
    clearDrawing,
    cycleQuote: () => applyAction("quote"),
    clickBadge: () => applyAction("badge"),
  };

  const startTime = performance.now();
  const animate = (time: number) => {
    const elapsed = time - startTime;
    if (!reducedMotion && elapsed < 1400) {
      const progress = 1 - Math.pow(1 - Math.min(elapsed / 1400, 1), 3);
      camera.position.lerpVectors(environment.introCamera, environment.finalCamera, progress);
    } else {
      camera.position.x += (environment.finalCamera.x + parallaxX - camera.position.x) * 0.035;
      camera.position.y += (environment.finalCamera.y - parallaxY - camera.position.y) * 0.035;
    }
    camera.lookAt(cameraTarget);
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);

  window.addEventListener("resize", environment.resize);

  requestAnimationFrame(() => {
    loading.classList.add("is-ready");
    root.dataset.ready = "true";
  });
}
