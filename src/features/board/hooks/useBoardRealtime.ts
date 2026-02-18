'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CURSOR_THROTTLE_MS, CURSOR_COLORS } from '@/lib/constants';
import { useBoardObjects } from './useBoardObjects';
import { shouldApplyRemoteChange } from '../services/sync.service';
import {
  getConnectedArrows,
  computeArrowEndpoints,
} from '../utils/connector.utils';
import type { WhiteboardObject, PresenceUser, CursorPosition } from '../types';
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from '@supabase/supabase-js';

interface UseBoardRealtimeOptions {
  boardId: string | null;
  userId: string | null;
  userName: string | null;
}

export function getUserColor(userId: string): string {
  const index =
    Math.abs(
      userId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
    ) % CURSOR_COLORS.length;
  return CURSOR_COLORS[index];
}

// Module-level broadcaster so the Zustand store can send events
// without needing a direct reference to the channel.
// Includes a queue for broadcasts sent before the channel is ready.
let _broadcastFn: ((
  event: string,
  payload: Record<string, unknown>
) => void) | null = null;
let _pendingBroadcasts: Array<{
  event: string;
  payload: Record<string, unknown>;
}> = [];

export function broadcastToLiveChannel(
  event: string,
  payload: Record<string, unknown>
) {
  if (_broadcastFn) {
    _broadcastFn(event, payload);
  } else {
    // Channel not ready yet — queue for when it connects
    _pendingBroadcasts.push({ event, payload });
  }
}

function flushPendingBroadcasts() {
  if (!_broadcastFn) return;
  const pending = _pendingBroadcasts;
  _pendingBroadcasts = [];
  for (const { event, payload } of pending) {
    _broadcastFn(event, payload);
  }
}

/**
 * After receiving shape position updates from a remote user, recompute
 * any connected arrows so they track the shapes' new anchor positions.
 */
function recomputeConnectedArrows(shapeIds: string[]) {
  const state = useBoardObjects.getState();
  const objects = state.objects;
  const arrowUpdates: Array<{id: string; updates: Partial<WhiteboardObject>}> = [];
  const processed = new Set<string>();

  for (const shapeId of shapeIds) {
    const connectedArrows = getConnectedArrows(objects, shapeId);
    for (const arrow of connectedArrows) {
      if (processed.has(arrow.id)) continue;
      processed.add(arrow.id);

      const result = computeArrowEndpoints(arrow, objects);
      if (result) {
        arrowUpdates.push({
          id: arrow.id,
          updates: {
            x: result.x,
            y: result.y,
            width: result.width,
            height: result.height,
            properties: { ...arrow.properties, points: result.points },
          },
        });
      }
    }
  }

  if (arrowUpdates.length > 0) {
    state.batchUpdateObjects(arrowUpdates);
  }
}

export type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting';

