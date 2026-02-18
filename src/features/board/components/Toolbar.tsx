'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  MousePointer2,
  Hand,
  StickyNote,
  Square,
  Circle,
  ArrowRight,
  Minus,
  Type,
  LayoutGrid,
  Keyboard,
  X,
} from 'lucide-react';
import type { ToolType } from '../types';
import { useBoardObjects } from '../hooks/useBoardObjects';

const tools: { type: ToolType; label: string; icon: React.ElementType }[] = [
  { type: 'select', label: 'Select', icon: MousePointer2 },
  { type: 'pan', label: 'Pan', icon: Hand },
  { type: 'text', label: 'Text', icon: Type },
  { type: 'sticky_note', label: 'Sticky Note', icon: StickyNote },
  { type: 'rectangle', label: 'Rectangle', icon: Square },
  { type: 'circle', label: 'Circle', icon: Circle },
  { type: 'line', label: 'Line', icon: Minus },
  { type: 'arrow', label: 'Arrow', icon: ArrowRight },
  { type: 'frame', label: 'Frame', icon: LayoutGrid },
];

const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
const mod = isMac ? '\u2318' : 'Ctrl';
const alt = isMac ? '\u2325' : 'Alt';

const shortcutGroups = [
  {
    title: 'General',
    shortcuts: [
      { keys: ['Esc'], description: 'Deselect / back to Select tool' },
      { keys: ['Delete', 'Backspace'], description: 'Delete selected' },
      { keys: [`${mod}+C`], description: 'Copy' },
      { keys: [`${mod}+V`], description: 'Paste' },
      { keys: [`${mod}+X`], description: 'Cut' },
      { keys: [`${mod}+D`], description: 'Duplicate' },
      { keys: ['Shift+Click'], description: 'Multi-select' },
      { keys: ['Drag'], description: 'Marquee select' },
      { keys: [`${mod}+J`], description: 'Toggle AI agent' },
    ],
  },
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['Scroll'], description: 'Zoom in/out' },
      { keys: [`${alt}+Drag`], description: 'Pan' },
    ],
  },
  {
    title: 'Text Editing',
    shortcuts: [
      { keys: [`${mod}+B`], description: 'Bold' },
      { keys: [`${mod}+I`], description: 'Italic' },
      { keys: ['Esc'], description: 'Finish editing text' },
    ],
  },
];

function ShortcutsModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={onClose}
    >
      <div
        className="w-80 rounded-xl bg-white shadow-2xl border border-gray-200 p-5 dark:bg-gray-900 dark:border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors dark:hover:text-gray-300 dark:hover:bg-gray-800"
          >
            <X size={14} />
          </button>
        </div>
        {shortcutGroups.map((group) => (
          <div key={group.title} className="mb-3 last:mb-0">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 dark:text-gray-400">
              {group.title}
            </h3>
            <div className="flex flex-col gap-1">
              {group.shortcuts.map((s) => (
                <div
                  key={s.description}
                  className="flex items-center justify-between py-1"
                >
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {s.description}
                  </span>
                  <div className="flex items-center gap-0.5">
                    {s.keys.map((k) => (
                      <kbd
                        key={k}
                        className="inline-block min-w-[1.5rem] rounded bg-gray-100 border border-gray-200 px-1.5 py-0.5 text-center text-[10px] font-medium text-gray-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400"
                      >
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Toolbar() {
  const activeTool = useBoardObjects((s) => s.activeTool);
  const setActiveTool = useBoardObjects((s) => s.setActiveTool);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const handleClose = useCallback(() => setShowShortcuts(false), []);

  return (
    <>
      <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-1 rounded-xl bg-white shadow-lg border border-gray-200 p-2 dark:bg-gray-900 dark:border-gray-700">
        {tools.map((tool) => (
          <button
            key={tool.type}
            title={tool.label}
            onClick={() => setActiveTool(tool.type)}
            className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold transition-colors ${
              activeTool === tool.type
                ? 'bg-blue-500 text-white'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
            }`}
          >
            <tool.icon size={20} strokeWidth={2} />
          </button>
        ))}
        <div className="hidden md:block border-t border-gray-200 my-1 dark:border-gray-700" />
        <button
          title="Shortcuts"
          onClick={() => setShowShortcuts(true)}
          className="hidden md:flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold transition-colors text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          <Keyboard size={20} strokeWidth={2} />
        </button>
      </div>
      {showShortcuts && <ShortcutsModal onClose={handleClose} />}
    </>
  );
}
