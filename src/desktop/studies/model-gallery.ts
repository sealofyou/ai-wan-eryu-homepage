import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { disposeObjectGraph } from "../core/renderer";
import type { GalleryItem, GalleryModel } from "./model-gallery-catalog";

type CameraPreset = "angled" | "front" | "side" | "back" | "top";
type ShadingMode = "material" | "clay";
type StatKey = "triangles" | "materials" | "calls";
type InitializationStage = "renderer" | "controls" | "environment" | "lights" | "catalog" | "model";

interface GalleryElements {
  mount: HTMLElement;
  select: HTMLSelectElement | null;
  loading: HTMLElement | null;
  loadingText: HTMLElement | null;
  error: HTMLElement | null;
  errorMessage: HTMLElement | null;
  retry: HTMLButtonElement | null;
  status: HTMLElement | null;
  stats: Record<StatKey, HTMLElement | null>;
}

interface GalleryEnvironment {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  host: THREE.Group;
  environmentTarget: THREE.WebGLRenderTarget;
  resize: () => void;
}

interface MaterialSnapshot {
  mesh: THREE.Mesh;
  material: THREE.Material | THREE.Material[];
  visible: boolean;
  castShadow: boolean;
  receiveShadow: boolean;
}

export interface GalleryCatalog {
  GALLERY_ITEMS: readonly GalleryItem[];
  loadGalleryModel: (id: string) => Promise<GalleryModel>;
}

const TARGET = new THREE.Vector3(0, 0.72, 0);
const CAMERA_MARGIN = 1.1;
const MIN_FIT_DISTANCE = 1.6;
const MAX_FIT_DISTANCE = 26;
const NORMALIZED_MAX_SIZE = 3.1;
const CAMERA_DIRECTIONS: Record<CameraPreset, THREE.Vector3> = {
  angled: new THREE.Vector3(-0.75, 0.44, 0.5),
  front: new THREE.Vector3(0, 0.16, 1),
  side: new THREE.Vector3(-1, 0.18, 0.02),
  back: new THREE.Vector3(0, 0.22, -1),
  top: new THREE.Vector3(0, 1, 0.001),
};

const CLAY_HIDDEN_NAME_PARTS = ["legend", "label", "brand", "logo", "text", "word", "decal", "avatar", "sticker"];
const loadDefaultCatalog = async (): Promise<GalleryCatalog> => import("./model-gallery-catalog");

const setText = (element: HTMLElement | null, text: string) => {
  if (element) element.textContent = text;
};

const formatNumber = (value: number) => Math.round(value).toLocaleString("zh-CN");

const readElements = (root: HTMLElement): GalleryElements | null => {
  const mount = root.querySelector<HTMLElement>("[data-gallery-canvas]");
  if (!mount) return null;

  return {
    mount,
    select: root.querySelector<HTMLSelectElement>("[data-gallery-select]"),
    loading: root.querySelector<HTMLElement>("[data-gallery-loading]"),
    loadingText: root.querySelector<HTMLElement>("[data-gallery-loading-text]"),
    error: root.querySelector<HTMLElement>("[data-gallery-error]"),
    errorMessage: root.querySelector<HTMLElement>("[data-gallery-error-message]"),
    retry: root.querySelector<HTMLButtonElement>("[data-gallery-retry]"),
    status: root.querySelector<HTMLElement>("[data-gallery-status]"),
    stats: {
      triangles: root.querySelector<HTMLElement>('[data-stat="triangles"]'),
      materials: root.querySelector<HTMLElement>('[data-stat="materials"]'),
      calls: root.querySelector<HTMLElement>('[data-stat="calls"]'),
    },
  };
};

const setPressed = (root: HTMLElement, selector: string, activeValue: string) => {
  root.querySelectorAll<HTMLButtonElement>(selector).forEach((button) => {
    const active = button.dataset.cameraPreset === activeValue || button.dataset.shadingMode === activeValue;
    button.setAttribute("aria-pressed", String(active));
  });
};

const disposeHelperObject = (object: THREE.Object3D) => {
  const maybeLight = object as THREE.Light & { shadow?: THREE.LightShadow };
  maybeLight.shadow?.dispose();
  if (object instanceof THREE.GridHelper) {
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => material.dispose());
  }
};

