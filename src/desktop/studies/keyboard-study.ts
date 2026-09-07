import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { disposeObjectGraph } from "../core/renderer";
import { KEYBOARD_STUDY_FLOOR_Y, createKeyboardStudyModel } from "./keyboard-study-model";

type CameraPreset = "angled" | "top" | "front" | "side";
type ShadingMode = "material" | "clay";
type StatKey = "triangles" | "materials" | "calls";
type InitializationStage = "renderer" | "environment" | "geometry" | "materials" | "controls";

interface KeyboardStudyElements {
  mount: HTMLElement;
  loading: HTMLElement | null;
  error: HTMLElement | null;
  errorMessage: HTMLElement | null;
  stats: Record<StatKey, HTMLElement | null>;
}

interface MaterialSnapshot {
  mesh: THREE.Mesh;
  material: THREE.Material | THREE.Material[];
  visible: boolean;
}

const TARGET = new THREE.Vector3(0, 0.07, 0);
const HIDDEN_IN_CLAY = new Set(["key-legends", "keyboard-brand", "status-lights"]);
const CAMERA_DIRECTIONS: Record<CameraPreset, THREE.Vector3> = {
  angled: new THREE.Vector3(-0.76, 0.48, 0.56),
  top: new THREE.Vector3(0, 1, 0.001),
  front: new THREE.Vector3(0, 0.16, 0.99),
  side: new THREE.Vector3(-1, 0.22, 0.03),
};
const CAMERA_MARGIN = 1.12;
const MIN_FIT_DISTANCE = 8;

interface CameraPose {
  position: THREE.Vector3;
  target: THREE.Vector3;
  up: THREE.Vector3;
}

const setText = (element: HTMLElement | null, text: string) => {
  if (element) element.textContent = text;
};

const setPressed = (root: HTMLElement, selector: string, activeValue: string) => {
  root.querySelectorAll<HTMLButtonElement>(selector).forEach((button) => {
    const active = button.dataset.cameraPreset === activeValue || button.dataset.shadingMode === activeValue;
    button.setAttribute("aria-pressed", String(active));
  });
};

const readElements = (root: HTMLElement): KeyboardStudyElements | null => {
  const mount = root.querySelector<HTMLElement>("[data-keyboard-canvas]");
  if (!mount) return null;

  return {
    mount,
    loading: root.querySelector<HTMLElement>("[data-keyboard-loading]"),
    error: root.querySelector<HTMLElement>("[data-keyboard-error]"),
    errorMessage: root.querySelector<HTMLElement>("[data-keyboard-error-message]"),
    stats: {
      triangles: root.querySelector<HTMLElement>('[data-stat="triangles"]'),
      materials: root.querySelector<HTMLElement>('[data-stat="materials"]'),
      calls: root.querySelector<HTMLElement>('[data-stat="calls"]'),
    },
  };
};

const countMetadata = (root: THREE.Object3D) => {
  let triangles = 0;
  const materials = new Set<THREE.Material>();

  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const position = object.geometry.getAttribute("position");
    triangles += (object.geometry.index?.count ?? position?.count ?? 0) / 3;
    (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => materials.add(material));
  });

  return { triangles: Math.round(triangles), materials: materials.size };
};

const disposeHelperObject = (object: THREE.Object3D) => {
  if (object instanceof THREE.DirectionalLight) object.shadow.dispose();
  if (object instanceof THREE.GridHelper) {
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => material.dispose());
  }
};

const createCameraPoses = (
  bounds: THREE.Box3,
  aspect: number,
  fov: number,
): Record<CameraPreset, CameraPose> => {
  const target = bounds.getCenter(new THREE.Vector3());
  target.y += 0.02;
  const corners = [
    new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.min.z),
    new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.max.z),
    new THREE.Vector3(bounds.min.x, bounds.max.y, bounds.min.z),
    new THREE.Vector3(bounds.min.x, bounds.max.y, bounds.max.z),
    new THREE.Vector3(bounds.max.x, bounds.min.y, bounds.min.z),
    new THREE.Vector3(bounds.max.x, bounds.min.y, bounds.max.z),
    new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.min.z),
    new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.max.z),
  ];
  const verticalFov = THREE.MathUtils.degToRad(fov);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect);
  const poses = {} as Record<CameraPreset, CameraPose>;

  (Object.keys(CAMERA_DIRECTIONS) as CameraPreset[]).forEach((preset) => {
    const direction = CAMERA_DIRECTIONS[preset].clone().normalize();
    const up = preset === "top" ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
    const forward = direction.clone().multiplyScalar(-1);
    const right = new THREE.Vector3().crossVectors(up, forward).normalize();
    const correctedUp = new THREE.Vector3().crossVectors(forward, right).normalize();
    let halfWidth = 0;
    let halfHeight = 0;
    corners.forEach((corner) => {
      const offset = corner.clone().sub(target);
      halfWidth = Math.max(halfWidth, Math.abs(offset.dot(right)));
      halfHeight = Math.max(halfHeight, Math.abs(offset.dot(correctedUp)));
    });
    const distance = Math.max(
      MIN_FIT_DISTANCE,
      (halfWidth / Math.tan(horizontalFov / 2)) * CAMERA_MARGIN,
      (halfHeight / Math.tan(verticalFov / 2)) * CAMERA_MARGIN,
    );
    poses[preset] = {
      position: direction.multiplyScalar(distance).add(target),
      target,
      up,
    };
  });

  return poses;
};

