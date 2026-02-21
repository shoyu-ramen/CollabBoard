'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useCanvas } from '../hooks/useCanvas';
import { useBoardObjects } from '../hooks/useBoardObjects';
import { useFollowMode } from '../hooks/useFollowMode';
import type { PresenceUser, WhiteboardObject } from '../types';

// ── Constants ────────────────────────────────────────────────────
const MINIMAP_WIDTH = 200;
const MINIMAP_HEIGHT = 150;
const MINIMAP_PADDING = 100; // world-space padding around bounding box
const RENDER_THROTTLE_MS = 100; // re-render at most every 100ms

// ── Types ────────────────────────────────────────────────────────
interface MinimapProps {
  onlineUsers: PresenceUser[];
  currentUserId: string | null;
  onBreakFollow?: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────

/** Compute the axis-aligned bounding box of all objects (world coords). */
function computeWorldBounds(objects: Map<string, WhiteboardObject>) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  objects.forEach((obj) => {
    const left = obj.x;
    const top = obj.y;
    const right = obj.x + (obj.width || 0);
    const bottom = obj.y + (obj.height || 0);
    if (left < minX) minX = left;
    if (top < minY) minY = top;
    if (right > maxX) maxX = right;
    if (bottom > maxY) maxY = bottom;
  });

  if (!isFinite(minX)) {
    // No objects — show a default area around origin
    return { minX: -500, minY: -400, maxX: 500, maxY: 400 };
  }

  return {
    minX: minX - MINIMAP_PADDING,
    minY: minY - MINIMAP_PADDING,
    maxX: maxX + MINIMAP_PADDING,
    maxY: maxY + MINIMAP_PADDING,
  };
}

/** Map a color to a slightly transparent version for the minimap. */
function withAlpha(hex: string, alpha: number): string {
  // Handle #RRGGBB and #RGB
  let r = 0, g = 0, b = 0;
  if (hex.length === 7) {
    r = parseInt(hex.slice(1, 3), 16);
    g = parseInt(hex.slice(3, 5), 16);
    b = parseInt(hex.slice(5, 7), 16);
  } else if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  }
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── Object color lookup ──────────────────────────────────────────
function getObjectColor(obj: WhiteboardObject): string {
  const p = obj.properties;
  switch (obj.object_type) {
    case 'sticky_note':
      return p.noteColor ?? p.color ?? '#FEF08A';
    case 'rectangle':
    case 'circle':
      return p.fill ?? p.color ?? '#007AFF';
    case 'frame':
      return '#94a3b8'; // slate-400
    case 'arrow':
    case 'line':
      return p.stroke ?? p.color ?? '#000000';
    case 'text':
      return p.color ?? '#1a1a1a';
    default:
      return '#888888';
  }
}

// ── Component ────────────────────────────────────────────────────

