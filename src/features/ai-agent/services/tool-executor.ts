import { v4 as uuidv4 } from 'uuid';
import { createServiceClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import type { ObjectType } from '@/features/board/types';
import type { ToolCallResult, BoardStateSummary, AIRequestContext } from '../types';
import {
  DEFAULT_STICKY_WIDTH,
  DEFAULT_STICKY_HEIGHT,
  DEFAULT_STICKY_COLORS,
  DEFAULT_SHAPE_WIDTH,
  DEFAULT_SHAPE_HEIGHT,
  DEFAULT_SHAPE_COLOR,
  DEFAULT_FRAME_WIDTH,
  DEFAULT_FRAME_HEIGHT,
  DEFAULT_STROKE_WIDTH,
  DEFAULT_TEXT_FONT_SIZE,
  DEFAULT_TEXT_COLOR,
  DEFAULT_TEXT_FONT_FAMILY,
  DEFAULT_LINE_COLOR,
  DEFAULT_LINE_WIDTH,
} from '@/lib/constants';

/**
 * Strip HTML tags and decode common entities for server-side text sanitization.
 * This runs on AI-generated text before inserting into the database.
 */
export function sanitize(text: string): string {
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .trim();
}

/**
 * Compute anchor position on an object's bounding box for a given side.
 * Supports midpoints (e.g. 'top-50', 'right-50') used by createConnector.
 */
export function getAnchorPosition(
  x: number,
  y: number,
  width: number,
  height: number,
  side: string
): { x: number; y: number } {
  switch (side) {
    case 'top':
    case 'top-50':
      return { x: x + width / 2, y };
    case 'right':
    case 'right-50':
      return { x: x + width, y: y + height / 2 };
    case 'bottom':
    case 'bottom-50':
      return { x: x + width / 2, y: y + height };
    case 'left':
    case 'left-50':
      return { x, y: y + height / 2 };
    default:
      // Default to center
      return { x: x + width / 2, y: y + height / 2 };
  }
}

interface InsertObject {
  id: string;
  board_id: string;
  object_type: ObjectType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  properties: Record<string, unknown>;
  updated_by: string;
  version: number;
}

async function insertObject(
  boardId: string,
  objectType: ObjectType,
  x: number,
  y: number,
  width: number,
  height: number,
  properties: Record<string, unknown>,
  userId: string
): Promise<{ id: string; error?: string }> {
  const supabase = await createServiceClient();
  const id = uuidv4();
  const obj: InsertObject = {
    id,
    board_id: boardId,
    object_type: objectType,
    x,
    y,
    width,
    height,
    rotation: 0,
    properties,
    updated_by: userId,
    version: 1,
  };

  const { error } = await supabase.from('whiteboard_objects').insert(obj);
  if (error) {
    return { id: '', error: error.message };
  }
  return { id };
}

export async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  boardId: string,
  userId: string,
  ctx?: AIRequestContext
): Promise<ToolCallResult> {
  const toolStart = Date.now();
  const result = await executeToolInner(toolName, input, boardId, userId);
  const durationMs = Date.now() - toolStart;
  const success = !result.result.startsWith('Error');

  if (ctx) {
    if (success) {
      logger.info('ai.tool.execute', {
        requestId: ctx.requestId,
        toolName,
        durationMs,
        success,
        objectId: result.objectId,
        boardId,
      });
    } else {
      logger.warn('ai.tool.error', {
        requestId: ctx.requestId,
        toolName,
        durationMs,
        error: result.result,
        boardId,
      });
    }
  }

  return result;
}

