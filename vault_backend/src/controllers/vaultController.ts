import { Response, NextFunction } from "express";
import { query, withTransaction } from "../lib/db";
import { encryptItemFields, decryptItemFields } from "../lib/crypto";
import { AuthRequest, VaultItem, VaultFolder, VaultItemType } from "../types";
import { AppError } from "../middleware/errorHandler";

const VALID_TYPES: VaultItemType[] = ["password", "secret", "note", "card", "identity", "media"];

// Columns selected for list view (no sensitive data)
const LIST_COLS = `
  id, type, title, folder_id, is_favorite, is_deleted, tags,
  cardholder, first_name, last_name, url,
  created_at, updated_at
`;

// All columns for detail view (encrypted, decrypted in controller)
const DETAIL_COLS = `
  id, user_id, type, title, folder_id, is_favorite, is_deleted, tags,
  username, secret, url,
  content,
  card_number, expiry, cvv, cardholder,
  first_name, last_name, phone, address,
  notes,
  deleted_at, created_at, updated_at
`;

// ─── GET /api/vault/items ─────────────────────────────────────────────────────
export const listItems = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      type,
      search,
      folder_id,
      favorite,
      page = "1",
      limit = "20",
    } = req.query as Record<string, string>;

    const conditions: string[] = ["user_id = $1", "is_deleted = FALSE"];
    const values: unknown[] = [req.user!.id];

    if (type) {
      if (!VALID_TYPES.includes(type as VaultItemType))
        throw new AppError(`Invalid type. Must be: ${VALID_TYPES.join(", ")}`, 400);
      values.push(type);
      conditions.push(`type = $${values.length}`);
    }
    if (folder_id) {
      values.push(folder_id);
      conditions.push(`folder_id = $${values.length}`);
    }
    if (favorite === "true") {
      conditions.push("is_favorite = TRUE");
    }
    if (search) {
      values.push(`%${search}%`);
      conditions.push(`title ILIKE $${values.length}`);
    }

    const where = conditions.join(" AND ");
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const [itemsResult, countResult] = await Promise.all([
      query<VaultItem>(
        `SELECT ${LIST_COLS} FROM vault_items WHERE ${where}
         ORDER BY is_favorite DESC, updated_at DESC
         LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, limitNum, offset]
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) FROM vault_items WHERE ${where}`,
        values
      ),
    ]);

    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: {
        items: itemsResult.rows,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/vault/items/:id ─────────────────────────────────────────────────
export const getItem = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { rows } = await query<VaultItem>(
      `SELECT ${DETAIL_COLS} FROM vault_items
       WHERE id = $1 AND user_id = $2 AND is_deleted = FALSE`,
      [req.params.id, req.user!.id]
    );
    if (!rows.length) throw new AppError("Item not found", 404);

    const item = decryptItemFields(rows[0].type, rows[0] as Record<string, unknown>);
    res.json({ success: true, data: { item } });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/vault/items ────────────────────────────────────────────────────
export const createItem = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      type,
      title,
      folder_id,
      tags,
      is_favorite,
      // password / secret
      username,
      secret,
      url,
      // note
      content,
      // card
      card_number,
      expiry,
      cvv,
      cardholder,
      // identity
      first_name,
      last_name,
      phone,
      address,
      // shared
      notes,
    } = req.body;

    if (!VALID_TYPES.includes(type))
      throw new AppError(`Invalid type. Must be: ${VALID_TYPES.join(", ")}`, 400);

    const raw: Record<string, unknown> = {
      username, secret, url, content,
      card_number, expiry, cvv, cardholder,
      first_name, last_name, phone, address,
      notes,
    };

    const encrypted = encryptItemFields(type, raw);

    const { rows } = await query<VaultItem>(
      `INSERT INTO vault_items
        (user_id, folder_id, type, title, tags, is_favorite,
         username, secret, url,
         content,
         card_number, expiry, cvv, cardholder,
         first_name, last_name, phone, address,
         notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       RETURNING id, type, title, folder_id, is_favorite, tags, created_at`,
      [
        req.user!.id,
        folder_id ?? null,
        type,
        title,
        tags ?? [],
        is_favorite ?? false,
        encrypted.username ?? null,
        encrypted.secret ?? null,
        encrypted.url ?? null,
        encrypted.content ?? null,
        encrypted.card_number ?? null,
        expiry ?? null,
        encrypted.cvv ?? null,
        cardholder ?? null,
        first_name ?? null,
        last_name ?? null,
        phone ?? null,
        address ?? null,
        encrypted.notes ?? null,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Vault item created",
      data: { item: rows[0] },
    });
  } catch (err) {
    next(err);
  }
};

