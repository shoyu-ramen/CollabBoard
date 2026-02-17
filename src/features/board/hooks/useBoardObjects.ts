'use client';

import { create } from 'zustand';
import { createClient } from '@/lib/supabase/client';
import { broadcastToLiveChannel } from './useBoardRealtime';
import type { WhiteboardObject, ToolType } from '../types';

interface BoardObjectsState {
  objects: Map<string, WhiteboardObject>;
  selectedIds: Set<string>;
  activeTool: ToolType;
  boardId: string | null;
  userId: string | null;

  // Board context
  setBoardContext: (boardId: string, userId: string) => void;

  // Object CRUD (state-only, used by realtime sync)
  addObject: (obj: WhiteboardObject) => void;
  updateObject: (id: string, updates: Partial<WhiteboardObject>) => void;
  deleteObject: (id: string) => void;
  getObject: (id: string) => WhiteboardObject | undefined;
  setObjects: (objs: WhiteboardObject[]) => void;

  // Sync methods (state + Supabase persistence, used by user actions)
  addObjectSync: (obj: WhiteboardObject) => void;
  updateObjectSync: (id: string, updates: Partial<WhiteboardObject>) => void;
  deleteObjectSync: (id: string) => void;
  deleteSelectedSync: () => void;

  // Selection
  selectObject: (id: string, multi?: boolean) => void;
  deselectAll: () => void;

  // Tool
  setActiveTool: (tool: ToolType) => void;

  // Bulk operations (state-only, used by realtime sync)
  deleteSelected: () => void;
}

export const useBoardObjects = create<BoardObjectsState>((set, get) => ({
  objects: new Map(),
  selectedIds: new Set(),
  activeTool: 'select',
  boardId: null,
  userId: null,

  setBoardContext: (boardId, userId) => set({ boardId, userId }),

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

  // --- Sync methods: optimistic local update + persist to Supabase ---

  addObjectSync: (obj) => {
    const { boardId, userId } = get();
    const fullObj: WhiteboardObject = {
      ...obj,
      board_id: boardId || obj.board_id,
      updated_by: userId || obj.updated_by,
    };

    set((state) => {
      const next = new Map(state.objects);
      next.set(fullObj.id, fullObj);
      return { objects: next };
    });

    // Broadcast to other clients for real-time sync
    broadcastToLiveChannel('object_create', {
      object: fullObj,
      senderId: userId,
    });

    const supabase = createClient();
    supabase
      .from('whiteboard_objects')
      .insert(fullObj)
      .then(({ error }) => {
        if (error) console.error('Failed to persist new object:', error);
      });
  },

  updateObjectSync: (id, updates) => {
    const existing = get().objects.get(id);
    if (!existing) return;

    const merged = { ...existing, ...updates };

    set((state) => {
      const next = new Map(state.objects);
      next.set(id, merged);
      return { objects: next };
    });

    // Broadcast to other clients for real-time sync
    broadcastToLiveChannel('object_update', {
      object: merged,
      senderId: get().userId,
    });

    const supabase = createClient();
    supabase
      .from('whiteboard_objects')
      .update(updates)
      .eq('id', id)
      .then(({ error }) => {
        if (error) console.error('Failed to persist update:', error);
      });
  },

  deleteObjectSync: (id) => {
    const senderId = get().userId;

    set((state) => {
      const next = new Map(state.objects);
      const nextSelected = new Set(state.selectedIds);
      next.delete(id);
      nextSelected.delete(id);
      return { objects: next, selectedIds: nextSelected };
    });

    broadcastToLiveChannel('object_delete', { id, senderId });

    const supabase = createClient();
    supabase
      .from('whiteboard_objects')
      .delete()
      .eq('id', id)
      .then(({ error }) => {
        if (error) console.error('Failed to persist delete:', error);
      });
  },

  deleteSelectedSync: () => {
    const selected = [...get().selectedIds];
    const senderId = get().userId;

    set((state) => {
      const next = new Map(state.objects);
      for (const id of selected) {
        next.delete(id);
      }
      return { objects: next, selectedIds: new Set() };
    });

    const supabase = createClient();
    for (const id of selected) {
      broadcastToLiveChannel('object_delete', { id, senderId });
      supabase
        .from('whiteboard_objects')
        .delete()
        .eq('id', id)
        .then(({ error }) => {
          if (error) console.error('Failed to persist delete:', error);
        });
    }
  },

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
