import { Pool, PoolClient } from "pg";
import dotenv from "dotenv";

dotenv.config();

const ssl =
  process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined;

export const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl }
    : {
        host: process.env.DB_HOST || "localhost",
        port: parseInt(process.env.DB_PORT || "5432"),
        database: process.env.DB_NAME || "vault_db",
        user: process.env.DB_USER || "postgres",
        password: process.env.DB_PASSWORD,
        ssl,
        max: 20,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
      }
);

pool.on("error", (err) => {
  console.error("Unexpected PostgreSQL pool error:", err);
});

// Convenience: run a query on the pool
export const query = <T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
) => pool.query<T>(text, params);

// Convenience: run multiple queries in a transaction
export const withTransaction = async <T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

export const testConnection = async () => {
  const client = await pool.connect();
  const { rows } = await client.query("SELECT NOW() as now");
  client.release();
  return rows[0].now as string;
};
