-- Base schema for Chronos
-- Paste this into Supabase: Dashboard → SQL Editor → New query → Run

-- Tracks every message in a conversation session
CREATE TABLE IF NOT EXISTS conversations (
  id          BIGSERIAL PRIMARY KEY,
  session_id  TEXT        NOT NULL,
  role        TEXT        NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT        NOT NULL,
  user_id     UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_session ON conversations (session_id);

-- Tracks vocabulary words introduced by the tutor in each session
CREATE TABLE IF NOT EXISTS vocabulary (
  id               BIGSERIAL PRIMARY KEY,
  session_id       TEXT        NOT NULL,
  greek            TEXT        NOT NULL,   -- the target-language word (reused for Old Norse too)
  transliteration  TEXT,
  meaning          TEXT,
  user_id          UUID,
  language         TEXT        NOT NULL DEFAULT 'greek',
  runic            TEXT,                   -- Elder Futhark form (Old Norse only)
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vocabulary_session  ON vocabulary (session_id);
CREATE INDEX IF NOT EXISTS idx_vocabulary_language ON vocabulary (language);
