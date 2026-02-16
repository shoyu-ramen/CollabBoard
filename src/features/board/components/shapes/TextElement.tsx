'use client';

import React, { useRef, useState } from 'react';
import { Text } from 'react-konva';
import type Konva from 'konva';
import type { WhiteboardObject } from '../../types';

interface TextElementProps {
  obj: WhiteboardObject;
  isSelected: boolean;
  onSelect: (id: string, multi: boolean) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onTextChange?: (id: string, text: string) => void;
}

export default function TextElement({
  obj,
  isSelected,
  onSelect,
  onDragEnd,
  onTextChange,
}: TextElementProps) {
  const textRef = useRef<Konva.Text>(null);
  const [isEditing, setIsEditing] = useState(false);

  const text = obj.properties.text || 'Text';
  const fontSize = obj.properties.fontSize || 20;
  const fill = obj.properties.fill || obj.properties.color || '#1a1a1a';

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

    const scale = stage.scaleX();
    const textarea = document.createElement('textarea');
    stageContainer.parentElement?.appendChild(textarea);

    textarea.value = text;
    textarea.style.position = 'absolute';
    textarea.style.top = areaPosition.y + 'px';
    textarea.style.left = areaPosition.x + 'px';
    textarea.style.width = (obj.width || 200) * scale + 'px';
    textarea.style.fontSize = fontSize * scale + 'px';
    textarea.style.border = 'none';
    textarea.style.padding = '0px';
    textarea.style.margin = '0px';
    textarea.style.overflow = 'hidden';
    textarea.style.background = 'transparent';
    textarea.style.outline = 'none';
    textarea.style.resize = 'none';
    textarea.style.color = fill;
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
    <Text
      ref={textRef}
      id={obj.id}
      x={obj.x}
      y={obj.y}
      width={obj.width || undefined}
      height={obj.height || undefined}
      rotation={obj.rotation}
      text={text}
      fontSize={fontSize}
      fontFamily={obj.properties.fontFamily || 'sans-serif'}
      fill={fill}
      draggable
      visible={!isEditing}
      onClick={(e) => {
        onSelect(obj.id, e.evt.shiftKey);
      }}
      onTap={() => {
        onSelect(obj.id, false);
      }}
      onDragEnd={(e) => {
        onDragEnd(obj.id, e.target.x(), e.target.y());
      }}
      onDblClick={handleDblClick}
      onDblTap={handleDblClick}
    />
  );
}
