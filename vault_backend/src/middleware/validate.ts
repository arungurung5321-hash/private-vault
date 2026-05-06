import { Request, Response, NextFunction } from "express";
type FieldRule = { required?: boolean; type?: string; minLength?: number; maxLength?: number; enum?: string[]; };
type Schema = Record<string, FieldRule>;
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
export const validate = (schema: Schema, from: "body"|"params"|"query" = "body") =>
  (req: Request, res: Response, next: NextFunction): void => {
    const data = req[from] as Record<string, unknown>;
    const errors: string[] = [];
    for (const [field, rule] of Object.entries(schema)) {
      const val = data[field];
      const missing = val === undefined || val === null || val === "";
      if (rule.required && missing) { errors.push(`'${field}' is required`); continue; }
      if (missing) continue;
      if (rule.enum && !rule.enum.includes(val as string)) errors.push(`'${field}' must be one of: ${rule.enum.join(", ")}`);
      if (rule.type === "email" && !isEmail(val as string)) errors.push(`'${field}' must be a valid email`);
      if (typeof val === "string") {
        if (rule.minLength && val.length < rule.minLength) errors.push(`'${field}' min ${rule.minLength} chars`);
        if (rule.maxLength && val.length > rule.maxLength) errors.push(`'${field}' max ${rule.maxLength} chars`);
      }
    }
    if (errors.length) { res.status(400).json({ success: false, error: "ValidationError", message: "Validation failed", details: errors }); return; }
    next();
  };