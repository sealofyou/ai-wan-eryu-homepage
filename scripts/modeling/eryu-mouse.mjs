import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

// Measured visual proportions from the supplied top, rear-left and low-left views.
// Millimetre-like authoring coordinates are normalized to the existing desk scale.
const profile = [
  [0, 21, 22, 12], [0.06, 25, 26, 16], [0.20, 28, 29, 23],
  [0.39, 29, 32, 33], [0.57, 29, 34.5, 38], [0.72, 31, 36, 37],
  [0.87, 30, 33, 31], [0.95, 19, 21, 21], [0.99, 8, 9, 10], [1, 1, 1, 4],
];
const smooth = (t) => THREE.MathUtils.smoothstep(t, 0, 1);
const interpolate = (t, column) => {
  let i = 0;
  while (i < profile.length - 2 && profile[i + 1][0] < t) i += 1;
  const b = profile[i][column], c = profile[i + 1][column];
  const dt = profile[i + 1][0] - profile[i][0];
  const slope = (c - b) / dt;
  const before = i > 0 ? (b - profile[i - 1][column]) / (profile[i][0] - profile[i - 1][0]) : slope;
  const after = i + 2 < profile.length ? (profile[i + 2][column] - c) / (profile[i + 2][0] - profile[i + 1][0]) : slope;
  const tangent = (a, b) => a * b > 0 ? 2 * a * b / (a + b) : 0;
  const m0 = tangent(before, slope), m1 = tangent(slope, after);
  const f = THREE.MathUtils.clamp((t - profile[i][0]) / dt, 0, 1);
  return (2*f*f*f-3*f*f+1)*b + (f*f*f-2*f*f+f)*dt*m0 + (-2*f*f*f+3*f*f)*c + (f*f*f-f*f)*dt*m1;
};
const widths = (t) => ({ left: interpolate(t, 1), right: interpolate(t, 2) });
const surface = (u, t, lift = 0) => {
  const w = widths(t);
  const center = (w.right - w.left) / 2;
  const half = (w.right + w.left) / 2;
  const edge = 5 + 3.5 * Math.sin(Math.PI * t);
  const exponent = THREE.MathUtils.lerp(0.22, 0.44, smooth((t - 0.42) / 0.36));
  return [center + half * u, edge + (interpolate(t, 3) - edge) * Math.pow(Math.max(0, 1 - u * u), exponent) + lift, -66 + 132 * t];
};
const worldPoint = ([x, y, z]) => [x / 100, y / 100 - 0.30, z / 100];

