import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import {
  applyEnvironmentFinish,
  type EnvironmentFinishRefs,
} from "../src/desktop/studies/environment-finish";

const mesh = (
  geometry: THREE.BufferGeometry = new THREE.BoxGeometry(1, 1, 1),
  material: THREE.Material = new THREE.MeshStandardMaterial(),
) =>
  new THREE.Mesh(geometry, material);

const makeRefs = (): EnvironmentFinishRefs => {
  const matMap = new THREE.Texture();
  const matSurface = mesh(
    new THREE.PlaneGeometry(2, 1),
    new THREE.MeshStandardMaterial({ map: matMap, roughness: 0.92 }),
  );
  matSurface.position.set(1, 2, 3);
  matSurface.rotation.set(-Math.PI / 2, 0.1, 0.2);
  matSurface.scale.set(1.1, 1.2, 1.3);
  matSurface.userData.action = "mat";

  const messageMap = new THREE.Texture();
  const toyMap = new THREE.Texture();
  const quoteMap = new THREE.Texture();

  return {
    deskBody: mesh(undefined, new THREE.MeshStandardMaterial({ color: "#825f4d" })),
    deskApron: mesh(undefined, new THREE.MeshStandardMaterial({ color: "#825f4d" })),
    matBase: mesh(undefined, new THREE.MeshStandardMaterial({ color: "#efe7db" })),
    matSurface,
    wall: mesh(undefined, new THREE.MeshStandardMaterial({ color: "#decfbc" })),
    pegboard: mesh(undefined, new THREE.MeshStandardMaterial({ color: "#343632" })),
    pegHoles: Array.from({ length: 12 }, () => mesh(new THREE.CircleGeometry(0.03, 10), new THREE.MeshBasicMaterial())),
    messagePaper: mesh(new THREE.PlaneGeometry(1, 0.7), new THREE.MeshBasicMaterial({ map: messageMap })),
    badges: [
      mesh(new THREE.BoxGeometry(0.4, 0.4, 0.04), new THREE.MeshStandardMaterial({ color: "#8ea391" })),
      mesh(new THREE.BoxGeometry(0.4, 0.4, 0.04), new THREE.MeshStandardMaterial({ color: "#b39a8f" })),
    ],
    quotePaper: mesh(new THREE.PlaneGeometry(0.9, 0.7), new THREE.MeshBasicMaterial({ map: quoteMap })),
    toyBase: mesh(undefined, new THREE.MeshStandardMaterial({ color: "#40413c" })),
    toyBacking: mesh(undefined, new THREE.MeshStandardMaterial({ color: "#f1e9dc" })),
    toySurface: mesh(new THREE.PlaneGeometry(0.8, 1), new THREE.MeshBasicMaterial({ map: toyMap })),
  };
};

const textureMaps = (material: THREE.Material) => {
  const candidate = material as THREE.MeshStandardMaterial;
  return [candidate.map, candidate.normalMap, candidate.bumpMap, candidate.roughnessMap].filter(Boolean) as THREE.Texture[];
};

const collectTextures = (group: THREE.Object3D) => {
  const textures = new Set<THREE.Texture>();
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => textureMaps(material).forEach((texture) => textures.add(texture)));
  });
  return [...textures];
};

const countTriangles = (object: THREE.Object3D) => {
  let triangles = 0;
  object.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    const position = node.geometry.getAttribute("position");
    if (!position) return;
    const multiplier = node instanceof THREE.InstancedMesh ? node.count : 1;
    triangles += (node.geometry.index ? node.geometry.index.count / 3 : position.count / 3) * multiplier;
  });
  return Math.round(triangles);
};

const worldSize = (mesh: THREE.Mesh) =>
  new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3());

const expectSameSize = (actual: THREE.Vector3, expected: THREE.Vector3) => {
  expect(actual.x).toBeCloseTo(expected.x, 5);
  expect(actual.y).toBeCloseTo(expected.y, 5);
  expect(actual.z).toBeCloseTo(expected.z, 5);
};

