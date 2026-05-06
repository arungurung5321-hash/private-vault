import { Router, Request, Response } from "express";
import { testConnection } from "../lib/db";
const router = Router();
router.get("/", async (_req: Request, res: Response) => {
  let dbStatus = "ok", dbTime: string | null = null;
  try { dbTime = await testConnection(); } catch { dbStatus = "error"; }
  res.status(dbStatus === "ok" ? 200 : 503).json({ success: dbStatus === "ok", status: dbStatus === "ok" ? "healthy" : "degraded", timestamp: new Date().toISOString(), services: { api: "ok", database: dbStatus }, db_time: dbTime });
});
export default router;