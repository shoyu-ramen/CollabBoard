import type { AIResponseBody } from '../../../src/features/ai-agent/types';
import type { WhiteboardObject } from '../../../src/features/board/types';

const BOARD_ID = 'test-board-id';
const USER_ID = 'test-user';

function makeTimestamp(): string {
  return '2026-02-17T12:00:00.000Z';
}

function baseObject(
  overrides: Partial<WhiteboardObject>
): WhiteboardObject {
  return {
    id: 'test-obj-1',
    board_id: BOARD_ID,
    object_type: 'sticky_note',
    x: 200,
    y: 200,
    width: 200,
    height: 200,
    rotation: 0,
    properties: {},
    updated_by: USER_ID,
    updated_at: makeTimestamp(),
    created_at: makeTimestamp(),
    version: 1,
    ...overrides,
  };
}

// --- Creation tools ---

export function stickyNoteResponse(
  overrides?: Partial<WhiteboardObject>
): AIResponseBody {
  const obj = baseObject({
    id: 'test-sticky-1',
    object_type: 'sticky_note',
    x: 200,
    y: 200,
    width: 200,
    height: 200,
    properties: {
      text: 'Test note',
      noteColor: '#FEF08A',
      fill: '#FEF08A',
    },
    ...overrides,
  });

  return {
    reply: 'Created a sticky note for you!',
    toolCalls: [
      {
        toolName: 'createStickyNote',
        input: { text: 'Test note', color: '#FEF08A' },
        result: 'Created sticky note',
        objectId: obj.id,
      },
    ],
    createdObjects: [obj],
  };
}

export function rectangleResponse(
  overrides?: Partial<WhiteboardObject>
): AIResponseBody {
  const obj = baseObject({
    id: 'test-rect-1',
    object_type: 'rectangle',
    x: 300,
    y: 300,
    width: 150,
    height: 100,
    properties: {
      fill: '#93C5FD',
      stroke: '#000000',
      strokeWidth: 2,
    },
    ...overrides,
  });

  return {
    reply: 'Created a rectangle!',
    toolCalls: [
      {
        toolName: 'createShape',
        input: { type: 'rectangle', color: '#93C5FD' },
        result: 'Created rectangle shape',
        objectId: obj.id,
      },
    ],
    createdObjects: [obj],
  };
}

export function circleResponse(
  overrides?: Partial<WhiteboardObject>
): AIResponseBody {
  const obj = baseObject({
    id: 'test-circle-1',
    object_type: 'circle',
    x: 400,
    y: 400,
    width: 120,
    height: 120,
    properties: {
      fill: '#86EFAC',
      stroke: '#000000',
      strokeWidth: 2,
    },
    ...overrides,
  });

  return {
    reply: 'Created a circle!',
    toolCalls: [
      {
        toolName: 'createShape',
        input: { type: 'circle', color: '#86EFAC' },
        result: 'Created circle shape',
        objectId: obj.id,
      },
    ],
    createdObjects: [obj],
  };
}

export function frameResponse(
  overrides?: Partial<WhiteboardObject>
): AIResponseBody {
  const obj = baseObject({
    id: 'test-frame-1',
    object_type: 'frame',
    x: 100,
    y: 100,
    width: 500,
    height: 400,
    properties: {
      title: 'Test Frame',
      fill: '#FFFFFF',
      stroke: '#CBD5E1',
      strokeWidth: 2,
    },
    ...overrides,
  });

  return {
    reply: 'Created a frame!',
    toolCalls: [
      {
        toolName: 'createFrame',
        input: { title: 'Test Frame', width: 500, height: 400 },
        result: 'Created frame',
        objectId: obj.id,
      },
    ],
    createdObjects: [obj],
  };
}

export function connectorResponse(
  overrides?: Partial<WhiteboardObject>
): AIResponseBody {
  const obj = baseObject({
    id: 'test-arrow-1',
    object_type: 'arrow',
    x: 200,
    y: 200,
    width: 200,
    height: 100,
    properties: {
      stroke: '#000000',
      strokeWidth: 2,
      points: [0, 0, 200, 100],
    },
    ...overrides,
  });

  return {
    reply: 'Created an arrow connector!',
    toolCalls: [
      {
        toolName: 'createConnector',
        input: {
          startX: 200,
          startY: 200,
          endX: 400,
          endY: 300,
        },
        result: 'Created connector',
        objectId: obj.id,
      },
    ],
    createdObjects: [obj],
  };
}

