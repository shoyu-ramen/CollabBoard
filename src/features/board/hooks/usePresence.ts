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
  const colorIndexRef = useRef<number>(0);

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
    colorIndexRef.current = colorIndex;

    // Include self immediately so we never show "0 online"
    const selfUser: PresenceUser = {
      userId,
      userName,
      color: CURSOR_COLORS[colorIndex],
      onlineAt: new Date().toISOString(),
    };
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: show self before subscription connects
    setOnlineUsers([selfUser]);

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{
          userId: string;
          userName: string;
          color: string;
          onlineAt: string;
        }>();
        const users: PresenceUser[] = [];
        const seen = new Set<string>();
        for (const key of Object.keys(state)) {
          for (const presence of state[key]) {
            if (!seen.has(presence.userId)) {
              seen.add(presence.userId);
              users.push({
                userId: presence.userId,
                userName: presence.userName,
                color: presence.color,
                onlineAt: presence.onlineAt,
              });
            }
          }
        }
        // If presence state doesn't include self yet, add them
        if (!seen.has(userId)) {
          users.push(selfUser);
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
