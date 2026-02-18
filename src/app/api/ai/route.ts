import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { processAIMessage } from '@/features/ai-agent/services/ai.service';
import { AI_RATE_LIMIT_PER_MINUTE } from '@/lib/constants';
import { logger } from '@/lib/logger';
import { v4 as uuidv4 } from 'uuid';
import type { AIRequestBody, AIResponseBody, AIRequestContext, BoardStateSummary } from '@/features/ai-agent/types';

// Simple in-memory rate limiter
export const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(userId: string): boolean {
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
  const requestId = uuidv4();
  const startTime = Date.now();

  try {
    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      logger.warn('ai.request.rejected', {
        requestId,
        reason: 'unauthorized',
        errorCategory: 'auth',
      });
      return NextResponse.json(
        { error: 'Unauthorized' } satisfies Partial<AIResponseBody>,
        { status: 401 }
      );
    }

    // Rate limit
    if (!checkRateLimit(user.id)) {
      logger.warn('ai.request.rejected', {
        requestId,
        userId: user.id,
        reason: 'rate_limit_exceeded',
        errorCategory: 'rate_limit',
      });
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
      logger.warn('ai.request.rejected', {
        requestId,
        userId: user.id,
        reason: 'missing_message',
        errorCategory: 'validation',
      });
      return NextResponse.json(
        { error: 'Message is required' } satisfies Partial<AIResponseBody>,
        { status: 400 }
      );
    }

    if (!body.boardId || typeof body.boardId !== 'string') {
      logger.warn('ai.request.rejected', {
        requestId,
        userId: user.id,
        reason: 'missing_board_id',
        errorCategory: 'validation',
      });
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
      logger.warn('ai.request.rejected', {
        requestId,
        userId: user.id,
        boardId: body.boardId,
        reason: 'no_board_access',
        errorCategory: 'authorization',
      });
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

    logger.info('ai.request.start', {
      requestId,
      userId: user.id,
      boardId: body.boardId,
      messagePreview: body.message.slice(0, 200),
      boardObjectCount: boardState.length,
    });

    const ctx: AIRequestContext = {
      requestId,
      userId: user.id,
      boardId: body.boardId,
      startTime,
    };

    // Process with AI
    const { reply, toolCalls } = await processAIMessage(
      body.message,
      body.boardId,
      user.id,
      boardState,
      body.viewportCenter,
      ctx
    );

    // Extract deleted object IDs from tool calls
    const deletedObjectIds = toolCalls
      .filter((tc) => tc.toolName === 'deleteObject' && tc.objectId)
      .map((tc) => tc.objectId as string);

    // Fetch created objects so the client can hydrate its local store immediately
    const createdObjectIds = toolCalls
      .filter((tc) => tc.toolName !== 'deleteObject')
      .map((tc) => tc.objectId)
      .filter((id): id is string => !!id);

    let createdObjects;
    if (createdObjectIds.length > 0) {
      const { data } = await serviceClient
        .from('whiteboard_objects')
        .select('*')
        .in('id', createdObjectIds);
      createdObjects = data ?? undefined;
    }

    const response: AIResponseBody = {
      reply,
      toolCalls,
      createdObjects,
      deletedObjectIds:
        deletedObjectIds.length > 0 ? deletedObjectIds : undefined,
    };

    logger.info('ai.request.complete', {
      requestId,
      totalDurationMs: Date.now() - startTime,
      toolCallCount: toolCalls.length,
      createdObjectCount: createdObjectIds.length,
    });

    return NextResponse.json(response);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Internal server error';
    logger.error('ai.request.error', {
      requestId,
      error: message,
      errorCategory: 'unhandled',
      durationMs: Date.now() - startTime,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: message } satisfies Partial<AIResponseBody>,
      { status: 500 }
    );
  }
}
