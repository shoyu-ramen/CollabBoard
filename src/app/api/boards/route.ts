import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { generateBoardName } from '@/lib/generateBoardName';

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

    // Fetch all boards the user can see via RLS
    const { data, error } = await supabase
      .from('boards')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Defense-in-depth: filter out private boards the user doesn't own
    // and isn't a member of, in case RLS policies are misconfigured
    const serviceClient = await createServiceClient();
    const allBoards = data ?? [];

    const { data: memberships } = await serviceClient
      .from('board_members')
      .select('board_id')
      .eq('user_id', user.id);
    const memberBoardIds = new Set(
      (memberships ?? []).map((m) => m.board_id)
    );

    const visibleBoards = allBoards.filter(
      (b) =>
        b.visibility === 'public' ||
        b.created_by === user.id ||
        memberBoardIds.has(b.id)
    );

    // Resolve creator emails (requires service client for admin API)
    const creatorIds = [
      ...new Set(visibleBoards.map((b) => b.created_by)),
    ];
    const emailMap: Record<string, string> = {};
    await Promise.all(
      creatorIds.map(async (id) => {
        const { data: userData } =
          await serviceClient.auth.admin.getUserById(id);
        if (userData?.user?.email) {
          emailMap[id] = userData.user.email;
        }
      })
    );

    const boards = visibleBoards.map((b) => ({
      ...b,
      creator_email: emailMap[b.created_by] ?? null,
    }));

    return NextResponse.json({ boards });
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

    const body = await request.json().catch(() => ({}));
    const name =
      body.name && typeof body.name === 'string'
        ? body.name.trim()
        : generateBoardName();
    const visibility =
      body.visibility === 'private' ? 'private' : 'public';

    // Use service client to bypass RLS (auth already verified above)
    // The trigger auto-adds creator as owner in board_members
    const serviceClient = await createServiceClient();
    const { data: board, error: boardError } = await serviceClient
      .from('boards')
      .insert({ name, visibility, created_by: user.id })
      .select()
      .single();

    if (boardError) {
      return NextResponse.json(
        { error: boardError.message },
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

export async function PATCH(request: Request) {
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
    const { id, name, visibility } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Board ID is required' },
        { status: 400 }
      );
    }

    if (!name && !visibility) {
      return NextResponse.json(
        { error: 'Name or visibility is required' },
        { status: 400 }
      );
    }

    if (
      visibility &&
      visibility !== 'public' &&
      visibility !== 'private'
    ) {
      return NextResponse.json(
        { error: 'Visibility must be "public" or "private"' },
        { status: 400 }
      );
    }

    const serviceClient = await createServiceClient();
    const { data: board, error: fetchError } = await serviceClient
      .from('boards')
      .select('created_by')
      .eq('id', id)
      .single();

    if (fetchError || !board) {
      return NextResponse.json(
        { error: 'Board not found' },
        { status: 404 }
      );
    }

    if (board.created_by !== user.id) {
      return NextResponse.json(
        { error: 'Only the board owner can update it' },
        { status: 403 }
      );
    }

    const updates: Record<string, string> = {};
    if (name && typeof name === 'string') updates.name = name.trim();
    if (visibility) updates.visibility = visibility;

    const { data: updated, error: updateError } = await serviceClient
      .from('boards')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const boardId = searchParams.get('id');

    if (!boardId) {
      return NextResponse.json(
        { error: 'Board ID is required' },
        { status: 400 }
      );
    }

    // Verify the user owns this board
    const serviceClient = await createServiceClient();
    const { data: board, error: fetchError } = await serviceClient
      .from('boards')
      .select('created_by')
      .eq('id', boardId)
      .single();

    if (fetchError || !board) {
      return NextResponse.json(
        { error: 'Board not found' },
        { status: 404 }
      );
    }

    if (board.created_by !== user.id) {
      return NextResponse.json(
        { error: 'Only the board owner can delete it' },
        { status: 403 }
      );
    }

    const { error: deleteError } = await serviceClient
      .from('boards')
      .delete()
      .eq('id', boardId);

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
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