const applyCameraPose = (
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  pose: CameraPose,
) => {
  camera.up.copy(pose.up);
  camera.position.copy(pose.position);
  camera.lookAt(pose.target);
  controls.target.copy(pose.target);
  controls.update();
};

const createScene = (
  mount: HTMLElement,
  markStage: (stage: InitializationStage) => void,
) => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#f1f2ef");

  const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 30);
  camera.position.set(0, 2.4, 8.4);
  camera.lookAt(TARGET);
  let renderer: THREE.WebGLRenderer | undefined;
  let controls: OrbitControls | undefined;
  let environmentTarget: THREE.WebGLRenderTarget | undefined;

  try {
    markStage("renderer");
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.98;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    mount.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false;
    controls.enablePan = false;
    controls.minDistance = 6;
    controls.maxDistance = 14;
    controls.maxPolarAngle = Math.PI * 0.5;
    controls.target.copy(TARGET);
    controls.update();

    markStage("environment");
    const pmrem = new THREE.PMREMGenerator(renderer);
    let room: RoomEnvironment | undefined;
    try {
      room = new RoomEnvironment();
      environmentTarget = pmrem.fromScene(room, 0.035);
    } finally {
      room?.dispose();
      pmrem.dispose();
    }
    scene.environment = environmentTarget.texture;
    scene.environmentIntensity = 0.48;

    scene.add(new THREE.HemisphereLight("#ffffff", "#bbb5aa", 1.55));
    const key = new THREE.DirectionalLight("#fffaf2", 2.6);
    key.position.set(-4, 5.5, 3.8);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -4.8;
    key.shadow.camera.right = 4.8;
    key.shadow.camera.top = 3.2;
    key.shadow.camera.bottom = -3.2;
    key.shadow.camera.near = 0.1;
    key.shadow.camera.far = 14;
    key.shadow.camera.updateProjectionMatrix();
    key.shadow.bias = -0.0001;
    key.shadow.normalBias = 0.018;
    key.shadow.radius = 2;
    scene.add(key);

    const fill = new THREE.DirectionalLight("#dce7e2", 0.62);
    fill.position.set(4.2, 2.8, -3.1);
    scene.add(fill);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(7.4, 3.2),
      new THREE.MeshStandardMaterial({ color: "#e4e1d9", roughness: 0.94 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = KEYBOARD_STUDY_FLOOR_Y;
    ground.receiveShadow = true;
    scene.add(ground);

    const guide = new THREE.GridHelper(6.4, 16, "#b9bab4", "#d7d6cf");
    guide.position.y = KEYBOARD_STUDY_FLOOR_Y + 0.002;
    const guideMaterials = Array.isArray(guide.material) ? guide.material : [guide.material];
    guideMaterials.forEach((material) => {
      material.transparent = true;
      material.opacity = 0.2;
    });
    scene.add(guide);

    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer!.setSize(width, height, false);
    };

    resize();
    return { scene, camera, renderer, controls, resize, environmentTarget };
  } catch (cause) {
    controls?.dispose();
    scene.environment = null;
    environmentTarget?.dispose();
    scene.traverse(disposeHelperObject);
    disposeObjectGraph(scene);
    renderer?.dispose();
    renderer?.domElement.remove();
    throw cause;
  }
};

