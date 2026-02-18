'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createClient } from '@/lib/supabase/client';
import { CURSOR_COLORS } from '@/lib/constants';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface BoardPresenceUser {
  userId: string;
  userName: string;
  color: string;
}

interface BoardPresenceContextValue {
  /** Map of boardId → users currently on that board */
  presenceMap: Record<string, BoardPresenceUser[]>;
  /** Call when entering a board to announce your presence */
  trackBoard: (
    boardId: string,
    userId: string,
    userName: string
  ) => void;
  /** Call when leaving a board */
  untrackBoard: () => void;
}

const BoardPresenceContext = createContext<BoardPresenceContextValue>({
  presenceMap: {},
  trackBoard: () => {},
  untrackBoard: () => {},
});

export function useBoardPresence() {
  return useContext(BoardPresenceContext);
}

function getUserColor(userId: string): string {
  const index =
    Math.abs(
      userId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
    ) % CURSOR_COLORS.length;
  return CURSOR_COLORS[index];
}

export function BoardPresenceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [presenceMap, setPresenceMap] = useState<
    Record<string, BoardPresenceUser[]>
  >({});
  const channelRef = useRef<RealtimeChannel | null>(null);
  const trackedKeyRef = useRef<string | null>(null);

  // Subscribe once and keep the channel alive for the lifetime of the app
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel('global:board-presence');

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<{
        userId: string;
        userName: string;
        color: string;
        boardId: string;
      }>();

      const map: Record<string, BoardPresenceUser[]> = {};
      for (const key of Object.keys(state)) {
        for (const p of state[key]) {
          if (!p.boardId) continue;
          if (!map[p.boardId]) map[p.boardId] = [];
          if (!map[p.boardId].some((u) => u.userId === p.userId)) {
            map[p.boardId].push({
              userId: p.userId,
              userName: p.userName,
              color: p.color ?? getUserColor(p.userId),
            });
          }
        }
      }
      setPresenceMap(map);
    });

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, []);

  const trackBoard = useCallback(
    (boardId: string, userId: string, userName: string) => {
      const channel = channelRef.current;
      if (!channel) return;

      const key = `${userId}:${boardId}`;
      trackedKeyRef.current = key;

      channel.track({
        boardId,
        userId,
        userName,
        color: getUserColor(userId),
      });
    },
    []
  );

  const untrackBoard = useCallback(() => {
    const channel = channelRef.current;
    if (!channel) return;
    trackedKeyRef.current = null;
    channel.untrack();
  }, []);

  return (
    <BoardPresenceContext.Provider
      value={{ presenceMap, trackBoard, untrackBoard }}
    >
      {children}
    </BoardPresenceContext.Provider>
  );
}
