'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Group, Rect, Text } from 'react-konva';
import type Konva from 'konva';
import type { WhiteboardObject } from '../../types';
import {
  DEFAULT_STICKY_WIDTH,
  DEFAULT_STICKY_HEIGHT,
  DEFAULT_STICKY_COLORS,
} from '@/lib/constants';

interface StickyNoteProps {
  obj: WhiteboardObject;
  isSelected: boolean;
  onSelect: (id: string, multi: boolean) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onTextChange?: (id: string, text: string) => void;
}

export default function StickyNote({
  obj,
  isSelected,
  onSelect,
  onDragEnd,
  onTextChange,
}: StickyNoteProps) {
  const textRef = useRef<Konva.Text>(null);
  const [isEditing, setIsEditing] = useState(false);

  const color =
    obj.properties.noteColor ||
    obj.properties.fill ||
    DEFAULT_STICKY_COLORS[0];
  const width = obj.width || DEFAULT_STICKY_WIDTH;
  const height = obj.height || DEFAULT_STICKY_HEIGHT;
  const text = obj.properties.text || '';
  const fontSize = obj.properties.fontSize || 16;

  useEffect(() => {
    if (textRef.current) {
      textRef.current.cache();
    }
  }, [text, width, height, fontSize]);

  const handleDblClick = () => {
    if (!onTextChange) return;
    setIsEditing(true);

    const stage = textRef.current?.getStage();
    if (!stage) return;

    const textPosition = textRef.current!.absolutePosition();
    const stageContainer = stage.container();
    const areaPosition = {
      x: stageContainer.offsetLeft + textPosition.x,
      y: stageContainer.offsetTop + textPosition.y,
    };

    const textarea = document.createElement('textarea');
    stageContainer.parentElement?.appendChild(textarea);

    const scale = stage.scaleX();
    textarea.value = text;
    textarea.style.position = 'absolute';
    textarea.style.top = areaPosition.y + 'px';
    textarea.style.left = areaPosition.x + 'px';
    textarea.style.width = (width - 20) * scale + 'px';
    textarea.style.height = (height - 20) * scale + 'px';
    textarea.style.fontSize = fontSize * scale + 'px';
    textarea.style.border = 'none';
    textarea.style.padding = '5px';
    textarea.style.margin = '0px';
    textarea.style.overflow = 'hidden';
    textarea.style.background = 'transparent';
    textarea.style.outline = 'none';
    textarea.style.resize = 'none';
    textarea.style.fontFamily = obj.properties.fontFamily || 'sans-serif';
    textarea.style.zIndex = '1000';

    textarea.focus();

    const handleBlur = () => {
      onTextChange(obj.id, textarea.value);
      textarea.remove();
      setIsEditing(false);
    };

    textarea.addEventListener('blur', handleBlur);
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        textarea.blur();
      }
    });
  };

  return (
    <Group
      id={obj.id}
      x={obj.x}
      y={obj.y}
      rotation={obj.rotation}
      draggable
      onClick={(e) => {
        onSelect(obj.id, e.evt.shiftKey);
      }}
      onTap={(e) => {
        onSelect(obj.id, false);
      }}
      onDragEnd={(e) => {
        onDragEnd(obj.id, e.target.x(), e.target.y());
      }}
      onDblClick={handleDblClick}
      onDblTap={handleDblClick}
    >
      {/* Shadow */}
      <Rect
        width={width}
        height={height}
        fill="rgba(0,0,0,0.08)"
        cornerRadius={4}
        x={3}
        y={3}
        listening={false}
      />
      {/* Note body */}
      <Rect
        width={width}
        height={height}
        fill={color}
        cornerRadius={4}
        stroke={isSelected ? '#3B82F6' : 'rgba(0,0,0,0.1)'}
        strokeWidth={isSelected ? 2 : 1}
      />
      {/* Text content */}
      <Text
        ref={textRef}
        x={10}
        y={10}
        width={width - 20}
        height={height - 20}
        text={text}
        fontSize={fontSize}
        fontFamily={obj.properties.fontFamily || 'sans-serif'}
        fill="#1a1a1a"
        wrap="word"
        ellipsis
        visible={!isEditing}
        listening={false}
      />
    </Group>
  );
}
