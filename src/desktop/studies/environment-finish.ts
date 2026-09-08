import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { DESK_LAYOUT } from "../layout";

export interface EnvironmentFinishRefs {
  deskBody: THREE.Mesh;
  deskApron: THREE.Mesh;
  matBase: THREE.Mesh;
  matSurface: THREE.Mesh;
  wall: THREE.Mesh;
  pegboard: THREE.Mesh;
  pegHoles: THREE.Mesh[];
  messagePaper: THREE.Mesh;
  badges: THREE.Mesh[];
  quotePaper: THREE.Mesh;
  toyBase: THREE.Mesh;
  toyBacking: THREE.Mesh;
  toySurface: THREE.Mesh;
}

interface FinishStats {
  triangles: number;
  textureBytes: number;
}

type MutableMaterial = THREE.Material & {
  map?: THREE.Texture | null;
  normalMap?: THREE.Texture | null;
  bumpMap?: THREE.Texture | null;
  roughnessMap?: THREE.Texture | null;
};

interface MeshSnapshot {
  mesh: THREE.Mesh;
  geometry: THREE.BufferGeometry;
  material: THREE.Material | THREE.Material[];
  visible: boolean;
  castShadow: boolean;
  receiveShadow: boolean;
}

const TEXTURE_SIZE = 256;
const BYTES_PER_PIXEL = 4;
const HOLE_RIM_Z_OFFSET = 0.002;

const textureFields = ["map", "normalMap", "bumpMap", "roughnessMap"] as const;

const noise = (x: number, y: number) => {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return value - Math.floor(value);
};

const smoothNoise = (x: number, y: number, periodX: number, periodY: number) => {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const dx = x - ix;
  const dy = y - iy;
  const sx = dx * dx * (3 - 2 * dx);
  const sy = dy * dy * (3 - 2 * dy);
  const periodicNoise = (px: number, py: number) => noise(
    THREE.MathUtils.euclideanModulo(px, periodX),
    THREE.MathUtils.euclideanModulo(py, periodY),
  );
  const a = THREE.MathUtils.lerp(periodicNoise(ix, iy), periodicNoise(ix + 1, iy), sx);
  const b = THREE.MathUtils.lerp(periodicNoise(ix, iy + 1), periodicNoise(ix + 1, iy + 1), sx);
  return THREE.MathUtils.lerp(a, b, sy);
};

const makeDataTexture = (
  size: number,
  sample: (x: number, y: number) => readonly number[],
  color = false,
) => {
  const bytes = new Uint8Array(size * size * BYTES_PER_PIXEL);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const pixel = sample(x, y);
      const offset = (y * size + x) * BYTES_PER_PIXEL;
      bytes[offset] = THREE.MathUtils.clamp(Math.round(pixel[0]), 0, 255);
      bytes[offset + 1] = THREE.MathUtils.clamp(Math.round(pixel[1] ?? pixel[0]), 0, 255);
      bytes[offset + 2] = THREE.MathUtils.clamp(Math.round(pixel[2] ?? pixel[0]), 0, 255);
      bytes[offset + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(bytes, size, size);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  if (color) texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
};

const woodValue = (x: number, y: number) => {
  const longGrain = (smoothNoise(x / TEXTURE_SIZE * 2, y / TEXTURE_SIZE * 64, 2, 64) - 0.5) * 12;
  const pore = (smoothNoise(x / TEXTURE_SIZE * 64, y / TEXTURE_SIZE * 128, 64, 128) - 0.5) * 3;
  return longGrain + pore;
};

const normalizeNormal = (dx: number, dy: number, strength: number) => {
  const normal = new THREE.Vector3(-dx * strength, -dy * strength, 1).normalize();
  return [
    128 + normal.x * 127,
    128 + normal.y * 127,
    128 + normal.z * 127,
  ];
};

const makeNormalTexture = (
  size: number,
  heightAt: (x: number, y: number) => number,
  strength: number,
) => makeDataTexture(size, (x, y) => {
  const left = heightAt(x - 1, y);
  const right = heightAt(x + 1, y);
  const down = heightAt(x, y - 1);
  const up = heightAt(x, y + 1);
  return normalizeNormal(right - left, up - down, strength);
});

const countGeometryTriangles = (geometry: THREE.BufferGeometry) => {
  const position = geometry.getAttribute("position");
  if (!position) return 0;
  return geometry.index ? geometry.index.count / 3 : position.count / 3;
};

const countGroupTriangles = (group: THREE.Object3D) => {
  let triangles = 0;
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const multiplier = object instanceof THREE.InstancedMesh ? object.count : 1;
    triangles += countGeometryTriangles(object.geometry) * multiplier;
  });
  return Math.round(triangles);
};