// ─── PUT /api/vault/items/:id ─────────────────────────────────────────────────
export const updateItem = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { rows: existing } = await query<VaultItem>(
      "SELECT type FROM vault_items WHERE id = $1 AND user_id = $2 AND is_deleted = FALSE",
      [req.params.id, req.user!.id]
    );
    if (!existing.length) throw new AppError("Item not found", 404);

    const type = existing[0].type;
    const {
      title, folder_id, tags, is_favorite,
      username, secret, url, content,
      card_number, expiry, cvv, cardholder,
      first_name, last_name, phone, address,
      notes,
    } = req.body;

    const sensitiveRaw: Record<string, unknown> = {
      username, secret, url, content, card_number, cvv, notes,
    };
    const encrypted = encryptItemFields(type, sensitiveRaw);

    const setClauses: string[] = [];
    const values: unknown[] = [];

    const set = (col: string, val: unknown) => {
      if (val !== undefined) {
        values.push(val);
        setClauses.push(`${col} = $${values.length}`);
      }
    };

    set("title", title);
    set("folder_id", folder_id);
    set("tags", tags);
    set("is_favorite", is_favorite);
    set("username", encrypted.username);
    set("secret", encrypted.secret);
    set("url", encrypted.url);
    set("content", encrypted.content);
    set("card_number", encrypted.card_number);
    set("expiry", expiry);
    set("cvv", encrypted.cvv);
    set("cardholder", cardholder);
    set("first_name", first_name);
    set("last_name", last_name);
    set("phone", phone);
    set("address", address);
    set("notes", encrypted.notes);

    if (!setClauses.length) throw new AppError("Nothing to update", 400);

    values.push(req.params.id, req.user!.id);
    const { rows } = await query<VaultItem>(
      `UPDATE vault_items
       SET ${setClauses.join(", ")}
       WHERE id = $${values.length - 1} AND user_id = $${values.length}
       RETURNING id, type, title, updated_at`,
      values
    );

    res.json({ success: true, message: "Item updated", data: { item: rows[0] } });
  } catch (err) {
    next(err);
  }
};

// ─── DELETE /api/vault/items/:id  (soft delete → trash) ──────────────────────
export const deleteItem = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { rowCount } = await query(
      `UPDATE vault_items SET is_deleted = TRUE, deleted_at = NOW()
       WHERE id = $1 AND user_id = $2 AND is_deleted = FALSE`,
      [req.params.id, req.user!.id]
    );
    if (!rowCount) throw new AppError("Item not found", 404);
    res.json({ success: true, message: "Item moved to trash" });
  } catch (err) {
    next(err);
  }
};

// ─── DELETE /api/vault/items/:id/permanent  (hard delete) ────────────────────
export const hardDeleteItem = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { rowCount } = await query(
      "DELETE FROM vault_items WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user!.id]
    );
    if (!rowCount) throw new AppError("Item not found", 404);
    res.json({ success: true, message: "Item permanently deleted" });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/vault/trash ─────────────────────────────────────────────────────
export const listTrash = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { rows } = await query<VaultItem>(
      `SELECT id, type, title, deleted_at FROM vault_items
       WHERE user_id = $1 AND is_deleted = TRUE
       ORDER BY deleted_at DESC`,
      [req.user!.id]
    );
    res.json({ success: true, data: { items: rows } });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/vault/items/:id/restore ───────────────────────────────────────
