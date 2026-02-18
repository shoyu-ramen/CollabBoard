import { test, expect } from '@playwright/test';
import {
  mockEmptyBoard,
  mockAIResponse,
  waitForCanvasReady,
  getKonvaShapes,
  openAIChatAndSend,
} from '../helpers/board.helpers';
import { stickyNoteResponse } from '../fixtures/ai-responses';

test.describe('AI Tool: createStickyNote', () => {
  test('creates a sticky note on the canvas', async ({ page }) => {
    const response = stickyNoteResponse();
    await mockEmptyBoard(page);
    await mockAIResponse(page, response);

    await page.goto('/board/test-board-id');
    await waitForCanvasReady(page);

    await openAIChatAndSend(page, 'Create a sticky note');

    // Verify tool call card appears in chat
    await expect(
      page.locator('text=Created sticky note')
    ).toBeVisible({ timeout: 5000 });

    // Verify via Konva inspection
    const shapes = await getKonvaShapes(page);
    const stickyNote = shapes.find((s) => s.id === 'test-sticky-1');
    expect(stickyNote).toBeDefined();
    expect(stickyNote!.x).toBe(200);
    expect(stickyNote!.y).toBe(200);
  });

  test('creates a sticky note with custom color', async ({ page }) => {
    const response = stickyNoteResponse({
      id: 'test-sticky-custom',
      properties: {
        text: 'Custom color note',
        noteColor: '#FCA5A5',
        fill: '#FCA5A5',
      },
    });
    await mockEmptyBoard(page);
    await mockAIResponse(page, response);

    await page.goto('/board/test-board-id');
    await waitForCanvasReady(page);

    await openAIChatAndSend(page, 'Create a red sticky note');

    const shapes = await getKonvaShapes(page);
    const stickyNote = shapes.find((s) => s.id === 'test-sticky-custom');
    expect(stickyNote).toBeDefined();
  });
});
