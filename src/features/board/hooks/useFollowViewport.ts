'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useCanvas } from './useCanvas';
import { useFollowMode } from './useFollowMode';
import { broadcastToLiveChannel } from './useBoardRealtime';
import {
  VIEWPORT_BROADCAST_THROTTLE_MS,
  VIEWPORT_LERP_SPEED,
  PAN_SNAP_THRESHOLD,
  ZOOM_SNAP_THRESHOLD,
} from '@/lib/constants';

/**
 * Manages viewport broadcasting and follow-mode animation.
 *
 * - Broadcasts local viewport changes to remote users (throttled).
 * - When following another user, runs a RAF loop that lerps toward
 *   the followed user's viewport.
 * - Exposes `breakFollow()` for Canvas to call on user interaction.
 */
export function useFollowViewport(userId: string | null) {
  const rafRef = useRef<number>(0);
  const lastBroadcastRef = useRef<number>(0);
  // Suppress outbound broadcasts while the follow animation is driving
  // the viewport (prevents circular follow A→B→A).
  const isFollowDrivenRef = useRef(false);

  // Subscribe to followingUserId so we can use it as a proper dependency
  const followingUserId = useFollowMode((s) => s.followingUserId);

  // ── Outbound viewport broadcast ──────────────────────────────
  useEffect(() => {
    if (!userId) return;

    const unsub = useCanvas.subscribe((state, prev) => {
      if (
        state.zoom === prev.zoom &&
        state.panOffset.x === prev.panOffset.x &&
        state.panOffset.y === prev.panOffset.y
      ) {
        return;
      }

      // Don't broadcast if the viewport change was driven by follow animation
      if (isFollowDrivenRef.current) return;

      const now = Date.now();
      if (now - lastBroadcastRef.current < VIEWPORT_BROADCAST_THROTTLE_MS) {
        return;
      }
      lastBroadcastRef.current = now;

      broadcastToLiveChannel('viewport', {
        userId,
        zoom: state.zoom,
        panOffsetX: state.panOffset.x,
        panOffsetY: state.panOffset.y,
        timestamp: now,
      });
    });

    return unsub;
  }, [userId]);

  // ── Follow animation RAF loop ────────────────────────────────
  useEffect(() => {
    if (!followingUserId) {
      // Cleanup any lingering RAF
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      return;
    }

    let active = true;

    const tick = () => {
      if (!active) return;

      const { followingUserId: currentTarget, remoteViewports } =
        useFollowMode.getState();
      if (!currentTarget) {
        isFollowDrivenRef.current = false;
        return;
      }

      const target = remoteViewports.get(currentTarget);
      if (!target) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const { zoom, panOffset, setZoom, setPanOffset } =
        useCanvas.getState();

      const dx = target.panOffsetX - panOffset.x;
      const dy = target.panOffsetY - panOffset.y;
      const dz = target.zoom - zoom;

      const panClose =
        Math.abs(dx) < PAN_SNAP_THRESHOLD &&
        Math.abs(dy) < PAN_SNAP_THRESHOLD;
      const zoomClose = Math.abs(dz) < ZOOM_SNAP_THRESHOLD;

      isFollowDrivenRef.current = true;

      if (panClose && zoomClose) {
        // Already at target — just keep looping
        isFollowDrivenRef.current = false;
      } else if (panClose && !zoomClose) {
        setZoom(target.zoom);
      } else if (zoomClose && !panClose) {
        setPanOffset({
          x: panOffset.x + dx * VIEWPORT_LERP_SPEED,
          y: panOffset.y + dy * VIEWPORT_LERP_SPEED,
        });
      } else {
        // Lerp both
        setZoom(zoom + dz * VIEWPORT_LERP_SPEED);
        setPanOffset({
          x: panOffset.x + dx * VIEWPORT_LERP_SPEED,
          y: panOffset.y + dy * VIEWPORT_LERP_SPEED,
        });
      }

      // Reset flag after a microtask so the subscribe callback runs with
      // isFollowDriven = true during the synchronous state update.
      queueMicrotask(() => {
        isFollowDrivenRef.current = false;
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      active = false;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      isFollowDrivenRef.current = false;
    };
  }, [followingUserId]);

  // ── Tab visibility: pause/snap ───────────────────────────────
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        // Pause — RAF naturally stops when tab is hidden in most browsers
        return;
      }
      // Resume: snap to target immediately instead of lerping from stale pos
      const { followingUserId: target, remoteViewports } =
        useFollowMode.getState();
      if (!target) return;
      const viewport = remoteViewports.get(target);
      if (!viewport) return;

      isFollowDrivenRef.current = true;
      useCanvas.getState().setZoom(viewport.zoom);
      useCanvas.getState().setPanOffset({
        x: viewport.panOffsetX,
        y: viewport.panOffsetY,
      });
      queueMicrotask(() => {
        isFollowDrivenRef.current = false;
      });
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // ── Break follow ─────────────────────────────────────────────
  const breakFollow = useCallback(() => {
    const state = useFollowMode.getState();
    if (state.followingUserId) {
      state.stopFollowing();
      // If following because of spotlight, mark as opted out
      if (state.spotlightUserId) {
        state.optOutSpotlight();
      }
    }
  }, []);

  return { breakFollow };
}
