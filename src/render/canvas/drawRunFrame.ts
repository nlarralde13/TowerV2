import type { FloorState, RunState, TileState, Vec2 } from "@game/types";
import { directionToUnitVector } from "@game/utils";
import {
  type CameraConfig,
  buildFollowCamera,
  worldToScreen,
} from "../camera";

export interface DrawOptions {
  tileSize: number;
  camera: CameraConfig;
  playerRenderPosition?: Vec2;
  destinationTile?: Vec2 | null;
  pathPreviewTiles?: Vec2[];
  destinationReachableThisTurn?: boolean;
}

function tileColor(roomType: FloorState["tiles"][number]["roomType"]): string {
  switch (roomType) {
    case "blocked":
      return "#1f2937";
    case "entry":
      return "#14532d";
    case "stairs":
      return "#7c3aed";
    case "extraction":
      return "#b45309";
    case "loot":
      return "#0f766e";
    default:
      return "#334155";
  }
}

function isTileVisibleOnScreen(params: {
  tile: TileState;
  tileSize: number;
  viewportWidth: number;
  viewportHeight: number;
  cameraX: number;
  cameraY: number;
}): boolean {
  const { tile, tileSize, viewportWidth, viewportHeight, cameraX, cameraY } = params;
  const worldX = tile.x * tileSize;
  const worldY = tile.y * tileSize;
  const screenX = worldX - cameraX;
  const screenY = worldY - cameraY;
  return (
    screenX + tileSize >= 0 &&
    screenY + tileSize >= 0 &&
    screenX <= viewportWidth &&
    screenY <= viewportHeight
  );
}

