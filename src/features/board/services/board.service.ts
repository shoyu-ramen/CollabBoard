import { createClient } from '@/lib/supabase/client';
import type { WhiteboardObject, Board } from '../types';

const supabase = createClient();

export async function fetchBoardObjects(
  boardId: string
): Promise<WhiteboardObject[]> {
  const { data, error } = await supabase
    .from('whiteboard_objects')
    .select('*')
    .eq('board_id', boardId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as WhiteboardObject[];
}

export async function createObject(
  obj: WhiteboardObject
): Promise<WhiteboardObject> {
  const { data, error } = await supabase
    .from('whiteboard_objects')
    .insert(obj)
    .select()
    .single();

  if (error) throw error;
  return data as WhiteboardObject;
}

export async function updateObject(
  id: string,
  updates: Partial<WhiteboardObject>
): Promise<WhiteboardObject> {
  const { data, error } = await supabase
    .from('whiteboard_objects')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
      version: (updates.version ?? 0) + 1,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as WhiteboardObject;
}

export async function deleteObject(id: string): Promise<void> {
  const { error } = await supabase
    .from('whiteboard_objects')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function fetchBoard(boardId: string): Promise<Board> {
  const { data, error } = await supabase
    .from('boards')
    .select('*')
    .eq('id', boardId)
    .single();

  if (error) throw error;
  return data as Board;
}
