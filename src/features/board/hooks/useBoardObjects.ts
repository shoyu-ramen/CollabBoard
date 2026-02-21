'use client';

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@/lib/supabase/client';
import { broadcastToLiveChannel } from './useBoardRealtime';
import type { WhiteboardObject, ToolType, HistoryEntry } from '../types';

const MAX_HISTORY = 50;

interface HistoryBatch {
  label: string;
  before: Map<string, WhiteboardObject | null>;
  after: Map<string, WhiteboardObject | null>;
}

interface BoardObjectsState {
  objects: Map<string, WhiteboardObject>;
  selectedIds: Set<string>;
  activeTool: ToolType;
  boardId: string | null;
  userId: string | null;
  clipboard: WhiteboardObject[];

  // Undo/Redo
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
  _suppressHistory: boolean;
  _historyBatch: HistoryBatch | null;

  // Board context
  setBoardContext: (boardId: string, userId: string) => void;

  // Object CRUD (state-only, used by realtime sync)
  addObject: (obj: WhiteboardObject) => void;
  updateObject: (id: string, updates: Partial<WhiteboardObject>) => void;
  batchUpdateObjects: (updates: Array<{id: string, updates: Partial<WhiteboardObject>}>) => void;
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
  setSelectedIds: (ids: Set<string>) => void;
  deselectAll: () => void;

  // Tool
  setActiveTool: (tool: ToolType) => void;

  // Clipboard
  copySelected: () => void;
  pasteClipboard: () => void;

  // Bulk operations (state-only, used by realtime sync)
  deleteSelected: () => void;

  // Undo/Redo actions
  pushHistory: (entry: HistoryEntry) => void;
  undo: () => void;
  redo: () => void;
  beginHistoryBatch: (label: string) => void;
  commitHistoryBatch: () => void;
  clearHistory: () => void;
}

