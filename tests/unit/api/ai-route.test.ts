import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// --- Mock processAIMessage ---
const mockProcessAIMessage = vi.fn();
vi.mock('@/features/ai-agent/services/ai.service', () => ({
  processAIMessage: (...args: unknown[]) => mockProcessAIMessage(...args),
}));

// --- Mock Supabase ---
const mockGetUser = vi.fn();
const mockMembershipSingle = vi.fn();
const mockMembershipEq2 = vi.fn().mockReturnValue({
  single: (...args: unknown[]) => mockMembershipSingle(...args),
});
const mockMembershipEq1 = vi.fn().mockReturnValue({
  eq: mockMembershipEq2,
});
const mockMembershipSelect = vi.fn().mockReturnValue({
  eq: mockMembershipEq1,
});

const mockAuthClient = {
  auth: {
    getUser: () => mockGetUser(),
  },
  from: vi.fn().mockReturnValue({
    select: mockMembershipSelect,
  }),
};

const mockObjectsOrder = vi.fn().mockResolvedValue({ data: [], error: null });
const mockObjectsEq = vi.fn().mockReturnValue({ order: mockObjectsOrder });
const mockObjectsSelect = vi.fn().mockReturnValue({ eq: mockObjectsEq });

// For fetching created objects
const mockInIds = vi.fn().mockResolvedValue({ data: [], error: null });

const mockServiceClient = {
  from: vi.fn().mockImplementation((table: string) => {
    if (table === 'whiteboard_objects') {
      return {
        select: vi.fn().mockImplementation((fields: string) => {
          if (fields === '*') {
            return { in: mockInIds };
          }
          return { eq: mockObjectsEq };
        }),
      };
    }
    return { select: mockObjectsSelect };
  }),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockAuthClient),
  createServiceClient: vi.fn(async () => mockServiceClient),
}));

import { POST } from '@/app/api/ai/route';
import { rateLimitMap } from '@/app/api/ai/route';

function createMockRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/ai', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitMap.clear();

    // Reset default mock implementations
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });

    mockMembershipSingle.mockResolvedValue({
      data: { role: 'editor' },
      error: null,
    });
    mockMembershipEq2.mockReturnValue({
      single: (...args: unknown[]) => mockMembershipSingle(...args),
    });
    mockMembershipEq1.mockReturnValue({ eq: mockMembershipEq2 });
    mockMembershipSelect.mockReturnValue({ eq: mockMembershipEq1 });

    mockAuthClient.from.mockReturnValue({
      select: mockMembershipSelect,
    });

    mockObjectsOrder.mockResolvedValue({ data: [], error: null });
    mockObjectsEq.mockReturnValue({ order: mockObjectsOrder });

    mockServiceClient.from.mockImplementation((table: string) => {
      if (table === 'whiteboard_objects') {
        return {
          select: vi.fn().mockImplementation((fields: string) => {
            if (fields === '*') {
              return { in: mockInIds };
            }
            return { eq: mockObjectsEq };
          }),
        };
      }
      return { select: mockObjectsSelect };
    });

    mockProcessAIMessage.mockResolvedValue({
      reply: 'AI reply',
      toolCalls: [],
    });
  });

  // ── 401 Unauthorized ─────────────────────────────────────────────

  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Not authenticated' },
    });

    const req = createMockRequest({ message: 'hello', boardId: 'b1' });
    const res = await POST(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 401 when getUser returns null user without error', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    const req = createMockRequest({ message: 'hello', boardId: 'b1' });
    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  // ── 400 Bad Request ───────────────────────────────────────────────

  it('returns 400 when message is missing', async () => {
    const req = createMockRequest({ boardId: 'b1' });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Message is required');
  });

  it('returns 400 when boardId is missing', async () => {
    const req = createMockRequest({ message: 'hello' });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Board ID is required');
  });

  // ── 403 Forbidden ─────────────────────────────────────────────────

  it('returns 403 when user is not a board member', async () => {
    mockMembershipSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const req = createMockRequest({ message: 'hello', boardId: 'b1' });
    const res = await POST(req);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('do not have access');
  });

  // ── 429 Rate Limited ──────────────────────────────────────────────

  it('returns 429 after exceeding rate limit', async () => {
    // Make 10 successful requests (the limit)
    for (let i = 0; i < 10; i++) {
      const req = createMockRequest({ message: `msg ${i}`, boardId: 'b1' });
      const res = await POST(req);
      expect(res.status).toBe(200);
    }

    // 11th request should be rate limited
    const req = createMockRequest({ message: 'one more', boardId: 'b1' });
    const res = await POST(req);

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toContain('Rate limit exceeded');
  });

  // ── 200 Success ───────────────────────────────────────────────────

  it('returns 200 with AI reply and toolCalls on success', async () => {
    mockProcessAIMessage.mockResolvedValueOnce({
      reply: 'I created a sticky note for you!',
      toolCalls: [
        {
          toolName: 'createStickyNote',
          input: { text: 'Hello' },
          result: 'Created sticky note',
          objectId: 'new-obj-1',
        },
      ],
    });

    mockInIds.mockResolvedValueOnce({
      data: [
        {
          id: 'new-obj-1',
          board_id: 'b1',
          object_type: 'sticky_note',
          x: 100,
          y: 100,
          width: 200,
          height: 200,
          rotation: 0,
          properties: { text: 'Hello', noteColor: '#FEF08A' },
          updated_by: 'user-1',
          version: 1,
        },
      ],
      error: null,
    });

    const req = createMockRequest({ message: 'create a sticky', boardId: 'b1' });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reply).toBe('I created a sticky note for you!');
    expect(body.toolCalls).toHaveLength(1);
    expect(body.toolCalls[0].toolName).toBe('createStickyNote');
    expect(body.createdObjects).toHaveLength(1);
    expect(body.createdObjects[0].id).toBe('new-obj-1');
  });

  it('returns 200 with no createdObjects when toolCalls have no objectIds', async () => {
    mockProcessAIMessage.mockResolvedValueOnce({
      reply: 'The board is empty.',
      toolCalls: [
        {
          toolName: 'getBoardState',
          input: {},
          result: '[]',
        },
      ],
    });

    const req = createMockRequest({
      message: 'what is on the board?',
      boardId: 'b1',
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reply).toBe('The board is empty.');
    expect(body.createdObjects).toBeUndefined();
  });

  it('passes viewportCenter to processAIMessage when provided', async () => {
    const req = createMockRequest({
      message: 'add a note',
      boardId: 'b1',
      viewportCenter: { x: 500, y: 300 },
    });
    await POST(req);

    expect(mockProcessAIMessage).toHaveBeenCalledWith(
      'add a note',
      'b1',
      'user-1',
      expect.any(Array),
      { x: 500, y: 300 }
    );
  });

  // ── 500 Error ─────────────────────────────────────────────────────

  it('returns 500 when processAIMessage throws', async () => {
    mockProcessAIMessage.mockRejectedValueOnce(
      new Error('Anthropic API error')
    );

    const req = createMockRequest({ message: 'hello', boardId: 'b1' });
    const res = await POST(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Anthropic API error');
  });
});
