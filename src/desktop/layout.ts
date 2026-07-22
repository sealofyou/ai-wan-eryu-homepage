export const DESK_LAYOUT = {
  leftMonitor: {
    yaw: 0.2,
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
    large: { width: 5.2, height: 8.4, x: 8.05, y: 4.25, z: -2.38 },
  },
} as const;