export function useBoardRealtime({
  boardId,
  userId,
  userName,
}: UseBoardRealtimeOptions) {
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const [remoteCursors, setRemoteCursors] = useState<
    Map<string, CursorPosition>
  >(new Map());
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const liveChannelRef = useRef<RealtimeChannel | null>(null);
  const subscribedRef = useRef(false);
  const lastBroadcastRef = useRef<number>(0);

  // Channel 1: Postgres changes for object sync (separate channel to avoid
  // interference with broadcast/presence)
  useEffect(() => {
    if (!boardId) return;

    const supabase = createClient();
    const syncChannel = supabase
      .channel(`board:sync:${boardId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whiteboard_objects',
          filter: `board_id=eq.${boardId}`,
        },
        (
          payload: RealtimePostgresChangesPayload<{
            [key: string]: unknown;
          }>
        ) => {
          // Access store directly to avoid closure/dependency issues
          const store = useBoardObjects.getState();

          if (payload.eventType === 'INSERT') {
            const remote = payload.new as unknown as WhiteboardObject;
            if (!store.getObject(remote.id)) {
              store.addObject(remote);
            }
          } else if (payload.eventType === 'UPDATE') {
            const remote = payload.new as unknown as WhiteboardObject;
            const local = store.getObject(remote.id);
            if (!local) {
              store.addObject(remote);
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
              store.updateObject(remote.id, remote);
            }
          } else if (payload.eventType === 'DELETE') {
            // Without REPLICA IDENTITY FULL, old record may be empty.
            // Delete events are handled via broadcast instead (see below).
            const old = payload.old as { id?: string };
            if (old.id) {
              store.deleteObject(old.id);
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionStatus((prev) => {
            if (prev === 'reconnecting') {
              // Refetch full board state on reconnect to catch missed updates
              const store = useBoardObjects.getState();
              if (boardId && store.boardId) {
                supabase
                  .from('whiteboard_objects')
                  .select('*')
                  .eq('board_id', boardId)
                  .then(({ data }) => {
                    if (data) {
                      store.setObjects(data as unknown as WhiteboardObject[]);
                    }
                  });
              }
            }
            return 'connected';
          });
        } else if (status === 'CHANNEL_ERROR') {
          setConnectionStatus('reconnecting');
        } else if (status === 'CLOSED') {
          setConnectionStatus('disconnected');
        } else if (status === 'TIMED_OUT') {
          setConnectionStatus('reconnecting');
        }
      });

    return () => {
      supabase.removeChannel(syncChannel);
    };
  }, [boardId]);

  // Channel 2: Broadcast (cursors + object deletes) + Presence (online users)
  useEffect(() => {
    if (!boardId || !userId || !userName) return;

    const supabase = createClient();
    const userColor = getUserColor(userId);
    subscribedRef.current = false;

    // Show self immediately so we never display "0 online"
    const selfUser: PresenceUser = {
      userId,
      userName,
      color: userColor,
      onlineAt: new Date().toISOString(),
    };
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: show self before subscription connects
    setOnlineUsers([selfUser]);

    const liveChannel = supabase.channel(`board:live:${boardId}`, {
      config: { presence: { key: userId } },
    });

    // --- Cursor broadcast ---
    liveChannel.on('broadcast', { event: 'cursor' }, ({ payload }) => {
      const cursor = payload as CursorPosition;
      if (cursor.userId === userId) return;
      setRemoteCursors((prev) => {
        const next = new Map(prev);
        next.set(cursor.userId, cursor);
        return next;
      });
    });

    // --- Object mutation broadcasts ---
    // All object changes are broadcast for reliable real-time sync
    // (postgres_changes can be unreliable due to RLS/REPLICA IDENTITY).
    liveChannel.on(
      'broadcast',
      { event: 'object_create' },
      ({ payload }) => {
        const { object, senderId } = payload as {
          object: WhiteboardObject;
          senderId: string;
        };
        if (senderId === userId) return;
        const store = useBoardObjects.getState();
        if (!store.getObject(object.id)) {
          store.addObject(object);
        }
      }
    );

    liveChannel.on(
      'broadcast',
      { event: 'object_update' },
      ({ payload }) => {
        const { object, senderId } = payload as {
          object: WhiteboardObject;
          senderId: string;
        };
        if (senderId === userId) return;
        const store = useBoardObjects.getState();
        const local = store.getObject(object.id);
        if (!local) {
          store.addObject(object);
        } else if (
          shouldApplyRemoteChange(
            local.version,
            object.version,
            local.updated_at,
            object.updated_at
          )
        ) {
          store.updateObject(object.id, object);
        }
      }
    );

    // Live object move/resize broadcasts (ephemeral, no DB write)
    liveChannel.on(
      'broadcast',
      { event: 'object_move' },
      ({ payload }) => {
        const { id, updates, senderId } = payload as {
          id: string;
          updates: Partial<WhiteboardObject>;
          senderId: string;
        };
        if (senderId === userId) return;
        const store = useBoardObjects.getState();
        if (store.getObject(id)) {
          store.updateObject(id, updates);
          // Recompute connected arrows when a shape moves
          const obj = useBoardObjects.getState().objects.get(id);
          if (obj && obj.object_type !== 'arrow') {
            recomputeConnectedArrows([id]);
          }
        }
      }
    );

    // Batched move/resize broadcasts (group drag/resize) — applies all
    // updates in a single Zustand set() to avoid tearing on the remote
    liveChannel.on(
      'broadcast',
      { event: 'object_move_batch' },
      ({ payload }) => {
        const { updates, senderId } = payload as {
          updates: Array<{id: string; updates: Partial<WhiteboardObject>}>;
          senderId: string;
        };
        if (senderId === userId) return;
        useBoardObjects.getState().batchUpdateObjects(updates);
        // Recompute connected arrows for all updated shapes
        const shapeIds = updates
          .map((u) => u.id)
          .filter((id) => {
            const obj = useBoardObjects.getState().objects.get(id);
            return obj && obj.object_type !== 'arrow';
          });
        if (shapeIds.length > 0) {
          recomputeConnectedArrows(shapeIds);
        }
      }
    );

    liveChannel.on(
      'broadcast',
      { event: 'object_delete' },
      ({ payload }) => {
        const { id, senderId } = payload as {
          id: string;
          senderId: string;
        };
        if (senderId === userId) return;
        useBoardObjects.getState().deleteObject(id);
      }
    );

    // --- Presence sync ---
    liveChannel.on('presence', { event: 'sync' }, () => {
      const presenceState = liveChannel.presenceState<{
        userId: string;
        userName: string;
        color: string;
        onlineAt: string;
      }>();
      const users: PresenceUser[] = [];
      const seen = new Set<string>();
      for (const key of Object.keys(presenceState)) {
        for (const presence of presenceState[key]) {
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
      if (!seen.has(userId)) {
        users.push(selfUser);
      }
      setOnlineUsers(users);
    });

    // Subscribe and track presence
    liveChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        subscribedRef.current = true;
        liveChannelRef.current = liveChannel;
        // Set module-level broadcaster for the store to use
        _broadcastFn = (event, payload) => {
          liveChannel.send({ type: 'broadcast', event, payload });
        };
        flushPendingBroadcasts();
        await liveChannel.track({
          userId,
          userName,
          color: userColor,
          onlineAt: new Date().toISOString(),
        });
      }
    });

    return () => {
      subscribedRef.current = false;
      liveChannelRef.current = null;
      _broadcastFn = null;
      _pendingBroadcasts = [];
      supabase.removeChannel(liveChannel);
    };
  }, [boardId, userId, userName]);

  const broadcastCursor = useCallback(
    (x: number, y: number) => {
      if (
        !liveChannelRef.current ||
        !subscribedRef.current ||
        !userId ||
        !userName
      )
        return;

      const now = Date.now();
      if (now - lastBroadcastRef.current < CURSOR_THROTTLE_MS) return;
      lastBroadcastRef.current = now;

      liveChannelRef.current.send({
        type: 'broadcast',
        event: 'cursor',
        payload: {
          userId,
          userName,
          color: getUserColor(userId),
          x,
          y,
        } satisfies CursorPosition,
      });
    },
    [userId, userName]
  );

  return { onlineUsers, remoteCursors, broadcastCursor, connectionStatus };
}
