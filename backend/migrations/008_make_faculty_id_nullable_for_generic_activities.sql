-- Migration 008: Allow faculty_id to be NULL for generic activities (Library, Placement, Mentoring)
-- Generic activities do not require a faculty member and use no-clash semantics.
ALTER TABLE subject ALTER COLUMN faculty_id DROP NOT NULL;
