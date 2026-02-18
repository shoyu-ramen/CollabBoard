import { test, expect } from '@playwright/test';
import {
  mockEmptyBoard,
  mockAIResponse,
  waitForCanvasReady,
  getKonvaShapes,
  openAIChatAndSend,
  getCanvasLocator,
} from '../helpers/board.helpers';
import { rectangleResponse, circleResponse } from '../fixtures/ai-responses';

test.describe('AI Tool: createShape', () => {
  test('creates a rectangle on the canvas', async ({ page }) => {
    const response = rectangleResponse();
    await mockEmptyBoard(page);
    await mockAIResponse(page, response);

    await page.goto('/board/test-board-id');
    await waitForCanvasReady(page);

    await openAIChatAndSend(page, 'Create a rectangle');

    // Verify tool call card in chat
    await expect(
      page.locator('text=Created rectangle shape')
    ).toBeVisible({ timeout: 5000 });

    // Verify via Konva inspection
    const shapes = await getKonvaShapes(page);
    const rect = shapes.find((s) => s.id === 'test-rect-1');
    expect(rect).toBeDefined();
    expect(rect!.x).toBe(300);
    expect(rect!.y).toBe(300);
    expect(rect!.width).toBe(150);
    expect(rect!.height).toBe(100);

    // Screenshot
    await expect(getCanvasLocator(page)).toHaveScreenshot(
      'create-rectangle.png'
    );
  });

  test('creates a circle on the canvas', async ({ page }) => {
    const response = circleResponse();
    await mockEmptyBoard(page);
    await mockAIResponse(page, response);

    await page.goto('/board/test-board-id');
    await waitForCanvasReady(page);

    await openAIChatAndSend(page, 'Create a circle');

    // Verify tool call card
    await expect(
      page.locator('text=Created circle shape')
    ).toBeVisible({ timeout: 5000 });

    // Verify via Konva inspection
    const shapes = await getKonvaShapes(page);
    const circle = shapes.find((s) => s.id === 'test-circle-1');
    expect(circle).toBeDefined();

    // Screenshot
    await expect(getCanvasLocator(page)).toHaveScreenshot(
      'create-circle.png'
    );
  });
});
