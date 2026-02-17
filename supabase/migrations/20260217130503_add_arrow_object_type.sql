ALTER TABLE whiteboard_objects DROP CONSTRAINT whiteboard_objects_object_type_check;
ALTER TABLE whiteboard_objects ADD CONSTRAINT whiteboard_objects_object_type_check
  CHECK (object_type IN ('sticky_note', 'rectangle', 'circle', 'line', 'text', 'frame', 'connector', 'arrow'));
