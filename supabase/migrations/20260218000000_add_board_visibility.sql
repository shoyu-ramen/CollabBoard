-- Add visibility column to boards (public by default for backward compatibility)
ALTER TABLE boards
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public'
  CHECK (visibility IN ('public', 'private'));

-- Update RLS policy: public boards visible to all authenticated users,
-- private boards visible only to members
DROP POLICY IF EXISTS "Authenticated users can view all boards" ON boards;
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

-- Update whiteboard_objects SELECT policy: only for visible boards
DROP POLICY IF EXISTS "Authenticated users can view objects" ON whiteboard_objects;
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

-- Update board_members SELECT policy: only for visible boards
DROP POLICY IF EXISTS "Authenticated users can view board members" ON board_members;
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
