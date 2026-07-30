import * as THREE from "three";
import { addAction } from "../core/actions";
import {
  DESKTOP_MODEL_URLS,
  type DesktopMouseVariant,
  type GlbAssetStore,
  type GlbModelLease,
} from "../core/model-assets";
import type { SceneObjectResult } from "../core/types";
import { DESK_LAYOUT } from "../layout";
import { mapRange, roundedMesh, type DesktopMaterials } from "./primitives";

interface MouseObjectOptions {
  variant?: DesktopMouseVariant;
  assetStore?: Pick<GlbAssetStore, "acquire">;
  modelUrl?: string;
}

export interface MouseObjectResult extends SceneObjectResult {
  ready: Promise<DesktopMouseVariant>;
}

export const createMouseObject = (
  materials: DesktopMaterials,
  options: MouseObjectOptions = {},
): MouseObjectResult => {
  const group = addAction(new THREE.Group(), "mouse");
  const { mouse } = DESK_LAYOUT;
  const proceduralVisual = new THREE.Group();
  proceduralVisual.name = "procedural-mouse";
  group.add(proceduralVisual);
  group.userData.modelVariant = "procedural";

  const mouseBody = new THREE.Mesh(
    new THREE.SphereGeometry(mouse.body.radius, 40, 24),
    materials.charcoal,
  );
  mouseBody.scale.set(mouse.body.scale.x, mouse.body.scale.y, mouse.body.scale.z);
  mouseBody.position.set(mouse.body.position.x, mouse.body.position.y, mouse.body.position.z);
  mouseBody.castShadow = true;
  proceduralVisual.add(mouseBody);

  const rearHump = new THREE.Mesh(
    new THREE.SphereGeometry(mouse.rearHump.radius, 36, 20),
    materials.charcoalSoft,
  );
  rearHump.scale.set(mouse.rearHump.scale.x, mouse.rearHump.scale.y, mouse.rearHump.scale.z);
  rearHump.position.set(
    mouse.rearHump.position.x,
    mouse.rearHump.position.y,
    mouse.rearHump.position.z,
  );
  rearHump.castShadow = true;
  proceduralVisual.add(rearHump);

  const clickDeck = roundedMesh(
    mouse.clickDeck.size.width,
    mouse.clickDeck.size.height,
    mouse.clickDeck.size.depth,
    mouse.clickDeck.radius,
    materials.charcoalSoft,
  );
  clickDeck.position.set(
    mouse.clickDeck.position.x,
    mouse.clickDeck.position.y,
    mouse.clickDeck.position.z,
  );
  clickDeck.castShadow = true;
  proceduralVisual.add(clickDeck);

  const clickSeam = roundedMesh(
    mouse.clickSeam.size.width,
    mouse.clickSeam.size.height,
    mouse.clickSeam.size.depth,
    mouse.clickSeam.radius,
    materials.charcoal,
  );
  clickSeam.position.set(
    mouse.clickSeam.position.x,
    mouse.clickSeam.position.y,
    mouse.clickSeam.position.z,
  );
  proceduralVisual.add(clickSeam);

  const centerSpine = roundedMesh(
    mouse.centerSpine.size.width,
    mouse.centerSpine.size.height,
    mouse.centerSpine.size.depth,
    mouse.centerSpine.radius,
    materials.charcoal,
  );
  centerSpine.position.set(
    mouse.centerSpine.position.x,
    mouse.centerSpine.position.y,
    mouse.centerSpine.position.z,
  );
  proceduralVisual.add(centerSpine);

  const mouseWheel = new THREE.Mesh(
    new THREE.CylinderGeometry(mouse.wheel.radius, mouse.wheel.radius, mouse.wheel.height, 20),
    materials.paleGreen,
  );
  mouseWheel.rotation.z = mouse.wheel.rotationZ;
  mouseWheel.position.set(mouse.wheel.position.x, mouse.wheel.position.y, mouse.wheel.position.z);
  proceduralVisual.add(mouseWheel);

  const dpiButton = roundedMesh(
    mouse.dpiButton.size.width,
    mouse.dpiButton.size.height,
    mouse.dpiButton.size.depth,
    mouse.dpiButton.radius,
    materials.charcoalSoft,
  );
  dpiButton.position.set(
    mouse.dpiButton.position.x,
    mouse.dpiButton.position.y,
    mouse.dpiButton.position.z,
  );
  proceduralVisual.add(dpiButton);

  mouse.sideButtons.z.forEach((z) => {
    const sideButton = roundedMesh(
      mouse.sideButtons.size.width,
      mouse.sideButtons.size.height,
      mouse.sideButtons.size.depth,
      mouse.sideButtons.radius,
      materials.charcoalSoft,
    );
    sideButton.position.set(mouse.sideButtons.x, mouse.sideButtons.y, z);
    proceduralVisual.add(sideButton);
  });

  const mouseLogo = new THREE.Group();
  const mouseLogoMaterial = new THREE.MeshBasicMaterial({ color: "#d8cfbd", toneMapped: false });
  const logoStem = roundedMesh(
    mouse.logo.stem.size.width,
    mouse.logo.stem.size.height,
    mouse.logo.stem.size.depth,
    mouse.logo.stem.radius,
    mouseLogoMaterial,
  );
  logoStem.position.x = mouse.logo.stem.x;
  mouseLogo.add(logoStem);
  mouse.logo.bars.forEach((bar) => {
    const barMesh = roundedMesh(
      bar.size.width,
      bar.size.height,
      bar.size.depth,
      bar.radius,
      mouseLogoMaterial,
    );
    barMesh.position.set(bar.position.x, bar.position.y, bar.position.z);
    mouseLogo.add(barMesh);
  });
  mouseLogo.position.set(mouse.logo.position.x, mouse.logo.position.y, mouse.logo.position.z);
  proceduralVisual.add(mouseLogo);

  const hitProxy = addAction(
    new THREE.Mesh(
      new THREE.SphereGeometry(mouse.body.radius, 16, 10),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    ),
    "mouse",
  );
  hitProxy.name = "mouse-hit-proxy";
  hitProxy.scale.set(
    mouse.body.scale.x * 1.04,
    mouse.body.scale.y * 1.2,
    mouse.body.scale.z * 1.04,
  );
  hitProxy.position.set(
    mouse.body.position.x,
    mouse.body.position.y + 0.03,
    mouse.body.position.z,
  );
  group.add(hitProxy);

  let disposed = false;
  let activeLease: GlbModelLease | undefined;
  let activeModel: THREE.Group | undefined;
  const variant = options.variant ?? "procedural";
  const modelRequest =
    variant === "glb" && options.assetStore
      ? new AbortController()
      : undefined;
  const ready: Promise<DesktopMouseVariant> =
    modelRequest && options.assetStore
      ? options.assetStore
          .acquire(options.modelUrl ?? DESKTOP_MODEL_URLS.mouse, {
            signal: modelRequest.signal,
          })
          .then((lease) => {
            if (disposed) {
              lease.release();
              return "procedural";
            }
            activeLease = lease;
            activeModel = lease.scene;
            activeModel.name = "gaming-mouse-glb";
            activeModel.traverse((object) => {
              if (object instanceof THREE.Mesh) object.castShadow = true;
            });
            proceduralVisual.visible = false;
            group.add(activeModel);
            group.userData.modelVariant = "glb";
            delete group.userData.modelError;
            return "glb";
          })
          .catch((error: unknown) => {
            if (
              !disposed &&
              (!(error instanceof Error) || error.name !== "AbortError")
            ) {
              group.userData.modelError =
                error instanceof Error ? error.message : String(error);
            }
            return "procedural";
          })
      : Promise.resolve("procedural");

  return {
    group,
    interactiveTargets: [hitProxy],
    ready,
    update: (state) => {
      group.position.set(
        mapRange(state.physicalMouse.x, mouse.inputX.start, mouse.inputX.end, mouse.x.start, mouse.x.end),
        mouse.y,
        mapRange(state.physicalMouse.y, mouse.inputY.start, mouse.inputY.end, mouse.z.start, mouse.z.end),
      );
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      modelRequest?.abort();
      if (activeModel) group.remove(activeModel);
      activeLease?.release();
      activeModel = undefined;
      activeLease = undefined;
    },
  };
};
