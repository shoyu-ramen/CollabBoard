import { test, expect } from '@playwright/test';
import {
  mockEmptyBoard,
  mockAIResponse,
  waitForCanvasReady,
  getKonvaShapes,
  openAIChatAndSend,
} from '../helpers/board.helpers';
import { stickyNoteResponse, rectangleResponse } from '../fixtures/ai-responses';
import type { AIResponseBody } from '../../../src/features/ai-agent/types';
import type { WhiteboardObject } from '../../../src/features/board/types';

function manyStickiesResponse(count: number): AIResponseBody {
  const objects: WhiteboardObject[] = Array.from({ length: count }, (_, i) => ({
    id: `batch-sticky-${i}`,
    board_id: 'test-board-id',
    object_type: 'sticky_note' as const,
    x: 100 + (i % 5) * 220,
    y: 100 + Math.floor(i / 5) * 220,
    width: 200,
    height: 200,
    rotation: 0,
    properties: { text: `Note ${i + 1}`, noteColor: '#FEF08A', fill: '#FEF08A' },
    updated_by: 'test-user',
    updated_at: '2026-02-17T12:00:00.000Z',
    created_at: '2026-02-17T12:00:00.000Z',
    version: 1,
  }));
  return {
    reply: `Created ${count} sticky notes!`,
    toolCalls: objects.map((o) => ({
      toolName: 'createStickyNote',
      input: { text: o.properties.text },
      result: 'Created sticky note',
      objectId: o.id,
    })),
    createdObjects: objects,
  };
}

test.describe('Rapid operations', () => {
  test('rapid creation of 20 sticky notes in single response', async ({
    page,
  }) => {
    const response = manyStickiesResponse(20);
    await mockEmptyBoard(page);
    await mockAIResponse(page, response);

    await page.goto('/board/test-board-id');
    await waitForCanvasReady(page);

    await openAIChatAndSend(page, 'Create 20 sticky notes');

    // Verify all 20 sticky notes appear on the canvas
    const shapes = await getKonvaShapes(page);
    const batchStickies = shapes.filter((s) => s.id.startsWith('batch-sticky-'));
    expect(batchStickies.length).toBe(20);
  });

  test('multiple sequential AI requests create all objects', async ({
    page,
  }) => {
    await mockEmptyBoard(page);

    // First request: sticky note
    const response1 = stickyNoteResponse({ id: 'seq-sticky-1' });
    await mockAIResponse(page, response1);

    await page.goto('/board/test-board-id');
    await waitForCanvasReady(page);

    await openAIChatAndSend(page, 'Create a sticky note');

    let shapes = await getKonvaShapes(page);
    expect(shapes.find((s) => s.id === 'seq-sticky-1')).toBeDefined();

    // Second request: rectangle
    const response2 = rectangleResponse({ id: 'seq-rect-1' });
    // Re-mock AI endpoint for second response
    await page.unroute('**/api/ai');
    await mockAIResponse(page, response2);

    await openAIChatAndSend(page, 'Create a rectangle');

    shapes = await getKonvaShapes(page);
    expect(shapes.find((s) => s.id === 'seq-sticky-1')).toBeDefined();
    expect(shapes.find((s) => s.id === 'seq-rect-1')).toBeDefined();

    // Third request: another sticky note
    const response3 = stickyNoteResponse({
      id: 'seq-sticky-2',
      x: 500,
      y: 500,
      properties: { text: 'Third object', noteColor: '#BBF7D0', fill: '#BBF7D0' },
    });
    await page.unroute('**/api/ai');
    await mockAIResponse(page, response3);

    await openAIChatAndSend(page, 'Create another sticky note');

    shapes = await getKonvaShapes(page);
    expect(shapes.find((s) => s.id === 'seq-sticky-1')).toBeDefined();
    expect(shapes.find((s) => s.id === 'seq-rect-1')).toBeDefined();
    expect(shapes.find((s) => s.id === 'seq-sticky-2')).toBeDefined();
  });

  test('operations complete in reasonable time', async ({ page }) => {
    const response = manyStickiesResponse(20);
    await mockEmptyBoard(page);
    await mockAIResponse(page, response);

    await page.goto('/board/test-board-id');
    await waitForCanvasReady(page);

    const startTime = Date.now();

    await openAIChatAndSend(page, 'Create 20 sticky notes');

    // Verify all objects appeared
    const shapes = await getKonvaShapes(page);
    const batchStickies = shapes.filter((s) => s.id.startsWith('batch-sticky-'));
    expect(batchStickies.length).toBe(20);

    const elapsed = Date.now() - startTime;
    // Should complete within 5 seconds (mocked AI, so only rendering time)
    expect(elapsed).toBeLessThan(5000);
  });
});
