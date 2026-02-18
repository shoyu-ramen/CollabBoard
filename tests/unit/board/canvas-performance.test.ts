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
      }),
    }),
  }),
}));

vi.mock('@/features/board/hooks/useBoardRealtime', () => ({
  broadcastToLiveChannel: vi.fn(),
}));

import { useBoardObjects } from '@/features/board/hooks/useBoardObjects';
import { isInViewport } from '@/features/board/utils/canvas.utils';
import { VIEWPORT_PADDING } from '@/lib/constants';
import type { WhiteboardObject, ObjectType } from '@/features/board/types';

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
    boardId: null,
    userId: null,
  });
}

describe('Canvas performance', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('Viewport culling at scale', () => {
    it('correctly filters 500+ objects to only visible ones', () => {
      const objects = generateObjects(500);

      // Viewport: 0,0 to 1920x1080 at zoom=1
      const viewportX = 0;
      const viewportY = 0;
      const viewportWidth = 1920;
      const viewportHeight = 1080;
      const zoom = 1;

      const visible = objects.filter((obj) =>
        isInViewport(obj, viewportX, viewportY, viewportWidth, viewportHeight, zoom)
      );

      // Objects are on a 25-column grid with 250px spacing
      // Viewport 1920px wide + VIEWPORT_PADDING covers columns 0..~8
      // Viewport 1080px tall + VIEWPORT_PADDING covers rows 0..~5
      // So visible should be a strict subset
      expect(visible.length).toBeGreaterThan(0);
      expect(visible.length).toBeLessThan(500);

      // Verify all visible objects actually overlap with the padded viewport
      const pad = VIEWPORT_PADDING / zoom;
      for (const obj of visible) {
        const objRight = obj.x + obj.width;
        const objBottom = obj.y + obj.height;
        expect(objRight).toBeGreaterThanOrEqual(viewportX - pad);
        expect(obj.x).toBeLessThanOrEqual(viewportX + viewportWidth / zoom + pad);
        expect(objBottom).toBeGreaterThanOrEqual(viewportY - pad);
        expect(obj.y).toBeLessThanOrEqual(viewportY + viewportHeight / zoom + pad);
      }
    });

    it('culling 500 objects completes in < 50ms', () => {
      const objects = generateObjects(500);

      const start = performance.now();
      for (const obj of objects) {
        isInViewport(obj, 0, 0, 1920, 1080, 1);
      }
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(50);
    });

    it('culling 1000 objects completes in < 50ms', () => {
      const objects = generateObjects(1000);

      const start = performance.now();
      for (const obj of objects) {
        isInViewport(obj, 0, 0, 1920, 1080, 1);
      }
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(50);
    });

    it('objects outside viewport are excluded', () => {
      const farObject = makeObject({
        id: 'far-away',
        x: 50000,
        y: 50000,
      });

      const result = isInViewport(farObject, 0, 0, 1920, 1080, 1);
      expect(result).toBe(false);
    });

    it('objects inside viewport are included', () => {
      const nearObject = makeObject({
        id: 'nearby',
        x: 500,
        y: 500,
      });

      const result = isInViewport(nearObject, 0, 0, 1920, 1080, 1);
      expect(result).toBe(true);
    });

    it('viewport culling respects zoom', () => {
      // At zoom=0.5, viewport covers 2x the world-space area
      const objects = generateObjects(500);

      const visibleAtZoom1 = objects.filter((obj) =>
        isInViewport(obj, 0, 0, 1920, 1080, 1)
      );
      const visibleAtZoomHalf = objects.filter((obj) =>
        isInViewport(obj, 0, 0, 1920, 1080, 0.5)
      );

      // More objects visible when zoomed out
      expect(visibleAtZoomHalf.length).toBeGreaterThan(visibleAtZoom1.length);
    });
  });

  describe('Store operations at scale', () => {
    it('setObjects bulk load of 500 objects completes in < 100ms', () => {
      const objects = generateObjects(500);

      const start = performance.now();
      useBoardObjects.getState().setObjects(objects);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(100);
      expect(useBoardObjects.getState().objects.size).toBe(500);
    });

    it('addObject with 500 objects already in store is fast', () => {
      const objects = generateObjects(500);
      useBoardObjects.getState().setObjects(objects);

      const newObj = makeObject({ id: 'new-obj-501' });

      const start = performance.now();
      useBoardObjects.getState().addObject(newObj);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(10);
      expect(useBoardObjects.getState().objects.size).toBe(501);
    });

    it('updateObject with 500 objects in store is fast', () => {
      const objects = generateObjects(500);
      useBoardObjects.getState().setObjects(objects);

      const start = performance.now();
      useBoardObjects.getState().updateObject('perf-obj-250', { x: 999, y: 999 });
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(10);
      expect(useBoardObjects.getState().getObject('perf-obj-250')?.x).toBe(999);
    });

    it('deleteObject with 500 objects in store is fast', () => {
      const objects = generateObjects(500);
      useBoardObjects.getState().setObjects(objects);

      const start = performance.now();
      useBoardObjects.getState().deleteObject('perf-obj-250');
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(10);
      expect(useBoardObjects.getState().objects.size).toBe(499);
    });

    it('batchUpdateObjects for 100 objects completes in < 100ms', () => {
      const objects = generateObjects(500);
      useBoardObjects.getState().setObjects(objects);

      const updates = Array.from({ length: 100 }, (_, i) => ({
        id: `perf-obj-${i}`,
        updates: { x: i * 10, y: i * 10 } as Partial<WhiteboardObject>,
      }));

      const start = performance.now();
      useBoardObjects.getState().batchUpdateObjects(updates);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(100);

      // Verify updates applied
      expect(useBoardObjects.getState().getObject('perf-obj-0')?.x).toBe(0);
      expect(useBoardObjects.getState().getObject('perf-obj-50')?.x).toBe(500);
      expect(useBoardObjects.getState().getObject('perf-obj-99')?.x).toBe(990);
    });
  });

  describe('Selection performance', () => {
    it('selectObject with 500 objects is fast (< 10ms)', () => {
      const objects = generateObjects(500);
      useBoardObjects.getState().setObjects(objects);

      const start = performance.now();
      useBoardObjects.getState().selectObject('perf-obj-250');
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(10);
      expect(useBoardObjects.getState().selectedIds.has('perf-obj-250')).toBe(true);
    });

    it('deselectAll with many selected objects is fast (< 10ms)', () => {
      const objects = generateObjects(500);
      useBoardObjects.getState().setObjects(objects);

      // Select 50 objects
      for (let i = 0; i < 50; i++) {
        useBoardObjects.getState().selectObject(`perf-obj-${i}`, true);
      }
      expect(useBoardObjects.getState().selectedIds.size).toBe(50);

      const start = performance.now();
      useBoardObjects.getState().deselectAll();
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(10);
      expect(useBoardObjects.getState().selectedIds.size).toBe(0);
    });

    it('multi-select 20 objects sequentially is fast (< 50ms total)', () => {
      const objects = generateObjects(500);
      useBoardObjects.getState().setObjects(objects);

      const start = performance.now();
      for (let i = 0; i < 20; i++) {
        useBoardObjects.getState().selectObject(`perf-obj-${i}`, true);
      }
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(50);
      expect(useBoardObjects.getState().selectedIds.size).toBe(20);
    });
  });
});
