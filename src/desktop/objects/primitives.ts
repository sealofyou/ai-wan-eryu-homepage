import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { makeCanvas } from "../screens/canvas-utils";

export interface DesktopMaterials {
  charcoal: THREE.MeshStandardMaterial;
  charcoalSoft: THREE.MeshStandardMaterial;
  warmWhite: THREE.MeshStandardMaterial;
  paleGreen: THREE.MeshStandardMaterial;
  wood: THREE.MeshStandardMaterial;
}

export const createDesktopMaterials = (): DesktopMaterials => ({
  charcoal: new THREE.MeshStandardMaterial({ color: "#242624", roughness: 0.64, metalness: 0.32 }),
  charcoalSoft: new THREE.MeshStandardMaterial({ color: "#353633", roughness: 0.72, metalness: 0.18 }),
  warmWhite: new THREE.MeshStandardMaterial({ color: "#e9e3d7", roughness: 0.83 }),
  paleGreen: new THREE.MeshStandardMaterial({ color: "#91aa98", roughness: 0.72 }),
  wood: new THREE.MeshStandardMaterial({ color: "#805536", roughness: 0.58 }),
});

export const roundedMesh = (
  width: number,
  height: number,
  depth: number,
  radius: number,
  material: THREE.Material,
) => new THREE.Mesh(new RoundedBoxGeometry(width, height, depth, 5, radius), material);

export const makeTextMaterial = (
  text: string,
  foreground = "#ece6da",
  background = "#2a2a27",
) => {
  const { context, texture } = makeCanvas(512, 160);
  context.fillStyle = background;
  context.fillRect(0, 0, 512, 160);
  context.fillStyle = foreground;
  context.font = '700 54px "Microsoft YaHei", sans-serif';
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, 256, 82);
  texture.needsUpdate = true;
  return new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
};
