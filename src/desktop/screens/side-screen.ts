import type { ScreenId } from "../model";
import { roundRect, type CanvasSurface } from "./canvas-utils";
import { DESKTOP_SECTIONS } from "./sections";

export const renderSideScreen = (
  surface: CanvasSurface,
  activeScreen: ScreenId,
) => {
  const { context, canvas, texture } = surface;
  context.fillStyle = "#202320";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#e8e1d4";
  context.font = '900 43px "Microsoft YaHei", sans-serif';
  context.fillText("动态", 38, 76);
  context.fillStyle = "#82a08f";
  context.font = '700 17px "Microsoft YaHei", sans-serif';
  context.fillText("ACTIVITY", 40, 108);

  DESKTOP_SECTIONS.forEach((section, index) => {
    const y = 152 + index * 222;
    roundRect(context, 28, y, 384, 188, 24);
    context.fillStyle = activeScreen === section.id ? "#343a35" : "#2a2e2a";
    context.fill();
    context.fillStyle = section.color;
    roundRect(context, 48, y + 25, 128, 136, 18);
    context.fill();
    context.fillStyle = "rgba(255,255,255,0.3)";
    context.fillRect(72, y + 54, 78, 12);
    context.fillRect(72, y + 84, 58, 12);
    context.fillRect(72, y + 114, 88, 12);
    context.fillStyle = "#9fb2a6";
    context.font = '700 18px "Microsoft YaHei", sans-serif';
    context.fillText(section.eyebrow, 198, y + 55);
    context.fillStyle = "#f4efe6";
    context.font = '800 27px "Microsoft YaHei", sans-serif';
    context.fillText(section.title, 198, y + 96);
    context.fillStyle = "#aeb5af";
    context.font = '500 16px "Microsoft YaHei", sans-serif';
    context.fillText(section.subtitle, 198, y + 133);
  });
  texture.needsUpdate = true;
};
