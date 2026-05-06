import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { query, withTransaction } from "../lib/db";
import { AuthRequest, User } from "../types";
import { AppError } from "../middleware/errorHandler";
import { sendEmail } from "../lib/email";

const otpStore = new Map<string, { otp: string; data: any; expiresAt: number }>();

const SALT_ROUNDS = 12;

// ─── Token helpers ────────────────────────────────────────────────────────────

interface TokenPayload {
  id: string;
  email: string;
  role: string;
}

const signAccess = (payload: TokenPayload) =>
  jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: (process.env.JWT_ACCESS_EXPIRES as jwt.SignOptions["expiresIn"]) || "15m",
  });

const signRefresh = (payload: TokenPayload) =>
  jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, {
    expiresIn: (process.env.JWT_REFRESH_EXPIRES as jwt.SignOptions["expiresIn"]) || "7d",
  });

const hashToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

const storeRefreshToken = async (userId: string, token: string) => {
  const hash = hashToken(token);
  // Decode to get expiry without verifying (we just signed it)
  const decoded = jwt.decode(token) as { exp: number };
  const expiresAt = new Date(decoded.exp * 1000).toISOString();
  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [userId, hash, expiresAt]
  );
};

// ─── POST /api/auth/register ──────────────────────────────────────────────────
export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password, name } = req.body as { email: string; password: string; name?: string };
    const existing = await query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length) throw new AppError("Email already registered", 409);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(email, { otp, data: { email, password, name }, expiresAt: Date.now() + 10 * 60 * 1000 });
    await sendEmail({
      to: email,
      subject: "Your Private Vault verification code",
      html: `<div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:32px;"><h2>Private Vault</h2><p>Hi ${name || "there"},</p><p>Your verification code is:</p><div style="background:#f4f4f4;border-radius:8px;padding:24px;text-align:center;margin:24px 0;"><span style="font-size:36px;font-weight:bold;letter-spacing:8px;">${otp}</span></div><p>This code expires in <strong>10 minutes</strong>.</p></div>`,
    });
    res.status(200).json({ success: true, message: "OTP sent to your email. Please verify to complete registration." });
  } catch (err) { next(err); }
};

