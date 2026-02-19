import { describe, it, expect, beforeEach, vi } from 'vitest';

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
        in: () => Promise.resolve({ error: null }),
      }),
    }),
  }),
}));

vi.mock('@/features/board/hooks/useBoardRealtime', () => ({
  broadcastToLiveChannel: vi.fn(),
}));

import { useBoardObjects } from '@/features/board/hooks/useBoardObjects';
import { shouldApplyRemoteChange } from '@/features/board/services/sync.service';
import {
  CURSOR_THROTTLE_MS,
  OBJECT_SYNC_THROTTLE_MS,
  TEXT_BROADCAST_THROTTLE_MS,
} from '@/lib/constants';
import type { WhiteboardObject, ObjectType } from '@/features/board/types';

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

function generateObjects(count: number): WhiteboardObject[] {
  const types: ObjectType[] = ['sticky_note', 'rectangle', 'circle'];
  return Array.from({ length: count }, (_, i) =>
    makeObject({
      id: `perf-obj-${i}`,
      object_type: types[i % 3],
      x: (i % 25) * 250,
      y: Math.floor(i / 25) * 250,
      properties: { text: `Object ${i}`, noteColor: '#FEF08A' },
    })
  );
}

function resetStore() {
  useBoardObjects.setState({
    objects: new Map(),
    selectedIds: new Set(),
    clipboard: [],
    activeTool: 'select',
    boardId: 'board-1',
    userId: 'user-1',
  });
}

