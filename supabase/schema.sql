-- CollabBoard Database Schema
-- Run this in the Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Boards table
CREATE TABLE IF NOT EXISTS boards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL DEFAULT 'Untitled Board',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private'))
);

-- Board members table (multi-tenancy)
CREATE TABLE IF NOT EXISTS board_members (
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('owner', 'editor', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (board_id, user_id)
);

-- Whiteboard objects table
CREATE TABLE IF NOT EXISTS whiteboard_objects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  object_type TEXT NOT NULL CHECK (object_type IN ('sticky_note', 'rectangle', 'circle', 'line', 'text', 'frame', 'connector', 'arrow')),
  x DOUBLE PRECISION NOT NULL DEFAULT 0,
  y DOUBLE PRECISION NOT NULL DEFAULT 0,
  width DOUBLE PRECISION NOT NULL DEFAULT 100,
  height DOUBLE PRECISION NOT NULL DEFAULT 100,
  rotation DOUBLE PRECISION NOT NULL DEFAULT 0,
  properties JSONB NOT NULL DEFAULT '{}',
  updated_by UUID NOT NULL REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_whiteboard_objects_board_id ON whiteboard_objects(board_id);
CREATE INDEX IF NOT EXISTS idx_board_members_user_id ON board_members(user_id);
CREATE INDEX IF NOT EXISTS idx_boards_created_by ON boards(created_by);

-- Row Level Security Policies

-- Enable RLS
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE whiteboard_objects ENABLE ROW LEVEL SECURITY;

-- Helper function to check board membership without triggering RLS recursion
CREATE OR REPLACE FUNCTION public.is_board_member(p_board_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM board_members
    WHERE board_id = p_board_id AND user_id = p_user_id
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Boards: public boards visible to all, private boards only to owner/members
CREATE POLICY "Users can view public boards or their own boards"
  ON boards FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      visibility = 'public'
      OR created_by = auth.uid()
      OR public.is_board_member(id, auth.uid())
    )
  );

-- Boards: any authenticated user can create
CREATE POLICY "Authenticated users can create boards"
  ON boards FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Boards: only owner can delete
CREATE POLICY "Board owners can delete boards"
  ON boards FOR DELETE
  USING (created_by = auth.uid());

-- Boards: owner can update
CREATE POLICY "Board owners can update boards"
  ON boards FOR UPDATE
  USING (created_by = auth.uid());

-- Board members: visible only for accessible boards
CREATE POLICY "Users can view members of accessible boards"
  ON board_members FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM boards
      WHERE boards.id = board_members.board_id
        AND (
          boards.visibility = 'public'
          OR boards.created_by = auth.uid()
          OR public.is_board_member(boards.id, auth.uid())
        )
    )
  );

-- Board members: board owner can manage members
CREATE POLICY "Board owners can manage members"
  ON board_members FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM boards WHERE id = board_id AND created_by = auth.uid())
    OR user_id = auth.uid()
  );

CREATE POLICY "Board owners can remove members"
  ON board_members FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM boards WHERE id = board_id AND created_by = auth.uid())
  );

-- Whiteboard objects: visible only for accessible boards
CREATE POLICY "Users can view objects on accessible boards"
  ON whiteboard_objects FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM boards
      WHERE boards.id = whiteboard_objects.board_id
        AND (
          boards.visibility = 'public'
          OR boards.created_by = auth.uid()
          OR public.is_board_member(boards.id, auth.uid())
        )
    )
  );

-- Whiteboard objects: editors and owners can create
CREATE POLICY "Editors can create objects"
  ON whiteboard_objects FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM board_members
      WHERE board_id = whiteboard_objects.board_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'editor')
    )
  );

-- Whiteboard objects: editors and owners can update
CREATE POLICY "Editors can update objects"
  ON whiteboard_objects FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM board_members
      WHERE board_id = whiteboard_objects.board_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'editor')
    )
  );

-- Whiteboard objects: editors and owners can delete
CREATE POLICY "Editors can delete objects"
  ON whiteboard_objects FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM board_members
      WHERE board_id = whiteboard_objects.board_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'editor')
    )
  );

-- Enable Realtime for whiteboard_objects and boards
ALTER PUBLICATION supabase_realtime ADD TABLE whiteboard_objects;
ALTER PUBLICATION supabase_realtime ADD TABLE boards;

-- REPLICA IDENTITY FULL is required for Supabase Realtime to include the
-- old record in DELETE events (needed for real-time delete sync).
ALTER TABLE whiteboard_objects REPLICA IDENTITY FULL;

-- Function to auto-add board creator as owner
CREATE OR REPLACE FUNCTION add_board_creator_as_member()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO board_members (board_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: auto-add creator as member
DROP TRIGGER IF EXISTS on_board_created ON boards;
CREATE TRIGGER on_board_created
  AFTER INSERT ON boards
  FOR EACH ROW
  EXECUTE FUNCTION add_board_creator_as_member();
