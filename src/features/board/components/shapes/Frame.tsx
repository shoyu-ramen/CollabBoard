'use client';

import React, { useRef, useState } from 'react';
import { Group, Rect, Text } from 'react-konva';
import type Konva from 'konva';
import type { WhiteboardObject } from '../../types';

interface FrameProps {
  obj: WhiteboardObject;
  isSelected: boolean;
  onSelect: (id: string, multi: boolean) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onTitleChange?: (id: string, title: string) => void;
}

export default function Frame({
  obj,
  isSelected,
  onSelect,
  onDragEnd,
  onTitleChange,
}: FrameProps) {
  const title = obj.properties.title || 'Frame';
  const stroke = obj.properties.stroke || '#94A3B8';
  const strokeWidth = obj.properties.strokeWidth || 2;
  const titleRef = useRef<Konva.Text>(null);
  const [isEditing, setIsEditing] = useState(false);

  const openTitleEditor = () => {
    if (!onTitleChange) return;
    setIsEditing(true);

    const stage = titleRef.current?.getStage();
    if (!stage) return;

    const textNode = titleRef.current!;
    const textPosition = textNode.absolutePosition();
    const stageContainer = stage.container();
    const areaPosition = {
      x: stageContainer.offsetLeft + textPosition.x,
      y: stageContainer.offsetTop + textPosition.y,
    };

    const scale = stage.scaleX();

    const input = document.createElement('input');
    input.type = 'text';
    input.value = title;
    input.style.position = 'absolute';
    input.style.top = areaPosition.y - 2 + 'px';
    input.style.left = areaPosition.x - 4 + 'px';
    input.style.fontSize = 14 * scale + 'px';
    input.style.fontFamily = 'sans-serif';
    input.style.fontWeight = 'bold';
    input.style.color = '#64748B';
    input.style.border = '2px solid #3B82F6';
    input.style.borderRadius = '2px';
    input.style.padding = '1px 4px';
    input.style.outline = 'none';
    input.style.background = 'white';
    input.style.zIndex = '1000';
    input.style.minWidth = '60px';

    stageContainer.parentElement?.appendChild(input);

    input.focus();
    input.select();

    const handleBlur = () => {
      const newTitle = input.value.trim() || 'Frame';
      onTitleChange(obj.id, newTitle);
      input.remove();
      setIsEditing(false);
    };

    input.addEventListener('blur', handleBlur);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        input.blur();
      }
      if (e.key === 'Escape') {
        input.value = title;
        input.blur();
      }
    });
  };

  return (
    <Group
      id={obj.id}
      x={obj.x}
      y={obj.y}
      width={obj.width}
      height={obj.height}
      rotation={obj.rotation}
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
    >
      <Rect
        width={obj.width}
        height={obj.height}
        fill="rgba(241, 245, 249, 0.5)"
        stroke={isSelected ? '#3B82F6' : stroke}
        strokeWidth={isSelected ? strokeWidth + 1 : strokeWidth}
        dash={isSelected ? undefined : [8, 4]}
        cornerRadius={4}
      />
      <Text
        ref={titleRef}
        x={8}
        y={-20}
        text={title}
        fontSize={14}
        fontFamily="sans-serif"
        fontStyle="bold"
        fill="#64748B"
        visible={!isEditing}
        listening={true}
        onDblClick={openTitleEditor}
        onDblTap={openTitleEditor}
      />
    </Group>
  );
}
