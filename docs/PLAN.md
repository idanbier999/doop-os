# Agent Connect v1 + REST API for OpenClaw

## Why

OpenClaw can't use MCP — it explicitly ignores MCP servers. Users also have a chicken-and-egg problem: they need MCP running to register an agent and get an API key, but need the key to configure MCP. We fix both: dashboard creates agents with API keys, REST endpoints let OpenClaw talk to Doop over HTTP.

## Pre-requisite

User adds `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` (confirmed ready).

## Supabase project: `zvqynhernhoxuvlwkhdd`

---

## Team 1: Database — `db-architect` agent

### Mission

Add `platform` column to agents, add missing RLS policies, add API key index.

### Task 1.1 — Apply migration

Use `mcp__claude_ai_Supabase__apply_migration` on project `zvqynhernhoxuvlwkhdd`:

```sql
ALTER TABLE public.agents ADD COLUMN platform text DEFAULT NULL;

CREATE POLICY "Workspace members can insert agents"
  ON public.agents FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Workspace members can update agents"
  ON public.agents FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE INDEX idx_agents_api_key ON public.agents (api_key) WHERE api_key IS NOT NULL;
```

### Task 1.2 — Regenerate TypeScript types

Use `mcp__claude_ai_Supabase__generate_typescript_types` for project `zvqynhernhoxuvlwkhdd`, then write the output to `src/lib/database.types.ts`.

### Verification

- `SELECT platform FROM agents LIMIT 1` runs without error
- TypeScript types include `platform: string | null` on agents

---

## Team 2: Server Infrastructure — `mcp-tool-dev` agent

### Mission

Create 3 small files: admin Supabase client, API auth helper, and the `createAgent` server action.

### Task 2.1 — Admin client

**New file**: `src/lib/supabase/admin.ts`

