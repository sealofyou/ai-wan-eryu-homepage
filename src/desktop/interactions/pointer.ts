import * as THREE from "three";
import { actionFromObject } from "../core/actions";
import type { SceneAction } from "../core/types";
import { getContentPage, type ContentSectionId, type DesktopContentItem } from "../content";
import { setContentPage, type DesktopState } from "../model";
import type { DraggingController } from "./dragging";
import type { MousepadController } from "./mousepad";

interface PointerControllerOptions {
  root: HTMLElement;
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  world: THREE.Group;
  matSurface: THREE.Mesh;
  mainScreen: THREE.Mesh;
  reducedMotion: boolean;
  dragging: DraggingController;
  mousepad: MousepadController;
  getState: () => DesktopState;
  setState: (state: DesktopState) => void;
  itemsForSection: (section: ContentSectionId) => DesktopContentItem[];
  updateScreens: () => void;
  applyAction: (action: SceneAction | undefined) => void;
}

export interface PointerController {
  getParallax: () => { x: number; y: number };
  dispose: () => void;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const createPointerController = ({
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
}: PointerControllerOptions): PointerController => {
  const element = renderer.domElement;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let parallaxX = 0;
  let parallaxY = 0;

  const updatePointer = (event: PointerEvent) => {
    const bounds = element.getBoundingClientRect();
    pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
  };
  const intersections = () => raycaster.intersectObjects(world.children, true);
  const matIntersection = () => raycaster.intersectObject(matSurface, false)[0];

  const onPointerDown = (event: PointerEvent) => {
    updatePointer(event);
    dragging.beginPointer(event);
    const action = actionFromObject(intersections()[0]?.object ?? null);
    if (action === "mouse" || action === "keyboard") {
      dragging.start(action, event);
      return;
    }
    if (action === "mat" && getState().matMode === "draw") {
      const matHit = matIntersection();
      if (matHit?.uv) {
        mousepad.begin({ x: matHit.uv.x, y: matHit.uv.y });
        element.setPointerCapture(event.pointerId);
      }
      return;
    }
    applyAction(action);
  };

  const onPointerMove = (event: PointerEvent) => {
    updatePointer(event);
    dragging.trackPointer(event);
    if (dragging.move(raycaster.ray)) return;
    if (mousepad.isActive()) {
      const matHit = matIntersection();
      if (matHit?.uv) mousepad.extend({ x: matHit.uv.x, y: matHit.uv.y });
      return;
    }
    const action = actionFromObject(intersections()[0]?.object ?? null);
    element.classList.toggle("is-interactive", Boolean(action));
  };

  const onWheel = (event: WheelEvent) => {
    const state = getState();
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
    setState(setContentPage(state, nextPage));
    updateScreens();
  };

  const finishPointer = (event: PointerEvent) => {
    dragging.finish(event);
    mousepad.finish();
  };

  const onParallax = (event: PointerEvent) => {
    if (reducedMotion || dragging.isActive() || mousepad.isActive()) return;
    parallaxX = (event.clientX / window.innerWidth - 0.5) * 0.32;
    parallaxY = (event.clientY / window.innerHeight - 0.5) * 0.18;
  };

  element.addEventListener("pointerdown", onPointerDown);
  element.addEventListener("pointermove", onPointerMove);
  element.addEventListener("wheel", onWheel, { passive: false });
  element.addEventListener("pointerup", finishPointer);
  element.addEventListener("pointercancel", finishPointer);
  root.addEventListener("pointermove", onParallax);

  return {
    getParallax: () => ({ x: parallaxX, y: parallaxY }),
    dispose: () => {
      element.removeEventListener("pointerdown", onPointerDown);
      element.removeEventListener("pointermove", onPointerMove);
      element.removeEventListener("wheel", onWheel);
      element.removeEventListener("pointerup", finishPointer);
      element.removeEventListener("pointercancel", finishPointer);
      root.removeEventListener("pointermove", onParallax);
      element.classList.remove("is-interactive", "is-dragging");
    },
  };
};
