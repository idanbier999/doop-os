# Architecture

This document describes the high-level architecture of the Doop Dashboard.

## Authentication Flow

Doop uses a two-layer auth strategy:

1. **Better Auth** handles user authentication (email/password + Google OAuth). Sessions are managed via HTTP-only cookies.
2. **Supabase JWT Bridge** (`src/lib/jwt.ts`): After Better Auth validates a user, we sign a Supabase-compatible JWT containing the user's ID. This JWT is used for:
   - Server-side: Creating authenticated Supabase clients (`src/lib/supabase/authenticated.ts`) for RLS-scoped queries
   - Client-side: Passed to the browser via `SupabaseTokenProvider` context so client components can query Supabase with RLS

```
Browser -> Better Auth cookie -> Server Component
  -> signSupabaseToken(userId) -> Supabase client with RLS
```

## Database

PostgreSQL hosted on Supabase with Row Level Security (RLS). Key tables:

| Table                   | Purpose                                        |
| ----------------------- | ---------------------------------------------- |
| `workspaces`            | Multi-tenant workspace isolation               |
| `workspace_members`     | User-workspace relationships with roles        |
| `agents`                | Registered AI agents (API key, webhook config) |
| `projects`              | Project containers with orchestration mode     |
| `project_agents`        | Agent assignments to projects with roles       |
| `tasks`                 | Work items within projects                     |
| `task_dependencies`     | DAG of task dependencies                       |
| `task_agents`           | Agent assignments to individual tasks          |
| `activity_log`          | Audit trail of all workspace actions           |
| `webhook_deliveries`    | Webhook dispatch records and delivery status   |
| `problems`              | Issues reported by agents during execution     |
| `notification_settings` | Per-workspace Slack notification config        |
| `project_files`         | File attachments for projects                  |
| `rate_limit_counters`   | Per-agent API rate limiting state              |

## Webhook Dispatch

`src/lib/webhook-dispatch.ts` handles outbound webhooks to agents:

1. Fetches agent's `webhook_url` and `webhook_secret` from the database
2. Validates the URL against private IP ranges (SSRF protection via `src/lib/url-validation.ts`)
3. Signs the payload with HMAC-SHA256 using the agent's `webhook_secret`
4. Sends the POST request with a 10-second timeout
5. Records the delivery attempt in `webhook_deliveries` (status, response code, errors)

Supported events: `project.launched`, `task.assigned`, `webhook.test`

## Rate Limiting

API rate limiting uses a token-bucket pattern:

- Stored in `rate_limit_counters` table
- Atomic increment via `increment_rate_limit` Supabase RPC (no race conditions)
- Configurable per-minute and per-hour windows
- **Fails closed**: if the database is unreachable, requests are denied (not allowed)

## Role Hierarchy

Three workspace roles with descending privileges:

| Role     | Can manage members | Can manage agents | Can manage projects | Can view |
| -------- | ------------------ | ----------------- | ------------------- | -------- |
| `owner`  | Yes                | Yes               | Yes                 | Yes      |
| `admin`  | Yes                | Yes               | Yes                 | Yes      |
| `member` | No                 | No                | Yes                 | Yes      |

Enforced at two levels:

- **Application**: Server actions check `workspace_members.role` before mutations
- **Database**: Supabase RLS policies restrict access based on `auth.uid()`

## Project Structure

```
src/
  app/                  # Next.js App Router pages and API routes
    api/                # REST API endpoints (auth, v1 agent/task APIs)
    dashboard/          # Authenticated dashboard pages
    login/, signup/     # Auth pages
    onboarding/         # New user workspace setup
  components/           # React components organized by feature
    auth/               # Shared auth form
    ui/                 # Reusable UI primitives
  contexts/             # React contexts (workspace, notifications, etc.)
  hooks/                # Custom React hooks
  lib/                  # Shared utilities and business logic
    supabase/           # Supabase client factories
```
