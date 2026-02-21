import type { ClaudeToolDefinition } from '../types';

export const AI_TOOLS: ClaudeToolDefinition[] = [
  {
    name: 'createStickyNote',
    description:
      'Create a 200x200px sticky note on the whiteboard. Keep text to 6-8 words max — longer text gets cut off. Use this for short notes, ideas, or labels.',
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
      'Create a standalone text element on the whiteboard (200x100px). Use this for headings, labels, or any text without a sticky note background. Keep text short — long text will be clipped. Do NOT use backslash-n for line breaks.',
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
    name: 'createTemplate',
    description:
      'Create a complete pre-built template layout on the whiteboard. This creates a frame with properly spaced section labels and sticky notes in a single operation. ALWAYS use this tool when the user asks for a template (SWOT, Kanban, retrospective, etc.) instead of manually creating individual objects.',
    input_schema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: [
            'swot',
            'kanban',
            'retrospective',
            'pros_cons',
            'eisenhower',
            'user_journey_map',
            'empathy_map',
          ],
          description:
            'The type of template to create. "swot" = SWOT Analysis (2x2 grid), "kanban" = Kanban Board (3 columns), "retrospective" = Retro board (3 columns), "pros_cons" = Pros & Cons (2 columns), "eisenhower" = Eisenhower Matrix (2x2 grid), "user_journey_map" = User Journey Map (5 stages x 4 rows: actions, thoughts, emotions, pain points), "empathy_map" = Empathy Map (2x2: says, thinks, feels, does).',
        },
        x: {
          type: 'number',
          description:
            'X position for the top-left corner of the template (default: 100)',
        },
        y: {
          type: 'number',
          description:
            'Y position for the top-left corner of the template (default: 100)',
        },
        title: {
          type: 'string',
          description:
            'Optional custom title for the template frame. If not provided, uses the default name (e.g., "SWOT Analysis").',
        },
      },
      required: ['type'],
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
  {
    name: 'organizeBoard',
    description:
      'Rearrange all objects on the board into a clean layout. Use this when the user wants to tidy up, clean up, or organize the board. Skips arrows (they auto-recompute from connected objects).',
    input_schema: {
      type: 'object',
      properties: {
        strategy: {
          type: 'string',
          enum: ['grid', 'cluster', 'type'],
          description:
            'Layout strategy: "grid" = uniform grid, "cluster" = group nearby objects together, "type" = group by object type. Default: "grid".',
        },
        spacing: {
          type: 'number',
          description:
            'Gap in pixels between objects (default: 40)',
        },
        anchorX: {
          type: 'number',
          description:
            'X position for the top-left of the layout (default: 100)',
        },
        anchorY: {
          type: 'number',
          description:
            'Y position for the top-left of the layout (default: 100)',
        },
      },
      required: [],
    },
  },
  {
    name: 'summarizeBoard',
    description:
      'Read all text content from objects on the board and return a content digest. Use this when the user wants a summary of what is on the board. After receiving the digest, synthesize it and create summary objects (frames + sticky notes) on the board.',
    input_schema: {
      type: 'object',
      properties: {
        format: {
          type: 'string',
          enum: ['sticky_note', 'frame'],
          description:
            'How to present the summary on the board (default: "frame")',
        },
        x: {
          type: 'number',
          description: 'X position for summary output (default: 100)',
        },
        y: {
          type: 'number',
          description: 'Y position for summary output (default: 100)',
        },
      },
      required: [],
    },
  },
  {
    name: 'generateFlowchart',
    description:
      'Generate a connected flowchart diagram from a process description. Creates sticky note nodes with arrows connecting them in sequence. Use this when the user describes a process, workflow, or sequence of steps to visualize.',
    input_schema: {
      type: 'object',
      properties: {
        description: {
          type: 'string',
          description:
            'The process or workflow to visualize. Can be a comma-separated list, numbered steps, or natural language description of steps.',
        },
        direction: {
          type: 'string',
          enum: ['top-to-bottom', 'left-to-right'],
          description: 'Layout direction (default: "top-to-bottom")',
        },
        x: {
          type: 'number',
          description:
            'X position for the start of the flowchart (default: 100)',
        },
        y: {
          type: 'number',
          description:
            'Y position for the start of the flowchart (default: 100)',
        },
        nodeColor: {
          type: 'string',
          description:
            'Color for the flowchart nodes as hex (default: "#BFDBFE")',
        },
      },
      required: ['description'],
    },
  },
];
