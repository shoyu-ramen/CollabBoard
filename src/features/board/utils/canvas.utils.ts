import type { WhiteboardObject } from '../types';
import { VIEWPORT_PADDING } from '@/lib/constants';

/**
 * Check if an object is within the visible viewport (with padding).
 */
export function isInViewport(
  obj: WhiteboardObject,
  viewportX: number,
  viewportY: number,
  viewportWidth: number,
  viewportHeight: number,
  zoom: number
): boolean {
  const pad = VIEWPORT_PADDING / zoom;
  const left = viewportX - pad;
  const top = viewportY - pad;
  const right = viewportX + viewportWidth / zoom + pad;
  const bottom = viewportY + viewportHeight / zoom + pad;

  const objRight = obj.x + obj.width;
  const objBottom = obj.y + obj.height;

  return objRight >= left && obj.x <= right && objBottom >= top && obj.y <= bottom;
}

/**
 * Convert screen coordinates to canvas (world) coordinates.
 */
export function screenToCanvas(
  screenX: number,
  screenY: number,
  panOffset: { x: number; y: number },
  zoom: number
): { x: number; y: number } {
  return {
    x: (screenX - panOffset.x) / zoom,
    y: (screenY - panOffset.y) / zoom,
  };
}

/**
 * Convert canvas (world) coordinates to screen coordinates.
 */
export function canvasToScreen(
  canvasX: number,
  canvasY: number,
  panOffset: { x: number; y: number },
  zoom: number
): { x: number; y: number } {
  return {
    x: canvasX * zoom + panOffset.x,
    y: canvasY * zoom + panOffset.y,
  };
}
