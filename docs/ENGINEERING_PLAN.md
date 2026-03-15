# Doop — Engineering Roadmap

> Forward-looking plan for extending Doop from runtime to full execution substrate.
> This is a reference document — not active work. When we're ready to build a phase, this is the spec.

---

## Where We Are Today

The codebase delivers the core execution runtime described in PRODUCT.md:

**Built:**

- Agent identity & registration (API keys, heartbeat, health tracking, capabilities)
- Task execution lifecycle (create → assign → dispatch → complete, dependencies, multi-agent assignment)
- Multi-agent project orchestration (team rosters, lead-agent mode, shared context, reference files)
- Webhook dispatch (HMAC-SHA256 signed, delivery tracking)
- Real-time fleet observability (health grid, sparklines, trend charts, Supabase Realtime)
- Problem tracking (severity, agent attribution, task linkage, resolution workflow)
- Complete audit trail (filterable, exportable CSV/JSON)
- Multi-tenant workspaces (owner/admin/member roles, invite links)

**22 database tables**, **3 API routes** (`/v1/tasks`, `/v1/tasks/[id]/complete`, `/v1/agents/heartbeat`), **8 dashboard pages**, full test coverage with Vitest.

**Not built yet** (the "What's Next" from PRODUCT.md):

- Policy enforcement gates
- Cost governance
- Agent-to-agent coordination
- Escalation automation
- Execution authorization
- Rate limiting & quotas
- Row Level Security on tables
- Auto-offline detection
- Webhook retries
- Slack auto-notifications

This document is the engineering spec for all of it.

---

## Architecture Patterns

Reference for all future work. Every new feature must follow these patterns.

### Server Action Pattern

```typescript
// src/app/dashboard/{feature}/actions.ts
"use server";

import { getAuthenticatedSupabase } from "@/lib/supabase/server-with-auth";
import { revalidatePath } from "next/cache";

export async function doSomething(workspaceId: string, data: SomeType) {
  const supabase = await getAuthenticatedSupabase();

  // 1. Auth + workspace membership check (enforced by RLS when enabled)
  // 2. Business logic
  // 3. Log to activity_log
  // 4. revalidatePath

  await supabase.from("activity_log").insert({
    workspace_id: workspaceId,
    action: "feature.action_name",
    details: {
      /* structured context */
    },
  });

  revalidatePath("/dashboard/feature");
}
```

### API Route Pattern

```typescript
// src/app/api/v1/{resource}/route.ts
import { authenticateAgent } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient(); // bypasses RLS
  // ... business logic
  return NextResponse.json({ success: true });
}
```

### Test Pattern

```typescript
// colocated as {file}.test.ts
import { vi, describe, it, expect, beforeEach } from "vitest";
import { createMockSupabaseClient } from "@/__tests__/mocks/supabase";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => createMockSupabaseClient()),
}));

// tests use mockResolve/mockReject helpers from the mock chain
```

### Dashboard Page Pattern

```typescript
// Server component: src/app/dashboard/{feature}/page.tsx
// Fetches data server-side, passes to client component
// Client component: src/components/{feature}/{feature}-view.tsx
// Handles interactivity, real-time subscriptions
```

### Activity Log Convention

Every user/agent action writes to `activity_log` with:

- `workspace_id` — scoping
- `action` — dot-notation category (`agent.created`, `task.completed`, `policy.enforced`)
- `details` — JSON payload with full context

---

## Phase 1: Infrastructure & Security

**Priority:** Highest — other phases depend on this.
**Dependencies:** None. Starts first.

### 1.1 Row Level Security

Enable RLS on all tables. Currently no RLS is enforced — data isolation relies on application-level workspace scoping.

**Approach:**

Create a helper function that existing RLS policies reference:

```sql
-- Returns all workspace IDs the current user belongs to
CREATE OR REPLACE FUNCTION get_user_workspace_ids(user_id uuid)
RETURNS SETOF uuid AS $$
  SELECT workspace_id FROM workspace_members WHERE user_id = $1
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

**Tables with direct `workspace_id`** (simple policy):

- `workspaces`, `workspace_members`, `workspace_invitations`
- `agents`, `tasks`, `projects`, `activity_log`
- `notification_settings`, `webhook_deliveries`

```sql
-- Example for agents table
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_access" ON agents
  FOR ALL USING (
    workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))
  );
