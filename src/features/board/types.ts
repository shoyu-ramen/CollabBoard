export type ObjectType =
  | 'sticky_note'
  | 'rectangle'
  | 'circle'
  | 'line'
  | 'text'
  | 'frame'
  | 'connector';

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
  // Sticky note specific
  noteColor?: string;
  // Line/connector specific
  points?: number[];
  fromId?: string;
  toId?: string;
  lineStyle?: 'solid' | 'dashed' | 'arrow';
  // Frame specific
  title?: string;
}

export interface Board {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
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

// Tool for canvas operations
export type ToolType =
  | 'select'
  | 'sticky_note'
  | 'rectangle'
  | 'circle'
  | 'line'
  | 'text'
  | 'frame'
  | 'connector'
  | 'pan';
