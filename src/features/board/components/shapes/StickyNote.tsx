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
  onTextInput?: (id: string, text: string) => void;
}

export default function StickyNote({
  obj,
  isSelected,
  onSelect,
  onDragEnd,
  onTextChange,
  onTextInput,
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
  const fontStyle = obj.properties.fontStyle || 'normal';
  const textAlign = obj.properties.textAlign || 'center';

  useEffect(() => {
    if (textRef.current) {
      textRef.current.cache();
    }
  }, [text, width, height, fontSize, fontStyle, textAlign]);

  const handleDblClick = () => {
    if (!onTextChange) return;
    setIsEditing(true);

    const stage = textRef.current?.getStage();
    if (!stage) return;

    const textNode = textRef.current!;
    const textPosition = textNode.absolutePosition();
    const stageContainer = stage.container();
    const areaPosition = {
      x: stageContainer.offsetLeft + textPosition.x,
      y: stageContainer.offsetTop + textPosition.y,
    };

    const scale = stage.scaleX();

    // Wrapper div with flex centering to match verticalAlign="middle"
    const wrapper = document.createElement('div');
    wrapper.style.position = 'absolute';
    wrapper.style.top = areaPosition.y + 'px';
    wrapper.style.left = areaPosition.x + 'px';
    wrapper.style.width = (width - 20) * scale + 'px';
    wrapper.style.height = (height - 20) * scale + 'px';
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.justifyContent = 'center';
    wrapper.style.zIndex = '1000';

    const editable = document.createElement('div');
    editable.contentEditable = 'true';
    editable.style.width = '100%';
    editable.style.maxHeight = '100%';
    editable.style.overflow = 'hidden';
    editable.style.outline = 'none';
    editable.style.fontSize = fontSize * scale + 'px';
    editable.style.fontFamily = obj.properties.fontFamily || 'sans-serif';
    editable.style.fontWeight = fontStyle.includes('bold') ? 'bold' : 'normal';
    editable.style.fontStyle = fontStyle.includes('italic') ? 'italic' : 'normal';
    editable.style.textAlign = textAlign;
    editable.style.color = '#1a1a1a';
    editable.style.wordBreak = 'break-word';
    editable.style.whiteSpace = 'pre-wrap';
    editable.innerText = text;

    wrapper.appendChild(editable);
    stageContainer.parentElement?.appendChild(wrapper);

    // Focus and place cursor at end
    editable.focus();
    const sel = window.getSelection();
    if (sel && editable.childNodes.length > 0) {
      const range = document.createRange();
      range.selectNodeContents(editable);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }

    // Clicking the wrapper (padding area) keeps focus on editable
    wrapper.addEventListener('mousedown', (e) => {
      if (e.target === wrapper) {
        e.preventDefault();
        editable.focus();
      }
    });

    const handleBlur = () => {
      onTextChange(obj.id, editable.innerText);
      wrapper.remove();
      setIsEditing(false);
    };

    editable.addEventListener('blur', handleBlur);
    editable.addEventListener('input', () => {
      if (onTextInput) {
        onTextInput(obj.id, editable.innerText);
      }
    });
    editable.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        editable.blur();
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
      onTap={() => {
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
        fontStyle={fontStyle}
        align={textAlign}
        verticalAlign="middle"
        fill="#1a1a1a"
        wrap="word"
        ellipsis
        visible={!isEditing}
        listening={false}
      />
    </Group>
  );
}