```

**Tables requiring join-based policies** (no direct `workspace_id`):

- `problems` — join through `agents.workspace_id`
- `project_agents` — join through `projects.workspace_id`
- `project_files` — join through `projects.workspace_id`
- `task_agents` — join through `tasks.workspace_id`
- `task_comments` — join through `tasks.workspace_id`
- `task_dependencies` — join through `tasks.workspace_id`
- `agent_updates` — join through `agents.workspace_id`

```sql
-- Example for problems (joins through agents)
ALTER TABLE problems ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_access" ON problems
  FOR ALL USING (
    agent_id IN (
      SELECT id FROM agents
      WHERE workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))
    )
  );
```

**Auth tables** (`user`, `account`, `session`, `verification`):

- Managed by better-auth, policies scope to `auth.uid()` only.

**Important:** `createAdminClient()` uses the service role key and bypasses RLS entirely. All 3 existing API routes use admin client, so they are unaffected. Dashboard server actions use `getAuthenticatedSupabase()` which respects RLS — this is the whole point.

**Testing:**

- Smoke test: user in workspace A cannot read workspace B agents
- Verify admin client still works for API routes
- Verify dashboard pages still load correctly

### 1.2 Agent Auto-Offline Detection

Currently, if an agent stops heartbeating, it stays in whatever health status it had. No automatic transition to `offline`.

**Approach:** Postgres function + pg_cron job.

```sql
-- Function: mark agents offline if last_seen_at > 5 minutes ago
CREATE OR REPLACE FUNCTION mark_stale_agents_offline()
RETURNS void AS $$
DECLARE
  stale_agent RECORD;
BEGIN
  FOR stale_agent IN
    SELECT id, workspace_id, name, health_status
    FROM agents
    WHERE health_status != 'offline'
      AND last_seen_at < now() - interval '5 minutes'
  LOOP
    -- Update agent
    UPDATE agents
    SET health_status = 'offline', updated_at = now()
    WHERE id = stale_agent.id;

    -- Log the transition
    INSERT INTO activity_log (workspace_id, action, details)
    VALUES (
      stale_agent.workspace_id,
      'agent.auto_offline',
      jsonb_build_object(
        'agent_id', stale_agent.id,
        'agent_name', stale_agent.name,
        'previous_status', stale_agent.health_status,
        'reason', 'no_heartbeat_5m'
      )
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- pg_cron: run every minute
SELECT cron.schedule('mark-stale-agents', '* * * * *', 'SELECT mark_stale_agents_offline()');
```

**Testing:**

- Agent with `last_seen_at` 6 minutes ago gets set to `offline`
- Agent with `last_seen_at` 2 minutes ago is untouched
- Transition logged to `activity_log`

### 1.3 Rate Limiting Middleware

New table + middleware to protect API routes from agent abuse.

**New table:**

```sql
CREATE TABLE agent_quotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES agents(id) ON DELETE CASCADE,  -- null = workspace default
  max_requests_per_minute int NOT NULL DEFAULT 60,
  max_requests_per_hour int NOT NULL DEFAULT 1000,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, agent_id)
);

CREATE INDEX idx_agent_quotas_workspace ON agent_quotas(workspace_id);
CREATE INDEX idx_agent_quotas_agent ON agent_quotas(agent_id);
ALTER TABLE agent_quotas ENABLE ROW LEVEL SECURITY;
```

**New files:**

`src/lib/rate-limiter.ts` — in-memory sliding window counter:

```typescript
interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number; // seconds
}

export function checkRateLimit(
  agentId: string,
  windowMs: number,
  maxRequests: number
): RateLimitResult;
```

`src/lib/api-rate-limit.ts` — wrapper for API routes:

```typescript
export function withRateLimit(
  handler: (req: Request) => Promise<Response>
): (req: Request) => Promise<Response>;
// Returns 429 with Retry-After header when limit exceeded
```

**Modified files:**

- `src/app/api/v1/tasks/route.ts` — wrap with `withRateLimit`
- `src/app/api/v1/tasks/[id]/complete/route.ts` — wrap with `withRateLimit`
- `src/app/api/v1/agents/heartbeat/route.ts` — wrap with `withRateLimit`

**Dashboard:** `src/components/agents/agent-quotas.tsx` for quota management UI, `src/app/dashboard/agents/quota-actions.ts` for CRUD server actions.

**Testing:**

- Agent under limit: request passes through
- Agent over limit: 429 with `Retry-After` header
- Workspace default applies when no agent-specific quota
- Dashboard CRUD for quotas

### Phase 1 — Definition of Done

- [ ] RLS enabled on all tables, cross-workspace access returns empty
- [ ] pg_cron marks stale agents offline within 1 minute
- [ ] Rate limiting returns 429 for over-quota agents
- [ ] All existing tests still pass
- [ ] Production build succeeds

---

## Phase 2: Webhook & Notification Pipeline

**Priority:** High — reliability features.
**Dependencies:** None. Can start parallel with Phase 1.

### 2.1 Webhook Retry System

Currently `dispatchToAgent()` in `src/lib/webhook-dispatch.ts` makes a single delivery attempt. Failed deliveries stay failed.

**Schema changes to `webhook_deliveries`:**

```sql
ALTER TABLE webhook_deliveries
  ADD COLUMN next_retry_at timestamptz,
  ADD COLUMN max_attempts int NOT NULL DEFAULT 5,
  ADD COLUMN attempt_count int NOT NULL DEFAULT 1;