const makeBoxCorners = (bounds: THREE.Box3) => [
  new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.min.z),
  new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.max.z),
  new THREE.Vector3(bounds.min.x, bounds.max.y, bounds.min.z),
  new THREE.Vector3(bounds.min.x, bounds.max.y, bounds.max.z),
  new THREE.Vector3(bounds.max.x, bounds.min.y, bounds.min.z),
  new THREE.Vector3(bounds.max.x, bounds.min.y, bounds.max.z),
  new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.min.z),
  new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.max.z),
];

const getCameraBasis = (direction: THREE.Vector3, requestedUp: THREE.Vector3) => {
  const forward = direction.clone().multiplyScalar(-1).normalize();
  const right = new THREE.Vector3().crossVectors(requestedUp, forward).normalize();
  const up = new THREE.Vector3().crossVectors(forward, right).normalize();
  return { forward, right, up };
};

const fitDistanceForBounds = (
  bounds: THREE.Box3,
  target: THREE.Vector3,
  direction: THREE.Vector3,
  up: THREE.Vector3,
  aspect: number,
  fov: number,
) => {
  const verticalFov = THREE.MathUtils.degToRad(fov);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect);
  const basis = getCameraBasis(direction, up);
  let distance = MIN_FIT_DISTANCE;

  makeBoxCorners(bounds).forEach((corner) => {
    const offset = corner.clone().sub(target);
    const depthOffset = offset.dot(direction);
    const xDistance = (Math.abs(offset.dot(basis.right)) * CAMERA_MARGIN) / Math.tan(horizontalFov / 2) + depthOffset;
    const yDistance = (Math.abs(offset.dot(basis.up)) * CAMERA_MARGIN) / Math.tan(verticalFov / 2) + depthOffset;
    distance = Math.max(distance, xDistance, yDistance);
  });

  return THREE.MathUtils.clamp(distance, MIN_FIT_DISTANCE, MAX_FIT_DISTANCE);
};

const fitCameraToBounds = (
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  bounds: THREE.Box3,
  direction: THREE.Vector3,
  up = new THREE.Vector3(0, 1, 0),
) => {
  const target = bounds.getCenter(new THREE.Vector3());
  if (!Number.isFinite(target.x)) target.copy(TARGET);
  const normalizedDirection = direction.clone().normalize();
  const distance = fitDistanceForBounds(bounds, target, normalizedDirection, up, camera.aspect, camera.fov);
  camera.up.copy(up);
  camera.position.copy(normalizedDirection.multiplyScalar(distance).add(target));
  camera.near = Math.max(0.01, distance / 100);
  camera.far = Math.max(30, distance * 5);
  camera.updateProjectionMatrix();
  controls.target.copy(target);
  controls.minDistance = Math.max(0.3, distance * 0.34);
  controls.maxDistance = Math.max(controls.minDistance + 0.5, distance * 2.4);
  controls.update();
};

const createDisplayRoot = (modelRoot: THREE.Group) => {
  const displayRoot = new THREE.Group();
  displayRoot.name = `${modelRoot.name || "gallery-model"}-display-root`;
  displayRoot.add(modelRoot);
  return displayRoot;
};

const normalizeDisplayRoot = (root: THREE.Group) => {
  root.updateWorldMatrix(true, true);
  const sourceBounds = new THREE.Box3().setFromObject(root);
  const size = sourceBounds.getSize(new THREE.Vector3());
  const maxSize = Math.max(size.x, size.y, size.z);
  const scale = Number.isFinite(maxSize) && maxSize > 0 ? Math.min(NORMALIZED_MAX_SIZE / maxSize, 12) : 1;
  const center = sourceBounds.getCenter(new THREE.Vector3());
  root.scale.setScalar(scale);
  root.position.set(-center.x * scale, -sourceBounds.min.y * scale, -center.z * scale);
  root.updateWorldMatrix(true, true);
  return new THREE.Box3().setFromObject(root);
};

const countMetadata = (root: THREE.Object3D) => {
  let triangles = 0;
  const materials = new Set<THREE.Material>();

  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const position = object.geometry.getAttribute("position");
    const baseTriangles = (object.geometry.index?.count ?? position?.count ?? 0) / 3;
    const instanceCount = object instanceof THREE.InstancedMesh ? object.count : 1;
    triangles += baseTriangles * instanceCount;
    (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => materials.add(material));
  });

  return { triangles, materials: materials.size };
};