async function executeToolInner(
  toolName: string,
  input: Record<string, unknown>,
  boardId: string,
  userId: string
): Promise<ToolCallResult> {
  const supabase = await createServiceClient();

  switch (toolName) {
    case 'createStickyNote': {
      const text = sanitize((input.text as string) || '');
      const x = (input.x as number) ?? 100;
      const y = (input.y as number) ?? 100;
      const color =
        (input.color as string) ?? DEFAULT_STICKY_COLORS[0];

      const { id, error } = await insertObject(
        boardId,
        'sticky_note',
        x,
        y,
        DEFAULT_STICKY_WIDTH,
        DEFAULT_STICKY_HEIGHT,
        { text, noteColor: color, fill: color },
        userId
      );

      if (error) {
        return {
          toolName,
          input,
          result: `Error creating sticky note: ${error}`,
        };
      }
      return {
        toolName,
        input,
        result: `Created sticky note "${text}" at (${x}, ${y})`,
        objectId: id,
      };
    }

    case 'createText': {
      const text = sanitize((input.text as string) || '');
      const x = (input.x as number) ?? 100;
      const y = (input.y as number) ?? 100;
      const fontSize = (input.fontSize as number) ?? DEFAULT_TEXT_FONT_SIZE;
      const color = (input.color as string) ?? DEFAULT_TEXT_COLOR;

      const { id, error } = await insertObject(
        boardId,
        'text',
        x,
        y,
        0,
        0,
        {
          text,
          fontSize,
          fontFamily: DEFAULT_TEXT_FONT_FAMILY,
          color,
          textAlign: 'left',
        },
        userId
      );

      if (error) {
        return {
          toolName,
          input,
          result: `Error creating text: ${error}`,
        };
      }
      return {
        toolName,
        input,
        result: `Created text "${text}" at (${x}, ${y})`,
        objectId: id,
      };
    }

    case 'createShape': {
      const shapeType = input.type as string;
      if (!['rectangle', 'circle', 'line'].includes(shapeType)) {
        return {
          toolName,
          input,
          result: `Invalid shape type: ${shapeType}. Must be rectangle, circle, or line.`,
        };
      }

      if (shapeType === 'line') {
        const x = (input.x as number) ?? 100;
        const y = (input.y as number) ?? 100;
        const width = (input.width as number) ?? 200;
        const height = (input.height as number) ?? 0;
        const color = (input.color as string) ?? DEFAULT_LINE_COLOR;

        const { id, error } = await insertObject(
          boardId,
          'line',
          x,
          y,
          width,
          height,
          {
            stroke: color,
            strokeWidth: DEFAULT_LINE_WIDTH,
            points: [0, 0, width, height],
          },
          userId
        );

        if (error) {
          return {
            toolName,
            input,
            result: `Error creating line: ${error}`,
          };
        }
        return {
          toolName,
          input,
          result: `Created line from (${x}, ${y}) to (${x + width}, ${y + height})`,
          objectId: id,
        };
      }

      const x = (input.x as number) ?? 100;
      const y = (input.y as number) ?? 100;
      const width = (input.width as number) ?? DEFAULT_SHAPE_WIDTH;
      const height = (input.height as number) ?? DEFAULT_SHAPE_HEIGHT;
      const color = (input.color as string) ?? DEFAULT_SHAPE_COLOR;

      const properties: Record<string, unknown> = {
        fill: color,
        stroke: '#000000',
        strokeWidth: DEFAULT_STROKE_WIDTH,
      };

      const { id, error } = await insertObject(
        boardId,
        shapeType as ObjectType,
        x,
        y,
        width,
        height,
        properties,
        userId
      );

      if (error) {
        return {
          toolName,
          input,
          result: `Error creating shape: ${error}`,
        };
      }
      return {
        toolName,
        input,
        result: `Created ${shapeType} at (${x}, ${y}) with size ${width}x${height}`,
        objectId: id,
      };
    }

    case 'createFrame': {
      const title = sanitize((input.title as string) || '');
      const x = (input.x as number) ?? 100;
      const y = (input.y as number) ?? 100;
      const width = (input.width as number) ?? DEFAULT_FRAME_WIDTH;
      const height = (input.height as number) ?? DEFAULT_FRAME_HEIGHT;

      const { id, error } = await insertObject(
        boardId,
        'frame',
        x,
        y,
        width,
        height,
        { title, stroke: '#94A3B8', strokeWidth: 2 },
        userId
      );

      if (error) {
        return {
          toolName,
          input,
          result: `Error creating frame: ${error}`,
        };
      }
      return {
        toolName,
        input,
        result: `Created frame "${title}" at (${x}, ${y}) with size ${width}x${height}`,
        objectId: id,
      };
    }

    case 'createConnector': {
      const fromId = input.fromId as string | undefined;
      const toId = input.toId as string | undefined;
      const fromSide = (input.fromSide as string) || undefined;
      const toSide = (input.toSide as string) || undefined;
      const color = (input.color as string) ?? '#000000';

      let x1: number;
      let y1: number;
      let x2: number;
      let y2: number;
      let startObjectId: string | undefined;
      let endObjectId: string | undefined;
      let startAnchorSide: string | undefined;
      let endAnchorSide: string | undefined;

      // Look up source object if fromId is provided
      if (fromId) {
        const { data: fromObj } = await supabase
          .from('whiteboard_objects')
          .select('x, y, width, height, object_type')
          .eq('id', fromId)
          .eq('board_id', boardId)
          .single();

        if (!fromObj) {
          return {
            toolName,
            input,
            result: `Error: source object ${fromId} not found`,
          };
        }

        startObjectId = fromId;
        startAnchorSide = fromSide || 'right-50';
        // Compute anchor position (midpoint of specified side)
        const fw = fromObj.width as number;
        const fh = fromObj.height as number;
        const fx = fromObj.x as number;
        const fy = fromObj.y as number;
        const anchorPos = getAnchorPosition(fx, fy, fw, fh, startAnchorSide);
        x1 = anchorPos.x;
        y1 = anchorPos.y;
      } else {
        x1 = (input.x1 as number) ?? (input.x as number) ?? 100;
        y1 = (input.y1 as number) ?? (input.y as number) ?? 100;
      }

      // Look up target object if toId is provided
      if (toId) {
        const { data: toObj } = await supabase
          .from('whiteboard_objects')
          .select('x, y, width, height, object_type')
          .eq('id', toId)
          .eq('board_id', boardId)
          .single();

        if (!toObj) {
          return {
            toolName,
            input,
            result: `Error: target object ${toId} not found`,
          };
        }

        endObjectId = toId;
        endAnchorSide = toSide || 'left-50';
        const tw = toObj.width as number;
        const th = toObj.height as number;
        const tx = toObj.x as number;
        const ty = toObj.y as number;
        const anchorPos = getAnchorPosition(tx, ty, tw, th, endAnchorSide);
        x2 = anchorPos.x;
        y2 = anchorPos.y;
      } else {
        x2 = (input.x2 as number) ?? x1 + 200;
        y2 = (input.y2 as number) ?? y1;
      }

      const dx = x2 - x1;
      const dy = y2 - y1;

      const { id, error } = await insertObject(
        boardId,
        'arrow',
        x1,
        y1,
        dx,
        dy,
        {
          stroke: color,
          strokeWidth: 2,
          points: [0, 0, dx, dy],
          startObjectId,
          endObjectId,
          startAnchorSide,
          endAnchorSide,
        },
        userId
      );

      if (error) {
        return {
          toolName,
          input,
          result: `Error creating connector: ${error}`,
        };
      }

      const fromDesc = fromId ? `object ${fromId}` : `(${x1}, ${y1})`;
      const toDesc = toId ? `object ${toId}` : `(${x2}, ${y2})`;
      return {
        toolName,
        input,
        result: `Created connector from ${fromDesc} to ${toDesc}`,
        objectId: id,
      };
    }

    case 'moveObject': {
      const objectId = input.objectId as string;
      const x = input.x as number;
      const y = input.y as number;

      const { error } = await supabase
        .from('whiteboard_objects')
        .update({
          x,
          y,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', objectId)
        .eq('board_id', boardId);

      if (error) {
        return {
          toolName,
          input,
          result: `Error moving object: ${error.message}`,
        };
      }
      return {
        toolName,
        input,
        result: `Moved object ${objectId} to (${x}, ${y})`,
        objectId,
      };
    }

    case 'resizeObject': {
      const objectId = input.objectId as string;
      const width = input.width as number;
      const height = input.height as number;

      const { error } = await supabase
        .from('whiteboard_objects')
        .update({
          width,
          height,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', objectId)
        .eq('board_id', boardId);

      if (error) {
        return {
          toolName,
          input,
          result: `Error resizing object: ${error.message}`,
        };
      }
      return {
        toolName,
        input,
        result: `Resized object ${objectId} to ${width}x${height}`,
        objectId,
      };
    }

    case 'updateText': {
      const objectId = input.objectId as string;
      const newText = sanitize((input.newText as string) || '');

      // Get existing properties first
      const { data: existing, error: fetchError } = await supabase
        .from('whiteboard_objects')
        .select('properties')
        .eq('id', objectId)
        .eq('board_id', boardId)
        .single();

      if (fetchError || !existing) {
        return {
          toolName,
          input,
          result: `Error: object ${objectId} not found`,
        };
      }

      const properties = {
        ...(existing.properties as Record<string, unknown>),
        text: newText,
      };

      const { error } = await supabase
        .from('whiteboard_objects')
        .update({
          properties,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', objectId)
        .eq('board_id', boardId);

      if (error) {
        return {
          toolName,
          input,
          result: `Error updating text: ${error.message}`,
        };
      }
      return {
        toolName,
        input,
        result: `Updated text of object ${objectId} to "${newText}"`,
        objectId,
      };
    }

    case 'changeColor': {
      const objectId = input.objectId as string;
      const color = input.color as string;

      // Get existing properties first
      const { data: existing, error: fetchError } = await supabase
        .from('whiteboard_objects')
        .select('properties, object_type')
        .eq('id', objectId)
        .eq('board_id', boardId)
        .single();

      if (fetchError || !existing) {
        return {
          toolName,
          input,
          result: `Error: object ${objectId} not found`,
        };
      }

      const properties: Record<string, unknown> = {
        ...(existing.properties as Record<string, unknown>),
        fill: color,
      };

      // For sticky notes also update noteColor
      if (existing.object_type === 'sticky_note') {
        properties.noteColor = color;
      }

      const { error } = await supabase
        .from('whiteboard_objects')
        .update({
          properties,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', objectId)
        .eq('board_id', boardId);

      if (error) {
        return {
          toolName,
          input,
          result: `Error changing color: ${error.message}`,
        };
      }
      return {
        toolName,
        input,
        result: `Changed color of object ${objectId} to ${color}`,
        objectId,
      };
    }

    case 'deleteObject': {
      const objectId = input.objectId as string;

      const { error } = await supabase
        .from('whiteboard_objects')
        .delete()
        .eq('id', objectId)
        .eq('board_id', boardId);

      if (error) {
        return {
          toolName,
          input,
          result: `Error deleting object: ${error.message}`,
        };
      }
      return {
        toolName,
        input,
        result: `Deleted object ${objectId}`,
        objectId,
      };
    }

    case 'createTemplate': {
      const templateType = (input.type as string) || '';
      const baseX = (input.x as number) ?? 100;
      const baseY = (input.y as number) ?? 100;
      const customTitle = input.title as string | undefined;

      const templates = buildTemplate(
        templateType,
        baseX,
        baseY,
        customTitle
      );
      if (!templates) {
        return {
          toolName,
          input,
          result: `Unknown template type: "${templateType}". Supported types: swot, kanban, retrospective, pros_cons, eisenhower.`,
        };
      }

      const createdIds: string[] = [];
      for (const item of templates) {
        const { id, error } = await insertObject(
          boardId,
          item.objectType,
          item.x,
          item.y,
          item.width,
          item.height,
          item.properties,
          userId
        );
        if (error) {
          return {
            toolName,
            input,
            result: `Error creating template: ${error}. Created ${createdIds.length} objects before failure.`,
          };
        }
        createdIds.push(id);
      }

      return {
        toolName,
        input,
        result: `Created ${templateType} template "${customTitle || templateType.toUpperCase()}" with ${createdIds.length} objects at (${baseX}, ${baseY}).`,
      };
    }

    case 'getBoardState': {
      const { data, error } = await supabase
        .from('whiteboard_objects')
        .select('id, object_type, x, y, width, height, properties')
        .eq('board_id', boardId)
        .order('created_at', { ascending: true });

      if (error) {
        return {
          toolName,
          input,
          result: `Error getting board state: ${error.message}`,
        };
      }

      const summary: BoardStateSummary[] = (data || []).map((obj) => {
        const props = obj.properties as Record<string, unknown>;
        return {
          id: obj.id,
          type: obj.object_type,
          x: obj.x,
          y: obj.y,
          width: obj.width,
          height: obj.height,
          text: (props?.text as string) || (props?.title as string),
          color: (props?.fill as string) || (props?.noteColor as string),
        };
      });

      return {
        toolName,
        input,
        result: JSON.stringify(summary, null, 2),
      };
    }

    default:
      return {
        toolName,
        input,
        result: `Unknown tool: ${toolName}`,
      };
  }
}

// --- Template builder ---

interface TemplateItem {
  objectType: ObjectType;
  x: number;
  y: number;
  width: number;
  height: number;
  properties: Record<string, unknown>;
}

interface TemplateSection {
  label: string;
  color: string;
  notes: string[];
}

const NOTE_W = DEFAULT_STICKY_WIDTH;
const NOTE_H = DEFAULT_STICKY_HEIGHT;
const NOTE_GAP = 20;
const NOTE_STEP = NOTE_W + NOTE_GAP; // 220
const SECTION_GAP = 40;
// Frame title renders at y=-20 above the frame border
const FRAME_TITLE_SPACE = 28;
const PADDING = 20;

function buildGridTemplate(
  title: string,
  sections: TemplateSection[],
  cols: number,
  notesPerRow: number,
  baseX: number,
  baseY: number
): TemplateItem[] {
  const items: TemplateItem[] = [];
  const rows = Math.ceil(sections.length / cols);

  // Sub-frame dimensions (just enough for sticky notes + padding)
  const sectionW = notesPerRow * NOTE_STEP - NOTE_GAP + PADDING * 2;
  const maxNoteRows = Math.max(
    ...sections.map((s) => Math.ceil(s.notes.length / notesPerRow))
  );
  const sectionH = maxNoteRows * NOTE_STEP - NOTE_GAP + PADDING * 2;

  // Outer frame: must contain all sub-frames + their titles above
  const outerW =
    cols * sectionW + (cols - 1) * SECTION_GAP + PADDING * 2;
  const outerH =
    PADDING +
    rows * (FRAME_TITLE_SPACE + sectionH) +
    (rows - 1) * SECTION_GAP +
    PADDING;

  items.push({
    objectType: 'frame',
    x: baseX,
    y: baseY,
    width: outerW,
    height: outerH,
    properties: { title, stroke: '#94A3B8', strokeWidth: 2 },
  });

  sections.forEach((section, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);

    // Sub-frame position — leave FRAME_TITLE_SPACE above each for title
    const sx = baseX + PADDING + col * (sectionW + SECTION_GAP);
    const sy =
      baseY +
      PADDING +
      FRAME_TITLE_SPACE +
      row * (FRAME_TITLE_SPACE + sectionH + SECTION_GAP);

    // Sub-frame (title renders automatically at y-20 above the border)
    items.push({
      objectType: 'frame',
      x: sx,
      y: sy,
      width: sectionW,
      height: sectionH,
      properties: {
        title: section.label,
        stroke: '#94A3B8',
        strokeWidth: 1,
      },
    });

    // Sticky notes inside sub-frame
    section.notes.forEach((noteText, ni) => {
      const nc = ni % notesPerRow;
      const nr = Math.floor(ni / notesPerRow);
      const nx = sx + PADDING + nc * NOTE_STEP;
      const ny = sy + PADDING + nr * NOTE_STEP;

      items.push({
        objectType: 'sticky_note',
        x: nx,
        y: ny,
        width: NOTE_W,
        height: NOTE_H,
        properties: {
          text: noteText,
          noteColor: section.color,
          fill: section.color,
        },
      });
    });
  });

  return items;
}

function buildTemplate(
  type: string,
  baseX: number,
  baseY: number,
  customTitle?: string
): TemplateItem[] | null {
  switch (type.toLowerCase().replace(/[\s_-]/g, '')) {
    case 'swot':
    case 'swotanalysis':
      return buildGridTemplate(
        customTitle || 'SWOT Analysis',
        [
          {
            label: '\ud83d\udcaa Strengths',
            color: '#BBF7D0',
            notes: [
              'What do we do well?',
              'What unique resources do we have?',
            ],
          },
          {
            label: '\u26a0\ufe0f Weaknesses',
            color: '#FBCFE8',
            notes: [
              'What could we improve?',
              'Where do we lack resources?',
            ],
          },
          {
            label: '\ud83d\ude80 Opportunities',
            color: '#BFDBFE',
            notes: [
              'What trends can we leverage?',
              'What market gaps exist?',
            ],
          },
          {
            label: '\ud83d\udea8 Threats',
            color: '#FED7AA',
            notes: [
              'Who are our competitors?',
              'What external risks do we face?',
            ],
          },
        ],
        2,
        2,
        baseX,
        baseY
      );

    case 'kanban':
    case 'kanbanboard':
      return buildGridTemplate(
        customTitle || 'Kanban Board',
        [
          {
            label: '\ud83d\udccb To Do',
            color: '#BFDBFE',
            notes: ['Task 1', 'Task 2', 'Task 3'],
          },
          {
            label: '\ud83d\udd27 In Progress',
            color: '#FEF08A',
            notes: ['Task 4'],
          },
          {
            label: '\u2705 Done',
            color: '#BBF7D0',
            notes: ['Task 5'],
          },
        ],
        3,
        1,
        baseX,
        baseY
      );

    case 'retro':
    case 'retrospective':
      return buildGridTemplate(
        customTitle || 'Retrospective',
        [
          {
            label: '\ud83d\ude0a What went well',
            color: '#BBF7D0',
            notes: ['Add your thoughts...', 'Add your thoughts...'],
          },
          {
            label: '\ud83e\udd14 What to improve',
            color: '#FBCFE8',
            notes: ['Add your thoughts...', 'Add your thoughts...'],
          },
          {
            label: '\ud83d\udca1 Action items',
            color: '#BFDBFE',
            notes: ['Add your action...', 'Add your action...'],
          },
        ],
        3,
        1,
        baseX,
        baseY
      );

    case 'proscons':
    case 'prosandcons':
      return buildGridTemplate(
        customTitle || 'Pros & Cons',
        [
          {
            label: '\ud83d\udc4d Pros',
            color: '#BBF7D0',
            notes: ['Pro 1', 'Pro 2', 'Pro 3'],
          },
          {
            label: '\ud83d\udc4e Cons',
            color: '#FBCFE8',
            notes: ['Con 1', 'Con 2', 'Con 3'],
          },
        ],
        2,
        1,
        baseX,
        baseY
      );

    case 'eisenhower':
    case 'eisenhowermatrix':
    case 'urgentimportant':
      return buildGridTemplate(
        customTitle || 'Eisenhower Matrix',
        [
          {
            label: '\ud83d\udd25 Urgent & Important',
            color: '#FBCFE8',
            notes: ['Do first', 'Critical task'],
          },
          {
            label: '\ud83c\udfaf Important, Not Urgent',
            color: '#BFDBFE',
            notes: ['Schedule this', 'Plan ahead'],
          },
          {
            label: '\u26a1 Urgent, Not Important',
            color: '#FEF08A',
            notes: ['Delegate this', 'Quick task'],
          },
          {
            label: '\ud83d\uddd1\ufe0f Not Urgent or Important',
            color: '#E9D5FF',
            notes: ['Eliminate', 'Reconsider'],
          },
        ],
        2,
        2,
        baseX,
        baseY
      );

    default:
      return null;
  }
}
