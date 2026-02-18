'use client';

import React, { useRef, useState } from 'react';
import { Group, Text } from 'react-konva';
import type Konva from 'konva';
import type { WhiteboardObject } from '../../types';
import {
  DEFAULT_TEXT_FONT_SIZE,
  DEFAULT_TEXT_COLOR,
  DEFAULT_TEXT_FONT_FAMILY,
} from '@/lib/constants';

interface TextBoxProps {
  obj: WhiteboardObject;
  isSelected: boolean;
  onSelect: (id: string, multi: boolean) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onTextChange?: (id: string, text: string) => void;
  onTextInput?: (id: string, text: string) => void;
  autoEdit?: boolean;
}

export default function TextBox({
  obj,
  isSelected,
  onSelect,
  onDragEnd,
  onTextChange,
  onTextInput,
  autoEdit,
}: TextBoxProps) {
  const textRef = useRef<Konva.Text>(null);
  const [isEditing, setIsEditing] = useState(false);
  const autoEditTriggered = useRef(false);

  const text = obj.properties.text || '';
  const fontSize = obj.properties.fontSize || DEFAULT_TEXT_FONT_SIZE;
  const fontStyle = obj.properties.fontStyle || 'normal';
  const fontFamily = obj.properties.fontFamily || DEFAULT_TEXT_FONT_FAMILY;
  const color = obj.properties.color || DEFAULT_TEXT_COLOR;
  const textAlign = obj.properties.textAlign || 'left';

  const openEditor = () => {
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

    const editable = document.createElement('div');
    editable.contentEditable = 'true';
    editable.style.position = 'absolute';
    editable.style.top = areaPosition.y + 'px';
    editable.style.left = areaPosition.x + 'px';
    editable.style.minWidth = '60px';
    editable.style.maxWidth = '600px';
    editable.style.outline = 'none';
    editable.style.fontSize = fontSize * scale + 'px';
    editable.style.fontFamily = fontFamily;
    editable.style.fontWeight = fontStyle.includes('bold') ? 'bold' : 'normal';
    editable.style.fontStyle = fontStyle.includes('italic') ? 'italic' : 'normal';
    editable.style.textAlign = textAlign;
    editable.style.color = color;
    editable.style.wordBreak = 'break-word';
    editable.style.whiteSpace = 'pre-wrap';
    editable.style.zIndex = '1000';
    editable.style.background = 'transparent';
    editable.style.border = '2px solid #3B82F6';
    editable.style.borderRadius = '2px';
    editable.style.padding = '2px 4px';
    editable.innerText = text;

    stageContainer.parentElement?.appendChild(editable);

    editable.focus();
    const sel = window.getSelection();
    if (sel && editable.childNodes.length > 0) {
      const range = document.createRange();
      range.selectNodeContents(editable);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }

    const handleBlur = () => {
      const newText = editable.innerText;
      onTextChange(obj.id, newText);
      editable.remove();
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

  // Auto-enter edit mode for newly created text objects
  React.useEffect(() => {
    if (autoEdit && !autoEditTriggered.current) {
      autoEditTriggered.current = true;
      // Small delay to let the Konva node mount
      requestAnimationFrame(() => openEditor());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoEdit]);

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
      onDblClick={openEditor}
      onDblTap={openEditor}
    >
      {/* Selection highlight */}
      {isSelected && (
        <Text
          text={text || 'Type here...'}
          fontSize={fontSize}
          fontFamily={fontFamily}
          fontStyle={fontStyle}
          align={textAlign}
          fill="transparent"
          stroke="#3B82F6"
          strokeWidth={0.5}
          listening={false}
        />
      )}
      <Text
        ref={textRef}
        text={text || 'Type here...'}
        fontSize={fontSize}
        fontFamily={fontFamily}
        fontStyle={fontStyle}
        align={textAlign}
        fill={text ? color : '#9CA3AF'}
        wrap="word"
        visible={!isEditing}
        listening={false}
      />
    </Group>
  );
}
