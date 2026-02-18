import { test, expect } from '@playwright/test';
import {
  mockEmptyBoard,
  mockAIResponse,
  waitForCanvasReady,
  getKonvaShapes,
  openAIChatAndSend,
} from '../helpers/board.helpers';
import { stickyNoteResponse } from '../fixtures/ai-responses';
import type { WhiteboardObject } from '../../../src/features/board/types';

/**
 * Multi-user editing tests.
 *
 * NOTE: True real-time multi-user sync requires a running Supabase instance
 * with WebSocket support. These tests use a mock-based approach to simulate
 * multi-user scenarios by sharing object state across page reloads.
 * For full integration testing, run against a live backend.
 */
test.describe('Two-user editing (mock-based)', () => {
  const sharedObject: WhiteboardObject = {
    id: 'shared-sticky-1',
    board_id: 'test-board-id',
    object_type: 'sticky_note',
    x: 200,
    y: 200,
    width: 200,
    height: 200,
    rotation: 0,
    properties: {
      text: 'Created by User A',
      noteColor: '#FEF08A',
      fill: '#FEF08A',
    },
    updated_by: 'user-a',
    updated_at: '2026-02-17T12:00:00.000Z',
    created_at: '2026-02-17T12:00:00.000Z',
    version: 1,
  };

  test('User A creates object, appears for User B on reload', async ({
    browser,
  }) => {
    // Create two browser contexts (simulating two users)
    const contextA = await browser.newContext({
      storageState: 'tests/e2e/.auth/user.json',
    });
    const contextB = await browser.newContext({
      storageState: 'tests/e2e/.auth/user.json',
    });

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      // User A: set up board and create a sticky note via AI
      const aiResponse = stickyNoteResponse({
        id: sharedObject.id,
        properties: sharedObject.properties,
      });
      await mockEmptyBoard(pageA);
      await mockAIResponse(pageA, aiResponse);

      await pageA.goto('/board/test-board-id');
      await waitForCanvasReady(pageA);

      await openAIChatAndSend(pageA, 'Create a sticky note');

      // Verify the object appears on User A's canvas
      const shapesA = await getKonvaShapes(pageA);
      const stickyA = shapesA.find((s) => s.id === sharedObject.id);
      expect(stickyA).toBeDefined();

      // User B: load board with the object already present (simulating sync)
      await mockEmptyBoard(pageB, [sharedObject]);

      await pageB.goto('/board/test-board-id');
      await waitForCanvasReady(pageB);

      // Verify the object appears on User B's canvas
      const shapesB = await getKonvaShapes(pageB);
      const stickyB = shapesB.find((s) => s.id === sharedObject.id);
      expect(stickyB).toBeDefined();
      expect(stickyB!.x).toBe(200);
      expect(stickyB!.y).toBe(200);
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test('Both users create objects simultaneously', async ({ browser }) => {
    const contextA = await browser.newContext({
      storageState: 'tests/e2e/.auth/user.json',
    });
    const contextB = await browser.newContext({
      storageState: 'tests/e2e/.auth/user.json',
    });

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      const objectA: WhiteboardObject = {
        ...sharedObject,
        id: 'user-a-sticky',
        properties: { text: 'From User A', noteColor: '#FEF08A', fill: '#FEF08A' },
        updated_by: 'user-a',
      };

      const objectB: WhiteboardObject = {
        ...sharedObject,
        id: 'user-b-sticky',
        x: 500,
        y: 300,
        properties: { text: 'From User B', noteColor: '#BBF7D0', fill: '#BBF7D0' },
        updated_by: 'user-b',
      };

      // User A creates their object
      await mockEmptyBoard(pageA);
      await mockAIResponse(pageA, stickyNoteResponse({ id: objectA.id, properties: objectA.properties }));

      await pageA.goto('/board/test-board-id');
      await waitForCanvasReady(pageA);
      await openAIChatAndSend(pageA, 'Create a note');

      const shapesA = await getKonvaShapes(pageA);
      expect(shapesA.find((s) => s.id === objectA.id)).toBeDefined();

      // User B creates their object
      await mockEmptyBoard(pageB);
      await mockAIResponse(pageB, stickyNoteResponse({
        id: objectB.id,
        x: objectB.x,
        y: objectB.y,
        properties: objectB.properties,
      }));

      await pageB.goto('/board/test-board-id');
      await waitForCanvasReady(pageB);
      await openAIChatAndSend(pageB, 'Create a note');

      const shapesB = await getKonvaShapes(pageB);
      expect(shapesB.find((s) => s.id === objectB.id)).toBeDefined();

      // Simulate merged state: reload both pages with both objects
      await mockEmptyBoard(pageA, [objectA, objectB]);
      await pageA.goto('/board/test-board-id');
      await waitForCanvasReady(pageA);

      const mergedShapesA = await getKonvaShapes(pageA);
      expect(mergedShapesA.find((s) => s.id === objectA.id)).toBeDefined();
      expect(mergedShapesA.find((s) => s.id === objectB.id)).toBeDefined();

      await mockEmptyBoard(pageB, [objectA, objectB]);
      await pageB.goto('/board/test-board-id');
      await waitForCanvasReady(pageB);

      const mergedShapesB = await getKonvaShapes(pageB);
      expect(mergedShapesB.find((s) => s.id === objectA.id)).toBeDefined();
      expect(mergedShapesB.find((s) => s.id === objectB.id)).toBeDefined();
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
