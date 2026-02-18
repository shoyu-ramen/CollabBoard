import { test, expect } from '@playwright/test';
import {
  mockEmptyBoard,
  mockAIResponse,
  waitForCanvasReady,
  getKonvaShapes,
  openAIChatAndSend,
  getCanvasLocator,
} from '../helpers/board.helpers';
import { changeColorResponse } from '../fixtures/ai-responses';
import type { WhiteboardObject } from '../../../src/features/board/types';

test.describe('AI Tool: changeColor', () => {
  test('changes the color of a rectangle', async ({ page }) => {
    const existingRect: WhiteboardObject = {
      id: 'existing-rect-color',
      board_id: 'test-board-id',
      object_type: 'rectangle',
      x: 250,
      y: 250,
      width: 200,
      height: 150,
      rotation: 0,
      properties: {
        fill: '#93C5FD',
        stroke: '#000000',
        strokeWidth: 2,
      },
      updated_by: 'test-user',
      updated_at: '2026-02-17T12:00:00.000Z',
      created_at: '2026-02-17T12:00:00.000Z',
      version: 1,
    };

    await mockEmptyBoard(page, [existingRect]);

    const newColor = '#F87171';
    const response = changeColorResponse('existing-rect-color', newColor);
    response.createdObjects = [
      {
        ...existingRect,
        properties: { ...existingRect.properties, fill: newColor },
        version: 2,
      },
    ];
    await mockAIResponse(page, response);

    await page.goto('/board/test-board-id');
    await waitForCanvasReady(page);

    await openAIChatAndSend(page, 'Change the rectangle color to red');

    // Verify tool call card (use .first() to avoid matching the reply text too)
    await expect(
      page.locator(`text=Changed color to ${newColor}`).first()
    ).toBeVisible({ timeout: 5000 });

    // Verify color changed via Konva inspection
    const shapes = await getKonvaShapes(page);
    const rect = shapes.find((s) => s.id === 'existing-rect-color');
    expect(rect).toBeDefined();
    expect(rect!.fill).toBe(newColor);

    // Screenshot
    await expect(getCanvasLocator(page)).toHaveScreenshot(
      'change-color.png'
    );
  });
});
