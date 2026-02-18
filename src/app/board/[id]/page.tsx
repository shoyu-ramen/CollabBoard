'use client';

import { use, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import Toolbar from '@/features/board/components/Toolbar';
import PropertiesPanel from '@/features/board/components/PropertiesPanel';
import { PresenceIndicator } from '@/features/board/components/PresenceIndicator';
import { AIButton } from '@/features/ai-agent/components/AIButton';
import { AIChatPanel } from '@/features/ai-agent/components/AIChatPanel';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useBoardRealtime } from '@/features/board/hooks/useBoardRealtime';
import { useBoardPersistence } from '@/features/board/hooks/useBoardPersistence';
import { useCanvas } from '@/features/board/hooks/useCanvas';
import { useBoardPresence } from '@/features/board/contexts/BoardPresenceProvider';

const Canvas = dynamic(
  () => import('@/features/board/components/Canvas'),
  { ssr: false }
);

const CursorOverlayDynamic = dynamic(
  () =>
    import('@/features/board/components/CursorOverlay').then(
      (mod) => mod.CursorOverlay
    ),
  { ssr: false }
);

export default function BoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: boardId } = use(params);
  const { user } = useAuth();

  const userId = user?.id ?? null;
  const userName =
    user?.user_metadata?.full_name ??
    user?.email?.split('@')[0] ??
    'Anonymous';

  // Load board objects from Supabase (also handles auto-join via API)
  const { loading, error, reload } = useBoardPersistence(boardId, userId);

  // Only activate realtime channels after the board is loaded and the user
  // has joined (via the join API). This ensures RLS access is established
  // before the channels subscribe.
  const realtimeBoardId = loading ? null : boardId;
  const { onlineUsers, remoteCursors, broadcastCursor, connectionStatus } = useBoardRealtime({
    boardId: realtimeBoardId,
    userId,
    userName,
  });

  // Track presence on the global dashboard presence channel
  const { trackBoard, untrackBoard } = useBoardPresence();
  useEffect(() => {
    if (!loading && userId && userName) {
      trackBoard(boardId, userId, userName);
    }
    return () => {
      untrackBoard();
    };
  }, [loading, boardId, userId, userName, trackBoard, untrackBoard]);

  // AI panel state
  const [aiPanelOpen, setAiPanelOpen] = useState(false);

  // Canvas state for cursor coordinate conversion
  const zoom = useCanvas((s) => s.zoom);
  const panOffset = useCanvas((s) => s.panOffset);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="text-sm text-gray-500">Loading board...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-lg font-medium text-red-600">
            Failed to load board
          </p>
          <p className="text-sm text-gray-500">{error}</p>
          <button
            onClick={reload}
            className="mt-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <main
      className="relative h-screen w-screen overflow-hidden"
      onMouseMove={(e) => {
        // Convert screen coordinates to canvas coordinates so cursors
        // render correctly inside the Konva Stage for all viewers
        const canvasX = (e.clientX - panOffset.x) / zoom;
        const canvasY = (e.clientY - panOffset.y) / zoom;
        broadcastCursor(canvasX, canvasY);
      }}
    >
      <Canvas
        remoteCursors={remoteCursors}
        CursorOverlayComponent={CursorOverlayDynamic}
      />
      <Link
        href="/dashboard"
        className="absolute top-4 left-4 z-50 flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-md border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
        title="Back to dashboard"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </Link>
      <Toolbar />
      <PropertiesPanel />
      <PresenceIndicator users={onlineUsers} />
      <AIButton onClick={() => setAiPanelOpen(true)} isOpen={aiPanelOpen} />
      <AIChatPanel boardId={boardId} isOpen={aiPanelOpen} onClose={() => setAiPanelOpen(false)} />
      {/* Connection status banner */}
      {(connectionStatus === 'disconnected' || connectionStatus === 'reconnecting') && !loading && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 shadow-md">
          <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-sm text-amber-700">
            {connectionStatus === 'reconnecting'
              ? 'Reconnecting...'
              : 'Connection lost, reconnecting...'}
          </span>
        </div>
      )}
    </main>
  );
}
