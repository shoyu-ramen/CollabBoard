import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
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
    const boardId = searchParams.get('boardId');

    if (!boardId) {
      return NextResponse.json(
        { error: 'Board ID is required' },
        { status: 400 }
      );
    }

    const serviceClient = await createServiceClient();

    // Verify caller is a member of the board
    const { data: callerMember } = await serviceClient
      .from('board_members')
      .select('role')
      .eq('board_id', boardId)
      .eq('user_id', user.id)
      .single();

    if (!callerMember) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Get all members
    const { data: members, error: membersError } = await serviceClient
      .from('board_members')
      .select('user_id, role')
      .eq('board_id', boardId);

    if (membersError) {
      return NextResponse.json(
        { error: membersError.message },
        { status: 500 }
      );
    }

    // Resolve emails
    const membersWithEmail = await Promise.all(
      (members ?? []).map(async (m) => {
        const { data: userData } =
          await serviceClient.auth.admin.getUserById(m.user_id);
        return {
          user_id: m.user_id,
          role: m.role,
          email: userData?.user?.email ?? 'Unknown',
        };
      })
    );

    return NextResponse.json({ members: membersWithEmail });
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
    const { boardId, email } = body;

    if (!boardId || !email) {
      return NextResponse.json(
        { error: 'Board ID and email are required' },
        { status: 400 }
      );
    }

    const serviceClient = await createServiceClient();

    // Verify caller is the board owner
    const { data: board } = await serviceClient
      .from('boards')
      .select('created_by')
      .eq('id', boardId)
      .single();

    if (!board || board.created_by !== user.id) {
      return NextResponse.json(
        { error: 'Only the board owner can invite members' },
        { status: 403 }
      );
    }

    // Look up user by email
    const { data: usersData } =
      await serviceClient.auth.admin.listUsers();

    const targetUser = usersData?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (!targetUser) {
      return NextResponse.json(
        { error: 'No user found with that email' },
        { status: 404 }
      );
    }

    // Add as editor
    const { error: insertError } = await serviceClient
      .from('board_members')
      .upsert(
        {
          board_id: boardId,
          user_id: targetUser.id,
          role: 'editor',
        },
        { onConflict: 'board_id,user_id', ignoreDuplicates: true }
      );

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      member: {
        user_id: targetUser.id,
        role: 'editor',
        email: targetUser.email,
      },
    });
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
    const boardId = searchParams.get('boardId');
    const userId = searchParams.get('userId');

    if (!boardId || !userId) {
      return NextResponse.json(
        { error: 'Board ID and user ID are required' },
        { status: 400 }
      );
    }

    // Cannot remove yourself
    if (userId === user.id) {
      return NextResponse.json(
        { error: 'Cannot remove yourself from the board' },
        { status: 400 }
      );
    }

    const serviceClient = await createServiceClient();

    // Verify caller is the board owner
    const { data: board } = await serviceClient
      .from('boards')
      .select('created_by')
      .eq('id', boardId)
      .single();

    if (!board || board.created_by !== user.id) {
      return NextResponse.json(
        { error: 'Only the board owner can remove members' },
        { status: 403 }
      );
    }

    const { error: deleteError } = await serviceClient
      .from('board_members')
      .delete()
      .eq('board_id', boardId)
      .eq('user_id', userId);

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
