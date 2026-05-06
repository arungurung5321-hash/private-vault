import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { decryptItemFields } from "../lib/crypto";
import { query, withTransaction } from "../lib/db";
import { getSignedUrl } from "../lib/storage";
import { sendAccessRequestEmail, sendAccessApprovedEmail, sendAccessDeniedEmail } from "../lib/email";
import { AuthRequest, MediaFile } from "../types";
import { AppError } from "../middleware/errorHandler";
const APP_URL = process.env.CLIENT_URL || "http://localhost:5500";
const generateCode = (): string => crypto.randomBytes(6).toString("base64url").slice(0, 8).toUpperCase();
export const createShareCode = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { itemId } = req.params; const { label } = req.body;
    const { rows: items } = await query("SELECT id, title, type FROM vault_items WHERE id = $1 AND user_id = $2 AND is_deleted = FALSE", [itemId, req.user!.id]);
    if (!items.length) throw new AppError("Vault item not found", 404);
    let code = generateCode();
    for (let i = 0; i < 5; i++) { const ex = await query("SELECT id FROM share_codes WHERE code = $1", [code]); if (!ex.rows.length) break; code = generateCode(); }
    const { rows } = await query("INSERT INTO share_codes (user_id, vault_item_id, code, label) VALUES ($1,$2,$3,$4) RETURNING *", [req.user!.id, itemId, code, label || null]);
    res.status(201).json({ success: true, message: "Share code created", data: { share_code: rows[0], share_url: `${APP_URL}/pages/access.html?code=${code}` } });
  } catch (err) { next(err); }
};
export const listShareCodes = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { rows } = await query("SELECT sc.*, COUNT(sr.id) AS request_count FROM share_codes sc LEFT JOIN share_requests sr ON sr.share_code_id = sc.id WHERE sc.vault_item_id = $1 AND sc.user_id = $2 GROUP BY sc.id ORDER BY sc.created_at DESC", [req.params.itemId, req.user!.id]);
    res.json({ success: true, data: { share_codes: rows } });
  } catch (err) { next(err); }
};
export const revokeShareCode = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { rowCount } = await query("UPDATE share_codes SET status = 'revoked' WHERE id = $1 AND user_id = $2", [req.params.codeId, req.user!.id]);
    if (!rowCount) throw new AppError("Share code not found", 404);
    res.json({ success: true, message: "Share code revoked" });
  } catch (err) { next(err); }
};
export const listPendingRequests = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { rows } = await query("SELECT sr.*, vi.title AS item_title, vi.type AS item_type, sc.code FROM share_requests sr JOIN vault_items vi ON vi.id = sr.vault_item_id JOIN share_codes sc ON sc.id = sr.share_code_id WHERE sr.owner_id = $1 AND sr.status = 'pending' ORDER BY sr.requested_at DESC", [req.user!.id]);
    res.json({ success: true, data: { requests: rows } });
  } catch (err) { next(err); }
};
export const respondToRequest = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { requestId } = req.params; const { action } = req.body;
    const { rows } = await query("SELECT sr.*, vi.title AS item_title, vi.type AS item_type, sc.id AS code_id, u.email AS owner_email, u.name AS owner_name FROM share_requests sr JOIN vault_items vi ON vi.id = sr.vault_item_id JOIN share_codes sc ON sc.id = sr.share_code_id JOIN users u ON u.id = sr.owner_id WHERE sr.id = $1 AND sr.owner_id = $2 AND sr.status = 'pending'", [requestId, req.user!.id]);
    if (!rows.length) throw new AppError("Request not found", 404);
    const request = rows[0];
    if (action === "approve") {
      await withTransaction(async client => { await client.query("UPDATE share_requests SET status = 'approved', responded_at = NOW() WHERE id = $1", [requestId]); await client.query("UPDATE share_codes SET status = 'used', used_at = NOW() WHERE id = $1", [request.code_id]); });
      const accessToken = crypto.createHmac("sha256", process.env.JWT_SECRET!).update(`${requestId}:approved`).digest("hex");
      const accessUrl = `${APP_URL}/share/view?requestId=${requestId}&token=${accessToken}`;
      await sendAccessApprovedEmail({ accessorEmail: request.accessor_email, accessorName: request.accessor_name || "there", ownerName: request.owner_name || "the owner", itemTitle: request.item_title, itemType: request.item_type, accessUrl });
      res.json({ success: true, message: "Access approved." });
    } else {
      await query("UPDATE share_requests SET status = 'denied', responded_at = NOW() WHERE id = $1", [requestId]);
      await sendAccessDeniedEmail({ accessorEmail: request.accessor_email, ownerName: request.owner_name || "the owner", itemTitle: request.item_title });
      res.json({ success: true, message: "Access denied." });
    }
  } catch (err) { next(err); }
};
export const submitAccessRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { code, accessor_email, accessor_name } = req.body;
    const { rows: codes } = await query("SELECT sc.*, vi.title AS item_title, vi.type AS item_type, u.email AS owner_email, u.name AS owner_name, u.id AS owner_id FROM share_codes sc JOIN vault_items vi ON vi.id = sc.vault_item_id JOIN users u ON u.id = sc.user_id WHERE sc.code = $1", [code.toUpperCase().trim()]);
    if (!codes.length) throw new AppError("Invalid share code", 404);
    const shareCode = codes[0];
    if (shareCode.status !== "active") throw new AppError(shareCode.status === "used" ? "Code already used" : "Code revoked", 410);
    if (shareCode.owner_email === accessor_email) throw new AppError("Cannot request your own items", 400);
    const ipAddress = (req.headers["x-forwarded-for"] as string)?.split(",")[0] || req.socket.remoteAddress || null;
    const { rows: requestRows } = await query("INSERT INTO share_requests (share_code_id, vault_item_id, owner_id, accessor_email, accessor_name, ip_address) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *", [shareCode.id, shareCode.vault_item_id, shareCode.owner_id, accessor_email, accessor_name || null, ipAddress]);
    await sendAccessRequestEmail({ ownerEmail: shareCode.owner_email, ownerName: shareCode.owner_name || "Vault User", accessorEmail: accessor_email, accessorName: accessor_name || "Unknown", itemTitle: shareCode.item_title, itemType: shareCode.item_type, requestId: requestRows[0].id, ipAddress: ipAddress || "Unknown" });
    res.status(201).json({ success: true, message: `Request sent! You will be notified at ${accessor_email}.`, data: { request_id: requestRows[0].id } });
  } catch (err) { next(err); }
};
export const viewSharedItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { requestId, token } = req.query as { requestId: string; token: string };
    if (!requestId || !token) throw new AppError("requestId and token required", 400);
    const expected = crypto.createHmac("sha256", process.env.JWT_SECRET!).update(`${requestId}:approved`).digest("hex");
    if (token !== expected) throw new AppError("Invalid or expired token", 401);
    const { rows } = await query("SELECT sr.*, vi.title, vi.type, vi.notes, vi.username, vi.secret, vi.url, vi.content, vi.card_number, vi.cvv, vi.first_name, vi.last_name, vi.phone, vi.address, vi.expiry, vi.cardholder, u.name AS owner_name FROM share_requests sr JOIN vault_items vi ON vi.id = sr.vault_item_id JOIN users u ON u.id = sr.owner_id WHERE sr.id = $1 AND sr.status = 'approved'", [requestId]);
    if (!rows.length) throw new AppError("Access not approved or expired", 403);
    const item = rows[0];
    let files: any[] = [];
    if (item.type === "media") {
      const { rows: mediaRows } = await query<MediaFile>("SELECT * FROM media_files WHERE vault_item_id = $1 ORDER BY created_at ASC", [item.vault_item_id]);
      files = await Promise.all(mediaRows.map(async (f: any) => ({ ...f, signed_url: await getSignedUrl(f.storage_path, 3600) })));
    }
    const decrypted = decryptItemFields(item.type, item);
    res.json({ success: true, data: { shared_by: item.owner_name, item: { title: item.title, type: item.type, notes: decrypted.notes, url: decrypted.url, username: decrypted.username, content: decrypted.content, first_name: item.first_name, last_name: item.last_name, phone: item.phone, address: item.address, cardholder: item.cardholder, expiry: item.expiry, secret: decrypted.secret, card_number: decrypted.card_number, cvv: decrypted.cvv }, files } });
  } catch (err) { next(err); }
};