# Doop Dashboard

Doop helps teams (and solos) work with multiple AI agents — orchestrate, monitor, and govern your AI workforce from one control plane.

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
- A [Supabase](https://supabase.com/) project

## Getting Started

1. **Clone the repository:**

   ```bash
   git clone https://github.com/doop/doop-dashboard.git
   cd doop-dashboard
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Set up environment variables:**

   ```bash
   cp .env.example .env.local
   ```

   Fill in the values — see `.env.example` for details on each variable.

4. **Start the development server:**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

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
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed architecture documentation.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## Security

To report a vulnerability, please see [SECURITY.md](SECURITY.md). Do not open a public issue.

## License

[MIT](LICENSE)
