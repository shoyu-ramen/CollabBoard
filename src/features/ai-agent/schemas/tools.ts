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
    name: 'createText',
    description:
      'Create a standalone text element on the whiteboard. Use this for headings, labels, or any text without a sticky note background.',
    input_schema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'The text content',
        },
        x: {
          type: 'number',
          description: 'X position on the canvas (default: 100)',
        },
        y: {
          type: 'number',
          description: 'Y position on the canvas (default: 100)',
        },
        fontSize: {
          type: 'number',
          description: 'Font size in pixels (default: 20)',
        },
        color: {
          type: 'string',
          description: 'Text color as hex (default: "#1a1a1a")',
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
      'Create an arrow/connector between two objects or two points on the whiteboard. Prefer using fromId/toId to connect objects so the arrow tracks them when they move.',
    input_schema: {
      type: 'object',
      properties: {
        fromId: {
          type: 'string',
          description: 'ID of the source object to connect from',
        },
        toId: {
          type: 'string',
          description: 'ID of the target object to connect to',
        },
        fromSide: {
          type: 'string',
          enum: ['top-50', 'right-50', 'bottom-50', 'left-50'],
          description: 'Anchor side on the source object (default: auto-computed)',
        },
        toSide: {
          type: 'string',
          enum: ['top-50', 'right-50', 'bottom-50', 'left-50'],
          description: 'Anchor side on the target object (default: auto-computed)',
        },
        x1: {
          type: 'number',
          description: 'Start X coordinate (fallback if fromId not provided)',
        },
        y1: {
          type: 'number',
          description: 'Start Y coordinate (fallback if fromId not provided)',
        },
        x2: {
          type: 'number',
          description: 'End X coordinate (fallback if toId not provided)',
        },
        y2: {
          type: 'number',
          description: 'End Y coordinate (fallback if toId not provided)',
        },
        color: {
          type: 'string',
          description: 'Arrow color (default: "#000000")',
        },
      },
      required: [],
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
    name: 'deleteObject',
    description:
      'Delete an existing object from the whiteboard. Use this to remove sticky notes, shapes, frames, connectors, or any other object.',
    input_schema: {
      type: 'object',
      properties: {
        objectId: {
          type: 'string',
          description: 'The ID of the object to delete',
        },
      },
      required: ['objectId'],
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
