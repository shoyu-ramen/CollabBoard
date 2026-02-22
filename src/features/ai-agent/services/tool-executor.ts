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
    .replace(/\\n/g, '\n')
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
  // Parse side name: "top-25", "bottom-75", "left-50", etc.
  const match = side.match(/^(top|right|bottom|left)(?:-(\d+))?$/);
  if (match) {
    const edge = match[1];
    const pct = match[2] ? parseInt(match[2]) / 100 : 0.5;
    switch (edge) {
      case 'top':
        return { x: x + width * pct, y };
      case 'right':
        return { x: x + width, y: y + height * pct };
      case 'bottom':
        return { x: x + width * pct, y: y + height };
      case 'left':
        return { x, y: y + height * pct };
    }
  }
  // Default to center
  return { x: x + width / 2, y: y + height / 2 };
}

/**
 * Parse a process description into individual step strings.
 */
export function parseFlowchartSteps(description: string): string[] {
  // Try numbered list first (e.g., "1. Step one\n2. Step two")
  const numbered = description.match(/^\s*\d+[\.\)]\s*.+/gm);
  if (numbered && numbered.length >= 2) {
    return numbered
      .map((s) => s.replace(/^\s*\d+[\.\)]\s*/, '').trim())
      .filter(Boolean);
  }

  // Try newline-separated
  const lines = description
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  if (lines.length >= 2) {
    return lines;
  }

  // Try comma-separated
  const commas = description
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (commas.length >= 2) {
    return commas;
  }

  // Try sentence boundaries
  const sentences = description
    .split(/[.;]/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (sentences.length >= 2) {
    return sentences;
  }

  // Single item or unparseable
  return description.trim() ? [description.trim()] : [];
}

/**
 * Find the right edge of all existing objects on the board.
 * Returns an x position with padding so new content doesn't overlap.
 */
