import { wrapText, type CanvasSurface } from "./canvas-utils";

export const renderMessageBoard = (surface: CanvasSurface, message: string) => {
  const { context, canvas, texture } = surface;
  context.fillStyle = "#e5c76e";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(108,78,25,0.16)";
  for (let y = 88; y < canvas.height; y += 54) {
    context.fillRect(28, y, canvas.width - 56, 2);
  }
  if (message) {
    context.fillStyle = "#58431f";
    context.font = '600 30px "Microsoft YaHei", sans-serif';
    wrapText(context, message, 30, 70, canvas.width - 60, 42);
  }
  texture.needsUpdate = true;
};
