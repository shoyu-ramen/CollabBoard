import { test, expect } from '@playwright/test';
import {
  mockEmptyBoard,
  mockAIResponse,
  waitForCanvasReady,
  getKonvaShapes,
  openAIChatAndSend,
} from '../helpers/board.helpers';
import { updateTextResponse } from '../fixtures/ai-responses';
import type { WhiteboardObject } from '../../../src/features/board/types';

test.describe('AI Tool: updateText', () => {
  test('updates text on a sticky note', async ({ page }) => {
    const existingNote: WhiteboardObject = {
      id: 'existing-note-text',
      board_id: 'test-board-id',
      object_type: 'sticky_note',
      x: 200,
      y: 200,
      width: 200,
      height: 200,
      rotation: 0,
      properties: {
        text: 'Old text',
        noteColor: '#FEF08A',
        fill: '#FEF08A',
      },
      updated_by: 'test-user',
      updated_at: '2026-02-17T12:00:00.000Z',
      created_at: '2026-02-17T12:00:00.000Z',
      version: 1,
    };

    await mockEmptyBoard(page, [existingNote]);

    const response = updateTextResponse('existing-note-text', 'Updated text content');
    response.createdObjects = [
      {
        ...existingNote,
        properties: { ...existingNote.properties, text: 'Updated text content' },
        version: 2,
      },
    ];
    await mockAIResponse(page, response);

    await page.goto('/board/test-board-id');
    await waitForCanvasReady(page);

    await openAIChatAndSend(page, 'Change the text');

    // Verify tool call card appears in chat
    await expect(
      page.locator('text=Updated text content').first()
    ).toBeVisible({ timeout: 5000 });

    // Verify text changed via Konva inspection
    const shapes = await getKonvaShapes(page);
    const note = shapes.find((s) => s.id === 'existing-note-text');
    expect(note).toBeDefined();
    expect(note!.text).toBe('Updated text content');
  });
});
