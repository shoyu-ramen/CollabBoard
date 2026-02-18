'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { useBoardPresence } from '@/features/board/contexts/BoardPresenceProvider';
import type { Board } from '@/features/board/types';
import { generateBoardName } from '@/lib/generateBoardName';

export default function DashboardPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [tab, setTab] = useState<'my' | 'all'>('all');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [newBoardVisibility, setNewBoardVisibility] = useState<
    'public' | 'private'
  >('public');
  const [namePlaceholder, setNamePlaceholder] = useState('');

  const broadcastRef = useRef<ReturnType<
    ReturnType<typeof createClient>['channel']
  > | null>(null);

  const { presenceMap } = useBoardPresence();

  const fetchBoards = useCallback(async () => {
    try {
      const res = await fetch('/api/boards');
      if (res.ok) {
        const data = await res.json();
        setBoards(data.boards ?? []);
      }
    } catch (err) {
      console.error('Failed to fetch boards:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user) {
      fetchBoards();

      const supabase = createClient();

      // Subscribe to postgres_changes for row-level updates (covers
      // creates, deletes, and updates the current user can still see)
      const pgChannelName = `dashboard-boards-${Date.now()}`;
      const pgChannel = supabase
        .channel(pgChannelName)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'boards' },
          () => {
            fetchBoards();
          }
        )
        .subscribe();

      // Targeted broadcast for visibility changes. When a board goes
      // private, RLS hides the postgres_changes event from users who
      // lose access. This channel carries just the board ID so affected
      // clients can re-fetch. Clients that don't have the board in
      // their list ignore the event entirely (no work done).
      const broadcastChannel = supabase
        .channel('dashboard-board-updates')
        .on(
          'broadcast',
          { event: 'visibility-changed' },
          ({ payload }) => {
            const { boardId } = payload as { boardId: string };
            setBoards((prev) => {
              const hasBoard = prev.some((b) => b.id === boardId);
              if (hasBoard) {
                // We have this board locally — re-fetch to get the
                // correct filtered list (handles membership properly)
                fetchBoards();
              }
              return prev;
            });
          }
        )
        .on(
          'broadcast',
          { event: 'member-added' },
          () => {
            // A member was added to some board — re-fetch to pick up
            // any boards the current user now has access to
            fetchBoards();
          }
        )
        .on(
          'broadcast',
          { event: 'member-removed' },
          () => {
            // A member was removed — re-fetch to drop boards the
            // current user no longer has access to
            fetchBoards();
          }
        )
        .subscribe();
      broadcastRef.current = broadcastChannel;

      return () => {
        pgChannel.unsubscribe();
        broadcastChannel.unsubscribe();
        broadcastRef.current = null;
      };
    }
  }, [authLoading, user, fetchBoards]);

  const openCreateDialog = () => {
    setNewBoardName('');
    setNewBoardVisibility('public');
    setNamePlaceholder(generateBoardName());
    setShowCreateDialog(true);
  };

  const handleCreateBoard = async () => {
    setCreating(true);
    try {
      const name = newBoardName.trim() || namePlaceholder;
      const res = await fetch('/api/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          visibility: newBoardVisibility,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setShowCreateDialog(false);
        router.push(`/board/${data.id}`);
      }
    } catch (err) {
      console.error('Failed to create board:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleRenameBoard = async (boardId: string) => {
    const trimmed = editName.trim();
    if (!trimmed) {
      setEditingId(null);
      return;
    }

    try {
      const res = await fetch('/api/boards', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: boardId, name: trimmed }),
      });
      if (res.ok) {
        setBoards((prev) =>
          prev.map((b) =>
            b.id === boardId ? { ...b, name: trimmed } : b
          )
        );
      }
    } catch (err) {
      console.error('Failed to rename board:', err);
    } finally {
      setEditingId(null);
    }
  };

  const handleToggleVisibility = async (
    e: React.MouseEvent,
    board: Board
  ) => {
    e.stopPropagation();
    const newVisibility =
      board.visibility === 'public' ? 'private' : 'public';
    try {
      const res = await fetch('/api/boards', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: board.id,
          visibility: newVisibility,
        }),
      });
      if (res.ok) {
        setBoards((prev) =>
          prev.map((b) =>
            b.id === board.id
              ? { ...b, visibility: newVisibility }
              : b
          )
        );
        // Notify other dashboards about the visibility change so
        // clients that have this board in their list can re-fetch
        broadcastRef.current?.send({
          type: 'broadcast',
          event: 'visibility-changed',
          payload: { boardId: board.id },
        });
      }
    } catch (err) {
      console.error('Failed to toggle visibility:', err);
    }
  };

  const handleDeleteBoard = async (
    e: React.MouseEvent,
    boardId: string
  ) => {
    e.stopPropagation();

    const otherUsers = (presenceMap[boardId] ?? []).filter(
      (u) => u.userId !== user?.id
    );
    if (otherUsers.length > 0) {
      const names = otherUsers.map((u) => u.userName).join(', ');
      setDeleteError(
        `Can't delete — ${otherUsers.length === 1 ? `${names} is` : `${names} are`} currently on this board`
      );
      setTimeout(() => setDeleteError(null), 4000);
      return;
    }

    try {
      const res = await fetch(`/api/boards?id=${boardId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setBoards((prev) => prev.filter((b) => b.id !== boardId));
      }
    } catch (err) {
      console.error('Failed to delete board:', err);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  if (authLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {deleteError && (
        <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-lg">
          {deleteError}
        </div>
      )}

      {/* Create Board Dialog */}
      {showCreateDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowCreateDialog(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              New Board
            </h2>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Name
            </label>
            <input
              autoFocus
              value={newBoardName}
              onChange={(e) => setNewBoardName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !creating) handleCreateBoard();
                if (e.key === 'Escape') setShowCreateDialog(false);
              }}
              placeholder={namePlaceholder}
              className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
            />
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Visibility
            </label>
            <div className="mb-6 flex gap-2">
              <button
                type="button"
                onClick={() => setNewBoardVisibility('public')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  newBoardVisibility === 'public'
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950 dark:text-blue-300'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20" />
                  <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                </svg>
                Public
              </button>
              <button
                type="button"
                onClick={() => setNewBoardVisibility('private')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  newBoardVisibility === 'private'
                    ? 'border-yellow-500 bg-yellow-50 text-yellow-700 dark:border-yellow-400 dark:bg-yellow-950 dark:text-yellow-300'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
                Private
              </button>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCreateDialog(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBoard}
                disabled={creating}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Board'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">CollabBoard</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {user?.email}
            </span>
            <button
              onClick={handleSignOut}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
            <button
              onClick={() => setTab('all')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === 'all'
                  ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              All Boards
            </button>
            <button
              onClick={() => setTab('my')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === 'my'
                  ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              My Boards
            </button>
          </div>
          <button
            onClick={openCreateDialog}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + New Board
          </button>
        </div>

        {(() => {
          const filteredBoards =
            tab === 'my'
              ? boards.filter((b) => b.created_by === user?.id)
              : boards;
          const emptyLabel =
            tab === 'my' ? 'You haven\u2019t created any boards yet' : 'No boards yet';

          return filteredBoards.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 py-16 dark:border-gray-700">
            <div className="mb-4 text-4xl">&#128466;</div>
            <p className="mb-2 text-lg font-medium text-gray-700 dark:text-gray-300">
              {emptyLabel}
            </p>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
              Create your first collaborative whiteboard
            </p>
            <button
              onClick={openCreateDialog}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Create Board
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredBoards.map((board) => (
              <div
                key={board.id}
                onClick={() => router.push(`/board/${board.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') router.push(`/board/${board.id}`);
                }}
                className="group relative flex cursor-pointer flex-col items-start rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm transition-all hover:border-blue-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-900 dark:hover:border-blue-600"
              >
                {board.created_by === user?.id && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={(e) =>
                        handleToggleVisibility(e, board)
                      }
                      className={`flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors ${
                        board.visibility === 'private'
                          ? 'hover:bg-yellow-50 hover:text-yellow-600 dark:hover:bg-yellow-950'
                          : 'hover:bg-blue-50 hover:text-blue-500 dark:hover:bg-blue-950'
                      }`}
                      title={
                        board.visibility === 'private'
                          ? 'Make public'
                          : 'Make private'
                      }
                    >
                      {board.visibility === 'private' ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0110 0v4" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 019.9-1" />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={(e) => handleDeleteBoard(e, board.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950"
                      title="Delete board"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18" />
                        <path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                        <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                      </svg>
                    </button>
                  </div>
                )}
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-lg dark:bg-blue-950">
                    &#128466;
                  </div>
                  {board.visibility === 'private' && (
                    <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-semibold text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
                      Private
                    </span>
                  )}
                </div>
                {editingId === board.id ? (
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={() => handleRenameBoard(board.id)}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Enter') handleRenameBoard(board.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="mb-1 w-full rounded border border-blue-300 px-1 py-0.5 text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-blue-400 dark:border-blue-600 dark:bg-gray-800 dark:text-white"
                  />
                ) : board.created_by === user?.id ? (
                  <h3
                    className="mb-1 text-sm font-semibold text-gray-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-400"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingId(board.id);
                      setEditName(board.name);
                    }}
                    title="Click to rename"
                  >
                    {board.name}
                  </h3>
                ) : (
                  <h3 className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">
                    {board.name}
                  </h3>
                )}
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {board.creator_email ?? 'Unknown'}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {new Date(board.created_at).toLocaleDateString(
                    undefined,
                    {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    }
                  )}
                </p>
                {presenceMap[board.id]?.length > 0 && (
                  <div className="mt-3 flex items-center gap-1">
                    {presenceMap[board.id]
                      .slice(0, 5)
                      .map((u) => (
                        <div
                          key={u.userId}
                          title={u.userName}
                          className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
                          style={{ backgroundColor: u.color }}
                        >
                          {u.userName
                            .split(' ')
                            .map((w) => w[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                      ))}
                    {presenceMap[board.id].length > 5 && (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-300 text-[10px] font-bold text-gray-600 dark:bg-gray-600 dark:text-gray-300">
                        +{presenceMap[board.id].length - 5}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        );
        })()}
      </div>
    </div>
  );
}
