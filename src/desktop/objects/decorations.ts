import * as THREE from "three";
import { addAction } from "../core/actions";
import { createDesktopImage, DESKTOP_IMAGE_URLS } from "../core/assets";
import type { SceneObjectResult } from "../core/types";
import { DESK_LAYOUT } from "../layout";
import { makeCanvas, roundRect, type CanvasSurface } from "../screens/canvas-utils";
import { roundedMesh, type DesktopMaterials } from "./primitives";

export const createDecorationsObject = (
  noteCanvas: CanvasSurface,
  materials: DesktopMaterials,
): SceneObjectResult => {
  const group = new THREE.Group();
  const { note, toy } = DESK_LAYOUT.decorations;

  const noteMesh = addAction(
    new THREE.Mesh(
      new THREE.PlaneGeometry(note.size.width, note.size.height),
      new THREE.MeshBasicMaterial({ map: noteCanvas.texture, toneMapped: false }),
    ),
    "quote",
  );
  noteMesh.position.set(note.position.x, note.position.y, note.position.z);
  noteMesh.rotation.z = note.rotationZ;
  group.add(noteMesh);

  const toyBase = roundedMesh(
    toy.base.size.width,
    toy.base.size.height,
    toy.base.size.depth,
    toy.base.radius,
    materials.charcoalSoft,
  );
  toyBase.position.set(toy.base.position.x, toy.base.position.y, toy.base.position.z);
  toyBase.castShadow = true;
  group.add(toyBase);

  const toyCanvas = makeCanvas(toy.canvas.width, toy.canvas.height);
  const toyImage = createDesktopImage(DESKTOP_IMAGE_URLS.toy);
  toyImage.addEventListener("load", () => {
    const { context, canvas, texture } = toyCanvas;
    context.clearRect(0, 0, canvas.width, canvas.height);
    roundRect(context, 8, 8, canvas.width - 16, canvas.height - 16, 54);
    context.save();
    context.clip();
    context.fillStyle = "#eee7dc";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(toyImage, -28, 0, 476, 476);
    context.restore();
    texture.needsUpdate = true;
  });

  const toyBacking = roundedMesh(
    toy.backing.size.width,
    toy.backing.size.height,
    toy.backing.size.depth,
    toy.backing.radius,
    materials.warmWhite,
  );
  toyBacking.position.set(
    toy.backing.position.x,
    toy.backing.position.y,
    toy.backing.position.z,
  );
  toyBacking.castShadow = true;
  group.add(toyBacking);

  const toyMesh = addAction(
    new THREE.Mesh(
      new THREE.PlaneGeometry(toy.screen.size.width, toy.screen.size.height),
      new THREE.MeshBasicMaterial({ map: toyCanvas.texture, transparent: true, toneMapped: false }),
    ),
    "message",
  );
  toyMesh.position.set(toy.screen.position.x, toy.screen.position.y, toy.screen.position.z);
  group.add(toyMesh);

  return { group, interactiveTargets: [noteMesh, toyMesh] };
};
