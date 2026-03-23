import type { Vec2 } from "../../game/types";

export interface CameraState {
  x: number;
  y: number;
  viewportWidth: number;
  viewportHeight: number;
}

export interface CameraConfig {
  viewportWidth: number;
  viewportHeight: number;
  tileSize: number;
}

export const DEFAULT_CAMERA_CONFIG: CameraConfig = {
  // Smaller viewport makes camera-follow behavior obvious during early movement.
  viewportWidth: 384,
  viewportHeight: 288,
  tileSize: 24,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function buildFollowCamera(params: {
  playerTile: Vec2;
  mapTileWidth: number;
  mapTileHeight: number;
  config: CameraConfig;
}): CameraState {
  const { playerTile, mapTileWidth, mapTileHeight, config } = params;
  const mapPixelWidth = mapTileWidth * config.tileSize;
  const mapPixelHeight = mapTileHeight * config.tileSize;

  // World position (tile space) -> world pixel center of player.
  const playerWorldX = playerTile.x * config.tileSize + config.tileSize / 2;
  const playerWorldY = playerTile.y * config.tileSize + config.tileSize / 2;

  // Camera target attempts to center player in viewport.
  const targetX = playerWorldX - config.viewportWidth / 2;
  const targetY = playerWorldY - config.viewportHeight / 2;

  const maxX = Math.max(0, mapPixelWidth - config.viewportWidth);
  const maxY = Math.max(0, mapPixelHeight - config.viewportHeight);

  return {
    x: clamp(targetX, 0, maxX),
    y: clamp(targetY, 0, maxY),
    viewportWidth: config.viewportWidth,
    viewportHeight: config.viewportHeight,
  };
}

// Convert world pixel coordinates into screen-space by subtracting camera offset.
export function worldToScreen(
  camera: CameraState,
  worldX: number,
  worldY: number,
): Vec2 {
  return {
    x: worldX - camera.x,
    y: worldY - camera.y,
  };
}

export function screenToWorld(
  camera: CameraState,
  screenX: number,
  screenY: number,
): Vec2 {
  return {
    x: screenX + camera.x,
    y: screenY + camera.y,
  };
}

export function worldPixelToTile(worldX: number, worldY: number, tileSize: number): Vec2 {
  return {
    x: Math.floor(worldX / tileSize),
    y: Math.floor(worldY / tileSize),
  };
}
