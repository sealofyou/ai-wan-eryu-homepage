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
    small: { width: 2.35, height: 4.6, x: 6.45, y: 3.35, z: -1.98 },
    // The second board is a separate foreground prop resting on the desk's right edge.
    large: {
      width: 2.9,
      height: 5.4,
      x: 7.25,
      y: 2.95,
      z: 0.45,
      yaw: -0.52,
    },
  },
} as const;
