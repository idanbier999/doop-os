<p align="center">
  <img src="public/banner.png" alt="Doop" width="600" />
</p>

<h1 align="center">Doop</h1>

<p align="center">
  <strong>The operating system for your AI workforce.</strong><br/>
  Orchestrate, monitor, and govern your AI agents from one control plane.
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> &middot;
  <a href="#features">Features</a> &middot;
  <a href="#tech-stack">Tech Stack</a> &middot;
  <a href="#contributing">Contributing</a>
</p>

> **Pre-release (v0.1.0)** — Doop is under active development. APIs may change. Contributions and feedback are welcome!

---

## Why Doop?

You're running multiple AI agents — code assistants, data pipelines, autonomous workflows. They're scattered across tools with no unified view. When one breaks, you find out too late. When a task stalls, nobody knows.

Doop gives you a single control plane for your entire AI workforce. Register agents, dispatch tasks, track health, audit every action. Think of it as the operating system that sits between your team and your fleet of AI agents.

---

## Features

### Fleet Dashboard

Your command center. See every agent's health at a glance — healthy, degraded, critical, or offline. Track open problems, tasks in-flight, and 7-day trends with sparkline charts. Day-over-day deltas surface what changed since yesterday.

Each agent card shows its current stage (idle, running, blocked, completed, error), the task it's working on, and a 7-day health sparkline. Everything updates in real-time.

### Agent Management

Register agents by name and platform (OpenClaw, MCP for Claude/Cursor, or custom). Each agent gets a unique API key for authentication. From the fleet view, filter, search, and sort agents. Drill into any agent to see:

- **Health timeline** — 7-day trend of health state transitions
- **Performance stats** — completion rate, open problem count
- **Activity stream** — the 50 most recent updates: health changes, stage transitions, messages
- **Problems** — all incidents reported by this agent
- **Tasks** — everything assigned to it, with status and priority
- **Metadata** — custom JSON payload (version, capabilities, runtime info)

### Agent Heartbeats & Auto-Offline Detection

Agents send heartbeats to `POST /api/v1/agents/heartbeat`. Doop updates their `last_seen_at` timestamp and keeps them marked healthy. If an agent goes silent for 5+ minutes, Doop automatically marks it offline and fires a notification. No polling on your side — it just works.

### Project & Task Orchestration

Organize work into **projects**. Each project has a team of agents, file attachments, and a task board.

**Two orchestration modes:**

- **Manual** — you dispatch tasks to agents, you decide what runs when.
- **Lead Agent** — designate a lead agent that receives all project events and autonomously dispatches tasks to team members. You set the goal, the lead agent runs the show.

**Task lifecycle:** Pending → In Progress → Waiting on Agent / Waiting on Human → Completed / Cancelled. View everything on a Kanban board with drag-and-drop, or filter by status, priority, and assigned agent.

**Task dependencies:** Tasks can depend on other tasks. When a dependency completes, the next task auto-dispatches. Build DAGs of work that flow through your agent team.

### Webhook Dispatch with HMAC Signing

When a task is assigned to an agent with a webhook URL, Doop pushes it immediately:

- **HMAC-SHA256 signature** in the `X-Doop-Signature` header — agents verify the payload is authentic
- **Delivery tracking** — every webhook gets a `webhook_deliveries` record with attempt count, HTTP status, response body (first 2K chars), and error messages
- **SSRF protection** — webhook URLs are validated against private/internal IP ranges
- **10-second timeout** per delivery attempt

No webhook? Agents can poll `GET /api/v1/tasks` instead.

### Problems & Incident Tracking

Agents report problems via the API. Each problem has a severity (low, medium, high, critical), a status (open/resolved), and links to the agent and task that caused it.

Filter by severity, agent, status, task, or date range. Sort by newest or most critical. Resolve problems and track who resolved them. High and critical problems trigger Slack notifications and in-app toasts automatically.

### Activity Timeline & Audit Log

Every action in Doop is logged: agent registered, task assigned, project launched, member invited, role changed, health transitioned. The activity page shows the 200 most recent entries with real-time updates.

**Filter** by agent, action category (agents, projects, tasks, invitations, auth, team), or date range. **Export** to CSV or JSON for compliance or analysis.

Categories tracked: agent lifecycle, project lifecycle, task lifecycle, invitations, authentication events, team changes, and audit trail entries.

### Real-Time Everything

Doop uses Supabase Realtime subscriptions so you never need to refresh:

- **Agent health** — status changes appear instantly across all views
- **Task board** — Kanban updates as tasks move between stages
- **Problems** — new incidents surface immediately with toast notifications
- **Activity feed** — entries appear as they're created
- **Agent timeline** — updates stream into the detail page

### Workspaces & Team Collaboration

Create multiple workspaces. Invite team members via unique token links. Three roles with granular permissions:

| Role       | Capabilities                                               |
| ---------- | ---------------------------------------------------------- |
| **Owner**  | Full access. Manage team, roles, billing, delete resources |
| **Admin**  | Manage team, invite members, configure agents and settings |
| **Member** | View resources, manage own agents                          |

All data is workspace-scoped. 63 row-level security policies across 23 tables enforce isolation at the database level.

### Slack Notifications

No environment variables needed — configure Slack per-workspace in Settings:

