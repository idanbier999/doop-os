#!/usr/bin/env node
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const REPO = "https://github.com/idanbier999/doop-os.git";
const BOLD = "\x1b[1m";
const GREEN = "\x1b[32m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

function log(msg) {
  console.log(`${GREEN}==>${RESET} ${msg}`);
}

function run(cmd, opts = {}) {
  return execSync(cmd, { stdio: "inherit", ...opts });
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
// Done
// ---------------------------------------------------------------------------
console.log(`
${GREEN}${BOLD}  Done!${RESET} Your Doop AI workforce OS is ready.

  ${BOLD}cd ${dir}${RESET}
  ${BOLD}npm run dev${RESET}

  ${DIM}No Docker, no database setup, no environment variables needed.${RESET}
  ${DIM}The dev server auto-starts an embedded database and runs migrations.${RESET}

  Then open ${CYAN}http://localhost:3000${RESET}
`);