export const useBoardObjects = create<BoardObjectsState>((set, get) => ({
  objects: new Map(),
  selectedIds: new Set(),
  activeTool: 'select',
  boardId: null,
  userId: null,
  clipboard: [],
  undoStack: [],
  redoStack: [],
  _suppressHistory: false,
  _historyBatch: null,

  setBoardContext: (boardId, userId) =>
    set({ boardId, userId, undoStack: [], redoStack: [] }),

  addObject: (obj) =>
    set((state) => {
      // Shallow-clone Map for immutability (Zustand requires new reference)
      const next = new Map(state.objects);
      next.set(obj.id, obj);
      return { objects: next };
    }),

  updateObject: (id, updates) =>
    set((state) => {
      const existing = state.objects.get(id);
      if (!existing) return state;
      // Merge and create new Map reference for Zustand reactivity
      const merged = { ...existing, ...updates };
      // Fast-path: avoid deep properties merge when properties unchanged
      if (updates.properties && existing.properties) {
        merged.properties = { ...existing.properties, ...updates.properties };
      }
      const next = new Map(state.objects);
      next.set(id, merged);
      return { objects: next };
    }),

  batchUpdateObjects: (updates) =>
    set((state) => {
      if (updates.length === 0) return state;
      const next = new Map(state.objects);
      for (const { id, updates: u } of updates) {
        const existing = next.get(id);
        if (existing) {
          const merged = { ...existing, ...u };
          if (u.properties && existing.properties) {
            merged.properties = { ...existing.properties, ...u.properties };
          }
          next.set(id, merged);
        }
      }
      return { objects: next };
    }),

  deleteObject: (id) =>
    set((state) => {
      if (!state.objects.has(id)) return state;
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

  // --- Undo/Redo core actions ---

  pushHistory: (entry) =>
    set((state) => ({
      undoStack: [...state.undoStack.slice(-(MAX_HISTORY - 1)), entry],
      redoStack: [],
    })),

  undo: () => {
    const { undoStack, userId } = get();
    if (undoStack.length === 0) return;

    const entry = undoStack[undoStack.length - 1];

    // Apply before snapshots to restore previous state
    set((state) => {
      const next = new Map(state.objects);
      entry.before.forEach((snapshot, id) => {
        if (snapshot === null) {
          // Object was created — undo means remove it
          next.delete(id);
        } else {
          // Restore previous snapshot with bumped version for LWW
          next.set(id, {
            ...snapshot,
            version: (next.get(id)?.version || snapshot.version) + 1,
            updated_at: new Date().toISOString(),
            updated_by: userId || snapshot.updated_by,
          });
        }
      });

      return {
        objects: next,
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, entry],
      };
    });

    // Sync to other clients and DB
    const state = get();
    entry.before.forEach((snapshot, id) => {
      if (snapshot === null) {
        // Undo create → delete
        broadcastToLiveChannel('object_delete', { id, senderId: userId });
        const supabase = createClient();
        supabase
          .from('whiteboard_objects')
          .delete()
          .eq('id', id)
          .then(({ error }) => {
            if (error) console.error('Undo: failed to delete:', error);
          });
      } else {
        const restored = state.objects.get(id);
        if (restored) {
          // Check if the object existed before the undo (update vs re-insert)
          const afterSnapshot = entry.after.get(id);
          if (afterSnapshot === null) {
            // Undo delete → re-insert
            broadcastToLiveChannel('object_create', {
              object: restored,
              senderId: userId,
            });
            const supabase = createClient();
            supabase
              .from('whiteboard_objects')
              .insert(restored)
              .then(({ error }) => {
                if (error)
                  console.error('Undo: failed to re-insert:', error);
              });
          } else {
            // Undo update → restore previous values
            broadcastToLiveChannel('object_update', {
              object: restored,
              senderId: userId,
            });
            const supabase = createClient();
            supabase
              .from('whiteboard_objects')
              .update(restored)
              .eq('id', id)
              .then(({ error }) => {
                if (error)
                  console.error('Undo: failed to update:', error);
              });
          }
        }
      }
    });
  },

  redo: () => {
    const { redoStack, userId } = get();
    if (redoStack.length === 0) return;

    const entry = redoStack[redoStack.length - 1];

    // Apply after snapshots to re-apply the action
    set((state) => {
      const next = new Map(state.objects);
      entry.after.forEach((snapshot, id) => {
        if (snapshot === null) {
          // Object was deleted — redo means remove it again
          next.delete(id);
        } else {
          next.set(id, {
            ...snapshot,
            version: (next.get(id)?.version || snapshot.version) + 1,
            updated_at: new Date().toISOString(),
            updated_by: userId || snapshot.updated_by,
          });
        }
      });

      return {
        objects: next,
        redoStack: state.redoStack.slice(0, -1),
        undoStack: [...state.undoStack, entry],
      };
    });

    // Sync to other clients and DB
    const state = get();
    entry.after.forEach((snapshot, id) => {
      if (snapshot === null) {
        // Redo delete
        broadcastToLiveChannel('object_delete', { id, senderId: userId });
        const supabase = createClient();
        supabase
          .from('whiteboard_objects')
          .delete()
          .eq('id', id)
          .then(({ error }) => {
            if (error) console.error('Redo: failed to delete:', error);
          });
      } else {
        const restored = state.objects.get(id);
        if (restored) {
          const beforeSnapshot = entry.before.get(id);
          if (beforeSnapshot === null) {
            // Redo create → re-insert
            broadcastToLiveChannel('object_create', {
              object: restored,
              senderId: userId,
            });
            const supabase = createClient();
            supabase
              .from('whiteboard_objects')
              .insert(restored)
              .then(({ error }) => {
                if (error)
                  console.error('Redo: failed to re-insert:', error);
              });
          } else {
            // Redo update
            broadcastToLiveChannel('object_update', {
              object: restored,
              senderId: userId,
            });
            const supabase = createClient();
            supabase
              .from('whiteboard_objects')
              .update(restored)
              .eq('id', id)
              .then(({ error }) => {
                if (error)
                  console.error('Redo: failed to update:', error);
              });
          }
        }
      }
    });
  },

  beginHistoryBatch: (label) => {
    set({
      _historyBatch: {
        label,
        before: new Map(),
        after: new Map(),
      },
    });
  },

  commitHistoryBatch: () => {
    const batch = get()._historyBatch;
    if (!batch || batch.before.size === 0) {
      set({ _historyBatch: null });
      return;
    }

    const entry: HistoryEntry = {
      id: uuidv4(),
      label: batch.label,
      timestamp: Date.now(),
      before: batch.before,
      after: batch.after,
    };

    set((state) => ({
      _historyBatch: null,
      undoStack: [...state.undoStack.slice(-(MAX_HISTORY - 1)), entry],
      redoStack: [],
    }));
  },

  clearHistory: () => set({ undoStack: [], redoStack: [] }),

  // --- Sync methods: optimistic local update + persist to Supabase ---

  addObjectSync: (obj) => {
    const { boardId, userId, _suppressHistory, _historyBatch } = get();
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

    // Record history for create
    if (!_suppressHistory) {
      if (_historyBatch) {
        // Accumulate into batch
        if (!_historyBatch.before.has(fullObj.id)) {
          _historyBatch.before.set(fullObj.id, null);
        }
        _historyBatch.after.set(fullObj.id, { ...fullObj });
      } else {
        const entry: HistoryEntry = {
          id: uuidv4(),
          label: 'create',
          timestamp: Date.now(),
          before: new Map([[fullObj.id, null]]),
          after: new Map([[fullObj.id, { ...fullObj }]]),
        };
        get().pushHistory(entry);
      }
    }

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

    // Record history for update
    const { _suppressHistory, _historyBatch } = get();
    if (!_suppressHistory) {
      if (_historyBatch) {
        // Only capture the first "before" for each ID in a batch
        if (!_historyBatch.before.has(id)) {
          _historyBatch.before.set(id, { ...existing });
        }
        _historyBatch.after.set(id, { ...merged });
      } else {
        const entry: HistoryEntry = {
          id: uuidv4(),
          label: 'update',
          timestamp: Date.now(),
          before: new Map([[id, { ...existing }]]),
          after: new Map([[id, { ...merged }]]),
        };
        get().pushHistory(entry);
      }
    }

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
    const existing = get().objects.get(id);
    const senderId = get().userId;

    // Record history for delete
    if (existing && !get()._suppressHistory) {
      const batch = get()._historyBatch;
      if (batch) {
        if (!batch.before.has(id)) {
          batch.before.set(id, { ...existing });
        }
        batch.after.set(id, null);
      } else {
        const entry: HistoryEntry = {
          id: uuidv4(),
          label: 'delete',
          timestamp: Date.now(),
          before: new Map([[id, { ...existing }]]),
          after: new Map([[id, null]]),
        };
        get().pushHistory(entry);
      }
    }

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
    if (selected.length === 0) return;
    const senderId = get().userId;

    // Capture before-snapshots for all selected objects
    if (!get()._suppressHistory) {
      const before = new Map<string, WhiteboardObject | null>();
      const after = new Map<string, WhiteboardObject | null>();
      for (const id of selected) {
        const obj = get().objects.get(id);
        if (obj) {
          before.set(id, { ...obj });
          after.set(id, null);
        }
      }
      if (before.size > 0) {
        const entry: HistoryEntry = {
          id: uuidv4(),
          label: 'delete',
          timestamp: Date.now(),
          before,
          after,
        };
        get().pushHistory(entry);
      }
    }

    set((state) => {
      const next = new Map(state.objects);
      for (const id of selected) {
        next.delete(id);
      }
      return { objects: next, selectedIds: new Set() };
    });

    // Broadcast all deletes
    for (const id of selected) {
      broadcastToLiveChannel('object_delete', { id, senderId });
    }

    // Single batch DB delete instead of N individual requests
    const supabase = createClient();
    supabase
      .from('whiteboard_objects')
      .delete()
      .in('id', selected)
      .then(({ error }) => {
        if (error) console.error('Failed to persist batch delete:', error);
      });
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

  setSelectedIds: (ids) => set({ selectedIds: ids }),

  deselectAll: () => set({ selectedIds: new Set() }),

  setActiveTool: (tool) => set({ activeTool: tool }),

  copySelected: () => {
    const { selectedIds, objects } = get();
    const copied: WhiteboardObject[] = [];
    selectedIds.forEach((id) => {
      const obj = objects.get(id);
      if (obj) copied.push({ ...obj });
    });
    set({ clipboard: copied });
  },

  pasteClipboard: () => {
    const { clipboard, boardId, userId } = get();
    if (clipboard.length === 0) return;
    const now = new Date().toISOString();
    const PASTE_OFFSET = 30;
    const idMap = new Map<string, string>();

    // First pass: generate new IDs
    const newObjects = clipboard.map((obj) => {
      const newId = uuidv4();
      idMap.set(obj.id, newId);
      return {
        ...obj,
        id: newId,
        x: obj.x + PASTE_OFFSET,
        y: obj.y + PASTE_OFFSET,
        board_id: boardId || obj.board_id,
        updated_by: userId || obj.updated_by,
        updated_at: now,
        created_at: now,
        version: 1,
      };
    });

    // Second pass: update arrow connections to point to new IDs
    for (const obj of newObjects) {
      if (obj.object_type === 'arrow' && obj.properties) {
        if (
          obj.properties.startObjectId &&
          idMap.has(obj.properties.startObjectId)
        ) {
          obj.properties = {
            ...obj.properties,
            startObjectId: idMap.get(obj.properties.startObjectId),
          };
        } else if (obj.properties.startObjectId) {
          obj.properties = {
            ...obj.properties,
            startObjectId: undefined,
            startAnchorSide: undefined,
          };
        }
        if (
          obj.properties.endObjectId &&
          idMap.has(obj.properties.endObjectId)
        ) {
          obj.properties = {
            ...obj.properties,
            endObjectId: idMap.get(obj.properties.endObjectId),
          };
        } else if (obj.properties.endObjectId) {
          obj.properties = {
            ...obj.properties,
            endObjectId: undefined,
            endAnchorSide: undefined,
          };
        }
      }
    }

    // Suppress individual history entries; push one grouped entry
    set({ _suppressHistory: true });
    const newIds = new Set<string>();
    for (const obj of newObjects) {
      get().addObjectSync(obj);
      newIds.add(obj.id);
    }
    set({ _suppressHistory: false, selectedIds: newIds });

    // Push a single grouped history entry for the paste
    const before = new Map<string, WhiteboardObject | null>();
    const after = new Map<string, WhiteboardObject | null>();
    for (const obj of newObjects) {
      before.set(obj.id, null);
      const inserted = get().objects.get(obj.id);
      after.set(obj.id, inserted ? { ...inserted } : { ...obj });
    }
    const entry: HistoryEntry = {
      id: uuidv4(),
      label: 'paste',
      timestamp: Date.now(),
      before,
      after,
    };
    get().pushHistory(entry);
  },

  deleteSelected: () =>
    set((state) => {
      const next = new Map(state.objects);
      for (const id of state.selectedIds) {
        next.delete(id);
      }
      return { objects: next, selectedIds: new Set() };
    }),
}));
