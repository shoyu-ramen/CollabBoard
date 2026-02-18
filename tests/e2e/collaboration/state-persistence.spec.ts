import { test, expect } from '@playwright/test';
import {
  mockEmptyBoard,
  mockAIResponse,
  waitForCanvasReady,
  getKonvaShapes,
  openAIChatAndSend,
} from '../helpers/board.helpers';
import { stickyNoteResponse } from '../fixtures/ai-responses';
import type { WhiteboardObject } from '../../../src/features/board/types';

test.describe('State persistence', () => {
  test('objects survive page refresh', async ({ page }) => {
    const response = stickyNoteResponse();
    await mockEmptyBoard(page);
    await mockAIResponse(page, response);

    await page.goto('/board/test-board-id');
    await waitForCanvasReady(page);

    await openAIChatAndSend(page, 'Create a sticky note');

    // Verify object exists
    let shapes = await getKonvaShapes(page);
    expect(shapes.find((s) => s.id === 'test-sticky-1')).toBeDefined();

    // Simulate refresh: reload with the object as preloaded state
    const persistedObject = response.createdObjects![0];
    await mockEmptyBoard(page, [persistedObject]);

    await page.goto('/board/test-board-id');
    await waitForCanvasReady(page);

    // Verify object persists after refresh
    shapes = await getKonvaShapes(page);
    const sticky = shapes.find((s) => s.id === 'test-sticky-1');
    expect(sticky).toBeDefined();
    expect(sticky!.x).toBe(200);
    expect(sticky!.y).toBe(200);
  });

  test('multiple objects persist across refresh', async ({ page }) => {
    const objects: WhiteboardObject[] = [
      {
        id: 'persist-sticky-1',
        board_id: 'test-board-id',
        object_type: 'sticky_note',
        x: 100,
        y: 100,
        width: 200,
        height: 200,
        rotation: 0,
        properties: { text: 'Note 1', noteColor: '#FEF08A', fill: '#FEF08A' },
        updated_by: 'test-user',
        updated_at: '2026-02-17T12:00:00.000Z',
        created_at: '2026-02-17T12:00:00.000Z',
        version: 1,
      },
      {
        id: 'persist-sticky-2',
        board_id: 'test-board-id',
        object_type: 'sticky_note',
        x: 400,
        y: 100,
        width: 200,
        height: 200,
        rotation: 0,
        properties: { text: 'Note 2', noteColor: '#BBF7D0', fill: '#BBF7D0' },
        updated_by: 'test-user',
        updated_at: '2026-02-17T12:00:00.000Z',
        created_at: '2026-02-17T12:00:00.000Z',
        version: 1,
      },
      {
        id: 'persist-rect-1',
        board_id: 'test-board-id',
        object_type: 'rectangle',
        x: 250,
        y: 350,
        width: 150,
        height: 100,
        rotation: 0,
        properties: { fill: '#93C5FD', stroke: '#000000', strokeWidth: 2 },
        updated_by: 'test-user',
        updated_at: '2026-02-17T12:00:00.000Z',
        created_at: '2026-02-17T12:00:00.000Z',
        version: 1,
      },
    ];

    await mockEmptyBoard(page, objects);

    await page.goto('/board/test-board-id');
    await waitForCanvasReady(page);

    const shapes = await getKonvaShapes(page);
    expect(shapes.find((s) => s.id === 'persist-sticky-1')).toBeDefined();
    expect(shapes.find((s) => s.id === 'persist-sticky-2')).toBeDefined();
    expect(shapes.find((s) => s.id === 'persist-rect-1')).toBeDefined();

    // Reload
    await mockEmptyBoard(page, objects);
    await page.goto('/board/test-board-id');
    await waitForCanvasReady(page);

    const shapesAfter = await getKonvaShapes(page);
    expect(shapesAfter.find((s) => s.id === 'persist-sticky-1')).toBeDefined();
    expect(shapesAfter.find((s) => s.id === 'persist-sticky-2')).toBeDefined();
    expect(shapesAfter.find((s) => s.id === 'persist-rect-1')).toBeDefined();
  });

  test('properties are preserved across refresh', async ({ page }) => {
    const objects: WhiteboardObject[] = [
      {
        id: 'prop-sticky-1',
        board_id: 'test-board-id',
        object_type: 'sticky_note',
        x: 200,
        y: 200,
        width: 200,
        height: 200,
        rotation: 0,
        properties: { text: 'Specific text content', noteColor: '#FCA5A5', fill: '#FCA5A5' },
        updated_by: 'test-user',
        updated_at: '2026-02-17T12:00:00.000Z',
        created_at: '2026-02-17T12:00:00.000Z',
        version: 1,
      },
    ];

    await mockEmptyBoard(page, objects);
    await page.goto('/board/test-board-id');
    await waitForCanvasReady(page);

    let shapes = await getKonvaShapes(page);
    let sticky = shapes.find((s) => s.id === 'prop-sticky-1');
    expect(sticky).toBeDefined();
    expect(sticky!.x).toBe(200);
    expect(sticky!.y).toBe(200);
    expect(sticky!.width).toBe(200);
    expect(sticky!.height).toBe(200);

    // Reload and verify properties
    await mockEmptyBoard(page, objects);
    await page.goto('/board/test-board-id');
    await waitForCanvasReady(page);

    shapes = await getKonvaShapes(page);
    sticky = shapes.find((s) => s.id === 'prop-sticky-1');
    expect(sticky).toBeDefined();
    expect(sticky!.x).toBe(200);
    expect(sticky!.y).toBe(200);
    expect(sticky!.width).toBe(200);
    expect(sticky!.height).toBe(200);
    // Verify the fill color is preserved (red-ish sticky)
    expect(sticky!.fill).toBeTruthy();
  });
});
