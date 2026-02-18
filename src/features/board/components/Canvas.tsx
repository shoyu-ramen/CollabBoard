'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { Stage, Layer, Rect, Line, Ellipse, Arrow, Circle as KonvaCircle } from 'react-konva';
import type Konva from 'konva';
import { v4 as uuidv4 } from 'uuid';
import { useBoardObjects } from '../hooks/useBoardObjects';
import { broadcastToLiveChannel } from '../hooks/useBoardRealtime';
import { useCanvas } from '../hooks/useCanvas';
import { isInViewport, screenToCanvas } from '../utils/canvas.utils';
import type { WhiteboardObject, ObjectType, CursorPosition } from '../types';
import {
  DEFAULT_STICKY_WIDTH,
  DEFAULT_STICKY_HEIGHT,
  DEFAULT_STICKY_COLORS,
  DEFAULT_SHAPE_WIDTH,
  DEFAULT_SHAPE_HEIGHT,
  DEFAULT_SHAPE_COLOR,
  DEFAULT_STROKE_WIDTH,
  DEFAULT_FRAME_WIDTH,
  DEFAULT_FRAME_HEIGHT,
  DEFAULT_TEXT_WIDTH,
  DEFAULT_TEXT_HEIGHT,
  DEFAULT_TEXT_FONT_SIZE,
  DEFAULT_TEXT_COLOR,
  DEFAULT_TEXT_FONT_FAMILY,
  DEFAULT_LINE_COLOR,
  DEFAULT_LINE_WIDTH,
  OBJECT_SYNC_THROTTLE_MS,
} from '@/lib/constants';

import StickyNote from './shapes/StickyNote';
import Rectangle from './shapes/Rectangle';
import CircleShape from './shapes/Circle';
import ArrowShape from './shapes/Arrow';
import LineShape from './shapes/LineShape';
import TextBox from './shapes/TextBox';
import Frame from './shapes/Frame';
import TransformWrapper from './TransformWrapper';
import {
  findObjectAtPoint,
  findNearestAnchorGlobal,
  getClosestAnchor,
  getObjectAnchors,
  getAnchorBySide,
  getConnectedArrows,
  computeArrowEndpoints,
  type Anchor,
} from '../utils/connector.utils';

interface DrawingPreview {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

const GRID_SIZE = 50;
const ANCHOR_SNAP_RADIUS = 15;

function GridLayer({ width, height, isDark }: { width: number; height: number; isDark: boolean }) {
  const gridStroke = isDark ? '#1f2937' : '#e5e7eb';
  const lines = useMemo(() => {
    const result: React.ReactElement[] = [];
    const w = width * 3;
    const h = height * 3;
    for (let i = -w; i <= w; i += GRID_SIZE) {
      result.push(
        <Line
          key={`v-${i}`}
          points={[i, -h, i, h]}
          stroke={gridStroke}
          strokeWidth={1}
          listening={false}
        />
      );
    }
    for (let j = -h; j <= h; j += GRID_SIZE) {
      result.push(
        <Line
          key={`h-${j}`}
          points={[-w, j, w, j]}
          stroke={gridStroke}
          strokeWidth={1}
          listening={false}
        />
      );
    }
    return result;
  }, [width, height, gridStroke]);

  return <>{lines}</>;
}

interface CanvasProps {
  remoteCursors?: Map<string, CursorPosition>;
  CursorOverlayComponent?: React.ComponentType<{
    remoteCursors: Map<string, CursorPosition>;
  }>;
}

export default function Canvas({
  remoteCursors,
  CursorOverlayComponent,
}: CanvasProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const stageRef = useRef<Konva.Stage>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  const objects = useBoardObjects((s) => s.objects);
  const selectedIds = useBoardObjects((s) => s.selectedIds);
  const activeTool = useBoardObjects((s) => s.activeTool);
  const addObject = useBoardObjects((s) => s.addObjectSync);
  const updateObject = useBoardObjects((s) => s.updateObjectSync);
  const selectObject = useBoardObjects((s) => s.selectObject);
  const setSelectedIds = useBoardObjects((s) => s.setSelectedIds);
  const deselectAll = useBoardObjects((s) => s.deselectAll);
  const deleteSelected = useBoardObjects((s) => s.deleteSelectedSync);
  const setActiveTool = useBoardObjects((s) => s.setActiveTool);

  const zoom = useCanvas((s) => s.zoom);
  const panOffset = useCanvas((s) => s.panOffset);
  const setPanOffset = useCanvas((s) => s.setPanOffset);
  const zoomToPoint = useCanvas((s) => s.zoomToPoint);
  const setStageRef = useCanvas((s) => s.setStageRef);

  const [drawingPreview, setDrawingPreview] = useState<DrawingPreview | null>(null);
  const isDrawing = useRef(false);

  // Marquee (rubber-band) selection state
  const [selectionRect, setSelectionRect] = useState<{
    startX: number; startY: number; currentX: number; currentY: number;
  } | null>(null);
  const isMarqueeSelecting = useRef(false);

  // Group drag state: snapshot of all selected objects' original positions
  const groupDragOriginals = useRef<Map<string, { x: number; y: number }> | null>(null);

  // Frame drag state: objects contained in a dragged frame and their original positions
  const frameDragChildren = useRef<Map<string, { x: number; y: number }> | null>(null);
  const frameDragOrigin = useRef<{ x: number; y: number } | null>(null);

  // Pan mode: track whether currently panning for cursor style
  const [isPanning, setIsPanning] = useState(false);
  const isPanningRef = useRef(false);
  // Track whether pan was triggered by Alt hold (temporary pan)
  const altPanActive = useRef(false);
  // Track whether primary mouse button is held
  const mouseHeldRef = useRef(false);

  // Anchor hover state (select mode: show anchors on hovered shape)
  const [hoveredObjectId, setHoveredObjectId] = useState<string | null>(null);
  // Arrow drawing from anchor state
  const [arrowFromAnchor, setArrowFromAnchor] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [arrowPreviewEnd, setArrowPreviewEnd] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [snapAnchor, setSnapAnchor] = useState<Anchor | null>(null);
  const [nearestHoveredAnchor, setNearestHoveredAnchor] = useState<Anchor | null>(null);
  const [arrowTargetObjId, setArrowTargetObjId] = useState<string | null>(null);
  const isDrawingArrowFromAnchor = useRef(false);
  // Track node whose dragging was disabled during anchor-drag
  const dragDisabledNode = useRef<Konva.Node | null>(null);
  // Track arrow endpoint dragging
  const draggingEndpoint = useRef<{
    arrowId: string;
    endpoint: 'start' | 'end';
  } | null>(null);
  // Track connection IDs and anchor sides during arrow creation / endpoint drag
  const arrowStartObjRef = useRef<string | null>(null);
  const arrowEndObjRef = useRef<string | null>(null);
  const arrowStartSideRef = useRef<string | null>(null);
  const arrowEndSideRef = useRef<string | null>(null);
  const endpointSnapObjRef = useRef<string | null>(null);
  // Live visual overrides during transform. We must NOT update the Zustand store
  // during transform — it changes the `objects` prop on TransformWrapper, which
  // re-runs transformer.nodes() and resets Konva's internal rotation/scale state.
  // Instead we compute positions from live Konva nodes and store in React state.
  const [transformConnections, setTransformConnections] = useState<
    Array<{ x: number; y: number; side: string }> | null
  >(null);
  const [transformArrowEndpoints, setTransformArrowEndpoints] = useState<
    Array<{
      arrowId: string;
      startX: number; startY: number;
      endX: number; endY: number;
      startObjectId?: string; endObjectId?: string;
      startAnchorSide?: string; endAnchorSide?: string;
    }> | null
  >(null);
  const endpointSnapSideRef = useRef<string | null>(null);

  // Set stage ref on mount
  useEffect(() => {
    if (stageRef.current) {
      setStageRef(stageRef.current);
      // Expose stage ref for E2E tests (Playwright reads Konva shapes via this)
      (window as unknown as Record<string, unknown>).__KONVA_STAGE__ = stageRef.current;
    }
  }, [setStageRef]);

  // Resize handler with debounce and orientation support
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout>;
    const orientationTimers: ReturnType<typeof setTimeout>[] = [];

    const applySize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
      if (stageRef.current) {
        stageRef.current.batchDraw();
      }
    };

