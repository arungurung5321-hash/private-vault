import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
export const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } });
export const STORAGE_BUCKET = "vault-media";
export const uploadFile = async (_userId: string, storagePath: string, buffer: Buffer, mimeType: string): Promise<string> => {
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(storagePath, buffer, { contentType: mimeType, upsert: false });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return storagePath;
};
export const getSignedUrl = async (storagePath: string, expiresInSeconds = 3600): Promise<string> => {
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(storagePath, expiresInSeconds);
  if (error || !data?.signedUrl) throw new Error(`Signed URL failed: ${error?.message}`);
  return data.signedUrl;
};
export const deleteFile = async (storagePath: string): Promise<void> => {
  const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
  if (error) throw new Error(`Delete failed: ${error.message}`);
};