const gridSurface = (sample, across, along, thickness = 0, reverse = false) => {
  const vertices = [], indices = [];
  for (let v = 0; v <= along; v += 1) {
    for (let u = 0; u <= across; u += 1) vertices.push(...worldPoint(sample(u / across, v / along)));
  }
  for (let v = 0; v < along; v += 1) {
    for (let u = 0; u < across; u += 1) {
      const a = v * (across + 1) + u, b = a + 1, c = a + across + 1, d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  if (thickness > 0) {
    const perimeter = [];
    for (let u = 0; u <= across; u += 1) perimeter.push(u);
    for (let v = 1; v <= along; v += 1) perimeter.push(v * (across + 1) + across);
    for (let u = across - 1; u >= 0; u -= 1) perimeter.push(along * (across + 1) + u);
    for (let v = along - 1; v > 0; v -= 1) perimeter.push(v * (across + 1));
    const start = vertices.length / 3;
    for (const index of perimeter) {
      const x = vertices[index * 3], y = vertices[index * 3 + 1], z = vertices[index * 3 + 2];
      vertices.push(x, y, z, x, y - thickness / 100, z);
    }
    for (let i = 0; i < perimeter.length; i += 1) {
      const a = start + i * 2, b = start + ((i + 1) % perimeter.length) * 2;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  if (reverse) {
    for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
  }
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
};

const chassisGeometry = () => gridSurface((u, t) => {
  const angle = u * Math.PI * 2;
  const cosine = Math.cos(angle);
  const p = surface(Math.sin(angle), t, -7.0);
  if (cosine < 0) p[1] = Math.max(0.8, -2 + 3.5 * Math.sin(Math.PI * t)) * (1 + cosine);
  else {
    p[1] = Math.max(0.8, p[1]);
    const lateral = Math.sin(angle);
    if (t > 0.615 && lateral < tailSeam(t) - 0.023) {
      p[1] = Math.max(0.8, Math.min(p[1], rearLeftHeight(lateral, t) - 2));
    }
    // A real depression in the center, not a painted scroll-wheel slot.
    const sideBlend = smooth((Math.abs(p[0]) - 4.8) / 2.4);
    const lengthBlend = smooth((t - 0.07) / 0.035) * (1 - smooth((t - 0.24) / 0.04));
    p[1] = THREE.MathUtils.lerp(p[1], Math.min(p[1], 16), (1 - sideBlend) * lengthBlend);
  }
  return p;
}, 44, 46);

const tailSeam = (t) => -0.95 + 0.73 * smooth((t - 0.59) / 0.39);
const rearLeftHeight = (lateral, t) => {
  const u = THREE.MathUtils.clamp((lateral + 0.985) / (tailSeam(t) - 0.023 + 0.985), 0, 1);
  return THREE.MathUtils.lerp(surface(-0.985,t,0.5)[1],surface(tailSeam(t)-0.023,t,0.5)[1],u) + Math.sin(Math.PI*u)*0.6;
};

export const createMouseStudyModel = () => {
  const model = new THREE.Group();
  model.name = "eryu-reference-mouse-study";
  const shell = new THREE.MeshStandardMaterial({ name: "black-abs-shell", color: "#22252a", roughness: 0.42, metalness: 0.08 });
  const buttons = new THREE.MeshStandardMaterial({ name: "satin-button-panels", color: "#2d3035", roughness: 0.52, metalness: 0.06 });
  const rubber = new THREE.MeshStandardMaterial({ name: "soft-grip-and-chassis", color: "#111418", roughness: 0.85 });
  const polished = new THREE.MeshStandardMaterial({ name: "polished-divider", color: "#111318", roughness: 0.25, metalness: 0.16 });
  const metal = new THREE.MeshStandardMaterial({ name: "brushed-scroll-metal", color: "#adb3ba", roughness: 0.26, metalness: 0.90 });
  const ink = new THREE.MeshStandardMaterial({ name: "eryu-silkscreen", color: "#d2cbb9", roughness: 0.72 });

  const mesh = (name, geometry, material) => {
    const object = new THREE.Mesh(geometry, material);
    object.name = name;
    object.castShadow = true;
    object.receiveShadow = true;
    model.add(object);
    return object;
  };
  const box = (name, size, position, material, radius = 0.7, rotation = [0, 0, 0]) => {
    const geometry = new RoundedBoxGeometry(...size.map((v) => v / 100), 2, radius / 100);
    geometry.deleteAttribute("uv");
    const object = mesh(name, geometry, material);
    object.position.set(...worldPoint(position));
    object.rotation.set(...rotation);
    return object;
  };

  mesh("lower-chassis", chassisGeometry(), rubber);
  mesh("palm-shell", gridSurface((u, v) => {
    const front = 0.445 + 0.09 * Math.abs(u * 2 - 1);
    const t = THREE.MathUtils.lerp(front, 0.995, v);
    return surface(THREE.MathUtils.lerp(tailSeam(t), 0.955, u), t, 0.7);
  }, 26, 34, 1.15), shell);
  mesh("rear-left-shell", gridSurface((u, v) => {
    const t = THREE.MathUtils.lerp(0.615, 0.991, v);
    const p = surface(THREE.MathUtils.lerp(-0.985, tailSeam(t) - 0.023, u), t, 0.5);
    p[1] = rearLeftHeight(THREE.MathUtils.lerp(-0.985, tailSeam(t) - 0.023, u), t);
    return p;
  }, 12, 25, 1.05), buttons);

  for (const side of [-1, 1]) {
    mesh(side < 0 ? "left-main-button" : "right-main-button", gridSurface((u, v) => {
      const lateral = side < 0 ? THREE.MathUtils.lerp(-0.955, -0.215, u) : THREE.MathUtils.lerp(0.215, 0.955, u);
      const outer = side < 0 ? 1 - u : u;
      const start = 0.016 + 0.016 * outer;
      const end = 0.425 + 0.090 * outer;
      const t = THREE.MathUtils.lerp(start, end, v);
      const p = surface(lateral, t, 1.05);
      const innerY = surface(side * 0.215, t, 1.05)[1];
      const outerY = surface(side * 0.955, t, 1.05)[1];
      p[1] = THREE.MathUtils.lerp(innerY, outerY, outer) + Math.sin(Math.PI * u) * 0.7;
      p[1] -= 0.65 * (1-smooth(Math.min(u,1-u)/0.10)) + 0.55 * (1-smooth(v/0.07));
      return p;
    }, 16, 24, 2.4), buttons);
  }

  // Thin outer case walls support the separate upper panels without a second dome.
  for (const side of [-1, 1]) {
    mesh(`outer-case-wall-${side}`, gridSurface((u, v) => {
      const t = 0.015 + u * 0.98;
      const p = surface(side * THREE.MathUtils.lerp(0.995, 0.95, v), t);
      const top = side < 0 && t > 0.615 && -0.95 < tailSeam(t) - 0.023
        ? rearLeftHeight(-0.95, t) - 0.6
        : surface(side * 0.955, t)[1] - 0.6;
      p[1] = THREE.MathUtils.lerp(1.5, top, v);
      return p;
    }, 40, 8, 0, side < 0), rubber);
  }
  mesh("front-seam-liner", gridSurface((u, v) => {
    const lateral = -0.985 + u * 1.97;
    const t = 0.405 + 0.09 * Math.abs(lateral) + v * 0.075;
    return surface(lateral, t, -1.8);
  }, 28, 8), polished);
  mesh("tail-seam-liner", gridSurface((u, v) => {
    const t = 0.59 + v * 0.405;
    return surface(tailSeam(t) - 0.04 + u * 0.08, t, -1.8);
  }, 4, 28), polished);

  mesh("thumb-rest", gridSurface((u, v) => {
    const t = 0.245 + v * 0.64;
    const inner = -widths(t).left + 1.5;
    const outline = [[0,0],[0.12,3],[0.24,15],[0.40,19],[0.62,14],[0.82,8],[1,0]];
    let segment = 0;
    while (segment < outline.length - 2 && outline[segment + 1][0] < v) segment += 1;
    const [a,b] = [outline[segment],outline[segment + 1]];
    const flare = THREE.MathUtils.lerp(a[1],b[1],(v-a[0])/(b[0]-a[0]));
    return [inner - u * flare, 3.2 + Math.pow(1 - u, 2) * (8 + Math.sin(Math.PI * v) * 3), -66 + 132 * t];
  }, 12, 28, 1.8, true), rubber);
  mesh("left-grip", gridSurface((u, v) => {
    const t = 0.29 + u * 0.58;
    const baseX = -widths(t).left;
    const bottomX = baseX - 4.5 * Math.sin(Math.PI * u);
    const x = THREE.MathUtils.lerp(bottomX, baseX + 2.2, v) + Math.sin(Math.PI * v) * 2;
    const y = 6 + v * (14 + 8 * Math.sin(Math.PI * u));
    return [x, y, -66 + 132 * t];
  }, 26, 12, 0.8, true), rubber);

  // Narrow center rails frame the scroll well and the two independent controls.
  for (const side of [-1, 1]) {
    mesh(`center-rail-${side}`, gridSurface((u, v) => {
      const t = 0.035 + v * 0.405;
      const x = side * (5.6 + u * 1.35);
      const w = widths(t);
      const normalized = (x - (w.right - w.left) / 2) / ((w.left + w.right) / 2);
      return surface(normalized, t, 0.6);
    }, 3, 26, 0.9), polished);
  }
  box("wheel-well-front-rim", [12.5, 1.5, 4], [0.5, 17.8, -56], polished, 0.6);
  box("wheel-mode-button", [9, 2.4, 8], [0.5, 30.5, -24], polished, 0.8, [-0.2, 0, 0]);
  box("dpi-button", [8, 2.6, 10], [0.5, 33.5, -11], buttons, 0.8, [-0.12, 0, 0]);

  const wheel = new THREE.Group();
  wheel.name = "scroll-wheel";
  wheel.position.set(...worldPoint([0.5, 21.8, -43]));
  model.add(wheel);
  const wheelVertices = [], wheelIndices = [];
  const radial = 80;
  for (const x of [-4.2, 4.2]) {
    for (let i = 0; i < radial; i += 1) {
      const a = i / radial * Math.PI * 2;
      const radius = i % 4 === 0 || i % 4 === 3 ? 6.9 : 6.3;
      wheelVertices.push(x / 100, Math.cos(a) * radius / 100, Math.sin(a) * radius / 100);
    }
  }
  for (let i = 0; i < radial; i += 1) {
    const j = (i + 1) % radial;
    wheelIndices.push(i, j, radial + i, j, radial + j, radial + i);
  }
  const barrel = new THREE.BufferGeometry();
  barrel.setAttribute("position", new THREE.Float32BufferAttribute(wheelVertices, 3));
  barrel.setIndex(wheelIndices); barrel.computeVertexNormals();
  wheel.add(new THREE.Mesh(barrel, metal));
  for (const side of [-1, 1]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.0075, 6, 32), metal);
    rim.rotation.y = Math.PI / 2; rim.position.x = side * 0.040;
    wheel.add(rim);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.053, 0.053, 0.009, 24), polished);
    disc.rotation.z = Math.PI / 2; disc.position.x = side * 0.032;
    wheel.add(disc);
  }
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.10, 16), metal);
  axle.rotation.z = Math.PI / 2; wheel.add(axle);

  box("side-button-forward", [3.2, 3.1, 16], [-28.5, 23.3, -28], polished, 0.75, [-0.26, -0.10, -0.15]);
  box("side-button-back", [3.2, 3.1, 18], [-28.0, 27.0, -9], polished, 0.75, [-0.15, -0.09, -0.12]);
  box("thumb-trigger", [4.2, 9.5, 12], [-31.7, 17.0, -34], buttons, 1.0, [-0.18, -0.22, -0.18]);
  box("upper-left-control-1", [4.2, 2.4, 11], [-23.8, 22.1, -46], polished, 0.65, [-0.2, 0, -0.32]);
  box("upper-left-control-2", [4.2, 2.4, 10], [-26.0, 26.6, -33], polished, 0.65, [-0.25, 0, -0.25]);

  const cablePath = new THREE.CatmullRomCurve3([
    [0,7,-65],[0,7.5,-72],[0,8,-78],[0,8.5,-82],
  ].map((point) => new THREE.Vector3(...worldPoint(point))));
  mesh("short-cable-strain-relief", new THREE.TubeGeometry(cablePath, 12, 0.021, 10, false), rubber);

  // Project the Eryu E onto the curved palm surface rather than floating above it.
  const outline = [[-6,-7],[6,-7],[6,-4],[-2.6,-4],[-2.6,-1.6],[4.2,-1.6],[1.8,1.2],[-2.6,1.2],[-2.6,4],[6,4],[6,7],[-6,7]];
  const shape = new THREE.Shape(outline.map(([x,z]) => new THREE.Vector2(x,z)));
  const flatMark = new THREE.ShapeGeometry(shape);
  const flat = flatMark.getAttribute("position");
  const subdivided = [];
  const split = (a, b, c, depth = 0) => {
    if (depth >= 4 || Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a)) < 2) {
      subdivided.push(a.x,a.y,0,c.x,c.y,0,b.x,b.y,0);
      return;
    }
    const ab=a.clone().lerp(b,.5), bc=b.clone().lerp(c,.5), ca=c.clone().lerp(a,.5);
    split(a,ab,ca,depth+1);split(ab,b,bc,depth+1);split(ca,bc,c,depth+1);split(ab,bc,ca,depth+1);
  };
  for(let i=0;i<flatMark.index.count;i+=3){
    split(...[0,1,2].map((offset)=>new THREE.Vector2(flat.getX(flatMark.index.getX(i+offset)),flat.getY(flatMark.index.getX(i+offset)))));
  }
  flatMark.dispose();
  const markGeometry = new THREE.BufferGeometry();
  markGeometry.setAttribute("position", new THREE.Float32BufferAttribute(subdivided,3));
  const markPosition = markGeometry.getAttribute("position");
  for (let i = 0; i < markPosition.count; i += 1) {
    const x = markPosition.getX(i) + 1.5;
    const t = 0.635 + markPosition.getY(i) / 132;
    const w = widths(t);
    const u = (x - (w.right-w.left)/2) / ((w.right+w.left)/2);
    markPosition.setXYZ(i, ...worldPoint(surface(u, t, 1.05)));
  }
  markGeometry.computeVertexNormals();
  mesh("eryu-mark", markGeometry, ink);

  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.deleteAttribute("uv");
    const normals = object.geometry.getAttribute("normal");
    for (let i = 0; i < normals.count; i += 1) {
      const normal = new THREE.Vector3().fromBufferAttribute(normals, i);
      if (normal.lengthSq() < 0.01) normal.set(0, 1, 0);
      normal.normalize();
      normals.setXYZ(i, normal.x, normal.y, normal.z);
    }
    object.castShadow = true;
    object.receiveShadow = true;
  });
  return model;
};
