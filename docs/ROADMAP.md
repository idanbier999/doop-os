# Doop Roadmap: Agent Ownership & Fleet Operations

> **Status**: Planning
> **Last updated**: 2026-03-06

Doop is an agent-native platform — "Datadog for AI agents." It works alongside Jira/Monday/Asana, not replacing them. Humans are **operators** who deploy, monitor, and maintain their agents. The platform needs to support orgs where multiple people each bring their own agents, and leadership needs visibility across the full fleet.

**Today**: All agents are workspace-scoped. Everyone sees everything. No concept of "who operates this agent." No per-operator views. No operator-specific alerts.

**Goal**: Add agent ownership so operators see their fleet, get alerts for their agents, and leadership sees fleet performance across all operators. No human task management.

---

## Dependency Graph

```
Phase 1A (migration: owner_id)         Phase 1B (migration: workspace context)
  |                                       |
  v                                       v
Phase 2 (backend ownership)             Phase 7 (workspace context features)
  |
  +---> Phase 3 (fleet scope UI)
  |       |
  |       +---> Phase 4 (permissions)
  |       +---> Phase 6 (org overview)
  |
  +---> Phase 5 (operator alerts)
```

The two tracks are fully independent:

- **Ownership track** (1A -> 2 -> 3/4/5/6): Can ship without workspace context
- **Context track** (1B -> 7): Can ship without ownership

---

## Phase 1A: Database Migration — Agent Ownership

Separate migration from workspace context for clean git history and independent rollback.

### 1A.1 Add `owner_id` to agents table

```sql
ALTER TABLE agents
  ADD COLUMN owner_id text REFERENCES "user"(id) ON DELETE SET NULL;

CREATE INDEX idx_agents_owner_id ON agents(owner_id);
CREATE INDEX idx_agents_workspace_owner ON agents(workspace_id, owner_id);
```

- Nullable — existing agents remain `owner_id = null` (backward compatible)
- `ON DELETE SET NULL` — if user removed, agent becomes unowned
- `text` type matches Better Auth `user.id` column type

### 1A.2 Regenerate database types

Run Supabase type generation to update `src/lib/database.types.ts`. The `agents` Row/Insert/Update types will gain `owner_id: string | null`.

### Verification

- Existing agents have `owner_id = null`
- TypeScript compiles with no errors
- All existing tests pass (no breaking change)

---

## Phase 1B: Database Migration — Workspace Context

Independent migration, can ship separately from 1A.

### 1B.1 Add context fields to workspaces

```sql
ALTER TABLE workspaces
  ADD COLUMN description text,
  ADD COLUMN context text;
```

### 1B.2 Regenerate database types

### Verification

- `SELECT description, context FROM workspaces LIMIT 1` — both null

---

## Phase 2: Backend — Ownership in Server Actions

### 2.1 Set `owner_id` on agent creation

**File**: `src/app/dashboard/agents/actions.ts` — `createAgent()`

Add `owner_id: user.id` to the `.insert()` call. Also add to activity log details.

### 2.2 New server action: `reassignAgentOwner()`

**File**: `src/app/dashboard/agents/actions.ts` (add to existing file)

```typescript
export async function reassignAgentOwner(
  agentId: string,
  workspaceId: string,
  newOwnerId: string | null
);
```

- Auth: caller must be agent's current owner OR workspace admin/owner
- Validates `newOwnerId` is a workspace member (if not null)
- Updates `agents.owner_id`
- Logs `agent.owner_reassigned` to activity_log with `{ agent_id, previous_owner_id, new_owner_id }`

### 2.3 Update agent queries to include `owner_id`

All existing `.select()` calls on agents need `owner_id` added:

| File                                     | Change                         |
| ---------------------------------------- | ------------------------------ |
| `src/app/dashboard/page.tsx`             | Add `owner_id` to agent select |
| `src/app/dashboard/agents/page.tsx`      | Add `owner_id` to agent select |
| `src/app/dashboard/agents/[id]/page.tsx` | Add `owner_id` to agent select |
| `src/app/dashboard/problems/page.tsx`    | Add `owner_id` to agent select |

### 2.4 Fetch workspace members for owner resolution

Several pages will need to resolve `owner_id` to a display name. Add a helper query in the server components:

```typescript
const { data: members } = await supabase
  .from("workspace_members")
  .select("user_id, user:user!workspace_members_user_id_fkey(name, email)")
  .eq("workspace_id", workspaceId);
```

