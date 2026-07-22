export const DESK_LAYOUT = {
  leftMonitor: {
    yaw: 0.5,
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
    // The second board follows the room's right-hand depth plane instead of facing front.
    large: {
      width: 5.8,
      height: 7.4,
      x: 8.6,
      y: 4,
      z: 0.1,
      yaw: -Math.PI / 2,
    },
  },
} as const;
