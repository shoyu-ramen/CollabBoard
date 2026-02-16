'use client';

import { Layer, Group, Line, Text, Rect } from 'react-konva';
import type { CursorPosition } from '../types';

interface CursorOverlayProps {
  remoteCursors: Map<string, CursorPosition>;
}

function RemoteCursor({ cursor }: { cursor: CursorPosition }) {
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

export function CursorOverlay({ remoteCursors }: CursorOverlayProps) {
  return (
    <Layer listening={false}>
      {Array.from(remoteCursors.values()).map((cursor) => (
        <RemoteCursor key={cursor.userId} cursor={cursor} />
      ))}
    </Layer>
  );
}