CREATE INDEX idx_webhook_deliveries_retry
  ON webhook_deliveries(next_retry_at)
  WHERE status = 'failed' AND next_retry_at IS NOT NULL;
```

**Modified:** `src/lib/webhook-dispatch.ts` — on failure, set `next_retry_at` with exponential backoff:

```typescript
// Backoff schedule: 30s, 60s, 120s, 240s, 480s
const BACKOFF_SECONDS = [30, 60, 120, 240, 480];

function getNextRetryAt(attemptCount: number): Date | null {
  if (attemptCount >= BACKOFF_SECONDS.length) return null; // permanently failed
  return new Date(Date.now() + BACKOFF_SECONDS[attemptCount] * 1000);
}
```

**Edge Function:** `supabase/functions/webhook-retry/index.ts`

Runs via pg_cron every minute. Fetches failed deliveries where `next_retry_at <= now()`, re-attempts delivery with HMAC signing, updates `attempt_count` and `next_retry_at` or marks `permanently_failed`.

**Dashboard:** `src/components/settings/webhook-delivery-status.tsx` — shows delivery status, retry count, next retry time for recent deliveries.

**Testing:**

- Failed delivery gets `next_retry_at` set
- Retry succeeds: status updated to `delivered`
- Retry fails again: `next_retry_at` advances with backoff
- Max attempts exceeded: marked `permanently_failed`

### 2.2 Slack Auto-Notifications

Currently Slack is only used via manual "Test Webhook" in settings. Auto-notification on problem creation doesn't exist.

**Shared builder:** `src/lib/slack-messages.ts`

```typescript
export function buildProblemSlackMessage(problem: {
  title: string;
  severity: string;
  agent_name: string;
  task_title?: string;
  workspace_name: string;
  dashboard_url: string;
}): SlackMessagePayload;

export function buildTestSlackMessage(workspace_name: string): SlackMessagePayload;
```

Refactor existing `testSlackWebhook` in `src/app/dashboard/settings/actions.ts` to use `buildTestSlackMessage`.

**Edge Function:** `supabase/functions/slack-notify/index.ts`

Triggered by Postgres trigger on `problems` INSERT. Checks `notification_settings` for the workspace — verifies `slack_enabled` and that the problem severity meets the notification threshold.

```sql
-- Trigger on problems insert
CREATE OR REPLACE FUNCTION notify_problem_created()
RETURNS trigger AS $$
BEGIN
  PERFORM net.http_post(
    url := '<edge-function-url>/slack-notify',
    body := jsonb_build_object('problem_id', NEW.id)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_problem_created
  AFTER INSERT ON problems
  FOR EACH ROW EXECUTE FUNCTION notify_problem_created();
```

**Testing:**

- Problem insert with `slack_enabled = true` sends Slack message
- Problem insert with `slack_enabled = false` does nothing
- Severity below threshold is filtered out
- Shared builder produces valid Slack Block Kit payloads

### Phase 2 — Definition of Done

- [ ] Failed webhooks retry with exponential backoff (30s → 480s)
- [ ] Permanently failed deliveries stop retrying after max attempts
- [ ] Problem creation auto-notifies Slack when configured
- [ ] Existing test webhook action uses shared Slack builder
- [ ] All tests pass, production build succeeds

---

## Phase 3: Governance & Policy Engine

**Priority:** Medium-high — the governance layer from PRODUCT.md vision.
**Dependencies:** Phase 1 (RLS must be in place before new table migrations).

### 3.1 New Tables

```sql
-- Per-agent permissions (allow/deny controls)
CREATE TABLE agent_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  permission_type text NOT NULL CHECK (permission_type IN ('allow', 'deny')),
  action_whitelist jsonb, -- allowed task types/actions when type='allow'
  reason text,
  created_by uuid REFERENCES "user"(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, agent_id)
);

