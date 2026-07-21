export type ScreenId = "home" | "share" | "activity" | "recent" | "badge";
export type MatMode = "move" | "draw" | "message";

export interface Point {
  x: number;
  y: number;
}

export interface DesktopState {
  activeScreen: ScreenId;
  physicalMouse: Point;
  screenCursor: Point;
  keyboard: Point;
  quoteIndex: number;
  matMode: MatMode;
  message: string;
}

export const DAILY_QUOTES = [
  "保持好奇，继续动手。",
  "先让它跑起来，再慢慢变好。",
  "今天也留下一点可验证的进展。",
] as const;

const MOUSE_BOUNDS = { minX: 0.66, maxX: 0.93, minY: 0.35, maxY: 0.72 };
const KEYBOARD_BOUNDS = { minX: 0.2, maxX: 0.7, minY: 0.48, maxY: 0.82 };

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const clampPoint = (
  point: Point,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
): Point => ({
  x: clamp(point.x, bounds.minX, bounds.maxX),
  y: clamp(point.y, bounds.minY, bounds.maxY),
});

const mapRange = (value: number, start: number, end: number, nextStart: number, nextEnd: number) =>
  nextStart + ((value - start) / (end - start)) * (nextEnd - nextStart);

export const createInitialDesktopState = (): DesktopState => ({
  activeScreen: "home",
  physicalMouse: { x: 0.82, y: 0.56 },
  screenCursor: { x: 0.58, y: 0.54 },
  keyboard: { x: 0.45, y: 0.66 },
  quoteIndex: 0,
  matMode: "move",
  message: "",
});

export const selectScreen = (state: DesktopState, activeScreen: ScreenId): DesktopState => ({
  ...state,
  activeScreen,
});

export const movePhysicalMouse = (state: DesktopState, point: Point): DesktopState => {
  const physicalMouse = clampPoint(point, MOUSE_BOUNDS);

  return {
    ...state,
    physicalMouse,
    screenCursor: {
      x: mapRange(physicalMouse.x, MOUSE_BOUNDS.minX, MOUSE_BOUNDS.maxX, 0.05, 0.95),
      y: mapRange(physicalMouse.y, MOUSE_BOUNDS.minY, MOUSE_BOUNDS.maxY, 0.08, 0.92),
    },
  };
};

export const moveKeyboard = (state: DesktopState, point: Point): DesktopState => ({
  ...state,
  keyboard: clampPoint(point, KEYBOARD_BOUNDS),
});

export const cycleQuote = (state: DesktopState): DesktopState => ({
  ...state,
  quoteIndex: (state.quoteIndex + 1) % DAILY_QUOTES.length,
});

export const setMatMode = (state: DesktopState, matMode: MatMode): DesktopState => ({
  ...state,
  matMode,
});

export const setMessage = (state: DesktopState, message: string): DesktopState => ({
  ...state,
  message: message.slice(0, 48),
});