    const debouncedResize = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(applySize, 150);
    };

    const handleOrientationChange = () => {
      // Immediate update plus delayed updates to catch final dimensions
      applySize();
      orientationTimers.push(setTimeout(applySize, 300));
      orientationTimers.push(setTimeout(applySize, 500));
    };

    applySize();
    window.addEventListener('resize', debouncedResize);
    window.addEventListener('orientationchange', handleOrientationChange);

    const viewport = window.visualViewport;
    if (viewport) {
      viewport.addEventListener('resize', debouncedResize);
    }

    return () => {
      clearTimeout(debounceTimer);
      orientationTimers.forEach(clearTimeout);
      window.removeEventListener('resize', debouncedResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
      if (viewport) {
        viewport.removeEventListener('resize', debouncedResize);
      }
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelected();
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault();
        // Duplicate selected and select the new objects
        const state = useBoardObjects.getState();
        const newIds = new Set<string>();
        state.selectedIds.forEach((id) => {
          const obj = state.objects.get(id);
          if (obj) {
            const newObj: WhiteboardObject = {
              ...obj,
              id: uuidv4(),
              x: obj.x + 20,
              y: obj.y + 20,
              version: 1,
              updated_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
            };
            addObject(newObj);
            newIds.add(newObj.id);
          }
        });
        if (newIds.size > 0) {
          useBoardObjects.getState().setSelectedIds(newIds);
        }
      }

      // Cmd/Ctrl+C — Copy
      if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
        e.preventDefault();
        useBoardObjects.getState().copySelected();
      }

      // Cmd/Ctrl+V — Paste
      if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
        e.preventDefault();
        useBoardObjects.getState().pasteClipboard();
      }

      // Cmd/Ctrl+X — Cut (copy + delete)
      if ((e.metaKey || e.ctrlKey) && e.key === 'x') {
        e.preventDefault();
        useBoardObjects.getState().copySelected();
        deleteSelected();
      }

      if (e.key === 'Escape') {
        deselectAll();
        setActiveTool('select');
      }

      // Alt pressed while mouse is held: temporarily enter pan mode (skip if already in pan mode)
      if (e.key === 'Alt' && mouseHeldRef.current && !altPanActive.current && useBoardObjects.getState().activeTool !== 'pan') {
        altPanActive.current = true;
        isPanningRef.current = true;
        setIsPanning(true);
        setActiveTool('pan');
        deselectAll();
        const stage = stageRef.current;
        if (stage) {
          stage.startDrag();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt' && altPanActive.current) {
        altPanActive.current = false;
        // Stop any in-progress stage drag
        const stage = stageRef.current;
        if (isPanningRef.current && stage) {
          stage.stopDrag();
          setPanOffset({ x: stage.x(), y: stage.y() });
        }
        isPanningRef.current = false;
        setIsPanning(false);
        setActiveTool('select');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [deleteSelected, deselectAll, addObject, setActiveTool, setPanOffset]);

  // Zoom via wheel
  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;

      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      zoomToPoint(pointer, e.evt.deltaY);
    },
    [zoomToPoint]
  );

  const isCreationTool =
    activeTool !== 'select' && activeTool !== 'pan';

  // Helper to build a WhiteboardObject from tool type and bounds
  const buildObject = useCallback(
    (
      x: number,
      y: number,
      width: number,
      height: number
    ): WhiteboardObject | null => {
      const now = new Date().toISOString();
      const base: Omit<WhiteboardObject, 'object_type' | 'width' | 'height' | 'properties'> = {
        id: uuidv4(),
        board_id: '',
        x,
        y,
        rotation: 0,
        updated_by: '',
        updated_at: now,
        created_at: now,
        version: 1,
      };

      switch (activeTool as ObjectType) {
        case 'sticky_note':
          return {
            ...base,
            object_type: 'sticky_note',
            width: width || DEFAULT_STICKY_WIDTH,
            height: height || DEFAULT_STICKY_HEIGHT,
            properties: {
              text: '',
              noteColor:
                DEFAULT_STICKY_COLORS[
                  Math.floor(Math.random() * DEFAULT_STICKY_COLORS.length)
                ],
            },
          };
        case 'rectangle':
          return {
            ...base,
            object_type: 'rectangle',
            width: width || DEFAULT_SHAPE_WIDTH,
            height: height || DEFAULT_SHAPE_HEIGHT,
            properties: {
              fill: DEFAULT_SHAPE_COLOR,
              stroke: '#000000',
              strokeWidth: DEFAULT_STROKE_WIDTH,
            },
          };
        case 'circle':
          return {
            ...base,
            object_type: 'circle',
            width: width || DEFAULT_SHAPE_WIDTH,
            height: height || DEFAULT_SHAPE_HEIGHT,
            properties: {
              fill: DEFAULT_SHAPE_COLOR,
              stroke: '#000000',
              strokeWidth: DEFAULT_STROKE_WIDTH,
            },
          };
        case 'frame':
          return {
            ...base,
            object_type: 'frame',
            width: width || DEFAULT_FRAME_WIDTH,
            height: height || DEFAULT_FRAME_HEIGHT,
            properties: {
              title: 'Frame',
              stroke: '#94A3B8',
              strokeWidth: 2,
            },
          };
        case 'text':
          return {
            ...base,
            object_type: 'text',
            width: width || DEFAULT_TEXT_WIDTH,
            height: height || DEFAULT_TEXT_HEIGHT,
            properties: {
              text: '',
              fontSize: DEFAULT_TEXT_FONT_SIZE,
              fontFamily: DEFAULT_TEXT_FONT_FAMILY,
              color: DEFAULT_TEXT_COLOR,
              textAlign: 'center',
            },
          };
        default:
          return null;
      }
    },
    [activeTool]
  );

  // Mouse down: start drawing preview for creation tools, or anchor-snap arrow, or deselect
  const handleMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      mouseHeldRef.current = true;
      const clickedOnEmpty = e.target === e.target.getStage();

      // Alt/Opt+click: temporarily switch to pan mode
      if (e.evt.altKey && activeTool !== 'pan') {
        altPanActive.current = true;
        setActiveTool('pan');
        deselectAll();
        isPanningRef.current = true;
        setIsPanning(true);
        return;
      }

      // Pan mode: let Konva handle stage drag, do nothing else
      if (activeTool === 'pan') {
        isPanningRef.current = true;
        setIsPanning(true);
        return;
      }

      if (activeTool === 'select') {
        // Check if clicking near any anchor — start arrow from anchor
        // Skip selected objects (their edges are for resize handles)
        const stage = stageRef.current;
        if (stage) {
          const pointer = stage.getPointerPosition();
          if (pointer) {
            const pos = screenToCanvas(pointer.x, pointer.y, panOffset, zoom);
            const excludeTypes = new Set(['arrow', 'line']);
            const result = findNearestAnchorGlobal(
              objects,
              pos.x,
              pos.y,
              excludeTypes,
              ANCHOR_SNAP_RADIUS / zoom,
              selectedIds
            );
            if (result) {
              // Prevent stage from panning during anchor drag
              stage.draggable(false);
              // Prevent the clicked shape from starting its drag
              if (e.target !== stage && e.target.draggable()) {
                e.target.draggable(false);
                dragDisabledNode.current = e.target;
              }
              setArrowFromAnchor({ x: result.anchor.x, y: result.anchor.y });
              setArrowPreviewEnd({ x: result.anchor.x, y: result.anchor.y });
              isDrawingArrowFromAnchor.current = true;
              arrowStartObjRef.current = result.obj.id;
              arrowStartSideRef.current = result.anchor.side;
              arrowEndObjRef.current = null;
              arrowEndSideRef.current = null;
              return;
            }

            // Start marquee selection on empty canvas
            if (clickedOnEmpty) {
              if (!e.evt.shiftKey) deselectAll();
              stage.draggable(false);
              isMarqueeSelecting.current = true;
              setSelectionRect({
                startX: pos.x,
                startY: pos.y,
                currentX: pos.x,
                currentY: pos.y,
              });
              return;
            }
          }
        }
        if (clickedOnEmpty) deselectAll();
        return;
      }

      if (!isCreationTool) return;

      // Line tool: drag to draw (like arrow but no pointer head)
      if (activeTool === 'line') {
        const stage = stageRef.current;
        if (!stage) return;
        const pointer = stage.getPointerPosition();
        if (!pointer) return;
        const pos = screenToCanvas(pointer.x, pointer.y, panOffset, zoom);

        // Try snapping to anchor (same as arrow tool)
        const excludeTypes = new Set(['arrow', 'line']);
        const result = findNearestAnchorGlobal(
          objects, pos.x, pos.y, excludeTypes, ANCHOR_SNAP_RADIUS / zoom
        );
        const startPos = result ? { x: result.anchor.x, y: result.anchor.y } : pos;
        arrowStartObjRef.current = result?.obj.id || null;
        arrowStartSideRef.current = result?.anchor.side || null;
        arrowEndObjRef.current = null;
        arrowEndSideRef.current = null;

        isDrawing.current = true;
        setHoveredObjectId(null);
        setNearestHoveredAnchor(null);
        setDrawingPreview({
          startX: startPos.x,
          startY: startPos.y,
          currentX: startPos.x,
          currentY: startPos.y,
        });
        return;
      }

      // Arrow tool: start on empty canvas or on anchor
      if (activeTool === 'arrow') {
        const stage = stageRef.current;
        if (!stage) return;
        const pointer = stage.getPointerPosition();
        if (!pointer) return;
        const pos = screenToCanvas(pointer.x, pointer.y, panOffset, zoom);

        // Try snapping to anchor
        const excludeTypes = new Set(['arrow', 'line']);
        const result = findNearestAnchorGlobal(
          objects, pos.x, pos.y, excludeTypes, ANCHOR_SNAP_RADIUS / zoom
        );
        const startPos = result ? { x: result.anchor.x, y: result.anchor.y } : pos;
        arrowStartObjRef.current = result?.obj.id || null;
        arrowStartSideRef.current = result?.anchor.side || null;
        arrowEndObjRef.current = null;
        arrowEndSideRef.current = null;

        isDrawing.current = true;
        setHoveredObjectId(null);
        setNearestHoveredAnchor(null);
        setDrawingPreview({
          startX: startPos.x,
          startY: startPos.y,
          currentX: startPos.x,
          currentY: startPos.y,
        });
        return;
      }

      if (!clickedOnEmpty) return;

      const stage = stageRef.current;
      if (!stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const pos = screenToCanvas(pointer.x, pointer.y, panOffset, zoom);
      isDrawing.current = true;
      setDrawingPreview({
        startX: pos.x,
        startY: pos.y,
        currentX: pos.x,
        currentY: pos.y,
      });
    },
    [activeTool, isCreationTool, deselectAll, panOffset, zoom, objects, selectedIds, setActiveTool]
  );

  // Mouse move: update drawing preview, hover detection, or anchor-arrow preview
  const handleMouseMove = useCallback(
    () => {
      const stage = stageRef.current;
      if (!stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      const pos = screenToCanvas(pointer.x, pointer.y, panOffset, zoom);

      // Marquee selection drag
      if (isMarqueeSelecting.current) {
        setSelectionRect((prev) =>
          prev ? { ...prev, currentX: pos.x, currentY: pos.y } : null
        );
        return;
      }

      // Arrow endpoint drag (repositioning start or end of selected arrow)
      if (draggingEndpoint.current) {
        const { arrowId, endpoint } = draggingEndpoint.current;
        const arrow = useBoardObjects.getState().objects.get(arrowId);
        if (!arrow || !arrow.properties.points) return;

        const points = arrow.properties.points as number[];
        let newX = pos.x;
        let newY = pos.y;

        // Snap to anchors
        const excludeTypes = new Set(['arrow', 'line']);
        const snapResult = findNearestAnchorGlobal(
          objects, newX, newY, excludeTypes, ANCHOR_SNAP_RADIUS / zoom
        );
        if (snapResult) {
          newX = snapResult.anchor.x;
          newY = snapResult.anchor.y;
          setSnapAnchor(snapResult.anchor);
          endpointSnapObjRef.current = snapResult.obj.id;
          endpointSnapSideRef.current = snapResult.anchor.side;
        } else {
          setSnapAnchor(null);
          endpointSnapObjRef.current = null;
          endpointSnapSideRef.current = null;
        }

        // Show anchor marks on nearest object during endpoint drag
        const epHoverObj = findObjectAtPoint(objects, pos.x, pos.y, excludeTypes, ANCHOR_SNAP_RADIUS / zoom);
        const epTargetId = epHoverObj?.id || (snapResult ? snapResult.obj.id : null);
        setArrowTargetObjId(epTargetId);

        let updates: Partial<WhiteboardObject>;
        if (endpoint === 'start') {
          const endAbsX = arrow.x + points[2];
          const endAbsY = arrow.y + points[3];
          updates = {
            x: newX,
            y: newY,
            width: endAbsX - newX,
            height: endAbsY - newY,
            properties: { ...arrow.properties, points: [0, 0, endAbsX - newX, endAbsY - newY] },
          };
        } else {
          updates = {
            width: newX - arrow.x,
            height: newY - arrow.y,
            properties: { ...arrow.properties, points: [0, 0, newX - arrow.x, newY - arrow.y] },
          };
        }

        useBoardObjects.getState().updateObject(arrowId, updates);

        const now = Date.now();
        if (now - lastMoveRef.current >= OBJECT_SYNC_THROTTLE_MS) {
          lastMoveRef.current = now;
          broadcastToLiveChannel('object_move', {
            id: arrowId,
            updates,
            senderId: useBoardObjects.getState().userId,
          });
        }
        return;
      }

      // Arrow-from-anchor drag (started in select mode)
      if (isDrawingArrowFromAnchor.current && arrowFromAnchor) {
        // Snap to target anchor if hovering a shape
        const excludeTypes = new Set(['arrow', 'line']);
        const hoverObj = findObjectAtPoint(objects, pos.x, pos.y, excludeTypes);
        if (hoverObj) {
          setArrowTargetObjId(hoverObj.id);
          const anchor = getClosestAnchor(hoverObj, pos.x, pos.y);
          const dist = Math.sqrt((anchor.x - pos.x) ** 2 + (anchor.y - pos.y) ** 2);
          if (dist <= ANCHOR_SNAP_RADIUS / zoom) {
            setSnapAnchor(anchor);
            setArrowPreviewEnd({ x: anchor.x, y: anchor.y });
            arrowEndObjRef.current = hoverObj.id;
            arrowEndSideRef.current = anchor.side;
          } else {
            setSnapAnchor(null);
            setArrowPreviewEnd(pos);
            arrowEndObjRef.current = null;
            arrowEndSideRef.current = null;
          }
        } else {
          setArrowTargetObjId(null);
          setSnapAnchor(null);
          setArrowPreviewEnd(pos);
          arrowEndObjRef.current = null;
          arrowEndSideRef.current = null;
        }
        return;
      }

      // Select/arrow/line mode: track hovered shape for anchor marks
      // Use padding so anchors appear when cursor is near the edge
      if (activeTool === 'select' || activeTool === 'arrow' || activeTool === 'line') {
        // When not drawing, show anchor hints on hover
        if (!isDrawing.current) {
          const excludeTypes = new Set(['arrow', 'line']);
          const anchorPadding = ANCHOR_SNAP_RADIUS / zoom;
          const hoverObj = findObjectAtPoint(
            objects, pos.x, pos.y, excludeTypes, anchorPadding
          );
          setHoveredObjectId(hoverObj ? hoverObj.id : null);
          if (hoverObj) {
            const nearest = getClosestAnchor(hoverObj, pos.x, pos.y);
            setNearestHoveredAnchor(nearest);
          } else {
            setNearestHoveredAnchor(null);
          }
          if (activeTool === 'select') return;
          // For arrow/line tools, also return if not drawing
          if (!drawingPreview) return;
        }
      }

      // Line/arrow tool drawing: snap endpoint to anchor
      if ((activeTool === 'line' || activeTool === 'arrow') && isDrawing.current && drawingPreview) {
        const excludeTypes = new Set(['arrow', 'line']);
        const hoverObj = findObjectAtPoint(objects, pos.x, pos.y, excludeTypes);
        if (hoverObj) {
          setArrowTargetObjId(hoverObj.id);
          const anchor = getClosestAnchor(hoverObj, pos.x, pos.y);
          const dist = Math.sqrt((anchor.x - pos.x) ** 2 + (anchor.y - pos.y) ** 2);
          if (dist <= ANCHOR_SNAP_RADIUS / zoom) {
            arrowEndObjRef.current = hoverObj.id;
            arrowEndSideRef.current = anchor.side;
            setSnapAnchor(anchor);
            setDrawingPreview((prev) =>
              prev ? { ...prev, currentX: anchor.x, currentY: anchor.y } : null
            );
          } else {
            arrowEndObjRef.current = null;
            arrowEndSideRef.current = null;
            setSnapAnchor(null);
            setDrawingPreview((prev) =>
              prev ? { ...prev, currentX: pos.x, currentY: pos.y } : null
            );
          }
        } else {
          setArrowTargetObjId(null);
          arrowEndObjRef.current = null;
          arrowEndSideRef.current = null;
          setSnapAnchor(null);
          setDrawingPreview((prev) =>
            prev ? { ...prev, currentX: pos.x, currentY: pos.y } : null
          );
        }
        return;
      }

      // Clear hover when not in select mode
      if (hoveredObjectId) {
        setHoveredObjectId(null);
      }

      if (!isDrawing.current || !drawingPreview) return;

      setDrawingPreview((prev) =>
        prev ? { ...prev, currentX: pos.x, currentY: pos.y } : null
      );
    },
    [drawingPreview, panOffset, zoom, activeTool, objects, hoveredObjectId, arrowFromAnchor]
  );

  // Mouse up: finalize shape creation or arrow
  const handleMouseUp = useCallback(
    (e?: Konva.KonvaEventObject<MouseEvent>) => {
      mouseHeldRef.current = false;
      // Pan mode: stop panning, revert to select if Alt-triggered
      // Use ref (not state) to avoid stale closure between mousedown/mouseup
      if (isPanningRef.current) {
        isPanningRef.current = false;
        setIsPanning(false);
        if (altPanActive.current) {
          altPanActive.current = false;
          setActiveTool('select');
        }
      }

      // Marquee selection: finalize
      if (isMarqueeSelecting.current && selectionRect) {
        isMarqueeSelecting.current = false;
        const stage = stageRef.current;
        if (stage) {
          stage.draggable(activeTool === 'select' || activeTool === 'pan');
        }

        const x1 = Math.min(selectionRect.startX, selectionRect.currentX);
        const y1 = Math.min(selectionRect.startY, selectionRect.currentY);
        const x2 = Math.max(selectionRect.startX, selectionRect.currentX);
        const y2 = Math.max(selectionRect.startY, selectionRect.currentY);

        // Only apply if the drag was meaningful
        const w = x2 - x1;
        const h = y2 - y1;
        if (w > 5 || h > 5) {
          const shiftKey = e?.evt?.shiftKey ?? false;
          const newSelected = new Set<string>(
            shiftKey ? selectedIds : []
          );

          // Konva rotates shapes around (x, y) by default (no offset)
          const rotPt = (
            px: number, py: number,
            pivotX: number, pivotY: number,
            cos: number, sin: number
          ) => ({
            x: pivotX + (px - pivotX) * cos - (py - pivotY) * sin,
            y: pivotY + (px - pivotX) * sin + (py - pivotY) * cos,
          });

          objects.forEach((obj) => {
            const rot = obj.rotation || 0;
            const rad = (rot * Math.PI) / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);

            if (obj.object_type === 'arrow' || obj.object_type === 'line') {
              const points = (obj.properties.points as number[]) || [
                0, 0, obj.width, obj.height,
              ];
              let sx = obj.x + points[0];
              let sy = obj.y + points[1];
              let ex = obj.x + points[2];
              let ey = obj.y + points[3];
              if (rot !== 0) {
                const s = rotPt(sx, sy, obj.x, obj.y, cos, sin);
                const e = rotPt(ex, ey, obj.x, obj.y, cos, sin);
                sx = s.x; sy = s.y;
                ex = e.x; ey = e.y;
              }
              if (
                (sx >= x1 && sx <= x2 && sy >= y1 && sy <= y2) ||
                (ex >= x1 && ex <= x2 && ey >= y1 && ey <= y2)
              ) {
                newSelected.add(obj.id);
              }
            } else {
              let ox1 = obj.x;
              let oy1 = obj.y;
              let ox2 = obj.x + obj.width;
              let oy2 = obj.y + obj.height;
              if (rot !== 0) {
                // Circle (Ellipse) rotates around center; others around (x,y)
                const pivotX = obj.object_type === 'circle'
                  ? obj.x + obj.width / 2 : obj.x;
                const pivotY = obj.object_type === 'circle'
                  ? obj.y + obj.height / 2 : obj.y;
                const corners = [
                  { x: obj.x, y: obj.y },
                  { x: obj.x + obj.width, y: obj.y },
                  { x: obj.x + obj.width, y: obj.y + obj.height },
                  { x: obj.x, y: obj.y + obj.height },
                ].map((p) => rotPt(p.x, p.y, pivotX, pivotY, cos, sin));
                ox1 = Math.min(...corners.map((c) => c.x));
                oy1 = Math.min(...corners.map((c) => c.y));
                ox2 = Math.max(...corners.map((c) => c.x));
                oy2 = Math.max(...corners.map((c) => c.y));
              }
              if (
                ox1 < x2 &&
                ox2 > x1 &&
                oy1 < y2 &&
                oy2 > y1
              ) {
                newSelected.add(obj.id);
              }
            }
          });

          setSelectedIds(newSelected);
        }

        setSelectionRect(null);
        return;
      }

      // Arrow endpoint drag: finalize
      if (draggingEndpoint.current) {
        const { arrowId, endpoint } = draggingEndpoint.current;
        draggingEndpoint.current = null;
        setSnapAnchor(null);
        setArrowTargetObjId(null);
        if (stageRef.current) {
          stageRef.current.draggable(activeTool === 'select' || activeTool === 'pan');
        }
        const arrow = useBoardObjects.getState().objects.get(arrowId);
        if (arrow) {
          // Update connection ID and anchor side for the dragged endpoint
          const connectionProps = { ...arrow.properties };
          if (endpoint === 'start') {
            connectionProps.startObjectId = endpointSnapObjRef.current || undefined;
            connectionProps.startAnchorSide = endpointSnapSideRef.current || undefined;
          } else {
            connectionProps.endObjectId = endpointSnapObjRef.current || undefined;
            connectionProps.endAnchorSide = endpointSnapSideRef.current || undefined;
          }
          updateObject(arrowId, {
            x: arrow.x,
            y: arrow.y,
            width: arrow.width,
            height: arrow.height,
            properties: connectionProps,
            updated_at: new Date().toISOString(),
            version: (arrow.version || 0) + 1,
          });
        }
        endpointSnapObjRef.current = null;
        endpointSnapSideRef.current = null;
        return;
      }

      // Arrow-from-anchor: finalize
      if (isDrawingArrowFromAnchor.current && arrowFromAnchor && arrowPreviewEnd) {
        isDrawingArrowFromAnchor.current = false;
        // Restore stage dragging
        if (stageRef.current) {
          stageRef.current.draggable(activeTool === 'select' || activeTool === 'pan');
        }
        // Restore any disabled node dragging
        if (dragDisabledNode.current) {
          dragDisabledNode.current.draggable(true);
          dragDisabledNode.current = null;
        }
        const dx = arrowPreviewEnd.x - arrowFromAnchor.x;
        const dy = arrowPreviewEnd.y - arrowFromAnchor.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 10) {
          const now = new Date().toISOString();
          const arrowObj: WhiteboardObject = {
            id: uuidv4(),
            board_id: '',
            object_type: 'arrow',
            x: arrowFromAnchor.x,
            y: arrowFromAnchor.y,
            width: dx,
            height: dy,
            rotation: 0,
            properties: {
              stroke: '#000000',
              strokeWidth: DEFAULT_STROKE_WIDTH,
              points: [0, 0, dx, dy],
              startObjectId: arrowStartObjRef.current || undefined,
              endObjectId: arrowEndObjRef.current || undefined,
              startAnchorSide: arrowStartSideRef.current || undefined,
              endAnchorSide: arrowEndSideRef.current || undefined,
            },
            updated_by: '',
            updated_at: now,
            created_at: now,
            version: 1,
          };
          addObject(arrowObj);
          selectObject(arrowObj.id);
        }

        setArrowFromAnchor(null);
        setArrowPreviewEnd(null);
        setSnapAnchor(null);
        setArrowTargetObjId(null);
        setNearestHoveredAnchor(null);
        arrowStartObjRef.current = null;
        arrowEndObjRef.current = null;
        arrowStartSideRef.current = null;
        arrowEndSideRef.current = null;
        return;
      }

      if (!isDrawing.current || !drawingPreview) return;
      isDrawing.current = false;

      const { startX, startY, currentX, currentY } = drawingPreview;
      setDrawingPreview(null);
      setSnapAnchor(null);
      setArrowTargetObjId(null);

      const MIN_DRAG = 10;
      const w = Math.abs(currentX - startX);
      const h = Math.abs(currentY - startY);
      const useDragged = w > MIN_DRAG || h > MIN_DRAG;

      let newObj: WhiteboardObject | null;

      if (activeTool === 'line' && useDragged) {
        const now = new Date().toISOString();
        newObj = {
          id: uuidv4(),
          board_id: '',
          x: startX,
          y: startY,
          width: currentX - startX,
          height: currentY - startY,
          rotation: 0,
          object_type: 'line',
          properties: {
            stroke: DEFAULT_LINE_COLOR,
            strokeWidth: DEFAULT_LINE_WIDTH,
            points: [0, 0, currentX - startX, currentY - startY],
            startObjectId: arrowStartObjRef.current || undefined,
            endObjectId: arrowEndObjRef.current || undefined,
            startAnchorSide: arrowStartSideRef.current || undefined,
            endAnchorSide: arrowEndSideRef.current || undefined,
          },
          updated_by: '',
          updated_at: now,
          created_at: now,
          version: 1,
        };
        arrowStartObjRef.current = null;
        arrowEndObjRef.current = null;
        arrowStartSideRef.current = null;
        arrowEndSideRef.current = null;
      } else if (activeTool === 'arrow' && useDragged) {
        // Arrows use start point as origin with relative endpoint
        const now = new Date().toISOString();
        newObj = {
          id: uuidv4(),
          board_id: '',
          x: startX,
          y: startY,
          width: currentX - startX,
          height: currentY - startY,
          rotation: 0,
          object_type: 'arrow',
          properties: {
            stroke: '#000000',
            strokeWidth: DEFAULT_STROKE_WIDTH,
            points: [0, 0, currentX - startX, currentY - startY],
            startObjectId: arrowStartObjRef.current || undefined,
            endObjectId: arrowEndObjRef.current || undefined,
            startAnchorSide: arrowStartSideRef.current || undefined,
            endAnchorSide: arrowEndSideRef.current || undefined,
          },
          updated_by: '',
          updated_at: now,
          created_at: now,
          version: 1,
        };
        arrowStartObjRef.current = null;
        arrowEndObjRef.current = null;
        arrowStartSideRef.current = null;
        arrowEndSideRef.current = null;
      } else {
        const x = Math.min(startX, currentX);
        const y = Math.min(startY, currentY);
        newObj = buildObject(
          useDragged ? x : startX,
          useDragged ? y : startY,
          useDragged ? w : 0,
          useDragged ? h : 0
        );
      }

      if (newObj) {
        addObject(newObj);
        selectObject(newObj.id);
        setActiveTool('select');
      }
    },
    [drawingPreview, activeTool, buildObject, addObject, updateObject, selectObject, setSelectedIds, setActiveTool, arrowFromAnchor, arrowPreviewEnd, selectionRect, selectedIds, objects]
  );

  // Compute preview rect bounds for rendering
  const previewRect = useMemo(() => {
    if (!drawingPreview) return null;
    const { startX, startY, currentX, currentY } = drawingPreview;
    return {
      x: Math.min(startX, currentX),
      y: Math.min(startY, currentY),
      width: Math.abs(currentX - startX),
      height: Math.abs(currentY - startY),
    };
  }, [drawingPreview]);

  // Throttle ref for live object move broadcasts
  const lastMoveRef = useRef<number>(0);

  // Handle drag of shapes
  const handleDragEnd = useCallback(
    (id: string, x: number, y: number) => {
      const state = useBoardObjects.getState();
      const obj = state.objects.get(id);
      const wasGroupDrag = groupDragOriginals.current !== null;
      const frameChildren = frameDragChildren.current;

      // Reset group drag and frame drag refs
      groupDragOriginals.current = null;
      frameDragChildren.current = null;
      frameDragOrigin.current = null;

      // If an arrow/line body is dragged directly, clear its connections
      if (obj?.object_type === 'arrow' || obj?.object_type === 'line') {
        updateObject(id, {
          x,
          y,
          properties: {
            ...obj.properties,
            startObjectId: undefined,
            endObjectId: undefined,
            startAnchorSide: undefined,
            endAnchorSide: undefined,
          },
          updated_at: new Date().toISOString(),
          version: (obj.version || 0) + 1,
        });
        return;
      }

      updateObject(id, {
        x,
        y,
        updated_at: new Date().toISOString(),
        version: (obj?.version || 0) + 1,
      });

      // Persist connected arrow updates for the dragged object
      if (obj) {
        const updatedObj = { ...obj, x, y };
        const tempObjects = new Map(state.objects);
        tempObjects.set(id, updatedObj);

        const connectedArrows = getConnectedArrows(state.objects, id);
        for (const arrow of connectedArrows) {
          const result = computeArrowEndpoints(arrow, tempObjects);
          if (result) {
            updateObject(arrow.id, {
              x: result.x,
              y: result.y,
              width: result.width,
              height: result.height,
              properties: { ...arrow.properties, points: result.points },
              updated_at: new Date().toISOString(),
              version: (arrow.version || 0) + 1,
            });
          }
        }
      }

      // Persist all other group-dragged objects
      // Store positions were already updated during drag; now persist to DB
      if (wasGroupDrag) {
        const freshState = useBoardObjects.getState();
        freshState.selectedIds.forEach((otherId) => {
          if (otherId === id) return;
          const otherObj = freshState.objects.get(otherId);
          if (!otherObj) return;

          // Store already has the correct position from drag updates;
          // just persist it (updateObjectSync will broadcast + write to DB)
          updateObject(otherId, {
            x: otherObj.x,
            y: otherObj.y,
            updated_at: new Date().toISOString(),
            version: (otherObj.version || 0) + 1,
          });

          // Persist connected arrow updates for group-dragged objects
          if (otherObj.object_type !== 'arrow') {
            const latestState = useBoardObjects.getState();
            const connectedArrows = getConnectedArrows(latestState.objects, otherId);
            for (const arrow of connectedArrows) {
              const currentArrow = latestState.objects.get(arrow.id);
              if (currentArrow) {
                updateObject(arrow.id, {
                  x: currentArrow.x,
                  y: currentArrow.y,
                  width: currentArrow.width,
                  height: currentArrow.height,
                  properties: currentArrow.properties,
                  updated_at: new Date().toISOString(),
                  version: (currentArrow.version || 0) + 1,
                });
              }
            }
          }
        });
      }

      // Persist frame drag children positions
      if (frameChildren && frameChildren.size > 0) {
        const processedArrows = new Set<string>();
        frameChildren.forEach((_origPos, childId) => {
          const childObj = useBoardObjects.getState().objects.get(childId);
          if (!childObj) return;

          updateObject(childId, {
            x: childObj.x,
            y: childObj.y,
            updated_at: new Date().toISOString(),
            version: (childObj.version || 0) + 1,
          });

          // Persist connected arrow updates for frame children
          if (childObj.object_type !== 'arrow') {
            const latestState = useBoardObjects.getState();
            const connectedArrows = getConnectedArrows(latestState.objects, childId);
            for (const arrow of connectedArrows) {
              if (processedArrows.has(arrow.id)) continue;
              if (frameChildren.has(arrow.id)) continue;
              processedArrows.add(arrow.id);
              const currentArrow = latestState.objects.get(arrow.id);
              if (currentArrow) {
                updateObject(arrow.id, {
                  x: currentArrow.x,
                  y: currentArrow.y,
                  width: currentArrow.width,
                  height: currentArrow.height,
                  properties: currentArrow.properties,
                  updated_at: new Date().toISOString(),
                  version: (currentArrow.version || 0) + 1,
                });
              }
            }
          }
        });
      }
    },
    [updateObject]
  );

  // Broadcast position during drag for real-time sync (no DB write)
  const handleDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      // Only broadcast shape drags, not stage panning
      if (e.target === stageRef.current) return;

      // Clear anchor hover dots when dragging a shape
      setHoveredObjectId(null);

      const id = e.target.id();
      if (!id) return;

      const state = useBoardObjects.getState();
      const obj = state.objects.get(id);
      if (!obj) return;

      let x = e.target.x();
      let y = e.target.y();

      // Circle uses center-based positioning, convert to top-left
      if (obj.object_type === 'circle') {
        x -= obj.width / 2;
        y -= obj.height / 2;
      }

      // Group drag: move all other selected objects by the same total offset
      const isGroupDrag = state.selectedIds.has(id) && state.selectedIds.size > 1;
      if (isGroupDrag) {
        // Snapshot original positions on first frame
        if (!groupDragOriginals.current) {
          groupDragOriginals.current = new Map();
          state.selectedIds.forEach((sid) => {
            const sobj = state.objects.get(sid);
            if (sobj) {
              groupDragOriginals.current!.set(sid, { x: sobj.x, y: sobj.y });
            }
          });
        }

        // Total offset = current drag position - dragged object's original position
        const origDragged = groupDragOriginals.current.get(id);
        if (origDragged) {
          const totalDx = x - origDragged.x;
          const totalDy = y - origDragged.y;
          const stage = stageRef.current;

          // Move each other selected object to its original pos + total offset
          groupDragOriginals.current.forEach((origPos, otherId) => {
            if (otherId === id) return;
            const otherObj = state.objects.get(otherId);
            if (!otherObj) return;

            const newX = origPos.x + totalDx;
            const newY = origPos.y + totalDy;

            if (stage) {
              const node = stage.findOne('#' + otherId);
              if (node) {
                if (otherObj.object_type === 'circle') {
                  node.x(newX + otherObj.width / 2);
                  node.y(newY + otherObj.height / 2);
                } else {
                  node.x(newX);
                  node.y(newY);
                }
              }
            }

            state.updateObject(otherId, { x: newX, y: newY });
          });

          // Update connected arrows with all positions consolidated
          if (stage) {
            const consolidated = new Map(useBoardObjects.getState().objects);
            const primaryObj = consolidated.get(id);
            if (primaryObj) {
              consolidated.set(id, { ...primaryObj, x, y });
            }

            const processedArrows = new Set<string>();
            state.selectedIds.forEach((movedId) => {
              const movedObj = consolidated.get(movedId);
              if (!movedObj || movedObj.object_type === 'arrow' || movedObj.object_type === 'line') return;

              const connectedArrows = getConnectedArrows(consolidated, movedId);
              for (const arrow of connectedArrows) {
                if (processedArrows.has(arrow.id)) continue;
                processedArrows.add(arrow.id);

                const result = computeArrowEndpoints(arrow, consolidated);
                if (result) {
                  useBoardObjects.getState().updateObject(arrow.id, {
                    x: result.x,
                    y: result.y,
                    width: result.width,
                    height: result.height,
                    properties: { ...arrow.properties, points: result.points },
                  });
                  const arrowNode = stage.findOne('#' + arrow.id);
                  if (arrowNode) {
                    arrowNode.setAttrs({
                      x: result.x,
                      y: result.y,
                      points: result.points,
                    });
                  }
                }
              }
            });

            stage.batchDraw();
          }
        }
      }

      // Frame drag: move contained objects along with the frame
      if (obj.object_type === 'frame' && !isGroupDrag) {
        const stage = stageRef.current;

        // First drag frame: detect children and snapshot positions
        if (!frameDragChildren.current) {
          frameDragOrigin.current = { x: obj.x, y: obj.y };
          frameDragChildren.current = new Map();
          state.objects.forEach((child) => {
            if (child.id === id) return;
            // Check if fully inside the frame
            if (child.object_type === 'arrow' || child.object_type === 'line') {
              const points = (child.properties.points as number[]) || [0, 0, child.width, child.height];
              const sx = child.x + points[0], sy = child.y + points[1];
              const ex = child.x + points[2], ey = child.y + points[3];
              if (
                sx >= obj.x && sy >= obj.y &&
                sx <= obj.x + obj.width && sy <= obj.y + obj.height &&
                ex >= obj.x && ey >= obj.y &&
                ex <= obj.x + obj.width && ey <= obj.y + obj.height
              ) {
                frameDragChildren.current!.set(child.id, { x: child.x, y: child.y });
              }
            } else {
              if (
                child.x >= obj.x &&
                child.y >= obj.y &&
                child.x + child.width <= obj.x + obj.width &&
                child.y + child.height <= obj.y + obj.height
              ) {
                frameDragChildren.current!.set(child.id, { x: child.x, y: child.y });
              }
            }
          });
        }

        // Move children by delta from frame's original position
        if (frameDragOrigin.current && frameDragChildren.current.size > 0) {
          const dx = x - frameDragOrigin.current.x;
          const dy = y - frameDragOrigin.current.y;

          frameDragChildren.current.forEach((origPos, childId) => {
            const childObj = state.objects.get(childId);
            if (!childObj) return;

            const newX = origPos.x + dx;
            const newY = origPos.y + dy;

            state.updateObject(childId, { x: newX, y: newY });

            if (stage) {
              const node = stage.findOne('#' + childId);
              if (node) {
                if (childObj.object_type === 'circle') {
                  node.x(newX + childObj.width / 2);
                  node.y(newY + childObj.height / 2);
                } else {
                  node.x(newX);
                  node.y(newY);
                }
              }
            }
          });

          // Update connected arrows for non-arrow children
          if (stage) {
            const consolidated = new Map(useBoardObjects.getState().objects);
            const frameObj = consolidated.get(id);
            if (frameObj) consolidated.set(id, { ...frameObj, x, y });

            const processedArrows = new Set<string>();
            frameDragChildren.current.forEach((_origPos, childId) => {
              const childObj = consolidated.get(childId);
              if (!childObj || childObj.object_type === 'arrow' || childObj.object_type === 'line') return;

              const connectedArrows = getConnectedArrows(consolidated, childId);
              for (const arrow of connectedArrows) {
                if (processedArrows.has(arrow.id)) continue;
                if (frameDragChildren.current!.has(arrow.id)) continue;
                processedArrows.add(arrow.id);

                const result = computeArrowEndpoints(arrow, consolidated);
                if (result) {
                  useBoardObjects.getState().updateObject(arrow.id, {
                    x: result.x,
                    y: result.y,
                    width: result.width,
                    height: result.height,
                    properties: { ...arrow.properties, points: result.points },
                  });
                  const arrowNode = stage.findOne('#' + arrow.id);
                  if (arrowNode) {
                    arrowNode.setAttrs({
                      x: result.x,
                      y: result.y,
                      points: result.points,
                    });
                  }
                }
              }
            });

            stage.batchDraw();
          }
        }
      }

      // Update connected arrows locally every frame for smooth visuals
      // (skip during group drag and frame drag — arrows are already handled above)
      if (!isGroupDrag && obj.object_type !== 'arrow' && obj.object_type !== 'line' && obj.object_type !== 'frame') {
        const tempObj = { ...obj, x, y };
        const tempObjects = new Map(state.objects);
        tempObjects.set(id, tempObj);

        const connectedArrows = getConnectedArrows(state.objects, id);
        for (const arrow of connectedArrows) {
          const result = computeArrowEndpoints(arrow, tempObjects);
          if (result) {
            state.updateObject(arrow.id, {
              x: result.x,
              y: result.y,
              width: result.width,
              height: result.height,
              properties: { ...arrow.properties, points: result.points },
            });
          }
        }
      }

      // Throttle broadcasts
      const now = Date.now();
      if (now - lastMoveRef.current < OBJECT_SYNC_THROTTLE_MS) return;
      // eslint-disable-next-line react-hooks/immutability -- mutating ref.current is the standard React pattern
      lastMoveRef.current = now;

      // Batch all updates into a single broadcast so the remote applies
      // them in one Zustand set() — prevents tearing during group drag
      const batchUpdates: Array<{id: string; updates: Partial<WhiteboardObject>}> = [];

      batchUpdates.push({ id, updates: { x, y } });

      // Include all other group-dragged objects
      if (isGroupDrag) {
        const broadcastState = useBoardObjects.getState();
        state.selectedIds.forEach((otherId) => {
          if (otherId === id) return;
          const otherObj = broadcastState.objects.get(otherId);
          if (!otherObj) return;
          batchUpdates.push({ id: otherId, updates: { x: otherObj.x, y: otherObj.y } });
        });
      }

      // Include connected arrow positions
      const broadcastArrowState = useBoardObjects.getState();
      if (isGroupDrag) {
        const processedArrows = new Set<string>();
        state.selectedIds.forEach((movedId) => {
          const movedObj = broadcastArrowState.objects.get(movedId);
          if (!movedObj || movedObj.object_type === 'arrow' || movedObj.object_type === 'line') return;
          const connectedArrows = getConnectedArrows(broadcastArrowState.objects, movedId);
          for (const arrow of connectedArrows) {
            if (processedArrows.has(arrow.id)) continue;
            processedArrows.add(arrow.id);
            const currentArrow = broadcastArrowState.objects.get(arrow.id);
            if (currentArrow) {
              batchUpdates.push({
                id: arrow.id,
                updates: {
                  x: currentArrow.x,
                  y: currentArrow.y,
                  width: currentArrow.width,
                  height: currentArrow.height,
                  properties: currentArrow.properties,
                },
              });
            }
          }
        });
      } else if (obj.object_type !== 'arrow' && obj.object_type !== 'line') {
        const connectedArrows = getConnectedArrows(broadcastArrowState.objects, id);
        for (const arrow of connectedArrows) {
          const currentArrow = broadcastArrowState.objects.get(arrow.id);
          if (currentArrow) {
            batchUpdates.push({
              id: arrow.id,
              updates: {
                x: currentArrow.x,
                y: currentArrow.y,
                width: currentArrow.width,
                height: currentArrow.height,
                properties: currentArrow.properties,
              },
            });
          }
        }
      }

      // Include frame drag children and their connected arrows
      if (frameDragChildren.current && frameDragChildren.current.size > 0) {
        const fcState = useBoardObjects.getState();
        const processedFcArrows = new Set<string>();
        frameDragChildren.current.forEach((_origPos, childId) => {
          const childObj = fcState.objects.get(childId);
          if (!childObj) return;
          batchUpdates.push({ id: childId, updates: { x: childObj.x, y: childObj.y } });

          if (childObj.object_type !== 'arrow') {
            const connArrows = getConnectedArrows(fcState.objects, childId);
            for (const arrow of connArrows) {
              if (processedFcArrows.has(arrow.id)) continue;
              if (frameDragChildren.current!.has(arrow.id)) continue;
              processedFcArrows.add(arrow.id);
              const curArrow = fcState.objects.get(arrow.id);
              if (curArrow) {
                batchUpdates.push({
                  id: arrow.id,
                  updates: {
                    x: curArrow.x,
                    y: curArrow.y,
                    width: curArrow.width,
                    height: curArrow.height,
                    properties: curArrow.properties,
                  },
                });
              }
            }
          }
        });
      }

      broadcastToLiveChannel('object_move_batch', {
        updates: batchUpdates,
        senderId: state.userId,
      });
    },
    []
  );

  // Build a consolidated objects map for all currently transforming nodes.
  // This reads each Transformer node's live Konva attrs so arrows connecting
  // two transforming objects are computed with BOTH at their new positions.
  const buildTransformConsolidated = useCallback(() => {
    const state = useBoardObjects.getState();
    const consolidated = new Map(state.objects);
    const transformer = stageRef.current?.findOne('Transformer') as Konva.Transformer | null;
    if (!transformer) return consolidated;

    const nodes = transformer.nodes();
    for (const node of nodes) {
      const nid = node.id();
      const existing = consolidated.get(nid);
      if (!existing) continue;

      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      const patched: WhiteboardObject = {
        ...existing,
        x: existing.object_type === 'circle'
          ? node.x() - Math.max(10, node.width() * scaleX) / 2
          : node.x(),
        y: existing.object_type === 'circle'
          ? node.y() - Math.max(10, node.height() * scaleY) / 2
          : node.y(),
        width: existing.object_type === 'sticky_note'
          ? Math.max(10, existing.width * scaleX)
          : Math.max(10, node.width() * scaleX),
        height: existing.object_type === 'sticky_note'
          ? Math.max(10, existing.height * scaleY)
          : Math.max(10, node.height() * scaleY),
        rotation: node.rotation(),
      };
      consolidated.set(nid, patched);
    }
    return consolidated;
  }, []);

  // Broadcast transform state during resize/rotate for real-time sync
  const handleTransform = useCallback(
    (
      id: string,
      attrs: { x: number; y: number; width: number; height: number; rotation: number },
      scale: { scaleX: number; scaleY: number }
    ) => {
      const state = useBoardObjects.getState();
      const obj = state.objects.get(id);
      if (!obj) return;

      const updates: Partial<WhiteboardObject> = { ...attrs };

      if (obj.object_type === 'sticky_note' || obj.object_type === 'text') {
        updates.width = Math.max(10, obj.width * scale.scaleX);
        updates.height = Math.max(10, obj.height * scale.scaleY);
      }

      if (obj.object_type === 'circle') {
        updates.x = attrs.x - attrs.width / 2;
        updates.y = attrs.y - attrs.height / 2;
      }

      if ((obj.object_type === 'arrow' || obj.object_type === 'line') && obj.properties.points) {
        const oldPoints = obj.properties.points as number[];
        const newPoints = oldPoints.map((val: number, i: number) =>
          i % 2 === 0 ? val * scale.scaleX : val * scale.scaleY
        );
        updates.properties = { ...obj.properties, points: newPoints };
      }

      // Update connected arrows using consolidated positions of ALL
      // transforming objects so arrows between two resizing shapes are correct.
      // IMPORTANT: Do NOT update the Zustand store here — changing `objects`
      // triggers TransformWrapper's useEffect which re-runs transformer.nodes(),
      // resetting Konva's internal rotation/scale state and causing spin acceleration.
      // Instead we update arrow Konva nodes directly and use React state overrides
      // for the UI indicators (green circles, white square handles).
      const stage = stageRef.current;
      if (stage && obj.object_type !== 'arrow' && obj.object_type !== 'line') {
        const consolidated = buildTransformConsolidated();
        const processedArrows = new Set<string>();

        // Compute live arrow endpoint positions for UI overlays
        const liveEndpoints: Array<{
          arrowId: string;
          startX: number; startY: number;
          endX: number; endY: number;
          startObjectId?: string; endObjectId?: string;
          startAnchorSide?: string; endAnchorSide?: string;
        }> = [];

        // Process arrows for ALL selected objects (deduped)
        state.selectedIds.forEach((sid) => {
          const sobj = consolidated.get(sid);
          if (!sobj || sobj.object_type === 'arrow' || sobj.object_type === 'line') return;

          const connectedArrows = getConnectedArrows(consolidated, sid);
          for (const arrow of connectedArrows) {
            if (processedArrows.has(arrow.id)) continue;
            processedArrows.add(arrow.id);

            const result = computeArrowEndpoints(arrow, consolidated);
            if (result) {
              // Update arrow Konva node directly (no store write)
              const arrowNode = stage.findOne('#' + arrow.id);
              if (arrowNode) {
                arrowNode.setAttrs({
                  x: result.x,
                  y: result.y,
                  points: result.points,
                });
              }
              // Track for live endpoint handles if this arrow is selected
              if (state.selectedIds.has(arrow.id)) {
                liveEndpoints.push({
                  arrowId: arrow.id,
                  startX: result.x + result.points[0],
                  startY: result.y + result.points[1],
                  endX: result.x + result.points[2],
                  endY: result.y + result.points[3],
                  startObjectId: arrow.properties.startObjectId,
                  endObjectId: arrow.properties.endObjectId,
                  startAnchorSide: arrow.properties.startAnchorSide,
                  endAnchorSide: arrow.properties.endAnchorSide,
                });
              }
            }
          }
        });

        // Set live arrow endpoint overrides for white square handles
        setTransformArrowEndpoints(liveEndpoints.length > 0 ? liveEndpoints : null);

        // Compute live anchor connection indicators from consolidated positions
        const liveConns: Array<{ x: number; y: number; side: string }> = [];
        state.selectedIds.forEach((aid) => {
          const arrowObj = consolidated.get(aid);
          if (!arrowObj || arrowObj.object_type !== 'arrow') return;
          const { startObjectId, startAnchorSide, endObjectId, endAnchorSide } =
            arrowObj.properties;
          if (startObjectId && startAnchorSide) {
            const connObj = consolidated.get(startObjectId as string);
            if (connObj) {
              const anchor = getAnchorBySide(connObj, startAnchorSide as string);
              if (anchor) liveConns.push(anchor);
            }
          }
          if (endObjectId && endAnchorSide) {
            const connObj = consolidated.get(endObjectId as string);
            if (connObj) {
              const anchor = getAnchorBySide(connObj, endAnchorSide as string);
              if (anchor) liveConns.push(anchor);
            }
          }
        });
        setTransformConnections(liveConns.length > 0 ? liveConns : null);

        stage.batchDraw();
      }

      // Throttle broadcasts
      const now = Date.now();
      if (now - lastMoveRef.current < OBJECT_SYNC_THROTTLE_MS) return;
      // eslint-disable-next-line react-hooks/immutability -- mutating ref.current is the standard React pattern
      lastMoveRef.current = now;

      // Broadcast ALL transforming objects as a single batch so the remote
      // applies them in one Zustand set() — prevents tearing during group resize
      const broadcastConsolidated = buildTransformConsolidated();
      const batchUpdates: Array<{id: string; updates: Partial<WhiteboardObject>}> = [];
      const broadcastedArrows = new Set<string>();

      state.selectedIds.forEach((sid) => {
        const sobj = broadcastConsolidated.get(sid);
        if (!sobj) return;

        const objUpdates: Partial<WhiteboardObject> = {
          x: sobj.x,
          y: sobj.y,
          width: sobj.width,
          height: sobj.height,
          rotation: sobj.rotation,
        };

        if ((sobj.object_type === 'arrow' || sobj.object_type === 'line') && sobj.properties?.points) {
          objUpdates.properties = sobj.properties;
        }

        batchUpdates.push({ id: sid, updates: objUpdates });

        // Include connected arrows
        if (sobj.object_type !== 'arrow' && sobj.object_type !== 'line') {
          const connectedArrows = getConnectedArrows(broadcastConsolidated, sid);
          for (const arrow of connectedArrows) {
            if (broadcastedArrows.has(arrow.id)) continue;
            broadcastedArrows.add(arrow.id);

            const result = computeArrowEndpoints(arrow, broadcastConsolidated);
            if (result) {
              batchUpdates.push({
                id: arrow.id,
                updates: {
                  x: result.x,
                  y: result.y,
                  width: result.width,
                  height: result.height,
                  properties: { ...arrow.properties, points: result.points },
                },
              });
            }
          }
        }
      });

      broadcastToLiveChannel('object_move_batch', {
        updates: batchUpdates,
        senderId: state.userId,
      });
    },
    [buildTransformConsolidated]
  );

  // Handle text changes (final persist on blur)
  const handleTextChange = useCallback(
    (id: string, text: string) => {
      updateObject(id, {
        properties: {
          ...useBoardObjects.getState().objects.get(id)?.properties,
          text,
        },
        updated_at: new Date().toISOString(),
      });
    },
    [updateObject]
  );

  // Handle frame title changes
  const handleTitleChange = useCallback(
    (id: string, title: string) => {
      updateObject(id, {
        properties: {
          ...useBoardObjects.getState().objects.get(id)?.properties,
          title,
        },
        updated_at: new Date().toISOString(),
        version: (useBoardObjects.getState().objects.get(id)?.version || 0) + 1,
      });
    },
    [updateObject]
  );

  // Broadcast text as user types (no DB write)
  const handleTextInput = useCallback(
    (id: string, text: string) => {
      const obj = useBoardObjects.getState().objects.get(id);
      if (!obj) return;

      broadcastToLiveChannel('object_move', {
        id,
        updates: {
          properties: { ...obj.properties, text },
        },
        senderId: useBoardObjects.getState().userId,
      });
    },
    []
  );

  // Handle transform end
  const handleTransformEnd = useCallback(
    (
      id: string,
      attrs: { x: number; y: number; width: number; height: number; rotation: number },
      scale: { scaleX: number; scaleY: number }
    ) => {
      // Clear live transform visual overrides
      setTransformConnections(null);
      setTransformArrowEndpoints(null);

      const obj = useBoardObjects.getState().objects.get(id);
      if (!obj) return;

      const updates: Partial<WhiteboardObject> = {
        ...attrs,
        updated_at: new Date().toISOString(),
        version: (obj.version || 0) + 1,
      };

      // Sticky note and text use a Group — node.width()/height() returns 0
      // for Groups, so compute new dimensions from stored size x scale.
      if (obj.object_type === 'sticky_note' || obj.object_type === 'text') {
        updates.width = Math.max(10, obj.width * scale.scaleX);
        updates.height = Math.max(10, obj.height * scale.scaleY);
      }

      // Circle: Ellipse node x/y is center-based, convert to top-left
      if (obj.object_type === 'circle') {
        updates.x = attrs.x - attrs.width / 2;
        updates.y = attrs.y - attrs.height / 2;
      }

      // Line/Arrow: scale the points array to match new dimensions
      if ((obj.object_type === 'arrow' || obj.object_type === 'line') && obj.properties.points) {
        const oldPoints = obj.properties.points as number[];
        const newPoints = oldPoints.map((val: number, i: number) =>
          i % 2 === 0 ? val * scale.scaleX : val * scale.scaleY
        );
        updates.properties = { ...obj.properties, points: newPoints };
      }

      updateObject(id, updates);

      // Update connected arrows after transform
      if (obj.object_type !== 'arrow' && obj.object_type !== 'line') {
        const updatedState = useBoardObjects.getState();
        const connectedArrows = getConnectedArrows(updatedState.objects, id);
        for (const arrow of connectedArrows) {
          const result = computeArrowEndpoints(arrow, updatedState.objects);
          if (result) {
            updateObject(arrow.id, {
              x: result.x,
              y: result.y,
              width: result.width,
              height: result.height,
              properties: { ...arrow.properties, points: result.points },
              updated_at: new Date().toISOString(),
              version: (arrow.version || 0) + 1,
            });
          }
        }
      }
    },
    [updateObject]
  );

  // Handle stage drag (pan)
  const handleStageDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      if (e.target !== stageRef.current) return;
      setPanOffset({ x: e.target.x(), y: e.target.y() });
    },
    [setPanOffset]
  );

  // Viewport culling
  const viewportX = -panOffset.x / zoom;
  const viewportY = -panOffset.y / zoom;
  const visibleObjects = useMemo(() => {
    const arrows: WhiteboardObject[] = [];
    const frames: WhiteboardObject[] = [];
    const others: WhiteboardObject[] = [];
    objects.forEach((obj) => {
      if (
        isInViewport(
          obj, viewportX, viewportY, dimensions.width, dimensions.height, zoom
        )
      ) {
        // Arrows and lines render first (behind other objects) so shapes cover overlap
        if (obj.object_type === 'arrow' || obj.object_type === 'line') {
          arrows.push(obj);
        } else if (obj.object_type === 'frame') {
          // Frames render behind other shapes so contained objects stay interactive
          frames.push(obj);
        } else {
          others.push(obj);
        }
      }
    });
    return [...arrows, ...frames, ...others];
  }, [objects, viewportX, viewportY, dimensions.width, dimensions.height, zoom]);

  // Render shape based on type
  const renderObject = (obj: WhiteboardObject) => {
    const isSelected = selectedIds.has(obj.id);
    const common = {
      obj,
      isSelected,
      onSelect: selectObject,
      onDragEnd: handleDragEnd,
    };

    switch (obj.object_type) {
      case 'sticky_note':
        return (
          <StickyNote
            key={obj.id}
            {...common}
            onTextChange={handleTextChange}
            onTextInput={handleTextInput}
          />
        );
      case 'rectangle':
        return <Rectangle key={obj.id} {...common} />;
      case 'circle':
        return <CircleShape key={obj.id} {...common} />;
      case 'arrow':
        return <ArrowShape key={obj.id} {...common} />;
      case 'line':
        return <LineShape key={obj.id} {...common} />;
      case 'text':
        return (
          <TextBox
            key={obj.id}
            {...common}
            onTextChange={handleTextChange}
            onTextInput={handleTextInput}
          />
        );
      case 'frame':
        return (
          <Frame
            key={obj.id}
            {...common}
            onTitleChange={handleTitleChange}
          />
        );
      default:
        return null;
    }
  };

  // Compute hovered object anchors for select/arrow/line mode hover
  // Don't show anchors on selected objects (conflicts with resize handles)
  const hoveredAnchors = useMemo(() => {
    if (!hoveredObjectId || (activeTool !== 'select' && activeTool !== 'arrow' && activeTool !== 'line')) return null;
    if (selectedIds.has(hoveredObjectId)) return null;
    const obj = objects.get(hoveredObjectId);
    if (!obj) return null;
    return getObjectAnchors(obj);
  }, [hoveredObjectId, objects, activeTool, selectedIds]);

  // Compute target object anchors during arrow/endpoint drag
  const arrowTargetAnchors = useMemo(() => {
    if (!arrowTargetObjId) return null;
    const obj = objects.get(arrowTargetObjId);
    if (!obj) return null;
    return getObjectAnchors(obj);
  }, [arrowTargetObjId, objects]);

  // Filter out arrows/lines from transformer (they use custom handles, no bounding box)
  // Also hide transformer in pan mode so resize/rotate handles don't interfere
  const transformerSelectedIds = useMemo(() => {
    if (activeTool === 'pan') return new Set<string>();
    const filtered = new Set<string>();
    selectedIds.forEach((id) => {
      const obj = objects.get(id);
      if (obj && obj.object_type !== 'arrow' && obj.object_type !== 'line') {
        filtered.add(id);
      }
    });
    return filtered;
  }, [selectedIds, objects, activeTool]);

  // Compute selected arrow endpoints for draggable handles
  const selectedArrowEndpoints = useMemo(() => {
    if (activeTool !== 'select') return [];
    const endpoints: Array<{
      arrowId: string;
      startX: number;
      startY: number;
      endX: number;
      endY: number;
      startObjectId?: string;
      endObjectId?: string;
      startAnchorSide?: string;
      endAnchorSide?: string;
    }> = [];

    selectedIds.forEach((id) => {
      const obj = objects.get(id);
      if (obj && (obj.object_type === 'arrow' || obj.object_type === 'line')) {
        const points = (obj.properties.points as number[]) || [0, 0, obj.width, obj.height];
        const sx = obj.x + points[0];
        const sy = obj.y + points[1];
        const ex = obj.x + points[2];
        const ey = obj.y + points[3];
        endpoints.push({
          arrowId: obj.id,
          startX: sx,
          startY: sy,
          endX: ex,
          endY: ey,
          startObjectId: obj.properties.startObjectId,
          endObjectId: obj.properties.endObjectId,
          startAnchorSide: obj.properties.startAnchorSide,
          endAnchorSide: obj.properties.endAnchorSide,
        });
      }
    });

    return endpoints;
  }, [selectedIds, objects, activeTool]);

  // Compute connected object anchor indicators for selected arrows
  const selectedArrowConnections = useMemo(() => {
    const connections: Array<{ x: number; y: number; side: string }> = [];

    for (const ep of selectedArrowEndpoints) {
      if (ep.startObjectId && ep.startAnchorSide) {
        const obj = objects.get(ep.startObjectId);
        if (obj) {
          const anchor = getAnchorBySide(obj, ep.startAnchorSide);
          if (anchor) connections.push(anchor);
        }
      }
      if (ep.endObjectId && ep.endAnchorSide) {
        const obj = objects.get(ep.endObjectId);
        if (obj) {
          const anchor = getAnchorBySide(obj, ep.endAnchorSide);
          if (anchor) connections.push(anchor);
        }
      }
    }

    return connections;
  }, [selectedArrowEndpoints, objects]);

  // Touch event wrappers: delegate to existing mouse handlers with preventDefault
  // to suppress browser scroll/zoom and prevent synthetic mouse events (double-fire).
  const handleTouchStart = useCallback(
    (e: Konva.KonvaEventObject<TouchEvent>) => {
      e.evt.preventDefault();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      handleMouseDown(e as any);
    },
    [handleMouseDown]
  );

  const handleTouchMove = useCallback(
    (e: Konva.KonvaEventObject<TouchEvent>) => {
      e.evt.preventDefault();
      handleMouseMove();
    },
    [handleMouseMove]
  );

  const handleTouchEnd = useCallback(
    (e: Konva.KonvaEventObject<TouchEvent>) => {
      e.evt.preventDefault();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      handleMouseUp(e as any);
    },
    [handleMouseUp]
  );

  const cursorStyle =
    activeTool === 'pan'
      ? (isPanning ? 'grabbing' : 'grab')
      : activeTool === 'select'
        ? (isMarqueeSelecting.current ? 'crosshair' : 'default')
        : 'crosshair';

  return (
    <div
      className="relative h-screen w-screen overflow-hidden bg-gray-50 dark:bg-gray-900"
      style={{ cursor: cursorStyle, touchAction: 'none' }}
    >
      <Stage
        ref={stageRef}
        width={dimensions.width}
        height={dimensions.height}
        scaleX={zoom}
        scaleY={zoom}
        x={panOffset.x}
        y={panOffset.y}
        draggable={activeTool === 'select' || activeTool === 'pan'}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDragMove={handleDragMove}
        onDragEnd={handleStageDragEnd}
      >
        {/* Background grid layer */}
        <Layer listening={false}>
          <Rect
            x={-5000}
            y={-5000}
            width={10000}
            height={10000}
            fill={isDark ? '#111827' : '#fafafa'}
            listening={false}
          />
          <GridLayer
            width={dimensions.width}
            height={dimensions.height}
            isDark={isDark}
          />
        </Layer>

        {/* Objects layer */}
        <Layer listening={activeTool !== 'pan'}>
          {visibleObjects.map((obj) => renderObject(obj))}
        </Layer>

        {/* UI layer (selection transformer + drawing preview + anchor UI) */}
        <Layer>
          <TransformWrapper
            selectedIds={transformerSelectedIds}
            stageRef={stageRef.current}
            onTransformEnd={handleTransformEnd}
            onTransform={handleTransform}
            objects={objects}
          />
          {/* Line drawing preview */}
          {drawingPreview && activeTool === 'line' && (
            <Line
              points={[
                drawingPreview.startX,
                drawingPreview.startY,
                drawingPreview.currentX,
                drawingPreview.currentY,
              ]}
              stroke="#3B82F6"
              strokeWidth={2 / zoom}
              dash={[8 / zoom, 4 / zoom]}
              listening={false}
            />
          )}
          {/* Arrow drawing preview */}
          {drawingPreview && activeTool === 'arrow' && (
            <Arrow
              points={[
                drawingPreview.startX,
                drawingPreview.startY,
                drawingPreview.currentX,
                drawingPreview.currentY,
              ]}
              stroke="#3B82F6"
              strokeWidth={2 / zoom}
              pointerLength={10 / zoom}
              pointerWidth={8 / zoom}
              fill="#3B82F6"
              dash={[8 / zoom, 4 / zoom]}
              listening={false}
            />
          )}
          {/* Arrow preview from anchor drag (select mode) */}
          {arrowFromAnchor && arrowPreviewEnd && (
            <Arrow
              points={[
                arrowFromAnchor.x,
                arrowFromAnchor.y,
                arrowPreviewEnd.x,
                arrowPreviewEnd.y,
              ]}
              stroke="#3B82F6"
              strokeWidth={2 / zoom}
              dash={[8 / zoom, 4 / zoom]}
              pointerLength={10 / zoom}
              pointerWidth={8 / zoom}
              fill="#3B82F6"
              listening={false}
            />
          )}
          {/* Anchor X marks on hovered shape (select/arrow/line mode) */}
          {hoveredAnchors && !isDrawingArrowFromAnchor.current && !isDrawing.current && hoveredAnchors.map((a) => {
            const isNearest = nearestHoveredAnchor?.side === a.side;
            const s = 3 / zoom;
            return (
              <React.Fragment key={`anchor-${a.side}`}>
                <Line
                  points={[a.x - s, a.y - s, a.x + s, a.y + s]}
                  stroke="#64748B"
                  strokeWidth={1.5 / zoom}
                  listening={false}
                />
                <Line
                  points={[a.x - s, a.y + s, a.x + s, a.y - s]}
                  stroke="#64748B"
                  strokeWidth={1.5 / zoom}
                  listening={false}
                />
                {isNearest && (
                  <KonvaCircle
                    x={a.x}
                    y={a.y}
                    radius={7 / zoom}
                    fill="rgba(34, 197, 94, 0.3)"
                    stroke="#22C55E"
                    strokeWidth={1.5 / zoom}
                    listening={false}
                  />
                )}
              </React.Fragment>
            );
          })}
          {/* Arrow/line square handles for selected arrows */}
          {(transformArrowEndpoints ?? selectedArrowEndpoints).map(({ arrowId, startX, startY, endX, endY }) => {
            const hs = 8 / zoom;
            const hhs = hs / 2;
            return (
              <React.Fragment key={`arrow-ep-${arrowId}`}>
                {/* Start handle */}
                <Rect
                  x={startX - hhs}
                  y={startY - hhs}
                  width={hs}
                  height={hs}
                  fill="#FFFFFF"
                  stroke="#3B82F6"
                  strokeWidth={1.5 / zoom}
                  hitStrokeWidth={10 / zoom}
                  listening={true}
                  onMouseDown={(e) => {
                    e.cancelBubble = true;
                    const stage = stageRef.current;
                    if (stage) stage.draggable(false);
                    draggingEndpoint.current = { arrowId, endpoint: 'start' };
                  }}
                />
                {/* End handle */}
                <Rect
                  x={endX - hhs}
                  y={endY - hhs}
                  width={hs}
                  height={hs}
                  fill="#FFFFFF"
                  stroke="#3B82F6"
                  strokeWidth={1.5 / zoom}
                  hitStrokeWidth={10 / zoom}
                  listening={true}
                  onMouseDown={(e) => {
                    e.cancelBubble = true;
                    const stage = stageRef.current;
                    if (stage) stage.draggable(false);
                    draggingEndpoint.current = { arrowId, endpoint: 'end' };
                  }}
                />
              </React.Fragment>
            );
          })}
          {/* Connected object anchor indicators for selected arrows */}
          {(transformConnections ?? selectedArrowConnections).map((conn, i) => {
            const s = 3 / zoom;
            return (
              <React.Fragment key={`conn-anchor-${i}`}>
                <KonvaCircle
                  x={conn.x}
                  y={conn.y}
                  radius={7 / zoom}
                  fill="rgba(34, 197, 94, 0.3)"
                  stroke="#22C55E"
                  strokeWidth={1.5 / zoom}
                  listening={false}
                />
                <Line
                  points={[conn.x - s, conn.y - s, conn.x + s, conn.y + s]}
                  stroke="#22C55E"
                  strokeWidth={1.5 / zoom}
                  listening={false}
                />
                <Line
                  points={[conn.x - s, conn.y + s, conn.x + s, conn.y - s]}
                  stroke="#22C55E"
                  strokeWidth={1.5 / zoom}
                  listening={false}
                />
              </React.Fragment>
            );
          })}
          {/* Anchor X marks on target object during arrow/endpoint drag */}
          {arrowTargetAnchors && arrowTargetAnchors.map((a) => {
            const isSnapped = snapAnchor?.side === a.side;
            const s = 3 / zoom;
            return (
              <React.Fragment key={`target-anchor-${a.side}`}>
                <Line
                  points={[a.x - s, a.y - s, a.x + s, a.y + s]}
                  stroke="#64748B"
                  strokeWidth={1.5 / zoom}
                  listening={false}
                />
                <Line
                  points={[a.x - s, a.y + s, a.x + s, a.y - s]}
                  stroke="#64748B"
                  strokeWidth={1.5 / zoom}
                  listening={false}
                />
                {isSnapped && (
                  <KonvaCircle
                    x={a.x}
                    y={a.y}
                    radius={7 / zoom}
                    fill="rgba(34, 197, 94, 0.3)"
                    stroke="#22C55E"
                    strokeWidth={1.5 / zoom}
                    listening={false}
                  />
                )}
              </React.Fragment>
            );
          })}
          {previewRect && previewRect.width > 0 && previewRect.height > 0 && activeTool !== 'arrow' && activeTool !== 'line' && (
            activeTool === 'circle' ? (
              <Ellipse
                x={previewRect.x + previewRect.width / 2}
                y={previewRect.y + previewRect.height / 2}
                radiusX={previewRect.width / 2}
                radiusY={previewRect.height / 2}
                stroke="#3B82F6"
                strokeWidth={1.5 / zoom}
                dash={[6 / zoom, 4 / zoom]}
                listening={false}
              />
            ) : (
              <Rect
                x={previewRect.x}
                y={previewRect.y}
                width={previewRect.width}
                height={previewRect.height}
                stroke="#3B82F6"
                strokeWidth={1.5 / zoom}
                dash={[6 / zoom, 4 / zoom]}
                listening={false}
              />
            )
          )}
          {/* Marquee selection rectangle */}
          {selectionRect && (
            <Rect
              x={Math.min(selectionRect.startX, selectionRect.currentX)}
              y={Math.min(selectionRect.startY, selectionRect.currentY)}
              width={Math.abs(selectionRect.currentX - selectionRect.startX)}
              height={Math.abs(selectionRect.currentY - selectionRect.startY)}
              fill="rgba(59, 130, 246, 0.1)"
              stroke="#3B82F6"
              strokeWidth={1 / zoom}
              dash={[4 / zoom, 4 / zoom]}
              listening={false}
            />
          )}
        </Layer>

        {/* Cursor overlay layer */}
        {CursorOverlayComponent && remoteCursors && (
          <CursorOverlayComponent remoteCursors={remoteCursors} />
        )}
      </Stage>
    </div>
  );
}