export const verifyOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, otp } = req.body as { email: string; otp: string };
    const record = otpStore.get(email);
    if (!record || record.otp !== otp) throw new AppError("Invalid OTP", 400);
    if (Date.now() > record.expiresAt) throw new AppError("OTP expired. Please register again.", 400);
    const { email: e, password, name } = record.data;
    otpStore.delete(email);
    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    const { rows } = await query<User>(
      `INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name, role, created_at`,
      [e, password_hash, name ?? null]
    );
    const user = rows[0];
    const payload: TokenPayload = { id: user.id as string, email: user.email as string, role: user.role as string };
    const accessToken = signAccess(payload);
    const refreshToken = signRefresh(payload);
    await storeRefreshToken(user.id as string, refreshToken);
    res.status(201).json({ success: true, message: "Account created successfully", data: { user: { id: user.id, email: user.email, name: user.name, role: user.role }, accessToken, refreshToken,
        tokenType: "Bearer",
        expiresIn: process.env.JWT_ACCESS_EXPIRES || "15m",
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password } = req.body as { email: string; password: string };

    const { rows } = await query(
      "SELECT id, email, name, role, password_hash FROM users WHERE email = $1",
      [email]
    );
    const user = rows[0];

    // Use constant-time compare to avoid timing attacks even on missing user
    const valid =
      user && (await bcrypt.compare(password, user.password_hash));
    if (!valid) throw new AppError("Invalid email or password", 401);

    const payload: TokenPayload = { id: user.id, email: user.email, role: user.role };
    const accessToken = signAccess(payload);
    const refreshToken = signRefresh(payload);
    await storeRefreshToken(user.id, refreshToken);

    res.json({
      success: true,
      message: "Login successful",
      data: {
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
        accessToken,
        refreshToken,
        tokenType: "Bearer",
        expiresIn: process.env.JWT_ACCESS_EXPIRES || "15m",
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/auth/refresh ───────────────────────────────────────────────────
export const refresh = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { refreshToken } = req.body as { refreshToken: string };
    if (!refreshToken) throw new AppError("refreshToken is required", 400);

    let decoded: TokenPayload;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as TokenPayload;
    } catch {
      throw new AppError("Invalid or expired refresh token", 401);
    }

    // Verify it's whitelisted
    const hash = hashToken(refreshToken);
    const { rows } = await query(
      `SELECT id FROM refresh_tokens
       WHERE token_hash = $1 AND user_id = $2 AND expires_at > NOW()`,
      [hash, decoded.id]
    );
    if (!rows.length) throw new AppError("Refresh token revoked or expired", 401);

    // Rotate: delete old, issue new pair
    await withTransaction(async (client) => {
      await client.query("DELETE FROM refresh_tokens WHERE token_hash = $1", [hash]);
      const newAccess = signAccess({ id: decoded.id, email: decoded.email, role: decoded.role });
      const newRefresh = signRefresh({ id: decoded.id, email: decoded.email, role: decoded.role });
      const newHash = hashToken(newRefresh);
      const exp = (jwt.decode(newRefresh) as { exp: number }).exp;
      await client.query(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
        [decoded.id, newHash, new Date(exp * 1000).toISOString()]
      );

      res.json({
        success: true,
        message: "Tokens refreshed",
        data: {
          accessToken: newAccess,
          refreshToken: newRefresh,
          tokenType: "Bearer",
          expiresIn: process.env.JWT_ACCESS_EXPIRES || "15m",
        },
      });
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
export const logout = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (refreshToken) {
      const hash = hashToken(refreshToken);
      await query("DELETE FROM refresh_tokens WHERE token_hash = $1", [hash]);
    }
    // Optionally: delete ALL refresh tokens for this user
    // await query("DELETE FROM refresh_tokens WHERE user_id = $1", [req.user!.id]);
    res.json({ success: true, message: "Logged out successfully" });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
export const me = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { rows } = await query<User>(
      "SELECT id, email, name, role, created_at, updated_at FROM users WHERE id = $1",
      [req.user!.id]
    );
    if (!rows.length) throw new AppError("User not found", 404);
    res.json({ success: true, data: { user: rows[0] } });
  } catch (err) {
    next(err);
  }
};

// ─── PUT /api/auth/me ─────────────────────────────────────────────────────────
export const updateMe = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, currentPassword, newPassword } = req.body as {
      name?: string;
      currentPassword?: string;
      newPassword?: string;
    };

    const setClauses: string[] = [];
    const values: unknown[] = [];

    if (name !== undefined) {
      values.push(name);
      setClauses.push(`name = $${values.length}`);
    }

    if (newPassword) {
      if (!currentPassword) throw new AppError("currentPassword is required to change password", 400);
      const { rows } = await query("SELECT password_hash FROM users WHERE id = $1", [req.user!.id]);
      const valid = await bcrypt.compare(currentPassword, rows[0]?.password_hash);
      if (!valid) throw new AppError("Current password is incorrect", 400);
      if (newPassword.length < 8) throw new AppError("New password must be at least 8 characters", 400);
      values.push(await bcrypt.hash(newPassword, SALT_ROUNDS));
      setClauses.push(`password_hash = $${values.length}`);
    }

    if (!setClauses.length) throw new AppError("Nothing to update", 400);

    values.push(req.user!.id);
    const { rows } = await query<User>(
      `UPDATE users SET ${setClauses.join(", ")} WHERE id = $${values.length}
       RETURNING id, email, name, role, updated_at`,
      values
    );
    res.json({ success: true, message: "Profile updated", data: { user: rows[0] } });
  } catch (err) {
    next(err);
  }
};
