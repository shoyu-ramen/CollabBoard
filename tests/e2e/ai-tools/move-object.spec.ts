import { test, expect } from '@playwright/test';
import {
  mockEmptyBoard,
  mockAIResponse,
  waitForCanvasReady,
  getKonvaShapes,
  openAIChatAndSend,
} from '../helpers/board.helpers';
import { moveResponse } from '../fixtures/ai-responses';
import type { WhiteboardObject } from '../../../src/features/board/types';

test.describe('AI Tool: moveObject', () => {
  test('moves a sticky note to a new position', async ({ page }) => {
    // Pre-load a sticky note on the board
    const existingNote: WhiteboardObject = {
      id: 'existing-note-1',
      board_id: 'test-board-id',
      object_type: 'sticky_note',
      x: 100,
      y: 100,
      width: 200,
      height: 200,
      rotation: 0,
      properties: {
        text: 'Move me',
        noteColor: '#FEF08A',
        fill: '#FEF08A',
      },
      updated_by: 'test-user',
      updated_at: '2026-02-17T12:00:00.000Z',
      created_at: '2026-02-17T12:00:00.000Z',
      version: 1,
    };

    await mockEmptyBoard(page, [existingNote]);

    // The AI response for moving the object. The createdObjects array
    // returns the updated version so the client hydrates it.
    const response = moveResponse('existing-note-1', 500, 400);
    response.createdObjects = [{ ...existingNote, x: 500, y: 400, version: 2 }];
    await mockAIResponse(page, response);

    await page.goto('/board/test-board-id');
    await waitForCanvasReady(page);

    await openAIChatAndSend(page, 'Move the note to position 500, 400');

    // Verify tool call card
    await expect(
      page.locator('text=Moved object to (500, 400)').first()
    ).toBeVisible({ timeout: 5000 });

    // Verify position changed via Konva inspection
    const shapes = await getKonvaShapes(page);
    const moved = shapes.find((s) => s.id === 'existing-note-1');
    expect(moved).toBeDefined();
    expect(moved!.x).toBe(500);
    expect(moved!.y).toBe(400);
  });
});
