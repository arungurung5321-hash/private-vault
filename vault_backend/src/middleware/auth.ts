import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AuthRequest } from "../types";

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ success: false, error: "Unauthorized", message: "Missing Authorization header." });
    return;
  }
  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; email: string; role: string; };
    req.user = decoded;
    next();
  } catch (err) {
    const message = err instanceof jwt.TokenExpiredError ? "Token expired." : "Invalid token.";
    res.status(401).json({ success: false, error: "Unauthorized", message });
  }
};