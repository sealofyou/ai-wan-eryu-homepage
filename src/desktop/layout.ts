export const DESK_LAYOUT = {
  leftMonitor: {
    yaw: 0.15,
    center: { x: -4.25, y: 3.68, z: -0.55 },
    support: {
      baseY: 0.26,
      topY: 1.34,
      height: 1.16,
      footWidth: 1.7,
      footDepth: 0.82,
    },
  },
  pegboards: {
    small: { width: 2.35, height: 4.6 },
    large: { width: 3.25, height: 5.1, x: 8.05, y: 3.45, z: -2.18 },
  },
  matMessage: {
    x: 82,
    y: 78,
    width: 318,
    height: 292,
  },
} as const;
