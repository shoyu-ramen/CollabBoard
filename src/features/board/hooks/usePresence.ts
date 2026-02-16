'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { PRESENCE_CHANNEL_PREFIX, CURSOR_COLORS } from '@/lib/constants';
import type { PresenceUser } from '../types';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UsePresenceOptions {
  boardId: string | null;
  userId: string | null;
  userName: string | null;
}

export function usePresence({
  boardId,
  userId,
  userName,
}: UsePresenceOptions) {
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!boardId || !userId || !userName) return;

    const supabase = createClient();
    const channel = supabase.channel(
      `${PRESENCE_CHANNEL_PREFIX}${boardId}`
    );

    const colorIndex =
      Math.abs(
        userId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
      ) % CURSOR_COLORS.length;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{
          userId: string;
          userName: string;
          color: string;
          onlineAt: string;
        }>();
        const users: PresenceUser[] = [];
        for (const key of Object.keys(state)) {
          for (const presence of state[key]) {
            users.push({
              userId: presence.userId,
              userName: presence.userName,
              color: presence.color,
              onlineAt: presence.onlineAt,
            });
          }
        }
        setOnlineUsers(users);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            userId,
            userName,
            color: CURSOR_COLORS[colorIndex],
            onlineAt: new Date().toISOString(),
          });
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [boardId, userId, userName]);

  return { onlineUsers };
}
