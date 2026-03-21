#!/usr/bin/env node

/**
 * Dev orchestrator: starts embedded-postgres → runs migrations → seeds → starts Next.js
 * Usage: node scripts/dev.mjs
 */

import { spawn } from "child_process";
import { readFileSync, readdirSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DOOP_DIR = join(ROOT, ".doop");
const DATA_DIR = join(DOOP_DIR, "postgres-data");

const require = createRequire(import.meta.url);

async function getAvailablePort() {
  const { createServer } = await import("net");
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

async function main() {
  // If DATABASE_URL is already set, skip embedded-postgres
  if (process.env.DATABASE_URL) {
    console.log("[doop] DATABASE_URL set — skipping embedded-postgres, starting Next.js...");
    startNext();
    return;
  }

  console.log("[doop] Starting embedded-postgres...");

  // Ensure .doop directory exists
  mkdirSync(DATA_DIR, { recursive: true });

  const EmbeddedPostgresModule = require("embedded-postgres");
  const EmbeddedPostgres = EmbeddedPostgresModule.default || EmbeddedPostgresModule;

  const port = await getAvailablePort();
  const databaseUrl = `postgresql://postgres:postgres@localhost:${port}/doop`;

  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    port,
    user: "postgres",
    password: "postgres",
    persistent: true,
  });

  try {
    await pg.initialise();
  } catch (e) {
    // Already initialised — that's fine
    if (!e.message?.includes("already exists")) {
      // May be first-time init already done
    }
  }

  await pg.start();
  console.log(`[doop] Postgres running on port ${port}`);

  // Create database if it doesn't exist
  try {
    await pg.createDatabase("doop");
    console.log("[doop] Created database 'doop'");
  } catch {
    // Database already exists — fine
  }

  // Set DATABASE_URL for child processes
  process.env.DATABASE_URL = databaseUrl;

  // Run all migrations in order
  console.log("[doop] Running migrations...");
  const drizzleDir = join(ROOT, "drizzle");
  const migrationFiles = readdirSync(drizzleDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const { Pool } = require("pg");
  const pool = new Pool({ connectionString: databaseUrl });
  for (const file of migrationFiles) {
    const raw = readFileSync(join(drizzleDir, file), "utf8");
    // Drizzle Kit uses "--> statement-breakpoint" to separate statements
    const statements = raw
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    let applied = 0;
    let skipped = 0;
    for (const stmt of statements) {
      try {
        await pool.query(stmt);
        applied++;
      } catch (e) {
        if (e.message?.includes("already exists")) {
          skipped++;
        } else {
          console.error(`[doop] Migration error in ${file}:`, e.message);
        }
      }
    }
    if (skipped > 0) {
      console.log(`[doop] ${file}: ${applied} applied, ${skipped} already exist.`);
    } else {
      console.log(`[doop] Applied ${file} (${applied} statements)`);
    }
  }
  console.log("[doop] Migrations complete.");

  // Seed if DB is empty
  const result = await pool.query('SELECT COUNT(*) FROM "user"');
  if (parseInt(result.rows[0].count) === 0) {
    console.log("[doop] Seeding default data...");
    await seed(pool);
  } else {
    console.log("[doop] Database already has data, skipping seed.");
  }

  await pool.end();

  // Start Next.js
  startNext();

  // Graceful shutdown
  const cleanup = async () => {
    console.log("\n[doop] Shutting down...");
    await pg.stop();
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}

async function seed(pool) {
  // Create default admin user
  const userResult = await pool.query(
    `INSERT INTO "user" (name) VALUES ('admin') RETURNING id`
  );
  const userId = userResult.rows[0].id;

  // Create default workspace
  const wsResult = await pool.query(
    `INSERT INTO workspaces (name, slug, created_by) VALUES ('My Workspace', 'my-workspace', $1) RETURNING id`,
    [userId]
  );
  const workspaceId = wsResult.rows[0].id;

  // Add user as owner
  await pool.query(
    `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'owner')`,
    [workspaceId, userId]
  );

  // notification_settings created automatically by trigger

  console.log("[doop] Seeded: admin user + workspace");
}

function startNext() {
  const next = spawn("npx", ["next", "dev"], {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env },
  });

  next.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

main().catch((e) => {
  console.error("[doop] Fatal:", e);
  process.exit(1);
});