export function drawRunFrame(
  context: CanvasRenderingContext2D,
  run: RunState,
  options: DrawOptions,
): void {
  const floor = run.floors[run.currentFloor];
  if (!floor) {
    return;
  }

  const { tileSize, camera } = options;
  const playerPosition = options.playerRenderPosition ?? run.player.position;
  const cameraState = buildFollowCamera({
    playerTile: playerPosition,
    mapTileWidth: floor.width,
    mapTileHeight: floor.height,
    config: camera,
  });

  context.clearRect(0, 0, cameraState.viewportWidth, cameraState.viewportHeight);
  context.fillStyle = "#0b1020";
  context.fillRect(0, 0, cameraState.viewportWidth, cameraState.viewportHeight);

  // World coordinates are authoritative. Rendering converts world -> screen via camera offset.
  for (const tile of floor.tiles) {
    if (
      !isTileVisibleOnScreen({
        tile,
        tileSize,
        viewportWidth: cameraState.viewportWidth,
        viewportHeight: cameraState.viewportHeight,
        cameraX: cameraState.x,
        cameraY: cameraState.y,
      })
    ) {
      continue;
    }

    const worldX = tile.x * tileSize;
    const worldY = tile.y * tileSize;
    const screen = worldToScreen(cameraState, worldX, worldY);

    if (!tile.explored) {
      context.fillStyle = "#020617";
      context.fillRect(screen.x, screen.y, tileSize, tileSize);
      continue;
    }

    context.fillStyle = tile.visible ? tileColor(tile.roomType) : "#111827";
    context.fillRect(screen.x, screen.y, tileSize, tileSize);
    context.strokeStyle = "#0f172a";
    context.strokeRect(screen.x, screen.y, tileSize, tileSize);

    if (tile.interactableId && tile.visible) {
      context.fillStyle = "#fde68a";
      context.fillRect(screen.x + tileSize * 0.42, screen.y + tileSize * 0.1, tileSize * 0.16, tileSize * 0.16);
    }
  }

  if (options.pathPreviewTiles && options.pathPreviewTiles.length > 1) {
    context.strokeStyle = options.destinationReachableThisTurn ? "rgba(59, 130, 246, 0.92)" : "rgba(239, 68, 68, 0.95)";
    context.lineWidth = Math.max(2, tileSize * 0.09);
    context.beginPath();
    for (let i = 0; i < options.pathPreviewTiles.length; i += 1) {
      const tile = options.pathPreviewTiles[i];
      const worldX = tile.x * tileSize + tileSize / 2;
      const worldY = tile.y * tileSize + tileSize / 2;
      const screen = worldToScreen(cameraState, worldX, worldY);
      if (i === 0) {
        context.moveTo(screen.x, screen.y);
      } else {
        context.lineTo(screen.x, screen.y);
      }
    }
    context.stroke();
  }

  if (options.destinationTile) {
    const destinationWorldX = options.destinationTile.x * tileSize;
    const destinationWorldY = options.destinationTile.y * tileSize;
    const destinationScreen = worldToScreen(cameraState, destinationWorldX, destinationWorldY);
    context.strokeStyle = options.destinationReachableThisTurn ? "#3b82f6" : "#ef4444";
    context.lineWidth = Math.max(2, tileSize * 0.08);
    context.strokeRect(
      destinationScreen.x + tileSize * 0.1,
      destinationScreen.y + tileSize * 0.1,
      tileSize * 0.8,
      tileSize * 0.8,
    );
  }

  for (const enemy of floor.enemies) {
    const tile = floor.tiles.find((entry) => entry.x === enemy.position.x && entry.y === enemy.position.y);
    if (!tile || !tile.visible || enemy.state === "dead") {
      continue;
    }

    const worldX = enemy.position.x * tileSize + tileSize / 2;
    const worldY = enemy.position.y * tileSize + tileSize / 2;
    const screen = worldToScreen(cameraState, worldX, worldY);

    if (
      screen.x + tileSize * 0.28 < 0 ||
      screen.y + tileSize * 0.28 < 0 ||
      screen.x - tileSize * 0.28 > cameraState.viewportWidth ||
      screen.y - tileSize * 0.28 > cameraState.viewportHeight
    ) {
      continue;
    }

    context.fillStyle = "#ef4444";
    context.beginPath();
    context.arc(screen.x, screen.y, tileSize * 0.28, 0, Math.PI * 2);
    context.fill();
  }

  for (const loot of floor.groundLoot) {
    if (loot.position.container !== "ground") {
      continue;
    }
    const x = loot.position.x;
    const y = loot.position.y;
    if (typeof x !== "number" || typeof y !== "number") {
      continue;
    }
    const tile = floor.tiles.find((entry) => entry.x === x && entry.y === y);
    if (!tile || !tile.visible) {
      continue;
    }

    const worldX = x * tileSize;
    const worldY = y * tileSize;
    const screen = worldToScreen(cameraState, worldX, worldY);
    context.fillStyle = "#facc15";
    context.fillRect(
      screen.x + tileSize * 0.32,
      screen.y + tileSize * 0.32,
      tileSize * 0.36,
      tileSize * 0.36,
    );
  }

  // Player is rendered in world-space and appears near center when camera can follow.
  const playerWorldX = playerPosition.x * tileSize + tileSize / 2;
  const playerWorldY = playerPosition.y * tileSize + tileSize / 2;
  const playerScreen = worldToScreen(cameraState, playerWorldX, playerWorldY);

  context.fillStyle = "#22d3ee";
  context.beginPath();
  context.arc(playerScreen.x, playerScreen.y, tileSize * 0.3, 0, Math.PI * 2);
  context.fill();

  // Facing marker: short line from player center toward current facing direction.
  const facingVector = directionToUnitVector(run.player.facing);
  const markerStartX = playerScreen.x + facingVector.x * tileSize * 0.18;
  const markerStartY = playerScreen.y + facingVector.y * tileSize * 0.18;
  const markerEndX = playerScreen.x + facingVector.x * tileSize * 0.38;
  const markerEndY = playerScreen.y + facingVector.y * tileSize * 0.38;
  context.strokeStyle = "#ecfeff";
  context.lineWidth = Math.max(2, tileSize * 0.08);
  context.beginPath();
  context.moveTo(markerStartX, markerStartY);
  context.lineTo(markerEndX, markerEndY);
  context.stroke();
}
