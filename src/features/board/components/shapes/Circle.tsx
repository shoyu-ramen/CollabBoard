'use client';

import React from 'react';
import { Ellipse } from 'react-konva';
import type { WhiteboardObject } from '../../types';
import {
  DEFAULT_SHAPE_COLOR,
  DEFAULT_STROKE_WIDTH,
} from '@/lib/constants';

interface CircleProps {
  obj: WhiteboardObject;
  isSelected: boolean;
  onSelect: (id: string, multi: boolean) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
}

export default function CircleShape({
  obj,
  isSelected,
  onSelect,
  onDragEnd,
}: CircleProps) {
  const fill = obj.properties.fill || DEFAULT_SHAPE_COLOR;
  const stroke = obj.properties.stroke || '#000000';
  const strokeWidth = obj.properties.strokeWidth || DEFAULT_STROKE_WIDTH;

  return (
    <Ellipse
      id={obj.id}
      x={obj.x + obj.width / 2}
      y={obj.y + obj.height / 2}
      radiusX={obj.width / 2}
      radiusY={obj.height / 2}
      rotation={obj.rotation}
      fill={fill}
      stroke={isSelected ? '#3B82F6' : stroke}
      strokeWidth={isSelected ? strokeWidth + 1 : strokeWidth}
      draggable
      onClick={(e) => {
        onSelect(obj.id, e.evt.shiftKey);
      }}
      onTap={() => {
        onSelect(obj.id, false);
      }}
      onDragEnd={(e) => {
        // Ellipse position is center-based, convert back to top-left
        onDragEnd(
          obj.id,
          e.target.x() - obj.width / 2,
          e.target.y() - obj.height / 2
        );
      }}
    />
  );
}
