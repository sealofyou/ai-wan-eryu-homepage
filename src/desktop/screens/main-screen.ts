import {
  getContentPage,
  resolveContentUrl,
  type ContentSectionId,
  type DesktopContentItem,
} from "../content";
import type { DesktopState } from "../model";
import {
  drawImageCover,
  roundRect,
  truncateToWidth,
  wrapText,
  type CanvasSurface,
} from "./canvas-utils";
import { DESKTOP_SECTIONS } from "./sections";

interface MainScreenOptions {
  surface: CanvasSurface;
  state: DesktopState;
  avatarImage: HTMLImageElement;
  contentById: ReadonlyMap<string, DesktopContentItem>;
  itemsForSection: (section: ContentSectionId) => DesktopContentItem[];
}

const drawScreenButton = (
  context: CanvasRenderingContext2D,
  label: string,
  x: number,
  y: number,
  width: number,
  active = true,
) => {
  roundRect(context, x, y, width, 58, 16);
  context.fillStyle = active ? "#282c29" : "#dfe3dc";
  context.fill();
  context.fillStyle = active ? "#fffdf8" : "#626b65";
  context.font = '700 22px "Microsoft YaHei", sans-serif';
  context.textAlign = "center";
  context.fillText(label, x + width / 2, y + 38);
  context.textAlign = "left";
};

const drawBadgeScreen = (context: CanvasRenderingContext2D, height: number) => {
  context.fillStyle = "#d6a755";
  context.fillRect(0, 0, 22, height);
  context.fillStyle = "#5f655f";
  context.font = '700 22px "Microsoft YaHei", sans-serif';
  context.fillText("PEGBOARD / BADGE", 72, 88);
  context.fillStyle = "#222622";
  context.font = '900 62px "Microsoft YaHei", sans-serif';
  context.fillText("徽章故事", 72, 174);
  roundRect(context, 72, 232, 1052, 260, 28);
  context.fillStyle = "#d6a755";
  context.fill();
  context.fillStyle = "rgba(255,255,255,0.28)";
  for (let index = 0; index < 8; index += 1) {
    context.fillRect(108 + index * 120, 278 + (index % 2) * 70, 66, 66);
  }
  context.fillStyle = "#f8f5ef";
  context.font = '800 32px "Microsoft YaHei", sans-serif';
  context.fillText("内容整理中", 118, 426);
  context.fillStyle = "#343934";
  context.font = '500 26px "Microsoft YaHei", sans-serif';
  wrapText(context, "这里以后会放徽章的时间、来源和故事。", 76, 552, 850, 42);
  drawScreenButton(context, "返回首页", 932, 548, 192);
};

const drawContentList = (
  context: CanvasRenderingContext2D,
  height: number,
  sectionId: ContentSectionId,
  requestedPage: number,
  itemsForSection: MainScreenOptions["itemsForSection"],
) => {
  const section =
    DESKTOP_SECTIONS.find((candidate) => candidate.id === sectionId) ??
    DESKTOP_SECTIONS[0];
  const page = getContentPage(itemsForSection(sectionId), requestedPage, 4);

  context.fillStyle = section.color;
  context.fillRect(0, 0, 22, height);
  context.fillStyle = "#5f655f";
  context.font = '700 22px "Microsoft YaHei", sans-serif';
  context.fillText(`${section.eyebrow} / ${page.items.length ? "LATEST" : "EMPTY"}`, 72, 72);
  context.fillStyle = "#222622";
  context.font = '900 54px "Microsoft YaHei", sans-serif';
  context.fillText(section.title, 72, 140);
  context.fillStyle = "#707771";
  context.font = '500 21px "Microsoft YaHei", sans-serif';
  context.fillText(section.subtitle, 72, 178);

  if (!page.items.length) {
    roundRect(context, 72, 224, 1050, 284, 24);
    context.fillStyle = "rgba(255,255,255,0.65)";
    context.fill();
    context.strokeStyle = "rgba(40,44,41,0.12)";
    context.stroke();
    context.fillStyle = "#343934";
    context.font = '800 31px "Microsoft YaHei", sans-serif';
    context.fillText("这里还没有公开内容", 112, 330);
    context.fillStyle = "#6b726d";
    context.font = '500 24px "Microsoft YaHei", sans-serif';
    context.fillText("内容确认后会按时间出现在这里。", 112, 382);
  } else {
    page.items.forEach((item, index) => {
      const y = 205 + index * 96;
      roundRect(context, 72, y, 1050, 78, 16);
      context.fillStyle = "rgba(255,255,255,0.72)";
      context.fill();
      context.strokeStyle = "rgba(40,44,41,0.12)";
      context.stroke();
      context.fillStyle = section.color;
      roundRect(context, 92, y + 13, 122, 52, 12);
      context.fill();
      context.fillStyle = "#fffdf8";
      context.font = '800 18px "Microsoft YaHei", sans-serif';
      context.fillText(item.date.slice(5).replace("-", "."), 118, y + 46);
      context.fillStyle = "#252925";
      context.font = '800 24px "Microsoft YaHei", sans-serif';
      context.fillText(truncateToWidth(context, item.title, 520), 246, y + 34);
      context.fillStyle = "#6d746e";
      context.font = '500 17px "Microsoft YaHei", sans-serif';
      context.fillText(truncateToWidth(context, item.description, 730), 246, y + 61);
    });
  }

  drawScreenButton(context, "返回首页", 72, 582, 174);
  if (page.pageCount > 1) {
    drawScreenButton(context, "上一页", 768, 582, 132, page.page > 0);
    drawScreenButton(context, "下一页", 916, 582, 132, page.page < page.pageCount - 1);
    context.fillStyle = "#707771";
    context.font = '600 18px "Microsoft YaHei", sans-serif';
    context.fillText(`${page.page + 1} / ${page.pageCount}`, 1068, 619);
  }
};

