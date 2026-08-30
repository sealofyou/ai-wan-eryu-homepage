import { wrapText, type CanvasSurface } from "./canvas-utils";

export const renderNoteScreen = (surface: CanvasSurface, quote: string) => {
  const { context, canvas, texture } = surface;
  context.fillStyle = "#e9cb78";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(108,78,25,0.14)";
  for (let y = 60; y < canvas.height; y += 62) {
    context.fillRect(28, y, canvas.width - 56, 2);
  }
  context.fillStyle = "#594724";
  context.font = '800 30px "Microsoft YaHei", sans-serif';
  context.fillText("TODAY", 34, 46);
  context.font = '700 33px "Microsoft YaHei", sans-serif';
  wrapText(context, quote, 34, 116, 350, 48);
  texture.needsUpdate = true;
};
