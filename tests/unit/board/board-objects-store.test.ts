import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies before importing the store
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid-1'),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({
      insert: () => Promise.resolve({ error: null }),
      update: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
      delete: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
    }),
  }),
}));

vi.mock('../useBoardRealtime', () => ({
  broadcastToLiveChannel: vi.fn(),
}));

// The store path resolves relative to the source, but we import via alias
vi.mock('@/features/board/hooks/useBoardRealtime', () => ({
  broadcastToLiveChannel: vi.fn(),
}));

import { useBoardObjects } from '@/features/board/hooks/useBoardObjects';
import type { WhiteboardObject } from '@/features/board/types';
import { v4 as uuidv4 } from 'uuid';

function makeObject(overrides: Partial<WhiteboardObject> = {}): WhiteboardObject {
  return {
    id: 'obj-1',
    board_id: 'board-1',
    object_type: 'sticky_note',
    x: 100,
    y: 200,
    width: 200,
    height: 200,
    rotation: 0,
    properties: { text: 'Hello', noteColor: '#FEF08A' },
    updated_by: 'user-1',
    updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    version: 1,
    ...overrides,
  };
}

function resetStore() {
  useBoardObjects.setState({
    objects: new Map(),
    selectedIds: new Set(),
    clipboard: [],
    activeTool: 'select',
    boardId: null,
    userId: null,
  });
}

