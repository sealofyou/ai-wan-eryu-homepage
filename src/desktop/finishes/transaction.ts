import * as THREE from "three";

interface Disposable { dispose: () => void }

/** Rolls back this finish's material edits and newly attached details on error. */
export const withVisualTransaction = <T>(
  root: THREE.Object3D,
  apply: (own: <R extends Disposable>(resource: R) => R) => T,
): T => {
  const nodes = new Set<THREE.Object3D>();
  const originalMaterials = new Set<THREE.Material>();
  const snapshots = new Map<THREE.MeshStandardMaterial, THREE.MeshStandardMaterial>();
  const meshState = new Map<THREE.Mesh, { receiveShadow: boolean; uv: THREE.BufferAttribute | THREE.InterleavedBufferAttribute }>();
  const created = new Set<Disposable>();
  root.traverse((object) => {
    nodes.add(object);
    if (!(object instanceof THREE.Mesh)) return;
    meshState.set(object, { receiveShadow: object.receiveShadow, uv: object.geometry.getAttribute("uv") });
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      originalMaterials.add(material);
      if (material instanceof THREE.MeshStandardMaterial && !snapshots.has(material)) {
        snapshots.set(material, material.clone());
      }
    }
  });
  try {
    return apply((resource) => { created.add(resource); return resource; });
  } catch (error) {
    const additions: THREE.Object3D[] = [];
    root.traverse((object) => { if (!nodes.has(object)) additions.push(object); });
    for (const object of additions) {
      if (object instanceof THREE.Mesh) {
        created.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          if (!originalMaterials.has(material)) created.add(material);
        }
      }
      object.removeFromParent();
    }
    snapshots.forEach((snapshot, material) => { material.copy(snapshot); material.needsUpdate = true; });
    meshState.forEach((snapshot, mesh) => {
      mesh.receiveShadow = snapshot.receiveShadow;
      if (snapshot.uv) mesh.geometry.setAttribute("uv", snapshot.uv);
    });
    created.forEach((resource) => resource.dispose());
    throw error;
  } finally {
    snapshots.forEach((snapshot) => snapshot.dispose());
  }
};
