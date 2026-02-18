'use client';

import { useMemo } from 'react';
import { Trash2, Copy } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useBoardObjects } from '../hooks/useBoardObjects';
import { useCanvas } from '../hooks/useCanvas';
import type { WhiteboardObject } from '../types';

const BAR_OFFSET_Y = 12;

export function FloatingActionBar() {
  const selectedIds = useBoardObjects((s) => s.selectedIds);
  const objects = useBoardObjects((s) => s.objects);
  const deleteSelectedSync = useBoardObjects((s) => s.deleteSelectedSync);
  const addObject = useBoardObjects((s) => s.addObject);
  const zoom = useCanvas((s) => s.zoom);
  const panOffset = useCanvas((s) => s.panOffset);

  const selectedArray = useMemo(
    () => [...selectedIds],
    [selectedIds]
  );

  const boundingBox = useMemo(() => {
    if (selectedArray.length === 0) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const id of selectedArray) {
      const obj = objects.get(id);
      if (!obj) continue;
      const w = obj.width ?? 0;
      const h = obj.height ?? 0;
      minX = Math.min(minX, obj.x);
      minY = Math.min(minY, obj.y);
      maxX = Math.max(maxX, obj.x + w);
      maxY = Math.max(maxY, obj.y + h);
    }

    if (minX === Infinity) return null;
    return { minX, minY, maxX, maxY };
  }, [selectedArray, objects]);

  if (!boundingBox || selectedArray.length === 0) return null;

  // Convert canvas coordinates to screen coordinates
  const screenLeft = boundingBox.minX * zoom + panOffset.x;
  const screenRight = boundingBox.maxX * zoom + panOffset.x;
  const screenTop = boundingBox.minY * zoom + panOffset.y;
  const screenBottom = boundingBox.maxY * zoom + panOffset.y;

  const centerX = (screenLeft + screenRight) / 2;

  // Position above selection by default, flip below if near top edge
  const barWidth = 100; // approximate width of bar
  const aboveTop = screenTop - BAR_OFFSET_Y - 44;
  const placeAbove = aboveTop > 8;
  const top = placeAbove ? aboveTop : screenBottom + BAR_OFFSET_Y;
  const left = Math.max(8, Math.min(centerX - barWidth / 2, window.innerWidth - barWidth - 8));

  const handleDuplicate = () => {
    const state = useBoardObjects.getState();
    const newIds = new Set<string>();
    state.selectedIds.forEach((id) => {
      const obj = state.objects.get(id);
      if (obj) {
        const newObj: WhiteboardObject = {
          ...obj,
          id: uuidv4(),
          x: obj.x + 20,
          y: obj.y + 20,
          version: 1,
          updated_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        };
        addObject(newObj);
        newIds.add(newObj.id);
      }
    });
    if (newIds.size > 0) {
      useBoardObjects.getState().setSelectedIds(newIds);
    }
  };

  return (
    <div
      className="absolute z-30 flex md:hidden items-center gap-1 rounded-lg bg-white px-2 py-1 shadow-lg border border-gray-200 dark:bg-gray-900 dark:border-gray-700"
      style={{ top, left }}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <button
        onClick={handleDuplicate}
        className="flex h-11 w-11 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        title="Duplicate"
      >
        <Copy size={18} />
      </button>
      <button
        onClick={deleteSelectedSync}
        className="flex h-11 w-11 items-center justify-center rounded-md text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
        title="Delete"
      >
        <Trash2 size={18} />
      </button>
    </div>
  );
}
