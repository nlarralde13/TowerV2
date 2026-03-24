"use client";

import { useEffect, useRef } from "react";
import type { RunState, Vec2 } from "../game/types";
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
  destinationTile?: Vec2 | null;
  pathPreviewTiles?: Vec2[];
}

export function GameCanvas({ run, onTileClick, destinationTile, pathPreviewTiles }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const runRef = useRef(run);
  const targetPositionRef = useRef<Vec2>({ ...run.player.position });
  const renderPositionRef = useRef<Vec2>({ ...run.player.position });
  const previousFloorRef = useRef<number>(run.currentFloor);
  const rafIdRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const floor = run.floors[run.currentFloor];

  useEffect(() => {
    runRef.current = run;
    targetPositionRef.current = { ...run.player.position };
    if (run.currentFloor !== previousFloorRef.current) {
      previousFloorRef.current = run.currentFloor;
      renderPositionRef.current = { ...run.player.position };
    }
  }, [floor, run]);

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

    const renderFrame = (timestamp: number) => {
      const activeRun = runRef.current;
      const activeFloor = activeRun.floors[activeRun.currentFloor];
      if (!activeFloor) {
        rafIdRef.current = requestAnimationFrame(renderFrame);
        return;
      }

      const dt = lastFrameTimeRef.current > 0 ? timestamp - lastFrameTimeRef.current : 16.67;
      lastFrameTimeRef.current = timestamp;

      const target = targetPositionRef.current;
      const rendered = renderPositionRef.current;
      const alpha = Math.min(1, dt / 90);
      rendered.x += (target.x - rendered.x) * alpha;
      rendered.y += (target.y - rendered.y) * alpha;
      if (Math.abs(target.x - rendered.x) < 0.001) {
        rendered.x = target.x;
      }
      if (Math.abs(target.y - rendered.y) < 0.001) {
        rendered.y = target.y;
      }

      drawRunFrame(context, activeRun, {
        tileSize: TILE_SIZE,
        camera: DEFAULT_CAMERA_CONFIG,
        playerRenderPosition: rendered,
        destinationTile,
        pathPreviewTiles,
      });
      rafIdRef.current = requestAnimationFrame(renderFrame);
    };

    rafIdRef.current = requestAnimationFrame(renderFrame);
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      lastFrameTimeRef.current = 0;
    };
  }, [destinationTile, floor?.floorNumber, pathPreviewTiles]);

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
            playerTile: renderPositionRef.current,
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
