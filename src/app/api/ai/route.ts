import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { processAIMessage } from '@/features/ai-agent/services/ai.service';
import { AI_RATE_LIMIT_PER_MINUTE } from '@/lib/constants';
import type { AIRequestBody, AIResponseBody, BoardStateSummary } from '@/features/ai-agent/types';

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + 60_000 });
    return true;
  }

  if (entry.count >= AI_RATE_LIMIT_PER_MINUTE) {
    return false;
  }

  entry.count++;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' } satisfies Partial<AIResponseBody>,
        { status: 401 }
      );
    }

    // Rate limit
    if (!checkRateLimit(user.id)) {
      return NextResponse.json(
        {
          error: `Rate limit exceeded. Maximum ${AI_RATE_LIMIT_PER_MINUTE} requests per minute.`,
        } satisfies Partial<AIResponseBody>,
        { status: 429 }
      );
    }

    // Parse and validate request body
    const body = (await request.json()) as AIRequestBody;

    if (!body.message || typeof body.message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' } satisfies Partial<AIResponseBody>,
        { status: 400 }
      );
    }

    if (!body.boardId || typeof body.boardId !== 'string') {
      return NextResponse.json(
        { error: 'Board ID is required' } satisfies Partial<AIResponseBody>,
        { status: 400 }
      );
    }

    // Verify user has access to this board
    const { data: membership } = await supabase
      .from('board_members')
      .select('role')
      .eq('board_id', body.boardId)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: 'You do not have access to this board' } satisfies Partial<AIResponseBody>,
        { status: 403 }
      );
    }

    // Get current board state from Supabase
    const serviceClient = await createServiceClient();
    const { data: objects } = await serviceClient
      .from('whiteboard_objects')
      .select('id, object_type, x, y, width, height, properties')
      .eq('board_id', body.boardId)
      .order('created_at', { ascending: true });

    const boardState: BoardStateSummary[] = (objects || []).map((obj) => {
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

    // Process with AI
    const { reply, toolCalls } = await processAIMessage(
      body.message,
      body.boardId,
      user.id,
      boardState
    );

    const response: AIResponseBody = {
      reply,
      toolCalls,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('AI API error:', error);
    const message =
      error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: message } satisfies Partial<AIResponseBody>,
      { status: 500 }
    );
  }
}
