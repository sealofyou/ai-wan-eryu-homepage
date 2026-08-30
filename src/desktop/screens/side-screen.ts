import type { ScreenId } from "../model";
import { roundRect, type CanvasSurface } from "./canvas-utils";
import { DESKTOP_SECTIONS } from "./sections";

export const renderSideScreen = (
  surface: CanvasSurface,
  activeScreen: ScreenId,
) => {
  const { context, canvas, texture } = surface;
  context.fillStyle = "#292c28";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#f1eadf";
  context.font = '900 46px "Microsoft YaHei", sans-serif';
  context.fillText("动态", 38, 76);
  context.fillStyle = "#82a08f";
  context.font = '700 17px "Microsoft YaHei", sans-serif';
  context.fillText("ACTIVITY", 40, 108);

  DESKTOP_SECTIONS.forEach((section, index) => {
    const y = 152 + index * 222;
    roundRect(context, 28, y, 384, 188, 28);
    context.fillStyle = activeScreen === section.id ? "#3b403a" : "#30332f";
    context.fill();
    if (activeScreen === section.id) {
      context.fillStyle = section.color;
      roundRect(context, 28, y + 28, 7, 132, 4);
      context.fill();
    }
    context.fillStyle = section.color;
    roundRect(context, 48, y + 25, 128, 136, 18);
    context.fill();
    context.fillStyle = "rgba(255,255,255,0.28)";
    context.fillRect(72, y + 58, 78, 9);
    context.fillRect(72, y + 86, 58, 9);
    context.fillRect(72, y + 114, 88, 9);
    context.fillStyle = "#9fb2a6";
    context.font = '700 18px "Microsoft YaHei", sans-serif';
    context.fillText(section.eyebrow, 198, y + 55);
    context.fillStyle = "#f4efe6";
    context.font = '800 29px "Microsoft YaHei", sans-serif';
    context.fillText(section.title, 198, y + 96);
    context.fillStyle = "#aeb5af";
    context.font = '500 16px "Microsoft YaHei", sans-serif';
    context.fillText(section.subtitle, 198, y + 133);
  });
  texture.needsUpdate = true;
};
