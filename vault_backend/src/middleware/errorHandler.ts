import { Request, Response, NextFunction } from "express";

export class AppError extends Error {
  constructor(public message: string, public statusCode: number = 500) {
    super(message); this.name = "AppError";
  }
}
export const errorHandler = (err: AppError | Error, req: Request, res: Response, _next: NextFunction): void => {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  console.error(`${req.method} ${req.path} -> ${statusCode}: ${err.message}`);
  res.status(statusCode).json({ success: false, error: err.name || "ServerError", message: err.message });
};
export const notFound = (req: Request, res: Response): void => {
  res.status(404).json({ success: false, error: "NotFound", message: `Route ${req.method} ${req.path} not found` });
};