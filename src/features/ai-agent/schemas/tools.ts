import type { ClaudeToolDefinition } from '../types';

export const AI_TOOLS: ClaudeToolDefinition[] = [
  {
    name: 'createStickyNote',
    description:
      'Create a sticky note on the whiteboard. Use this to add text-based notes, ideas, or labels.',
    input_schema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'The text content of the sticky note',
        },
        x: {
          type: 'number',
          description: 'X position on the canvas (default: 100)',
        },
        y: {
          type: 'number',
          description: 'Y position on the canvas (default: 100)',
        },
        color: {
          type: 'string',
          description:
            'Background color of the sticky note as hex (e.g., "#FEF08A" for yellow, "#BBF7D0" for green, "#BFDBFE" for blue, "#FBCFE8" for pink, "#FED7AA" for orange, "#E9D5FF" for purple). Default: "#FEF08A"',
        },
      },
      required: ['text'],
    },
  },
  {
    name: 'createShape',
    description:
      'Create a shape (rectangle, circle, or line) on the whiteboard.',
    input_schema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['rectangle', 'circle', 'line'],
          description: 'The type of shape to create',
        },
        x: {
          type: 'number',
          description: 'X position on the canvas',
        },
        y: {
          type: 'number',
          description: 'Y position on the canvas',
        },
        width: {
          type: 'number',
          description: 'Width of the shape (default: 150)',
        },
        height: {
          type: 'number',
          description: 'Height of the shape (default: 100)',
        },
        color: {
          type: 'string',
          description: 'Fill color as hex (default: "#3B82F6")',
        },
      },
      required: ['type'],
    },
  },
  {
    name: 'createFrame',
    description:
      'Create a frame (grouping container) on the whiteboard. Use this to visually group related items together, like sections in a template.',
    input_schema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'The title label for the frame',
        },
        x: {
          type: 'number',
          description: 'X position on the canvas',
        },
        y: {
          type: 'number',
          description: 'Y position on the canvas',
        },
        width: {
          type: 'number',
          description: 'Width of the frame (default: 400)',
        },
        height: {
          type: 'number',
          description: 'Height of the frame (default: 300)',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'createConnector',
    description:
      'Create a connector line between two existing objects on the whiteboard.',
    input_schema: {
      type: 'object',
      properties: {
        fromId: {
          type: 'string',
          description: 'The ID of the source object',
        },
        toId: {
          type: 'string',
          description: 'The ID of the target object',
        },
        style: {
          type: 'string',
          enum: ['solid', 'dashed', 'arrow'],
          description: 'Line style (default: "arrow")',
        },
      },
      required: ['fromId', 'toId'],
    },
  },
  {
    name: 'moveObject',
    description: 'Move an existing object to a new position on the whiteboard.',
    input_schema: {
      type: 'object',
      properties: {
        objectId: {
          type: 'string',
          description: 'The ID of the object to move',
        },
        x: {
          type: 'number',
          description: 'New X position',
        },
        y: {
          type: 'number',
          description: 'New Y position',
        },
      },
      required: ['objectId', 'x', 'y'],
    },
  },
  {
    name: 'resizeObject',
    description: 'Resize an existing object on the whiteboard.',
    input_schema: {
      type: 'object',
      properties: {
        objectId: {
          type: 'string',
          description: 'The ID of the object to resize',
        },
        width: {
          type: 'number',
          description: 'New width',
        },
        height: {
          type: 'number',
          description: 'New height',
        },
      },
      required: ['objectId', 'width', 'height'],
    },
  },
  {
    name: 'updateText',
    description:
      'Update the text content of an existing sticky note or text object.',
    input_schema: {
      type: 'object',
      properties: {
        objectId: {
          type: 'string',
          description: 'The ID of the object to update',
        },
        newText: {
          type: 'string',
          description: 'The new text content',
        },
      },
      required: ['objectId', 'newText'],
    },
  },
  {
    name: 'changeColor',
    description:
      'Change the color of an existing object on the whiteboard.',
    input_schema: {
      type: 'object',
      properties: {
        objectId: {
          type: 'string',
          description: 'The ID of the object to change color',
        },
        color: {
          type: 'string',
          description: 'New color as hex string (e.g., "#FF0000")',
        },
      },
      required: ['objectId', 'color'],
    },
  },
  {
    name: 'getBoardState',
    description:
      'Get the current state of all objects on the whiteboard. Use this to understand what is already on the board before making changes.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
];
