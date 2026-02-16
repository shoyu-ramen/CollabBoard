'use client';

import { create } from 'zustand';
import type { WhiteboardObject, ToolType } from '../types';

interface BoardObjectsState {
  objects: Map<string, WhiteboardObject>;
  selectedIds: Set<string>;
  activeTool: ToolType;

  // Object CRUD
  addObject: (obj: WhiteboardObject) => void;
  updateObject: (id: string, updates: Partial<WhiteboardObject>) => void;
  deleteObject: (id: string) => void;
  getObject: (id: string) => WhiteboardObject | undefined;
  setObjects: (objs: WhiteboardObject[]) => void;

  // Selection
  selectObject: (id: string, multi?: boolean) => void;
  deselectAll: () => void;

  // Tool
  setActiveTool: (tool: ToolType) => void;

  // Bulk operations
  deleteSelected: () => void;
}

export const useBoardObjects = create<BoardObjectsState>((set, get) => ({
  objects: new Map(),
  selectedIds: new Set(),
  activeTool: 'select',

  addObject: (obj) =>
    set((state) => {
      const next = new Map(state.objects);
      next.set(obj.id, obj);
      return { objects: next };
    }),

  updateObject: (id, updates) =>
    set((state) => {
      const existing = state.objects.get(id);
      if (!existing) return state;
      const next = new Map(state.objects);
      next.set(id, { ...existing, ...updates });
      return { objects: next };
    }),

  deleteObject: (id) =>
    set((state) => {
      const next = new Map(state.objects);
      next.delete(id);
      const nextSelected = new Set(state.selectedIds);
      nextSelected.delete(id);
      return { objects: next, selectedIds: nextSelected };
    }),

  getObject: (id) => get().objects.get(id),

  setObjects: (objs) =>
    set(() => {
      const next = new Map<string, WhiteboardObject>();
      for (const obj of objs) {
        next.set(obj.id, obj);
      }
      return { objects: next };
    }),

  selectObject: (id, multi = false) =>
    set((state) => {
      if (multi) {
        const next = new Set(state.selectedIds);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return { selectedIds: next };
      }
      return { selectedIds: new Set([id]) };
    }),

  deselectAll: () => set({ selectedIds: new Set() }),

  setActiveTool: (tool) => set({ activeTool: tool }),

  deleteSelected: () =>
    set((state) => {
      const next = new Map(state.objects);
      for (const id of state.selectedIds) {
        next.delete(id);
      }
      return { objects: next, selectedIds: new Set() };
    }),
}));
