<p align="center">
  <img src="public/banner.png" alt="Doop" width="600" />
</p>

<h1 align="center">Doop</h1>

<p align="center">
  <strong>The operating system for your AI workforce.</strong><br/>
  Orchestrate, monitor, and govern your AI agents from one control plane.
</p>

> **Pre-release (v0.1.0)** — Doop is under active development. APIs may change. Contributions and feedback are welcome!

## Features

- **Multi-workspace support** with role-based access control (owner, admin, member)
- **AI agent fleet management** — register, monitor health, and configure agents
- **Project & task orchestration** — manual mode or lead-agent autonomous mode
- **Webhook dispatch** with HMAC-SHA256 signing and delivery tracking
- **Activity timeline & audit log** for full workspace visibility
- **Real-time monitoring** via Supabase Realtime subscriptions
- **Slack notifications** for agent problems by severity
- **File attachments** on projects with drag-and-drop upload

## Tech Stack

| Layer      | Technology                           |
| ---------- | ------------------------------------ |
| Framework  | Next.js 16 (App Router)              |
| UI         | React 19, Tailwind CSS 4             |
| Auth       | Better Auth (email/password, Google) |
| Database   | Supabase (PostgreSQL + Realtime)     |
| Storage    | Supabase Storage                     |
| Charts     | Recharts                             |
| Validation | Zod                                  |
| Testing    | Vitest, Testing Library              |
| Language   | TypeScript                           |

## Prerequisites

- [Node.js](https://nodejs.org/) 20+ (see `.nvmrc`)
- npm
- A [Supabase](https://supabase.com/) project (or Docker for local development)
- [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started)

## Quick Start

```bash
npx create-doop my-dashboard
cd my-dashboard
npm run dev
```

That's it. The CLI clones the repo, installs dependencies, and — if Docker + Supabase CLI are available — starts a local Supabase and wires up `.env.local` automatically.

Open [http://localhost:3000](http://localhost:3000).

## Manual Setup

<details>
<summary>Step-by-step instructions (click to expand)</summary>

1. **Clone and install:**

   ```bash
   git clone https://github.com/doophq/doop-dashboard.git
   cd doop-dashboard
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
2. **Create a workspace** — you'll be guided through the onboarding wizard.
3. **Register your first agent** — give it a name and optionally configure a webhook URL.
4. You'll land on the **Dashboard** showing your agent fleet, recent activity, and task pipeline.

## Slack Notifications

Slack integration is configured per-workspace (no environment variable needed):

1. Go to **Settings > Notifications** in the dashboard.
2. Paste your Slack incoming webhook URL.
3. Choose which problem severity levels trigger notifications.

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
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## Security

To report a vulnerability, please see [SECURITY.md](SECURITY.md). Do not open a public issue.

## License

[MIT](LICENSE)
