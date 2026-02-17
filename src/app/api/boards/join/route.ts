import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
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
    const { boardId } = body;

    if (!boardId || typeof boardId !== 'string') {
      return NextResponse.json(
        { error: 'Board ID is required' },
        { status: 400 }
      );
    }

    const serviceClient = await createServiceClient();

    // Verify board exists
    const { data: board, error: boardError } = await serviceClient
      .from('boards')
      .select('id')
      .eq('id', boardId)
      .single();

    if (boardError || !board) {
      return NextResponse.json(
        { error: 'Board not found' },
        { status: 404 }
      );
    }

    // Add user as editor (ignore if already a member)
    const { error: joinError } = await serviceClient
      .from('board_members')
      .upsert(
        { board_id: boardId, user_id: user.id, role: 'editor' },
        { onConflict: 'board_id,user_id', ignoreDuplicates: true }
      );

    if (joinError) {
      return NextResponse.json(
        { error: joinError.message },
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
