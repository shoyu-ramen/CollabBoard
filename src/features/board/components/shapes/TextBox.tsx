'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Group, Rect, Text } from 'react-konva';
import type Konva from 'konva';
import type { WhiteboardObject } from '../../types';
import {
  DEFAULT_TEXT_WIDTH,
  DEFAULT_TEXT_HEIGHT,
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
}

export default function TextBox({
  obj,
  isSelected,
  onSelect,
  onDragEnd,
  onTextChange,
  onTextInput,
}: TextBoxProps) {
  const textRef = useRef<Konva.Text>(null);
  const [isEditing, setIsEditing] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const text = obj.properties.text || '';
  const fontSize = obj.properties.fontSize || DEFAULT_TEXT_FONT_SIZE;
  const fontStyle = obj.properties.fontStyle || 'normal';
  const fontFamily = obj.properties.fontFamily || DEFAULT_TEXT_FONT_FAMILY;
  const color = obj.properties.color || DEFAULT_TEXT_COLOR;
  const textAlign = obj.properties.textAlign || 'center';
  const width = obj.width || DEFAULT_TEXT_WIDTH;
  const height = obj.height || DEFAULT_TEXT_HEIGHT;
  const padding = 10;

  const openEditor = () => {
    if (!onTextChange || isEditing) return;
    setIsEditing(true);

    const stage = textRef.current?.getStage();
    if (!stage) return;

    const textNode = textRef.current!;
    const transform = textNode.getAbsoluteTransform().copy();
    const attrs = transform.decompose();
    const stageContainer = stage.container();

    // Wrapper div with flex centering to match verticalAlign="middle"
    const wrapper = document.createElement('div');
    wrapperRef.current = wrapper;
    wrapper.style.position = 'absolute';
    wrapper.style.top = stageContainer.offsetTop + attrs.y + 'px';
    wrapper.style.left = stageContainer.offsetLeft + attrs.x + 'px';
    wrapper.style.width = textNode.width() * attrs.scaleX + 'px';
    wrapper.style.height = textNode.height() * attrs.scaleY + 'px';
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.justifyContent = 'center';
    wrapper.style.zIndex = '1000';
    wrapper.style.transform = `rotate(${attrs.rotation}deg)`;
    wrapper.style.transformOrigin = 'top left';

    const editable = document.createElement('div');
    editable.contentEditable = 'true';
    editable.style.width = '100%';
    editable.style.maxHeight = '100%';
    editable.style.overflow = 'hidden';
    editable.style.outline = 'none';
    editable.style.fontSize = fontSize * attrs.scaleX + 'px';
    editable.style.fontFamily = fontFamily;
    editable.style.fontWeight = fontStyle.includes('bold') ? 'bold' : 'normal';
    editable.style.fontStyle = fontStyle.includes('italic') ? 'italic' : 'normal';
    editable.style.textAlign = textAlign;
    editable.style.color = color;
    editable.style.wordBreak = 'break-word';
    editable.style.whiteSpace = 'pre-wrap';
    editable.innerText = text;

    wrapper.appendChild(editable);
    stageContainer.parentElement?.appendChild(wrapper);

    editable.focus();
    const sel = window.getSelection();
    if (sel && editable.childNodes.length > 0) {
      const range = document.createRange();
      range.selectNodeContents(editable);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }

    // Clicking the wrapper padding keeps focus on editable
    wrapper.addEventListener('mousedown', (e) => {
      if (e.target === wrapper) {
        e.preventDefault();
        editable.focus();
      }
    });

    const handleBlur = () => {
      onTextChange(obj.id, editable.innerText);
      wrapper.remove();
      wrapperRef.current = null;
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

  // Close editor when deselected
  useEffect(() => {
    if (!isSelected && isEditing && wrapperRef.current) {
      const editable = wrapperRef.current.querySelector(
        '[contenteditable]'
      ) as HTMLElement;
      if (editable) {
        editable.blur();
      }
    }
  }, [isSelected, isEditing]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wrapperRef.current) {
        wrapperRef.current.remove();
        wrapperRef.current = null;
      }
    };
  }, []);

  return (
    <Group
      id={obj.id}
      x={obj.x}
      y={obj.y}
      width={width}
      height={height}
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
      {/* Hit area — transparent, no self-drawn selection (Transformer handles it) */}
      <Rect
        width={width}
        height={height}
        fill="transparent"
      />
      {/* Text content */}
      <Text
        ref={textRef}
        x={padding}
        y={padding}
        width={width - padding * 2}
        height={height - padding * 2}
        text={text || 'Type here...'}
        fontSize={fontSize}
        fontFamily={fontFamily}
        fontStyle={fontStyle}
        align={textAlign}
        verticalAlign="middle"
        fill={text ? color : '#9CA3AF'}
        wrap="word"
        ellipsis
        visible={!isEditing}
        listening={false}
      />
    </Group>
  );
}
