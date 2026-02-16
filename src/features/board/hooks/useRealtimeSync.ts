'use client';

import { useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { REALTIME_CHANNEL_PREFIX } from '@/lib/constants';
import { useBoardObjects } from './useBoardObjects';
import { shouldApplyRemoteChange } from '../services/sync.service';
import type { WhiteboardObject } from '../types';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export function useRealtimeSync(boardId: string | null) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const { addObject, updateObject, deleteObject, getObject } =
    useBoardObjects();

  const handlePostgresChange = useCallback(
    (
      payload: RealtimePostgresChangesPayload<{
        [key: string]: unknown;
      }>
    ) => {
      const eventType = payload.eventType;

      if (eventType === 'INSERT') {
        const remote = payload.new as unknown as WhiteboardObject;
        const existing = getObject(remote.id);
        if (!existing) {
          addObject(remote);
        }
      } else if (eventType === 'UPDATE') {
        const remote = payload.new as unknown as WhiteboardObject;
        const local = getObject(remote.id);
        if (!local) {
          addObject(remote);
          return;
        }
        if (
          shouldApplyRemoteChange(
            local.version,
            remote.version,
            local.updated_at,
            remote.updated_at
          )
        ) {
          updateObject(remote.id, remote);
        }
      } else if (eventType === 'DELETE') {
        const old = payload.old as { id?: string };
        if (old.id) {
          deleteObject(old.id);
        }
      }
    },
    [addObject, updateObject, deleteObject, getObject]
  );

  useEffect(() => {
    if (!boardId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`${REALTIME_CHANNEL_PREFIX}${boardId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whiteboard_objects',
          filter: `board_id=eq.${boardId}`,
        },
        handlePostgresChange
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [boardId, handlePostgresChange]);

  return channelRef;
}
