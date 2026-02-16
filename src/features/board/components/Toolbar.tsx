'use client';

import React from 'react';
import type { ToolType } from '../types';
import { useBoardObjects } from '../hooks/useBoardObjects';

const tools: { type: ToolType; label: string; icon: string }[] = [
  { type: 'select', label: 'Select', icon: 'V' },
  { type: 'sticky_note', label: 'Sticky Note', icon: 'S' },
  { type: 'rectangle', label: 'Rectangle', icon: 'R' },
  { type: 'circle', label: 'Circle', icon: 'O' },
  { type: 'line', label: 'Line', icon: 'L' },
  { type: 'text', label: 'Text', icon: 'T' },
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
          {tool.icon}
        </button>
      ))}
    </div>
  );
}
