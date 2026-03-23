"use client";

import { useEffect, useRef } from "react";
import type { RunState } from "../game/types";
import {
  buildFollowCamera,
  DEFAULT_CAMERA_CONFIG,
  drawRunFrame,
  screenToWorld,
  worldPixelToTile,
} from "../render";

const TILE_SIZE = 24;

interface GameCanvasProps {
  run: RunState;
  onTileClick?: (tileX: number, tileY: number) => void;
}

export function GameCanvas({ run, onTileClick }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const floor = run.floors[run.currentFloor];

  useEffect(() => {
    if (!floor) {
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    // Viewport dimensions come from camera config. World map can be larger than viewport.
    canvas.width = DEFAULT_CAMERA_CONFIG.viewportWidth;
    canvas.height = DEFAULT_CAMERA_CONFIG.viewportHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    drawRunFrame(context, run, {
      tileSize: TILE_SIZE,
      camera: DEFAULT_CAMERA_CONFIG,
    });
  }, [floor, run]);

  if (!floor) {
    return null;
  }

  return (
    <div className="canvas-frame">
      <canvas
        ref={canvasRef}
        className="game-canvas"
        onClick={(event) => {
          if (!onTileClick) {
            return;
          }
          const canvas = canvasRef.current;
          if (!canvas || !floor) {
            return;
          }

          const rect = canvas.getBoundingClientRect();
          if (!rect.width || !rect.height) {
            return;
          }
          const screenX = ((event.clientX - rect.left) * canvas.width) / rect.width;
          const screenY = ((event.clientY - rect.top) * canvas.height) / rect.height;

          const cameraState = buildFollowCamera({
            playerTile: run.player.position,
            mapTileWidth: floor.width,
            mapTileHeight: floor.height,
            config: DEFAULT_CAMERA_CONFIG,
          });
          const world = screenToWorld(cameraState, screenX, screenY);
          const tile = worldPixelToTile(world.x, world.y, TILE_SIZE);
          if (tile.x < 0 || tile.y < 0 || tile.x >= floor.width || tile.y >= floor.height) {
            return;
          }

          onTileClick(tile.x, tile.y);
        }}
      />
    </div>
  );
}
