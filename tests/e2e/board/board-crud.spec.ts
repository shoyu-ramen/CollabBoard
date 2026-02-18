import { test, expect } from '@playwright/test';
import {
  mockEmptyBoard,
  waitForCanvasReady,
  getKonvaShapes,
  getCanvasLocator,
} from '../helpers/board.helpers';
import type { WhiteboardObject } from '../../../src/features/board/types';

test.describe('Board CRUD', () => {
  test('navigates to board and canvas loads', async ({ page }) => {
    await mockEmptyBoard(page);

    await page.goto('/board/test-board-id');
    await waitForCanvasReady(page);

    // Canvas should be visible
    const canvas = getCanvasLocator(page);
    await expect(canvas).toBeVisible();
  });

  test('canvas renders empty board with no objects', async ({ page }) => {
    await mockEmptyBoard(page);

    await page.goto('/board/test-board-id');
    await waitForCanvasReady(page);

    // No objects should be on the canvas (shapes with IDs)
    const shapes = await getKonvaShapes(page);
    expect(shapes.length).toBe(0);
  });

  test('board with preloaded objects renders them', async ({ page }) => {
    const preloadedObjects: WhiteboardObject[] = [
      {
        id: 'preloaded-sticky-1',
        board_id: 'test-board-id',
        object_type: 'sticky_note',
        x: 150,
        y: 150,
        width: 200,
        height: 200,
        rotation: 0,
        properties: { text: 'Preloaded note', noteColor: '#FEF08A', fill: '#FEF08A' },
        updated_by: 'test-user',
        updated_at: '2026-02-17T12:00:00.000Z',
        created_at: '2026-02-17T12:00:00.000Z',
        version: 1,
      },
      {
        id: 'preloaded-rect-1',
        board_id: 'test-board-id',
        object_type: 'rectangle',
        x: 450,
        y: 200,
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

    await mockEmptyBoard(page, preloadedObjects);

    await page.goto('/board/test-board-id');
    await waitForCanvasReady(page);

    const shapes = await getKonvaShapes(page);
    expect(shapes.find((s) => s.id === 'preloaded-sticky-1')).toBeDefined();
    expect(shapes.find((s) => s.id === 'preloaded-rect-1')).toBeDefined();
  });

  test('delete object via keyboard', async ({ page }) => {
    const stickyObject: WhiteboardObject = {
      id: 'delete-target',
      board_id: 'test-board-id',
      object_type: 'sticky_note',
      x: 200,
      y: 200,
      width: 200,
      height: 200,
      rotation: 0,
      properties: { text: 'Delete me', noteColor: '#FEF08A', fill: '#FEF08A' },
      updated_by: 'test-user',
      updated_at: '2026-02-17T12:00:00.000Z',
      created_at: '2026-02-17T12:00:00.000Z',
      version: 1,
    };

    await mockEmptyBoard(page, [stickyObject]);

    await page.goto('/board/test-board-id');
    await waitForCanvasReady(page);

    // Verify object exists
    let shapes = await getKonvaShapes(page);
    expect(shapes.find((s) => s.id === 'delete-target')).toBeDefined();

    // Click on the object to select it (center of the sticky note)
    const canvas = getCanvasLocator(page);
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();

    // The sticky note is at (200, 200) with 200x200 size, center at ~(300, 300)
    // Account for canvas position on screen
    await page.mouse.click(
      canvasBox!.x + 300,
      canvasBox!.y + 300
    );
    await page.waitForTimeout(300);

    // Press Delete key
    await page.keyboard.press('Delete');
    await page.waitForTimeout(300);

    // Verify object is removed
    shapes = await getKonvaShapes(page);
    const deleted = shapes.find((s) => s.id === 'delete-target');
    expect(deleted).toBeUndefined();
  });
});
