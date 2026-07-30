import * as THREE from "three";
import { addAction } from "../core/actions";
import type { SceneObjectResult } from "../core/types";
import {
  getContentPage,
  resolveContentUrl,
  type ContentSectionId,
  type DesktopContentItem,
} from "../content";
import { DESK_LAYOUT } from "../layout";
import type { DesktopState } from "../model";
import type { CanvasSurface } from "../screens/canvas-utils";
import { DESKTOP_SECTIONS } from "../screens/sections";
import { makeTextMaterial, roundedMesh, type DesktopMaterials } from "./primitives";

interface MonitorObjectOptions {
  mainCanvas: CanvasSurface;
  sideCanvas: CanvasSurface;
  materials: DesktopMaterials;
  contentById: ReadonlyMap<string, DesktopContentItem>;
  itemsForSection: (section: ContentSectionId) => DesktopContentItem[];
}

export interface MonitorObjectResult extends SceneObjectResult {
  mainScreen: THREE.Mesh;
  updateMainActions: (state: DesktopState) => void;
}

export const createMonitorsObject = ({
  mainCanvas,
  sideCanvas,
  materials,
  contentById,
  itemsForSection,
}: MonitorObjectOptions): MonitorObjectResult => {
  const group = new THREE.Group();
  const { mainMonitor, leftMonitor } = DESK_LAYOUT;

  const mainFrame = roundedMesh(
    mainMonitor.frame.size.width,
    mainMonitor.frame.size.height,
    mainMonitor.frame.size.depth,
    mainMonitor.frame.radius,
    materials.charcoal,
  );
  mainFrame.position.set(
    mainMonitor.frame.position.x,
    mainMonitor.frame.position.y,
    mainMonitor.frame.position.z,
  );
  mainFrame.castShadow = true;
  group.add(mainFrame);

  const mainScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(mainMonitor.screen.size.width, mainMonitor.screen.size.height),
    new THREE.MeshBasicMaterial({ map: mainCanvas.texture, toneMapped: false }),
  );
  mainScreen.position.set(
    mainMonitor.screen.position.x,
    mainMonitor.screen.position.y,
    mainMonitor.screen.position.z,
  );
  group.add(mainScreen);

  const mainActionGroup = new THREE.Group();
  group.add(mainActionGroup);

  const addMainActionHit = (
    action: Parameters<typeof addAction>[1],
    x: number,
    y: number,
    width: number,
    height: number,
  ) => {
    const hit = addAction(
      new THREE.Mesh(
        new THREE.PlaneGeometry(
          (width / mainMonitor.canvas.width) * mainMonitor.screen.size.width,
          (height / mainMonitor.canvas.height) * mainMonitor.screen.size.height,
        ),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }),
      ),
      action,
    );
    hit.position.set(
      mainMonitor.screen.position.x +
        ((x + width / 2) / mainMonitor.canvas.width - 0.5) * mainMonitor.screen.size.width,
      mainMonitor.screen.position.y +
        (0.5 - (y + height / 2) / mainMonitor.canvas.height) * mainMonitor.screen.size.height,
      mainMonitor.actionZ,
    );
    mainActionGroup.add(hit);
  };

  const updateMainActions = (state: DesktopState) => {
    mainActionGroup.children.forEach((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.geometry.dispose();
      const childMaterials = Array.isArray(child.material) ? child.material : [child.material];
      childMaterials.forEach((material) => material.dispose());
    });
    mainActionGroup.clear();

    if (state.activeScreen === "badge") {
      addMainActionHit("screen:home", 932, 548, 192, 64);
      return;
    }

    if (state.contentView.kind === "list") {
      const page = getContentPage(
        itemsForSection(state.contentView.section),
        state.contentView.page,
        4,
      );
      page.items.forEach((item, index) => {
        addMainActionHit(`content:${item.id}`, 72, 205 + index * 96, 1050, 78);
      });
      addMainActionHit("content-back", 72, 582, 174, 58);
      if (page.page > 0) addMainActionHit("page-prev", 768, 582, 132, 58);
      if (page.page < page.pageCount - 1) {
        addMainActionHit("page-next", 916, 582, 132, 58);
      }
      return;
    }

    if (state.contentView.kind === "preview") {
      addMainActionHit("content-back", 72, 582, 174, 58);
      const item = contentById.get(state.contentView.itemId);
      if (item && resolveContentUrl(item)) {
        addMainActionHit("content-open", 884, 582, 238, 58);
      }
    }
  };

  const stand = roundedMesh(
    mainMonitor.stand.size.width,
    mainMonitor.stand.size.height,
    mainMonitor.stand.size.depth,
    mainMonitor.stand.radius,
    materials.charcoal,
  );
  stand.position.set(
    mainMonitor.stand.position.x,
    mainMonitor.stand.position.y,
    mainMonitor.stand.position.z,
  );
  stand.castShadow = true;
  group.add(stand);

  const standFoot = roundedMesh(
    mainMonitor.foot.size.width,
    mainMonitor.foot.size.height,
    mainMonitor.foot.size.depth,
    mainMonitor.foot.radius,
    materials.charcoalSoft,
  );
  standFoot.position.set(
    mainMonitor.foot.position.x,
    mainMonitor.foot.position.y,
    mainMonitor.foot.position.z,
  );
  standFoot.castShadow = true;
  group.add(standFoot);

  const soundbar = roundedMesh(
    mainMonitor.soundbar.size.width,
    mainMonitor.soundbar.size.height,
    mainMonitor.soundbar.size.depth,
    mainMonitor.soundbar.radius,
    materials.charcoalSoft,
  );
  soundbar.position.set(
    mainMonitor.soundbar.position.x,
    mainMonitor.soundbar.position.y,
    mainMonitor.soundbar.position.z,
  );
  soundbar.castShadow = true;
  group.add(soundbar);
  const soundbarLabel = new THREE.Mesh(
    new THREE.PlaneGeometry(
      mainMonitor.soundbar.label.size.width,
      mainMonitor.soundbar.label.size.height,
    ),
    makeTextMaterial("Eryu", "#c8b391", "#353633"),
  );
  soundbarLabel.position.set(
    mainMonitor.soundbar.label.position.x,
    mainMonitor.soundbar.label.position.y,
    mainMonitor.soundbar.label.position.z,
  );
  group.add(soundbarLabel);

  const sideMonitor = new THREE.Group();
  sideMonitor.position.set(leftMonitor.center.x, leftMonitor.center.y, leftMonitor.center.z);
  sideMonitor.rotation.y = DESK_LAYOUT.leftMonitor.yaw;
  group.add(sideMonitor);

  const sideFrame = roundedMesh(
    leftMonitor.frame.size.width,
    leftMonitor.frame.size.height,
    leftMonitor.frame.size.depth,
    leftMonitor.frame.radius,
    materials.charcoal,
  );
  sideFrame.castShadow = true;
  sideMonitor.add(sideFrame);
  const sideScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(leftMonitor.screen.size.width, leftMonitor.screen.size.height),
    new THREE.MeshBasicMaterial({ map: sideCanvas.texture, toneMapped: false }),
  );
  sideScreen.position.z = leftMonitor.screen.z;
  sideMonitor.add(sideScreen);
  const sideActionHits: THREE.Object3D[] = [];
  DESKTOP_SECTIONS.forEach((section, index) => {
    const hit = addAction(
      new THREE.Mesh(
        new THREE.PlaneGeometry(leftMonitor.hit.size.width, leftMonitor.hit.size.height),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }),
      ),
      `section:${section.id}`,
    );
    hit.position.set(0, leftMonitor.hit.startY - index * leftMonitor.hit.stepY, leftMonitor.hit.z);
    sideMonitor.add(hit);
    sideActionHits.push(hit);
  });

  const sideSupport = new THREE.Group();
  sideSupport.position.set(
    leftMonitor.center.x,
    leftMonitor.support.baseY - 0.09,
    leftMonitor.center.z,
  );
  sideSupport.rotation.y = leftMonitor.yaw;
  const supportPost = roundedMesh(
    leftMonitor.support.postWidth,
    leftMonitor.support.height,
    leftMonitor.support.postDepth,
    leftMonitor.support.postRadius,
    materials.charcoal,
  );
  supportPost.position.set(0, leftMonitor.support.height / 2, 0);
  supportPost.castShadow = true;
  sideSupport.add(supportPost);
  const supportHinge = roundedMesh(
    leftMonitor.support.hingeWidth,
    leftMonitor.support.hingeHeight,
    leftMonitor.support.hingeDepth,
    leftMonitor.support.hingeRadius,
    materials.charcoalSoft,
  );
  supportHinge.position.set(0, leftMonitor.support.topY - leftMonitor.support.baseY, 0);
  supportHinge.castShadow = true;
  sideSupport.add(supportHinge);
  const supportFoot = roundedMesh(
    leftMonitor.support.footWidth,
    leftMonitor.support.footHeight,
    leftMonitor.support.footDepth,
    leftMonitor.support.footRadius,
    materials.charcoalSoft,
  );
  supportFoot.position.set(0, leftMonitor.support.footY, leftMonitor.support.footZ);
  supportFoot.castShadow = true;
  sideSupport.add(supportFoot);
  group.add(sideSupport);

  return {
    group,
    mainScreen,
    updateMainActions,
    interactiveTargets: [mainActionGroup, ...sideActionHits],
  };
};
