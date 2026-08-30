import * as THREE from "three";

export interface DesktopRendererEnvironment {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  world: THREE.Group;
  cameraPoses: Record<DesktopCameraMode, DesktopCameraPose>;
  lights: {
    lampLight: THREE.PointLight;
    screenLight: THREE.PointLight;
    hemisphereLight: THREE.HemisphereLight;
    keyLight: THREE.DirectionalLight;
  };
  resize: () => void;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export type DesktopCameraMode = "overview" | "content" | "intro";

export interface DesktopCameraPose {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

export const createDesktopCameraPose = (
  aspect: number,
  mode: DesktopCameraMode,
): DesktopCameraPose => {
  const aspectScale = clamp(Math.pow((16 / 9) / Math.max(aspect, 1.15), 0.9), 0.94, 1.2);
  const overviewDistance = 13.8 * aspectScale;
  const target = new THREE.Vector3(0.2, 2.95, 0.3);

  if (mode === "content") {
    return {
      position: new THREE.Vector3(0.72, 4.65, 11.7 * aspectScale),
      target: new THREE.Vector3(0.68, 4.08, -0.74),
    };
  }

  if (mode === "intro") {
    return {
      position: new THREE.Vector3(0.18, 6.15, overviewDistance + 2.2),
      target,
    };
  }

  return {
    position: new THREE.Vector3(0.18, 5.45, overviewDistance),
    target,
  };
};

export const createDesktopRendererEnvironment = (
  mount: HTMLElement,
  reducedMotion: boolean,
): DesktopRendererEnvironment => {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#d8c8b4");
  scene.fog = new THREE.Fog("#d8c8b4", 17, 30);

  const camera = new THREE.PerspectiveCamera(
    42,
    window.innerWidth / window.innerHeight,
    0.1,
    60,
  );
  const cameraPoses = {
    overview: createDesktopCameraPose(window.innerWidth / window.innerHeight, "overview"),
    content: createDesktopCameraPose(window.innerWidth / window.innerHeight, "content"),
    intro: createDesktopCameraPose(window.innerWidth / window.innerHeight, "intro"),
  };
  const world = new THREE.Group();
  scene.add(world);

  const lampLight = new THREE.PointLight("#ffd8a5", 42, 8, 2);
  lampLight.position.set(4.55, 3.7, 0.35);
  lampLight.castShadow = true;
  scene.add(lampLight);

  const screenLight = new THREE.PointLight("#d9e4dc", 18, 7, 2);
  screenLight.position.set(0.8, 3.7, 1.8);
  scene.add(screenLight);

  const hemisphereLight = new THREE.HemisphereLight("#fff4e5", "#8a6f5c", 2.7);
  scene.add(hemisphereLight);

  const keyLight = new THREE.DirectionalLight("#fff0dc", 2.8);
  keyLight.position.set(-4, 9, 7);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.left = -10;
  keyLight.shadow.camera.right = 10;
  keyLight.shadow.camera.top = 10;
  keyLight.shadow.camera.bottom = -6;
  scene.add(keyLight);

  const environment: DesktopRendererEnvironment = {
    renderer,
    scene,
    camera,
    world,
    cameraPoses,
    lights: { lampLight, screenLight, hemisphereLight, keyLight },
    resize: () => {
      const aspect = window.innerWidth / window.innerHeight;
      environment.cameraPoses.overview = createDesktopCameraPose(aspect, "overview");
      environment.cameraPoses.content = createDesktopCameraPose(aspect, "content");
      environment.cameraPoses.intro = createDesktopCameraPose(aspect, "intro");
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    },
  };

  const initialPose = reducedMotion ? environment.cameraPoses.overview : environment.cameraPoses.intro;
  camera.position.copy(initialPose.position);
  camera.lookAt(initialPose.target);

  return environment;
};

export const disposeObjectGraph = (root: THREE.Object3D) => {
  const disposedMaterials = new Set<THREE.Material>();
  const disposedTextures = new Set<THREE.Texture>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      if (disposedMaterials.has(material)) return;
      disposedMaterials.add(material);
      Object.values(material).forEach((value) => {
        if (value instanceof THREE.Texture && !disposedTextures.has(value)) {
          disposedTextures.add(value);
          value.dispose();
        }
      });
      material.dispose();
    });
  });
};
