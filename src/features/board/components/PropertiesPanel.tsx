'use client';

import React, { useCallback, useEffect, useMemo } from 'react';
import { useBoardObjects } from '../hooks/useBoardObjects';
import type { WhiteboardObject, ObjectProperties } from '../types';

const FILL_PRESETS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B',
  '#8B5CF6', '#EC4899', '#06B6D4', '#F97316',
  '#1a1a1a', '#6B7280', '#FFFFFF', 'transparent',
];

const STROKE_PRESETS = [
  '#000000', '#3B82F6', '#EF4444', '#10B981',
  '#F59E0B', '#8B5CF6', '#EC4899', '#6B7280',
];

const NOTE_COLOR_PRESETS = [
  '#FEF08A', '#BBF7D0', '#BFDBFE', '#FBCFE8',
  '#FED7AA', '#E9D5FF', '#FECACA', '#E0E7FF',
];

const STROKE_WIDTHS = [1, 2, 3, 4, 6, 8];
const FONT_SIZES = [12, 14, 16, 20, 24, 32];

type LineStyleOption = 'solid' | 'dashed' | 'dotted' | 'arrow';

function ColorSwatch({
  color,
  isActive,
  onClick,
}: {
  color: string;
  isActive: boolean;
  onClick: () => void;
}) {
  const isTransparent = color === 'transparent';
  return (
    <button
      onClick={onClick}
      className={`h-6 w-6 rounded border-2 transition-all ${
        isActive
          ? 'border-blue-500 scale-110'
          : 'border-gray-200 hover:border-gray-400'
      }`}
      style={{
        backgroundColor: isTransparent ? undefined : color,
      }}
      title={color}
    >
      {isTransparent && (
        <svg viewBox="0 0 24 24" className="h-full w-full text-red-400">
          <line
            x1="4"
            y1="4"
            x2="20"
            y2="20"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      )}
    </button>
  );
}