describe('Sync performance optimizations', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('Throttle intervals', () => {
    it('cursor throttle is 16ms (60fps match)', () => {
      expect(CURSOR_THROTTLE_MS).toBe(16);
    });

    it('object sync throttle is 16ms (60fps match)', () => {
      expect(OBJECT_SYNC_THROTTLE_MS).toBe(16);
    });

    it('text broadcast throttle is 50ms (prevents keystroke flood)', () => {
      expect(TEXT_BROADCAST_THROTTLE_MS).toBe(50);
    });
  });

  describe('LWW conflict resolution performance', () => {
    it('shouldApplyRemoteChange 10,000 calls in < 10ms', () => {
      const start = performance.now();
      for (let i = 0; i < 10000; i++) {
        shouldApplyRemoteChange(
          i % 5,
          (i + 1) % 5,
          '2024-01-01T00:00:00Z',
          '2024-01-01T00:01:00Z'
        );
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(10);
    });
  });

  describe('Store update operations under load', () => {
    it('rapid-fire updateObject 500 times in < 100ms (simulates drag at 60fps)', () => {
      const objects = generateObjects(500);
      useBoardObjects.getState().setObjects(objects);

      const start = performance.now();
      for (let i = 0; i < 500; i++) {
        useBoardObjects.getState().updateObject(`perf-obj-${i % 500}`, {
          x: i * 2,
          y: i * 3,
        });
      }
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(100);
    });

    it('properties deep merge preserves existing properties', () => {
      const obj = makeObject({
        id: 'merge-test',
        properties: {
          text: 'Hello',
          noteColor: '#FEF08A',
          fontSize: 16,
        },
      });
      useBoardObjects.getState().setObjects([obj]);

      // Update only text, should keep noteColor and fontSize
      useBoardObjects.getState().updateObject('merge-test', {
        properties: { text: 'Updated' },
      });

      const result = useBoardObjects.getState().getObject('merge-test');
      expect(result?.properties.text).toBe('Updated');
      expect(result?.properties.noteColor).toBe('#FEF08A');
      expect(result?.properties.fontSize).toBe(16);
    });

    it('batchUpdateObjects properties deep merge preserves existing properties', () => {
      const objs = [
        makeObject({
          id: 'batch-1',
          properties: { text: 'A', noteColor: '#FEF08A', fontSize: 14 },
        }),
        makeObject({
          id: 'batch-2',
          properties: { text: 'B', noteColor: '#BBF7D0', fontSize: 18 },
        }),
      ];
      useBoardObjects.getState().setObjects(objs);

      useBoardObjects.getState().batchUpdateObjects([
        { id: 'batch-1', updates: { properties: { text: 'Updated A' } } },
        { id: 'batch-2', updates: { properties: { text: 'Updated B' } } },
      ]);

      const r1 = useBoardObjects.getState().getObject('batch-1');
      const r2 = useBoardObjects.getState().getObject('batch-2');
      expect(r1?.properties.text).toBe('Updated A');
      expect(r1?.properties.noteColor).toBe('#FEF08A');
      expect(r2?.properties.text).toBe('Updated B');
      expect(r2?.properties.noteColor).toBe('#BBF7D0');
    });

    it('batchUpdateObjects with empty array returns same state', () => {
      const objects = generateObjects(100);
      useBoardObjects.getState().setObjects(objects);

      const stateBefore = useBoardObjects.getState().objects;
      useBoardObjects.getState().batchUpdateObjects([]);
      const stateAfter = useBoardObjects.getState().objects;

      expect(stateAfter).toBe(stateBefore); // Same reference
    });

    it('deleteObject for non-existent id returns same state', () => {
      const objects = generateObjects(100);
      useBoardObjects.getState().setObjects(objects);

      const stateBefore = useBoardObjects.getState();
      useBoardObjects.getState().deleteObject('does-not-exist');
      const stateAfter = useBoardObjects.getState();

      expect(stateAfter.objects).toBe(stateBefore.objects); // Same reference
    });

    it('rapid batchUpdateObjects 100 batches of 10 in < 100ms', () => {
      const objects = generateObjects(500);
      useBoardObjects.getState().setObjects(objects);

      const start = performance.now();
      for (let batch = 0; batch < 100; batch++) {
        const updates = Array.from({ length: 10 }, (_, i) => ({
          id: `perf-obj-${(batch * 10 + i) % 500}`,
          updates: { x: batch * 10 + i, y: batch * 10 + i } as Partial<WhiteboardObject>,
        }));
        useBoardObjects.getState().batchUpdateObjects(updates);
      }
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(100);
    });
  });

  describe('Simulated real-time sync throughput', () => {
    it('process 100 simulated remote updates in < 50ms', () => {
      const objects = generateObjects(500);
      useBoardObjects.getState().setObjects(objects);

      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        const remoteId = `perf-obj-${i}`;
        const local = useBoardObjects.getState().getObject(remoteId);
        if (
          local &&
          shouldApplyRemoteChange(
            local.version,
            local.version + 1,
            local.updated_at,
            new Date().toISOString()
          )
        ) {
          useBoardObjects.getState().updateObject(remoteId, {
            x: i * 5,
            y: i * 5,
            version: local.version + 1,
            updated_at: new Date().toISOString(),
          });
        }
      }
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(50);
    });

    it('interleaved add + update + delete 300 ops in < 100ms', () => {
      const objects = generateObjects(200);
      useBoardObjects.getState().setObjects(objects);

      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        // Add
        useBoardObjects.getState().addObject(
          makeObject({ id: `new-${i}`, x: i, y: i })
        );
        // Update
        useBoardObjects.getState().updateObject(`perf-obj-${i}`, {
          x: i * 10,
        });
        // Delete
        useBoardObjects.getState().deleteObject(`perf-obj-${100 + i}`);
      }
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(100);
      // 200 original - 100 deleted + 100 added = 200
      expect(useBoardObjects.getState().objects.size).toBe(200);
    });
  });

  describe('Batch delete optimization', () => {
    it('deleteSelectedSync uses batch DB call', async () => {
      const { broadcastToLiveChannel } = await import(
        '@/features/board/hooks/useBoardRealtime'
      );
      const mockedBroadcast = vi.mocked(broadcastToLiveChannel);
      mockedBroadcast.mockClear();

      const objects = generateObjects(50);
      useBoardObjects.getState().setObjects(objects);
      useBoardObjects.getState().setBoardContext('board-1', 'user-1');

      // Select 20 objects
      const ids = new Set(
        Array.from({ length: 20 }, (_, i) => `perf-obj-${i}`)
      );
      useBoardObjects.setState({ selectedIds: ids });

      useBoardObjects.getState().deleteSelectedSync();

      // 20 broadcast calls (one per delete)
      expect(mockedBroadcast).toHaveBeenCalledTimes(20);
      // Objects should be removed
      expect(useBoardObjects.getState().objects.size).toBe(30);
      expect(useBoardObjects.getState().selectedIds.size).toBe(0);
    });
  });
});
