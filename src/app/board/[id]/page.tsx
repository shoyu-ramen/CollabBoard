'use client';

import { use, useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Toolbar from '@/features/board/components/Toolbar';
import PropertiesPanel from '@/features/board/components/PropertiesPanel';
import { PresenceIndicator } from '@/features/board/components/PresenceIndicator';
import { MemberManagementModal } from '@/features/board/components/MemberManagementModal';
import { AIButton } from '@/features/ai-agent/components/AIButton';
import { AIChatPanel } from '@/features/ai-agent/components/AIChatPanel';
import { FloatingActionBar } from '@/features/board/components/FloatingActionBar';
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
  const { loading, error, reload, boardVisibility } = useBoardPersistence(boardId, userId);

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
    // Untrack on tab close since React cleanup doesn't reliably fire
    const handleBeforeUnload = () => untrackBoard();
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      untrackBoard();
    };
  }, [loading, boardId, userId, userName, trackBoard, untrackBoard]);

  // Kick user out if they're removed from the board
  const router = useRouter();
  const kickedRef = useRef(false);
  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel('dashboard-board-updates')
      .on(
        'broadcast',
        { event: 'member-removed' },
        ({ payload }) => {
          const { boardId: removedBoardId, userId: removedUserId } =
            payload as { boardId: string; userId: string };
          if (
            removedBoardId === boardId &&
            removedUserId === userId &&
            !kickedRef.current
          ) {
            kickedRef.current = true;
            router.push('/dashboard');
          }
        }
      )
      .subscribe();
    return () => {
      channel.unsubscribe();
    };
  }, [boardId, userId, router]);

  // AI panel state
  const [aiPanelOpen, setAiPanelOpen] = useState(false);

  // Members modal state
  const [membersOpen, setMembersOpen] = useState(false);
  const [isBoardOwner, setIsBoardOwner] = useState(false);

  // Check if current user is the board owner
  useEffect(() => {
    if (!userId || loading) return;
    fetch(`/api/boards/members?boardId=${boardId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.members) {
          const me = data.members.find(
            (m: { user_id: string }) => m.user_id === userId
          );
          setIsBoardOwner(me?.role === 'owner');
        }
      })
      .catch(() => {});
  }, [boardId, userId, loading]);

  // Toggle AI panel with Cmd/Ctrl + J
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault();
        setAiPanelOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Canvas state for cursor coordinate conversion
  const zoom = useCanvas((s) => s.zoom);
  const panOffset = useCanvas((s) => s.panOffset);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading board...</p>
        </div>
      </div>
    );
  }

  if (error) {
    const isAccessDenied = error.includes('Access denied') || error.includes('private');
    const isNotFound = error.includes('not found');
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="flex flex-col items-center gap-3 text-center">
          {isAccessDenied ? (
            <>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-600 dark:text-red-400">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <p className="text-lg font-medium text-red-600 dark:text-red-400">
                Access Denied
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                This board is private. Ask the owner to invite you.
              </p>
            </>
          ) : (
            <>
              <p className="text-lg font-medium text-red-600 dark:text-red-400">
                {isNotFound ? 'Board Not Found' : 'Failed to load board'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{error}</p>
            </>
          )}
          <div className="mt-2 flex gap-2">
            <Link
              href="/dashboard"
              className="rounded-lg bg-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Back to Dashboard
            </Link>
            {!isAccessDenied && (
              <button
                onClick={reload}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
              >
                Retry
              </button>
            )}
          </div>
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
      <FloatingActionBar />
      <Link
        href="/dashboard"
        className="absolute top-4 left-4 z-50 flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-md border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors dark:bg-gray-900 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
        title="Back to dashboard"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </Link>
      <Toolbar />
      <PropertiesPanel />
      <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
        {isBoardOwner && boardVisibility === 'private' && (
          <button
            onClick={() => setMembersOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-md border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors dark:bg-gray-900 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
            title="Manage members"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </button>
        )}
        <PresenceIndicator users={onlineUsers} />
      </div>
      {isBoardOwner && boardVisibility === 'private' && (
        <MemberManagementModal
          boardId={boardId}
          isOpen={membersOpen}
          onClose={() => setMembersOpen(false)}
        />
      )}
      <AIButton onClick={() => setAiPanelOpen(true)} isOpen={aiPanelOpen} />
      {aiPanelOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setAiPanelOpen(false)}
        />
      )}
      <AIChatPanel boardId={boardId} isOpen={aiPanelOpen} onClose={() => setAiPanelOpen(false)} />
      {/* Connection status banner */}
      {(connectionStatus === 'disconnected' || connectionStatus === 'reconnecting') && !loading && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 shadow-md dark:bg-amber-950 dark:border-amber-800">
          <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-sm text-amber-700 dark:text-amber-300">
            {connectionStatus === 'reconnecting'
              ? 'Reconnecting...'
              : 'Connection lost, reconnecting...'}
          </span>
        </div>
      )}
    </main>
  );
}
