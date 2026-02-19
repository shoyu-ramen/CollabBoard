'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { BoardMemberWithEmail } from '../types';

interface MemberManagementModalProps {
  boardId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function MemberManagementModal({
  boardId,
  isOpen,
  onClose,
}: MemberManagementModalProps) {
  const [members, setMembers] = useState<BoardMemberWithEmail[]>([]);
  const [loading, setLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const broadcastRef = useRef<ReturnType<
    ReturnType<typeof createClient>['channel']
  > | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel('dashboard-board-updates');
    channel.subscribe();
    broadcastRef.current = channel;
    return () => {
      channel.unsubscribe();
      broadcastRef.current = null;
    };
  }, []);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/boards/members?boardId=${boardId}`
      );
      const data = await res.json();
      if (res.ok) {
        setMembers(data.members);
      }
    } catch {
      // ignore
    }
    setLoading(false);
  }, [boardId]);

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch data when modal opens
      fetchMembers();
    }
  }, [isOpen, fetchMembers]);

  async function handleInviteByEmail() {
    if (!inviteEmail.trim()) return;
    setInviteLoading(true);
    setInviteError(null);
    setInviteSuccess(null);

    try {
      const res = await fetch('/api/boards/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardId, email: inviteEmail.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setInviteError(data.error);
      } else {
        setInviteSuccess(`Invited ${data.member.email} as editor`);
        setInviteEmail('');
        fetchMembers();
        // Notify other dashboards so the invited user sees the board
        broadcastRef.current?.send({
          type: 'broadcast',
          event: 'member-added',
          payload: { boardId },
        });
      }
    } catch {
      setInviteError('Failed to send invite');
    }
    setInviteLoading(false);
  }

  async function handleRemoveMember(userId: string) {
    try {
      const res = await fetch(
        `/api/boards/members?boardId=${boardId}&userId=${userId}`,
        { method: 'DELETE' }
      );
      if (res.ok) {
        setMembers((prev) =>
          prev.filter((m) => m.user_id !== userId)
        );
        // Notify the removed user's dashboard and board page
        broadcastRef.current?.send({
          type: 'broadcast',
          event: 'member-removed',
          payload: { boardId, userId },
        });
      }
    } catch {
      // ignore
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 sm:items-center">
      <div className="w-full max-w-md rounded-t-[14px] bg-[var(--bg-grouped-secondary)] shadow-2xl hig-sheet-enter border border-[var(--separator)] sm:hig-rounded-xl">
        <div className="hig-sheet-indicator sm:hidden" />
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--separator)] px-4 py-3 sm:px-6 sm:py-4">
          <h2 className="text-lg font-semibold text-[var(--label-primary)]">
            Manage Members
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-[var(--label-tertiary)] hover:bg-[var(--fill-quaternary)] hover:text-[var(--label-secondary)]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-4 py-3 space-y-4 sm:max-h-[70vh] sm:px-6 sm:py-4 sm:space-y-6">
          {/* Invite by email */}
          <div>
            <h3 className="mb-2 text-sm font-medium text-[var(--label-secondary)]">
              Invite by email
            </h3>
            <div className="flex gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="user@example.com"
                className="flex-1 bg-[var(--fill-tertiary)] hig-rounded-md min-h-[44px] px-3 py-2 text-sm text-[var(--label-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--system-blue)]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleInviteByEmail();
                }}
              />
              <button
                onClick={handleInviteByEmail}
                disabled={inviteLoading || !inviteEmail.trim()}
                className="bg-[var(--system-blue)] hig-rounded-md hig-pressable min-h-[44px] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {inviteLoading ? '...' : 'Invite'}
              </button>
            </div>
            {inviteError && (
              <p className="mt-1 text-xs text-[var(--system-red)]">{inviteError}</p>
            )}
            {inviteSuccess && (
              <p className="mt-1 text-xs text-[var(--system-green)]">
                {inviteSuccess}
              </p>
            )}
          </div>

          {/* Members list */}
          <div>
            <h3 className="mb-2 text-sm font-medium text-[var(--label-secondary)]">
              Members ({members.length})
            </h3>
            {loading ? (
              <div className="flex justify-center py-4">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--system-blue)] border-t-transparent" />
              </div>
            ) : (
              <ul className="space-y-2">
                {members.map((member) => (
                  <li
                    key={member.user_id}
                    className="flex items-center justify-between hig-rounded-md bg-[var(--fill-quaternary)] px-3 py-2"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--system-blue)]/10 text-sm font-medium text-[var(--system-blue)]">
                        {member.email.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm text-[var(--label-primary)]">
                          {member.email}
                        </p>
                        <span
                          className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${
                            member.role === 'owner'
                              ? 'bg-[var(--system-orange)]/10 text-[var(--system-orange)]'
                              : 'bg-[var(--fill-tertiary)] text-[var(--label-secondary)]'
                          }`}
                        >
                          {member.role}
                        </span>
                      </div>
                    </div>
                    {member.role !== 'owner' && (
                      <button
                        onClick={() => handleRemoveMember(member.user_id)}
                        className="shrink-0 rounded p-1 text-[var(--label-tertiary)] hover:bg-[var(--system-red)]/10 hover:text-[var(--system-red)]"
                        title="Remove member"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
