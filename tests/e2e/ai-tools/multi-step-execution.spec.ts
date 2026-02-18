import { test, expect } from '@playwright/test';
import {
  mockEmptyBoard,
  mockAIResponse,
  waitForCanvasReady,
  getKonvaShapes,
  openAIChatAndSend,
} from '../helpers/board.helpers';
import type { AIResponseBody } from '../../../src/features/ai-agent/types';
import type { WhiteboardObject } from '../../../src/features/board/types';

const BOARD_ID = 'test-board-id';
const USER_ID = 'test-user';
const TIMESTAMP = '2026-02-17T12:00:00.000Z';

function makeObject(overrides: Partial<WhiteboardObject>): WhiteboardObject {
  return {
    id: 'obj',
    board_id: BOARD_ID,
    object_type: 'sticky_note',
    x: 0,
    y: 0,
    width: 200,
    height: 200,
    rotation: 0,
    properties: {},
    updated_by: USER_ID,
    updated_at: TIMESTAMP,
    created_at: TIMESTAMP,
    version: 1,
    ...overrides,
  };
}

function journeyMapResponse(): AIResponseBody {
  const frame = makeObject({
    id: 'journey-frame',
    object_type: 'frame',
    x: 50,
    y: 50,
    width: 1200,
    height: 400,
    properties: {
      title: 'Customer Journey Map',
      fill: '#FFFFFF',
      stroke: '#CBD5E1',
      strokeWidth: 2,
    },
  });

  const stages = [
    { label: 'Awareness', color: '#BFDBFE' },
    { label: 'Consideration', color: '#BBF7D0' },
    { label: 'Decision', color: '#FEF08A' },
    { label: 'Purchase', color: '#FED7AA' },
    { label: 'Retention', color: '#E9D5FF' },
  ];

  const stageObjects = stages.map((stage, i) =>
    makeObject({
      id: `journey-stage-${i}`,
      object_type: 'sticky_note',
      x: 80 + i * 220,
      y: 120,
      width: 200,
      height: 200,
      properties: {
        text: stage.label,
        noteColor: stage.color,
        fill: stage.color,
      },
    })
  );

  const allObjects = [frame, ...stageObjects];

  return {
    reply: 'Created a customer journey map with 5 stages!',
    toolCalls: [
      {
        toolName: 'createFrame',
        input: { title: 'Customer Journey Map', width: 1200, height: 400 },
        result: 'Created frame',
        objectId: 'journey-frame',
      },
      ...stages.map((stage, i) => ({
        toolName: 'createStickyNote',
        input: { text: stage.label, color: stage.color },
        result: 'Created sticky note',
        objectId: `journey-stage-${i}`,
      })),
    ],
    createdObjects: allObjects,
  };
}

function retrospectiveResponse(): AIResponseBody {
  const frames = [
    {
      id: 'retro-frame-good',
      title: 'What went well',
      x: 50,
      color: '#BBF7D0',
    },
    {
      id: 'retro-frame-bad',
      title: "What didn't go well",
      x: 450,
      color: '#FECACA',
    },
    {
      id: 'retro-frame-actions',
      title: 'Action items',
      x: 850,
      color: '#BFDBFE',
    },
  ];

  const frameObjects = frames.map((f) =>
    makeObject({
      id: f.id,
      object_type: 'frame',
      x: f.x,
      y: 50,
      width: 350,
      height: 400,
      properties: {
        title: f.title,
        fill: '#FFFFFF',
        stroke: '#CBD5E1',
        strokeWidth: 2,
      },
    })
  );

  return {
    reply: 'Created a retrospective board with 3 columns!',
    toolCalls: frames.map((f) => ({
      toolName: 'createFrame',
      input: { title: f.title, width: 350, height: 400 },
      result: 'Created frame',
      objectId: f.id,
    })),
    createdObjects: frameObjects,
  };
}

test.describe('Multi-step AI execution', () => {
  test('journey map - frame with 5 stages', async ({ page }) => {
    const response = journeyMapResponse();
    await mockEmptyBoard(page);
    await mockAIResponse(page, response);

    await page.goto('/board/test-board-id');
    await waitForCanvasReady(page);

    await openAIChatAndSend(page, 'Create a customer journey map');

    const shapes = await getKonvaShapes(page);

    // Verify frame
    const frame = shapes.find((s) => s.id === 'journey-frame');
    expect(frame).toBeDefined();

    // Verify all 5 stage sticky notes
    for (let i = 0; i < 5; i++) {
      const stage = shapes.find((s) => s.id === `journey-stage-${i}`);
      expect(stage).toBeDefined();
    }

    // Total: 1 frame + 5 sticky notes = 6 objects
    const journeyObjects = shapes.filter((s) =>
      s.id.startsWith('journey-')
    );
    expect(journeyObjects.length).toBe(6);
  });

  test('retrospective board - 3 column frames', async ({ page }) => {
    const response = retrospectiveResponse();
    await mockEmptyBoard(page);
    await mockAIResponse(page, response);

    await page.goto('/board/test-board-id');
    await waitForCanvasReady(page);

    await openAIChatAndSend(page, 'Create a retrospective board');

    const shapes = await getKonvaShapes(page);

    // Verify all 3 frames
    const frameGood = shapes.find((s) => s.id === 'retro-frame-good');
    const frameBad = shapes.find((s) => s.id === 'retro-frame-bad');
    const frameActions = shapes.find((s) => s.id === 'retro-frame-actions');

    expect(frameGood).toBeDefined();
    expect(frameBad).toBeDefined();
    expect(frameActions).toBeDefined();

    // Verify frames are positioned left to right
    expect(frameGood!.x).toBeLessThan(frameBad!.x);
    expect(frameBad!.x).toBeLessThan(frameActions!.x);
  });
});