-- Workspace/agent policies (approval gates, execution boundaries)
CREATE TABLE agent_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES agents(id) ON DELETE CASCADE, -- null = workspace-wide
  policy_type text NOT NULL CHECK (policy_type IN (
    'approval_required', 'max_concurrent_tasks', 'allowed_hours', 'blocked_actions'
  )),
  config jsonb NOT NULL DEFAULT '{}',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Task-level approval checkpoints
CREATE TABLE approval_gates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  policy_id uuid REFERENCES agent_policies(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES "user"(id),
  reviewed_at timestamptz,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Token/cost tracking per agent per task
CREATE TABLE cost_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  model text,
  operation text, -- 'completion', 'embedding', etc.
  input_tokens int NOT NULL DEFAULT 0,
  output_tokens int NOT NULL DEFAULT 0,
  cost_usd numeric(10, 6) NOT NULL DEFAULT 0,
  reported_at timestamptz NOT NULL DEFAULT now()
);

-- Budget caps per workspace or agent
CREATE TABLE budget_caps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES agents(id) ON DELETE CASCADE, -- null = workspace-wide
  max_cost_usd numeric(10, 2) NOT NULL,
  period text NOT NULL CHECK (period IN ('daily', 'monthly')),
  current_spend numeric(10, 6) NOT NULL DEFAULT 0,
  period_start timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, agent_id, period)
);

-- Indexes
CREATE INDEX idx_agent_permissions_workspace ON agent_permissions(workspace_id);
CREATE INDEX idx_agent_permissions_agent ON agent_permissions(agent_id);
CREATE INDEX idx_agent_policies_workspace ON agent_policies(workspace_id);
CREATE INDEX idx_agent_policies_agent ON agent_policies(agent_id);
CREATE INDEX idx_approval_gates_task ON approval_gates(task_id);
CREATE INDEX idx_approval_gates_status ON approval_gates(status) WHERE status = 'pending';
CREATE INDEX idx_cost_tracking_workspace ON cost_tracking(workspace_id);
CREATE INDEX idx_cost_tracking_agent ON cost_tracking(agent_id);
CREATE INDEX idx_cost_tracking_reported ON cost_tracking(reported_at);
CREATE INDEX idx_budget_caps_workspace ON budget_caps(workspace_id);

-- RLS on all new tables
ALTER TABLE agent_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_gates ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_caps ENABLE ROW LEVEL SECURITY;
```

### 3.2 Policy Engine

`src/lib/policy-engine.ts`:

```typescript
interface PolicyCheckResult {
  allowed: boolean;
  reason?: string;
  approval_gate_id?: string; // when approval_required
  http_status: 200 | 202 | 403;
}

export async function checkAgentPolicy(
  supabase: SupabaseClient,
  agentId: string,
  workspaceId: string,
  action: string, // e.g. 'task.complete'
  context?: { taskId?: string }
): Promise<PolicyCheckResult>;