Build a `memberMap: Record<string, { name: string; email: string }>` and pass to client components.

### 2.5 Update tests

**File**: `src/app/dashboard/agents/actions.test.ts`

- Verify `owner_id: user.id` in insert call
- Add tests for `reassignAgentOwner` (auth checks, validation, success)

---

## Phase 3: Fleet Scope Toggle (My Fleet / All Fleet)

### 3.1 Extend WorkspaceContext

**File**: `src/contexts/workspace-context.tsx`

```typescript
interface WorkspaceContextValue {
  workspaceId: string;
  userId: string;
  userRole: string;
  fleetScope: "mine" | "all";
  setFleetScope: (scope: "mine" | "all") => void;
}
```

- Default: `"mine"` for all roles (operator-first experience)
- All roles can toggle to `"all"` for read-only visibility of the full fleet
- Edit/delete permissions are still governed by Phase 4 (ownership check), not by scope

### 3.2 Add toggle to sidebar

**File**: `src/components/layout/sidebar.tsx`

Add a small `[My Fleet] / [All Fleet]` segmented toggle between nav items and footer. Visible to all roles. Uses pixel font styling to match existing design.

### 3.3 Fleet overview page — scope filtering

**File**: `src/app/dashboard/page.tsx`

- Pass `memberMap` (owner_id -> name) to client components

**File**: `src/components/fleet/fleet-stats-bar.tsx`

- Use `fleetScope` and `userId` from `useWorkspace()`
- Accept `agents` prop (with `owner_id`) instead of pre-computed counts
- Compute counts client-side, filtering by `owner_id === userId` when scope is `"mine"`

**File**: `src/components/fleet/agent-health-grid.tsx`

- Use `fleetScope` and `userId` from `useWorkspace()`
- Filter `agents` by `owner_id === userId` when scope is `"mine"`
- Show owner name badge on each card when scope is `"all"` (accept `memberMap` prop)
- Update card title: "My Fleet" vs "Agent Fleet"

### 3.4 Agents list page — scope filtering

**File**: `src/app/dashboard/agents/page.tsx`

- Pass `memberMap` to client

**File**: `src/components/agents/agents-page-client.tsx`

- Filter agents by `fleetScope` from context
- In "all" mode for owner/admin: add "Operator" filter dropdown
- Show operator name on agent cards in "all" mode

### 3.5 Problems page — scope filtering

**File**: `src/app/dashboard/problems/page.tsx`

- Add `owner_id` to the agent select: `.select("id, name, owner_id")`
- Build `myAgentIds = agents.filter(a => a.owner_id === user.id).map(a => a.id)`
- Pass both `agents` (with owner_id) and `myAgentIds` to `ProblemsTable`

**File**: `src/components/problems/problems-table.tsx`

- Accept `myAgentIds: string[]` prop
- When `fleetScope === "mine"`, filter `problems.filter(p => myAgentIds.includes(p.agent_id))`
- In "all" mode: show operator column

### 3.6 Activity page — scope filtering

**File**: `src/app/dashboard/activity/page.tsx`

- Pass agent ownership data
- Filter activity entries by user's agent IDs when scope is `"mine"`

---

## Phase 4: Permission Scoping

### 4.1 Agent settings — ownership-based permissions

**File**: `src/components/settings/agents-settings.tsx`

- Use `userId` and `userRole` from `useWorkspace()`
- For each agent row, compute `canEdit = userRole !== "member" || agent.owner_id === userId`
- Disable Edit buttons (tags, webhook, capabilities) when `!canEdit`
- Hide Delete button when `!canEdit`
- Add "Owner" column showing operator name (or "Unassigned")
- Add "Reassign" button (owner/admin only) that opens a dropdown of workspace members

### 4.2 Agent detail page — show operator

**File**: `src/app/dashboard/agents/[id]/page.tsx`

- Fetch agent's owner name, pass to StatusHeader

**File**: `src/components/agents/status-header.tsx`

- Accept `ownerName?: string` prop
- Show "Operated by: {name}" or "Unassigned" in metadata area

---

## Phase 5: Operator Alerts

### 5.1 Scope existing problem alerts by ownership

**File**: `src/contexts/notification-context.tsx`

Current behavior: toast on any high/critical problem in workspace.
New behavior:

- If agent owned by current user -> always show toast
- If agent NOT owned by current user -> only show when `fleetScope === "all"`

