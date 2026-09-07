export const resolveMonitorVariant = (search: string): "baseline" | "study" =>
  new URLSearchParams(search).get("monitors") === "study" ? "study" : "baseline";
