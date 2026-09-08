import { resolveDesktopFinish } from "./finish-mode";
import { resolveMonitorVariant } from "./monitor-variant";
import { resolveDesktopMouseVariant } from "./model-assets";

export const resolveDesktopPreview = (search: string) => {
  const parameters = new URLSearchParams(search);
  const full = parameters.get("desktop") === "refined";
  const monitors = full ? "study" : resolveMonitorVariant(search);
  return {
    full,
    mouse: full ? "study" as const : resolveDesktopMouseVariant(search),
    monitors,
    keyboard: full || parameters.get("keyboard") === "study" ? "study" as const : "baseline" as const,
    matControls: !full && monitors !== "study",
    studio: !full && resolveDesktopFinish(search) === "studio",
  };
};
