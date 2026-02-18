import { test, expect } from '@playwright/test';
import {
  mockEmptyBoard,
  waitForCanvasReady,
  getKonvaShapes,
  getCanvasLocator,
} from '../helpers/board.helpers';
import type { WhiteboardObject } from '../../../src/features/board/types';

const stickyObject: WhiteboardObject = {
  id: 'interact-sticky-1',
  board_id: 'test-board-id',
  object_type: 'sticky_note',
  x: 200,
  y: 200,
  width: 200,
  height: 200,
  rotation: 0,
  properties: { text: 'Interactive note', noteColor: '#FEF08A', fill: '#FEF08A' },
  updated_by: 'test-user',
  updated_at: '2026-02-17T12:00:00.000Z',
  created_at: '2026-02-17T12:00:00.000Z',
  version: 1,
};

test.describe('Canvas interactions', () => {
  test('zoom via scroll changes canvas scale', async ({ page }) => {
    await mockEmptyBoard(page);

    await page.goto('/board/test-board-id');
    await waitForCanvasReady(page);

    const canvas = getCanvasLocator(page);
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();

    // Get initial scale
    const initialScale = await page.evaluate(() => {
      const stage = (window as unknown as Record<string, unknown>)
        .__KONVA_STAGE__ as { scaleX: () => number } | undefined;
      return stage?.scaleX() ?? 1;
    });

    // Scroll to zoom in (negative deltaY = zoom in for most implementations)
    await page.mouse.move(
      canvasBox!.x + canvasBox!.width / 2,
      canvasBox!.y + canvasBox!.height / 2
    );
    await page.mouse.wheel(0, -300);
    await page.waitForTimeout(500);

    const newScale = await page.evaluate(() => {
      const stage = (window as unknown as Record<string, unknown>)
        .__KONVA_STAGE__ as { scaleX: () => number } | undefined;
      return stage?.scaleX() ?? 1;
    });

    // Scale should have changed (zoomed in = larger scale)
    expect(newScale).not.toBe(initialScale);
  });

  test('select object by clicking on it', async ({ page }) => {
    await mockEmptyBoard(page, [stickyObject]);

    await page.goto('/board/test-board-id');
    await waitForCanvasReady(page);

    const canvas = getCanvasLocator(page);
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();

    // Click on the center of the sticky note (200,200 + 100,100 offset = 300,300)
    await page.mouse.click(
      canvasBox!.x + 300,
      canvasBox!.y + 300
    );
    await page.waitForTimeout(300);

    // Check that a Transformer or selection indicator appears
    // Konva Transformers have the class 'Transformer'
    const hasTransformer = await page.evaluate(() => {
      const stage = (window as unknown as Record<string, unknown>)
        .__KONVA_STAGE__ as {
        find: (selector: string) => Array<{ visible: () => boolean }>;
      } | undefined;
      if (!stage) return false;
      const transformers = stage.find('Transformer');
      return transformers.some((t) => t.visible());
    });

    expect(hasTransformer).toBe(true);
  });

  test('move object by drag', async ({ page }) => {
    await mockEmptyBoard(page, [stickyObject]);

    await page.goto('/board/test-board-id');
    await waitForCanvasReady(page);

    const canvas = getCanvasLocator(page);
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();

    // Get initial position
    let shapes = await getKonvaShapes(page);
    let sticky = shapes.find((s) => s.id === 'interact-sticky-1');
    expect(sticky).toBeDefined();
    const initialX = sticky!.x;
    const initialY = sticky!.y;

    // Drag from center of sticky (300, 300) to (500, 400)
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
    sticky = shapes.find((s) => s.id === 'interact-sticky-1');
    expect(sticky).toBeDefined();
    // Position should have changed from the drag
    const moved = sticky!.x !== initialX || sticky!.y !== initialY;
    expect(moved).toBe(true);
  });

  test('delete selected object with Delete key', async ({ page }) => {
    await mockEmptyBoard(page, [stickyObject]);

    await page.goto('/board/test-board-id');
    await waitForCanvasReady(page);

    const canvas = getCanvasLocator(page);
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();

    // Click to select
    await page.mouse.click(
      canvasBox!.x + 300,
      canvasBox!.y + 300
    );
    await page.waitForTimeout(300);

    // Press Delete
    await page.keyboard.press('Delete');
    await page.waitForTimeout(300);

    // Verify object is gone
    const shapes = await getKonvaShapes(page);
    expect(shapes.find((s) => s.id === 'interact-sticky-1')).toBeUndefined();
  });

  test('deselect by clicking empty area', async ({ page }) => {
    await mockEmptyBoard(page, [stickyObject]);

    await page.goto('/board/test-board-id');
    await waitForCanvasReady(page);

    const canvas = getCanvasLocator(page);
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();

    // Click to select the object
    await page.mouse.click(
      canvasBox!.x + 300,
      canvasBox!.y + 300
    );
    await page.waitForTimeout(300);

    // Verify selected (transformer visible)
    let hasTransformer = await page.evaluate(() => {
      const stage = (window as unknown as Record<string, unknown>)
        .__KONVA_STAGE__ as {
        find: (selector: string) => Array<{ visible: () => boolean }>;
      } | undefined;
      if (!stage) return false;
      const transformers = stage.find('Transformer');
      return transformers.some((t) => t.visible());
    });
    expect(hasTransformer).toBe(true);

    // Click on empty area (far from the object but within canvas bounds)
    await page.mouse.click(
      canvasBox!.x + Math.min(600, canvasBox!.width - 20),
      canvasBox!.y + 50
    );
    await page.waitForTimeout(300);

    // Verify deselected
    hasTransformer = await page.evaluate(() => {
      const stage = (window as unknown as Record<string, unknown>)
        .__KONVA_STAGE__ as {
        find: (selector: string) => Array<{ visible: () => boolean }>;
      } | undefined;
      if (!stage) return false;
      const transformers = stage.find('Transformer');
      return transformers.some((t) => t.visible());
    });
    expect(hasTransformer).toBe(false);
  });
});