export function Minimap({ onlineUsers, currentUserId, onBreakFollow }: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderScheduledRef = useRef(false);
  const isDraggingRef = useRef(false);
  const [collapsed, setCollapsed] = useState(false);

  // Build a userId→color lookup from onlineUsers
  const userColorMap = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    const map = new Map<string, string>();
    for (const u of onlineUsers) {
      map.set(u.userId, u.color);
    }
    userColorMap.current = map;
  }, [onlineUsers]);

  // ── Drawing ────────────────────────────────────────────────────
  const draw = useCallback(() => {
    renderScheduledRef.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    // Ensure canvas buffer matches CSS size at device pixel ratio
    if (
      canvas.width !== MINIMAP_WIDTH * dpr ||
      canvas.height !== MINIMAP_HEIGHT * dpr
    ) {
      canvas.width = MINIMAP_WIDTH * dpr;
      canvas.height = MINIMAP_HEIGHT * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const objects = useBoardObjects.getState().objects;
    const { zoom, panOffset } = useCanvas.getState();
    const remoteViewports = useFollowMode.getState().remoteViewports;

    // World bounds
    const wb = computeWorldBounds(objects);
    const worldW = wb.maxX - wb.minX;
    const worldH = wb.maxY - wb.minY;

    // Scale to fit minimap, maintaining aspect ratio
    const scaleX = MINIMAP_WIDTH / worldW;
    const scaleY = MINIMAP_HEIGHT / worldH;
    const scale = Math.min(scaleX, scaleY);

    // Center the content in the minimap
    const offsetX = (MINIMAP_WIDTH - worldW * scale) / 2;
    const offsetY = (MINIMAP_HEIGHT - worldH * scale) / 2;

    // Transform: world coord → minimap coord
    const toMiniX = (wx: number) => (wx - wb.minX) * scale + offsetX;
    const toMiniY = (wy: number) => (wy - wb.minY) * scale + offsetY;

    // Clear
    ctx.clearRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);

    // Background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)'; // slate-900
    ctx.beginPath();
    ctx.roundRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT, 8);
    ctx.fill();

    // Draw objects as colored rectangles/circles
    objects.forEach((obj) => {
      const mx = toMiniX(obj.x);
      const my = toMiniY(obj.y);
      const mw = Math.max((obj.width || 10) * scale, 2);
      const mh = Math.max((obj.height || 10) * scale, 2);
      const color = getObjectColor(obj);

      ctx.fillStyle = withAlpha(color, 0.8);

      if (obj.object_type === 'circle') {
        ctx.beginPath();
        ctx.ellipse(mx + mw / 2, my + mh / 2, mw / 2, mh / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (obj.object_type === 'arrow' || obj.object_type === 'line') {
        // Draw as a thin line
        const points = obj.properties.points;
        if (points && points.length >= 4) {
          ctx.strokeStyle = withAlpha(color, 0.7);
          ctx.lineWidth = Math.max(1, 1.5 * scale);
          ctx.beginPath();
          ctx.moveTo(
            toMiniX(obj.x + points[0]),
            toMiniY(obj.y + points[1])
          );
          for (let i = 2; i < points.length; i += 2) {
            ctx.lineTo(
              toMiniX(obj.x + points[i]),
              toMiniY(obj.y + points[i + 1])
            );
          }
          ctx.stroke();
        }
      } else if (obj.object_type === 'frame') {
        // Frames: draw as outlined rectangle
        ctx.strokeStyle = withAlpha(color, 0.6);
        ctx.lineWidth = 1;
        ctx.strokeRect(mx, my, mw, mh);
      } else {
        ctx.fillRect(mx, my, mw, mh);
      }
    });

    // ── Viewport rectangles ──────────────────────────────────────

    // The stage uses: screenX = worldX * zoom + panOffset.x
    // So: worldX = (screenX - panOffset.x) / zoom
    // The visible area in world coords:
    // topLeft  = (-panOffset.x / zoom, -panOffset.y / zoom)
    // size     = (windowWidth / zoom, windowHeight / zoom)

    const winW = window.innerWidth;
    const winH = window.innerHeight;

    // Current user's viewport
    const vpWorldX = -panOffset.x / zoom;
    const vpWorldY = -panOffset.y / zoom;
    const vpWorldW = winW / zoom;
    const vpWorldH = winH / zoom;

    const myColor = (currentUserId && userColorMap.current.get(currentUserId)) || '#3B82F6';
    ctx.strokeStyle = myColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(
      toMiniX(vpWorldX),
      toMiniY(vpWorldY),
      vpWorldW * scale,
      vpWorldH * scale
    );

    // Remote user viewports
    remoteViewports.forEach((vp, uid) => {
      if (uid === currentUserId) return;
      const rvpWorldX = -vp.panOffsetX / vp.zoom;
      const rvpWorldY = -vp.panOffsetY / vp.zoom;
      const rvpWorldW = winW / vp.zoom;
      const rvpWorldH = winH / vp.zoom;

      const color = userColorMap.current.get(uid) || '#8B5CF6';
      ctx.strokeStyle = withAlpha(color, 0.5);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(
        toMiniX(rvpWorldX),
        toMiniY(rvpWorldY),
        rvpWorldW * scale,
        rvpWorldH * scale
      );
    });
  }, [currentUserId]);

  // ── Schedule re-renders (throttled) ────────────────────────────
  const scheduleRender = useCallback(() => {
    if (renderScheduledRef.current) return;
    renderScheduledRef.current = true;
    setTimeout(() => {
      requestAnimationFrame(draw);
    }, RENDER_THROTTLE_MS);
  }, [draw]);

  // Subscribe to store changes to trigger re-renders
  useEffect(() => {
    if (collapsed) return;
    // Initial draw
    requestAnimationFrame(draw);

    // Subscribe to canvas state (zoom/pan)
    const unsubCanvas = useCanvas.subscribe(scheduleRender);
    // Subscribe to object changes
    const unsubObjects = useBoardObjects.subscribe(scheduleRender);
    // Subscribe to remote viewport changes
    const unsubFollow = useFollowMode.subscribe(scheduleRender);

    return () => {
      unsubCanvas();
      unsubObjects();
      unsubFollow();
    };
  }, [collapsed, draw, scheduleRender]);

  // ── Click-to-navigate ──────────────────────────────────────────
  const handleMinimapInteraction = useCallback(
    (clientX: number, clientY: number) => {
      onBreakFollow?.();

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const mx = clientX - rect.left;
      const my = clientY - rect.top;

      // Reverse the transform: minimap coord → world coord
      const objects = useBoardObjects.getState().objects;
      const { zoom } = useCanvas.getState();
      const wb = computeWorldBounds(objects);
      const worldW = wb.maxX - wb.minX;
      const worldH = wb.maxY - wb.minY;
      const scaleX = MINIMAP_WIDTH / worldW;
      const scaleY = MINIMAP_HEIGHT / worldH;
      const scale = Math.min(scaleX, scaleY);
      const offsetX = (MINIMAP_WIDTH - worldW * scale) / 2;
      const offsetY = (MINIMAP_HEIGHT - worldH * scale) / 2;

      const worldX = (mx - offsetX) / scale + wb.minX;
      const worldY = (my - offsetY) / scale + wb.minY;

      // Center the viewport on this world point
      const winW = window.innerWidth;
      const winH = window.innerHeight;
      const newPanX = -(worldX * zoom - winW / 2);
      const newPanY = -(worldY * zoom - winH / 2);

      useCanvas.getState().setPanOffset({ x: newPanX, y: newPanY });
    },
    [onBreakFollow]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      isDraggingRef.current = true;
      handleMinimapInteraction(e.clientX, e.clientY);
    },
    [handleMinimapInteraction]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDraggingRef.current) return;
      e.stopPropagation();
      handleMinimapInteraction(e.clientX, e.clientY);
    },
    [handleMinimapInteraction]
  );

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  // Also listen for mouseup on window (in case mouse leaves minimap while dragging)
  useEffect(() => {
    const onUp = () => {
      isDraggingRef.current = false;
    };
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, []);

  // Toggle with M key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'm' || e.key === 'M') {
        setCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="hidden md:flex fixed bottom-4 right-4 z-50 items-center justify-center h-10 w-10 rounded-full bg-[var(--fill-tertiary)] border border-[var(--separator)] text-[var(--label-secondary)] shadow-lg hover:opacity-80 transition-colors"
        title="Show minimap (M)"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <rect x="7" y="7" width="3" height="9" />
          <rect x="14" y="7" width="3" height="5" />
        </svg>
      </button>
    );
  }

  return (
    <div
      className="hidden md:block fixed bottom-4 right-4 z-50 select-none"
      style={{ width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT }}
    >
      {/* Collapse button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setCollapsed(true);
        }}
        className="absolute -top-2 -right-2 z-10 flex items-center justify-center h-5 w-5 rounded-full bg-[var(--fill-tertiary)] border border-[var(--separator)] text-[var(--label-secondary)] hover:opacity-80 transition-colors"
        title="Hide minimap (M)"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
      <canvas
        ref={canvasRef}
        width={MINIMAP_WIDTH}
        height={MINIMAP_HEIGHT}
        style={{
          width: MINIMAP_WIDTH,
          height: MINIMAP_HEIGHT,
          borderRadius: 8,
          cursor: 'crosshair',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          border: '1px solid rgba(51,65,85,0.5)',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      />
    </div>
  );
}