describe("environment finish helper", () => {
  it("preserves mat hit transform, uv and borrowed canvas map while adding a cloned finish material", () => {
    const refs = makeRefs();
    const originalMaterial = refs.matSurface.material;
    const originalMap = (originalMaterial as THREE.MeshStandardMaterial).map!;
    const originalUv = refs.matSurface.geometry.getAttribute("uv");
    const transform = {
      position: refs.matSurface.position.clone(),
      rotation: refs.matSurface.rotation.clone(),
      scale: refs.matSurface.scale.clone(),
    };
    const borrowedDispose = vi.spyOn(originalMap, "dispose");

    const result = applyEnvironmentFinish(refs);

    expect(refs.matSurface.material).not.toBe(originalMaterial);
    expect((refs.matSurface.material as THREE.MeshStandardMaterial).map).toBe(originalMap);
    expect(refs.matSurface.geometry.getAttribute("uv")).toBe(originalUv);
    expect(refs.matSurface.position.equals(transform.position)).toBe(true);
    expect(refs.matSurface.rotation.equals(transform.rotation)).toBe(true);
    expect(refs.matSurface.scale.equals(transform.scale)).toBe(true);
    expect(refs.matSurface.receiveShadow).toBe(true);
    expect(result.group.children.length).toBeGreaterThan(8);
    expect(result.stats.triangles).toBeGreaterThan(0);

    result.dispose();
    result.dispose();

    expect(refs.matSurface.material).toBe(originalMaterial);
    expect((originalMaterial as THREE.MeshStandardMaterial).map).toBe(originalMap);
    expect(refs.matSurface.geometry.getAttribute("uv")).toBe(originalUv);
    expect(borrowedDispose).not.toHaveBeenCalled();
  });

  it("restores borrowed refs on successful disposal and never disposes borrowed material, geometry or textures", () => {
    const refs = makeRefs();
    const borrowed = [
      refs.deskBody,
      refs.deskApron,
      refs.matBase,
      refs.wall,
      refs.pegboard,
      refs.messagePaper,
      refs.quotePaper,
      refs.toyBase,
      refs.toyBacking,
      refs.toySurface,
      ...refs.badges,
    ];
    const originalState = borrowed.map((item) => ({
      item,
      material: item.material,
      geometry: item.geometry,
      visible: item.visible,
      castShadow: item.castShadow,
      receiveShadow: item.receiveShadow,
      textureDisposes: textureMaps(item.material as THREE.Material).map((texture) => vi.spyOn(texture, "dispose")),
      materialDispose: vi.spyOn(item.material as THREE.Material, "dispose"),
      geometryDispose: vi.spyOn(item.geometry, "dispose"),
    }));

    const result = applyEnvironmentFinish(refs);
    result.dispose();

    originalState.forEach((state) => {
      expect(state.item.material).toBe(state.material);
      expect(state.item.geometry).toBe(state.geometry);
      expect(state.item.visible).toBe(state.visible);
      expect(state.item.castShadow).toBe(state.castShadow);
      expect(state.item.receiveShadow).toBe(state.receiveShadow);
      expect(state.materialDispose).not.toHaveBeenCalled();
      expect(state.geometryDispose).not.toHaveBeenCalled();
      state.textureDisposes.forEach((dispose) => expect(dispose).not.toHaveBeenCalled());
    });
  });

  it("rolls back and frees new resources if setup fails after allocating finish assets", () => {
    const refs = makeRefs();
    refs.pegHoles.push({ isMesh: false } as unknown as THREE.Mesh);
    const originalDeskMaterial = refs.deskBody.material;
    const originalMatMaterial = refs.matSurface.material;
    const ownedTextureDispose = vi.spyOn(THREE.DataTexture.prototype, "dispose");
    const ownedMaterialDispose = vi.spyOn(THREE.Material.prototype, "dispose");
    const ownedGeometryDispose = vi.spyOn(THREE.BufferGeometry.prototype, "dispose");

    expect(() => applyEnvironmentFinish(refs)).toThrow("peg hole");

    expect(refs.deskBody.material).toBe(originalDeskMaterial);
    expect(refs.matSurface.material).toBe(originalMatMaterial);
    expect(ownedTextureDispose).toHaveBeenCalled();
    expect(ownedMaterialDispose).toHaveBeenCalled();
    expect(ownedGeometryDispose).toHaveBeenCalled();
  });

  it("uses legal tangent-space RGB normal maps instead of grayscale height data", () => {
    const refs = makeRefs();
    const result = applyEnvironmentFinish(refs);
    const normalMaps = [
      (refs.deskBody.material as THREE.MeshStandardMaterial).normalMap,
      (refs.matBase.material as THREE.MeshStandardMaterial).normalMap,
      (refs.matSurface.material as THREE.MeshStandardMaterial).normalMap,
    ];

    normalMaps.forEach((normalMap) => {
      expect(normalMap).toBeInstanceOf(THREE.DataTexture);
      const { data } = normalMap!.image as { data: Uint8Array };
      let xyHasSlope = false;
      for (let index = 0; index < data.length; index += 4 * 97) {
        const x = data[index];
        const y = data[index + 1];
        const z = data[index + 2];
        expect(z).toBeGreaterThanOrEqual(220);
        expect(z).toBeLessThanOrEqual(255);
        if (Math.abs(x - 128) > 1 || Math.abs(y - 128) > 1) xyHasSlope = true;
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(255);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(255);
      }
      expect(xyHasSlope).toBe(true);
    });

    result.dispose();
  });

  it("replaces visible shell geometry with owned tighter bevels while preserving world bounds and counting those triangles", () => {
    const refs = makeRefs();
    const shellRefs = [refs.deskBody, refs.deskApron, refs.pegboard, refs.toyBacking];
    const originals = shellRefs.map((item) => ({
      geometry: item.geometry,
      size: worldSize(item),
    }));

    const result = applyEnvironmentFinish(refs);

    shellRefs.forEach((item, index) => {
      expect(item.geometry).not.toBe(originals[index].geometry);
      expectSameSize(worldSize(item), originals[index].size);
    });
    expect(refs.matSurface.geometry).toBeTypeOf("object");
    expect(result.stats.triangles).toBeGreaterThan(countTriangles(result.group));
    expect(result.stats.triangles).toBeLessThanOrEqual(8000);

    result.dispose();

    shellRefs.forEach((item, index) => {
      expect(item.geometry).toBe(originals[index].geometry);
      expectSameSize(worldSize(item), originals[index].size);
    });
  });

  it("keeps peg hole rims behind the message paper even when their XY overlaps the paper", () => {
    const refs = makeRefs();
    refs.messagePaper.position.set(6.32, 4.48, -1.76);
    refs.pegHoles.forEach((hole, index) => {
      hole.position.set(6.12 + index * 0.03, 4.42, -1.77);
    });

    const result = applyEnvironmentFinish(refs);
    const rims = result.group.getObjectByName("environment-finish-peg-hole-rims") as THREE.InstancedMesh;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();

    for (let index = 0; index < rims.count; index += 1) {
      rims.getMatrixAt(index, matrix);
      position.setFromMatrixPosition(matrix);
      const overlapsMessagePaper =
        Math.abs(position.x - refs.messagePaper.position.x) <= 1.15 / 2 &&
        Math.abs(position.y - refs.messagePaper.position.y) <= 0.78 / 2;
      if (overlapsMessagePaper) {
        expect(position.z).toBeLessThan(refs.messagePaper.position.z);
        expect(position.z).toBeLessThanOrEqual(refs.pegHoles[index].position.z + 0.003);
      }
    }

    result.dispose();
  });

  it("uses transparent clearcoat acrylic without transmission render passes", () => {
    const refs = makeRefs();
    const result = applyEnvironmentFinish(refs);
    const physicalMaterials: THREE.MeshPhysicalMaterial[] = [];
    result.group.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      materials.forEach((material) => {
        if (material instanceof THREE.MeshPhysicalMaterial) physicalMaterials.push(material);
      });
    });

    expect(physicalMaterials.length).toBeGreaterThan(0);
    physicalMaterials.forEach((material) => {
      expect(material.transparent).toBe(true);
      expect(material.transmission).toBe(0);
      expect(material.clearcoat).toBeGreaterThan(0);
    });

    result.dispose();
  });

  it("keeps generated texture and geometry budgets bounded", () => {
    const refs = makeRefs();
    const result = applyEnvironmentFinish(refs);
    const textures = collectTextures(result.group).filter((texture) => texture instanceof THREE.DataTexture);

    textures.forEach((texture) => {
      const image = texture.image as { width: number; height: number };
      expect(image.width).toBeLessThanOrEqual(1024);
      expect(image.height).toBeLessThanOrEqual(1024);
    });
    expect(result.stats.textureBytes).toBeLessThanOrEqual(8 * 1024 * 1024);
    expect(result.stats.triangles).toBeLessThanOrEqual(8000);

    result.dispose();
  });
});
