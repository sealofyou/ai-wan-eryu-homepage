import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import {
  DAILY_QUOTES,
  createInitialDesktopState,
  cycleQuote,
  moveKeyboard,
  movePhysicalMouse,
  selectScreen,
  setMatMode,
  setMessage,
  type DesktopState,
  type MatMode,
  type Point,
  type ScreenId,
} from "./model";
import { createKeyboardModel } from "./keyboard";
import { DESK_LAYOUT } from "./layout";

type SceneAction =
  | `screen:${ScreenId}`
  | `mode:${MatMode}`
  | "quote"
  | "badge"
  | "clear"
  | "mouse"
  | "keyboard"
  | "mat"
  | "lamp";

declare global {
  interface Window {
    __ERYU_DESKTOP__?: {
      getState: () => DesktopState;
      selectScreen: (screen: ScreenId) => void;
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

const activities: Array<{
  id: Exclude<ScreenId, "home" | "badge">;
  date: string;
  title: string;
  summary: string;
  color: string;
}> = [
  {
    id: "share",
    date: "07.04",
    title: "分享",
    summary: "一次关于 AI 技能与真实工作流的分享记录。",
    color: "#d77c51",
  },
  {
    id: "activity",
    date: "07.18",
    title: "活动",
    summary: "活动资料正在整理，先保留时间与入口。",
    color: "#7f9c8d",
  },
  {
    id: "recent",
    date: "NOW",
    title: "最近在做",
    summary: "把个人知识、项目与任务节奏接成可交接的系统。",
    color: "#8091aa",
  },
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const lerpRange = (value: number, start: number, end: number, nextStart: number, nextEnd: number) =>
  nextStart + ((value - start) / (end - start)) * (nextEnd - nextStart);

const makeCanvas = (width: number, height: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D canvas is unavailable");
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return { canvas, context, texture };
};

const roundRect = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
};

const wrapText = (
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) => {
  let line = "";
  let offsetY = 0;
  for (const character of text) {
    const candidate = line + character;
    if (context.measureText(candidate).width > maxWidth && line) {
      context.fillText(line, x, y + offsetY);
      line = character;
      offsetY += lineHeight;
    } else {
      line = candidate;
    }
  }
  if (line) context.fillText(line, x, y + offsetY);
};

const makeTextMaterial = (
  text: string,
  foreground = "#ece6da",
  background = "#2a2a27",
) => {
  const { context, texture } = makeCanvas(512, 160);
  context.fillStyle = background;
  context.fillRect(0, 0, 512, 160);
  context.fillStyle = foreground;
  context.font = '700 54px "Microsoft YaHei", sans-serif';
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, 256, 82);
  texture.needsUpdate = true;
  return new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
};

const addAction = <T extends THREE.Object3D>(object: T, action: SceneAction): T => {
  object.userData.action = action;
  return object;
};

const actionFromObject = (object: THREE.Object3D | null): SceneAction | undefined => {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (current.userData.action) return current.userData.action as SceneAction;
    current = current.parent;
  }
  return undefined;
};

const roundedMesh = (
  width: number,
  height: number,
  depth: number,
  radius: number,
  material: THREE.Material,
) => new THREE.Mesh(new RoundedBoxGeometry(width, height, depth, 5, radius), material);

export function mountDesktopScene(root: HTMLElement) {
  if (window.innerWidth <= 900) return;

  const mount = root.querySelector<HTMLElement>("[data-scene-mount]");
  const loading = root.querySelector<HTMLElement>("[data-scene-loading]");
  const fallback = root.querySelector<HTMLElement>("[data-webgl-fallback]");
  const status = root.querySelector<HTMLElement>("[data-interaction-status]");
  const messagePanel = root.querySelector<HTMLFormElement>("[data-message-panel]");
  const messageInput = root.querySelector<HTMLInputElement>("#mat-message");
  if (!mount || !loading || !fallback || !status || !messagePanel || !messageInput) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  } catch {
    fallback.hidden = false;
    loading.hidden = true;
    return;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#6d5c4b");
  scene.fog = new THREE.Fog("#6d5c4b", 16, 28);

  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 60);
  const finalCamera = new THREE.Vector3(0.15, 5.5, 12.3);
  camera.position.copy(reducedMotion ? finalCamera : new THREE.Vector3(0.15, 6.5, 15.2));
  camera.lookAt(0, 2.45, 0.3);

  const world = new THREE.Group();
  scene.add(world);

  const charcoal = new THREE.MeshStandardMaterial({ color: "#242624", roughness: 0.64, metalness: 0.32 });
  const charcoalSoft = new THREE.MeshStandardMaterial({ color: "#353633", roughness: 0.72, metalness: 0.18 });
  const warmWhite = new THREE.MeshStandardMaterial({ color: "#e9e3d7", roughness: 0.83 });
  const paleGreen = new THREE.MeshStandardMaterial({ color: "#91aa98", roughness: 0.72 });
  const wood = new THREE.MeshStandardMaterial({ color: "#805536", roughness: 0.58 });

  const wall = roundedMesh(18, 10, 0.35, 0.12, new THREE.MeshStandardMaterial({ color: "#9b846c", roughness: 0.96 }));
  wall.position.set(0, 4.1, -3.3);
  wall.receiveShadow = true;
  world.add(wall);

  const desk = roundedMesh(16, 0.72, 7.5, 0.2, wood);
  desk.position.set(0, -0.18, 0.85);
  desk.receiveShadow = true;
  desk.castShadow = true;
  world.add(desk);

  const matCanvas = makeCanvas(1400, 460);
  const strokes: Point[][] = [];
  let activeStroke: Point[] | null = null;
  const matBase = roundedMesh(11.2, 0.12, 3.75, 0.18, new THREE.MeshStandardMaterial({ color: "#ded7ca", roughness: 0.92 }));
  matBase.position.set(0.15, 0.22, 2.22);
  matBase.receiveShadow = true;
  world.add(matBase);

  const matSurface = addAction(
    new THREE.Mesh(
      new THREE.PlaneGeometry(10.95, 3.52),
      new THREE.MeshStandardMaterial({ map: matCanvas.texture, roughness: 0.92 }),
    ),
    "mat",
  );
  matSurface.rotation.x = -Math.PI / 2;
  matSurface.position.set(0.15, 0.291, 2.22);
  world.add(matSurface);

  const mainCanvas = makeCanvas(1200, 680);
  const sideCanvas = makeCanvas(440, 880);
  const noteCanvas = makeCanvas(420, 300);
  const messageBoardCanvas = makeCanvas(520, 360);
  const avatarImage = new Image();
  avatarImage.src = "/desktop/main-avatar.png";

  const drawMainScreen = () => {
    const { context, canvas, texture } = mainCanvas;
    const { width, height } = canvas;
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#f1eee8";
    context.fillRect(0, 0, width, height);
    context.fillStyle = "#d7e1dc";
    context.fillRect(0, 0, 14, height);
    context.fillStyle = "#202521";

    if (state.activeScreen === "home") {
      roundRect(context, 48, 52, 440, 576, 28);
      context.save();
      context.clip();
      context.fillStyle = "#d8d4cb";
      context.fillRect(48, 52, 440, 576);
      if (avatarImage.complete) {
        context.drawImage(avatarImage, 48, 36, 440, 608);
      }
      context.restore();

      context.font = '800 28px "Microsoft YaHei", sans-serif';
      context.fillStyle = "#5f8f78";
      context.fillText("ERYU / PERSONAL SYSTEM", 548, 84);
      context.font = '900 66px "Microsoft YaHei", sans-serif';
      context.fillStyle = "#202521";
      context.fillText("AI玩尔玉", 548, 165);
      context.font = '700 26px "Microsoft YaHei", sans-serif';
      context.fillStyle = "#4c514d";
      context.fillText("Eryu", 552, 212);
      context.font = '500 27px "Microsoft YaHei", sans-serif';
      context.fillStyle = "#333733";
      wrapText(
        context,
        "把 AI 接进真实工作流，做成能运行、能验证、也能继续交接的系统。",
        548,
        286,
        570,
        44,
      );

      roundRect(context, 548, 400, 580, 190, 22);
      context.fillStyle = "rgba(255,255,255,0.72)";
      context.fill();
      context.strokeStyle = "rgba(32,37,33,0.14)";
      context.lineWidth = 2;
      context.stroke();
      context.fillStyle = "#5f8f78";
      context.beginPath();
      context.arc(586, 444, 9, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#222622";
      context.font = '800 25px "Microsoft YaHei", sans-serif';
      context.fillText("当前状态", 610, 454);
      context.font = '500 22px "Microsoft YaHei", sans-serif';
      context.fillStyle = "#4d524d";
      context.fillText("整理个人 AI 操作系统", 584, 503);
      context.fillText("打磨可交接的项目流程", 584, 543);
    } else {
      const selected = activities.find((activity) => activity.id === state.activeScreen);
      const isBadge = state.activeScreen === "badge";
      const color = selected?.color ?? "#d6a755";
      context.fillStyle = color;
      context.fillRect(0, 0, 22, height);
      context.fillStyle = "#5f655f";
      context.font = '700 22px "Microsoft YaHei", sans-serif';
      context.fillText(isBadge ? "PEGBOARD / BADGE" : `${selected?.date} / ACTIVITY`, 72, 88);
      context.fillStyle = "#222622";
      context.font = '900 62px "Microsoft YaHei", sans-serif';
      context.fillText(isBadge ? "徽章故事" : selected?.title ?? "内容", 72, 174);
      roundRect(context, 72, 232, 1052, 260, 28);
      context.fillStyle = color;
      context.fill();
      context.fillStyle = "rgba(255,255,255,0.28)";
      for (let index = 0; index < 8; index += 1) {
        context.fillRect(108 + index * 120, 278 + (index % 2) * 70, 66, 66);
      }
      context.fillStyle = "#f8f5ef";
      context.font = '800 32px "Microsoft YaHei", sans-serif';
      context.fillText(isBadge ? "示例占位" : "内容整理中", 118, 426);
      context.fillStyle = "#343934";
      context.font = '500 26px "Microsoft YaHei", sans-serif';
      wrapText(
        context,
        isBadge ? "这里将来会放徽章的时间、来源和故事。目前尚未填充。" : selected?.summary ?? "内容整理中",
        76,
        552,
        850,
        42,
      );
      roundRect(context, 932, 548, 192, 64, 18);
      context.fillStyle = "#282c29";
      context.fill();
      context.fillStyle = "#fffdf8";
      context.font = '700 23px "Microsoft YaHei", sans-serif';
      context.fillText("← 返回首页", 962, 589);
    }

    const cursorX = state.screenCursor.x * width;
    const cursorY = state.screenCursor.y * height;
    context.save();
    context.translate(cursorX, cursorY);
    context.fillStyle = "#202521";
    context.strokeStyle = "#fffdf8";
    context.lineWidth = 5;
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(0, 34);
    context.lineTo(9, 26);
    context.lineTo(18, 45);
    context.lineTo(28, 40);
    context.lineTo(19, 22);
    context.lineTo(31, 21);
    context.closePath();
    context.stroke();
    context.fill();
    context.restore();
    texture.needsUpdate = true;
  };

  const drawSideScreen = () => {
    const { context, canvas, texture } = sideCanvas;
    context.fillStyle = "#202320";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#e8e1d4";
    context.font = '900 43px "Microsoft YaHei", sans-serif';
    context.fillText("动态", 38, 76);
    context.fillStyle = "#82a08f";
    context.font = '700 17px "Microsoft YaHei", sans-serif';
    context.fillText("ACTIVITY", 40, 108);

    activities.forEach((activity, index) => {
      const y = 152 + index * 222;
      roundRect(context, 28, y, 384, 188, 24);
      context.fillStyle = state.activeScreen === activity.id ? "#343a35" : "#2a2e2a";
      context.fill();
      context.fillStyle = activity.color;
      roundRect(context, 48, y + 25, 128, 136, 18);
      context.fill();
      context.fillStyle = "rgba(255,255,255,0.3)";
      context.fillRect(72, y + 54, 78, 12);
      context.fillRect(72, y + 84, 58, 12);
      context.fillRect(72, y + 114, 88, 12);
      context.fillStyle = "#9fb2a6";
      context.font = '700 18px "Microsoft YaHei", sans-serif';
      context.fillText(activity.date, 198, y + 55);
      context.fillStyle = "#f4efe6";
      context.font = '800 27px "Microsoft YaHei", sans-serif';
      context.fillText(activity.title, 198, y + 96);
      context.fillStyle = "#aeb5af";
      context.font = '500 16px "Microsoft YaHei", sans-serif';
      context.fillText("内容整理中", 198, y + 133);
    });
    texture.needsUpdate = true;
  };

  const drawNote = () => {
    const { context, canvas, texture } = noteCanvas;
    context.fillStyle = "#e5c76e";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "rgba(108,78,25,0.14)";
    for (let y = 60; y < canvas.height; y += 62) context.fillRect(28, y, canvas.width - 56, 2);
    context.fillStyle = "#58431f";
    context.font = '800 30px "Microsoft YaHei", sans-serif';
    context.fillText("TODAY", 34, 46);
    context.font = '700 33px "Microsoft YaHei", sans-serif';
    wrapText(context, DAILY_QUOTES[state.quoteIndex], 34, 116, 350, 48);
    texture.needsUpdate = true;
  };

  const drawMessageBoard = () => {
    const { context, canvas, texture } = messageBoardCanvas;
    context.fillStyle = "#e5c76e";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "rgba(108,78,25,0.16)";
    for (let y = 88; y < canvas.height; y += 54) {
      context.fillRect(28, y, canvas.width - 56, 2);
    }
    context.fillStyle = "#58431f";
    context.font = '800 34px "Microsoft YaHei", sans-serif';
    context.fillText("留言板", 30, 56);
    if (state.message) {
      context.font = '600 26px "Microsoft YaHei", sans-serif';
      wrapText(context, state.message, 30, 126, canvas.width - 60, 38);
    }
    texture.needsUpdate = true;
  };

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

  const mainFrame = roundedMesh(7.35, 4.45, 0.35, 0.15, charcoal);
  mainFrame.position.set(0.7, 4.05, -0.92);
  mainFrame.castShadow = true;
  world.add(mainFrame);
  const mainScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(6.98, 3.98),
    new THREE.MeshBasicMaterial({ map: mainCanvas.texture, toneMapped: false }),
  );
  mainScreen.position.set(0.7, 4.05, -0.724);
  world.add(mainScreen);

  const mainBackHit = addAction(
    new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.52), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })),
    "screen:home",
  );
  mainBackHit.position.set(2.98, 2.82, -0.70);
  world.add(mainBackHit);

  const stand = roundedMesh(0.72, 1.05, 0.35, 0.08, charcoal);
  stand.position.set(0.7, 1.47, -0.75);
  stand.castShadow = true;
  world.add(stand);
  const standFoot = roundedMesh(2.8, 0.18, 0.9, 0.08, charcoalSoft);
  standFoot.position.set(0.7, 0.92, -0.42);
  standFoot.castShadow = true;
  world.add(standFoot);

  const soundbar = roundedMesh(4.2, 0.58, 0.75, 0.18, charcoalSoft);
  soundbar.position.set(0.7, 1.08, 0.1);
  soundbar.castShadow = true;
  world.add(soundbar);
  const soundbarLabel = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.3), makeTextMaterial("Eryu", "#c8b391", "#353633"));
  soundbarLabel.position.set(0.7, 1.08, 0.49);
  world.add(soundbarLabel);

  const sideMonitor = new THREE.Group();
  sideMonitor.position.set(
    DESK_LAYOUT.leftMonitor.center.x,
    DESK_LAYOUT.leftMonitor.center.y,
    DESK_LAYOUT.leftMonitor.center.z,
  );
  sideMonitor.rotation.y = DESK_LAYOUT.leftMonitor.yaw;
  world.add(sideMonitor);

  const sideFrame = roundedMesh(2.45, 4.75, 0.34, 0.14, charcoal);
  sideFrame.position.set(0, 0, 0);
  sideFrame.castShadow = true;
  sideMonitor.add(sideFrame);
  const sideScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(2.17, 4.4),
    new THREE.MeshBasicMaterial({ map: sideCanvas.texture, toneMapped: false }),
  );
  sideScreen.position.set(0, 0, 0.19);
  sideMonitor.add(sideScreen);
  activities.forEach((activity, index) => {
    const hit = addAction(
      new THREE.Mesh(new THREE.PlaneGeometry(1.92, 0.92), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })),
      `screen:${activity.id}`,
    );
    hit.position.set(0, 0.8 - index * 1.1, 0.22);
    sideMonitor.add(hit);
  });

  const sideSupport = new THREE.Group();
  sideSupport.position.set(
    DESK_LAYOUT.leftMonitor.center.x,
    DESK_LAYOUT.leftMonitor.support.baseY - 0.09,
    DESK_LAYOUT.leftMonitor.center.z,
  );
  sideSupport.rotation.y = DESK_LAYOUT.leftMonitor.yaw;
  const supportPost = roundedMesh(
    0.56,
    DESK_LAYOUT.leftMonitor.support.height,
    0.42,
    0.08,
    charcoal,
  );
  supportPost.position.set(0, DESK_LAYOUT.leftMonitor.support.height / 2, 0);
  supportPost.castShadow = true;
  sideSupport.add(supportPost);
  const supportHinge = roundedMesh(0.9, 0.2, 0.5, 0.06, charcoalSoft);
  supportHinge.position.set(0, DESK_LAYOUT.leftMonitor.support.topY - DESK_LAYOUT.leftMonitor.support.baseY, 0);
  supportHinge.castShadow = true;
  sideSupport.add(supportHinge);
  const supportFoot = roundedMesh(
    DESK_LAYOUT.leftMonitor.support.footWidth,
    0.18,
    DESK_LAYOUT.leftMonitor.support.footDepth,
    0.08,
    charcoalSoft,
  );
  supportFoot.position.set(0, 0.09, 0.08);
  supportFoot.castShadow = true;
  sideSupport.add(supportFoot);
  world.add(sideSupport);

  const tower = roundedMesh(2.05, 4.0, 2.1, 0.2, charcoal);
  tower.position.set(-6.45, 2.1, 0.15);
  tower.castShadow = true;
  world.add(tower);
  const towerInset = roundedMesh(1.55, 2.55, 0.09, 0.1, new THREE.MeshStandardMaterial({ color: "#151716", roughness: 0.7 }));
  towerInset.position.set(-6.45, 2.35, 1.225);
  world.add(towerInset);
  const towerGlow = roundedMesh(0.06, 2.3, 0.04, 0.02, new THREE.MeshBasicMaterial({ color: "#60ab79" }));
  towerGlow.position.set(-7.17, 1.72, 1.285);
  world.add(towerGlow);
  const eMark = new THREE.Group();
  const eMaterial = new THREE.MeshBasicMaterial({ color: "#d9d2c4" });
  const eVertical = roundedMesh(0.13, 0.62, 0.04, 0.02, eMaterial);
  eVertical.position.x = -0.18;
  eMark.add(eVertical);
  [-0.24, 0, 0.24].forEach((y, index) => {
    const bar = roundedMesh(index === 1 ? 0.38 : 0.48, 0.1, 0.04, 0.02, eMaterial);
    bar.position.set(0.03, y, 0);
    eMark.add(bar);
  });
  eMark.position.set(-6.45, 0.92, 1.3);
  world.add(eMark);

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
  const toyImage = new Image();
  toyImage.src = "/desktop/q-avatar.png";
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
    "badge",
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
      new THREE.PlaneGeometry(0.92, 0.68),
      new THREE.MeshBasicMaterial({ map: messageBoardCanvas.texture, toneMapped: false }),
    ),
    "badge",
  );
  messageBoard.position.set(6.05, 4.45, -1.72);
  messageBoard.rotation.z = -0.04;
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

  const lampLight = new THREE.PointLight("#ffd39a", 55, 8, 2);
  lampLight.position.set(4.62, 3.7, 0.35);
  lampLight.castShadow = true;
  scene.add(lampLight);
  const screenLight = new THREE.PointLight("#cfe3d8", 28, 8, 2);
  screenLight.position.set(0.8, 3.7, 1.8);
  scene.add(screenLight);
  scene.add(new THREE.HemisphereLight("#ffe8c8", "#3d3229", 2.2));
  const keyLight = new THREE.DirectionalLight("#fff0d8", 3.4);
  keyLight.position.set(-3, 9, 7);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.left = -10;
  keyLight.shadow.camera.right = 10;
  keyLight.shadow.camera.top = 10;
  keyLight.shadow.camera.bottom = -6;
  scene.add(keyLight);

  const keyboard = addAction(createKeyboardModel(), "keyboard");
  world.add(keyboard);

  const mouse = addAction(new THREE.Group(), "mouse");
  const mouseBody = new THREE.Mesh(new THREE.SphereGeometry(0.52, 32, 20), charcoal);
  mouseBody.scale.set(0.86, 0.45, 1.22);
  mouseBody.castShadow = true;
  mouse.add(mouseBody);
  const mouseLine = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.18, 0.58), new THREE.MeshBasicMaterial({ color: "#9aa69e" }));
  mouseLine.position.set(0, 0.17, -0.12);
  mouse.add(mouseLine);
  const mouseWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.11, 16), paleGreen);
  mouseWheel.rotation.z = Math.PI / 2;
  mouseWheel.position.set(0, 0.29, -0.24);
  mouse.add(mouseWheel);
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
    messagePanel.hidden = state.matMode !== "message";
    if (state.matMode === "message") window.setTimeout(() => messageInput.focus(), 30);
  };

  const updateScreens = () => {
    mainBackHit.visible = state.activeScreen !== "home";
    drawMainScreen();
    drawSideScreen();
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
    } else if (action.startsWith("mode:")) {
      setMode(action.slice(5) as MatMode);
    } else if (action === "quote") {
      state = cycleQuote(state);
      drawNote();
      announce(DAILY_QUOTES[state.quoteIndex]);
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
      camera.position.lerpVectors(new THREE.Vector3(0.15, 6.5, 15.2), finalCamera, progress);
    } else {
      camera.position.x += (finalCamera.x + parallaxX - camera.position.x) * 0.035;
      camera.position.y += (finalCamera.y - parallaxY - camera.position.y) * 0.035;
    }
    camera.lookAt(0, 2.45, 0.3);
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);

  const resize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener("resize", resize);

  requestAnimationFrame(() => {
    loading.classList.add("is-ready");
    root.dataset.ready = "true";
  });
}
