export type ObjectType =
  | 'sticky_note'
  | 'rectangle'
  | 'circle'
  | 'frame'
  | 'arrow'
  | 'line'
  | 'text';

export interface WhiteboardObject {
  id: string;
  board_id: string;
  object_type: ObjectType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  properties: ObjectProperties;
  updated_by: string;
  updated_at: string;
  created_at: string;
  version: number;
}

export interface ObjectProperties {
  text?: string;
  color?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  fontSize?: number;
  fontFamily?: string;
  fontStyle?: 'normal' | 'bold' | 'italic' | 'bold italic';
  textAlign?: 'left' | 'center' | 'right';
  // Sticky note specific
  noteColor?: string;
  // Arrow specific
  points?: number[];
  lineStyle?: 'solid' | 'dashed' | 'dotted' | 'arrow';
  // Arrow connection specific
  startObjectId?: string;
  endObjectId?: string;
  startAnchorSide?: string;
  endAnchorSide?: string;
  // Frame specific
  title?: string;
}

export interface Board {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  visibility: 'public' | 'private';
  creator_email?: string;
}

export interface BoardMemberWithEmail {
  user_id: string;
  role: 'owner' | 'editor' | 'viewer';
  email: string;
}

export interface BoardMember {
  board_id: string;
  user_id: string;
  role: 'owner' | 'editor' | 'viewer';
}

export interface CursorPosition {
  userId: string;
  userName: string;
  color: string;
  x: number;
  y: number;
}

export interface PresenceUser {
  userId: string;
  userName: string;
  color: string;
  onlineAt: string;
}

export interface HistoryEntry {
  id: string;
  label: string;
  timestamp: number;
  before: Map<string, WhiteboardObject | null>; // null = object was created (didn't exist before)
  after: Map<string, WhiteboardObject | null>; // null = object was deleted
}

// Tool for canvas operations
export type ToolType =
  | 'select'
  | 'sticky_note'
  | 'rectangle'
  | 'circle'
  | 'frame'
  | 'arrow'
  | 'line'
  | 'text'
  | 'pan';
