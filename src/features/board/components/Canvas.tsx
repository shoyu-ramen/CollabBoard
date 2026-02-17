'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  OBJECT_SYNC_THROTTLE_MS,
} from '@/lib/constants';

import StickyNote from './shapes/StickyNote';
import Rectangle from './shapes/Rectangle';
import CircleShape from './shapes/Circle';
import ArrowShape from './shapes/Arrow';
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

function GridLayer({ width, height }: { width: number; height: number }) {
  const lines = useMemo(() => {
    const result: React.ReactElement[] = [];
    const w = width * 3;
    const h = height * 3;
    for (let i = -w; i <= w; i += GRID_SIZE) {
      result.push(
        <Line
          key={`v-${i}`}
          points={[i, -h, i, h]}
          stroke="#e5e7eb"
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
          stroke="#e5e7eb"
          strokeWidth={1}
          listening={false}
        />
      );
    }
    return result;
  }, [width, height]);

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
  const stageRef = useRef<Konva.Stage>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  const objects = useBoardObjects((s) => s.objects);
  const selectedIds = useBoardObjects((s) => s.selectedIds);
  const activeTool = useBoardObjects((s) => s.activeTool);
  const addObject = useBoardObjects((s) => s.addObjectSync);
  const updateObject = useBoardObjects((s) => s.updateObjectSync);
  const selectObject = useBoardObjects((s) => s.selectObject);
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
  const endpointSnapSideRef = useRef<string | null>(null);

  // Set stage ref on mount
  useEffect(() => {
    if (stageRef.current) {
      setStageRef(stageRef.current);
    }
  }, [setStageRef]);

  // Resize handler
  useEffect(() => {
    const updateSize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelected();
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault();
        // Duplicate selected
        const state = useBoardObjects.getState();
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
          }
        });
      }

      if (e.key === 'Escape') {
        deselectAll();
        setActiveTool('select');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteSelected, deselectAll, addObject, setActiveTool]);

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
        default:
          return null;
      }
    },
    [activeTool]
  );

  // Mouse down: start drawing preview for creation tools, or anchor-snap arrow, or deselect
  const handleMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const clickedOnEmpty = e.target === e.target.getStage();

      if (activeTool === 'select') {
        // Check if clicking near any anchor — start arrow from anchor
        // Skip selected objects (their edges are for resize handles)
        const stage = stageRef.current;
        if (stage) {
          const pointer = stage.getPointerPosition();
          if (pointer) {
            const pos = screenToCanvas(pointer.x, pointer.y, panOffset, zoom);
            const excludeTypes = new Set(['arrow']);
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
          }
        }
        if (clickedOnEmpty) deselectAll();
        return;
      }

      if (!isCreationTool) return;

      // Arrow tool: start on empty canvas or on anchor
      if (activeTool === 'arrow') {
        const stage = stageRef.current;
        if (!stage) return;
        const pointer = stage.getPointerPosition();
        if (!pointer) return;
        const pos = screenToCanvas(pointer.x, pointer.y, panOffset, zoom);

        // Try snapping to anchor
        const excludeTypes = new Set(['arrow']);
        const result = findNearestAnchorGlobal(
          objects, pos.x, pos.y, excludeTypes, ANCHOR_SNAP_RADIUS / zoom
        );
        const startPos = result ? { x: result.anchor.x, y: result.anchor.y } : pos;
        arrowStartObjRef.current = result?.obj.id || null;
        arrowStartSideRef.current = result?.anchor.side || null;
        arrowEndObjRef.current = null;
        arrowEndSideRef.current = null;

        isDrawing.current = true;
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
    [activeTool, isCreationTool, deselectAll, panOffset, zoom, objects, selectedIds]
  );

  // Mouse move: update drawing preview, hover detection, or anchor-arrow preview
  const handleMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const stage = stageRef.current;
      if (!stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      const pos = screenToCanvas(pointer.x, pointer.y, panOffset, zoom);

      // Arrow endpoint drag (repositioning start or end of selected arrow)
      if (draggingEndpoint.current) {
        const { arrowId, endpoint } = draggingEndpoint.current;
        const arrow = useBoardObjects.getState().objects.get(arrowId);
        if (!arrow || !arrow.properties.points) return;

        const points = arrow.properties.points as number[];
        let newX = pos.x;
        let newY = pos.y;

        // Snap to anchors
        const excludeTypes = new Set(['arrow']);
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
        const excludeTypes = new Set(['arrow']);
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

      // Select mode: track hovered shape for anchor marks
      // Use padding so anchors appear when cursor is near the edge
      if (activeTool === 'select') {
        const excludeTypes = new Set(['arrow']);
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
        return;
      }

      // Arrow tool drawing: snap endpoint to anchor
      if (activeTool === 'arrow' && isDrawing.current && drawingPreview) {
        const excludeTypes = new Set(['arrow']);
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
    () => {
      // Arrow endpoint drag: finalize
      if (draggingEndpoint.current) {
        const { arrowId, endpoint } = draggingEndpoint.current;
        draggingEndpoint.current = null;
        setSnapAnchor(null);
        setArrowTargetObjId(null);
        if (stageRef.current) {
          stageRef.current.draggable(activeTool === 'select');
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
          stageRef.current.draggable(activeTool === 'select');
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

      if (activeTool === 'arrow' && useDragged) {
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
    [drawingPreview, activeTool, buildObject, addObject, updateObject, selectObject, setActiveTool, arrowFromAnchor, arrowPreviewEnd, zoom]
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

      // If an arrow body is dragged directly, clear its connections
      if (obj?.object_type === 'arrow') {
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

      // Persist connected arrow updates
      if (obj) {
        const updatedState = useBoardObjects.getState();
        const connectedArrows = getConnectedArrows(updatedState.objects, id);
        for (const arrow of connectedArrows) {
          const currentArrow = updatedState.objects.get(arrow.id);
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

      // Update connected arrows locally every frame for smooth visuals
      if (obj.object_type !== 'arrow') {
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
      lastMoveRef.current = now;

      broadcastToLiveChannel('object_move', {
        id,
        updates: { x, y },
        senderId: state.userId,
      });

      // Also broadcast connected arrow positions
      if (obj.object_type !== 'arrow') {
        const updatedState = useBoardObjects.getState();
        const connectedArrows = getConnectedArrows(updatedState.objects, id);
        for (const arrow of connectedArrows) {
          const currentArrow = updatedState.objects.get(arrow.id);
          if (currentArrow) {
            broadcastToLiveChannel('object_move', {
              id: arrow.id,
              updates: {
                x: currentArrow.x,
                y: currentArrow.y,
                width: currentArrow.width,
                height: currentArrow.height,
                properties: currentArrow.properties,
              },
              senderId: state.userId,
            });
          }
        }
      }
    },
    []
  );

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

      if (obj.object_type === 'sticky_note') {
        updates.width = Math.max(10, obj.width * scale.scaleX);
        updates.height = Math.max(10, obj.height * scale.scaleY);
      }

      if (obj.object_type === 'circle') {
        updates.x = attrs.x - attrs.width / 2;
        updates.y = attrs.y - attrs.height / 2;
      }

      if (obj.object_type === 'arrow' && obj.properties.points) {
        const oldPoints = obj.properties.points as number[];
        const newPoints = oldPoints.map((val: number, i: number) =>
          i % 2 === 0 ? val * scale.scaleX : val * scale.scaleY
        );
        updates.properties = { ...obj.properties, points: newPoints };
      }

      // Update connected arrow Konva nodes imperatively (no store update)
      // to avoid React re-renders that cause jerkiness during transform.
      const stage = stageRef.current;
      if (
        stage &&
        obj.object_type !== 'arrow'
      ) {
        const tempObj = { ...obj, ...updates } as WhiteboardObject;
        const tempObjects = new Map(state.objects);
        tempObjects.set(id, tempObj);

        const connectedArrows = getConnectedArrows(state.objects, id);
        for (const arrow of connectedArrows) {
          const result = computeArrowEndpoints(arrow, tempObjects);
          if (result) {
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
        stage.batchDraw();
      }

      // Throttle broadcasts
      const now = Date.now();
      if (now - lastMoveRef.current < OBJECT_SYNC_THROTTLE_MS) return;
      lastMoveRef.current = now;

      broadcastToLiveChannel('object_move', {
        id,
        updates,
        senderId: state.userId,
      });

      // Broadcast connected arrow positions so other clients see them move
      if (
        stage &&
        obj.object_type !== 'arrow'
      ) {
        const tempObj = { ...obj, ...updates } as WhiteboardObject;
        const tempObjects = new Map(state.objects);
        tempObjects.set(id, tempObj);

        const connectedArrows = getConnectedArrows(state.objects, id);
        for (const arrow of connectedArrows) {
          const result = computeArrowEndpoints(arrow, tempObjects);
          if (result) {
            broadcastToLiveChannel('object_move', {
              id: arrow.id,
              updates: {
                x: result.x,
                y: result.y,
                width: result.width,
                height: result.height,
                properties: { ...arrow.properties, points: result.points },
              },
              senderId: state.userId,
            });
          }
        }
      }
    },
    []
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
      const obj = useBoardObjects.getState().objects.get(id);
      if (!obj) return;

      const updates: Partial<WhiteboardObject> = {
        ...attrs,
        updated_at: new Date().toISOString(),
        version: (obj.version || 0) + 1,
      };

      // Sticky note uses a Group — node.width()/height() returns 0 for
      // Groups, so compute new dimensions from stored size x scale.
      if (obj.object_type === 'sticky_note') {
        updates.width = Math.max(10, obj.width * scale.scaleX);
        updates.height = Math.max(10, obj.height * scale.scaleY);
      }

      // Circle: Ellipse node x/y is center-based, convert to top-left
      if (obj.object_type === 'circle') {
        updates.x = attrs.x - attrs.width / 2;
        updates.y = attrs.y - attrs.height / 2;
      }

      // Line/Arrow: scale the points array to match new dimensions
      if (obj.object_type === 'arrow' && obj.properties.points) {
        const oldPoints = obj.properties.points as number[];
        const newPoints = oldPoints.map((val: number, i: number) =>
          i % 2 === 0 ? val * scale.scaleX : val * scale.scaleY
        );
        updates.properties = { ...obj.properties, points: newPoints };
      }

      updateObject(id, updates);

      // Update connected arrows after transform
      if (obj.object_type !== 'arrow') {
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
    const others: WhiteboardObject[] = [];
    objects.forEach((obj) => {
      if (
        isInViewport(
          obj, viewportX, viewportY, dimensions.width, dimensions.height, zoom
        )
      ) {
        // Arrows render first (behind other objects) so shapes cover overlap
        if (obj.object_type === 'arrow') {
          arrows.push(obj);
        } else {
          others.push(obj);
        }
      }
    });
    return [...arrows, ...others];
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
      default:
        return null;
    }
  };

  // Compute hovered object anchors for select mode hover
  // Don't show anchors on selected objects (conflicts with resize handles)
  const hoveredAnchors = useMemo(() => {
    if (!hoveredObjectId || activeTool !== 'select') return null;
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
  const transformerSelectedIds = useMemo(() => {
    const filtered = new Set<string>();
    selectedIds.forEach((id) => {
      const obj = objects.get(id);
      if (obj && obj.object_type !== 'arrow') {
        filtered.add(id);
      }
    });
    return filtered;
  }, [selectedIds, objects]);

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
      if (obj && obj.object_type === 'arrow') {
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

  const cursorStyle =
    activeTool === 'select' ? 'default' : 'crosshair';

  return (
    <div
      className="relative h-screen w-screen overflow-hidden bg-gray-50"
      style={{ cursor: cursorStyle }}
    >
      <Stage
        ref={stageRef}
        width={dimensions.width}
        height={dimensions.height}
        scaleX={zoom}
        scaleY={zoom}
        x={panOffset.x}
        y={panOffset.y}
        draggable={activeTool === 'select'}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
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
            fill="#fafafa"
            listening={false}
          />
          <GridLayer
            width={dimensions.width}
            height={dimensions.height}
          />
        </Layer>

        {/* Objects layer */}
        <Layer>
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
          {/* Anchor X marks on hovered shape (select mode) */}
          {hoveredAnchors && !isDrawingArrowFromAnchor.current && hoveredAnchors.map((a) => {
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
          {selectedArrowEndpoints.map(({ arrowId, startX, startY, endX, endY }) => {
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
          {selectedArrowConnections.map((conn, i) => {
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
          {previewRect && previewRect.width > 0 && previewRect.height > 0 && activeTool !== 'arrow' && (
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
        </Layer>

        {/* Cursor overlay layer */}
        {CursorOverlayComponent && remoteCursors && (
          <CursorOverlayComponent remoteCursors={remoteCursors} />
        )}
      </Stage>
    </div>
  );
}
