export type DesktopFinish = "baseline" | "studio";

export const resolveDesktopFinish = (search: string): DesktopFinish =>
  new URLSearchParams(search).get("finish") === "studio" ? "studio" : "baseline";
