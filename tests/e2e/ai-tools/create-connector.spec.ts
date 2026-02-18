import { test, expect } from '@playwright/test';
import {
  mockEmptyBoard,
  mockAIResponse,
  waitForCanvasReady,
  getKonvaShapes,
  openAIChatAndSend,
  getCanvasLocator,
} from '../helpers/board.helpers';
import { connectorResponse } from '../fixtures/ai-responses';

test.describe('AI Tool: createConnector', () => {
  test('creates an arrow connector on the canvas', async ({ page }) => {
    const response = connectorResponse();
    await mockEmptyBoard(page);
    await mockAIResponse(page, response);

    await page.goto('/board/test-board-id');
    await waitForCanvasReady(page);

    await openAIChatAndSend(page, 'Create an arrow');

    // Verify tool call card (formatToolCallLabel returns "Created arrow")
    await expect(page.locator('text=Created arrow').first()).toBeVisible({
      timeout: 5000,
    });

    // Verify via Konva inspection
    const shapes = await getKonvaShapes(page);
    const arrow = shapes.find((s) => s.id === 'test-arrow-1');
    expect(arrow).toBeDefined();
    expect(arrow!.x).toBe(200);
    expect(arrow!.y).toBe(200);

    // Screenshot
    await expect(getCanvasLocator(page)).toHaveScreenshot(
      'create-connector.png'
    );
  });
});
