export const DESK_LAYOUT = {
  leftMonitor: {
    yaw: 0.2,
    roll: 0.2,
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
    small: { width: 2.35, height: 4.6, x: 6.45, y: 3.35, z: -1.98 },
    large: {
      width: 3,
      height: 5.5,
      x: 10.2,
      y: 2.95,
      z: -1.7,
      roll: -0.2,
    },
  },
} as const;
