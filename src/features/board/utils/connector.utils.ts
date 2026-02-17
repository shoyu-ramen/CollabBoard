import type { WhiteboardObject } from '../types';

export interface Anchor {
  x: number;
  y: number;
  side: string;
}

/**
 * Rotate point (px, py) around pivot (cx, cy) by angleDeg degrees.
 */
function rotatePoint(
  px: number,
  py: number,
  cx: number,
  cy: number,
  angleDeg: number
): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = px - cx;
  const dy = py - cy;
  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  };
}

/**
 * Get anchor points along the edges of an object's bounding box.
 * Returns midpoints + quarter-points on each edge (12 total).
 * Circles get 8 points evenly distributed around the perimeter.
 */
export function getObjectAnchors(obj: WhiteboardObject): Anchor[] {
  const { x, y, width, height, rotation } = obj;

  let anchors: Anchor[];

  if (obj.object_type === 'circle') {
    const cx = x + width / 2;
    const cy = y + height / 2;
    const rx = width / 2;
    const ry = height / 2;
    // 8 evenly-spaced points around the ellipse (every 45°)
    anchors = [
      { x: cx, y: cy - ry, side: 'top' },                         // 0°
      { x: cx + rx * Math.SQRT1_2, y: cy - ry * Math.SQRT1_2, side: 'top-right' },  // 45°
      { x: cx + rx, y: cy, side: 'right' },                        // 90°
      { x: cx + rx * Math.SQRT1_2, y: cy + ry * Math.SQRT1_2, side: 'bottom-right' }, // 135°
      { x: cx, y: cy + ry, side: 'bottom' },                       // 180°
      { x: cx - rx * Math.SQRT1_2, y: cy + ry * Math.SQRT1_2, side: 'bottom-left' }, // 225°
      { x: cx - rx, y: cy, side: 'left' },                         // 270°
      { x: cx - rx * Math.SQRT1_2, y: cy - ry * Math.SQRT1_2, side: 'top-left' },  // 315°
    ];
  } else {
    anchors = [
      // Corners
      { x, y, side: 'top-left' },
      { x: x + width, y, side: 'top-right' },
      { x: x + width, y: y + height, side: 'bottom-right' },
      { x, y: y + height, side: 'bottom-left' },
      // Top edge: quarter, mid, three-quarter
      { x: x + width * 0.25, y, side: 'top-25' },
      { x: x + width * 0.5, y, side: 'top-50' },
      { x: x + width * 0.75, y, side: 'top-75' },
      // Right edge
      { x: x + width, y: y + height * 0.25, side: 'right-25' },
      { x: x + width, y: y + height * 0.5, side: 'right-50' },
      { x: x + width, y: y + height * 0.75, side: 'right-75' },
      // Bottom edge
      { x: x + width * 0.25, y: y + height, side: 'bottom-25' },
      { x: x + width * 0.5, y: y + height, side: 'bottom-50' },
      { x: x + width * 0.75, y: y + height, side: 'bottom-75' },
      // Left edge
      { x, y: y + height * 0.25, side: 'left-25' },
      { x, y: y + height * 0.5, side: 'left-50' },
      { x, y: y + height * 0.75, side: 'left-75' },
    ];
  }

  // Konva rotates around the node's position:
  //   Rect/StickyNote/Text → (x, y) (top-left)
  //   Ellipse (circle)     → (x + w/2, y + h/2) (center)
  if (rotation) {
    const pivotX = obj.object_type === 'circle' ? x + width / 2 : x;
    const pivotY = obj.object_type === 'circle' ? y + height / 2 : y;
    return anchors.map((a) => {
      const rotated = rotatePoint(a.x, a.y, pivotX, pivotY, rotation);
      return { x: rotated.x, y: rotated.y, side: a.side };
    });
  }

  return anchors;
}

/**
 * Find the closest anchor on an object to a given point.
 */
export function getClosestAnchor(
  obj: WhiteboardObject,
  px: number,
  py: number
): Anchor {
  const anchors = getObjectAnchors(obj);
  let best = anchors[0];
  let bestDist = Infinity;
  for (const a of anchors) {
    const d = (a.x - px) ** 2 + (a.y - py) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = a;
    }
  }
  return best;
}

/**
 * Bounding-box hit test to find the topmost object under (px, py).
 * Optionally exclude certain object types (e.g. arrows).
 * `padding` expands the hit area around each object's bounding box.
 */
export function findObjectAtPoint(
  objects: Map<string, WhiteboardObject>,
  px: number,
  py: number,
  excludeTypes: Set<string> = new Set(),
  padding: number = 0
): WhiteboardObject | null {
  let found: WhiteboardObject | null = null;

  objects.forEach((obj) => {
    if (excludeTypes.has(obj.object_type)) return;
    const { x, y, width, height, rotation } = obj;
    // Use a minimum hit area for small objects
    const w = Math.max(width, 20);
    const h = Math.max(height, 20);

    // Transform test point into the object's local (unrotated) space
    let localX = px;
    let localY = py;
    if (rotation) {
      const inv = rotatePoint(px, py, x, y, -rotation);
      localX = inv.x;
      localY = inv.y;
    }

    if (
      localX >= x - padding &&
      localX <= x + w + padding &&
      localY >= y - padding &&
      localY <= y + h + padding
    ) {
      found = obj;
    }
  });

  return found;
}

