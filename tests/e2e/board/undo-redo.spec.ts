import { test, expect } from '@playwright/test';
import {
  mockEmptyBoard,
  waitForCanvasReady,
  getKonvaShapes,
  getCanvasLocator,
} from '../helpers/board.helpers';
import type { WhiteboardObject } from '../../../src/features/board/types';

const isMac = process.platform === 'darwin';
const mod = isMac ? 'Meta' : 'Control';

const stickyObject: WhiteboardObject = {
  id: 'undo-sticky-1',
  board_id: 'test-board-id',
  object_type: 'sticky_note',
  x: 200,
  y: 200,
  width: 200,
  height: 200,
  rotation: 0,
  properties: {
    text: 'Undo test note',
    noteColor: '#FEF08A',
    fill: '#FEF08A',
  },
  updated_by: 'test-user',
  updated_at: '2026-02-17T12:00:00.000Z',
  created_at: '2026-02-17T12:00:00.000Z',
  version: 1,
};

test.describe('Undo/Redo', () => {
  test('delete shape → Cmd+Z restores it', async ({ page }) => {
    await mockEmptyBoard(page, [stickyObject]);
    await page.goto('/board/test-board-id');
    await waitForCanvasReady(page);

    const canvas = getCanvasLocator(page);
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();

    // Click to select the sticky note
    await page.mouse.click(canvasBox!.x + 300, canvasBox!.y + 300);
    await page.waitForTimeout(300);

    // Delete it
    await page.keyboard.press('Delete');
    await page.waitForTimeout(300);

    // Verify gone
    let shapes = await getKonvaShapes(page);
    expect(
      shapes.find((s) => s.id === 'undo-sticky-1')
    ).toBeUndefined();

    // Undo: Cmd+Z
    await page.keyboard.press(`${mod}+z`);
    await page.waitForTimeout(500);

    // Verify restored
    shapes = await getKonvaShapes(page);
    const restored = shapes.find((s) => s.id === 'undo-sticky-1');
    expect(restored).toBeDefined();
  });

  test('move shape → Cmd+Z reverts position', async ({ page }) => {
    await mockEmptyBoard(page, [stickyObject]);
    await page.goto('/board/test-board-id');
    await waitForCanvasReady(page);

    const canvas = getCanvasLocator(page);
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();

    // Get initial position
    let shapes = await getKonvaShapes(page);
    const initial = shapes.find((s) => s.id === 'undo-sticky-1');
    expect(initial).toBeDefined();
    const initialX = initial!.x;
    const initialY = initial!.y;

    // Drag the shape
    const startX = canvasBox!.x + 300;
    const startY = canvasBox!.y + 300;
    const endX = canvasBox!.x + 500;
    const endY = canvasBox!.y + 400;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    // Verify position changed
    shapes = await getKonvaShapes(page);
    const moved = shapes.find((s) => s.id === 'undo-sticky-1');
    expect(moved).toBeDefined();
    expect(moved!.x !== initialX || moved!.y !== initialY).toBe(true);

    // Undo: Cmd+Z
    await page.keyboard.press(`${mod}+z`);
    await page.waitForTimeout(500);

    // Verify position reverted
    shapes = await getKonvaShapes(page);
    const reverted = shapes.find((s) => s.id === 'undo-sticky-1');
    expect(reverted).toBeDefined();
    // Position should be back to original (or very close)
    expect(Math.abs(reverted!.x - initialX)).toBeLessThan(5);
    expect(Math.abs(reverted!.y - initialY)).toBeLessThan(5);
  });

  test('delete → Cmd+Z → Cmd+Shift+Z round-trip', async ({ page }) => {
    await mockEmptyBoard(page, [stickyObject]);
    await page.goto('/board/test-board-id');
    await waitForCanvasReady(page);

    const canvas = getCanvasLocator(page);
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();

    // Click to select
    await page.mouse.click(canvasBox!.x + 300, canvasBox!.y + 300);
    await page.waitForTimeout(300);

    // Delete
    await page.keyboard.press('Delete');
    await page.waitForTimeout(300);

    // Undo
    await page.keyboard.press(`${mod}+z`);
    await page.waitForTimeout(500);

    let shapes = await getKonvaShapes(page);
    expect(shapes.find((s) => s.id === 'undo-sticky-1')).toBeDefined();

    // Redo: Cmd+Shift+Z
    await page.keyboard.press(`${mod}+Shift+z`);
    await page.waitForTimeout(500);

    // Should be gone again
    shapes = await getKonvaShapes(page);
    expect(
      shapes.find((s) => s.id === 'undo-sticky-1')
    ).toBeUndefined();
  });
});
