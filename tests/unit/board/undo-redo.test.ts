import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies before importing the store
vi.mock('uuid', () => {
  let counter = 0;
  return {
    v4: vi.fn(() => `mock-uuid-${++counter}`),
  };
});

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({
      insert: () => Promise.resolve({ error: null }),
      update: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
      delete: () => ({
        eq: () => Promise.resolve({ error: null }),
        in: () => Promise.resolve({ error: null }),
      }),
    }),
  }),
}));

vi.mock('../useBoardRealtime', () => ({
  broadcastToLiveChannel: vi.fn(),
}));

vi.mock('@/features/board/hooks/useBoardRealtime', () => ({
  broadcastToLiveChannel: vi.fn(),
}));

import { useBoardObjects } from '@/features/board/hooks/useBoardObjects';
import type { WhiteboardObject } from '@/features/board/types';

function makeObject(
  overrides: Partial<WhiteboardObject> = {}
): WhiteboardObject {
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
    boardId: 'board-1',
    userId: 'user-1',
    undoStack: [],
    redoStack: [],
    _suppressHistory: false,
    _historyBatch: null,
  });
}

describe('Undo/Redo', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('create → undo → redo', () => {
    it('undo removes created object, redo restores it', () => {
      const obj = makeObject({ id: 'obj-1' });
      useBoardObjects.getState().addObjectSync(obj);
      expect(useBoardObjects.getState().objects.has('obj-1')).toBe(true);
      expect(useBoardObjects.getState().undoStack.length).toBe(1);

      // Undo: object should be removed
      useBoardObjects.getState().undo();
      expect(useBoardObjects.getState().objects.has('obj-1')).toBe(false);
      expect(useBoardObjects.getState().undoStack.length).toBe(0);
      expect(useBoardObjects.getState().redoStack.length).toBe(1);

      // Redo: object should be restored
      useBoardObjects.getState().redo();
      expect(useBoardObjects.getState().objects.has('obj-1')).toBe(true);
      expect(useBoardObjects.getState().undoStack.length).toBe(1);
      expect(useBoardObjects.getState().redoStack.length).toBe(0);
    });
  });

  describe('delete → undo → redo', () => {
    it('undo restores deleted object, redo removes it again', () => {
      const obj = makeObject({ id: 'obj-1' });
      useBoardObjects.getState().addObjectSync(obj);
      // Clear undo stack from the create
      useBoardObjects.setState({ undoStack: [], redoStack: [] });

      useBoardObjects.getState().deleteObjectSync('obj-1');
      expect(useBoardObjects.getState().objects.has('obj-1')).toBe(false);
      expect(useBoardObjects.getState().undoStack.length).toBe(1);

      // Undo: object should be restored
      useBoardObjects.getState().undo();
      expect(useBoardObjects.getState().objects.has('obj-1')).toBe(true);
      const restored = useBoardObjects.getState().getObject('obj-1');
      expect(restored?.x).toBe(100);

      // Redo: object should be removed again
      useBoardObjects.getState().redo();
      expect(useBoardObjects.getState().objects.has('obj-1')).toBe(false);
    });
  });

  describe('update (move) → undo → redo', () => {
    it('undo reverts position, redo re-applies', () => {
      const obj = makeObject({ id: 'obj-1', x: 100, y: 200 });
      useBoardObjects.getState().addObjectSync(obj);
      useBoardObjects.setState({ undoStack: [], redoStack: [] });

      useBoardObjects
        .getState()
        .updateObjectSync('obj-1', {
          x: 500,
          y: 600,
          updated_at: new Date().toISOString(),
          version: 2,
        });

      expect(useBoardObjects.getState().getObject('obj-1')?.x).toBe(500);
      expect(useBoardObjects.getState().undoStack.length).toBe(1);

      // Undo
      useBoardObjects.getState().undo();
      expect(useBoardObjects.getState().getObject('obj-1')?.x).toBe(100);
      expect(useBoardObjects.getState().getObject('obj-1')?.y).toBe(200);

      // Redo
      useBoardObjects.getState().redo();
      expect(useBoardObjects.getState().getObject('obj-1')?.x).toBe(500);
      expect(useBoardObjects.getState().getObject('obj-1')?.y).toBe(600);
    });
  });

  describe('property change → undo', () => {
    it('undo reverts color change', () => {
      const obj = makeObject({
        id: 'obj-1',
        properties: { noteColor: '#FEF08A' },
      });
      useBoardObjects.getState().addObjectSync(obj);
      useBoardObjects.setState({ undoStack: [], redoStack: [] });

      useBoardObjects.getState().updateObjectSync('obj-1', {
        properties: { noteColor: '#FF0000' },
        updated_at: new Date().toISOString(),
        version: 2,
      });

      expect(
        useBoardObjects.getState().getObject('obj-1')?.properties.noteColor
      ).toBe('#FF0000');

      useBoardObjects.getState().undo();
      expect(
        useBoardObjects.getState().getObject('obj-1')?.properties.noteColor
      ).toBe('#FEF08A');
    });
  });

  describe('batch operations', () => {
    it('deleteSelectedSync produces a single history entry for multiple objects', () => {
      const obj1 = makeObject({ id: 'obj-1' });
      const obj2 = makeObject({ id: 'obj-2', x: 300 });
      useBoardObjects.getState().addObjectSync(obj1);
      useBoardObjects.getState().addObjectSync(obj2);
      useBoardObjects.setState({ undoStack: [], redoStack: [] });

      // Select both and delete
      useBoardObjects.getState().selectObject('obj-1');
      useBoardObjects.getState().selectObject('obj-2', true);
      useBoardObjects.getState().deleteSelectedSync();

      expect(useBoardObjects.getState().objects.size).toBe(0);
      // Should be single entry, not two
      expect(useBoardObjects.getState().undoStack.length).toBe(1);

      // Undo restores both
      useBoardObjects.getState().undo();
      expect(useBoardObjects.getState().objects.size).toBe(2);
      expect(useBoardObjects.getState().objects.has('obj-1')).toBe(true);
      expect(useBoardObjects.getState().objects.has('obj-2')).toBe(true);
    });

    it('beginHistoryBatch/commitHistoryBatch groups multiple updates into one entry', () => {
      const obj1 = makeObject({ id: 'obj-1', x: 10 });
      const obj2 = makeObject({ id: 'obj-2', x: 20 });
      useBoardObjects.getState().addObjectSync(obj1);
      useBoardObjects.getState().addObjectSync(obj2);
      useBoardObjects.setState({ undoStack: [], redoStack: [] });

      useBoardObjects.getState().beginHistoryBatch('move');
      useBoardObjects.getState().updateObjectSync('obj-1', {
        x: 100,
        updated_at: new Date().toISOString(),
        version: 2,
      });
      useBoardObjects.getState().updateObjectSync('obj-2', {
        x: 200,
        updated_at: new Date().toISOString(),
        version: 2,
      });
      useBoardObjects.getState().commitHistoryBatch();

      expect(useBoardObjects.getState().undoStack.length).toBe(1);
      expect(useBoardObjects.getState().undoStack[0].label).toBe('move');

      // Undo reverts both
      useBoardObjects.getState().undo();
      expect(useBoardObjects.getState().getObject('obj-1')?.x).toBe(10);
      expect(useBoardObjects.getState().getObject('obj-2')?.x).toBe(20);
    });
  });

  describe('redo stack clears on new action', () => {
    it('new action after undo clears redo stack', () => {
      const obj = makeObject({ id: 'obj-1' });
      useBoardObjects.getState().addObjectSync(obj);

      useBoardObjects.getState().undo();
      expect(useBoardObjects.getState().redoStack.length).toBe(1);

      // New action should clear redo
      const obj2 = makeObject({ id: 'obj-2' });
      useBoardObjects.getState().addObjectSync(obj2);
      expect(useBoardObjects.getState().redoStack.length).toBe(0);
    });
  });

  describe('remote changes do not record history', () => {
    it('addObject (Tier 1) does not push to undo stack', () => {
      const obj = makeObject({ id: 'obj-1' });
      useBoardObjects.getState().addObject(obj);

      expect(useBoardObjects.getState().objects.has('obj-1')).toBe(true);
      expect(useBoardObjects.getState().undoStack.length).toBe(0);
    });

    it('updateObject (Tier 1) does not push to undo stack', () => {
      const obj = makeObject({ id: 'obj-1' });
      useBoardObjects.getState().addObject(obj);
      useBoardObjects.getState().updateObject('obj-1', { x: 999 });

      expect(useBoardObjects.getState().undoStack.length).toBe(0);
    });

    it('deleteObject (Tier 1) does not push to undo stack', () => {
      const obj = makeObject({ id: 'obj-1' });
      useBoardObjects.getState().addObject(obj);
      useBoardObjects.getState().deleteObject('obj-1');

      expect(useBoardObjects.getState().undoStack.length).toBe(0);
    });
  });

  describe('stack size limit', () => {
    it('caps undo stack at 50 entries', () => {
      for (let i = 0; i < 60; i++) {
        const obj = makeObject({ id: `obj-${i}` });
        useBoardObjects.getState().addObjectSync(obj);
      }

      expect(useBoardObjects.getState().undoStack.length).toBe(50);
    });
  });

  describe('empty undo/redo are no-ops', () => {
    it('undo on empty stack does nothing', () => {
      const obj = makeObject({ id: 'obj-1' });
      useBoardObjects.getState().addObject(obj);

      useBoardObjects.getState().undo();
      // Object should still exist (no crash, no change)
      expect(useBoardObjects.getState().objects.has('obj-1')).toBe(true);
    });

    it('redo on empty stack does nothing', () => {
      const obj = makeObject({ id: 'obj-1' });
      useBoardObjects.getState().addObject(obj);

      useBoardObjects.getState().redo();
      expect(useBoardObjects.getState().objects.has('obj-1')).toBe(true);
    });
  });

  describe('clearHistory', () => {
    it('clears both stacks', () => {
      const obj = makeObject({ id: 'obj-1' });
      useBoardObjects.getState().addObjectSync(obj);
      useBoardObjects.getState().undo();

      expect(useBoardObjects.getState().redoStack.length).toBe(1);

      useBoardObjects.getState().clearHistory();
      expect(useBoardObjects.getState().undoStack.length).toBe(0);
      expect(useBoardObjects.getState().redoStack.length).toBe(0);
    });
  });

  describe('setBoardContext clears history', () => {
    it('history is cleared when switching boards', () => {
      const obj = makeObject({ id: 'obj-1' });
      useBoardObjects.getState().addObjectSync(obj);
      expect(useBoardObjects.getState().undoStack.length).toBe(1);

      useBoardObjects.getState().setBoardContext('other-board', 'user-1');
      expect(useBoardObjects.getState().undoStack.length).toBe(0);
      expect(useBoardObjects.getState().redoStack.length).toBe(0);
    });
  });

  describe('multiple undo/redo round-trip', () => {
    it('can undo and redo through multiple operations', () => {
      const obj = makeObject({ id: 'obj-1', x: 0 });
      useBoardObjects.getState().addObjectSync(obj);

      // Move 1
      useBoardObjects.getState().updateObjectSync('obj-1', {
        x: 100,
        updated_at: new Date().toISOString(),
        version: 2,
      });

      // Move 2
      useBoardObjects.getState().updateObjectSync('obj-1', {
        x: 200,
        updated_at: new Date().toISOString(),
        version: 3,
      });

      expect(useBoardObjects.getState().getObject('obj-1')?.x).toBe(200);
      expect(useBoardObjects.getState().undoStack.length).toBe(3);

      // Undo move 2
      useBoardObjects.getState().undo();
      expect(useBoardObjects.getState().getObject('obj-1')?.x).toBe(100);

      // Undo move 1
      useBoardObjects.getState().undo();
      expect(useBoardObjects.getState().getObject('obj-1')?.x).toBe(0);

      // Undo create
      useBoardObjects.getState().undo();
      expect(useBoardObjects.getState().objects.has('obj-1')).toBe(false);

      // Redo create
      useBoardObjects.getState().redo();
      expect(useBoardObjects.getState().objects.has('obj-1')).toBe(true);

      // Redo move 1
      useBoardObjects.getState().redo();
      expect(useBoardObjects.getState().getObject('obj-1')?.x).toBe(100);

      // Redo move 2
      useBoardObjects.getState().redo();
      expect(useBoardObjects.getState().getObject('obj-1')?.x).toBe(200);
    });
  });

  describe('_suppressHistory flag', () => {
    it('addObjectSync does not record history when _suppressHistory is true', () => {
      useBoardObjects.setState({ _suppressHistory: true });
      const obj = makeObject({ id: 'obj-1' });
      useBoardObjects.getState().addObjectSync(obj);

      expect(useBoardObjects.getState().objects.has('obj-1')).toBe(true);
      expect(useBoardObjects.getState().undoStack.length).toBe(0);
      useBoardObjects.setState({ _suppressHistory: false });
    });
  });
});