const shouldHideInClay = (mesh: THREE.Mesh) => {
  const names = [mesh.name, mesh.parent?.name ?? ""].join(" ").toLowerCase();
  return CLAY_HIDDEN_NAME_PARTS.some((part) => names.includes(part));
};

const snapshotMaterials = (root: THREE.Object3D) => {
  const snapshots: MaterialSnapshot[] = [];
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    snapshots.push({
      mesh: object,
      material: object.material,
      visible: object.visible,
      castShadow: object.castShadow,
      receiveShadow: object.receiveShadow,
    });
  });
  return snapshots;
};

const restoreSnapshots = (snapshots: MaterialSnapshot[]) => {
  snapshots.forEach(({ mesh, material, visible, castShadow, receiveShadow }) => {
    mesh.material = material;
    mesh.visible = visible;
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
  });
};

const createScene = (mount: HTMLElement, markStage: (stage: InitializationStage) => void): GalleryEnvironment => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#f1f2ef");
  const camera = new THREE.PerspectiveCamera(36, 1, 0.01, 80);
  camera.position.set(0, 1.4, 6);
  camera.lookAt(TARGET);
  const host = new THREE.Group();
  host.name = "model-gallery-host";
  scene.add(host);
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

    markStage("controls");
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false;
    controls.enablePan = false;
    controls.target.copy(TARGET);
    controls.update();

    markStage("environment");
    const pmrem = new THREE.PMREMGenerator(renderer);
    let room: RoomEnvironment | undefined;
    try {
      room = new RoomEnvironment();
      environmentTarget = pmrem.fromScene(room, 0.04);
    } finally {
      room?.dispose();
      pmrem.dispose();
    }
    scene.environment = environmentTarget.texture;
    scene.environmentIntensity = 0.52;

    markStage("lights");
    scene.add(new THREE.HemisphereLight("#ffffff", "#b8b4ac", 1.55));
    const key = new THREE.DirectionalLight("#fffaf2", 2.8);
    key.position.set(-4.4, 6, 4.2);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -5;
    key.shadow.camera.right = 5;
    key.shadow.camera.top = 5;
    key.shadow.camera.bottom = -2.8;
    key.shadow.camera.near = 0.1;
    key.shadow.camera.far = 18;
    key.shadow.camera.updateProjectionMatrix();
    key.shadow.bias = -0.0001;
    key.shadow.normalBias = 0.02;
    scene.add(key);

    const fill = new THREE.DirectionalLight("#dfe8e2", 0.72);
    fill.position.set(4.2, 3.4, -4.4);
    scene.add(fill);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(6.8, 4.4),
      new THREE.MeshStandardMaterial({ color: "#e5e3dc", roughness: 0.95 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const guide = new THREE.GridHelper(5.8, 14, "#bec0b9", "#d8d8d1");
    guide.position.y = 0.002;
    const guideMaterials = Array.isArray(guide.material) ? guide.material : [guide.material];
    guideMaterials.forEach((material) => {
      material.transparent = true;
      material.opacity = 0.18;
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
    return { scene, camera, renderer, controls, host, environmentTarget, resize };
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

export const mountModelGallery = (root: HTMLElement, providedCatalog?: GalleryCatalog) => {
  const elements = readElements(root);
  if (!elements) return undefined;

  const listeners = new AbortController();
  const disposers: Array<() => void> = [];
  let environment: GalleryEnvironment | undefined;
  let observer: ResizeObserver | undefined;
  let clayMaterial: THREE.MeshStandardMaterial | undefined;
  let currentModel: GalleryModel | undefined;
  let currentDisplayRoot: THREE.Group | undefined;
  let currentSnapshots: MaterialSnapshot[] = [];
  let currentBounds = new THREE.Box3().setFromCenterAndSize(TARGET, new THREE.Vector3(2, 2, 2));
  let disposed = false;
  let generation = 0;
  let galleryItems: readonly GalleryItem[] = [];
  let loadModel: GalleryCatalog["loadGalleryModel"] | undefined;
  let activePreset: CameraPreset = "angled";
  let shadingMode: ShadingMode = "material";
  let initializationStage: InitializationStage = "renderer";
  let retryAction: "model" | "reload" = "model";

  const showLoading = (label: string) => {
    if (elements.loading) elements.loading.hidden = false;
    if (elements.error) elements.error.hidden = true;
    setText(elements.loadingText, `正在准备${label}`);
    setText(elements.status, `正在加载：${label}`);
    root.dataset.galleryState = "loading";
  };

  const showError = (message: string, stage: string, nextRetryAction: "model" | "reload" = "model") => {
    if (elements.loading) elements.loading.hidden = true;
    if (elements.error) elements.error.hidden = false;
    if (elements.retry) elements.retry.textContent = nextRetryAction === "reload" ? "重新加载" : "重试";
    setText(elements.errorMessage, message);
    setText(elements.status, message);
    setText(elements.stats.triangles, "-");
    setText(elements.stats.materials, "-");
    setText(elements.stats.calls, "-");
    root.dataset.galleryState = "error";
    root.dataset.errorStage = stage;
    retryAction = nextRetryAction;
  };

  const render = () => {
    if (disposed || !environment) return;
    environment.renderer.render(environment.scene, environment.camera);
    root.dataset.renderCount = String(Number(root.dataset.renderCount ?? "0") + 1);
    setText(elements.stats.calls, environment.renderer.info.render.calls.toLocaleString("zh-CN"));
  };

  const clearCurrentModel = () => {
    if (!currentModel) return;
    restoreSnapshots(currentSnapshots);
    if (currentDisplayRoot) {
      environment?.host.remove(currentDisplayRoot);
      currentDisplayRoot.remove(currentModel.root);
    } else {
      environment?.host.remove(currentModel.root);
    }
    currentModel.dispose();
    currentModel = undefined;
    currentDisplayRoot = undefined;
    currentSnapshots = [];
  };

  const applyCurrentShading = () => {
    currentSnapshots.forEach(({ mesh, material, visible }) => {
      mesh.material = shadingMode === "clay" ? clayMaterial! : material;
      mesh.visible = shadingMode === "clay" && shouldHideInClay(mesh) ? false : visible;
    });
    setPressed(root, "[data-shading-mode]", shadingMode);
    render();
  };

  const fitCurrentView = (direction?: THREE.Vector3) => {
    if (!environment) return;
    const currentDirection = direction ?? environment.camera.position.clone().sub(environment.controls.target).normalize();
    const up = activePreset === "top" ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
    fitCameraToBounds(environment.camera, environment.controls, currentBounds, currentDirection, up);
  };

  const selectModel = async (id: string) => {
    const selected = galleryItems.find((item) => item.id === id) ?? galleryItems[0];
    if (!selected || !environment || !loadModel) return;
    const requestGeneration = ++generation;
    initializationStage = "model";
    showLoading(selected.label);
    clearCurrentModel();
    render();

    try {
      const descriptor = await loadModel(selected.id);
      if (disposed || requestGeneration !== generation) {
        descriptor.dispose();
        return;
      }

      currentModel = descriptor;
      currentSnapshots = snapshotMaterials(descriptor.root);
      currentDisplayRoot = createDisplayRoot(descriptor.root);
      environment.host.add(currentDisplayRoot);
      currentBounds = normalizeDisplayRoot(currentDisplayRoot);
      const metadata = countMetadata(descriptor.root);
      setText(elements.stats.triangles, formatNumber(metadata.triangles));
      setText(elements.stats.materials, formatNumber(metadata.materials));
      setText(elements.status, descriptor.note ?? "隐藏结构为合理近似。");
      if (elements.loading) elements.loading.hidden = true;
      if (elements.error) elements.error.hidden = true;
      root.dataset.galleryState = "ready";
      root.dataset.selectedModel = selected.id;
      fitCurrentView(CAMERA_DIRECTIONS[activePreset]);
      applyCurrentShading();
    } catch (cause) {
      if (disposed || requestGeneration !== generation) return;
      const safeStage = `model:${selected.id}`;
      showError(`模型加载失败；安全阶段：${safeStage}。可重试。`, safeStage, "model");
      if (import.meta.env.DEV) {
        console.warn(`[model-gallery] Load failed at ${safeStage} (${cause instanceof Error ? cause.name : "UnknownError"}).`);
      }
      render();
    }
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    generation++;
    listeners.abort();
    observer?.disconnect();
    disposers.splice(0).forEach((disposeEntry) => disposeEntry());
    clearCurrentModel();
    environment?.controls.dispose();
    if (environment) {
      environment.scene.environment = null;
      environment.environmentTarget.dispose();
      environment.scene.traverse(disposeHelperObject);
      disposeObjectGraph(environment.scene);
      environment.renderer.dispose();
      environment.renderer.domElement.remove();
    }
    clayMaterial?.dispose();
    root.dataset.galleryState = "disposed";
  };

  const reloadPage = () => {
    window.location.reload();
  };

  try {
    environment = createScene(elements.mount, (stage) => { initializationStage = stage; });
    clayMaterial = new THREE.MeshStandardMaterial({ color: "#9ea4a0", roughness: 0.84, metalness: 0.02 });
    if (elements.select) {
      elements.select.addEventListener("change", () => {
        void selectModel(elements.select!.value);
      }, { signal: listeners.signal });
    }

    root.querySelectorAll<HTMLButtonElement>("[data-camera-preset]").forEach((button) => {
      const preset = button.dataset.cameraPreset as CameraPreset | undefined;
      if (!preset || !(preset in CAMERA_DIRECTIONS)) return;
      button.addEventListener("click", () => {
        activePreset = preset;
        fitCurrentView(CAMERA_DIRECTIONS[preset]);
        setPressed(root, "[data-camera-preset]", preset);
        render();
      }, { signal: listeners.signal });
    });
    root.querySelectorAll<HTMLButtonElement>("[data-shading-mode]").forEach((button) => {
      const mode = button.dataset.shadingMode as ShadingMode | undefined;
      if (mode !== "material" && mode !== "clay") return;
      button.addEventListener("click", () => {
        shadingMode = mode;
        applyCurrentShading();
      }, { signal: listeners.signal });
    });
    elements.retry?.addEventListener("click", () => {
      if (retryAction === "reload" || !loadModel) {
        reloadPage();
        return;
      }
      const id = elements.select?.value || galleryItems[0]?.id;
      if (id) void selectModel(id);
    }, { signal: listeners.signal });
    environment.controls.addEventListener("change", render);
    disposers.push(() => environment?.controls.removeEventListener("change", render));

    observer = new ResizeObserver(() => {
      if (disposed || !environment) return;
      const direction = environment.camera.position.clone().sub(environment.controls.target).normalize();
      environment.resize();
      fitCurrentView(direction);
      render();
    });
    observer.observe(elements.mount);

    const initializeCatalog = async () => {
      const catalogGeneration = ++generation;
      initializationStage = "catalog";
      showLoading("模型目录");
      try {
        const catalog = providedCatalog ?? await loadDefaultCatalog();
        if (disposed || catalogGeneration !== generation) return;
        galleryItems = catalog.GALLERY_ITEMS;
        loadModel = catalog.loadGalleryModel;
        if (elements.select) {
          elements.select.replaceChildren(...galleryItems.map((item) => {
            const option = document.createElement("option");
            option.value = item.id;
            option.textContent = item.label;
            return option;
          }));
          elements.select.value = galleryItems[0]?.id ?? "";
        }
        setPressed(root, "[data-camera-preset]", activePreset);
        setPressed(root, "[data-shading-mode]", shadingMode);
        void selectModel(galleryItems[0]?.id ?? "computer");
      } catch (cause) {
        if (disposed || catalogGeneration !== generation) return;
        showError("模型目录加载失败；安全阶段：catalog。请重新加载页面。", "catalog", "reload");
        if (import.meta.env.DEV) {
          console.warn(`[model-gallery] Catalog load failed (${cause instanceof Error ? cause.name : "UnknownError"}).`);
        }
        render();
      }
    };

    void initializeCatalog();
    return dispose;
  } catch (cause) {
    dispose();
    showError(`三维预览初始化失败；安全阶段：${initializationStage}。请重新加载页面。`, initializationStage, "reload");
    elements.retry?.addEventListener("click", reloadPage, { once: true });
    if (import.meta.env.DEV) {
      console.warn(`[model-gallery] Initialization failed at ${initializationStage} (${cause instanceof Error ? cause.name : "UnknownError"}).`);
    }
    return dispose;
  }
};
