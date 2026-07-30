import type { ContentSectionId } from "../content";

export interface DesktopSection {
  id: ContentSectionId;
  eyebrow: string;
  title: string;
  subtitle: string;
  color: string;
}

export const DESKTOP_SECTIONS: DesktopSection[] = [
  {
    id: "articles",
    eyebrow: "ARTICLES",
    title: "文章",
    subtitle: "按时间阅读",
    color: "#d77c51",
  },
  {
    id: "activities",
    eyebrow: "ACTIVITIES",
    title: "分享与活动",
    subtitle: "现场与资料",
    color: "#7f9c8d",
  },
  {
    id: "recent",
    eyebrow: "NOW",
    title: "最近在做",
    subtitle: "项目与状态",
    color: "#8091aa",
  },
];