### 5.2 Add agent-offline alert

Same file — add a second Realtime subscription on `agents` UPDATE:

```typescript
// When agent health transitions to "offline"
if (oldHealth !== "offline" && newHealth === "offline" && newAgent.owner_id === userId) {
  addToast({ type: "warning", title: `Agent offline: ${agentName}`, ... });
}
```

### 5.3 Add task-failure alert for operator's agents

Same file — subscribe to `tasks` UPDATE:

```typescript
// When a task on user's agent gets cancelled
if (task.status === "cancelled" && task.agent_id) {
  // Lookup agent ownership, toast if owner_id === userId
}
```

### 5.4 Update activity categories

**File**: `src/lib/activity-categories.ts`

Add `"agent.owner_reassigned"` to `agent_lifecycle` category.

---

## Phase 6: Org Fleet Overview for Leadership

### 6.1 Per-operator summary component

**File**: `src/components/fleet/operator-fleet-summary.tsx` (NEW)

A table showing per-operator breakdown, only visible to owner/admin in "All Fleet" mode:

```
[Operator Name]  [4 agents]  [3 healthy / 1 offline]  [12 tasks/7d]  [2 problems]
[Unassigned]     [2 agents]  [1 healthy / 1 offline]  [3 tasks/7d]   [0 problems]
```

Clicking an operator row filters the AgentHealthGrid to show only that operator's agents (local `selectedOperator` state, not the global `fleetScope`).

### 6.2 Integrate into fleet page

**File**: `src/app/dashboard/page.tsx`

- Compute per-operator stats from the agents array
- Pass `operatorStats` + `memberMap` to the new component
- Render between FleetStatsBar and AgentHealthGrid (only for owner/admin in "all" scope)

---

## Phase 7: Workspace Context — Shared Org Knowledge

Today all context is project-scoped (instructions, files, team). There's no workspace-level context that agents automatically receive. This phase adds org-level shared knowledge via text fields.

### 7.1 Database

Uses migration 1B (already defined above): `workspaces.description` + `workspaces.context`.

### 7.2 Onboarding: Collect org context (optional step)

**File**: `src/app/onboarding/page.tsx`

Add an optional step between "Create Workspace" and "Connect Agent":

**"Tell us about your org"** (skippable)

- `description` textarea — "What does your org do?"
- `context` textarea — "Any instructions or context all agents should know?"

### 7.3 Settings: Edit workspace context

**File**: `src/components/settings/workspace-settings.tsx`

Currently only allows editing `name` and `slug`. Add:

- `description` textarea
- `context` textarea (markdown supported)

### 7.4 Inject workspace context into agent payloads

**File**: `src/lib/task-delivery.ts` — `deliverTaskToAgent()`

When building the webhook payload, fetch and include workspace context:

```typescript
const { data: workspace } = await supabase
  .from("workspaces")
  .select("description, context")
  .eq("id", agent.workspace_id)
  .single();

const payload = {
  event: "task.assigned",
  workspace: workspace ? { description: workspace.description, context: workspace.context } : null,
  task: { ... },
  project: { ... },
  agent: { ... },
};
```

**File**: `src/app/dashboard/projects/actions.ts` — `launchProject()`

Same — include workspace context in the `project.launched` payload.

### 7.5 API endpoint: GET workspace context for agents

**File**: `src/app/api/v1/workspace/route.ts` (NEW)

Agents can fetch workspace context on demand:

```
GET /api/v1/workspace
Authorization: Bearer <agent-api-key>
```

Returns:

```json
{
  "workspace": {
    "name": "Acme Corp",
    "description": "We build...",
    "context": "Coding standards: ..."
  }
}
```

Auth: agent's `workspace_id` from api_key lookup. Rate limited.

### 7.6 Update API docs

**File**: `src/app/dashboard/docs/page.tsx`

Document the new `GET /api/v1/workspace` endpoint and the workspace context fields in webhook payloads.

---

## Files Summary

### New files (4)

| File                                              | Purpose                                                                                   |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `src/components/fleet/operator-fleet-summary.tsx` | Per-operator stats table for leadership                                                   |
| `src/app/api/v1/workspace/route.ts`               | GET workspace context endpoint for agents                                                 |
| `src/app/api/v1/workspace/route.test.ts`          | Tests for workspace context endpoint                                                      |
| Supabase migrations (2)                           | Migration 1A: `owner_id` on agents. Migration 1B: `description` + `context` on workspaces |

