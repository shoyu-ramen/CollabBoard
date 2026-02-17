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

    // All boards are public — return every board for any authenticated user
    const serviceClient = await createServiceClient();
    const { data, error } = await serviceClient
      .from('boards')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Resolve creator emails
    const creatorIds = [...new Set((data ?? []).map((b) => b.created_by))];
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

    const boards = (data ?? []).map((b) => ({
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

    // Use service client to bypass RLS (auth already verified above)
    // The trigger auto-adds creator as owner in board_members
    const serviceClient = await createServiceClient();
    const { data: board, error: boardError } = await serviceClient
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
    const { id, name } = body;

    if (!id || !name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'Board ID and name are required' },
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
        { error: 'Only the board owner can rename it' },
        { status: 403 }
      );
    }

    const { data: updated, error: updateError } = await serviceClient
      .from('boards')
      .update({ name: name.trim() })
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
