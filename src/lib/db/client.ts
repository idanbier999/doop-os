import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _pool: Pool | null = null;

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. In dev mode, run `npm run dev` which auto-starts embedded-postgres."
    );
  }
  return url;
}

/**
 * Returns a singleton Drizzle client connected to Postgres.
 * Connection is lazily created on first call.
 */
export function getDb() {
  if (_db) return _db;

  _pool = new Pool({ connectionString: getDatabaseUrl() });
  _db = drizzle(_pool, { schema });
  return _db;
}

/**
 * Returns the underlying pg Pool (for raw queries or cleanup).
 */
export function getPool() {
  if (!_pool) getDb(); // ensure pool is created
  return _pool!;
}

/**
 * Close the database connection pool. Call on shutdown.
 */
export async function closeDb() {
  if (_pool) {
    await _pool.end();
    _pool = null;
    _db = null;
  }
}

export type Db = ReturnType<typeof getDb>;