const countMeshesTriangles = (meshes: THREE.Mesh[]) =>
  meshes.reduce((total, mesh) => total + countGeometryTriangles(mesh.geometry), 0);

const materialList = (material: THREE.Material | THREE.Material[]) =>
  Array.isArray(material) ? material : [material];

const collectBorrowedTextures = (refs: EnvironmentFinishRefs) => {
  const textures = new Set<THREE.Texture>();
  const meshes = [
    refs.deskBody,
    refs.deskApron,
    refs.matBase,
    refs.matSurface,
    refs.wall,
    refs.pegboard,
    refs.messagePaper,
    refs.quotePaper,
    refs.toyBase,
    refs.toyBacking,
    refs.toySurface,
    ...refs.pegHoles,
    ...refs.badges,
  ];
  meshes.forEach((mesh) => {
    if (!(mesh instanceof THREE.Mesh)) return;
    materialList(mesh.material).forEach((material) => {
      textureFields.forEach((field) => {
        const texture = (material as MutableMaterial)[field];
        if (texture) textures.add(texture);
      });
    });
  });
  return textures;
};

const snapshotRefs = (refs: EnvironmentFinishRefs): MeshSnapshot[] => [
  refs.deskBody,
  refs.deskApron,
  refs.matBase,
  refs.matSurface,
  refs.wall,
  refs.pegboard,
  refs.messagePaper,
  refs.quotePaper,
  refs.toyBase,
  refs.toyBacking,
  refs.toySurface,
  ...refs.pegHoles.filter((mesh) => mesh instanceof THREE.Mesh),
  ...refs.badges,
].map((mesh) => ({
  mesh,
  geometry: mesh.geometry,
  material: mesh.material,
  visible: mesh.visible,
  castShadow: mesh.castShadow,
  receiveShadow: mesh.receiveShadow,
}));

const restoreSnapshots = (snapshots: MeshSnapshot[]) => {
  snapshots.forEach(({ mesh, geometry, material, visible, castShadow, receiveShadow }) => {
    mesh.geometry = geometry;
    mesh.material = material;
    mesh.visible = visible;
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
  });
};

const copyTransform = (target: THREE.Object3D, source: THREE.Object3D) => {
  target.position.copy(source.position);
  target.rotation.copy(source.rotation);
  target.scale.copy(source.scale);
};

const detachBorrowedTextures = (material: THREE.Material, borrowedTextures: Set<THREE.Texture>) => {
  const mutable = material as MutableMaterial;
  textureFields.forEach((field) => {
    if (mutable[field] && borrowedTextures.has(mutable[field])) {
      mutable[field] = null;
    }
  });
};

const disposeMaterial = (material: THREE.Material, borrowedTextures: Set<THREE.Texture>) => {
  detachBorrowedTextures(material, borrowedTextures);
  material.dispose();
};

const placeLikePaper = (mesh: THREE.Mesh, source: THREE.Mesh, zOffset: number) => {
  copyTransform(mesh, source);
  mesh.position.z += zOffset;
};

const makePaperBack = (
  source: THREE.Mesh,
  width: number,
  height: number,
  material: THREE.Material,
) => {
  const paper = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.025), material);
  placeLikePaper(paper, source, -0.018);
  paper.castShadow = true;
  paper.receiveShadow = true;
  return paper;
};

const makePaperShadow = (source: THREE.Mesh, width: number, height: number, opacity = 0.18) => {
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({
      color: "#1e1914",
      transparent: true,
      opacity,
      depthWrite: false,
    }),
  );
  placeLikePaper(shadow, source, -0.035);
  shadow.scale.multiplyScalar(1.04);
  return shadow;
};

const applyMaterial = (mesh: THREE.Mesh, material: THREE.Material) => {
  mesh.material = material;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
};

const geometrySize = (geometry: THREE.BufferGeometry) => {
  geometry.computeBoundingBox();
  return geometry.boundingBox!.getSize(new THREE.Vector3());
};

const replaceWithTighterBevel = (
  mesh: THREE.Mesh,
  ownGeometry: <T extends THREE.BufferGeometry>(geometry: T) => T,
) => {
  const size = geometrySize(mesh.geometry);
  const smallest = Math.min(size.x, size.y, size.z);
  const radius = Math.max(0.004, Math.min(smallest * 0.18, 0.055));
  mesh.geometry = ownGeometry(new RoundedBoxGeometry(size.x, size.y, size.z, 2, radius));
};

