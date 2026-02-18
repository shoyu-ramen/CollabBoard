'use client';

import React from 'react';
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

export default function Toolbar() {
  const activeTool = useBoardObjects((s) => s.activeTool);
  const setActiveTool = useBoardObjects((s) => s.setActiveTool);

  return (
    <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-1 rounded-xl bg-white shadow-lg border border-gray-200 p-2">
      {tools.map((tool) => (
        <button
          key={tool.type}
          title={tool.label}
          onClick={() => setActiveTool(tool.type)}
          className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold transition-colors ${
            activeTool === tool.type
              ? 'bg-blue-500 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <tool.icon size={20} strokeWidth={2} />
        </button>
      ))}
    </div>
  );
}
