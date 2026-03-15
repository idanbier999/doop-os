#!/usr/bin/env node
import { execSync, spawnSync } from "node:child_process";
import { existsSync, cpSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, basename } from "node:path";
import { randomBytes } from "node:crypto";

const REPO = "https://github.com/doophq/doop-dashboard.git";
const BOLD = "\x1b[1m";
const GREEN = "\x1b[32m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

function log(msg) {
  console.log(`${GREEN}==>${RESET} ${msg}`);
}

function dim(msg) {
  console.log(`${DIM}    ${msg}${RESET}`);
}

function run(cmd, opts = {}) {
  return execSync(cmd, { stdio: "inherit", ...opts });
}

function hasCommand(cmd) {
  const { status } = spawnSync("which", [cmd], { stdio: "ignore" });
  return status === 0;
}

// ---------------------------------------------------------------------------
// Parse args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const flags = process.argv.slice(2).filter((a) => a.startsWith("-"));

if (flags.includes("--help") || flags.includes("-h")) {
  console.log(`
  ${BOLD}create-doop${RESET} — scaffold the Doop operating system for your AI workforce

  ${BOLD}Usage${RESET}
    npx create-doop [directory]

  ${BOLD}Options${RESET}
    --help, -h    Show this help message

  If no directory is given, defaults to ${CYAN}doop-dashboard${RESET}.
`);
  process.exit(0);
}

const dir = args[0] || "doop-dashboard";
const dest = resolve(process.cwd(), dir);

if (existsSync(dest)) {
  console.error(
    `\n  Directory ${CYAN}${dir}${RESET} already exists. Pick a different name or remove it.\n`
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 1. Clone
// ---------------------------------------------------------------------------
console.log();
log(`Cloning Doop into ${CYAN}${dir}${RESET} ...`);
run(`git clone --depth 1 ${REPO} "${dest}"`);
// Remove .git so the user starts with a clean history
execSync(`rm -rf "${dest}/.git"`);
run(`git init`, { cwd: dest });

// ---------------------------------------------------------------------------
// 2. Install
// ---------------------------------------------------------------------------
log("Installing dependencies ...");
run("npm install", { cwd: dest });

// ---------------------------------------------------------------------------
// 3. Environment
// ---------------------------------------------------------------------------
const envExample = resolve(dest, ".env.example");
const envLocal = resolve(dest, ".env.local");

if (existsSync(envExample) && !existsSync(envLocal)) {
  log("Creating .env.local ...");
  cpSync(envExample, envLocal);

  // Generate a random BETTER_AUTH_SECRET
  let env = readFileSync(envLocal, "utf-8");
  const secret = randomBytes(32).toString("hex");
  env = env.replace(/BETTER_AUTH_SECRET=.*/, `BETTER_AUTH_SECRET=${secret}`);
  writeFileSync(envLocal, env);
  dim("Generated random BETTER_AUTH_SECRET");
}

// ---------------------------------------------------------------------------
// 4. Local Supabase (if available)
// ---------------------------------------------------------------------------
const hasSupabase = hasCommand("supabase");
const hasDocker =
  hasCommand("docker") && spawnSync("docker", ["info"], { stdio: "ignore" }).status === 0;

if (hasSupabase && hasDocker) {
  log("Starting local Supabase ...");
  try {
    run("supabase start", { cwd: dest });

    // Read status and inject credentials
    const status = execSync("supabase status --output json", {
      cwd: dest,
      encoding: "utf-8",
    });
    const info = JSON.parse(status);

    let env = readFileSync(envLocal, "utf-8");
    const replacements = {
      NEXT_PUBLIC_SUPABASE_URL: info["API URL"],
      NEXT_PUBLIC_SUPABASE_ANON_KEY: info["anon key"],
      SUPABASE_SERVICE_ROLE_KEY: info["service_role key"],
      SUPABASE_JWT_SECRET: info["JWT secret"],
      DATABASE_URL: info["DB URL"],
    };
    for (const [key, value] of Object.entries(replacements)) {
      if (value) {
        env = env.replace(new RegExp(`${key}=.*`), `${key}=${value}`);
      }
    }
    writeFileSync(envLocal, env);
    dim("Local Supabase credentials written to .env.local");
  } catch {
    dim("Supabase start failed — fill in .env.local manually.");
  }
} else {
  dim("Supabase CLI or Docker not detected — skipping local database.");
  dim("Fill in .env.local manually (see .env.example).");
}

// ---------------------------------------------------------------------------
// Done
// ---------------------------------------------------------------------------
console.log(`
${GREEN}${BOLD}  Done!${RESET} Your Doop AI workforce OS is ready.

  ${BOLD}cd ${dir}${RESET}
  ${BOLD}npm run dev${RESET}

  Then open ${CYAN}http://localhost:3000${RESET}
`);