const drawContentPreview = (
  context: CanvasRenderingContext2D,
  height: number,
  item: DesktopContentItem,
) => {
  const section =
    DESKTOP_SECTIONS.find((candidate) => candidate.id === item.section) ??
    DESKTOP_SECTIONS[0];
  context.fillStyle = section.color;
  context.fillRect(0, 0, 22, height);
  context.fillStyle = "#5f655f";
  context.font = '700 22px "Microsoft YaHei", sans-serif';
  context.fillText(`${section.eyebrow} / ${item.date}`, 72, 76);
  context.fillStyle = "#222622";
  context.font = '900 48px "Microsoft YaHei", sans-serif';
  wrapText(context, item.title, 72, 150, 1030, 55);
  context.fillStyle = "#6d746e";
  context.font = '600 20px "Microsoft YaHei", sans-serif';
  context.fillText(
    [item.category, item.location].filter(Boolean).join(" · ") || section.title,
    76,
    224,
  );
  roundRect(context, 72, 260, 1050, 250, 24);
  context.fillStyle = "rgba(255,255,255,0.72)";
  context.fill();
  context.strokeStyle = "rgba(40,44,41,0.12)";
  context.stroke();
  context.fillStyle = "#343934";
  context.font = '500 25px "Microsoft YaHei", sans-serif';
  wrapText(context, item.preview, 110, 320, 970, 42);
  drawScreenButton(context, "返回列表", 72, 582, 174);
  drawScreenButton(
    context,
    item.section === "activities"
      ? "查看完整活动"
      : item.section === "recent"
        ? "查看项目"
        : "阅读全文",
    884,
    582,
    238,
    Boolean(resolveContentUrl(item)),
  );
};

export const renderMainScreen = ({
  surface,
  state,
  avatarImage,
  contentById,
  itemsForSection,
}: MainScreenOptions) => {
  const { context, canvas, texture } = surface;
  const { width, height } = canvas;
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#f1eee8";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#d7e1dc";
  context.fillRect(0, 0, 14, height);
  context.fillStyle = "#202521";

  if (state.activeScreen === "home") {
    roundRect(context, 48, 52, 440, 576, 28);
    context.save();
    context.clip();
    context.fillStyle = "#d8d4cb";
    context.fillRect(48, 52, 440, 576);
    if (avatarImage.complete && avatarImage.naturalWidth > 0) {
      drawImageCover(context, avatarImage, 48, 52, 440, 576);
    }
    context.restore();

    context.font = '800 28px "Microsoft YaHei", sans-serif';
    context.fillStyle = "#5f8f78";
    context.fillText("ERYU / PERSONAL SYSTEM", 548, 84);
    context.font = '900 66px "Microsoft YaHei", sans-serif';
    context.fillStyle = "#202521";
    context.fillText("AI玩尔玉", 548, 165);
    context.font = '700 26px "Microsoft YaHei", sans-serif';
    context.fillStyle = "#4c514d";
    context.fillText("Eryu", 552, 212);
    context.font = '500 27px "Microsoft YaHei", sans-serif';
    context.fillStyle = "#333733";
    wrapText(
      context,
      "把 AI 接进真实工作流，做成能运行、能验证、也能继续交接的系统。",
      548,
      286,
      570,
      44,
    );

    roundRect(context, 548, 400, 580, 190, 22);
    context.fillStyle = "rgba(255,255,255,0.72)";
    context.fill();
    context.strokeStyle = "rgba(32,37,33,0.14)";
    context.lineWidth = 2;
    context.stroke();
    context.fillStyle = "#5f8f78";
    context.beginPath();
    context.arc(586, 444, 9, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#222622";
    context.font = '800 25px "Microsoft YaHei", sans-serif';
    context.fillText("当前状态", 610, 454);
    context.font = '500 22px "Microsoft YaHei", sans-serif';
    context.fillStyle = "#4d524d";
    context.fillText("整理个人 AI 操作系统", 584, 503);
    context.fillText("打磨可交接的项目流程", 584, 543);
  } else if (state.activeScreen === "badge") {
    drawBadgeScreen(context, height);
  } else if (state.contentView.kind === "list") {
    drawContentList(context, height, state.contentView.section, state.contentView.page, itemsForSection);
  } else if (state.contentView.kind === "preview") {
    const selectedItem = contentById.get(state.contentView.itemId);
    if (selectedItem) {
      drawContentPreview(context, height, selectedItem);
    } else {
      drawContentList(context, height, state.contentView.section, 0, itemsForSection);
    }
  }

  const cursorX = state.screenCursor.x * width;
  const cursorY = state.screenCursor.y * height;
  context.save();
  context.translate(cursorX, cursorY);
  context.fillStyle = "#202521";
  context.strokeStyle = "#fffdf8";
  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(0, 0);
  context.lineTo(0, 34);
  context.lineTo(9, 26);
  context.lineTo(18, 45);
  context.lineTo(28, 40);
  context.lineTo(19, 22);
  context.lineTo(31, 21);
  context.closePath();
  context.stroke();
  context.fill();
  context.restore();
  texture.needsUpdate = true;
};