// Check order:
// 1. agent_permissions — deny = immediate 403
// 2. budget_caps — exceeded = 403 with 'budget_exceeded' reason
// 3. agent_policies — approval_required = 202 + create approval_gate row
// 4. All clear = 200
```

**Integration point:** `src/app/api/v1/tasks/[id]/complete/route.ts` — call `checkAgentPolicy()` before processing completion. If 202, create approval gate and return "awaiting approval". If 403, reject.

### 3.3 Cost Tracking API

`src/app/api/v1/cost/report/route.ts`:

```typescript
// POST /api/v1/cost/report
// Body: { model, operation, input_tokens, output_tokens, cost_usd, task_id? }
// Agent-authenticated, rate limited
// Inserts into cost_tracking, updates budget_caps.current_spend
```

Budget enforcement: policy engine checks `budget_caps` for the agent and workspace before allowing task dispatch. If `current_spend >= max_cost_usd`, return 403 with `budget_exceeded`.

### 3.4 Dashboard

New page: `/dashboard/governance`

- **Policy list** — `src/components/governance/policy-list.tsx` — CRUD for agent policies
- **Approval queue** — `src/components/governance/approval-queue.tsx` — pending approval gates with approve/reject
- **Cost overview** — `src/components/governance/cost-overview.tsx` — budget usage bars, per-agent spending, alerts at 80%/90%/100%

Server actions: `src/app/dashboard/governance/actions.ts`

### Phase 3 — Definition of Done

- [ ] Agent with `deny` permission gets 403 on task complete
- [ ] Agent with `approval_required` policy gets 202, gate created
- [ ] Approval gate approve → agent can proceed; reject → agent gets 403
- [ ] Cost reporting API accepts token usage from agents
- [ ] Budget cap blocks task dispatch when exceeded (403 `budget_exceeded`)
- [ ] Governance dashboard shows policies, approval queue, cost overview
- [ ] All tests pass, production build succeeds

---

## Phase 4: Coordination & Communication

**Priority:** Medium — extends the multi-agent coordination story.
**Dependencies:** Phase 1 (RLS). Soft dependency on Phase 2 (Slack for escalation actions).

### 4.1 New Tables

```sql
-- Agent-to-agent messaging
CREATE TABLE agent_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  from_agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  to_agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  content_type text NOT NULL DEFAULT 'text' CHECK (content_type IN ('text', 'delegation', 'status_update')),
  content jsonb NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Project shared state (key-value with optimistic concurrency)
CREATE TABLE project_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  key text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}',
  version int NOT NULL DEFAULT 1,
  updated_by_agent_id uuid REFERENCES agents(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, key)
);

-- Escalation rules
CREATE TABLE escalation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  condition_type text NOT NULL CHECK (condition_type IN (
    'agent_critical_duration', 'agent_offline_duration', 'task_stuck_duration'
  )),
  condition_config jsonb NOT NULL, -- { threshold_minutes: 5, agent_id?: uuid }
  action_type text NOT NULL CHECK (action_type IN ('reassign_tasks', 'notify_slack')),
  action_config jsonb NOT NULL DEFAULT '{}',
  cooldown_minutes int NOT NULL DEFAULT 30,
  last_triggered_at timestamptz,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_agent_messages_to ON agent_messages(to_agent_id, read_at);
CREATE INDEX idx_agent_messages_workspace ON agent_messages(workspace_id);
CREATE INDEX idx_project_state_project ON project_state(project_id);
CREATE INDEX idx_escalation_rules_workspace ON escalation_rules(workspace_id);

-- RLS
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalation_rules ENABLE ROW LEVEL SECURITY;
```

### 4.2 Messaging API

`src/app/api/v1/messages/route.ts`:

```typescript
// POST /api/v1/messages — send a message
// Body: { to_agent_id, content_type, content }
// Agent-authenticated, workspace-scoped, rate limited

// GET /api/v1/messages — receive messages
// Query: ?unread=true&limit=10
// Returns messages addressed to the authenticated agent
```

`src/app/api/v1/messages/[id]/read/route.ts`:

```typescript
// POST /api/v1/messages/{id}/read — mark message as read
// Sets read_at timestamp
```

**Structured delegation:** When `content_type = 'delegation'`, the `content` JSON follows a schema:

```typescript
interface DelegationMessage {
  task_id: string;
  instructions: string;
  expected_output?: Record<string, unknown>; // JSON schema
  deadline?: string; // ISO timestamp
}
```

This makes delegation a first-class protocol rather than free-text messaging.

### 4.3 Shared State API

`src/app/api/v1/projects/[id]/state/route.ts`:

```typescript
// GET /api/v1/projects/{id}/state?key=some_key
// Returns { key, value, version }

// PUT /api/v1/projects/{id}/state
// Body: { key, value, expected_version }
// Optimistic concurrency: returns 409 if version mismatch
```

Agents must be members of the project (`project_agents` table) to read/write state.

### 4.4 Escalation Engine

Edge Function: `supabase/functions/escalation-engine/index.ts`

Runs via pg_cron every minute. For each enabled `escalation_rule`:

1. Evaluate condition (e.g., "agent X has been critical for >5 minutes")
2. Check cooldown (`last_triggered_at + cooldown_minutes > now()` → skip)
3. Execute action (`reassign_tasks` or `notify_slack`)
4. Update `last_triggered_at`
5. Log to `activity_log`

```typescript
type EscalationCondition =
  | { type: "agent_critical_duration"; threshold_minutes: number; agent_id?: string }
  | { type: "agent_offline_duration"; threshold_minutes: number; agent_id?: string }
  | { type: "task_stuck_duration"; threshold_minutes: number; status?: string };

