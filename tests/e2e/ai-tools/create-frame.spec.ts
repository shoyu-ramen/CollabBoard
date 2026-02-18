import { test, expect } from '@playwright/test';
import {
  mockEmptyBoard,
  mockAIResponse,
  waitForCanvasReady,
  getKonvaShapes,
  openAIChatAndSend,
  getCanvasLocator,
} from '../helpers/board.helpers';
import { frameResponse } from '../fixtures/ai-responses';

test.describe('AI Tool: createFrame', () => {
  test('creates a frame on the canvas', async ({ page }) => {
    const response = frameResponse();
    await mockEmptyBoard(page);
    await mockAIResponse(page, response);

    await page.goto('/board/test-board-id');
    await waitForCanvasReady(page);

    await openAIChatAndSend(page, 'Create a frame');

    // Verify tool call card
    await expect(page.locator('text=Created frame').first()).toBeVisible({
      timeout: 5000,
    });

    // Verify via Konva inspection
    const shapes = await getKonvaShapes(page);
    const frame = shapes.find((s) => s.id === 'test-frame-1');
    expect(frame).toBeDefined();
    expect(frame!.x).toBe(100);
    expect(frame!.y).toBe(100);

    // Screenshot
    await expect(getCanvasLocator(page)).toHaveScreenshot(
      'create-frame.png'
    );
  });
});
