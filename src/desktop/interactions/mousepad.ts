import type { Point } from "../model";
import type { CanvasSurface } from "../screens/canvas-utils";
import { roundRect } from "../screens/canvas-utils";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export interface MousepadController {
  draw: () => void;
  begin: (point: Point) => void;
  extend: (point: Point) => void;
  finish: () => void;
  addStroke: (points: Point[]) => void;
  clear: () => void;
  isActive: () => boolean;
  dispose: () => void;
}

export const createMousepadController = (surface: CanvasSurface): MousepadController => {
  const strokes: Point[][] = [];
  let activeStroke: Point[] | null = null;

  const draw = () => {
    const { context, canvas, texture } = surface;
    context.fillStyle = "#dfd8cc";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "#95a9a0";
    context.lineWidth = 12;
    roundRect(context, 10, 10, canvas.width - 20, canvas.height - 20, 38);
    context.stroke();
    context.fillStyle = "rgba(119,145,132,0.12)";
    for (let x = 88; x < canvas.width; x += 200) {
      context.fillRect(x, 62 + ((x / 200) % 2) * 246, 24, 24);
      context.fillRect(x + 32, 62 + ((x / 200) % 2) * 246, 24, 24);
      context.fillRect(x + 16, 86 + ((x / 200) % 2) * 246, 24, 24);
    }
    context.strokeStyle = "#4f7264";
    context.lineWidth = 7;
    context.lineCap = "round";
    context.lineJoin = "round";
    strokes.forEach((stroke) => {
      if (stroke.length < 2) return;
      context.beginPath();
      context.moveTo(stroke[0].x * canvas.width, (1 - stroke[0].y) * canvas.height);
      stroke.slice(1).forEach((point) => {
        context.lineTo(point.x * canvas.width, (1 - point.y) * canvas.height);
      });
      context.stroke();
    });
    texture.needsUpdate = true;
  };

  return {
    draw,
    begin: (point) => {
      activeStroke = [{ x: point.x, y: point.y }];
      strokes.push(activeStroke);
    },
    extend: (point) => {
      if (!activeStroke) return;
      activeStroke.push({ x: point.x, y: point.y });
      draw();
    },
    finish: () => {
      activeStroke = null;
    },
    addStroke: (points) => {
      strokes.push(points.map((point) => ({ x: clamp(point.x, 0, 1), y: clamp(point.y, 0, 1) })));
      draw();
    },
    clear: () => {
      strokes.length = 0;
      draw();
    },
    isActive: () => Boolean(activeStroke),
    dispose: () => {
      activeStroke = null;
      strokes.length = 0;
    },
  };
};
