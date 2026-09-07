import * as THREE from "three";
import { createMonitorStudyVisual } from "./monitor-study-model";
import { makeCanvas } from "../screens/canvas-utils";
import { DESK_LAYOUT } from "../layout";
import { disposeObjectGraph } from "../core/renderer";

const addBrand = (root: THREE.Group, portrait: boolean) => {
  const brand = makeCanvas(256, 80);
  brand.context.clearRect(0, 0, 256, 80);
  brand.context.font = '500 64px "Segoe UI", sans-serif';
  brand.context.textAlign = "center";
  brand.context.textBaseline = "middle";
  brand.context.fillStyle = "#a1a7a7";
  brand.context.fillText("Eryu", 128, 40);
  brand.texture.needsUpdate = true;
  const label = new THREE.Mesh(new THREE.PlaneGeometry(portrait ? 0.5 : 0.68, 0.18), new THREE.MeshBasicMaterial({ map: brand.texture, transparent: true, depthWrite: false, toneMapped: false }));
  label.name = "eryu-monitor-mark";
  label.position.set(0, -(portrait ? DESK_LAYOUT.leftMonitor.screen.size.height : DESK_LAYOUT.mainMonitor.screen.size.height) / 2 - 0.12, 0.051);
  root.add(label);
};

export const createMonitorVisualSet = () => {
  const created: THREE.Group[] = [];
  try {
    const main = createMonitorStudyVisual();
    created.push(main);
    addBrand(main, false);
    const portrait = createMonitorStudyVisual("portrait");
    created.push(portrait);
    addBrand(portrait, true);
    return { main, portrait };
  } catch (error) {
    created.forEach(disposeObjectGraph);
    throw error;
  }
};
