import type { WhiteboardObject } from '../types';

/**
 * Last-Write-Wins merge: compare updated_at timestamps.
 * Returns the object that should be kept.
 */
export function mergeRemoteChange(
  local: WhiteboardObject,
  remote: WhiteboardObject
): WhiteboardObject {
  if (shouldApplyRemoteChange(
    local.version,
    remote.version,
    local.updated_at,
    remote.updated_at
  )) {
    return remote;
  }
  return local;
}

/**
 * Determine whether a remote change should overwrite local state.
 * Uses updated_at as primary comparator (LWW), version as tiebreaker.
 */
export function shouldApplyRemoteChange(
  localVersion: number,
  remoteVersion: number,
  localUpdatedAt: string,
  remoteUpdatedAt: string
): boolean {
  const localTime = new Date(localUpdatedAt).getTime();
  const remoteTime = new Date(remoteUpdatedAt).getTime();

  if (remoteTime > localTime) return true;
  if (remoteTime < localTime) return false;

  // Same timestamp — higher version wins
  return remoteVersion > localVersion;
}
