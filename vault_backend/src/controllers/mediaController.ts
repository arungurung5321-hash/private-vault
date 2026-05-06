import { Response, NextFunction } from "express";
import crypto from "crypto";
import { query, withTransaction } from "../lib/db";
import { uploadFile, getSignedUrl, deleteFile, STORAGE_BUCKET } from "../lib/storage";
import { AuthRequest, MediaFile } from "../types";
import { AppError } from "../middleware/errorHandler";
export const uploadFiles = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { itemId } = req.params;
    const { rows: items } = await query("SELECT id, type FROM vault_items WHERE id = $1 AND user_id = $2 AND is_deleted = FALSE", [itemId, req.user!.id]);
    if (!items.length) throw new AppError("Vault item not found", 404);
    if (items[0].type !== "media") throw new AppError("Files can only be attached to media items", 400);
    const files = (req as any).files as Express.Multer.File[];
    if (!files || !files.length) throw new AppError("No files uploaded", 400);
    const uploaded: MediaFile[] = [];
    for (const file of files) {
      const ext = file.originalname.split(".").pop() || "bin";
      const filename = `${crypto.randomUUID()}.${ext}`;
      const storagePath = `${req.user!.id}/${itemId}/${filename}`;
      await uploadFile(req.user!.id, storagePath, file.buffer, file.mimetype);
      const { rows } = await query<MediaFile>("INSERT INTO media_files (user_id, vault_item_id, filename, original_name, mime_type, size_bytes, storage_path, storage_bucket) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *", [req.user!.id, itemId, filename, file.originalname, file.mimetype, file.size, storagePath, STORAGE_BUCKET]);
      uploaded.push(rows[0]);
    }
    res.status(201).json({ success: true, message: `${uploaded.length} file(s) uploaded`, data: { files: uploaded } });
  } catch (err) { next(err); }
};
export const listFiles = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { itemId } = req.params;
    const { rows: items } = await query("SELECT id FROM vault_items WHERE id = $1 AND user_id = $2 AND is_deleted = FALSE", [itemId, req.user!.id]);
    if (!items.length) throw new AppError("Vault item not found", 404);
    const { rows: files } = await query<MediaFile>("SELECT * FROM media_files WHERE vault_item_id = $1 AND user_id = $2 ORDER BY created_at ASC", [itemId, req.user!.id]);
    const filesWithUrls = await Promise.all(files.map(async f => ({ ...f, signed_url: await getSignedUrl(f.storage_path, 3600) })));
    res.json({ success: true, data: { files: filesWithUrls } });
  } catch (err) { next(err); }
};
export const deleteMediaFile = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { itemId, fileId } = req.params;
    const { rows } = await query<MediaFile>("SELECT * FROM media_files WHERE id = $1 AND vault_item_id = $2 AND user_id = $3", [fileId, itemId, req.user!.id]);
    if (!rows.length) throw new AppError("File not found", 404);
    await withTransaction(async client => { await deleteFile(rows[0].storage_path); await client.query("DELETE FROM media_files WHERE id = $1", [fileId]); });
    res.json({ success: true, message: "File deleted" });
  } catch (err) { next(err); }
};
export const getFileUrl = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { itemId, fileId } = req.params;
    const { rows } = await query<MediaFile>("SELECT * FROM media_files WHERE id = $1 AND vault_item_id = $2 AND user_id = $3", [fileId, itemId, req.user!.id]);
    if (!rows.length) throw new AppError("File not found", 404);
    const signed_url = await getSignedUrl(rows[0].storage_path, 3600);
    res.json({ success: true, data: { file: rows[0], signed_url } });
  } catch (err) { next(err); }
};