export const mountKeyboardStudy = (root: HTMLElement) => {
  const elements = readElements(root);
  if (!elements) return undefined;

  const listeners = new AbortController();
  const disposers: Array<() => void> = [];
  const materialSnapshots: MaterialSnapshot[] = [];
  let environment: ReturnType<typeof createScene> | undefined;
  let clayMaterial: THREE.MeshStandardMaterial | undefined;
  let observer: ResizeObserver | undefined;
  let disposed = false;
  let initializationStage: InitializationStage = "renderer";

  const restoreModelState = () => {
    materialSnapshots.forEach(({ mesh, material, visible }) => {
      mesh.material = material;
      mesh.visible = visible;
    });
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    listeners.abort();
    observer?.disconnect();
    disposers.splice(0).forEach((disposeEntry) => disposeEntry());
    environment?.controls.dispose();
    restoreModelState();
    if (environment) {
      environment.scene.environment = null;
      environment.environmentTarget.dispose();
      environment.scene.traverse(disposeHelperObject);
      disposeObjectGraph(environment.scene);
      environment.renderer.dispose();
      environment.renderer.domElement.remove();
    }
    clayMaterial?.dispose();
    root.dataset.studyState = "disposed";
  };

  try {
    environment = createScene(elements.mount, (stage) => { initializationStage = stage; });
    const { scene, camera, renderer, controls, resize } = environment;

    initializationStage = "geometry";
    const keyboardModel = createKeyboardStudyModel({ withLegends: true });
    scene.add(keyboardModel);
    keyboardModel.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      materialSnapshots.push({ mesh: object, material: object.material, visible: object.visible });
    });
    let cameraPoses = createCameraPoses(new THREE.Box3().setFromObject(keyboardModel), camera.aspect, camera.fov);
    applyCameraPose(camera, controls, cameraPoses.angled);
    const metadata = countMetadata(keyboardModel);
    setText(elements.stats.triangles, metadata.triangles.toLocaleString("zh-CN"));
    setText(elements.stats.materials, metadata.materials.toLocaleString("zh-CN"));

    initializationStage = "materials";
    clayMaterial = new THREE.MeshStandardMaterial({ color: "#9da4a1", roughness: 0.82, metalness: 0.02 });
    const render = () => {
      if (disposed) return;
      renderer.render(scene, camera);
      root.dataset.renderCount = String(Number(root.dataset.renderCount ?? "0") + 1);
      setText(elements.stats.calls, renderer.info.render.calls.toLocaleString("zh-CN"));
    };
    const applyShading = (mode: ShadingMode) => {
      materialSnapshots.forEach(({ mesh, material, visible }) => {
        const hiddenInClay = HIDDEN_IN_CLAY.has(mesh.name) || HIDDEN_IN_CLAY.has(mesh.parent?.name ?? "");
        mesh.material = mode === "clay" ? clayMaterial! : material;
        mesh.visible = mode === "clay" && hiddenInClay ? false : visible;
      });
      setPressed(root, "[data-shading-mode]", mode);
      render();
    };

    initializationStage = "controls";
    root.querySelectorAll<HTMLButtonElement>("[data-camera-preset]").forEach((button) => {
      const preset = button.dataset.cameraPreset as CameraPreset | undefined;
      if (!preset || !(preset in CAMERA_DIRECTIONS)) return;
      button.addEventListener("click", () => {
        applyCameraPose(camera, controls, cameraPoses[preset]);
        setPressed(root, "[data-camera-preset]", preset);
        render();
      }, { signal: listeners.signal });
    });
    root.querySelectorAll<HTMLButtonElement>("[data-shading-mode]").forEach((button) => {
      const mode = button.dataset.shadingMode as ShadingMode | undefined;
      if (mode !== "material" && mode !== "clay") return;
      button.addEventListener("click", () => applyShading(mode), { signal: listeners.signal });
    });
    controls.addEventListener("change", render);
    disposers.push(() => controls.removeEventListener("change", render));

    observer = new ResizeObserver(() => {
      if (disposed) return;
      resize();
      cameraPoses = createCameraPoses(new THREE.Box3().setFromObject(keyboardModel), camera.aspect, camera.fov);
      render();
    });
    observer.observe(elements.mount);

    setPressed(root, "[data-camera-preset]", "angled");
    applyShading("material");
    if (elements.loading) elements.loading.hidden = true;
    root.dataset.studyState = "ready";
    render();
    return dispose;
  } catch (cause) {
    dispose();
    if (elements.loading) elements.loading.hidden = true;
    if (elements.error) elements.error.hidden = false;
    setText(elements.errorMessage, `三维预览初始化失败；安全阶段：${initializationStage}。`);
    root.dataset.studyState = "error";
    root.dataset.errorStage = initializationStage;
    if (import.meta.env.DEV) {
      console.warn(`[keyboard-study] Initialization failed at ${initializationStage} (${cause instanceof Error ? cause.name : "UnknownError"}).`);
    }
    return dispose;
  }
};