async function findOpenX(
  boardId: string,
  gap = 80
): Promise<number> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from('whiteboard_objects')
    .select('x, width')
    .eq('board_id', boardId);

  if (!data || data.length === 0) return 100;

  const maxRight = data.reduce((max, obj) => {
    return Math.max(max, (obj.x as number) + (obj.width as number));
  }, 0);

  return maxRight + gap;
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

    case 'clearBoard': {
      // Get all object IDs first so client can remove them
      const { data: allObjects } = await supabase
        .from('whiteboard_objects')
        .select('id')
        .eq('board_id', boardId);

      const count = allObjects?.length ?? 0;

      const { error } = await supabase
        .from('whiteboard_objects')
        .delete()
        .eq('board_id', boardId);

      if (error) {
        return {
          toolName,
          input,
          result: `Error clearing board: ${error.message}`,
        };
      }

      const deletedIds = (allObjects || []).map((o) => o.id);
      return {
        toolName,
        input,
        result: `Cleared board — deleted ${count} objects`,
        deletedIds,
      };
    }

    case 'createTemplate': {
      const templateType = (input.type as string) || '';
      const baseX =
        input.x != null ? (input.x as number) : await findOpenX(boardId);
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

    case 'summarizeBoard': {
      const { data, error } = await supabase
        .from('whiteboard_objects')
        .select('id, object_type, properties, x, width')
        .eq('board_id', boardId);

      if (error) {
        return {
          toolName,
          input,
          result: `Error fetching board objects: ${error.message}`,
        };
      }

      const objects = data || [];
      if (objects.length === 0) {
        return {
          toolName,
          input,
          result:
            'The board is empty — nothing to summarize.',
        };
      }

      // Extract text content grouped by object type
      const byType = new Map<string, string[]>();
      for (const obj of objects) {
        const props = obj.properties as Record<string, unknown>;
        const text =
          (props?.text as string) || (props?.title as string);
        if (text) {
          const type = obj.object_type as string;
          if (!byType.has(type)) byType.set(type, []);
          byType.get(type)!.push(text);
        }
      }

      if (byType.size === 0) {
        return {
          toolName,
          input,
          result:
            'No text content found on the board — there are objects but none contain text.',
        };
      }

      // Build a content digest for the tool result
      let digest = '';
      for (const [type, texts] of byType) {
        digest += `${type}: ${texts.join(', ')}\n`;
      }
      if (digest.length > 4000) {
        digest = digest.slice(0, 4000) + '\n... (truncated)';
      }

      // Build summary notes: one per type group, capped at 6
      const summaryNotes: { label: string; items: string[] }[] = [];
      for (const [type, texts] of byType) {
        const uniqueTexts = [...new Set(texts)];
        const preview =
          uniqueTexts.length <= 3
            ? uniqueTexts.join(', ')
            : `${uniqueTexts.slice(0, 3).join(', ')} +${uniqueTexts.length - 3} more`;
        summaryNotes.push({ label: type, items: [preview] });
      }
      // Add a count note
      const totalTextItems = Array.from(byType.values()).reduce(
        (sum, arr) => sum + arr.length,
        0
      );

      // Auto-position: place to the right of existing content if no x given
      let x = input.x as number | undefined;
      const y = (input.y as number) ?? 100;
      if (x == null) {
        const maxRight = objects.reduce((max, obj) => {
          const objX = (obj.x as number) ?? 0;
          const objW = (obj.width as number) ?? 0;
          return Math.max(max, objX + objW);
        }, 0);
        x = maxRight > 0 ? maxRight + 80 : 100;
      }
      const noteW = DEFAULT_STICKY_WIDTH;
      const noteH = DEFAULT_STICKY_HEIGHT;
      const noteGap = 20;
      const padding = 20;
      const cols = Math.min(summaryNotes.length + 1, 3); // +1 for totals note
      const totalNotes = summaryNotes.length + 1;
      const rows = Math.ceil(totalNotes / cols);
      const frameW = cols * (noteW + noteGap) - noteGap + padding * 2;
      const frameTitleSpace = 28;
      const frameH =
        rows * (noteH + noteGap) - noteGap + padding * 2 + frameTitleSpace;

      const colors = [
        '#BFDBFE',
        '#BBF7D0',
        '#FEF08A',
        '#FBCFE8',
        '#FED7AA',
        '#E9D5FF',
      ];

      // Create the frame
      const { id: frameId, error: frameErr } = await insertObject(
        boardId,
        'frame',
        x,
        y,
        frameW,
        frameH,
        { title: 'Board Summary', stroke: '#94A3B8', strokeWidth: 2 },
        userId
      );
      if (frameErr) {
        return {
          toolName,
          input,
          result: `Error creating summary frame: ${frameErr}`,
        };
      }

      // Create notes inside the frame
      const allNoteData = [
        ...summaryNotes.map((n, i) => ({
          text: `${n.label}: ${n.items[0]}`,
          color: colors[i % colors.length],
        })),
        {
          text: `Total: ${objects.length} objects, ${totalTextItems} with text`,
          color: '#E9D5FF',
        },
      ];

      for (let i = 0; i < allNoteData.length; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const nx = x + padding + col * (noteW + noteGap);
        const ny =
          y + padding + frameTitleSpace + row * (noteH + noteGap);

        await insertObject(
          boardId,
          'sticky_note',
          nx,
          ny,
          noteW,
          noteH,
          {
            text: allNoteData[i].text,
            noteColor: allNoteData[i].color,
            fill: allNoteData[i].color,
          },
          userId
        );
      }

      return {
        toolName,
        input,
        result: `Created board summary at (${x}, ${y}) with ${allNoteData.length} notes in a frame. Content digest:\n${digest}`,
        objectId: frameId,
      };
    }

    case 'generateFlowchart': {
      const direction =
        (input.direction as string) || 'top-to-bottom';
      const startX =
        input.x != null ? (input.x as number) : await findOpenX(boardId);
      const startY = (input.y as number) ?? 100;
      const defaultColor = (input.nodeColor as string) ?? '#BFDBFE';
      const decisionColor = '#FEF08A'; // Yellow for decision nodes
      const isVertical = direction === 'top-to-bottom';

      // Uniform cell size for layout grid; shapes are centered within cells
      const cellW = 200;
      const cellH = 160;
      const gap = 120; // Vertical gap between rows (reduced since nodes are shorter)
      const hGap = 100; // Horizontal gap between sibling nodes

      // Determine if using structured nodes+connections or legacy description
      const rawNodes = input.nodes as
        | Array<{
            id: string;
            text: string;
            type?: string;
            color?: string;
          }>
        | undefined;
      const rawConnections = input.connections as
        | Array<{ from: string; to: string; label?: string }>
        | undefined;

      if (rawNodes && rawNodes.length > 0 && rawConnections) {
        // === Structured graph mode with branching support ===
        const cappedNodes = rawNodes.slice(0, 30);
        const nodeMap = new Map<
          string,
          {
            id: string;
            text: string;
            type: string;
            color: string;
          }
        >();
        for (const n of cappedNodes) {
          nodeMap.set(n.id, {
            id: n.id,
            text: n.text,
            type: n.type || 'step',
            color:
              n.color ||
              (n.type === 'decision' ? decisionColor : defaultColor),
          });
        }

        // Build node index map for detecting back-edges
        const nodeIndex = new Map<string, number>();
        for (let i = 0; i < cappedNodes.length; i++) {
          nodeIndex.set(cappedNodes[i].id, i);
        }

        // Separate forward edges from back-edges (cycles)
        // A back-edge points from a later node to an earlier node in Claude's ordering
        const forwardConnections: Array<{ from: string; to: string }> = [];
        for (const c of rawConnections) {
          if (!nodeMap.has(c.from) || !nodeMap.has(c.to)) continue;
          const fromIdx = nodeIndex.get(c.from)!;
          const toIdx = nodeIndex.get(c.to)!;
          if (toIdx > fromIdx) {
            forwardConnections.push(c);
          }
          // Back-edges are skipped for layering but arrows are still drawn
        }

        // Build adjacency from forward edges only (DAG)
        const children = new Map<string, string[]>();
        const inDegree = new Map<string, number>();
        for (const n of cappedNodes) {
          children.set(n.id, []);
          inDegree.set(n.id, 0);
        }
        for (const c of forwardConnections) {
          children.get(c.from)!.push(c.to);
          inDegree.set(c.to, inDegree.get(c.to)! + 1);
        }

        // Topological layering on the DAG using longest path
        const layer = new Map<string, number>();
        const queue = cappedNodes
          .filter((n) => inDegree.get(n.id)! === 0)
          .map((n) => n.id);
        if (queue.length === 0 && cappedNodes.length > 0) {
          queue.push(cappedNodes[0].id);
        }
        for (const r of queue) {
          layer.set(r, 0);
        }
        const visited = new Set<string>();
        while (queue.length > 0) {
          const curr = queue.shift()!;
          if (visited.has(curr)) continue;
          visited.add(curr);
          const currLayer = layer.get(curr) ?? 0;
          for (const child of children.get(curr)!) {
            const existingLayer = layer.get(child) ?? -1;
            if (currLayer + 1 > existingLayer) {
              layer.set(child, currLayer + 1);
            }
            inDegree.set(child, inDegree.get(child)! - 1);
            if (inDegree.get(child)! <= 0 && !visited.has(child)) {
              queue.push(child);
            }
          }
        }

        // Handle nodes not reached (disconnected components)
        for (const n of cappedNodes) {
          if (!layer.has(n.id)) {
            layer.set(n.id, nodeIndex.get(n.id)!);
          }
        }

        // Group nodes by layer
        const layers = new Map<string, string[]>();
        for (const n of cappedNodes) {
          const l = String(layer.get(n.id)!);
          if (!layers.has(l)) layers.set(l, []);
          layers.get(l)!.push(n.id);
        }

        // --- Barycenter crossing minimization ---
        // Build parent/child adjacency for cross-layer connections
        const nodeParents = new Map<string, string[]>();
        const nodeChildren = new Map<string, string[]>();
        for (const n of cappedNodes) {
          nodeParents.set(n.id, []);
          nodeChildren.set(n.id, []);
        }
        for (const c of forwardConnections) {
          nodeChildren.get(c.from)!.push(c.to);
          nodeParents.get(c.to)!.push(c.from);
        }

        // Get sorted layer keys
        const layerKeys = Array.from(layers.keys())
          .map(Number)
          .sort((a, b) => a - b);

        // Run 4 sweeps (down, up, down, up) to iteratively reduce crossings
        for (let sweep = 0; sweep < 4; sweep++) {
          const keys =
            sweep % 2 === 0 ? layerKeys : [...layerKeys].reverse();
          for (let li = 1; li < keys.length; li++) {
            const currKey = String(keys[li]);
            const prevKey = String(keys[li - 1]);
            const prevOrder = layers.get(prevKey)!;
            const prevPos = new Map<string, number>();
            prevOrder.forEach((id, idx) => prevPos.set(id, idx));

            const currNodes = layers.get(currKey)!;
            // Compute barycenter: average position of neighbors in previous layer
            const bary = new Map<string, number>();
            for (const nid of currNodes) {
              const neighbors =
                sweep % 2 === 0
                  ? nodeParents.get(nid)!
                  : nodeChildren.get(nid)!;
              const positions = neighbors
                .filter((p) => prevPos.has(p))
                .map((p) => prevPos.get(p)!);
              if (positions.length > 0) {
                bary.set(
                  nid,
                  positions.reduce((a, b) => a + b, 0) / positions.length
                );
              } else {
                // Keep original relative position for disconnected nodes
                bary.set(nid, currNodes.indexOf(nid));
              }
            }
            // Sort current layer by barycenter
            currNodes.sort((a, b) => bary.get(a)! - bary.get(b)!);
          }
        }

        // Calculate positions: center each layer's nodes
        const maxNodesInLayer = Math.max(
          ...Array.from(layers.values()).map((arr) => arr.length)
        );
        const totalWidthNeeded =
          maxNodesInLayer * cellW + (maxNodesInLayer - 1) * hGap;

        const nodePositions = new Map<
          string,
          { x: number; y: number }
        >();

        for (const [layerStr, nodeIds] of layers.entries()) {
          const layerNum = parseInt(layerStr);
          const count = nodeIds.length;
          const layerWidth = count * cellW + (count - 1) * hGap;
          const offsetX = (totalWidthNeeded - layerWidth) / 2;

          for (let i = 0; i < nodeIds.length; i++) {
            const nx = isVertical
              ? startX + offsetX + i * (cellW + hGap)
              : startX + layerNum * (cellW + gap);
            const ny = isVertical
              ? startY + layerNum * (cellH + gap)
              : startY + offsetX + i * (cellH + hGap);
            nodePositions.set(nodeIds[i], { x: nx, y: ny });
          }
        }

        // Shape config per node type
        // Each node becomes a shape + centered text overlay
        interface NodeShapeConfig {
          type: ObjectType;
          w: number;
          h: number;
          fill: string;
          stroke: string;
        }
        function getNodeShape(
          nodeType: string,
          nodeText: string
        ): NodeShapeConfig {
          if (nodeType === 'start' || nodeType === 'end') {
            return {
              type: 'circle',
              w: 120,
              h: 120,
              fill: '#BBF7D0',
              stroke: '#16A34A',
            };
          }
          if (nodeType === 'decision') {
            return {
              type: 'circle',
              w: 150,
              h: 150,
              fill: '#FEF08A',
              stroke: '#CA8A04',
            };
          }
          if (/error/i.test(nodeText)) {
            return {
              type: 'rectangle',
              w: 200,
              h: 80,
              fill: '#FECACA',
              stroke: '#EF4444',
            };
          }
          return {
            type: 'rectangle',
            w: 200,
            h: 80,
            fill: '#BFDBFE',
            stroke: '#3B82F6',
          };
        }

        // Track actual shape sizes for anchor calculations
        const nodeShapes = new Map<string, NodeShapeConfig>();

        // Create all nodes (shape + text overlay per node)
        const createdDbIds = new Map<string, string>(); // logical id → shape db id
        for (const n of cappedNodes) {
          const pos = nodePositions.get(n.id)!;
          const info = nodeMap.get(n.id)!;
          const text = sanitize(info.text);
          const shape = getNodeShape(info.type, info.text);
          nodeShapes.set(n.id, shape);

          // Center the shape within the cell
          const shapeX = pos.x + (cellW - shape.w) / 2;
          const shapeY = pos.y + (cellH - shape.h) / 2;

          // Create the shape
          const { id: shapeId, error: shapeErr } = await insertObject(
            boardId,
            shape.type,
            shapeX,
            shapeY,
            shape.w,
            shape.h,
            {
              fill: shape.fill,
              stroke: shape.stroke,
              strokeWidth: DEFAULT_STROKE_WIDTH,
            },
            userId
          );
          if (shapeErr) {
            return {
              toolName,
              input,
              result: `Error creating flowchart node "${info.text}": ${shapeErr}. Created ${createdDbIds.size} nodes before failure.`,
            };
          }
          createdDbIds.set(n.id, shapeId);

          // Create centered text overlay
          const textW = shape.w - 16; // small padding inside shape
          const textH = shape.h - 8;
          const textX = shapeX + (shape.w - textW) / 2;
          const textY = shapeY + (shape.h - textH) / 2;

          await insertObject(
            boardId,
            'text',
            textX,
            textY,
            textW,
            textH,
            {
              text,
              fontSize: 14,
              fontFamily: DEFAULT_TEXT_FONT_FAMILY,
              color: '#1a1a1a',
              fill: '#1a1a1a',
              textAlign: 'center',
            },
            userId
          );
        }

        // Create arrows for forward connections only with orthogonal routing.
        // Back-edges (loops to earlier nodes) are skipped to avoid
        // lines crossing through other nodes and creating visual chaos.
        let arrowCount = 0;
        for (const conn of rawConnections) {
          const fromDbId = createdDbIds.get(conn.from);
          const toDbId = createdDbIds.get(conn.to);
          if (!fromDbId || !toDbId) continue;

          // Skip back-edges (later node → earlier node)
          const fromIdx = nodeIndex.get(conn.from)!;
          const toIdx = nodeIndex.get(conn.to)!;
          if (toIdx <= fromIdx) continue;

          const fromPos = nodePositions.get(conn.from)!;
          const toPos = nodePositions.get(conn.to)!;
          const fromShape = nodeShapes.get(conn.from)!;
          const toShape = nodeShapes.get(conn.to)!;

          // Compute actual shape center positions
          const fromCX = fromPos.x + cellW / 2;
          const fromCY = fromPos.y + cellH / 2;
          const toCX = toPos.x + cellW / 2;
          const toCY = toPos.y + cellH / 2;

          // Compute shape bounding boxes (centered in cell)
          const fromShapeX = fromPos.x + (cellW - fromShape.w) / 2;
          const fromShapeY = fromPos.y + (cellH - fromShape.h) / 2;
          const toShapeX = toPos.x + (cellW - toShape.w) / 2;
          const toShapeY = toPos.y + (cellH - toShape.h) / 2;

          const dx = toCX - fromCX;
          const dy = toCY - fromCY;

          // Determine routing: anchor sides + orthogonal waypoints
          let fromSide: string;
          let toSide: string;
          let waypoints: number[]; // relative to fromAnchor: [0,0, ...midpoints, endDx,endDy]

          if (isVertical) {
            if (Math.abs(dx) < cellW / 4) {
              // Same column — straight vertical: bottom → top
              fromSide = 'bottom-50';
              toSide = 'top-50';
              const fromA = getAnchorPosition(fromShapeX, fromShapeY, fromShape.w, fromShape.h, fromSide);
              const toA = getAnchorPosition(toShapeX, toShapeY, toShape.w, toShape.h, toSide);
              const wdx = toA.x - fromA.x;
              const wdy = toA.y - fromA.y;
              waypoints = [0, 0, wdx, wdy];
            } else if (Math.abs(dy) < cellH / 4) {
              // Different column, same row — straight horizontal
              fromSide = dx > 0 ? 'right-50' : 'left-50';
              toSide = dx > 0 ? 'left-50' : 'right-50';
              const fromA = getAnchorPosition(fromShapeX, fromShapeY, fromShape.w, fromShape.h, fromSide);
              const toA = getAnchorPosition(toShapeX, toShapeY, toShape.w, toShape.h, toSide);
              const wdx = toA.x - fromA.x;
              const wdy = toA.y - fromA.y;
              waypoints = [0, 0, wdx, wdy];
            } else {
              // Different column, different row — orthogonal L-route:
              // Exit from side of source, go horizontal to align with target column,
              // then go vertical to target's top anchor
              fromSide = dx > 0 ? 'right-50' : 'left-50';
              toSide = dy > 0 ? 'top-50' : 'bottom-50';
              const fromA = getAnchorPosition(fromShapeX, fromShapeY, fromShape.w, fromShape.h, fromSide);
              const toA = getAnchorPosition(toShapeX, toShapeY, toShape.w, toShape.h, toSide);
              const wdx = toA.x - fromA.x;
              const wdy = toA.y - fromA.y;
              // L-shape: horizontal first, then vertical
              waypoints = [0, 0, wdx, 0, wdx, wdy];
            }
          } else {
            // Horizontal flow
            if (Math.abs(dy) < cellH / 4) {
              // Same row — straight horizontal: right → left
              fromSide = 'right-50';
              toSide = 'left-50';
              const fromA = getAnchorPosition(fromShapeX, fromShapeY, fromShape.w, fromShape.h, fromSide);
              const toA = getAnchorPosition(toShapeX, toShapeY, toShape.w, toShape.h, toSide);
              const adx = toA.x - fromA.x;
              const ady = toA.y - fromA.y;
              waypoints = [0, 0, adx, ady];
            } else {
              // Different row — L-route
              fromSide = dy > 0 ? 'bottom-50' : 'top-50';
              toSide = 'left-50';
              const fromA = getAnchorPosition(fromShapeX, fromShapeY, fromShape.w, fromShape.h, fromSide);
              const toA = getAnchorPosition(toShapeX, toShapeY, toShape.w, toShape.h, toSide);
              const adx = toA.x - fromA.x;
              const ady = toA.y - fromA.y;
              waypoints = [0, 0, 0, ady, adx, ady];
            }
          }

          // Compute the anchor points for storing on the arrow
          const fromAnchor = getAnchorPosition(fromShapeX, fromShapeY, fromShape.w, fromShape.h, fromSide);
          const toAnchor = getAnchorPosition(toShapeX, toShapeY, toShape.w, toShape.h, toSide);
          const adx = toAnchor.x - fromAnchor.x;
          const ady = toAnchor.y - fromAnchor.y;

          await insertObject(
            boardId,
            'arrow',
            fromAnchor.x,
            fromAnchor.y,
            Math.abs(adx) || 1,
            Math.abs(ady) || 1,
            {
              stroke: '#000000',
              strokeWidth: 2,
              points: waypoints,
              startObjectId: fromDbId,
              endObjectId: toDbId,
              startAnchorSide: fromSide,
              endAnchorSide: toSide,
              routing: 'orthogonal',
            },
            userId
          );
          arrowCount++;

          // Create label for the connection if provided
          if (conn.label) {
            // Place label along the first segment of the orthogonal path,
            // offset away from the line so it doesn't overlap
            const labelW = 50;
            const labelH = 34;
            let labelX: number;
            let labelY: number;

            // First segment direction: waypoints[2]-waypoints[0], waypoints[3]-waypoints[1]
            const seg1dx = waypoints[2] - waypoints[0];
            const seg1dy = waypoints[3] - waypoints[1];

            if (Math.abs(seg1dx) > Math.abs(seg1dy)) {
              // First segment is horizontal — place label above/below midpoint
              const midX = fromAnchor.x + seg1dx * 0.5;
              labelX = midX - labelW / 2;
              labelY = fromAnchor.y - labelH - 4;
            } else {
              // First segment is vertical — place label to the side
              const midY = fromAnchor.y + seg1dy * 0.4;
              if (adx < 0) {
                labelX = fromAnchor.x - labelW - 8;
              } else {
                labelX = fromAnchor.x + 8;
              }
              labelY = midY - labelH / 2;
            }
            await insertObject(
              boardId,
              'text',
              labelX,
              labelY,
              labelW,
              labelH,
              {
                text: sanitize(conn.label),
                fontSize: 14,
                fontFamily: DEFAULT_TEXT_FONT_FAMILY,
                fill: '#6B7280',
              },
              userId
            );
          }
        }

        return {
          toolName,
          input,
          result: `Created flowchart with ${createdDbIds.size} nodes and ${arrowCount} arrows (${direction}) including branching paths.`,
        };
      }

      // === Legacy linear mode (description string) ===
      // Legacy mode uses sticky notes for simplicity
      const nodeW = DEFAULT_STICKY_WIDTH;
      const nodeH = DEFAULT_STICKY_HEIGHT;
      const description = (input.description as string) || '';
      const steps = parseFlowchartSteps(description);

      if (steps.length === 0) {
        return {
          toolName,
          input,
          result:
            'Error: Could not parse any steps from the description. Provide nodes+connections for branching, or a comma-separated list for a simple linear flow.',
        };
      }

      const cappedSteps = steps.slice(0, 20);
      const createdIds: string[] = [];

      for (let i = 0; i < cappedSteps.length; i++) {
        const text = sanitize(cappedSteps[i]);
        const nx = isVertical ? startX : startX + i * (nodeW + gap);
        const ny = isVertical ? startY + i * (nodeH + gap) : startY;

        const { id, error } = await insertObject(
          boardId,
          'sticky_note',
          nx,
          ny,
          nodeW,
          nodeH,
          { text, noteColor: defaultColor, fill: defaultColor },
          userId
        );
        if (error) {
          return {
            toolName,
            input,
            result: `Error creating flowchart node: ${error}. Created ${createdIds.length} nodes before failure.`,
          };
        }
        createdIds.push(id);
      }

      for (let i = 0; i < createdIds.length - 1; i++) {
        const fromIdx = i;
        const toIdx = i + 1;
        const fromX = isVertical
          ? startX
          : startX + fromIdx * (nodeW + gap);
        const fromY = isVertical
          ? startY + fromIdx * (nodeH + gap)
          : startY;
        const toX = isVertical
          ? startX
          : startX + toIdx * (nodeW + gap);
        const toY = isVertical
          ? startY + toIdx * (nodeH + gap)
          : startY;

        const fromSide = isVertical ? 'bottom-50' : 'right-50';
        const toSide = isVertical ? 'top-50' : 'left-50';

        const fromAnchor = getAnchorPosition(
          fromX,
          fromY,
          nodeW,
          nodeH,
          fromSide
        );
        const toAnchor = getAnchorPosition(
          toX,
          toY,
          nodeW,
          nodeH,
          toSide
        );
        const adx = toAnchor.x - fromAnchor.x;
        const ady = toAnchor.y - fromAnchor.y;

        await insertObject(
          boardId,
          'arrow',
          fromAnchor.x,
          fromAnchor.y,
          Math.abs(adx) || 1,
          Math.abs(ady) || 1,
          {
            stroke: '#000000',
            strokeWidth: 2,
            points: [0, 0, adx, ady],
            startObjectId: createdIds[i],
            endObjectId: createdIds[i + 1],
            startAnchorSide: fromSide,
            endAnchorSide: toSide,
          },
          userId
        );
      }

      const arrowCount = Math.max(0, createdIds.length - 1);
      return {
        toolName,
        input,
        result: `Created flowchart with ${createdIds.length} nodes and ${arrowCount} arrows (${direction}).`,
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

interface MatrixColumn {
  label: string;
}

interface MatrixRow {
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

/**
 * Build a matrix-style template with column headers across the top
 * and row labels on the left, with a sticky note in each cell.
 * Used for user journey maps, empathy maps, etc.
 */
function buildMatrixTemplate(
  title: string,
  columns: MatrixColumn[],
  rows: MatrixRow[],
  baseX: number,
  baseY: number
): TemplateItem[] {
  const items: TemplateItem[] = [];
  const LABEL_COL_W = 140;
  const HEADER_H = 40;
  const numCols = columns.length;
  const numRows = rows.length;

  const outerW =
    PADDING + LABEL_COL_W + numCols * NOTE_STEP - NOTE_GAP + PADDING;
  const outerH =
    PADDING +
    FRAME_TITLE_SPACE +
    HEADER_H +
    numRows * NOTE_STEP -
    NOTE_GAP +
    PADDING;

  // Outer frame
  items.push({
    objectType: 'frame',
    x: baseX,
    y: baseY,
    width: outerW,
    height: outerH,
    properties: { title, stroke: '#94A3B8', strokeWidth: 2 },
  });

  // Column headers (text objects)
  columns.forEach((col, ci) => {
    items.push({
      objectType: 'text',
      x: baseX + PADDING + LABEL_COL_W + ci * NOTE_STEP,
      y: baseY + PADDING + FRAME_TITLE_SPACE,
      width: NOTE_W,
      height: HEADER_H,
      properties: {
        text: col.label,
        fontSize: 14,
        fontFamily: 'sans-serif',
        fontStyle: 'bold',
        color: '#374151',
        textAlign: 'center',
      },
    });
  });

  // Row labels + sticky notes
  rows.forEach((row, ri) => {
    const rowY =
      baseY +
      PADDING +
      FRAME_TITLE_SPACE +
      HEADER_H +
      ri * NOTE_STEP;

    // Row label on the left
    items.push({
      objectType: 'text',
      x: baseX + PADDING,
      y: rowY,
      width: LABEL_COL_W - 10,
      height: NOTE_H,
      properties: {
        text: row.label,
        fontSize: 13,
        fontFamily: 'sans-serif',
        fontStyle: 'bold',
        color: '#374151',
        textAlign: 'left',
      },
    });

    // One sticky note per column in this row
    row.notes.forEach((noteText, ci) => {
      if (ci >= numCols) return;
      items.push({
        objectType: 'sticky_note',
        x: baseX + PADDING + LABEL_COL_W + ci * NOTE_STEP,
        y: rowY,
        width: NOTE_W,
        height: NOTE_H,
        properties: {
          text: noteText,
          noteColor: row.color,
          fill: row.color,
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

    case 'userjourneymap':
    case 'userjourney':
    case 'journeymap':
    case 'customerjourney':
    case 'customerjourneymap':
      return buildMatrixTemplate(
        customTitle || 'User Journey Map',
        [
          { label: 'Stage 1: Awareness' },
          { label: 'Stage 2: Consideration' },
          { label: 'Stage 3: Decision' },
          { label: 'Stage 4: Retention' },
          { label: 'Stage 5: Advocacy' },
        ],
        [
          {
            label: '\uD83C\uDFAF Actions',
            color: '#BFDBFE',
            notes: [
              'Sees ad on social media',
              'Reads reviews & compares options',
              'Signs up & completes purchase',
              'Uses product regularly',
              'Shares & refers friends',
            ],
          },
          {
            label: '\uD83D\uDCAD Thoughts',
            color: '#E9D5FF',
            notes: [
              '"I didn\'t know this existed!"',
              '"Is this better than what I use?"',
              '"I hope this is the right choice"',
              '"This saves me so much time!"',
              '"My friends need to know!"',
            ],
          },
          {
            label: '\uD83D\uDE0A Emotions',
            color: '#FEF08A',
            notes: [
              'Curious but skeptical',
              'Interested but uncertain',
              'Excited but nervous',
              'Satisfied & confident',
              'Proud & enthusiastic',
            ],
          },
          {
            label: '\uD83D\uDD27 Pain Points',
            color: '#FBCFE8',
            notes: [
              'Hard to find credible info',
              'Too many options to compare',
              'Hidden costs, confusing plans',
              'Steep learning curve',
              'Slow support response',
            ],
          },
        ],
        baseX,
        baseY
      );

    case 'empathymap':
    case 'empathy':
      return buildGridTemplate(
        customTitle || 'Empathy Map',
        [
          {
            label: '\uD83D\uDC40 Says',
            color: '#BFDBFE',
            notes: ['What do they say out loud?', 'Direct quotes...'],
          },
          {
            label: '\uD83E\uDDE0 Thinks',
            color: '#E9D5FF',
            notes: ['What are they thinking?', 'Worries & aspirations...'],
          },
          {
            label: '\u2764\uFE0F Feels',
            color: '#FBCFE8',
            notes: ['What emotions do they feel?', 'Frustrations & joys...'],
          },
          {
            label: '\uD83D\uDCAA Does',
            color: '#BBF7D0',
            notes: ['What actions do they take?', 'Observable behaviors...'],
          },
        ],
        2,
        1,
        baseX,
        baseY
      );

    default:
      return null;
  }
}