describe('useBoardObjects store', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('addObject', () => {
    it('adds an object to the Map, retrievable via getObject', () => {
      const obj = makeObject();
      useBoardObjects.getState().addObject(obj);

      const retrieved = useBoardObjects.getState().getObject('obj-1');
      expect(retrieved).toEqual(obj);
      expect(useBoardObjects.getState().objects.size).toBe(1);
    });
  });

  describe('updateObject', () => {
    it('partial update merges correctly', () => {
      const obj = makeObject();
      useBoardObjects.getState().addObject(obj);

      useBoardObjects.getState().updateObject('obj-1', { x: 500, y: 600 });

      const updated = useBoardObjects.getState().getObject('obj-1');
      expect(updated?.x).toBe(500);
      expect(updated?.y).toBe(600);
      // Unchanged fields remain
      expect(updated?.width).toBe(200);
      expect(updated?.object_type).toBe('sticky_note');
    });

    it('non-existent ID is a no-op', () => {
      const obj = makeObject();
      useBoardObjects.getState().addObject(obj);

      useBoardObjects.getState().updateObject('non-existent', { x: 999 });

      expect(useBoardObjects.getState().objects.size).toBe(1);
      expect(useBoardObjects.getState().getObject('obj-1')?.x).toBe(100);
    });
  });

  describe('deleteObject', () => {
    it('removes the object from the Map', () => {
      const obj = makeObject();
      useBoardObjects.getState().addObject(obj);
      expect(useBoardObjects.getState().objects.size).toBe(1);

      useBoardObjects.getState().deleteObject('obj-1');
      expect(useBoardObjects.getState().objects.size).toBe(0);
      expect(useBoardObjects.getState().getObject('obj-1')).toBeUndefined();
    });

    it('also removes from selectedIds', () => {
      const obj = makeObject();
      useBoardObjects.getState().addObject(obj);
      useBoardObjects.getState().selectObject('obj-1');
      expect(useBoardObjects.getState().selectedIds.has('obj-1')).toBe(true);

      useBoardObjects.getState().deleteObject('obj-1');
      expect(useBoardObjects.getState().selectedIds.has('obj-1')).toBe(false);
    });
  });

  describe('batchUpdateObjects', () => {
    it('updates multiple objects atomically', () => {
      const obj1 = makeObject({ id: 'obj-1', x: 10 });
      const obj2 = makeObject({ id: 'obj-2', x: 20 });
      useBoardObjects.getState().addObject(obj1);
      useBoardObjects.getState().addObject(obj2);

      useBoardObjects.getState().batchUpdateObjects([
        { id: 'obj-1', updates: { x: 100 } },
        { id: 'obj-2', updates: { x: 200, y: 300 } },
      ]);

      expect(useBoardObjects.getState().getObject('obj-1')?.x).toBe(100);
      expect(useBoardObjects.getState().getObject('obj-2')?.x).toBe(200);
      expect(useBoardObjects.getState().getObject('obj-2')?.y).toBe(300);
    });
  });

  describe('selectObject', () => {
    it('sets selectedIds to just that ID', () => {
      useBoardObjects.getState().selectObject('obj-1');
      const ids = useBoardObjects.getState().selectedIds;
      expect(ids.size).toBe(1);
      expect(ids.has('obj-1')).toBe(true);
    });

    it('multi-select adds to existing selection', () => {
      useBoardObjects.getState().selectObject('obj-1');
      useBoardObjects.getState().selectObject('obj-2', true);

      const ids = useBoardObjects.getState().selectedIds;
      expect(ids.size).toBe(2);
      expect(ids.has('obj-1')).toBe(true);
      expect(ids.has('obj-2')).toBe(true);
    });

    it('multi-select on already-selected toggles (removes)', () => {
      useBoardObjects.getState().selectObject('obj-1');
      useBoardObjects.getState().selectObject('obj-2', true);
      expect(useBoardObjects.getState().selectedIds.size).toBe(2);

      useBoardObjects.getState().selectObject('obj-1', true);
      const ids = useBoardObjects.getState().selectedIds;
      expect(ids.size).toBe(1);
      expect(ids.has('obj-1')).toBe(false);
      expect(ids.has('obj-2')).toBe(true);
    });
  });

  describe('deselectAll', () => {
    it('clears selectedIds', () => {
      useBoardObjects.getState().selectObject('obj-1');
      useBoardObjects.getState().selectObject('obj-2', true);
      expect(useBoardObjects.getState().selectedIds.size).toBe(2);

      useBoardObjects.getState().deselectAll();
      expect(useBoardObjects.getState().selectedIds.size).toBe(0);
    });
  });

  describe('setActiveTool', () => {
    it('updates activeTool', () => {
      expect(useBoardObjects.getState().activeTool).toBe('select');

      useBoardObjects.getState().setActiveTool('rectangle');
      expect(useBoardObjects.getState().activeTool).toBe('rectangle');
    });
  });

  describe('setObjects', () => {
    it('replaces entire objects Map', () => {
      const obj1 = makeObject({ id: 'obj-1' });
      useBoardObjects.getState().addObject(obj1);
      expect(useBoardObjects.getState().objects.size).toBe(1);

      const obj2 = makeObject({ id: 'obj-2' });
      const obj3 = makeObject({ id: 'obj-3' });
      useBoardObjects.getState().setObjects([obj2, obj3]);

      expect(useBoardObjects.getState().objects.size).toBe(2);
      expect(useBoardObjects.getState().getObject('obj-1')).toBeUndefined();
      expect(useBoardObjects.getState().getObject('obj-2')).toEqual(obj2);
      expect(useBoardObjects.getState().getObject('obj-3')).toEqual(obj3);
    });
  });

  describe('copySelected / pasteClipboard', () => {
    it('copy creates clipboard, paste creates new objects with offset and new IDs', () => {
      const obj = makeObject({ id: 'obj-1', x: 100, y: 200 });
      useBoardObjects.getState().addObject(obj);
      useBoardObjects.getState().setBoardContext('board-1', 'user-1');
      useBoardObjects.getState().selectObject('obj-1');

      useBoardObjects.getState().copySelected();
      expect(useBoardObjects.getState().clipboard.length).toBe(1);

      // Set up uuid mock to return a deterministic ID for the paste
      vi.mocked(uuidv4 as () => string).mockReturnValueOnce('pasted-uuid-1');

      useBoardObjects.getState().pasteClipboard();

      // Should have 2 objects now: original + pasted
      expect(useBoardObjects.getState().objects.size).toBe(2);

      const pasted = useBoardObjects.getState().getObject('pasted-uuid-1');
      expect(pasted).toBeDefined();
      expect(pasted?.x).toBe(130); // 100 + 30 offset
      expect(pasted?.y).toBe(230); // 200 + 30 offset
      expect(pasted?.id).toBe('pasted-uuid-1');
    });
  });

  describe('deleteSelected', () => {
    it('removes all selected objects and clears selection', () => {
      const obj1 = makeObject({ id: 'obj-1' });
      const obj2 = makeObject({ id: 'obj-2' });
      const obj3 = makeObject({ id: 'obj-3' });
      useBoardObjects.getState().addObject(obj1);
      useBoardObjects.getState().addObject(obj2);
      useBoardObjects.getState().addObject(obj3);

      useBoardObjects.getState().selectObject('obj-1');
      useBoardObjects.getState().selectObject('obj-2', true);

      useBoardObjects.getState().deleteSelected();

      expect(useBoardObjects.getState().objects.size).toBe(1);
      expect(useBoardObjects.getState().getObject('obj-1')).toBeUndefined();
      expect(useBoardObjects.getState().getObject('obj-2')).toBeUndefined();
      expect(useBoardObjects.getState().getObject('obj-3')).toBeDefined();
      expect(useBoardObjects.getState().selectedIds.size).toBe(0);
    });
  });
});
