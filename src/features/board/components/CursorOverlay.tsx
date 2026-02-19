'use client';

import { useRef, useEffect, useState } from 'react';
import { Layer, Group, Line, Text, Rect } from 'react-konva';
import type { CursorPosition } from '../types';

const LERP_SPEED = 0.35; // 0-1, higher = snappier. 0.35 feels smooth yet responsive
const SNAP_THRESHOLD = 0.5; // pixels — stop lerping when close enough

interface AnimatedCursor {
  // Current rendered position (lerped)
  x: number;
  y: number;
  // Target position from latest broadcast
  targetX: number;
  targetY: number;
  userName: string;
  color: string;
  userId: string;
}

function RemoteCursor({ cursor }: { cursor: AnimatedCursor }) {
  const { x, y, userName, color } = cursor;
  // SVG-style cursor arrow as Konva Line points
  const arrowPoints = [0, 0, 0, 16, 4, 12, 8, 20, 10, 19, 7, 11, 12, 11];

  return (
    <Group x={x} y={y} listening={false}>
      <Line
        points={arrowPoints}
        fill={color}
        stroke="#fff"
        strokeWidth={1}
        closed
      />
      <Group x={12} y={18}>
        <Rect
          width={userName.length * 7 + 12}
          height={20}
          fill={color}
          cornerRadius={4}
        />
        <Text
          text={userName}
          fontSize={12}
          fontFamily="sans-serif"
          fill="#fff"
          x={6}
          y={3}
        />
      </Group>
    </Group>
  );
}

interface CursorOverlayProps {
  remoteCursors: Map<string, CursorPosition>;
}

export function CursorOverlay({ remoteCursors }: CursorOverlayProps) {
  const animatedRef = useRef<Map<string, AnimatedCursor>>(new Map());
  const rafRef = useRef<number>(0);
  // Snapshot of animated cursors for rendering (avoids reading ref during render)
  const [cursors, setCursors] = useState<AnimatedCursor[]>([]);

  useEffect(() => {
    // Sync targets from incoming cursor data
    const animated = animatedRef.current;

    // Remove cursors that are no longer present
    for (const id of animated.keys()) {
      if (!remoteCursors.has(id)) {
        animated.delete(id);
      }
    }

    // Update targets (or create new animated cursors)
    for (const [id, cursor] of remoteCursors) {
      const existing = animated.get(id);
      if (existing) {
        existing.targetX = cursor.x;
        existing.targetY = cursor.y;
        existing.userName = cursor.userName;
        existing.color = cursor.color;
      } else {
        // New cursor — start at target position (no lerp on first appearance)
        animated.set(id, {
          x: cursor.x,
          y: cursor.y,
          targetX: cursor.x,
          targetY: cursor.y,
          userName: cursor.userName,
          color: cursor.color,
          userId: cursor.userId,
        });
      }
    }
  }, [remoteCursors]);

  useEffect(() => {
    let running = true;

    const tick = () => {
      if (!running) return;

      const animated = animatedRef.current;
      let needsUpdate = false;

      for (const cursor of animated.values()) {
        const dx = cursor.targetX - cursor.x;
        const dy = cursor.targetY - cursor.y;

        if (Math.abs(dx) > SNAP_THRESHOLD || Math.abs(dy) > SNAP_THRESHOLD) {
          cursor.x += dx * LERP_SPEED;
          cursor.y += dy * LERP_SPEED;
          needsUpdate = true;
        } else if (cursor.x !== cursor.targetX || cursor.y !== cursor.targetY) {
          // Snap to exact position
          cursor.x = cursor.targetX;
          cursor.y = cursor.targetY;
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        // Snapshot current positions into state for rendering
        setCursors(
          Array.from(animated.values()).map((c) => ({ ...c }))
        );
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <Layer listening={false}>
      {cursors.map((cursor) => (
        <RemoteCursor key={cursor.userId} cursor={cursor} />
      ))}
    </Layer>
  );
}
