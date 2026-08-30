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
  charcoal: new THREE.MeshStandardMaterial({ color: "#2d2f2c", roughness: 0.84, metalness: 0.06 }),
  charcoalSoft: new THREE.MeshStandardMaterial({ color: "#40413c", roughness: 0.9, metalness: 0.02 }),
  warmWhite: new THREE.MeshStandardMaterial({ color: "#f1e9dc", roughness: 0.94 }),
  paleGreen: new THREE.MeshStandardMaterial({ color: "#8ea391", roughness: 0.88 }),
  wood: new THREE.MeshStandardMaterial({ color: "#825f4d", roughness: 0.84 }),
});

export const roundedMesh = (
  width: number,
  height: number,
  depth: number,
  radius: number,
  material: THREE.Material,
) => new THREE.Mesh(new RoundedBoxGeometry(width, height, depth, 5, radius), material);

export const mapRange = (
  value: number,
  start: number,
  end: number,
  nextStart: number,
  nextEnd: number,
) => nextStart + ((value - start) / (end - start)) * (nextEnd - nextStart);

export const makeTextMaterial = (
  text: string,
  foreground = "#ece6da",
  background = "#40413c",
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
