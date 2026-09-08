import * as THREE from "three";
import { addAction } from "../core/actions";
import type { SceneObjectResult } from "../core/types";
import { DESK_LAYOUT } from "../layout";
import type { CanvasSurface } from "../screens/canvas-utils";
import { roundedMesh } from "./primitives";

export const createPegboardsObject = (
  messageBoardCanvas: CanvasSurface,
): SceneObjectResult & { board: THREE.Mesh; holes: THREE.Mesh[]; messagePaper: THREE.Mesh; badges: THREE.Mesh[] } => {
  const group = new THREE.Group();
  const { small } = DESK_LAYOUT.pegboards;

  const board = roundedMesh(
    small.width,
    small.height,
    small.depth,
    small.radius,
    new THREE.MeshStandardMaterial({ color: "#343632", roughness: 0.94 }),
  );
  board.position.set(small.x, small.y, small.z);
  board.castShadow = true;
  group.add(board);
  const holes: THREE.Mesh[] = [];
  for (let x = small.holes.xStart; x <= small.holes.xEnd; x += small.holes.xStep) {
    for (let y = small.holes.yStart; y <= small.holes.yEnd; y += small.holes.yStep) {
      const hole = new THREE.Mesh(
        new THREE.CircleGeometry(small.holes.radius, 10),
        new THREE.MeshBasicMaterial({ color: "#111311" }),
      );
      hole.position.set(small.x + x, small.y + y, small.holes.z);
      group.add(hole);
      holes.push(hole);
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

  const badgeColors = ["#8ea391", "#b39a8f"];
  const badges: THREE.Mesh[] = [];
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

  return { group, board, holes, messagePaper: messageBoard, badges, interactiveTargets: [messageBoard, ...badges] };
};
