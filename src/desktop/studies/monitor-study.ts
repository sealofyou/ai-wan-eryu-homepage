import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { createMonitorStudyVisual } from "./monitor-study-model";
import { DESK_LAYOUT } from "../layout";
import { disposeObjectGraph } from "../core/renderer";
import { DESKTOP_IMAGE_URLS } from "../core/assets";
import { makeCanvas } from "../screens/canvas-utils";
import { renderMainScreen } from "../screens/main-screen";
import { createInitialDesktopState } from "../model";

const TARGET = new THREE.Vector3(0.68, 3.28, -1.03);
const PRESETS = {
  front: new THREE.Vector3(0.68, 3.28, 14.6),
  real: new THREE.Vector3(-5.8, 5.8, 13.3),
  side: new THREE.Vector3(-13.5, 4.2, 1.5),
  back: new THREE.Vector3(5.8, 5.5, -14.3),
};

export const mountMonitorStudy = (root: HTMLElement) => {
  const mount = root.querySelector<HTMLElement>("[data-monitor-canvas]");
  if (!mount) return undefined;
  const loading = root.querySelector<HTMLElement>("[data-monitor-loading]");
  const error = root.querySelector<HTMLElement>("[data-monitor-error]");
  const scene = new THREE.Scene();
  const listeners = new AbortController();
  let renderer: THREE.WebGLRenderer | undefined;
  let controls: OrbitControls | undefined;
  let environmentTarget: THREE.WebGLRenderTarget | undefined;
  let observer: ResizeObserver | undefined;
  let clay: THREE.MeshStandardMaterial | undefined;
  let avatar: HTMLImageElement | undefined;
  let disposed = false;
  let initializationStage = "renderer";
  const originals = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  const disposers: Array<() => void> = [];
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    listeners.abort();
    observer?.disconnect();
    disposers.forEach(fn => fn());
    controls?.dispose();
    if (avatar) { avatar.onload = null; avatar.onerror = null; }
    originals.forEach((material, mesh) => { mesh.material = material; });
    scene.traverse(object => {
      if (object instanceof THREE.DirectionalLight) object.shadow.dispose();
    });
    scene.environment = null;
    environmentTarget?.dispose();
    disposeObjectGraph(scene);
    clay?.dispose();
    renderer?.dispose();
    renderer?.domElement.remove();
    root.dataset.studyState = "disposed";
  };

  try {
    scene.background = new THREE.Color("#edf0ee");
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 70);
    camera.position.copy(PRESETS.real);
    camera.lookAt(TARGET);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    mount.appendChild(renderer.domElement);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(TARGET);
    controls.enableDamping = false;
    controls.enablePan = false;
    controls.minDistance = 8;
    controls.maxDistance = 28;
    controls.maxPolarAngle = Math.PI * 0.51;
    controls.update();
    initializationStage = "environment";
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    try { environmentTarget = pmrem.fromScene(room, 0.04); }
    finally { room.dispose(); pmrem.dispose(); }
    scene.environment = environmentTarget.texture;
    scene.environmentIntensity = 0.55;
    scene.add(new THREE.HemisphereLight("#ffffff", "#b1b6b4", 1.6));
    const key = new THREE.DirectionalLight("#fffdfa", 2.5);
    key.position.set(-5, 10, 7);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 0.1, far: 30 });
    key.shadow.camera.updateProjectionMatrix();
    key.shadow.bias = -0.0001;
    key.shadow.normalBias = 0.025;
    scene.add(key);
    const fill = new THREE.DirectionalLight("#e6ecf0", 0.7);
    fill.position.set(5, 5, -6);
    scene.add(fill);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(22, 18), new THREE.MeshStandardMaterial({ color: "#dfe3e0", roughness: 0.96 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = DESK_LAYOUT.desk.surface.position.y + DESK_LAYOUT.desk.surface.size.height / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    initializationStage = "geometry";
    const model = createMonitorStudyVisual();
    scene.add(model);
    let triangles = 0;
    const materials = new Set<THREE.Material>();
    model.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return;
      originals.set(node, node.material);
      triangles += (node.geometry.index?.count ?? node.geometry.getAttribute("position").count) / 3;
      (Array.isArray(node.material) ? node.material : [node.material]).forEach(m => materials.add(m));
    });
    clay = new THREE.MeshStandardMaterial({ color: "#9ba3a1", roughness: 0.75, metalness: 0 });
    initializationStage = "screen";
    const surface = makeCanvas(DESK_LAYOUT.mainMonitor.canvas.width, DESK_LAYOUT.mainMonitor.canvas.height);
    const screenMaterial = new THREE.MeshBasicMaterial({ map: surface.texture, toneMapped: false });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(DESK_LAYOUT.mainMonitor.screen.size.width, DESK_LAYOUT.mainMonitor.screen.size.height), screenMaterial);
    screen.position.copy(model.position);
    scene.add(screen);
    const brand = makeCanvas(256, 80);
    brand.context.clearRect(0, 0, 256, 80);
    brand.context.font = '500 64px "Segoe UI", sans-serif';
    brand.context.textAlign = "center";
    brand.context.textBaseline = "middle";
    brand.context.fillStyle = "#a1a7a7";
    brand.context.fillText("Eryu", 128, 40);
    brand.texture.needsUpdate = true;
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 0.18), new THREE.MeshBasicMaterial({ map: brand.texture, transparent: true, depthWrite: false, toneMapped: false }));
    label.position.copy(model.position).add(new THREE.Vector3(0, -2.29, 0.051));
    scene.add(label);

    const setStat = (key: string, value: string) => {
      const element = root.querySelector(`[data-stat="${key}"]`);
      if (element) element.textContent = value;
    };
    setStat("triangles", Math.round(triangles).toLocaleString("zh-CN"));
    setStat("materials", String(materials.size));
    let renderCount = 0;
    const render = () => {
      if (disposed) return;
      renderer!.render(scene, camera);
      root.dataset.renderCount = String(++renderCount);
      setStat("calls", String(renderer!.info.render.calls));
    };
    initializationStage = "content";
    let screenOn = true;
    let fallbackAttempted = false;
    avatar = new Image();
    avatar.decoding = "async";
    const drawScreen = () => {
      if (disposed) return;
      renderMainScreen({ surface, state: createInitialDesktopState(), avatarImage: avatar!, contentById: new Map(), itemsForSection: () => [] });
      render();
    };
    avatar.onload = drawScreen;
    avatar.onerror = () => {
      if (disposed) return;
      if (!fallbackAttempted) {
        fallbackAttempted = true;
        avatar!.src = DESKTOP_IMAGE_URLS.avatarFallback;
        return;
      }
      const status = root.querySelector("[data-study-status]");
      if (status) status.textContent = "人物图片暂未加载；可以继续检查显示器结构。";
      drawScreen();
    };
    avatar.src = DESKTOP_IMAGE_URLS.avatar;
    drawScreen();

    const pressed = (attribute: string, value: string) => root.querySelectorAll<HTMLButtonElement>(`[${attribute}]`).forEach(button => button.setAttribute("aria-pressed", String(button.getAttribute(attribute) === value)));
    root.querySelectorAll<HTMLButtonElement>("[data-camera-preset]").forEach(button => {
      const preset = button.dataset.cameraPreset as keyof typeof PRESETS;
      if (!(preset in PRESETS)) return;
      button.addEventListener("click", () => {
        camera.position.copy(PRESETS[preset]);
        controls!.target.copy(TARGET);
        controls!.update();
        pressed("data-camera-preset", preset);
        render();
      }, { signal: listeners.signal });
    });
    root.querySelectorAll<HTMLButtonElement>("[data-shading-mode]").forEach(button => button.addEventListener("click", () => {
      const mode = button.dataset.shadingMode;
      originals.forEach((material, mesh) => { mesh.material = mode === "clay" ? clay! : material; });
      label.visible = mode !== "clay";
      pressed("data-shading-mode", mode!);
      render();
    }, { signal: listeners.signal }));
    root.querySelectorAll<HTMLButtonElement>("[data-screen-mode]").forEach(button => button.addEventListener("click", () => {
      screenOn = button.dataset.screenMode === "on";
      screenMaterial.map = screenOn ? surface.texture : null;
      screenMaterial.color.set(screenOn ? "#ffffff" : "#111519");
      screenMaterial.needsUpdate = true;
      pressed("data-screen-mode", screenOn ? "on" : "off");
      render();
    }, { signal: listeners.signal }));
    pressed("data-camera-preset", "real");
    pressed("data-shading-mode", "material");
    pressed("data-screen-mode", "on");
    controls.addEventListener("change", render);
    disposers.push(() => controls?.removeEventListener("change", render));
    // The screen texture remains owned even when the panel is switched off.
    disposers.push(() => { screenMaterial.map = surface.texture; });
    const resize = () => {
      if (disposed) return;
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer!.setSize(width, height, false);
      render();
    };
    observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();
    if (loading) loading.hidden = true;
    root.dataset.studyState = "ready";
    return dispose;
  } catch (cause) {
    dispose();
    if (loading) loading.hidden = true;
    if (error) error.hidden = false;
    root.dataset.studyState = "error";
    root.dataset.errorStage = initializationStage;
    if (import.meta.env.DEV) {
      console.warn(`[monitor-study] Initialization failed at ${initializationStage} (${cause instanceof Error ? cause.name : "UnknownError"}).`);
    }
    return dispose;
  }
};