export default function PropertiesPanel() {
  const objects = useBoardObjects((s) => s.objects);
  const selectedIds = useBoardObjects((s) => s.selectedIds);
  const updateObject = useBoardObjects((s) => s.updateObjectSync);

  const selectedObjects = useMemo(() => {
    const result: WhiteboardObject[] = [];
    selectedIds.forEach((id) => {
      const obj = objects.get(id);
      if (obj) result.push(obj);
    });
    return result;
  }, [objects, selectedIds]);

  const updateProperties = useCallback(
    (propUpdates: Partial<ObjectProperties>) => {
      selectedObjects.forEach((obj) => {
        updateObject(obj.id, {
          properties: { ...obj.properties, ...propUpdates },
          updated_at: new Date().toISOString(),
          version: (obj.version || 0) + 1,
        });
      });
    },
    [selectedObjects, updateObject]
  );

  const first = selectedObjects.length > 0 ? selectedObjects[0] : null;
  const objectType = first?.object_type;
  const isNote = objectType === 'sticky_note';
  const isMixed =
    selectedObjects.length > 1 &&
    selectedObjects.some((o) => o.object_type !== objectType);

  const currentFontStyle = first?.properties.fontStyle || 'normal';
  const isBold = currentFontStyle.includes('bold');
  const isItalic = currentFontStyle.includes('italic');

  const toggleBold = useCallback(() => {
    let newStyle: ObjectProperties['fontStyle'];
    if (isBold) {
      newStyle = isItalic ? 'italic' : 'normal';
    } else {
      newStyle = isItalic ? 'bold italic' : 'bold';
    }
    updateProperties({ fontStyle: newStyle });
  }, [isBold, isItalic, updateProperties]);

  const toggleItalic = useCallback(() => {
    let newStyle: ObjectProperties['fontStyle'];
    if (isItalic) {
      newStyle = isBold ? 'bold' : 'normal';
    } else {
      newStyle = isBold ? 'bold italic' : 'italic';
    }
    updateProperties({ fontStyle: newStyle });
  }, [isBold, isItalic, updateProperties]);

  // Keyboard shortcuts for bold/italic
  useEffect(() => {
    if (!isNote || isMixed) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLInputElement
      ) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        toggleBold();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
        e.preventDefault();
        toggleItalic();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isNote, isMixed, toggleBold, toggleItalic]);

  if (!first) return null;

  const hasFill =
    objectType === 'rectangle' ||
    objectType === 'circle' ||
    objectType === 'sticky_note';
  const hasStroke =
    objectType === 'rectangle' ||
    objectType === 'circle' ||
    objectType === 'arrow';
  const hasStrokeWidth = hasStroke;
  const hasStrokeStyle = hasStroke;
  const isArrow = objectType === 'arrow';

  const currentFill = first.properties.fill || '#3B82F6';
  const currentStroke = first.properties.stroke || '#000000';
  const currentStrokeWidth = first.properties.strokeWidth || 2;
  const currentNoteColor = first.properties.noteColor || '#FEF08A';
  const currentLineStyle: LineStyleOption =
    (first.properties.lineStyle as LineStyleOption) || (isArrow ? 'arrow' : 'solid');
  const currentFontSize = first.properties.fontSize || 16;

  return (
    <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-52 rounded-xl bg-white shadow-lg border border-gray-200 p-3 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          {isMixed
            ? `${selectedObjects.length} objects`
            : selectedObjects.length > 1
              ? `${selectedObjects.length} ${objectType}s`
              : objectType!.replace('_', ' ')}
        </span>
      </div>

      {/* Note color (sticky notes) */}
      {isNote && !isMixed && (
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">
            Note Color
          </label>
          <div className="flex flex-wrap gap-1.5">
            {NOTE_COLOR_PRESETS.map((c) => (
              <ColorSwatch
                key={c}
                color={c}
                isActive={currentNoteColor === c}
                onClick={() => updateProperties({ noteColor: c })}
              />
            ))}
          </div>
        </div>
      )}

      {/* Font size (sticky notes) */}
      {isNote && !isMixed && (
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">
            Font Size
          </label>
          <div className="flex gap-1">
            {FONT_SIZES.map((s) => (
              <button
                key={s}
                onClick={() => updateProperties({ fontSize: s })}
                className={`flex h-7 w-7 items-center justify-center rounded text-xs font-medium transition-colors ${
                  currentFontSize === s
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Font style (sticky notes) */}
      {isNote && !isMixed && (
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">
            Style
          </label>
          <div className="flex gap-1">
            <button
              onClick={toggleBold}
              title="Bold (Cmd+B)"
              className={`flex h-7 flex-1 items-center justify-center rounded text-xs font-bold transition-colors ${
                isBold
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              B
            </button>
            <button
              onClick={toggleItalic}
              title="Italic (Cmd+I)"
              className={`flex h-7 flex-1 items-center justify-center rounded text-xs italic transition-colors ${
                isItalic
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              I
            </button>
          </div>
        </div>
      )}

      {/* Fill color */}
      {(hasFill && !isNote && !isMixed) && (
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">
            Fill
          </label>
          <div className="flex flex-wrap gap-1.5">
            {FILL_PRESETS.map((c) => (
              <ColorSwatch
                key={c}
                color={c}
                isActive={currentFill === c}
                onClick={() => updateProperties({ fill: c })}
              />
            ))}
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              type="color"
              value={
                currentFill === 'transparent' ? '#ffffff' : currentFill
              }
              onChange={(e) => updateProperties({ fill: e.target.value })}
              className="h-6 w-6 cursor-pointer rounded border border-gray-200 p-0"
            />
            <span className="text-xs text-gray-400">Custom</span>
          </div>
        </div>
      )}

      {/* Stroke color */}
      {(hasStroke && !isMixed) && (
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">
            Border Color
          </label>
          <div className="flex flex-wrap gap-1.5">
            {STROKE_PRESETS.map((c) => (
              <ColorSwatch
                key={c}
                color={c}
                isActive={currentStroke === c}
                onClick={() => updateProperties({ stroke: c })}
              />
            ))}
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              type="color"
              value={currentStroke}
              onChange={(e) =>
                updateProperties({ stroke: e.target.value })
              }
              className="h-6 w-6 cursor-pointer rounded border border-gray-200 p-0"
            />
            <span className="text-xs text-gray-400">Custom</span>
          </div>
        </div>
      )}

      {/* Stroke width */}
      {hasStrokeWidth && !isMixed && (
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">
            Border Width
          </label>
          <div className="flex gap-1">
            {STROKE_WIDTHS.map((w) => (
              <button
                key={w}
                onClick={() => updateProperties({ strokeWidth: w })}
                className={`flex h-7 w-7 items-center justify-center rounded text-xs font-medium transition-colors ${
                  currentStrokeWidth === w
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {w}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Border style */}
      {hasStrokeStyle && !isMixed && (
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">
            {isArrow ? 'Line Style' : 'Border Style'}
          </label>
          <div className="flex gap-1">
            {(
              isArrow
                ? (['solid', 'dashed', 'dotted', 'arrow'] as LineStyleOption[])
                : (['solid', 'dashed', 'dotted'] as LineStyleOption[])
            ).map((style) => (
              <button
                key={style}
                onClick={() => updateProperties({ lineStyle: style })}
                className={`flex h-7 flex-1 items-center justify-center rounded text-xs transition-colors ${
                  currentLineStyle === style
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {style === 'solid' && (
                  <svg width="28" height="2" viewBox="0 0 28 2">
                    <line
                      x1="0"
                      y1="1"
                      x2="28"
                      y2="1"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                  </svg>
                )}
                {style === 'dashed' && (
                  <svg width="28" height="2" viewBox="0 0 28 2">
                    <line
                      x1="0"
                      y1="1"
                      x2="28"
                      y2="1"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeDasharray="6 3"
                    />
                  </svg>
                )}
                {style === 'dotted' && (
                  <svg width="28" height="2" viewBox="0 0 28 2">
                    <line
                      x1="0"
                      y1="1"
                      x2="28"
                      y2="1"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeDasharray="2 3"
                    />
                  </svg>
                )}
                {style === 'arrow' && (
                  <svg width="28" height="10" viewBox="0 0 28 10">
                    <line
                      x1="0"
                      y1="5"
                      x2="22"
                      y2="5"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                    <polygon
                      points="20,1 28,5 20,9"
                      fill="currentColor"
                    />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Mixed selection: show fill/stroke for all */}
      {isMixed && (
        <>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">
              Fill
            </label>
            <div className="flex flex-wrap gap-1.5">
              {FILL_PRESETS.map((c) => (
                <ColorSwatch
                  key={c}
                  color={c}
                  isActive={false}
                  onClick={() => updateProperties({ fill: c, noteColor: c })}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">
              Border Color
            </label>
            <div className="flex flex-wrap gap-1.5">
              {STROKE_PRESETS.map((c) => (
                <ColorSwatch
                  key={c}
                  color={c}
                  isActive={false}
                  onClick={() => updateProperties({ stroke: c })}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