type EscalationAction =
  | { type: "reassign_tasks"; target_agent_id?: string } // null = unassign
  | { type: "notify_slack" }; // uses workspace notification_settings
```

`src/lib/escalation-types.ts` — shared type definitions for conditions and actions.

### 4.5 Dashboard

- `/dashboard/messages` — `src/app/dashboard/messages/page.tsx` + `src/components/messages/message-feed.tsx` — real-time message feed across workspace agents
- Project detail page — add project state viewer component showing current key-value pairs
- Settings page — add escalation rules management UI

**Fleet dashboard metric:** "coordination graph depth" — SQL query that computes average delegation chain length:

```sql
-- Average depth of delegation messages per active project
SELECT AVG(depth) FROM (
  SELECT p.id, COUNT(DISTINCT am.id) as depth
  FROM projects p
  LEFT JOIN agent_messages am ON am.workspace_id = p.workspace_id
    AND am.content_type = 'delegation'
    AND am.created_at > now() - interval '7 days'
  WHERE p.status = 'active'
  GROUP BY p.id
) sub;
```

### Phase 4 — Definition of Done

- [ ] Agent sends message to another agent via API, receiver reads it
- [ ] Delegation messages carry structured payload with task context
- [ ] Project state read/write works with optimistic concurrency (409 on version mismatch)
- [ ] Escalation rule fires when condition met (e.g., agent critical >5 min)
- [ ] Cooldown prevents escalation spam
- [ ] Messages page shows real-time message feed
- [ ] Coordination graph depth metric visible on fleet dashboard
- [ ] All tests pass, production build succeeds

---

## Dependency Graph

```
Phase 1 (Infra & Security) ───────┐     Phase 2 (Webhooks & Notifications) ──┐
  1.1 RLS policies (FIRST)        │       2.1 Webhook retries                 │
  1.2 Auto-offline detection      │       2.2 Slack auto-notifications        │
  1.3 Rate limiting               │                                           │
                                  ▼                                           ▼
Phase 3 (Governance) ◄── needs RLS      Phase 4 (Coordination) ◄── needs RLS + Slack
  3.1 Permission/policy tables             4.1 Message/state/escalation tables
  3.2 Policy engine                        4.2 Messaging API
  3.3 Cost tracking + budgets              4.3 Shared state API
  3.4 Governance dashboard                 4.4 Escalation engine
                                           4.5 Coordination dashboard
```

**Phases 1 + 2** have no dependencies and can start in parallel.
**Phase 3** needs Phase 1 RLS before applying new table migrations.
**Phase 4** needs Phase 1 RLS + Phase 2 Slack (for escalation `notify_slack` action).

Design work for Phases 3 + 4 can begin immediately — only the migrations and integration need to wait.

---

## File Inventory Summary

When all 4 phases ship:

| Category                | Count | Details                                                                                                                                      |
| ----------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| New database tables     | 8     | agent_quotas, agent_permissions, agent_policies, approval_gates, cost_tracking, budget_caps, agent_messages, project_state, escalation_rules |
| New Edge Functions      | 3     | webhook-retry, slack-notify, escalation-engine                                                                                               |
| New source files        | ~15   | lib, API routes, server actions, components                                                                                                  |
| New test files          | ~12   | colocated with source files                                                                                                                  |
| Modified existing files | 5     | 3 API routes, webhook-dispatch, settings actions                                                                                             |
| Regenerated             | 1     | database.types.ts                                                                                                                            |

---

## Verification Checklist

After all 4 phases are complete:

- [ ] `npm run test` — all tests pass
- [ ] `npm run build` — production build succeeds
- [ ] `database.types.ts` regenerated with all new tables
- [ ] RLS smoke test: cross-workspace access returns empty results
- [ ] Stale agent auto-marked offline by pg_cron
- [ ] Failed webhook retried with exponential backoff
- [ ] Problem creation triggers Slack auto-notification
- [ ] Policy check returns 403/202 on restricted agents
- [ ] Budget cap blocks task dispatch when exceeded (403 `budget_exceeded`)
- [ ] Agent sends/receives messages via API
- [ ] Project state read/write with optimistic concurrency
- [ ] Escalation rule fires on threshold breach
- [ ] Rate limited agent gets 429 with `Retry-After`
- [ ] Coordination graph depth metric visible on fleet dashboard
