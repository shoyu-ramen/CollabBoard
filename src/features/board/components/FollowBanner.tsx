'use client';

import { useFollowMode } from '../hooks/useFollowMode';
import { broadcastToLiveChannel } from '../hooks/useBoardRealtime';

interface FollowBannerProps {
  currentUserId: string | null;
  currentUserName: string | null;
}

export function FollowBanner({
  currentUserId,
  currentUserName,
}: FollowBannerProps) {
  const followingUserName = useFollowMode((s) => s.followingUserName);
  const spotlightUserName = useFollowMode((s) => s.spotlightUserName);
  const isSpotlighting = useFollowMode((s) => s.isSpotlighting);
  const stopFollowing = useFollowMode((s) => s.stopFollowing);
  const stopSpotlight = useFollowMode((s) => s.stopSpotlight);
  const optOutSpotlight = useFollowMode((s) => s.optOutSpotlight);
  const spotlightUserId = useFollowMode((s) => s.spotlightUserId);
  const followingUserId = useFollowMode((s) => s.followingUserId);

  // Presenter view: "You are presenting"
  if (isSpotlighting) {
    return (
      <div className="absolute left-1/2 top-20 z-50 -translate-x-1/2 flex items-center gap-2 hig-material-regular hig-rounded-md border border-[var(--system-blue)] px-3 py-1.5 shadow-md sm:px-4 sm:py-2">
        <div className="h-2 w-2 shrink-0 rounded-full bg-[var(--system-blue)] animate-pulse" />
        <span className="text-xs text-[var(--system-blue)] font-medium sm:text-sm">
          You are presenting
        </span>
        <button
          onClick={() => {
            stopSpotlight();
            broadcastToLiveChannel('spotlight', {
              action: 'stop',
              userId: currentUserId,
              userName: currentUserName,
            });
          }}
          className="ml-1 text-xs text-[var(--system-blue)] underline hover:opacity-70 sm:text-sm"
        >
          Stop
        </button>
      </div>
    );
  }

  // Following a spotlight presenter
  if (spotlightUserId && followingUserId === spotlightUserId) {
    return (
      <div className="absolute left-1/2 top-20 z-50 -translate-x-1/2 flex items-center gap-2 hig-material-regular hig-rounded-md border border-[var(--system-blue)] px-3 py-1.5 shadow-md sm:px-4 sm:py-2">
        <div className="h-2 w-2 shrink-0 rounded-full bg-[var(--system-blue)] animate-pulse" />
        <span className="text-xs text-[var(--system-blue)] sm:text-sm">
          {spotlightUserName} is presenting
        </span>
        <button
          onClick={() => {
            stopFollowing();
            optOutSpotlight();
          }}
          className="ml-1 text-xs text-[var(--system-blue)] underline hover:opacity-70 sm:text-sm"
        >
          Stop following
        </button>
      </div>
    );
  }

  // Following a specific user (not spotlight)
  if (followingUserId && followingUserName) {
    return (
      <div className="absolute left-1/2 top-20 z-50 -translate-x-1/2 flex items-center gap-2 hig-material-regular hig-rounded-md border border-[var(--separator)] px-3 py-1.5 shadow-md sm:px-4 sm:py-2">
        <div className="h-2 w-2 shrink-0 rounded-full bg-[var(--system-green)] animate-pulse" />
        <span className="text-xs text-[var(--label-primary)] sm:text-sm">
          Following {followingUserName}
        </span>
        <button
          onClick={() => stopFollowing()}
          className="ml-1 text-xs text-[var(--system-blue)] underline hover:opacity-70 sm:text-sm"
        >
          Stop
        </button>
      </div>
    );
  }

  return null;
}
