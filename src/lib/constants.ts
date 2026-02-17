// Cursor sync
export const CURSOR_THROTTLE_MS = 50;
export const OBJECT_SYNC_THROTTLE_MS = 50;
export const CURSOR_COLORS = [
  '#EF4444', '#F59E0B', '#10B981', '#3B82F6',
  '#8B5CF6', '#EC4899', '#F97316', '#14B8A6',
  '#6366F1', '#D946EF',
];

// Canvas defaults
export const DEFAULT_ZOOM = 1;
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 5;
export const ZOOM_STEP = 0.1;

// Sticky note defaults
export const DEFAULT_STICKY_WIDTH = 200;
export const DEFAULT_STICKY_HEIGHT = 200;
export const DEFAULT_STICKY_COLORS = [
  '#FEF08A', // yellow
  '#BBF7D0', // green
  '#BFDBFE', // blue
  '#FBCFE8', // pink
  '#FED7AA', // orange
  '#E9D5FF', // purple
];

// Shape defaults
export const DEFAULT_SHAPE_WIDTH = 150;
export const DEFAULT_SHAPE_HEIGHT = 100;
export const DEFAULT_SHAPE_COLOR = '#3B82F6';
export const DEFAULT_STROKE_WIDTH = 2;

// Frame defaults
export const DEFAULT_FRAME_WIDTH = 400;
export const DEFAULT_FRAME_HEIGHT = 300;

// Performance
export const VIEWPORT_PADDING = 200; // pixels outside viewport to still render
export const MAX_OBJECTS = 5000;

// AI
export const AI_RATE_LIMIT_PER_MINUTE = 10;
export const AI_MODEL = 'claude-sonnet-4-5-20250929';

// Real-time
export const REALTIME_CHANNEL_PREFIX = 'board:';
export const PRESENCE_CHANNEL_PREFIX = 'presence:';
