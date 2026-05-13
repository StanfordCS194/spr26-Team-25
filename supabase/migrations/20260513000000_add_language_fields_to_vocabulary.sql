-- Migration: add language and runic fields to vocabulary table
--
-- language  TEXT DEFAULT 'greek'  — distinguishes Greek vs Old Norse entries
--           reuses the existing "greek" column for the target-language word
--           so no column rename is required; language flag disambiguates rows
--
-- runic     TEXT                   — Elder Futhark transliteration of the word
--           NULL for Greek rows; populated by the backend for Old Norse rows
--
-- Run this once against your Supabase project:
--   supabase db push
-- or paste into the Supabase SQL editor.

ALTER TABLE vocabulary
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'greek',
  ADD COLUMN IF NOT EXISTS runic    TEXT;

-- Index on language for efficient per-language queries
CREATE INDEX IF NOT EXISTS idx_vocabulary_language ON vocabulary (language);

-- Backfill existing rows (all pre-migration rows are Ancient Greek)
UPDATE vocabulary SET language = 'greek' WHERE language IS NULL OR language = '';
