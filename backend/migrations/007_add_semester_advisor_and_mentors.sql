-- Migration 007: Add class_advisor and mentors to semester table
ALTER TABLE semester ADD COLUMN IF NOT EXISTS class_advisor VARCHAR(255);
ALTER TABLE semester ADD COLUMN IF NOT EXISTS mentors VARCHAR(255);