const tightRoundedMesh = (
  width: number,
  height: number,
  depth: number,
  radius: number,
  material: THREE.Material,
) => new THREE.Mesh(
  new RoundedBoxGeometry(width, height, depth, 2, radius),
  material,
);

export const applyEnvironmentFinish = (refs: EnvironmentFinishRefs): {
  group: THREE.Group;
  dispose: () => void;
  stats: FinishStats;
} => {
  const snapshots = snapshotRefs(refs);
  const borrowedTextures = collectBorrowedTextures(refs);
  const group = new THREE.Group();
  group.name = "environment-finish";
  const ownedTextures = new Set<THREE.Texture>();
  const ownedMaterials = new Set<THREE.Material>();
  const ownedGeometries = new Set<THREE.BufferGeometry>();
  let disposed = false;
  let textureBytes = 0;

  const ownTexture = <T extends THREE.Texture>(texture: T) => {
    ownedTextures.add(texture);
    const image = texture.image as { width?: number; height?: number } | undefined;
    textureBytes += (image?.width ?? TEXTURE_SIZE) * (image?.height ?? TEXTURE_SIZE) * BYTES_PER_PIXEL;
    return texture;
  };

  const ownMaterial = <T extends THREE.Material>(material: T) => {
    ownedMaterials.add(material);
    return material;
  };

  const ownGeometry = <T extends THREE.BufferGeometry>(geometry: T) => {
    ownedGeometries.add(geometry);
    return geometry;
  };

  const ownMesh = <T extends THREE.Mesh>(mesh: T) => {
    ownGeometry(mesh.geometry);
    materialList(mesh.material).forEach(ownMaterial);
    return mesh;
  };

  const add = <T extends THREE.Object3D>(object: T) => {
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        ownGeometry(child.geometry);
        materialList(child.material).forEach(ownMaterial);
      }
    });
    group.add(object);
    return object;
  };

  const disposeOwned = () => {
    if (group.parent) group.parent.remove(group);
    [...ownedMaterials].forEach((material) => disposeMaterial(material, borrowedTextures));
    [...ownedGeometries].forEach((geometry) => geometry.dispose());
    [...ownedTextures].forEach((texture) => {
      if (!borrowedTextures.has(texture)) texture.dispose();
    });
  };

  const finishDispose = () => {
    if (disposed) return;
    disposed = true;
    restoreSnapshots(snapshots);
    disposeOwned();
  };

  try {
    const woodMap = ownTexture(makeDataTexture(TEXTURE_SIZE, (x, y) => {
      const grain = woodValue(x, y);
      return [111 + grain, 80 + grain * 0.8, 60 + grain * 0.62];
    }, true));
    woodMap.repeat.set(2.8, 0.85);
    const woodNormal = ownTexture(makeNormalTexture(TEXTURE_SIZE, woodValue, 0.006));
    woodNormal.repeat.copy(woodMap.repeat);
    const weaveHeight = (x: number, y: number) => {
      const cross = Math.sin(x * Math.PI * 0.5) * 12 + Math.sin(y * Math.PI * 0.7) * 10;
      return cross + (noise(x, y) - 0.5) * 10;
    };
    const weaveNormal = ownTexture(makeNormalTexture(TEXTURE_SIZE, weaveHeight, 0.018));
    weaveNormal.repeat.set(16, 5);
    const metalRoughness = ownTexture(makeDataTexture(TEXTURE_SIZE, (x, y) => [
      190 + (noise(x * 0.8, y * 0.8) - 0.5) * 28,
    ]));
    metalRoughness.repeat.set(6, 10);

    const woodMaterial = ownMaterial(new THREE.MeshStandardMaterial({
      color: "#ffffff",
      map: woodMap,
      normalMap: woodNormal,
      normalScale: new THREE.Vector2(0.028, 0.018),
      roughness: 0.74,
      metalness: 0.01,
    }));
    const apronMaterial = woodMaterial.clone();
    ownMaterial(apronMaterial);
    replaceWithTighterBevel(refs.deskBody, ownGeometry);
    replaceWithTighterBevel(refs.deskApron, ownGeometry);
    applyMaterial(refs.deskBody, woodMaterial);
    applyMaterial(refs.deskApron, apronMaterial);

    const matBaseMaterial = ownMaterial(new THREE.MeshStandardMaterial({
      color: "#e7dfd3",
      roughness: 0.97,
      normalMap: weaveNormal,
      normalScale: new THREE.Vector2(0.01, 0.018),
    }));
    applyMaterial(refs.matBase, matBaseMaterial);

    const matSurfaceMaterial = (refs.matSurface.material as THREE.Material).clone() as THREE.MeshStandardMaterial;
    ownMaterial(matSurfaceMaterial);
    matSurfaceMaterial.normalMap = weaveNormal;
    matSurfaceMaterial.normalScale = new THREE.Vector2(0.008, 0.014);
    matSurfaceMaterial.roughness = 0.99;
    matSurfaceMaterial.needsUpdate = true;
    refs.matSurface.material = matSurfaceMaterial;
    refs.matSurface.receiveShadow = true;

    const wallMaterial = ownMaterial(new THREE.MeshStandardMaterial({
      color: "#d7cbbb",
      roughness: 0.98,
      roughnessMap: metalRoughness,
    }));
    refs.wall.material = wallMaterial;
    refs.wall.receiveShadow = true;

    const pegMaterial = ownMaterial(new THREE.MeshStandardMaterial({
      color: "#30332f",
      metalness: 0.16,
      roughness: 0.82,
      roughnessMap: metalRoughness,
    }));
    replaceWithTighterBevel(refs.pegboard, ownGeometry);
    applyMaterial(refs.pegboard, pegMaterial);

    const { desk, pegboards, decorations } = DESK_LAYOUT;
    const edgeMaterial = ownMaterial(new THREE.MeshStandardMaterial({
      color: "#5b2e1d",
      roughness: 0.58,
      map: woodMap,
      normalMap: woodNormal,
      normalScale: new THREE.Vector2(0.018, 0.012),
    }));
    add(new THREE.Mesh(
      ownGeometry(new THREE.BoxGeometry(desk.surface.size.width - 0.35, 0.055, 0.08)),
      edgeMaterial,
    )).position.set(desk.surface.position.x, desk.surface.position.y + 0.22, desk.surface.position.z + desk.surface.size.depth / 2 - 0.08);
    add(new THREE.Mesh(
      ownGeometry(new THREE.BoxGeometry(desk.surface.size.width - 0.55, 0.035, 0.052)),
      edgeMaterial,
    )).position.set(desk.surface.position.x, desk.surface.position.y - 0.28, desk.surface.position.z + desk.surface.size.depth / 2 + 0.015);

    const stitchMaterial = ownMaterial(new THREE.MeshStandardMaterial({
      color: "#c8bdae",
      roughness: 0.96,
      normalMap: weaveNormal,
      normalScale: new THREE.Vector2(0.01, 0.01),
    }));
    const mat = desk.mat;
    const stitchY = mat.surface.position.y + 0.006;
    const halfW = mat.surface.size.width / 2;
    const halfH = mat.surface.size.height / 2;
    [
      { size: [mat.surface.size.width - 0.38, 0.012, 0.022], pos: [mat.surface.position.x, stitchY, mat.surface.position.z - halfH + 0.14] },
      { size: [mat.surface.size.width - 0.38, 0.012, 0.022], pos: [mat.surface.position.x, stitchY, mat.surface.position.z + halfH - 0.14] },
      { size: [0.024, 0.012, mat.surface.size.height - 0.34], pos: [mat.surface.position.x - halfW + 0.15, stitchY, mat.surface.position.z] },
      { size: [0.024, 0.012, mat.surface.size.height - 0.34], pos: [mat.surface.position.x + halfW - 0.15, stitchY, mat.surface.position.z] },
    ].forEach(({ size, pos }) => {
      const stitch = new THREE.Mesh(
        ownGeometry(new THREE.BoxGeometry(size[0], size[1], size[2])),
        stitchMaterial,
      );
      stitch.position.set(pos[0], pos[1], pos[2]);
      stitch.receiveShadow = true;
      group.add(stitch);
    });

    const holeRingMaterial = ownMaterial(new THREE.MeshStandardMaterial({
      color: "#20231f",
      metalness: 0.22,
      roughness: 0.76,
    }));
    const holeGeometry = ownGeometry(new THREE.RingGeometry(
      pegboards.small.holes.radius * 1.08,
      pegboards.small.holes.radius * 1.48,
      8,
    ));
    refs.pegHoles.forEach((hole, index) => {
      if (!(hole instanceof THREE.Mesh)) throw new Error(`Invalid peg hole ref at index ${index}`);
    });
    const holeRings = new THREE.InstancedMesh(holeGeometry, holeRingMaterial, refs.pegHoles.length);
    holeRings.name = "environment-finish-peg-hole-rims";
    const matrix = new THREE.Matrix4();
    refs.pegHoles.forEach((hole, index) => {
      matrix.compose(
        new THREE.Vector3(hole.position.x, hole.position.y, hole.position.z + HOLE_RIM_Z_OFFSET),
        new THREE.Quaternion().setFromEuler(hole.rotation),
        hole.scale,
      );
      holeRings.setMatrixAt(index, matrix);
    });
    holeRings.receiveShadow = true;
    group.add(holeRings);

    const fastenerMaterial = ownMaterial(new THREE.MeshStandardMaterial({
      color: "#4b5148",
      metalness: 0.42,
      roughness: 0.54,
    }));
    for (const [x, y] of [[-0.86, 1.82], [0.86, 1.82], [-0.86, -1.82], [0.86, -1.82]]) {
      const fastener = new THREE.Mesh(
        ownGeometry(new THREE.CylinderGeometry(0.055, 0.055, 0.026, 18)),
        fastenerMaterial,
      );
      fastener.rotation.x = Math.PI / 2;
      fastener.position.set(pegboards.small.x + x, pegboards.small.y + y, pegboards.small.z + pegboards.small.depth / 2 + 0.016);
      fastener.castShadow = true;
      group.add(fastener);
    }

    const paperMaterial = ownMaterial(new THREE.MeshStandardMaterial({ color: "#eee4d5", roughness: 0.9 }));
    add(makePaperBack(refs.messagePaper, pegboards.small.message.size.width + 0.035, pegboards.small.message.size.height + 0.035, paperMaterial));
    add(makePaperBack(refs.quotePaper, decorations.note.size.width + 0.03, decorations.note.size.height + 0.03, paperMaterial));
    add(makePaperShadow(refs.messagePaper, pegboards.small.message.size.width, pegboards.small.message.size.height));
    add(makePaperShadow(refs.quotePaper, decorations.note.size.width, decorations.note.size.height, 0.13));

    const badgeRimMaterial = ownMaterial(new THREE.MeshStandardMaterial({
      color: "#d9ccb9",
      metalness: 0.08,
      roughness: 0.72,
    }));
    refs.badges.forEach((badge) => {
      const rim = tightRoundedMesh(
        pegboards.small.badges.size.width + 0.075,
        pegboards.small.badges.size.height + 0.075,
        0.035,
        pegboards.small.badges.radius + 0.03,
        badgeRimMaterial,
      );
      placeLikePaper(ownMesh(rim), badge, -0.038);
      rim.castShadow = true;
      group.add(rim);
    });

    const acrylicMaterial = ownMaterial(new THREE.MeshPhysicalMaterial({
      color: "#f4ecdf",
      roughness: 0.18,
      metalness: 0,
      transparent: true,
      opacity: 0.36,
      transmission: 0,
      clearcoat: 0.52,
      clearcoatRoughness: 0.28,
      reflectivity: 0.34,
      thickness: 0.035,
    }));
    replaceWithTighterBevel(refs.toyBacking, ownGeometry);
    const toyOutline = tightRoundedMesh(
      decorations.toy.backing.size.width + 0.08,
      decorations.toy.backing.size.height + 0.08,
      0.045,
      decorations.toy.backing.radius + 0.025,
      acrylicMaterial,
    );
    placeLikePaper(ownMesh(toyOutline), refs.toyBacking, -0.035);
    group.add(toyOutline);

    const baseLipMaterial = ownMaterial(new THREE.MeshStandardMaterial({
      color: "#2f302c",
      roughness: 0.62,
      metalness: 0.08,
    }));
    const baseLip = tightRoundedMesh(
      decorations.toy.base.size.width + 0.12,
      0.035,
      decorations.toy.base.size.depth + 0.08,
      0.06,
      baseLipMaterial,
    );
    copyTransform(ownMesh(baseLip), refs.toyBase);
    baseLip.position.y += decorations.toy.base.size.height / 2 + 0.02;
    baseLip.castShadow = true;
    group.add(baseLip);

    const stats = {
      triangles: countGroupTriangles(group) + countMeshesTriangles([
        refs.deskBody,
        refs.deskApron,
        refs.pegboard,
        refs.toyBacking,
      ]),
      textureBytes,
    };
    if (stats.triangles > 8000) throw new Error(`Environment finish triangle budget exceeded: ${stats.triangles}`);
    if (stats.textureBytes > 8 * 1024 * 1024) throw new Error(`Environment finish texture budget exceeded: ${stats.textureBytes}`);

    return { group, dispose: finishDispose, stats };
  } catch (error) {
    restoreSnapshots(snapshots);
    disposeOwned();
    throw error;
  }
};
