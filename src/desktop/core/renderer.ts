import * as THREE from "three";

export interface DesktopRendererEnvironment {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  world: THREE.Group;
  cameraTarget: THREE.Vector3;
  finalCamera: THREE.Vector3;
  introCamera: THREE.Vector3;
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

export const createFramedCameraPosition = (aspect: number, intro = false) => {
  const baseAspect = 16 / 9;
  const distance = clamp(
    12.3 * Math.pow(baseAspect / Math.max(aspect, 1.15), 2.2),
    11.2,
    17,
  );
  return new THREE.Vector3(0.15, intro ? 6.5 : 5.5, intro ? distance + 2.9 : distance);
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
  renderer.toneMappingExposure = 1.08;
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#6d5c4b");
  scene.fog = new THREE.Fog("#6d5c4b", 16, 28);

  const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    60,
  );
  const cameraTarget = new THREE.Vector3(0, 2.9, 0.3);
  const world = new THREE.Group();
  scene.add(world);

  const lampLight = new THREE.PointLight("#ffd39a", 55, 8, 2);
  lampLight.position.set(4.62, 3.7, 0.35);
  lampLight.castShadow = true;
  scene.add(lampLight);

  const screenLight = new THREE.PointLight("#cfe3d8", 28, 8, 2);
  screenLight.position.set(0.8, 3.7, 1.8);
  scene.add(screenLight);

  const hemisphereLight = new THREE.HemisphereLight("#ffe8c8", "#3d3229", 2.2);
  scene.add(hemisphereLight);

  const keyLight = new THREE.DirectionalLight("#fff0d8", 3.4);
  keyLight.position.set(-3, 9, 7);
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
    cameraTarget,
    finalCamera: createFramedCameraPosition(window.innerWidth / window.innerHeight),
    introCamera: createFramedCameraPosition(window.innerWidth / window.innerHeight, true),
    lights: { lampLight, screenLight, hemisphereLight, keyLight },
    resize: () => {
      const aspect = window.innerWidth / window.innerHeight;
      environment.finalCamera = createFramedCameraPosition(aspect);
      environment.introCamera = createFramedCameraPosition(aspect, true);
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    },
  };

  camera.position.copy(reducedMotion ? environment.finalCamera : environment.introCamera);
  camera.lookAt(cameraTarget);

  return environment;
};
