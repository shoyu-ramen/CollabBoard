import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; objectId: string }> }
) {
  try {
    const { id: boardId, objectId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Fetch current version for incrementing
    const { data: current, error: fetchError } = await supabase
      .from('whiteboard_objects')
      .select('version')
      .eq('id', objectId)
      .eq('board_id', boardId)
      .single();

    if (fetchError) {
      return NextResponse.json(
        { error: fetchError.message },
        { status: 404 }
      );
    }

    const { data, error } = await supabase
      .from('whiteboard_objects')
      .update({
        ...body,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
        version: (current.version ?? 0) + 1,
      })
      .eq('id', objectId)
      .eq('board_id', boardId)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; objectId: string }> }
) {
  try {
    const { id: boardId, objectId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { error } = await supabase
      .from('whiteboard_objects')
      .delete()
      .eq('id', objectId)
      .eq('board_id', boardId);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