// --- Mutation tools ---

export function moveResponse(
  objectId: string,
  newX: number,
  newY: number
): AIResponseBody {
  return {
    reply: `Moved object to (${newX}, ${newY}).`,
    toolCalls: [
      {
        toolName: 'moveObject',
        input: { objectId, x: newX, y: newY },
        result: `Moved object to (${newX}, ${newY})`,
        objectId,
      },
    ],
    // moveObject modifies existing object — the AI response may include
    // the updated object so the client can apply it locally.
    createdObjects: [],
  };
}

export function resizeResponse(
  objectId: string,
  newWidth: number,
  newHeight: number
): AIResponseBody {
  return {
    reply: `Resized object to ${newWidth}x${newHeight}.`,
    toolCalls: [
      {
        toolName: 'resizeObject',
        input: { objectId, width: newWidth, height: newHeight },
        result: `Resized object to ${newWidth}x${newHeight}`,
        objectId,
      },
    ],
    createdObjects: [],
  };
}

export function updateTextResponse(
  objectId: string,
  newText: string
): AIResponseBody {
  return {
    reply: `Updated text to "${newText}".`,
    toolCalls: [
      {
        toolName: 'updateText',
        input: { objectId, text: newText },
        result: `Updated text content`,
        objectId,
      },
    ],
    createdObjects: [],
  };
}

export function changeColorResponse(
  objectId: string,
  newColor: string
): AIResponseBody {
  return {
    reply: `Changed color to ${newColor}.`,
    toolCalls: [
      {
        toolName: 'changeColor',
        input: { objectId, color: newColor },
        result: `Changed color to ${newColor}`,
        objectId,
      },
    ],
    createdObjects: [],
  };
}

// --- Multi-tool ---

export function multiToolSwotResponse(): AIResponseBody {
  const frame = baseObject({
    id: 'swot-frame',
    object_type: 'frame',
    x: 100,
    y: 100,
    width: 600,
    height: 500,
    properties: {
      title: 'SWOT Analysis',
      fill: '#FFFFFF',
      stroke: '#CBD5E1',
      strokeWidth: 2,
    },
  });

  const strengths = baseObject({
    id: 'swot-strengths',
    object_type: 'sticky_note',
    x: 120,
    y: 150,
    width: 250,
    height: 200,
    properties: {
      text: 'Strengths',
      noteColor: '#BBF7D0',
      fill: '#BBF7D0',
    },
  });

  const weaknesses = baseObject({
    id: 'swot-weaknesses',
    object_type: 'sticky_note',
    x: 430,
    y: 150,
    width: 250,
    height: 200,
    properties: {
      text: 'Weaknesses',
      noteColor: '#FECACA',
      fill: '#FECACA',
    },
  });

  const opportunities = baseObject({
    id: 'swot-opportunities',
    object_type: 'sticky_note',
    x: 120,
    y: 380,
    width: 250,
    height: 200,
    properties: {
      text: 'Opportunities',
      noteColor: '#BFDBFE',
      fill: '#BFDBFE',
    },
  });

  const threats = baseObject({
    id: 'swot-threats',
    object_type: 'sticky_note',
    x: 430,
    y: 380,
    width: 250,
    height: 200,
    properties: {
      text: 'Threats',
      noteColor: '#FEF08A',
      fill: '#FEF08A',
    },
  });

  return {
    reply: 'Created a SWOT analysis template with a frame and 4 quadrants!',
    toolCalls: [
      {
        toolName: 'createFrame',
        input: { title: 'SWOT Analysis', width: 600, height: 500 },
        result: 'Created frame',
        objectId: 'swot-frame',
      },
      {
        toolName: 'createStickyNote',
        input: { text: 'Strengths', color: '#BBF7D0' },
        result: 'Created sticky note',
        objectId: 'swot-strengths',
      },
      {
        toolName: 'createStickyNote',
        input: { text: 'Weaknesses', color: '#FECACA' },
        result: 'Created sticky note',
        objectId: 'swot-weaknesses',
      },
      {
        toolName: 'createStickyNote',
        input: { text: 'Opportunities', color: '#BFDBFE' },
        result: 'Created sticky note',
        objectId: 'swot-opportunities',
      },
      {
        toolName: 'createStickyNote',
        input: { text: 'Threats', color: '#FEF08A' },
        result: 'Created sticky note',
        objectId: 'swot-threats',
      },
    ],
    createdObjects: [frame, strengths, weaknesses, opportunities, threats],
  };
}
