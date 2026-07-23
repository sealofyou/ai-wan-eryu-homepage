import { describe, expect, it } from "vitest";
import {
  cycleQuote,
  createInitialDesktopState,
  moveKeyboard,
  movePhysicalMouse,
  returnFromContent,
  selectContentItem,
  selectSection,
  selectScreen,
  setMatMode,
  setMessage,
} from "../src/desktop/model";

describe("desktop interaction model", () => {
  it("maps the physical mouse to the monitor cursor while clamping it to the mat", () => {
    const state = createInitialDesktopState();
    const moved = movePhysicalMouse(state, { x: 2, y: -1 });

    expect(moved.physicalMouse).toEqual({ x: 0.93, y: 0.35 });
    expect(moved.screenCursor.x).toBeCloseTo(0.95);
    expect(moved.screenCursor.y).toBeCloseTo(0.08);
  });

  it("keeps the keyboard inside its allowed mat area", () => {
    const state = createInitialDesktopState();

    expect(moveKeyboard(state, { x: -1, y: 2 }).keyboard).toEqual({
      x: 0.2,
      y: 0.82,
    });
  });

  it("switches main-screen content and can return home", () => {
    const state = createInitialDesktopState();
    const detail = selectScreen(state, "recent");
    const home = selectScreen(detail, "home");

    expect(detail.activeScreen).toBe("recent");
    expect(home.activeScreen).toBe("home");
  });

  it("opens a section, previews an item, and returns one level at a time", () => {
    const state = createInitialDesktopState();
    const list = selectSection(state, "articles");
    const preview = selectContentItem(list, "article-1");
    const backToList = returnFromContent(preview);
    const home = returnFromContent(backToList);

    expect(list.contentView).toEqual({
      kind: "list",
      section: "articles",
      page: 0,
    });
    expect(preview.contentView).toEqual({
      kind: "preview",
      section: "articles",
      itemId: "article-1",
    });
    expect(backToList.contentView).toEqual(list.contentView);
    expect(home.contentView).toEqual({ kind: "home" });
    expect(home.activeScreen).toBe("home");
  });

  it("cycles through daily quotes without leaving the available set", () => {
    const state = createInitialDesktopState();
    const next = cycleQuote(state);
    const wrapped = cycleQuote(cycleQuote(next));

    expect(next.quoteIndex).toBe(1);
    expect(wrapped.quoteIndex).toBe(0);
  });

  it("keeps drawing and message input as explicit, separate mat modes", () => {
    const state = createInitialDesktopState();
    const drawing = setMatMode(state, "draw");
    const messaging = setMatMode(drawing, "message");
    const updated = setMessage(messaging, "今天也把想法做出来");

    expect(drawing.matMode).toBe("draw");
    expect(messaging.matMode).toBe("message");
    expect(updated.message).toBe("今天也把想法做出来");
  });
});
