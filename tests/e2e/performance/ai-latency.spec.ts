import { test, expect } from '@playwright/test';
import {
  mockEmptyBoard,
  mockAIResponse,
  waitForCanvasReady,
  getKonvaShapes,
  openAIChatAndSend,
} from '../helpers/board.helpers';
import {
  stickyNoteResponse,
  multiToolSwotResponse,
} from '../fixtures/ai-responses';
import { measureOperationTime } from '../helpers/performance.helpers';

test.describe('AI response latency', () => {
  test('single-step command (mocked) completes in < 2 seconds', async ({
    page,
  }) => {
    const response = stickyNoteResponse({ id: 'ai-latency-sticky' });
    await mockEmptyBoard(page);
    await mockAIResponse(page, response);

    await page.goto('/board/test-board-id');
    await waitForCanvasReady(page);

    const elapsed = await measureOperationTime(async () => {
      await openAIChatAndSend(page, 'Create a sticky note');
    });

    // Verify the object appeared
    const shapes = await getKonvaShapes(page);
    expect(shapes.find((s) => s.id === 'ai-latency-sticky')).toBeDefined();

    console.log(
      `[perf] Single-step AI command latency (mocked): ${elapsed}ms`
    );
    // Mocked AI, so this tests the UI processing overhead only
    expect(elapsed).toBeLessThan(2000);
  });

  test('multi-step command (SWOT template, mocked) completes in < 10 seconds', async ({
    page,
  }) => {
    const response = multiToolSwotResponse();
    await mockEmptyBoard(page);
    await mockAIResponse(page, response);

    await page.goto('/board/test-board-id');
    await waitForCanvasReady(page);

    const elapsed = await measureOperationTime(async () => {
      await openAIChatAndSend(page, 'Create a SWOT analysis');
    });

    // Verify all 5 objects (frame + 4 sticky notes)
    const shapes = await getKonvaShapes(page);
    const swotShapes = shapes.filter((s) => s.id.startsWith('swot-'));
    expect(swotShapes.length).toBe(5);

    console.log(
      `[perf] Multi-step AI command latency (SWOT, mocked): ${elapsed}ms`
    );
    expect(elapsed).toBeLessThan(10000);
  });

  test('AI response produces visible canvas changes', async ({ page }) => {
    const response = stickyNoteResponse({
      id: 'ai-visible-check',
      properties: { text: 'Visible check', noteColor: '#BBF7D0', fill: '#BBF7D0' },
    });
    await mockEmptyBoard(page);
    await mockAIResponse(page, response);

    await page.goto('/board/test-board-id');
    await waitForCanvasReady(page);

    // Get initial shape count
    const shapesBefore = await getKonvaShapes(page);
    const countBefore = shapesBefore.filter((s) => s.id.startsWith('ai-')).length;

    await openAIChatAndSend(page, 'Create a green sticky note');

    const shapesAfter = await getKonvaShapes(page);
    const countAfter = shapesAfter.filter((s) => s.id.startsWith('ai-')).length;

    // At least one new shape appeared
    expect(countAfter).toBeGreaterThan(countBefore);
  });

  // Live AI test — skipped unless LIVE_AI_TESTS=true
  test('live AI single-step command < 2 seconds', async ({ page }) => {
    test.skip(
      process.env.LIVE_AI_TESTS !== 'true',
      'Set LIVE_AI_TESTS=true to run live AI tests'
    );

    // Don't mock AI endpoint — let it hit the real API
    await mockEmptyBoard(page);

    await page.goto('/board/test-board-id');
    await waitForCanvasReady(page);

    const elapsed = await measureOperationTime(async () => {
      await openAIChatAndSend(page, 'Create a yellow sticky note that says hello');
    });

    console.log(`[perf] Live AI single-step command latency: ${elapsed}ms`);
    expect(elapsed).toBeLessThan(5000); // More generous for live API
  });
});
