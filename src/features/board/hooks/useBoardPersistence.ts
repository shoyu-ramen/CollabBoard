'use client';

import { useEffect, useState, useCallback } from 'react';
import { fetchBoardObjects } from '../services/board.service';
import { useBoardObjects } from './useBoardObjects';

export function useBoardPersistence(boardId: string | null) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { setObjects } = useBoardObjects();

  const loadObjects = useCallback(async () => {
    if (!boardId) return;
    setLoading(true);
    setError(null);
    try {
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
  }, [boardId, setObjects]);

  useEffect(() => {
    loadObjects();
  }, [loadObjects]);

  return { loading, error, reload: loadObjects };
}
