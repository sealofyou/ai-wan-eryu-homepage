export const DESK_LAYOUT = {
  room: {
    wall: {
      size: { width: 18, height: 10, depth: 0.35 },
      radius: 0.12,
      position: { x: 0, y: 4.1, z: -3.3 },
    },
  },
  desk: {
    surface: {
      size: { width: 16, height: 0.72, depth: 7.5 },
      radius: 0.2,
      position: { x: 0, y: -0.18, z: 0.85 },
    },
    apron: {
      size: { width: 16.15, height: 2.7, depth: 0.48 },
      radius: 0.18,
      position: { x: 0, y: -1.82, z: 4.38 },
    },
    mat: {
      canvas: { width: 1400, height: 460 },
      base: {
        size: { width: 11.2, height: 0.12, depth: 3.75 },
        radius: 0.18,
        position: { x: 0.15, y: 0.22, z: 2.22 },
      },
      surface: {
        size: { width: 10.95, height: 3.52 },
        position: { x: 0.15, y: 0.291, z: 2.22 },
        rotationX: -Math.PI / 2,
      },
    },
  },
  computer: {
    tower: {
      size: { width: 2.05, height: 4, depth: 2.1 },
      radius: 0.2,
      position: { x: -6.45, y: 2.1, z: 0.15 },
    },
    inset: {
      size: { width: 1.55, height: 2.55, depth: 0.09 },
      radius: 0.1,
      position: { x: -6.45, y: 2.35, z: 1.225 },
    },
    glow: {
      size: { width: 0.06, height: 2.3, depth: 0.04 },
      radius: 0.02,
      position: { x: -7.17, y: 1.72, z: 1.285 },
    },
    mark: {
      position: { x: -6.45, y: 0.92, z: 1.3 },
      stem: { size: { width: 0.13, height: 0.62, depth: 0.04 }, radius: 0.02, x: -0.18 },
      bars: [
        { size: { width: 0.48, height: 0.1, depth: 0.04 }, radius: 0.02, position: { x: 0.03, y: -0.24, z: 0 } },
        { size: { width: 0.38, height: 0.1, depth: 0.04 }, radius: 0.02, position: { x: 0.03, y: 0, z: 0 } },
        { size: { width: 0.48, height: 0.1, depth: 0.04 }, radius: 0.02, position: { x: 0.03, y: 0.24, z: 0 } },
      ],
    },
  },
  mainMonitor: {
    canvas: { width: 1200, height: 680 },
    frame: {
      size: { width: 7.35, height: 4.45, depth: 0.35 },
      radius: 0.15,
      position: { x: 0.7, y: 4.05, z: -0.92 },
    },
    screen: {
      size: { width: 6.98, height: 3.98 },
      position: { x: 0.7, y: 4.05, z: -0.724 },
    },
    actionZ: -0.7,
    stand: {
      size: { width: 0.72, height: 1.05, depth: 0.35 },
      radius: 0.08,
      position: { x: 0.7, y: 1.47, z: -0.75 },
    },
    foot: {
      size: { width: 2.8, height: 0.18, depth: 0.9 },
      radius: 0.08,
      position: { x: 0.7, y: 0.92, z: -0.42 },
    },
    soundbar: {
      size: { width: 4.2, height: 0.58, depth: 0.75 },
      radius: 0.18,
      position: { x: 0.7, y: 1.08, z: 0.1 },
      label: {
        size: { width: 1.05, height: 0.3 },
        position: { x: 0.7, y: 1.08, z: 0.49 },
      },
    },
  },
  leftMonitor: {
    yaw: 0.5,
    center: { x: -4.25, y: 3.68, z: -0.55 },
    frame: { size: { width: 2.72, height: 5.2, depth: 0.34 }, radius: 0.14 },
    screen: { size: { width: 2.44, height: 4.85 }, z: 0.19 },
    hit: { size: { width: 2.2, height: 1.02 }, startY: 0.8, stepY: 1.1, z: 0.22 },
    support: {
      baseY: 0.26,
      topY: 1.34,
      height: 1.16,
      postWidth: 0.56,
      postDepth: 0.42,
      postRadius: 0.08,
      hingeWidth: 0.9,
      hingeHeight: 0.2,
      hingeDepth: 0.5,
      hingeRadius: 0.06,
      footWidth: 1.7,
      footHeight: 0.18,
      footDepth: 0.82,
      footRadius: 0.08,
      footY: 0.09,
      footZ: 0.08,
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
