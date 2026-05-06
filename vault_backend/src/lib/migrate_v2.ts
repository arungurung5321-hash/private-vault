import { pool } from "./db";
import dotenv from "dotenv";
dotenv.config();
const MIGRATION_V2 = `
ALTER TABLE vault_items DROP CONSTRAINT IF EXISTS vault_items_type_check;
ALTER TABLE vault_items ADD CONSTRAINT vault_items_type_check CHECK (type IN ('password','secret','note','card','identity','media'));
CREATE TABLE IF NOT EXISTS media_files (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, vault_item_id UUID NOT NULL REFERENCES vault_items(id) ON DELETE CASCADE, filename TEXT NOT NULL, original_name TEXT NOT NULL, mime_type TEXT NOT NULL, size_bytes BIGINT NOT NULL DEFAULT 0, storage_path TEXT NOT NULL, storage_bucket TEXT NOT NULL DEFAULT 'vault-media', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS share_codes (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, vault_item_id UUID NOT NULL REFERENCES vault_items(id) ON DELETE CASCADE, code TEXT UNIQUE NOT NULL, label TEXT, status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','used','revoked')), used_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS share_requests (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), share_code_id UUID NOT NULL REFERENCES share_codes(id) ON DELETE CASCADE, vault_item_id UUID NOT NULL REFERENCES vault_items(id) ON DELETE CASCADE, owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, accessor_email TEXT NOT NULL, accessor_name TEXT, ip_address TEXT, status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','denied')), requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), responded_at TIMESTAMPTZ);
CREATE INDEX IF NOT EXISTS idx_media_files_user ON media_files(user_id);
CREATE INDEX IF NOT EXISTS idx_share_codes_code ON share_codes(code);
CREATE INDEX IF NOT EXISTS idx_share_requests_owner ON share_requests(owner_id);
`;
async function migrate() {
  console.log("Running v2 migration...");
  const client = await pool.connect();
  try { await client.query(MIGRATION_V2); console.log("v2 migration complete."); }
  catch (err) { console.error("Migration failed:", err); process.exit(1); }
  finally { client.release(); await pool.end(); }
}
migrate();