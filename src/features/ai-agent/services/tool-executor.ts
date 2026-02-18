import { v4 as uuidv4 } from 'uuid';
import { createServiceClient } from '@/lib/supabase/server';
import type { ObjectType } from '@/features/board/types';
import type { ToolCallResult, BoardStateSummary } from '../types';
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
