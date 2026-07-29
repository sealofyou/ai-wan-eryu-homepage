import type { SceneAction } from "../core/types";
import type { ContentSectionId } from "../content";
import { setMessage, type DesktopState, type MatMode, type ScreenId } from "../model";

interface MessageControllerOptions {
  root: HTMLElement;
  messagePanel: HTMLFormElement;
  messageInput: HTMLInputElement;
  getState: () => DesktopState;
  setState: (state: DesktopState) => void;
  setScreen: (screen: ScreenId) => void;
  setSection: (section: ContentSectionId) => void;
  setMode: (mode: MatMode) => void;
  applyAction: (action: SceneAction | undefined) => void;
  clearDrawing: () => void;
  drawMainScreen: () => void;
  drawMessageBoard: () => void;
  announce: (message: string) => void;
}

export interface MessageController {
  dispose: () => void;
}

export const createMessageController = ({
  root,
  messagePanel,
  messageInput,
  getState,
  setState,
  setScreen,
  setSection,
  setMode,
  applyAction,
  clearDrawing,
  drawMainScreen,
  drawMessageBoard,
  announce,
}: MessageControllerOptions): MessageController => {
  const cleanups: Array<() => void> = [];
  const listen = <K extends keyof HTMLElementEventMap>(
    element: HTMLElement,
    type: K,
    listener: (event: HTMLElementEventMap[K]) => void,
  ) => {
    element.addEventListener(type, listener as EventListener);
    cleanups.push(() => element.removeEventListener(type, listener as EventListener));
  };

  root.querySelectorAll<HTMLButtonElement>("[data-screen]").forEach((button) => {
    listen(button, "click", () => setScreen(button.dataset.screen as ScreenId));
  });
  root.querySelectorAll<HTMLButtonElement>("[data-section]").forEach((button) => {
    listen(button, "click", () => setSection(button.dataset.section as ContentSectionId));
  });
  root.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((button) => {
    listen(button, "click", () => setMode(button.dataset.mode as MatMode));
  });

  const quoteButton = root.querySelector<HTMLButtonElement>('[data-action="quote"]');
  if (quoteButton) listen(quoteButton, "click", () => applyAction("quote"));
  const badgeButton = root.querySelector<HTMLButtonElement>('[data-action="badge"]');
  if (badgeButton) listen(badgeButton, "click", () => applyAction("badge"));
  const clearButton = root.querySelector<HTMLButtonElement>('[data-action="clear"]');
  if (clearButton) listen(clearButton, "click", clearDrawing);

  const onSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    const nextState = setMessage(getState(), messageInput.value.trim());
    setState(nextState);
    drawMainScreen();
    drawMessageBoard();
    announce(nextState.message ? "留言已经写在洞洞板上" : "留言已清空");
  };
  messagePanel.addEventListener("submit", onSubmit);
  cleanups.push(() => messagePanel.removeEventListener("submit", onSubmit));

  return { dispose: () => cleanups.splice(0).forEach((cleanup) => cleanup()) };
};