Simple client using `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS). Used by REST API routes only.

```typescript
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
```

Pattern reference: `src/lib/supabase/server.ts`

### Task 2.2 — API auth helper

**New file**: `src/lib/api-auth.ts`

Validates `Authorization: Bearer <agent_api_key>` header. Uses admin client to look up agent by `api_key` column. Returns agent row or null.

```typescript
import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function authenticateAgent(request: NextRequest) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const apiKey = header.slice(7);
  if (!apiKey) return null;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("agents")
    .select("id, workspace_id, name")
    .eq("api_key", apiKey)
    .single();

  return data; // null if key invalid/not found
}
```

### Task 2.3 — `createAgent` server action

**New file**: `src/app/dashboard/agents/actions.ts`

Server action called by the frontend modal. Uses the regular user session (cookie-based auth, not service role).

- Signature: `createAgent(workspaceId: string, name: string, platform: string)`
- Auth: `supabase.auth.getUser()` + workspace membership check
- Insert into `agents` table: `{ workspace_id, name, platform, health: 'waiting', stage: 'idle' }`
- DB auto-generates `id` and `api_key` (both UUID with defaults)
- Select back the full row including `api_key` (one-time reveal)
- Insert activity log: `{ action: 'agent_registered', agent_id, workspace_id, details: { name, platform } }`
- Return: `{ success: true, agentId, apiKey, apiKeyLast4: apiKey.slice(-4), name, platform }`
- On error: `{ success: false, error: string }`

**Follow the exact pattern from**: `src/app/dashboard/settings/actions.ts` (auth + workspace membership check structure)

### Verification

- All 3 files written, no TypeScript errors
- `createAgent` returns api key on success

---

## Team 3: REST API Routes — `mcp-tool-dev` agent

### Mission

3 new Next.js route handlers for OpenClaw to call. All use `authenticateAgent()` from `src/lib/api-auth.ts` and `createAdminClient()` from `src/lib/supabase/admin.ts` for DB queries.

**Follow the route handler pattern from**: `src/app/api/activity/export/route.ts`

### Task 3.1 — Heartbeat

**New file**: `src/app/api/v1/agents/heartbeat/route.ts`

```
POST /api/v1/agents/heartbeat
Authorization: Bearer <agent_api_key>
Body (optional): { "status": "online", "version": "openclaw-plugin@0.1.0", "meta": { ... } }
Response: { "ok": true }
```

Logic:

1. `authenticateAgent(request)` → 401 if null
2. Parse optional JSON body
3. Update agent via admin client: `last_seen_at = new Date().toISOString()`, `health = 'healthy'`, merge `version` and `meta` into `metadata` jsonb
4. Return 200 `{ ok: true }`

### Task 3.2 — List tasks

**New file**: `src/app/api/v1/tasks/route.ts`

```
GET /api/v1/tasks?status=pending&limit=20&assigned_to=me
Authorization: Bearer <agent_api_key>
Response: { "tasks": [{ "id", "title", "description", "status", "priority", "created_at" }] }
```

Logic:

1. `authenticateAgent(request)` → 401 if null
2. Parse query params: `status` (default `"pending"`), `limit` (default 20, max 100), `assigned_to` (optional)
3. Query tasks via admin client: `workspace_id = agent.workspace_id`, filter by status, order by `created_at asc`, limit
4. If `assigned_to=me`, also filter `agent_id = agent.id`. Default returns all workspace tasks (agent picks up unassigned work).
5. Return 200 `{ tasks: [...] }`

> Note: REST API lives in Next.js routes — if dashboard goes down, OpenClaw loses connection. Fine for MVP; extract to standalone service later if needed.

### Task 3.3 — Complete task

**New file**: `src/app/api/v1/tasks/[id]/complete/route.ts`

```
POST /api/v1/tasks/{id}/complete
Authorization: Bearer <agent_api_key>
Body (optional): { "result": { ... } }
Response: { "ok": true }
```

Logic:

1. `authenticateAgent(request)` → 401 if null
2. Extract task `id` from URL params
3. Parse optional JSON body for `result`
4. Verify task exists and `workspace_id` matches agent's → 404 if not
5. Update task via admin client: `status = 'completed'`, `result` from body, `agent_id = agent.id`, `updated_at = now()`
6. Return 200 `{ ok: true }`

### Verification

- All 3 route files written, no TypeScript errors
- Each returns proper JSON responses with correct status codes (200, 401, 404)

---

## Team 4: Frontend — `dashboard-dev` agent

### Mission

Update the "Connect Agent" modal from a static config display to a two-step flow: create agent → reveal config.

### Task 4.1 — Rewrite modal in `src/components/agents/agents-page-client.tsx`

**Replace** the current static modal content with a two-step flow. Keep all existing code (realtime, filters, grid) unchanged.

**New state:**

- `modalStep: "form" | "result"` (replaces simple boolean, or use alongside `connectModalOpen`)
- `agentName: string`
- `platform: "openclaw" | "mcp"`
- `creating: boolean` (loading state)
- `createError: string | null`
- `createdAgent: { agentId, apiKey, apiKeyLast4, name, platform } | null`
- `copied: boolean`

**Import**: `createAgent` from `@/app/dashboard/agents/actions`

**Modal step 1 — Create form:**

- Text input for agent name (required)
- `<select>` dropdown for platform: "OpenClaw", "MCP (Claude/Cursor)"
- "Create Agent" button (`variant="primary"`, disabled while `creating` or empty name)
- Error display if `createError`
- On submit: call `createAgent(workspaceId, agentName, platform)` → on success, store result and go to step 2

**Modal step 2 — Config reveal:**

- Agent name + ID displayed
- API key in monospace with yellow/amber warning: "This key is shown once. Store it safely."
- Config snippet in `<pre>` block, content depends on platform:
  - If `openclaw`:
    ```json
    {
      "DOOP_API_BASE_URL": "<dashboard URL via window.location.origin>",
      "DOOP_AGENT_API_KEY": "<actual key>",
      "DOOP_AGENT_ID": "<actual id>"
    }
    ```
  - If `mcp`:
    ```json
    {
      "mcpServers": {
        "doop": {
          "command": "node",
          "args": ["path/to/doop-mcp/build/index.js"],
          "env": {
            "DOOP_API_KEY": "<actual key>"
          }
        }
      }
    }
    ```
- Copy button (top-right of pre block)
- "Done" button → closes modal, resets all form state

**On modal close**: always reset to step 1 and clear form state.

**Empty state**: keep the existing `actionLabel="Connect Agent"` + `onAction` that opens the modal (already implemented).

### Existing components to use

- `Modal` from `@/components/ui/modal` — already imported
- `Button` from `@/components/ui/button` — already imported
- `useWorkspace()` from `@/contexts/workspace-context` — already imported, gives `workspaceId`

### Verification

- Modal opens, form validates (name required)
- After creating, config snippet shows with real key
- Copy works, "Done" closes and resets
- Empty state action opens the same modal

---

## Execution Order

Teams 1 + 2 start in parallel (no dependencies between them).
Teams 3 + 4 start after Team 2 finishes (they import from files Team 2 creates).

```
Time ──────────────────────────────────►
Team 1 (DB):     [migration + types]
Team 2 (Infra):  [admin + auth + action]
Team 3 (REST):                          [3 route files]
Team 4 (UI):                            [modal rewrite]
```

## Final Verification (after all teams)

1. `npm run build` passes with no errors
2. Full flow: create agent in modal → copy config → curl heartbeat → curl tasks → curl complete
