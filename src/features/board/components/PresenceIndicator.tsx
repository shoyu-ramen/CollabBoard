'use client';

import { useFollowMode } from '../hooks/useFollowMode';
import { broadcastToLiveChannel } from '../hooks/useBoardRealtime';
import type { PresenceUser } from '../types';

interface PresenceIndicatorProps {
  users: PresenceUser[];
  currentUserId: string | null;
  currentUserName: string | null;
}

export function PresenceIndicator({
  users,
  currentUserId,
  currentUserName,
}: PresenceIndicatorProps) {
  const followingUserId = useFollowMode((s) => s.followingUserId);
  const spotlightUserId = useFollowMode((s) => s.spotlightUserId);
  const isSpotlighting = useFollowMode((s) => s.isSpotlighting);
  const startFollowing = useFollowMode((s) => s.startFollowing);
  const startSpotlight = useFollowMode((s) => s.startSpotlight);
  const stopSpotlight = useFollowMode((s) => s.stopSpotlight);

  const handleAvatarClick = (user: PresenceUser) => {
    if (user.userId === currentUserId) {
      // Toggle spotlight on self
      if (isSpotlighting) {
        stopSpotlight();
        broadcastToLiveChannel('spotlight', {
          action: 'stop',
          userId: currentUserId,
          userName: currentUserName,
        });
      } else {
        useFollowMode.setState({ isSpotlighting: true });
        startSpotlight(currentUserId!, currentUserName || 'Anonymous');
        broadcastToLiveChannel('spotlight', {
          action: 'start',
          userId: currentUserId,
          userName: currentUserName,
        });
      }
      return;
    }
    // Follow another user
    startFollowing(user.userId, user.userName);
  };

  const getAvatarRing = (userId: string) => {
    if (userId === followingUserId) {
      return 'ring-2 ring-[var(--system-green)] ring-offset-1';
    }
    if (userId === spotlightUserId) {
      return 'ring-2 ring-[var(--system-blue)] ring-offset-1';
    }
    return '';
  };

  const renderAvatar = (
    user: PresenceUser,
    sizeClass: string,
    extraClass?: string
  ) => {
    const isSelf = user.userId === currentUserId;
    const ring = getAvatarRing(user.userId);

    return (
      <button
        key={user.userId}
        onClick={() => handleAvatarClick(user)}
        className={`flex items-center justify-center rounded-full border-2 border-[var(--bg-primary)] font-medium text-white transition-transform hover:scale-110 ${sizeClass} ${ring} ${extraClass || ''}`}
        style={{ backgroundColor: user.color }}
        title={
          isSelf
            ? isSpotlighting
              ? 'Stop presenting'
              : 'Start presenting'
            : `Follow ${user.userName}`
        }
      >
        {isSpotlighting && isSelf ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="currentColor"
            stroke="none"
          >
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
          </svg>
        ) : (
          user.userName.charAt(0).toUpperCase()
        )}
      </button>
    );
  };

  return (
    <div className="flex items-center gap-1.5 hig-rounded-lg hig-material-regular px-2 py-1.5 border border-[var(--separator)] sm:gap-2 sm:px-3 sm:py-2">
      <div className="flex -space-x-2">
        {users.slice(0, 3).map((user) =>
          renderAvatar(user, 'h-6 w-6 text-[10px] sm:h-8 sm:w-8 sm:text-xs')
        )}
        {/* Show more avatars on desktop */}
        {users.slice(3, 5).map((user) =>
          renderAvatar(
            user,
            'h-8 w-8 text-xs',
            'hidden sm:flex'
          )
        )}
        {users.length > 5 && (
          <div className="hidden h-8 w-8 items-center justify-center rounded-full border-2 border-[var(--bg-primary)] bg-[var(--fill-secondary)] text-xs font-medium text-[var(--label-secondary)] sm:flex">
            +{users.length - 5}
          </div>
        )}
        {users.length > 3 && (
          <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--bg-primary)] bg-[var(--fill-secondary)] text-[10px] font-medium text-[var(--label-secondary)] sm:hidden">
            +{users.length - 3}
          </div>
        )}
      </div>
      <span className="hig-caption1 text-[var(--label-secondary)]">
        {users.length}
      </span>
    </div>
  );
}