/**
 * Search ALL objects for the nearest anchor within maxRadius of (px, py).
 * Unlike getClosestAnchor, this doesn't require the cursor to be inside
 * an object's bounding box — it checks every object's anchors globally.
 */
export function findNearestAnchorGlobal(
  objects: Map<string, WhiteboardObject>,
  px: number,
  py: number,
  excludeTypes: Set<string>,
  maxRadius: number,
  skipIds: Set<string> = new Set()
): { anchor: Anchor; obj: WhiteboardObject } | null {
  let bestResult: { anchor: Anchor; obj: WhiteboardObject } | null = null;
  let bestDist = Infinity;

  objects.forEach((obj) => {
    if (excludeTypes.has(obj.object_type)) return;
    if (skipIds.has(obj.id)) return;
    const anchors = getObjectAnchors(obj);
    for (const a of anchors) {
      const dist = Math.sqrt((a.x - px) ** 2 + (a.y - py) ** 2);
      if (dist < bestDist && dist <= maxRadius) {
        bestDist = dist;
        bestResult = { anchor: a, obj };
      }
    }
  });

  return bestResult;
}

/**
 * Find all arrows connected to a given object (by startObjectId or endObjectId).
 */
export function getConnectedArrows(
  objects: Map<string, WhiteboardObject>,
  objectId: string
): WhiteboardObject[] {
  const arrows: WhiteboardObject[] = [];
  objects.forEach((obj) => {
    if (obj.object_type === 'arrow') {
      if (
        obj.properties.startObjectId === objectId ||
        obj.properties.endObjectId === objectId
      ) {
        arrows.push(obj);
      }
    }
  });
  return arrows;
}

/**
 * Find an anchor on `obj` by its side name.
 * Returns null if the side is not found.
 */
export function getAnchorBySide(
  obj: WhiteboardObject,
  side: string
): Anchor | null {
  const anchors = getObjectAnchors(obj);
  return anchors.find((a) => a.side === side) || null;
}

/**
 * Recompute arrow geometry based on its connected objects' current positions.
 * Arrows stay locked to their original anchor sides (stored in properties).
 * Objects render on top of arrows so any visual overlap is hidden.
 */
export function computeArrowEndpoints(
  arrow: WhiteboardObject,
  objects: Map<string, WhiteboardObject>
): {
  x: number;
  y: number;
  width: number;
  height: number;
  points: number[];
} | null {
  const {
    startObjectId,
    endObjectId,
    startAnchorSide,
    endAnchorSide,
  } = arrow.properties;
  if (!startObjectId && !endObjectId) return null;

  const points = (arrow.properties.points as number[]) || [
    0,
    0,
    arrow.width,
    arrow.height,
  ];

  const startObj = startObjectId ? objects.get(startObjectId) : null;
  const endObj = endObjectId ? objects.get(endObjectId) : null;

  let startX: number, startY: number, endX: number, endY: number;

  if (startObj) {
    // Use stored anchor side if available, otherwise fall back to closest
    const anchor = startAnchorSide
      ? getAnchorBySide(startObj, startAnchorSide as string)
      : null;
    if (anchor) {
      startX = anchor.x;
      startY = anchor.y;
    } else {
      const endRef = endObj
        ? { x: endObj.x + endObj.width / 2, y: endObj.y + endObj.height / 2 }
        : { x: arrow.x + points[2], y: arrow.y + points[3] };
      const fallback = getClosestAnchor(startObj, endRef.x, endRef.y);
      startX = fallback.x;
      startY = fallback.y;
    }
  } else {
    startX = arrow.x + points[0];
    startY = arrow.y + points[1];
  }

  if (endObj) {
    const anchor = endAnchorSide
      ? getAnchorBySide(endObj, endAnchorSide as string)
      : null;
    if (anchor) {
      endX = anchor.x;
      endY = anchor.y;
    } else {
      const startRef = startObj
        ? { x: startObj.x + startObj.width / 2, y: startObj.y + startObj.height / 2 }
        : { x: arrow.x + points[0], y: arrow.y + points[1] };
      const fallback = getClosestAnchor(endObj, startRef.x, startRef.y);
      endX = fallback.x;
      endY = fallback.y;
    }
  } else {
    endX = arrow.x + points[2];
    endY = arrow.y + points[3];
  }

  const dx = endX - startX;
  const dy = endY - startY;

  return {
    x: startX,
    y: startY,
    width: dx,
    height: dy,
    points: [0, 0, dx, dy],
  };
}
