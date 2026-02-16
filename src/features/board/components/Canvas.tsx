'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Rect, Line } from 'react-konva';
import type Konva from 'konva';
import { v4 as uuidv4 } from 'uuid';
import { useBoardObjects } from '../hooks/useBoardObjects';
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
} from '@/lib/constants';
import StickyNote from './shapes/StickyNote';
import Rectangle from './shapes/Rectangle';
import CircleShape from './shapes/Circle';
import LineShape from './shapes/Line';
import TextElement from './shapes/TextElement';
import TransformWrapper from './TransformWrapper';

const GRID_SIZE = 50;

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
  const addObject = useBoardObjects((s) => s.addObject);
  const updateObject = useBoardObjects((s) => s.updateObject);
  const selectObject = useBoardObjects((s) => s.selectObject);
  const deselectAll = useBoardObjects((s) => s.deselectAll);
  const deleteSelected = useBoardObjects((s) => s.deleteSelected);
  const setActiveTool = useBoardObjects((s) => s.setActiveTool);

  const zoom = useCanvas((s) => s.zoom);
  const panOffset = useCanvas((s) => s.panOffset);
  const setPanOffset = useCanvas((s) => s.setPanOffset);
  const zoomToPoint = useCanvas((s) => s.zoomToPoint);
  const setStageRef = useCanvas((s) => s.setStageRef);

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

  // Create new object on stage click
  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      // If clicked on empty canvas area
      const clickedOnEmpty = e.target === e.target.getStage();
      if (!clickedOnEmpty && activeTool === 'select') return;

      if (activeTool === 'select') {
        deselectAll();
        return;
      }

      const stage = stageRef.current;
      if (!stage) return;

      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const pos = screenToCanvas(pointer.x, pointer.y, panOffset, zoom);

      const now = new Date().toISOString();
      const base: Omit<WhiteboardObject, 'object_type' | 'width' | 'height' | 'properties'> = {
        id: uuidv4(),
        board_id: '',
        x: pos.x,
        y: pos.y,
        rotation: 0,
        updated_by: '',
        updated_at: now,
        created_at: now,
        version: 1,
      };

      let newObj: WhiteboardObject | null = null;

      switch (activeTool as ObjectType) {
        case 'sticky_note':
          newObj = {
            ...base,
            object_type: 'sticky_note',
            width: DEFAULT_STICKY_WIDTH,
            height: DEFAULT_STICKY_HEIGHT,
            properties: {
              text: '',
              noteColor:
                DEFAULT_STICKY_COLORS[
                  Math.floor(Math.random() * DEFAULT_STICKY_COLORS.length)
                ],
            },
          };
          break;
        case 'rectangle':
          newObj = {
            ...base,
            object_type: 'rectangle',
            width: DEFAULT_SHAPE_WIDTH,
            height: DEFAULT_SHAPE_HEIGHT,
            properties: {
              fill: DEFAULT_SHAPE_COLOR,
              stroke: '#000000',
              strokeWidth: DEFAULT_STROKE_WIDTH,
            },
          };
          break;
        case 'circle':
          newObj = {
            ...base,
            object_type: 'circle',
            width: DEFAULT_SHAPE_WIDTH,
            height: DEFAULT_SHAPE_HEIGHT,
            properties: {
              fill: DEFAULT_SHAPE_COLOR,
              stroke: '#000000',
              strokeWidth: DEFAULT_STROKE_WIDTH,
            },
          };
          break;
        case 'line':
          newObj = {
            ...base,
            object_type: 'line',
            width: DEFAULT_SHAPE_WIDTH,
            height: 0,
            properties: {
              stroke: '#000000',
              strokeWidth: DEFAULT_STROKE_WIDTH,
              points: [0, 0, DEFAULT_SHAPE_WIDTH, 0],
            },
          };
          break;
        case 'text':
          newObj = {
            ...base,
            object_type: 'text',
            width: 200,
            height: 30,
            properties: {
              text: 'Text',
              fontSize: 20,
              fill: '#1a1a1a',
            },
          };
          break;
      }

      if (newObj) {
        addObject(newObj);
        selectObject(newObj.id);
        setActiveTool('select');
      }
    },
    [
      activeTool,
      deselectAll,
      panOffset,
      zoom,
      addObject,
      selectObject,
      setActiveTool,
    ]
  );

  // Handle drag of shapes
  const handleDragEnd = useCallback(
    (id: string, x: number, y: number) => {
      updateObject(id, {
        x,
        y,
        updated_at: new Date().toISOString(),
        version: (useBoardObjects.getState().objects.get(id)?.version || 0) + 1,
      });
    },
    [updateObject]
  );

  // Handle text changes
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

  // Handle transform end
  const handleTransformEnd = useCallback(
    (
      id: string,
      attrs: { x: number; y: number; width: number; height: number; rotation: number }
    ) => {
      updateObject(id, {
        ...attrs,
        updated_at: new Date().toISOString(),
        version: (useBoardObjects.getState().objects.get(id)?.version || 0) + 1,
      });
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
    const result: WhiteboardObject[] = [];
    objects.forEach((obj) => {
      if (
        isInViewport(
          obj,
          viewportX,
          viewportY,
          dimensions.width,
          dimensions.height,
          zoom
        )
      ) {
        result.push(obj);
      }
    });
    return result;
  }, [objects, viewportX, viewportY, dimensions.width, dimensions.height, zoom]);

  // Render shape based on type
  const renderObject = (obj: WhiteboardObject) => {
    const isSelected = selectedIds.has(obj.id);
    const common = {
      key: obj.id,
      obj,
      isSelected,
      onSelect: selectObject,
      onDragEnd: handleDragEnd,
    };

    switch (obj.object_type) {
      case 'sticky_note':
        return (
          <StickyNote
            {...common}
            onTextChange={handleTextChange}
          />
        );
      case 'rectangle':
        return <Rectangle {...common} />;
      case 'circle':
        return <CircleShape {...common} />;
      case 'line':
        return <LineShape {...common} />;
      case 'text':
        return (
          <TextElement
            {...common}
            onTextChange={handleTextChange}
          />
        );
      default:
        return null;
    }
  };

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
        onClick={handleStageClick}
        onTap={(e) => handleStageClick(e as unknown as Konva.KonvaEventObject<MouseEvent>)}
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

        {/* UI layer (selection transformer) */}
        <Layer>
          <TransformWrapper
            selectedIds={selectedIds}
            stageRef={stageRef.current}
            onTransformEnd={handleTransformEnd}
          />
        </Layer>

        {/* Cursor overlay layer */}
        {CursorOverlayComponent && remoteCursors && (
          <CursorOverlayComponent remoteCursors={remoteCursors} />
        )}
      </Stage>
    </div>
  );
}
