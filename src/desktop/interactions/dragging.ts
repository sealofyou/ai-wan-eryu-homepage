import * as THREE from "three";
import { DESK_LAYOUT } from "../layout";
import { moveKeyboard, movePhysicalMouse, type DesktopState } from "../model";
import { mapRange } from "../objects/primitives";

type DragTarget = "mouse" | "keyboard";

interface DraggingControllerOptions {
  element: HTMLCanvasElement;
  keyboard: THREE.Group;
  getState: () => DesktopState;
  setState: (state: DesktopState) => void;
  updatePositions: () => void;
  drawMainScreen: () => void;
  announce: (message: string) => void;
}

export interface DraggingController {
  beginPointer: (event: PointerEvent) => void;
  trackPointer: (event: PointerEvent) => void;
  start: (target: DragTarget, event: PointerEvent) => void;
  move: (ray: THREE.Ray) => boolean;
  finish: (event: PointerEvent) => void;
  isActive: () => boolean;
  dispose: () => void;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const createDraggingController = ({
  element,
  keyboard,
  getState,
  setState,
  updatePositions,
  drawMainScreen,
  announce,
}: DraggingControllerOptions): DraggingController => {
  const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.54);
  const dragPoint = new THREE.Vector3();
  const pointerDown = new THREE.Vector2();
  let dragTarget: DragTarget | null = null;
  let movedPixels = 0;

  return {
    beginPointer: (event) => {
      pointerDown.set(event.clientX, event.clientY);
      movedPixels = 0;
    },
    trackPointer: (event) => {
      movedPixels = Math.max(
        movedPixels,
        Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y),
      );
    },
    start: (target, event) => {
      dragTarget = target;
      element.classList.add("is-dragging");
      element.setPointerCapture(event.pointerId);
      if (target === "keyboard") keyboard.position.y += DESK_LAYOUT.keyboard.dragLift;
    },
    move: (ray) => {
      if (!dragTarget || !ray.intersectPlane(dragPlane, dragPoint)) return false;
      if (dragTarget === "mouse") {
        const { mouse } = DESK_LAYOUT;
        setState(
          movePhysicalMouse(getState(), {
            x: mapRange(
              clamp(dragPoint.x, mouse.x.start, mouse.x.end),
              mouse.x.start,
              mouse.x.end,
              mouse.inputX.start,
              mouse.inputX.end,
            ),
            y: mapRange(
              clamp(dragPoint.z, mouse.z.start, mouse.z.end),
              mouse.z.start,
              mouse.z.end,
              mouse.inputY.start,
              mouse.inputY.end,
            ),
          }),
        );
        updatePositions();
        drawMainScreen();
      } else {
        const { keyboard: keyboardLayout } = DESK_LAYOUT;
        setState(
          moveKeyboard(getState(), {
            x: mapRange(
              clamp(dragPoint.x, keyboardLayout.x.start, keyboardLayout.x.end),
              keyboardLayout.x.start,
              keyboardLayout.x.end,
              keyboardLayout.inputX.start,
              keyboardLayout.inputX.end,
            ),
            y: mapRange(
              clamp(dragPoint.z, keyboardLayout.z.start, keyboardLayout.z.end),
              keyboardLayout.z.start,
              keyboardLayout.z.end,
              keyboardLayout.inputY.start,
              keyboardLayout.inputY.end,
            ),
          }),
        );
        updatePositions();
        keyboard.position.y += keyboardLayout.dragLift;
      }
      return true;
    },
    finish: (event) => {
      const finishedTarget = dragTarget;
      if (finishedTarget === "keyboard") updatePositions();
      if (finishedTarget && movedPixels > 6) {
        announce(finishedTarget === "mouse" ? "鼠标位置已更新" : "键盘位置已更新");
      }
      dragTarget = null;
      element.classList.remove("is-dragging");
      if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
    },
    isActive: () => Boolean(dragTarget),
    dispose: () => {
      dragTarget = null;
      element.classList.remove("is-dragging");
    },
  };
};
