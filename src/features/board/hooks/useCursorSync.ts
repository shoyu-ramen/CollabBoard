'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  REALTIME_CHANNEL_PREFIX,
  CURSOR_THROTTLE_MS,
  CURSOR_COLORS,
} from '@/lib/constants';
import type { CursorPosition } from '../types';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseCursorSyncOptions {
  boardId: string | null;
  userId: string | null;
  userName: string | null;
}

export function useCursorSync({
  boardId,
  userId,
  userName,
}: UseCursorSyncOptions) {
  const [remoteCursors, setRemoteCursors] = useState<
    Map<string, CursorPosition>
  >(new Map());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastBroadcastRef = useRef<number>(0);

  useEffect(() => {
    if (!boardId || !userId || !userName) return;

    const supabase = createClient();
    const channel = supabase.channel(
      `${REALTIME_CHANNEL_PREFIX}cursors:${boardId}`
    );

    channel
      .on('broadcast', { event: 'cursor' }, ({ payload }) => {
        const cursor = payload as CursorPosition;
        if (cursor.userId === userId) return;
        setRemoteCursors((prev) => {
          const next = new Map(prev);
          next.set(cursor.userId, cursor);
          return next;
        });
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [boardId, userId, userName]);

  const broadcastCursor = useCallback(
    (x: number, y: number) => {
      if (!channelRef.current || !userId || !userName) return;

      const now = Date.now();
      if (now - lastBroadcastRef.current < CURSOR_THROTTLE_MS) return;
      lastBroadcastRef.current = now;

      const colorIndex =
        Math.abs(
          userId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
        ) % CURSOR_COLORS.length;

      channelRef.current.send({
        type: 'broadcast',
        event: 'cursor',
        payload: {
          userId,
          userName,
          color: CURSOR_COLORS[colorIndex],
          x,
          y,
        } satisfies CursorPosition,
      });
    },
    [userId, userName]
  );

  return { remoteCursors, broadcastCursor };
}
