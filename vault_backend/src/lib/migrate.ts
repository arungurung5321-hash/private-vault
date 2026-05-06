/**
 * Run with: npm run db:migrate
 * Creates all tables, indexes, and triggers in your PostgreSQL database.
 * Safe to re-run (uses IF NOT EXISTS / CREATE OR REPLACE).
 */
import { pool } from "./db";
import dotenv from "dotenv";

dotenv.config();

const MIGRATION = /* sql */ `
-- ── Extensions ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT        UNIQUE NOT NULL,
  password_hash TEXT        NOT NULL,
  name          TEXT,
  role          TEXT        NOT NULL DEFAULT 'user'
                            CHECK (role IN ('user', 'admin')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Vault Folders ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vault_folders (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  icon       TEXT,
  color      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Vault Items ───────────────────────────────────────────────────────────────
-- Supported types:
--   password  → username, secret (pw), url, notes
--   secret    → secret (API key / env var), notes
--   note      → content
--   card      → card_number, expiry, cvv, cardholder, notes
--   identity  → first_name, last_name, email, phone, address, notes
-- All "sensitive" columns are AES-256-GCM encrypted by the API before storage.
CREATE TABLE IF NOT EXISTS vault_items (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  folder_id   UUID        REFERENCES vault_folders(id) ON DELETE SET NULL,
  type        TEXT        NOT NULL
                          CHECK (type IN ('password','secret','note','card','identity')),
  title       TEXT        NOT NULL,
  is_favorite BOOLEAN     NOT NULL DEFAULT FALSE,
  is_deleted  BOOLEAN     NOT NULL DEFAULT FALSE,
  tags        TEXT[]      NOT NULL DEFAULT '{}',

  -- password / secret
  username    TEXT,   -- encrypted
  secret      TEXT,   -- encrypted  (password value, API key, etc.)
  url         TEXT,   -- encrypted

  -- note
  content     TEXT,   -- encrypted

  -- card
  card_number TEXT,   -- encrypted
  expiry      TEXT,
  cvv         TEXT,   -- encrypted
  cardholder  TEXT,

  -- identity
  first_name  TEXT,
  last_name   TEXT,
  phone       TEXT,
  address     TEXT,

  -- shared note (encrypted)
  notes       TEXT,   -- encrypted

  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Refresh Token Whitelist ───────────────────────────────────────────────────
-- Stores hashed refresh tokens so logout actually invalidates them.
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT        NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_vault_items_user_id  ON vault_items(user_id);
CREATE INDEX IF NOT EXISTS idx_vault_items_type     ON vault_items(type);
CREATE INDEX IF NOT EXISTS idx_vault_items_folder   ON vault_items(folder_id);
CREATE INDEX IF NOT EXISTS idx_vault_items_deleted  ON vault_items(is_deleted);
CREATE INDEX IF NOT EXISTS idx_vault_items_favorite ON vault_items(is_favorite);
CREATE INDEX IF NOT EXISTS idx_vault_folders_user   ON vault_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user  ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash  ON refresh_tokens(token_hash);

-- ── updated_at Trigger ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'users_updated_at') THEN
    CREATE TRIGGER users_updated_at
      BEFORE UPDATE ON users
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'folders_updated_at') THEN
    CREATE TRIGGER folders_updated_at
      BEFORE UPDATE ON vault_folders
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'items_updated_at') THEN
    CREATE TRIGGER items_updated_at
      BEFORE UPDATE ON vault_items
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
`;

async function migrate() {
  console.log("🗄️  Running database migration…");
  const client = await pool.connect();
  try {
    await client.query(MIGRATION);
    console.log("✅ Migration complete — all tables ready.");
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
