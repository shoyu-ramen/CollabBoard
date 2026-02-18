import { test, expect } from '@playwright/test';
import {
  mockEmptyBoard,
  mockAIResponse,
  waitForCanvasReady,
  getKonvaShapes,
  openAIChatAndSend,
} from '../helpers/board.helpers';
import { resizeResponse } from '../fixtures/ai-responses';
import type { WhiteboardObject } from '../../../src/features/board/types';

test.describe('AI Tool: resizeObject', () => {
  test('resizes a rectangle to new dimensions', async ({ page }) => {
    const existingRect: WhiteboardObject = {
      id: 'existing-rect-1',
      board_id: 'test-board-id',
      object_type: 'rectangle',
      x: 200,
      y: 200,
      width: 150,
      height: 100,
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

    const response = resizeResponse('existing-rect-1', 300, 250);
    response.createdObjects = [
      { ...existingRect, width: 300, height: 250, version: 2 },
    ];
    await mockAIResponse(page, response);

    await page.goto('/board/test-board-id');
    await waitForCanvasReady(page);

    await openAIChatAndSend(page, 'Make the rectangle bigger');

    // Verify tool call card
    await expect(
      page.locator('text=Resized object to 300x250').first()
    ).toBeVisible({ timeout: 5000 });

    // Verify dimensions via Konva inspection
    const shapes = await getKonvaShapes(page);
    const rect = shapes.find((s) => s.id === 'existing-rect-1');
    expect(rect).toBeDefined();
    expect(rect!.width).toBe(300);
    expect(rect!.height).toBe(250);
  });
});
