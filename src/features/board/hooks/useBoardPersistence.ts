'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { fetchBoardObjects } from '../services/board.service';
import { useBoardObjects } from './useBoardObjects';

export function useBoardPersistence(
  boardId: string | null,
  userId: string | null
) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [boardVisibility, setBoardVisibility] = useState<'public' | 'private'>('public');
  const { setObjects, setBoardContext } = useBoardObjects();
  const joinedRef = useRef(false);

  // Set board context so sync methods know the boardId/userId
  useEffect(() => {
    if (boardId && userId) {
      setBoardContext(boardId, userId);
    }
  }, [boardId, userId, setBoardContext]);

  const loadObjects = useCallback(async () => {
    if (!boardId || !userId) return;
    setLoading(true);
    setError(null);
    try {
      // Ensure the current user is a board member via server-side API
      // (uses service role to bypass RLS)
      if (!joinedRef.current) {
        const joinRes = await fetch('/api/boards/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ boardId }),
        });

        if (!joinRes.ok) {
          const body = await joinRes.json().catch(() => ({}));
          if (joinRes.status === 403) {
            throw new Error(
              'Access denied: this board is private'
            );
          }
          if (joinRes.status === 404) {
            throw new Error('Board not found');
          }
          throw new Error(
            body.error || 'Failed to join board'
          );
        }
        const joinData = await joinRes.json();
        if (joinData.visibility) {
          setBoardVisibility(joinData.visibility);
        }
        joinedRef.current = true;
      }

      const objects = await fetchBoardObjects(boardId);
      setObjects(objects);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load board';
      setError(message);
      console.error('Failed to load board objects:', err);
    } finally {
      setLoading(false);
    }
  }, [boardId, userId, setObjects]);

  // Soft reload: re-fetch objects without showing loading spinner
  const softReload = useCallback(async () => {
    if (!boardId || !userId) return;
    try {
      const objects = await fetchBoardObjects(boardId);
      setObjects(objects);
    } catch {
      // Silent fail for background refresh
    }
  }, [boardId, userId, setObjects]);

  // Initial load
  useEffect(() => {
    loadObjects();
  }, [loadObjects]);

  // Re-sync objects when the tab becomes visible (catches any changes
  // missed while the WebSocket was potentially disconnected)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        softReload();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    // Also re-sync when the window regains focus (covers tab switching)
    window.addEventListener('focus', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, [softReload]);

  return { loading, error, reload: loadObjects, boardVisibility };
}
