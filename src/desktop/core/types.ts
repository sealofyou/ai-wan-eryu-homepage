import type * as THREE from "three";
import type { ContentSectionId } from "../content";
import type { DesktopState, MatMode, ScreenId } from "../model";

export type SceneAction =
  | `screen:${ScreenId}`
  | `section:${ContentSectionId}`
  | `content:${string}`
  | `mode:${MatMode}`
  | "content-back"
  | "content-open"
  | "page-prev"
  | "page-next"
  | "quote"
  | "badge"
  | "clear"
  | "mouse"
  | "keyboard"
  | "mat"
  | "message"
  | "lamp";

export interface SceneObjectResult {
  group: THREE.Group;
  interactiveTargets?: THREE.Object3D[];
  update?: (state: DesktopState) => void;
  dispose?: () => void;
}
