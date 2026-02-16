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
} from '@/lib/constants';

/**
 * Strip HTML tags and decode common entities for server-side text sanitization.
 * This runs on AI-generated text before inserting into the database.
 */
function sanitize(text: string): string {
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .trim();
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

    case 'createShape': {
      const shapeType = input.type as string;
      if (!['rectangle', 'circle', 'line'].includes(shapeType)) {
        return {
          toolName,
          input,
          result: `Invalid shape type: ${shapeType}. Must be rectangle, circle, or line.`,
        };
      }
      const x = (input.x as number) ?? 100;
      const y = (input.y as number) ?? 100;
      const width = (input.width as number) ?? DEFAULT_SHAPE_WIDTH;
      const height = (input.height as number) ?? DEFAULT_SHAPE_HEIGHT;
      const color = (input.color as string) ?? DEFAULT_SHAPE_COLOR;

      const properties: Record<string, unknown> = {
        fill: color,
        stroke: color,
        strokeWidth: DEFAULT_STROKE_WIDTH,
      };

      if (shapeType === 'line') {
        properties.points = [0, 0, width, height];
      }

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
      const fromId = input.fromId as string;
      const toId = input.toId as string;
      const style = (input.style as string) ?? 'arrow';

      const { id, error } = await insertObject(
        boardId,
        'connector',
        0,
        0,
        0,
        0,
        {
          fromId,
          toId,
          lineStyle: style,
          stroke: '#64748B',
          strokeWidth: 2,
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
      return {
        toolName,
        input,
        result: `Created ${style} connector from ${fromId} to ${toId}`,
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
