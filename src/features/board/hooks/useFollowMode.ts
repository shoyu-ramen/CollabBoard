'use client';

import { create } from 'zustand';
import type { ViewportData } from '../types';

interface FollowModeState {
  // Follow mode
  followingUserId: string | null;
  followingUserName: string | null;

  // Spotlight mode
  spotlightUserId: string | null;
  spotlightUserName: string | null;
  isSpotlighting: boolean;
  spotlightOptedOut: boolean;

  // Remote viewports
  remoteViewports: Map<string, ViewportData>;

  // Actions
  startFollowing: (userId: string, userName: string) => void;
  stopFollowing: () => void;
  startSpotlight: (userId: string, userName: string) => void;
  stopSpotlight: () => void;
  optOutSpotlight: () => void;
  optInSpotlight: () => void;
  updateRemoteViewport: (userId: string, data: ViewportData) => void;
  removeRemoteViewport: (userId: string) => void;
}

export const useFollowMode = create<FollowModeState>((set) => ({
  followingUserId: null,
  followingUserName: null,
  spotlightUserId: null,
  spotlightUserName: null,
  isSpotlighting: false,
  spotlightOptedOut: false,
  remoteViewports: new Map(),

  startFollowing: (userId, userName) =>
    set({
      followingUserId: userId,
      followingUserName: userName,
    }),

  stopFollowing: () =>
    set({
      followingUserId: null,
      followingUserName: null,
    }),

  startSpotlight: (userId, userName) =>
    set({
      spotlightUserId: userId,
      spotlightUserName: userName,
      // Reset opt-out when a new presenter starts
      spotlightOptedOut: false,
    }),

  stopSpotlight: () =>
    set({
      spotlightUserId: null,
      spotlightUserName: null,
      isSpotlighting: false,
    }),

  optOutSpotlight: () => set({ spotlightOptedOut: true }),
  optInSpotlight: () => set({ spotlightOptedOut: false }),

  updateRemoteViewport: (userId, data) =>
    set((state) => {
      const next = new Map(state.remoteViewports);
      next.set(userId, data);
      return { remoteViewports: next };
    }),

  removeRemoteViewport: (userId) =>
    set((state) => {
      const next = new Map(state.remoteViewports);
      next.delete(userId);
      return { remoteViewports: next };
    }),
}));
