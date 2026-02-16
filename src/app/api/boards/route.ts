import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
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

    const { data, error } = await supabase
      .from('boards')
      .select('*, board_members!inner(user_id)')
      .eq('board_members.user_id', user.id)
      .order('created_at', { ascending: false });

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
    const { name } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'Board name is required' },
        { status: 400 }
      );
    }

    // Create the board
    const { data: board, error: boardError } = await supabase
      .from('boards')
      .insert({ name, created_by: user.id })
      .select()
      .single();

    if (boardError) {
      return NextResponse.json(
        { error: boardError.message },
        { status: 500 }
      );
    }

    // Add creator as owner member
    const { error: memberError } = await supabase
      .from('board_members')
      .insert({
        board_id: board.id,
        user_id: user.id,
        role: 'owner',
      });

    if (memberError) {
      return NextResponse.json(
        { error: memberError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(board, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
