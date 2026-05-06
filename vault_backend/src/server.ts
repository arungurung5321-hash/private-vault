import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";

import authRoutes   from "./routes/auth";
import vaultRoutes  from "./routes/vault";
import healthRoutes from "./routes/health";
import mediaRoutes  from "./routes/media";
import shareRoutes  from "./routes/share";
import { errorHandler, notFound } from "./middleware/errorHandler";
import { testConnection } from "./lib/db";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet());
app.use(cors({
  origin: ["http://localhost:5173", "http://127.0.0.1:5500", "http://localhost:5500", "https://my-privatevault.com", "https://private-vault.pages.dev"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api/health", healthRoutes);
app.use("/api/auth",   authRoutes);
app.use("/api/vault",  vaultRoutes);
app.use("/api/media",  mediaRoutes);
app.use("/api/share",  shareRoutes);

app.use(notFound);
app.use(errorHandler);

const start = async () => {
  try {
    await testConnection();
    console.log("✅ PostgreSQL connected");
  } catch (err) {
    console.error("❌ Cannot connect to PostgreSQL:", err);
    process.exit(1);
  }
  app.listen(PORT, () => {
    console.log(`\n🔐 Vault API  →  http://localhost:${PORT}`);
    console.log(`   Env: ${process.env.NODE_ENV || "development"}`);
    console.log(`   Endpoints:`);
    console.log(`     GET  /api/health`);
    console.log(`     POST /api/auth/register`);
    console.log(`     POST /api/auth/login`);
    console.log(`     GET  /api/vault/items`);
    console.log(`     POST /api/media/:itemId/files`);
    console.log(`     POST /api/share/items/:itemId/share\n`);
  });
};

start();

export default app;

