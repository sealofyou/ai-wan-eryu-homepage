import { addAction } from "../core/actions";
import type { SceneObjectResult } from "../core/types";
import { createKeyboardModel } from "../keyboard";
import { DESK_LAYOUT } from "../layout";
import { mapRange } from "./primitives";

export const createKeyboardObject = (): SceneObjectResult => {
  const group = addAction(createKeyboardModel(), "keyboard");
  return {
    group,
    interactiveTargets: [group],
    update: (state) => {
      const { keyboard } = DESK_LAYOUT;
      group.position.set(
        mapRange(state.keyboard.x, keyboard.inputX.start, keyboard.inputX.end, keyboard.x.start, keyboard.x.end),
        keyboard.y,
        mapRange(state.keyboard.y, keyboard.inputY.start, keyboard.inputY.end, keyboard.z.start, keyboard.z.end),
      );
    },
  };
};
