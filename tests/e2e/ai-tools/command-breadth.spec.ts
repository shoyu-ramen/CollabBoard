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
  rectangleResponse,
  moveResponse,
  changeColorResponse,
  multiToolSwotResponse,
} from '../fixtures/ai-responses';
import type { WhiteboardObject } from '../../../src/features/board/types';

test.describe('AI command breadth', () => {
  test('creation - sticky note', async ({ page }) => {
    const response = stickyNoteResponse();
    await mockEmptyBoard(page);
    await mockAIResponse(page, response);

    await page.goto('/board/test-board-id');
    await waitForCanvasReady(page);

    await openAIChatAndSend(page, 'Create a sticky note');

    const shapes = await getKonvaShapes(page);
    const sticky = shapes.find((s) => s.id === 'test-sticky-1');
    expect(sticky).toBeDefined();
    expect(sticky!.x).toBe(200);
    expect(sticky!.y).toBe(200);
  });

  test('creation - rectangle shape', async ({ page }) => {
    const response = rectangleResponse();
    await mockEmptyBoard(page);
    await mockAIResponse(page, response);

    await page.goto('/board/test-board-id');
    await waitForCanvasReady(page);

    await openAIChatAndSend(page, 'Create a rectangle');

    const shapes = await getKonvaShapes(page);
    const rect = shapes.find((s) => s.id === 'test-rect-1');
    expect(rect).toBeDefined();
    expect(rect!.x).toBe(300);
    expect(rect!.y).toBe(300);
  });

  test('manipulation - move object', async ({ page }) => {
    const preloadedObject: WhiteboardObject = {
      id: 'move-target',
      board_id: 'test-board-id',
      object_type: 'sticky_note',
      x: 200,
      y: 200,
      width: 200,
      height: 200,
      rotation: 0,
      properties: { text: 'Move me', noteColor: '#FEF08A', fill: '#FEF08A' },
      updated_by: 'test-user',
      updated_at: '2026-02-17T12:00:00.000Z',
      created_at: '2026-02-17T12:00:00.000Z',
      version: 1,
    };

    const response = moveResponse('move-target', 500, 400);
    await mockEmptyBoard(page, [preloadedObject]);
    await mockAIResponse(page, response);

    await page.goto('/board/test-board-id');
    await waitForCanvasReady(page);

    // Verify object is at original position
    const shapes = await getKonvaShapes(page);
    const obj = shapes.find((s) => s.id === 'move-target');
    expect(obj).toBeDefined();
    expect(obj!.x).toBe(200);
    expect(obj!.y).toBe(200);

    await openAIChatAndSend(page, 'Move the sticky note to 500, 400');

    // Verify the AI reply is shown
    await expect(
      page.locator('text=Moved object to (500, 400)').first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('manipulation - change color', async ({ page }) => {
    const preloadedObject: WhiteboardObject = {
      id: 'color-target',
      board_id: 'test-board-id',
      object_type: 'sticky_note',
      x: 200,
      y: 200,
      width: 200,
      height: 200,
      rotation: 0,
      properties: { text: 'Color me', noteColor: '#FEF08A', fill: '#FEF08A' },
      updated_by: 'test-user',
      updated_at: '2026-02-17T12:00:00.000Z',
      created_at: '2026-02-17T12:00:00.000Z',
      version: 1,
    };

    const response = changeColorResponse('color-target', '#FF0000');
    await mockEmptyBoard(page, [preloadedObject]);
    await mockAIResponse(page, response);

    await page.goto('/board/test-board-id');
    await waitForCanvasReady(page);

    await openAIChatAndSend(page, 'Change the sticky note color to red');

    // Verify the AI reply is shown
    await expect(
      page.locator('text=Changed color to #FF0000').first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('complex - SWOT template', async ({ page }) => {
    const response = multiToolSwotResponse();
    await mockEmptyBoard(page);
    await mockAIResponse(page, response);

    await page.goto('/board/test-board-id');
    await waitForCanvasReady(page);

    await openAIChatAndSend(page, 'Create a SWOT analysis');

    const shapes = await getKonvaShapes(page);

    // Verify frame
    const frame = shapes.find((s) => s.id === 'swot-frame');
    expect(frame).toBeDefined();

    // Verify 4 sticky notes
    const strengths = shapes.find((s) => s.id === 'swot-strengths');
    const weaknesses = shapes.find((s) => s.id === 'swot-weaknesses');
    const opportunities = shapes.find((s) => s.id === 'swot-opportunities');
    const threats = shapes.find((s) => s.id === 'swot-threats');

    expect(strengths).toBeDefined();
    expect(weaknesses).toBeDefined();
    expect(opportunities).toBeDefined();
    expect(threats).toBeDefined();
  });
});
