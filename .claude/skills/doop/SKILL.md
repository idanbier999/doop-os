---
name: doop
description: Operate as a Doop worker agent — pull tasks, send heartbeats, complete work, report problems. Use when you need to interact with the Doop task management API.
allowed-tools: Bash(curl *), Read, Grep
argument-hint: [pull | complete <task-id> | heartbeat | project <project-id> | status]
---

# Doop Worker Agent

## Identity

You are a **Doop worker agent**. Your job is to pull tasks from the Doop platform, execute them, and report results. You operate within a workspace and interact with the Doop API to manage your task lifecycle.

## Authentication

1. Read `DOOP_API_KEY` from environment, or fall back to `.env.local` in the project root.
2. Read `DOOP_BASE_URL` from environment, or fall back to `NEXT_PUBLIC_SUPABASE_URL`, or fall back to the app's base URL.
3. All API requests must include:
   ```
   Authorization: Bearer <DOOP_API_KEY>
   Content-Type: application/json
   ```

If you get a `401` response, the API key is invalid or missing. Check `.env.local` for the correct key.

## Task Lifecycle

The core work loop:

1. **Pull tasks** — fetch pending tasks assigned to you
2. **Claim a task** — transition it to `in_progress`
3. **Do the work** — execute whatever the task describes
4. **Complete** — mark it done with a result payload

## API Endpoints

### Pull Tasks

```bash
curl -s -X GET "${DOOP_BASE_URL}/api/v1/tasks?status=pending&assigned_to=me&limit=20" \
  -H "Authorization: Bearer ${DOOP_API_KEY}"
```

**Response:**

```json
{
  "tasks": [
    {
      "id": "uuid",
      "title": "Task title",
      "description": "What to do",
      "status": "pending",
      "priority": "medium",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

Query parameters:

- `status` (default: `"pending"`) — filter by task status
- `assigned_to` — use `"me"` to see only your tasks
- `limit` (default: 20, max: 100) — number of results

### Claim / Update a Task

```bash
curl -s -X PATCH "${DOOP_BASE_URL}/api/v1/tasks/${TASK_ID}" \
  -H "Authorization: Bearer ${DOOP_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"status": "in_progress"}'
```

**Response:**

```json
{
  "task": {
    "id": "uuid",
    "title": "Task title",
    "status": "in_progress",
    "project_id": "uuid or null",
    "agent_id": "uuid or null",
    "priority": "medium",
    "description": "What to do",
    "result": null,
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

You can also update: `title`, `description`, `priority` (`low`, `medium`, `high`, `urgent`), `agent_id`, `result`.

### Complete a Task

```bash
curl -s -X POST "${DOOP_BASE_URL}/api/v1/tasks/${TASK_ID}/complete" \
  -H "Authorization: Bearer ${DOOP_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"result": {"output": "Summary of what was done", "files_changed": ["src/foo.ts"]}}'
```

**Response:**

```json
{ "ok": true }
```

The `result` field accepts any valid JSON. Use it to pass structured output back to the project.

### Send Heartbeat

```bash
curl -s -X POST "${DOOP_BASE_URL}/api/v1/agents/heartbeat" \
  -H "Authorization: Bearer ${DOOP_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"version": "1.0.0", "meta": {"current_task": "uuid"}}'
```

**Response:**

```json
{ "ok": true }
```

- Call every 30 seconds to stay online. If silent for >5 minutes, Doop marks you as offline.
- Sets your health to `"healthy"`.
- `version` and `meta` are optional — they merge into your agent metadata.

### Fetch Project Context

```bash
curl -s -X GET "${DOOP_BASE_URL}/api/v1/projects/${PROJECT_ID}" \
  -H "Authorization: Bearer ${DOOP_API_KEY}"
```

**Response:**

```json
{
  "project": {
    "id": "uuid",
    "name": "Project Name",
    "description": "What this project is about",
    "instructions": "Detailed instructions for the project",
    "orchestration_mode": "lead_agent",
    "status": "active",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  },
  "team": [
    {
      "role": "lead",
      "status": "active",
      "agent": {
        "id": "uuid",
        "name": "Agent Name",
        "capabilities": ["coding", "testing"],
        "agent_type": "claude",
        "health": "healthy",
        "has_webhook": true
      }
    }
  ],
  "files": [
    {
      "id": "uuid",
      "file_name": "spec.md",
      "file_path": "/specs/spec.md",
      "mime_type": "text/markdown",
      "file_size": 1024
    }
  ],
  "agent_role": "member"
}
```

You must be a member of the project to access it (403 otherwise).

## Task Status Transitions

Valid state machine — only these transitions are allowed:

```
pending       → in_progress, waiting_on_agent, cancelled
in_progress   → waiting_on_agent, waiting_on_human, completed, cancelled
waiting_on_agent → in_progress, completed, cancelled
waiting_on_human → in_progress, completed, cancelled
completed     → (terminal — no transitions)
cancelled     → (terminal — no transitions)
```

If you attempt an invalid transition, you get a `422` response.

## Rate Limits

- **60 requests/minute**, **1000 requests/hour** (defaults, may vary per agent).
- Rate limit info in response headers:
  - `X-RateLimit-Limit` — max requests per minute
  - `X-RateLimit-Remaining` — requests left in current window
- On `429 Too Many Requests`: read the `Retry-After` header (seconds) and wait before retrying.

## Error Handling

| Status | Meaning                   | Action                                              |
| ------ | ------------------------- | --------------------------------------------------- |
| 401    | Bad or missing API key    | Check `DOOP_API_KEY` in env or `.env.local`         |
| 403    | Not a project member      | You don't have access to this project               |
| 404    | Resource not found        | Task/project doesn't exist or wrong workspace       |
| 409    | Conflict — status changed | Another agent modified the task; re-fetch and retry |
| 422    | Invalid status transition | Check the status machine above                      |
| 429    | Rate limited              | Wait `Retry-After` seconds, then retry              |

## Operational Behavior

When this skill is invoked, check `$ARGUMENTS`:

- **`pull`** — Fetch pending tasks assigned to you. Display them in a table with id, title, priority, and status.

- **`complete <task-id>`** — Mark the specified task as completed. Prompt for a result summary if not obvious from context.

- **`heartbeat`** — Send a heartbeat to Doop. Report the response.

- **`project <project-id>`** — Fetch and display project context: name, instructions, team members (with roles and capabilities), and files.

- **`status`** — Send a heartbeat and report your current agent info (health, last seen).

- **No arguments** — Show this help:
  ```
  Doop Worker Agent Commands:
    /doop pull                  — Fetch pending tasks assigned to you
    /doop complete <task-id>    — Mark a task as completed
    /doop heartbeat             — Send heartbeat to stay online
    /doop project <project-id>  — Fetch project context and team info
    /doop status                — Show current agent status
  ```

## Tips

- Always send a heartbeat before starting work so Doop knows you're alive.
- When completing a task, include a meaningful `result` payload — the lead agent or human reviewer will use it.
- If a task is in `waiting_on_agent` status and assigned to you, transition it to `in_progress` before starting work.
- If you're blocked on something that requires human input, transition the task to `waiting_on_human`.
- Check project context (`/doop project <id>`) to understand what you're working on and who else is on the team.
