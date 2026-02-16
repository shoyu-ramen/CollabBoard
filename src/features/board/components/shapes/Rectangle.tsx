'use client';

import React from 'react';
import { Rect } from 'react-konva';
import type { WhiteboardObject } from '../../types';
import {
  DEFAULT_SHAPE_COLOR,
  DEFAULT_STROKE_WIDTH,
} from '@/lib/constants';

interface RectangleProps {
  obj: WhiteboardObject;
  isSelected: boolean;
  onSelect: (id: string, multi: boolean) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
}

export default function Rectangle({
  obj,
  isSelected,
  onSelect,
  onDragEnd,
}: RectangleProps) {
  const fill = obj.properties.fill || DEFAULT_SHAPE_COLOR;
  const stroke = obj.properties.stroke || '#000000';
  const strokeWidth = obj.properties.strokeWidth || DEFAULT_STROKE_WIDTH;

  return (
    <Rect
      id={obj.id}
      x={obj.x}
      y={obj.y}
      width={obj.width}
      height={obj.height}
      rotation={obj.rotation}
      fill={fill}
      stroke={isSelected ? '#3B82F6' : stroke}
      strokeWidth={isSelected ? strokeWidth + 1 : strokeWidth}
      cornerRadius={2}
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