1. Paste your Slack incoming webhook URL
2. Pick which severity levels trigger notifications (low, medium, high, critical)
3. Hit save. Done.

Test the webhook right from the settings page. Notifications fire on new high/critical problems and agent offline events.

### Agent API

Agents integrate through a REST API or the MCP server:

**REST API** (recommended) — works with any tool or language:

| Endpoint                     | Method | Description                                                 |
| ---------------------------- | ------ | ----------------------------------------------------------- |
| `/api/v1/agents/heartbeat`   | POST   | Heartbeat + optional status update (stage, health, message) |
| `/api/v1/tasks`              | GET    | List tasks (filter by status, assignment, role)             |
| `/api/v1/tasks/:id`          | PATCH  | Update task fields (status, priority, result)               |
| `/api/v1/tasks/:id/complete` | POST   | Mark task completed with optional result payload            |
| `/api/v1/tasks/:id/comments` | POST   | Add comment to task                                         |
| `/api/v1/tasks/:id/assign`   | POST   | Assign agent to task (lead only)                            |
| `/api/v1/projects/:id`       | GET    | Get project with team, files (signed URLs)                  |
| `/api/v1/projects/:id/tasks` | POST   | Create subtask (lead only)                                  |
| `/api/v1/problems`           | POST   | Report a problem/incident                                   |
| `/api/v1/activity-log`       | POST   | Log custom activity entry                                   |

Authenticate with `Authorization: Bearer <api-key>`. Rate-limited per agent.

**MCP** — native integration for Claude Code / Cursor:

Configure `DOOP_API_URL` and `DOOP_API_KEY` in your `.mcp.json`. The MCP server wraps the REST API — no Supabase credentials needed on the client.

### File Attachments

Attach files to projects with drag-and-drop upload. Documents, images, code — whatever context your agents or team needs. Stored in Supabase Storage with download links and metadata.

### Search & Command Palette

Hit `Cmd+K` (or `Ctrl+K`) to search across your workspace — agents, projects, tasks. Jump to anything instantly.

---

## Tech Stack

| Layer      | Technology                                 |
| ---------- | ------------------------------------------ |
| Framework  | Next.js 16 (App Router)                    |
| UI         | React 19, Tailwind CSS 4                   |
| Auth       | Better Auth (email/password, Google OAuth) |
| Database   | Supabase (PostgreSQL + Realtime)           |
| Storage    | Supabase Storage                           |
| Charts     | Recharts                                   |
| Validation | Zod                                        |
| Testing    | Vitest, Testing Library                    |
| Language   | TypeScript                                 |

---

## Quick Start

```bash
npx create-doop my-app
cd my-app
npm run dev
```

That's it. The CLI clones the repo, installs dependencies, and — if Docker + Supabase CLI are available — starts a local Supabase and wires up `.env.local` automatically.

Open [http://localhost:3000](http://localhost:3000).

## Manual Setup

<details>
<summary>Step-by-step instructions (click to expand)</summary>

1. **Clone and install:**

   ```bash
   git clone https://github.com/idanbier999/doop-os.git
   cd doop-os
   npm install
   ```

2. **Set up environment variables:**

   ```bash
   cp .env.example .env.local
   ```

   Fill in the values — see `.env.example` for details on each variable.

3. **Set up the database:**

   **Option A — Local Supabase (recommended for development):**

   Requires [Docker](https://www.docker.com/) to be running.

   ```bash
   supabase start
   ```

   Migrations apply automatically. The CLI prints local credentials — use them in `.env.local`.

   **Option B — Remote Supabase (recommended for production):**

   Create a Supabase project at [supabase.com](https://supabase.com), then:

   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```

4. **Start the development server:**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

</details>

## First Login

1. **Sign up** with email/password or Google OAuth.
2. **Create a workspace** — the onboarding wizard walks you through it.
3. **Register your first agent** — pick a platform, get an API key, paste the config snippet.
4. You'll land on the **fleet dashboard** showing your agents, recent activity, and task pipeline.

---

## Available Scripts

| Script                 | Description               |
| ---------------------- | ------------------------- |
| `npm run dev`          | Start development server  |
| `npm run build`        | Production build          |
| `npm start`            | Start production server   |
| `npm run lint`         | Run ESLint                |
| `npm test`             | Run tests (Vitest)        |
| `npm run typecheck`    | TypeScript type checking  |
| `npm run format`       | Format code with Prettier |
| `npm run format:check` | Check formatting          |

## Project Structure

```
src/
  app/                  # Next.js App Router pages and API routes
    api/                # REST API (auth, v1 agent/task endpoints)
    dashboard/          # Authenticated dashboard pages
    login/, signup/     # Authentication pages
    onboarding/         # New user workspace setup
  components/           # React components by feature area
    ui/                 # Reusable UI primitives
  contexts/             # React contexts (workspace, notifications)
  hooks/                # Custom hooks (Supabase, realtime)
  lib/                  # Utilities and business logic
    supabase/           # Supabase client factories
supabase/
  migrations/           # Database migrations (run via supabase db push)
  config.toml           # Local Supabase configuration
packages/
  create-doop/          # npx create-doop CLI scaffolding tool
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## Security

To report a vulnerability, please see [SECURITY.md](SECURITY.md). Do not open a public issue.

## License

[MIT](LICENSE)
