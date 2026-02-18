import { test, expect } from '@playwright/test';
import {
  mockEmptyBoard,
  mockAIResponse,
  waitForCanvasReady,
  getKonvaShapes,
  openAIChatAndSend,
} from '../helpers/board.helpers';
import { multiToolSwotResponse } from '../fixtures/ai-responses';

test.describe('AI Tool: multi-tool template', () => {
  test('creates a SWOT analysis template with frame and 4 sticky notes', async ({
    page,
  }) => {
    const response = multiToolSwotResponse();
    await mockEmptyBoard(page);
    await mockAIResponse(page, response);

    await page.goto('/board/test-board-id');
    await waitForCanvasReady(page);

    await openAIChatAndSend(page, 'Create a SWOT analysis template');

    // Verify multiple tool call cards appear in the chat
    await expect(page.locator('text=Created frame').first()).toBeVisible({
      timeout: 5000,
    });

    // Verify all 5 objects (1 frame + 4 sticky notes) via Konva inspection
    const shapes = await getKonvaShapes(page);

    const frame = shapes.find((s) => s.id === 'swot-frame');
    expect(frame).toBeDefined();
    expect(frame!.x).toBe(100);
    expect(frame!.y).toBe(100);

    const strengths = shapes.find((s) => s.id === 'swot-strengths');
    expect(strengths).toBeDefined();
    expect(strengths!.x).toBe(120);
    expect(strengths!.y).toBe(150);

    const weaknesses = shapes.find((s) => s.id === 'swot-weaknesses');
    expect(weaknesses).toBeDefined();
    expect(weaknesses!.x).toBe(430);
    expect(weaknesses!.y).toBe(150);

    const opportunities = shapes.find((s) => s.id === 'swot-opportunities');
    expect(opportunities).toBeDefined();
    expect(opportunities!.x).toBe(120);
    expect(opportunities!.y).toBe(380);

    const threats = shapes.find((s) => s.id === 'swot-threats');
    expect(threats).toBeDefined();
    expect(threats!.x).toBe(430);
    expect(threats!.y).toBe(380);

    // Verify object count — at least 5 objects with IDs
    const objectsWithIds = shapes.filter((s) => s.id.startsWith('swot-'));
    expect(objectsWithIds.length).toBe(5);
  });

  test('all SWOT sticky notes have different colors', async ({ page }) => {
    const response = multiToolSwotResponse();
    await mockEmptyBoard(page);
    await mockAIResponse(page, response);

    await page.goto('/board/test-board-id');
    await waitForCanvasReady(page);

    await openAIChatAndSend(page, 'Create a SWOT analysis');

    const shapes = await getKonvaShapes(page);
    const stickyIds = [
      'swot-strengths',
      'swot-weaknesses',
      'swot-opportunities',
      'swot-threats',
    ];

    const fills = stickyIds
      .map((id) => shapes.find((s) => s.id === id)?.fill)
      .filter(Boolean);

    // All 4 colors should be unique
    const uniqueFills = new Set(fills);
    expect(uniqueFills.size).toBe(4);
  });
});
