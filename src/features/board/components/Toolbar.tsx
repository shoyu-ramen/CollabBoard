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
      { keys: [`${mod}+Z`], description: 'Undo' },
      { keys: [`${mod}+Shift+Z`], description: 'Redo' },
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
        className="w-[calc(100vw-2rem)] max-w-80 hig-rounded-xl bg-[var(--bg-grouped-secondary)] shadow-2xl border border-[var(--separator)] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[var(--label-primary)]">
            Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded text-[var(--label-tertiary)] hover:text-[var(--label-secondary)] hover:bg-[var(--fill-quaternary)] transition-colors"
          >
            <X size={14} />
          </button>
        </div>
        {shortcutGroups.map((group) => (
          <div key={group.title} className="mb-3 last:mb-0">
            <h3 className="text-xs font-semibold text-[var(--label-secondary)] uppercase tracking-wider mb-1.5">
              {group.title}
            </h3>
            <div className="flex flex-col gap-1">
              {group.shortcuts.map((s) => (
                <div
                  key={s.description}
                  className="flex items-center justify-between py-1"
                >
                  <span className="text-xs text-[var(--label-secondary)]">
                    {s.description}
                  </span>
                  <div className="flex items-center gap-0.5">
                    {s.keys.map((k) => (
                      <kbd
                        key={k}
                        className="inline-block min-w-[1.5rem] rounded bg-[var(--fill-tertiary)] border border-[var(--separator)] px-1.5 py-0.5 text-center text-[10px] font-medium text-[var(--label-secondary)]"
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
      {/* Mobile: horizontal bottom bar */}
      <div className="fixed bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-0.5 hig-rounded-2xl hig-material-chrome border border-[var(--separator)] safe-area-bottom p-1.5 md:hidden">
        {tools.map((tool) => (
          <button
            key={tool.type}
            title={tool.label}
            onClick={() => setActiveTool(tool.type)}
            className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-sm font-bold transition-colors ${
              activeTool === tool.type
                ? 'bg-[var(--system-blue)] text-white'
                : 'text-[var(--label-secondary)] hig-pressable hover:bg-[var(--fill-quaternary)]'
            }`}
          >
            <tool.icon size={18} strokeWidth={2} />
          </button>
        ))}
      </div>
      {/* Desktop: vertical left bar */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 hidden flex-col gap-1 hig-rounded-xl hig-material-regular border border-[var(--separator)] p-2 md:flex">
        {tools.map((tool) => (
          <button
            key={tool.type}
            title={tool.label}
            onClick={() => setActiveTool(tool.type)}
            className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold transition-colors ${
              activeTool === tool.type
                ? 'bg-[var(--system-blue)] text-white'
                : 'text-[var(--label-secondary)] hig-pressable hover:bg-[var(--fill-quaternary)]'
            }`}
          >
            <tool.icon size={20} strokeWidth={2} />
          </button>
        ))}
        <div className="border-t border-[var(--separator)] my-1" />
        <button
          title="Shortcuts"
          onClick={() => setShowShortcuts(true)}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold transition-colors text-[var(--label-secondary)] hig-pressable hover:bg-[var(--fill-quaternary)]"
        >
          <Keyboard size={20} strokeWidth={2} />
        </button>
      </div>
      {showShortcuts && <ShortcutsModal onClose={handleClose} />}
    </>
  );
}
