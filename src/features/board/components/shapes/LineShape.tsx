'use client';

import React from 'react';
import { Line } from 'react-konva';
import type { WhiteboardObject } from '../../types';
import { DEFAULT_LINE_WIDTH } from '@/lib/constants';

interface LineShapeProps {
  obj: WhiteboardObject;
  isSelected: boolean;
  onSelect: (id: string, multi: boolean) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
}

export default function LineShape({
  obj,
  isSelected,
  onSelect,
  onDragEnd,
}: LineShapeProps) {
  const stroke = obj.properties.stroke || '#000000';
  const strokeWidth = obj.properties.strokeWidth || DEFAULT_LINE_WIDTH;
  const points = obj.properties.points || [0, 0, obj.width, obj.height];
  const lineStyle = obj.properties.lineStyle || 'solid';
  const dash =
    lineStyle === 'dashed'
      ? [10, 5]
      : lineStyle === 'dotted'
        ? [3, 4]
        : undefined;

  return (
    <Line
      id={obj.id}
      x={obj.x}
      y={obj.y}
      points={points}
      stroke={isSelected ? '#3B82F6' : stroke}
      strokeWidth={isSelected ? strokeWidth + 1 : strokeWidth}
      dash={dash}
      hitStrokeWidth={10}
      draggable
      onClick={(e) => {
        onSelect(obj.id, e.evt.shiftKey);
      }}
      onTap={() => {
        onSelect(obj.id, false);
      }}
      onDragEnd={(e) => {
        onDragEnd(obj.id, e.target.x(), e.target.y());
      }}
    />
  );
}