### Modified files (21)

| File                                             | Change                                               |
| ------------------------------------------------ | ---------------------------------------------------- |
| `src/lib/database.types.ts`                      | Regenerated (auto)                                   |
| `src/app/dashboard/agents/actions.ts`            | `owner_id` in insert + `reassignAgentOwner` action   |
| `src/app/dashboard/agents/actions.test.ts`       | Tests for ownership                                  |
| `src/contexts/workspace-context.tsx`             | Add `fleetScope` + `setFleetScope`                   |
| `src/contexts/workspace-context.test.tsx`        | Update tests                                         |
| `src/components/layout/sidebar.tsx`              | Fleet scope toggle                                   |
| `src/app/dashboard/page.tsx`                     | `owner_id` in select + operator stats + memberMap    |
| `src/components/fleet/fleet-stats-bar.tsx`       | Scope-aware stats                                    |
| `src/components/fleet/agent-health-grid.tsx`     | Scope-aware grid + owner badge                       |
| `src/app/dashboard/agents/page.tsx`              | `owner_id` in select + memberMap                     |
| `src/components/agents/agents-page-client.tsx`   | Scope filter + operator filter                       |
| `src/components/settings/agents-settings.tsx`    | Permission scoping + owner column                    |
| `src/app/dashboard/agents/[id]/page.tsx`         | `owner_id` in select + pass to header                |
| `src/components/agents/status-header.tsx`        | Show operator name                                   |
| `src/contexts/notification-context.tsx`          | Ownership-scoped alerts                              |
| `src/lib/activity-categories.ts`                 | Add `agent.owner_reassigned`                         |
| `src/app/dashboard/problems/page.tsx`            | Pass ownership data                                  |
| `src/app/dashboard/activity/page.tsx`            | Pass ownership data                                  |
| `src/app/onboarding/page.tsx`                    | Add optional org context step                        |
| `src/components/settings/workspace-settings.tsx` | Add description + context fields                     |
| `src/lib/task-delivery.ts`                       | Include workspace context in webhook payloads        |
| `src/app/dashboard/projects/actions.ts`          | Include workspace context in launch payload          |
| `src/app/dashboard/docs/page.tsx`                | Document workspace context endpoint + payload fields |

---

## Risk Mitigation

1. **No breaking changes**: `owner_id` is nullable. All existing queries/tests unaffected until we add filtering.
2. **Agent API untouched**: Agent-facing routes (`/v1/tasks`, `/v1/agents/heartbeat`) use `api_key` auth and `createAdminClient()`. They never reference `owner_id`.
3. **Client-side filtering**: Agent counts are small (tens to low hundreds per workspace), so filtering in client components is fine. No need for server-side re-fetch on scope change.
4. **Realtime**: Supabase Realtime doesn't filter by column values before delivery. We filter in the callback handler (existing pattern in this codebase).
5. **Backward compatible**: Existing agents with `owner_id = null` show as "Unassigned" and are visible to everyone.
6. **API-registered agents**: Agents created through external APIs (not the dashboard) will have `owner_id = null`. They show as "Unassigned" in the fleet and are visible in "All Fleet" view. Owner/admin can claim them via the "Reassign" button.
7. **Scale note**: As workspace size grows, receiving all Realtime events and filtering client-side could become noisy. If this becomes an issue later, Supabase RLS + Realtime integration can filter server-side.

---

## Verification Checklist

- [ ] **DB**: `SELECT owner_id FROM agents LIMIT 5` — all null for existing agents
- [ ] **Create agent**: New agent gets `owner_id = current user`
- [ ] **My Fleet toggle**: All roles can toggle; member sees scoped view by default
- [ ] **Stats scoped**: FleetStatsBar counts change when toggling scope
- [ ] **Permissions**: Member can't edit/delete another operator's agent in settings
- [ ] **Alerts**: Agent goes offline -> only its operator gets toast
- [ ] **Org overview**: Owner sees per-operator breakdown in "All Fleet"; click row filters grid
- [ ] **Workspace context**: Set description + context in settings -> create task -> webhook payload includes workspace context
- [ ] **Onboarding**: New workspace -> optional org context step -> data saved
- [ ] **Tests**: `npm test` passes — all existing + new tests
- [ ] **Deploy**: `npm run build` passes with no TypeScript errors