export const restoreItem = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { rowCount } = await query(
      `UPDATE vault_items SET is_deleted = FALSE, deleted_at = NULL
       WHERE id = $1 AND user_id = $2 AND is_deleted = TRUE`,
      [req.params.id, req.user!.id]
    );
    if (!rowCount) throw new AppError("Item not found in trash", 404);
    res.json({ success: true, message: "Item restored from trash" });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/vault/folders ───────────────────────────────────────────────────
export const listFolders = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { rows } = await query<VaultFolder & { item_count: string }>(
      `SELECT f.*, COUNT(i.id) AS item_count
       FROM vault_folders f
       LEFT JOIN vault_items i ON i.folder_id = f.id AND i.is_deleted = FALSE
       WHERE f.user_id = $1
       GROUP BY f.id
       ORDER BY f.name`,
      [req.user!.id]
    );
    res.json({ success: true, data: { folders: rows } });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/vault/folders ──────────────────────────────────────────────────
export const createFolder = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, icon, color } = req.body;
    const { rows } = await query<VaultFolder>(
      `INSERT INTO vault_folders (user_id, name, icon, color)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.user!.id, name, icon ?? null, color ?? null]
    );
    res.status(201).json({ success: true, message: "Folder created", data: { folder: rows[0] } });
  } catch (err) {
    next(err);
  }
};

// ─── PUT /api/vault/folders/:id ───────────────────────────────────────────────
export const updateFolder = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, icon, color } = req.body;
    const setClauses: string[] = [];
    const values: unknown[] = [];
    const set = (col: string, val: unknown) => {
      if (val !== undefined) { values.push(val); setClauses.push(`${col} = $${values.length}`); }
    };
    set("name", name); set("icon", icon); set("color", color);
    if (!setClauses.length) throw new AppError("Nothing to update", 400);
    values.push(req.params.id, req.user!.id);
    const { rows } = await query<VaultFolder>(
      `UPDATE vault_folders SET ${setClauses.join(", ")}
       WHERE id = $${values.length - 1} AND user_id = $${values.length}
       RETURNING *`,
      values
    );
    if (!rows.length) throw new AppError("Folder not found", 404);
    res.json({ success: true, message: "Folder updated", data: { folder: rows[0] } });
  } catch (err) {
    next(err);
  }
};

// ─── DELETE /api/vault/folders/:id ───────────────────────────────────────────
export const deleteFolder = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await withTransaction(async (client) => {
      // Move items to root
      await client.query(
        "UPDATE vault_items SET folder_id = NULL WHERE folder_id = $1 AND user_id = $2",
        [req.params.id, req.user!.id]
      );
      const { rowCount } = await client.query(
        "DELETE FROM vault_folders WHERE id = $1 AND user_id = $2",
        [req.params.id, req.user!.id]
      );
      if (!rowCount) throw new AppError("Folder not found", 404);
    });
    res.json({ success: true, message: "Folder deleted; items moved to root" });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/vault/stats ─────────────────────────────────────────────────────
export const getStats = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const [typeCounts, favCount, trashCount, folderCount] = await Promise.all([
      query<{ type: string; count: string }>(
        `SELECT type, COUNT(*) AS count FROM vault_items
         WHERE user_id = $1 AND is_deleted = FALSE GROUP BY type`,
        [req.user!.id]
      ),
      query<{ count: string }>(
        "SELECT COUNT(*) FROM vault_items WHERE user_id = $1 AND is_favorite = TRUE AND is_deleted = FALSE",
        [req.user!.id]
      ),
      query<{ count: string }>(
        "SELECT COUNT(*) FROM vault_items WHERE user_id = $1 AND is_deleted = TRUE",
        [req.user!.id]
      ),
      query<{ count: string }>(
        "SELECT COUNT(*) FROM vault_folders WHERE user_id = $1",
        [req.user!.id]
      ),
    ]);

    const byType: Record<string, number> = {};
    let total = 0;
    for (const row of typeCounts.rows) {
      byType[row.type] = parseInt(row.count);
      total += parseInt(row.count);
    }

    res.json({
      success: true,
      data: {
        stats: {
          total,
          byType,
          favorites: parseInt(favCount.rows[0].count),
          inTrash: parseInt(trashCount.rows[0].count),
          folders: parseInt(folderCount.rows[0].count),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};
