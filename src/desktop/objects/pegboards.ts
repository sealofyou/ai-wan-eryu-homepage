import * as THREE from "three";
import { addAction } from "../core/actions";
import type { SceneObjectResult } from "../core/types";
import { DESK_LAYOUT } from "../layout";
import type { CanvasSurface } from "../screens/canvas-utils";
import { roundedMesh } from "./primitives";

export const createPegboardsObject = (
  messageBoardCanvas: CanvasSurface,
): SceneObjectResult => {
  const group = new THREE.Group();
  const { small, large } = DESK_LAYOUT.pegboards;

  const board = roundedMesh(
    small.width,
    small.height,
    small.depth,
    small.radius,
    new THREE.MeshStandardMaterial({ color: "#292b29", roughness: 0.82 }),
  );
  board.position.set(small.x, small.y, small.z);
  board.castShadow = true;
  group.add(board);
  for (let x = small.holes.xStart; x <= small.holes.xEnd; x += small.holes.xStep) {
    for (let y = small.holes.yStart; y <= small.holes.yEnd; y += small.holes.yStep) {
      const hole = new THREE.Mesh(
        new THREE.CircleGeometry(small.holes.radius, 10),
        new THREE.MeshBasicMaterial({ color: "#111311" }),
      );
      hole.position.set(small.x + x, small.y + y, small.holes.z);
      group.add(hole);
    }
  }

  const messageBoard = addAction(
    new THREE.Mesh(
      new THREE.PlaneGeometry(small.message.size.width, small.message.size.height),
      new THREE.MeshBasicMaterial({ map: messageBoardCanvas.texture, toneMapped: false }),
    ),
    "message",
  );
  messageBoard.position.set(
    small.message.position.x,
    small.message.position.y,
    small.message.position.z,
  );
  messageBoard.rotation.z = small.message.rotationZ;
  group.add(messageBoard);

  const badgeColors = ["#86a28f", "#9d8797"];
  const badges: THREE.Object3D[] = [];
  badgeColors.forEach((color, index) => {
    const badge = addAction(
      roundedMesh(
        small.badges.size.width,
        small.badges.size.height,
        small.badges.size.depth,
        small.badges.radius,
        new THREE.MeshStandardMaterial({ color, roughness: 0.65 }),
      ),
      "badge",
    );
    badge.position.set(
      small.badges.start.x + (index % 2) * small.badges.xStep,
      small.badges.start.y - index * small.badges.yStep,
      small.badges.start.z,
    );
    group.add(badge);
    badges.push(badge);
  });

  const angledPegboard = new THREE.Group();
  angledPegboard.position.set(large.x, large.y, large.z);
  angledPegboard.rotation.y = DESK_LAYOUT.pegboards.large.yaw;
  group.add(angledPegboard);

  const largeBoard = roundedMesh(
    large.width,
    large.height,
    large.depth,
    large.radius,
    new THREE.MeshStandardMaterial({ color: "#555a55", roughness: 0.86 }),
  );
  largeBoard.castShadow = true;
  angledPegboard.add(largeBoard);
  for (let x = large.holes.xStart; x <= large.holes.xEnd; x += large.holes.xStep) {
    for (let y = large.holes.yStart; y <= large.holes.yEnd; y += large.holes.yStep) {
      const hole = new THREE.Mesh(
        new THREE.CircleGeometry(large.holes.radius, 10),
        new THREE.MeshBasicMaterial({ color: "#272a27" }),
      );
      hole.position.set(x, y, large.holes.z);
      angledPegboard.add(hole);
    }
  }

  return { group, interactiveTargets: [messageBoard, ...badges] };
};
