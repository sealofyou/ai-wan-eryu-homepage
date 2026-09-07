import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { disposeObjectGraph } from "../core/renderer";

const MODEL_URL = "/models/desktop/eryu-mouse-study.glb";
const MODEL_CENTER = new THREE.Vector3(0, -0.04, 0);

type CameraPreset = "real" | "top" | "left" | "back";
type ShadingMode = "clay" | "material";

interface MouseStudyElements {
  mount: HTMLElement;
  loading: HTMLElement | null;
  error: HTMLElement | null;
  errorMessage: HTMLElement | null;
  stats: Record<"bytes" | "triangles" | "calls", HTMLElement | null>;
}

interface MaterialSnapshot {
  mesh: THREE.Mesh;
  material: THREE.Material | THREE.Material[];
}

const CAMERA_PRESETS: Record<CameraPreset, THREE.Vector3> = {
  real: new THREE.Vector3(-1.35, 1.35, 1.6),
  top: new THREE.Vector3(0, 2.55, 0.001),
  left: new THREE.Vector3(-2.1, 0.28, 0),
  back: new THREE.Vector3(0, 0.52, 2.25),
};

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unitIndex]}`;
};

const countTriangles = (root: THREE.Object3D) => {
  let triangles = 0;
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const geometry = object.geometry;
    if (geometry.index) {
      triangles += geometry.index.count / 3;
      return;
    }
    const position = geometry.getAttribute("position");
    triangles += position ? position.count / 3 : 0;
  });
  return Math.round(triangles);
};

const setText = (element: HTMLElement | null, text: string) => {
  if (element) element.textContent = text;
};

const setPressed = (root: HTMLElement, selector: string, activeValue: string) => {
  root.querySelectorAll<HTMLButtonElement>(selector).forEach((button) => {
    const active = button.dataset.shadingMode === activeValue || button.dataset.cameraPreset === activeValue;
    button.setAttribute("aria-pressed", String(active));
  });
};

const disposeMaterial = (material: THREE.Material) => {
  Object.values(material).forEach((value) => {
    if (value instanceof THREE.Texture) value.dispose();
  });
  material.dispose();
};

const disposeStoredMaterials = (snapshots: MaterialSnapshot[]) => {
  const materials = new Set<THREE.Material>();
  snapshots.forEach(({ material }) => {
    const materialList = Array.isArray(material) ? material : [material];
    materialList.forEach((entry) => materials.add(entry));
  });
  materials.forEach(disposeMaterial);
};

const disposeGeometries = (root: THREE.Object3D) => {
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) object.geometry.dispose();
  });
};

const readElements = (root: HTMLElement): MouseStudyElements | null => {
  const mount = root.querySelector<HTMLElement>("[data-mouse-canvas]");
  if (!mount) return null;

  return {
    mount,
    loading: root.querySelector<HTMLElement>("[data-mouse-loading]"),
    error: root.querySelector<HTMLElement>("[data-mouse-error]"),
    errorMessage: root.querySelector<HTMLElement>("[data-mouse-error-message]"),
    stats: {
      bytes: root.querySelector<HTMLElement>('[data-stat="bytes"]'),
      triangles: root.querySelector<HTMLElement>('[data-stat="triangles"]'),
      calls: root.querySelector<HTMLElement>('[data-stat="calls"]'),
    },
  };
};

const applyCameraPreset = (
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  preset: CameraPreset,
) => {
  camera.position.copy(CAMERA_PRESETS[preset]);
  camera.lookAt(MODEL_CENTER);
  controls.target.copy(MODEL_CENTER);
  controls.update();
};

const createScene = (mount: HTMLElement) => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#f1f2ef");

  const camera = new THREE.PerspectiveCamera(36, 1, 0.01, 20);
  camera.position.copy(CAMERA_PRESETS.real);
  camera.lookAt(MODEL_CENTER);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.96;
  mount.appendChild(renderer.domElement);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  let environmentTarget: THREE.WebGLRenderTarget;
  try {
    environmentTarget = pmrem.fromScene(room, 0.02);
  } finally {
    room.dispose();
    pmrem.dispose();
  }
  scene.environment = environmentTarget.texture;
  scene.environmentIntensity = 0.45;

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = false;
  controls.target.copy(MODEL_CENTER);
  controls.minDistance = 1.2;
  controls.maxDistance = 5;
  controls.maxPolarAngle = Math.PI * 0.86;

  const ambient = new THREE.HemisphereLight("#ffffff", "#c9c4ba", 1.35);
  scene.add(ambient);

  const key = new THREE.DirectionalLight("#ffffff", 2.4);
  key.position.set(-2.2, 3.4, 2.1);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -1.4;
  key.shadow.camera.right = 1.4;
  key.shadow.camera.top = 1.4;
  key.shadow.camera.bottom = -1.4;
  key.shadow.camera.near = 0.1;
  key.shadow.camera.far = 10;
  key.shadow.camera.updateProjectionMatrix();
  key.shadow.normalBias = 0.015;
  key.shadow.bias = -0.0001;
  key.shadow.radius = 2;
  scene.add(key);

  const fill = new THREE.DirectionalLight("#d8e0df", 0.5);
  fill.position.set(2.4, 1.8, -1.8);
  scene.add(fill);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(3.1, 2.3),
    new THREE.MeshStandardMaterial({ color: "#e5e2dc", roughness: 0.92 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.302;
  ground.receiveShadow = true;
  scene.add(ground);

  const guide = new THREE.GridHelper(2.4, 12, "#b8b8b2", "#d7d5cf");
  guide.position.y = -0.297;
  const guideMaterial = Array.isArray(guide.material) ? guide.material[0] : guide.material;
  guideMaterial.transparent = true;
  guideMaterial.opacity = 0.22;
  scene.add(guide);

  const resize = () => {
    const { clientWidth, clientHeight } = mount;
    const width = Math.max(1, clientWidth);
    const height = Math.max(1, clientHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };

  resize();

  return { scene, camera, renderer, controls, resize, environmentTarget };
};

export const mountMouseStudy = (root: HTMLElement) => {
  const elements = readElements(root);
  if (!elements) return undefined;

  const abortController = new AbortController();
  let environment: ReturnType<typeof createScene>;
  try {
    environment = createScene(elements.mount);
  } catch {
    if (elements.loading) elements.loading.hidden = true;
    if (elements.error) elements.error.hidden = false;
    setText(elements.errorMessage, "当前浏览器未能启动三维预览，请尝试开启硬件加速后刷新。");
    return undefined;
  }
  const { scene, camera, renderer, controls, resize, environmentTarget } = environment;
  const loader = new GLTFLoader();
  const clayMaterial = new THREE.MeshStandardMaterial({
    color: "#a1a6a5",
    roughness: 0.82,
    metalness: 0.02,
  });
  const materialSnapshots: MaterialSnapshot[] = [];
  const disposables: Array<() => void> = [];

  let modelRoot: THREE.Object3D | undefined;
  let disposed = false;
  let shadingMode: ShadingMode = "clay";

  const render = () => {
    renderer.render(scene, camera);
    setText(elements.stats.calls, renderer.info.render.calls.toLocaleString("zh-CN"));
  };

  const applyShading = (mode: ShadingMode) => {
    shadingMode = mode;
    materialSnapshots.forEach(({ mesh, material }) => {
      mesh.material = mode === "clay" ? clayMaterial : material;
    });
    setPressed(root, "[data-shading-mode]", mode);
    render();
  };

  const loadModel = async () => {
    const response = await fetch(MODEL_URL, { signal: abortController.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${MODEL_URL}`);
    }
    const bytes = await response.arrayBuffer();
    if (disposed) return;
    setText(elements.stats.bytes, formatBytes(bytes.byteLength));

    const gltf = await loader.parseAsync(bytes.slice(0), "/models/desktop/");
    if (disposed) {
      disposeObjectGraph(gltf.scene);
      return;
    }
    modelRoot = gltf.scene;
    modelRoot.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = true;
      object.receiveShadow = true;
      materialSnapshots.push({ mesh: object, material: object.material });
    });
    scene.add(modelRoot);
    applyShading(shadingMode);
    setText(elements.stats.triangles, countTriangles(modelRoot).toLocaleString("zh-CN"));
    if (elements.loading) elements.loading.hidden = true;
    render();
  };

  const onResize = () => {
    resize();
    render();
  };

  root.querySelectorAll<HTMLButtonElement>("[data-camera-preset]").forEach((button) => {
    const preset = button.dataset.cameraPreset as CameraPreset | undefined;
    if (!preset || !(preset in CAMERA_PRESETS)) return;
    const onClick = () => {
      applyCameraPreset(camera, controls, preset);
      setPressed(root, "[data-camera-preset]", preset);
    };
    button.addEventListener("click", onClick);
    disposables.push(() => button.removeEventListener("click", onClick));
  });
  setPressed(root, "[data-camera-preset]", "real");

  root.querySelectorAll<HTMLButtonElement>("[data-shading-mode]").forEach((button) => {
    const mode = button.dataset.shadingMode as ShadingMode | undefined;
    if (mode !== "clay" && mode !== "material") return;
    const onClick = () => applyShading(mode);
    button.addEventListener("click", onClick);
    disposables.push(() => button.removeEventListener("click", onClick));
  });

  window.addEventListener("resize", onResize);
  disposables.push(() => window.removeEventListener("resize", onResize));

  void loadModel().catch(() => {
    if (disposed || abortController.signal.aborted) return;
    if (elements.loading) elements.loading.hidden = true;
    if (elements.error) elements.error.hidden = false;
    setText(elements.errorMessage, "模型资源还没有准备好，或当前浏览器无法读取该资源。请稍后刷新重试。");
    render();
  });

  controls.addEventListener("change", render);
  disposables.push(() => controls.removeEventListener("change", render));
  render();

  return () => {
    if (disposed) return;
    disposed = true;
    abortController.abort();
    disposables.splice(0).forEach((dispose) => dispose());
    controls.dispose();
    if (modelRoot) scene.remove(modelRoot);
    if (modelRoot) disposeGeometries(modelRoot);
    disposeStoredMaterials(materialSnapshots);
    clayMaterial.dispose();
    scene.environment = null;
    environmentTarget.dispose();
    scene.traverse((object) => {
      if (!(object instanceof THREE.GridHelper)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material.dispose());
    });
    disposeObjectGraph(scene);
    renderer.dispose();
    renderer.domElement.remove();
  };
};
