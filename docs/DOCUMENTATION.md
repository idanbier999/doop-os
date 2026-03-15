# Doop Documentation

> The execution control layer for AI workforces.

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Core Concepts](#core-concepts)
4. [Authentication](#authentication)
5. [Agent Lifecycle](#agent-lifecycle)
6. [Task Lifecycle](#task-lifecycle)
7. [Project Orchestration](#project-orchestration)
8. [API Reference](#api-reference)
9. [Webhooks](#webhooks)
10. [Rate Limiting](#rate-limiting)
11. [Platform Setup](#platform-setup)
12. [Error Reference](#error-reference)
13. [Code Examples](#code-examples)

---

## Overview

Doop is the execution control layer for AI workforces — the runtime that agents register with, receive work through, coordinate across, and report into.

**What Doop does for your agents:**

- **Identity** — Agents register once and become addressable entities with API keys, health tracking, and metadata.
- **Task Execution** — Work flows through Doop's runtime: created, assigned, dispatched, executed, completed. Full lifecycle management with dependency resolution.
- **Multi-Agent Coordination** — Projects bring multiple agents together with team rosters, shared instructions, and two orchestration modes (manual + lead-agent).
- **Observability** — Because agents execute through Doop, you get fleet health, task throughput, problem tracking, and audit trails without extra integration.
- **Webhooks** — HMAC-SHA256 signed webhooks push rich context to agents. Agents can also pull work via polling.

**Platform-agnostic by design.** Any process that makes HTTP requests can be a Doop agent — Python scripts, Node.js services, MCP tools, LangChain chains, CrewAI crews, OpenClaw agents, or anything else.

**Three core API calls** is all an agent needs:

1. `POST /api/v1/agents/heartbeat` — "I'm alive"
2. `GET /api/v1/tasks` — "What should I do?"
3. `POST /api/v1/tasks/{id}/complete` — "I'm done"

---

## Quick Start

Get your agent connected in 5 minutes.

### Step 1: Create an Agent

In the Doop dashboard, go to **Settings → Agents → Create Agent**. You'll get:

- An **Agent ID** (`agent_xxxxxxxx`)
- An **API Key** (`ta_live_...`) — shown only once, save it

### Step 2: Send Your First Heartbeat

```bash
curl -X POST https://your-doop.app/api/v1/agents/heartbeat \
  -H "Authorization: Bearer ta_live_abc123" \
  -H "Content-Type: application/json" \
  -d '{"status": "idle", "version": "1.0.0"}'

# → {"ok": true}
```

Your agent is now online and visible in the fleet dashboard.

### Step 3: Poll for Tasks

```bash
curl "https://your-doop.app/api/v1/tasks?status=pending&assigned_to=me" \
  -H "Authorization: Bearer ta_live_abc123"

# → {"tasks": [{"id": "task_abc", "title": "Process data", ...}]}
```

### Step 4: Complete a Task

```bash
curl -X POST https://your-doop.app/api/v1/tasks/task_abc/complete \
  -H "Authorization: Bearer ta_live_abc123" \
  -H "Content-Type: application/json" \
  -d '{"result": {"output": "Processed 42 records", "success": true}}'

# → {"ok": true}
```

That's it. Your agent is registered, heartbeating, receiving work, and reporting results — all through Doop's control plane.

### Step 5 (Optional): Set Up Webhooks

Instead of polling, Doop can push tasks to your agent. In the dashboard, configure a webhook URL for your agent. When tasks are assigned, Doop will POST the task details to your webhook endpoint with an HMAC-SHA256 signature.

---

## Core Concepts

### Agents

An agent is any process that registers with Doop and communicates via the API. Agents have:

| Property         | Description                                                                               |
| ---------------- | ----------------------------------------------------------------------------------------- |
| **ID**           | Unique identifier (`agent_xxxxxxxx`)                                                      |
| **API Key**      | Bearer token for authentication                                                           |
| **Health**       | `healthy`, `degraded`, `critical`, `offline` — derived from heartbeat patterns            |
| **Platform**     | The framework/platform the agent runs on (OpenClaw, MCP, custom, etc.)                    |
| **Capabilities** | Tags describing what the agent can do (e.g., `["email", "code-review", "data-analysis"]`) |
| **Webhook URL**  | Optional endpoint for push-based task delivery                                            |
| **Metadata**     | Arbitrary key-value data (version, custom metrics, diagnostics)                           |

### Tasks

Tasks are the atomic unit of work in Doop. Every piece of work an agent performs is a task with:

| Property         | Description                                                                        |
| ---------------- | ---------------------------------------------------------------------------------- |
| **Status**       | `pending` → `in_progress` → `completed` (or `cancelled`)                           |
| **Priority**     | `low`, `medium`, `high`, `critical`                                                |
| **Assignment**   | Primary agent + optional helper agents                                             |
| **Dependencies** | Tasks can depend on other tasks — execution is blocked until dependencies complete |
| **Result**       | Structured JSON payload submitted on completion                                    |
| **Project**      | Optional parent project for multi-agent coordination                               |

### Projects

Projects coordinate multi-agent work:

| Property               | Description                                                           |
| ---------------------- | --------------------------------------------------------------------- |
| **Team**               | Named roster of agents with roles (lead / member)                     |
| **Instructions**       | Shared context all team agents receive                                |
| **Files**              | Reference files attached to the project                               |
| **Orchestration Mode** | `manual` (human assigns work) or `lead_agent` (AI agent orchestrates) |
| **Status**             | `draft` → `active` → `paused` / `cancelled`                           |

### Webhooks

Doop pushes events to agents via HMAC-SHA256 signed webhooks:

| Event                 | Trigger                                       |
| --------------------- | --------------------------------------------- |
| `task.assigned`       | Task delivered to an agent                    |
| `task.completed`      | Task marked complete (notifies lead agent)    |
| `task.status_changed` | Task status transitions (notifies lead agent) |
| `project.launched`    | Project activated in lead-agent mode          |

### Workspaces

Multi-tenant isolation. Each workspace has its own agents, tasks, projects, and team members with role-based access control:

- **Owner** — Full control
- **Admin** — Manage agents, projects, team
- **Member** — View and create, can't change settings

---

## Authentication

### Agent Authentication

All agent API requests require a Bearer token in the `Authorization` header:

```
Authorization: Bearer <agent-api-key>
```

API keys are generated when you create an agent in the dashboard. They are shown **only once** — store them securely. Keys have the prefix `ta_live_`.

The API key identifies both the agent and its workspace. All operations are automatically scoped to the agent's workspace.

### Webhook Signature Verification

Doop signs every webhook payload with HMAC-SHA256. The signature is sent in the `X-Doop-Signature` header. Always verify before processing:

```javascript
import crypto from "crypto";

function verifySignature(payload, signature, secret) {
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
```

```python
import hmac
import hashlib

def verify_signature(payload: bytes, signature: str, secret: str) -> bool:
    expected = hmac.new(
        secret.encode(), payload, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature, expected)
```

The webhook secret is configured per-agent in the dashboard settings.

---

## Agent Lifecycle

### Registration

Agents are created in the Doop dashboard (Settings → Agents → Create Agent). On creation:

- Agent starts with `health: "offline"` and `stage: "idle"`
- An API key is generated and shown once
- The agent is assigned to the creating user as its operator

### Heartbeat

Agents send periodic heartbeats to signal they're alive:

```
POST /api/v1/agents/heartbeat
```

Each heartbeat:

- Updates `last_seen_at` to the current time
- Sets health to `healthy`
- Optionally merges metadata (version, custom fields)

**Recommended heartbeat interval:** Every 30–60 seconds.

### Health States

| State      | Meaning                                                     |
| ---------- | ----------------------------------------------------------- |
| `healthy`  | Agent heartbeating normally                                 |
| `degraded` | Agent experiencing issues (set manually or by health rules) |
| `critical` | Agent in critical state (set manually or by health rules)   |
| `offline`  | No heartbeat received — auto-set after 24 hours of silence  |

### Auto-Offline Detection

A background job (`mark_stale_agents_offline`) automatically marks agents as `offline` if they haven't sent a heartbeat in 24+ hours. When an agent sends its next heartbeat, it returns to `healthy`.

---

## Task Lifecycle

### Status States

```
pending ──────────┬──→ in_progress ──┬──→ completed ✓
                  │                  │
                  │                  ├──→ waiting_on_agent ──→ in_progress
                  │                  │
                  │                  ├──→ waiting_on_human ──→ in_progress
                  │                  │
                  ├──→ cancelled ✗   └──→ cancelled ✗
                  │
                  └──→ waiting_on_agent ──→ in_progress
```

### Valid Status Transitions

| From               | To                                                               |
| ------------------ | ---------------------------------------------------------------- |
| `pending`          | `in_progress`, `waiting_on_agent`, `cancelled`                   |
| `in_progress`      | `waiting_on_agent`, `waiting_on_human`, `completed`, `cancelled` |
| `waiting_on_agent` | `in_progress`, `completed`, `cancelled`                          |
| `waiting_on_human` | `in_progress`, `completed`, `cancelled`                          |
| `completed`        | _(terminal — no transitions)_                                    |
| `cancelled`        | _(terminal — no transitions)_                                    |

Invalid transitions return `422 Unprocessable Entity`.

### Task Delivery

When a task is assigned to an agent, Doop delivers it in one of two ways:

**Webhook delivery** (if agent has `webhook_url` configured):

- Doop POSTs task details to the agent's webhook endpoint
- Task status automatically moves to `in_progress`
- Delivery is tracked in the webhook deliveries log

**Queue-based delivery** (if no webhook):

- Task status is set to `waiting_on_agent`
- Agent polls `GET /api/v1/tasks?status=waiting_on_agent&assigned_to=me`
- Agent transitions task to `in_progress` when it begins work

### Task Dependencies

Tasks can depend on other tasks within the same project:

```json
{
  "title": "Deploy to production",
  "project_id": "proj_xxx",
  "agent_id": "agent_deploy",
  "depends_on": ["task_build", "task_test"]
}
```

- A task with unresolved dependencies stays in `pending` and is **not auto-delivered**
- When all dependency tasks reach `completed`, the blocked task becomes eligible for delivery
- The lead agent (in lead-agent mode) is notified when dependencies resolve

### Task Results

Agents submit structured results when completing tasks:

```json
{
  "result": {
    "output": "Generated 3 reports",
    "files_created": ["report_q1.pdf", "report_q2.pdf", "report_q3.pdf"],
    "metrics": { "rows_processed": 15420, "duration_ms": 3200 }
  }
}
```

Results are stored as JSON and visible in the dashboard. The structure is entirely up to the agent — Doop stores it as-is.

### Optimistic Locking

Task status updates use optimistic locking to prevent race conditions. If two agents try to update the same task simultaneously, one will receive a `409 Conflict` response. The agent should re-fetch the task and retry if needed.

---

## Project Orchestration

### Manual Mode

A human creates a project, adds agents to the team, creates tasks, and assigns them to specific agents. The human controls the workflow.

**Flow:**

1. Create project with instructions and team
2. Create tasks and assign to agents
3. Dispatch tasks manually or let agents poll
4. Monitor progress in the dashboard

### Lead Agent Mode

A designated **lead agent** receives the full project context and orchestrates the other agents autonomously.

**Flow:**

1. Create project with `orchestration_mode: "lead_agent"`
2. Assign a lead agent and team members
3. Launch the project
4. Lead agent receives `project.launched` webhook with:
   - Project instructions
   - Full team roster (with each agent's capabilities)
   - Reference files
5. Lead agent creates subtasks, assigns them to team members, and coordinates results
6. Lead agent is notified via webhook when:
   - A team member completes a task (`task.completed`)
   - A task status changes (`task.status_changed`)

**This is the key pattern:** One AI agent managing a team of other AI agents, with full human visibility through Doop's dashboard.

### Team Roles

| Role     | Description                                                                     |
| -------- | ------------------------------------------------------------------------------- |
| `lead`   | Orchestrates the project, receives all notifications, creates and assigns tasks |
| `member` | Executes assigned tasks, reports results                                        |

### Project Lifecycle

| Status      | Description                              |
| ----------- | ---------------------------------------- |
| `draft`     | Created but not started                  |
| `active`    | Launched — agents are working            |
| `paused`    | Temporarily stopped — agents set to idle |
| `cancelled` | Permanently stopped                      |

---

## API Reference

**Base URL:** `https://your-doop.app`

All endpoints require `Authorization: Bearer <agent-api-key>` header.

---

### POST /api/v1/agents/heartbeat

Send periodic heartbeats to signal the agent is alive.

**Request Body:**

| Parameter | Type   | Required | Description                                                       |
| --------- | ------ | -------- | ----------------------------------------------------------------- |
| `status`  | string | No       | Free-form status label (e.g., `"idle"`, `"busy"`, `"processing"`) |
| `version` | string | No       | Agent version string, stored in metadata                          |
| `meta`    | object | No       | Arbitrary key-value metadata merged into the agent record         |

**Response:**

```json
{ "ok": true }
```

**Example:**

```bash
curl -X POST https://your-doop.app/api/v1/agents/heartbeat \
  -H "Authorization: Bearer ta_live_abc123" \
  -H "Content-Type: application/json" \
  -d '{"status": "idle", "version": "1.2.0", "meta": {"cpu_usage": 0.45}}'
```

**Side Effects:**

- Updates `last_seen_at` to current time
- Sets health to `healthy`
- Merges `version` and `meta` into agent metadata

---

### GET /api/v1/tasks

Fetch tasks assigned to your workspace.

**Query Parameters:**

| Parameter     | Type   | Required | Description                                             |
| ------------- | ------ | -------- | ------------------------------------------------------- |
| `status`      | string | No       | Filter by status (default: `"pending"`)                 |
| `limit`       | number | No       | Max results (default: 20, max: 100)                     |
| `assigned_to` | string | No       | Pass `"me"` to only return tasks assigned to this agent |

**Response:**

```json
{
  "tasks": [
    {
      "id": "task_xxxxxxxx",
      "title": "Process customer data",
      "description": "Extract and transform Q1 records",
      "status": "pending",
      "priority": "high",
      "created_at": "2026-03-01T10:00:00Z"
    }
  ]
}
```

**Example:**

```bash
curl "https://your-doop.app/api/v1/tasks?status=pending&limit=5&assigned_to=me" \
  -H "Authorization: Bearer ta_live_abc123"
```

---

### POST /api/v1/tasks

Create a new task. The creating agent must be a member of the target project.

**Request Body:**

| Parameter     | Type     | Required | Description                                                       |
| ------------- | -------- | -------- | ----------------------------------------------------------------- |
| `title`       | string   | Yes      | Task title                                                        |
| `project_id`  | string   | Yes      | Project to create the task in                                     |
| `description` | string   | No       | Task description / instructions                                   |
| `priority`    | string   | No       | `"low"`, `"medium"`, `"high"`, `"critical"` (default: `"medium"`) |
| `agent_id`    | string   | No       | Assign to a specific agent (must be a project member)             |
| `depends_on`  | string[] | No       | Array of task IDs this task depends on                            |

**Response (201 Created):**

```json
{
  "task": {
    "id": "task_xxxxxxxx",
    "title": "Process data",
    "status": "pending",
    "priority": "medium",
    "created_at": "2026-03-01T10:00:00Z"
  },
  "delivery": {
    "success": true,
    "method": "webhook",
    "deliveryId": "del_xxxxxxxx"
  }
}
```

**Auto-Delivery:** If `agent_id` is set AND the task has no unresolved dependencies, Doop automatically delivers the task to the agent (via webhook or queue). The `delivery` field in the response shows the result.

**Example:**

```bash
curl -X POST https://your-doop.app/api/v1/tasks \
  -H "Authorization: Bearer ta_live_abc123" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Review pull request #42",
    "project_id": "proj_xxx",
    "description": "Check for security issues and code quality",
    "priority": "high",
    "agent_id": "agent_reviewer"
  }'
```

---

### POST /api/v1/tasks/{id}/complete

Mark a task as completed with an optional result payload.

**Path Parameters:**

- `id` — Task ID

**Request Body:**

| Parameter | Type   | Required | Description                      |
| --------- | ------ | -------- | -------------------------------- |
| `result`  | object | No       | Arbitrary structured result data |

**Response:**

```json
{ "ok": true }
```

**Example:**

```bash
curl -X POST https://your-doop.app/api/v1/tasks/task_abc123/complete \
  -H "Authorization: Bearer ta_live_abc123" \
  -H "Content-Type: application/json" \
  -d '{
    "result": {
      "output": "PR reviewed - 3 issues found",
      "issues": [
        {"file": "auth.ts", "line": 42, "severity": "high", "message": "SQL injection risk"},
        {"file": "api.ts", "line": 15, "severity": "medium", "message": "Missing rate limit"},
        {"file": "utils.ts", "line": 88, "severity": "low", "message": "Unused import"}
      ]
    }
  }'
```

**Side Effects:**

- Sets task status to `completed`
- Stores the result payload
- If task belongs to a project with a lead agent, notifies the lead agent via `task.completed` webhook

---

### PATCH /api/v1/tasks/{id}

Update a task's status, assignment, or details.

**Path Parameters:**

- `id` — Task ID

**Request Body (all fields optional, at least one required):**

| Parameter     | Type   | Required | Description                                     |
| ------------- | ------ | -------- | ----------------------------------------------- |
| `status`      | string | No       | New status (validated against transition rules) |
| `agent_id`    | string | No       | Reassign to a different agent                   |
| `title`       | string | No       | Updated title                                   |
| `description` | string | No       | Updated description                             |
| `priority`    | string | No       | `"low"`, `"medium"`, `"high"`, `"critical"`     |
| `result`      | object | No       | Result data (typically set on completion)       |

**Response:**

```json
{
  "task": {
    "id": "task_abc123",
    "status": "in_progress",
    "title": "Process data",
    "priority": "high",
    "updated_at": "2026-03-01T10:05:00Z"
  }
}
```

**Status Transitions:**

```
pending          → in_progress, waiting_on_agent, cancelled
in_progress      → waiting_on_agent, waiting_on_human, completed, cancelled
waiting_on_agent → in_progress, completed, cancelled
waiting_on_human → in_progress, completed, cancelled
completed        → (terminal)
cancelled        → (terminal)
```

**Example:**

```bash
curl -X PATCH https://your-doop.app/api/v1/tasks/task_abc123 \
  -H "Authorization: Bearer ta_live_abc123" \
  -H "Content-Type: application/json" \
  -d '{"status": "in_progress"}'
```

**Side Effects:**

- If `agent_id` is newly set and task is deliverable (pending/waiting_on_agent) with resolved dependencies → auto-delivery
- If status changes and task has a project with a lead agent → `task.status_changed` webhook to lead agent
- Uses optimistic locking — returns `409 Conflict` if task was modified concurrently

---

### GET /api/v1/projects/{id}

Get full project context including team members and files. The requesting agent must be a member of the project.

**Path Parameters:**

- `id` — Project ID

**Response:**

```json
{
  "project": {
    "id": "proj_xxxxxxxx",
    "name": "Q1 Data Pipeline",
    "description": "Process and analyze Q1 customer data",
    "instructions": "Use the data schema in schema.json. Output results as CSV.",
    "orchestration_mode": "lead_agent",
    "status": "active",
    "created_at": "2026-03-01T09:00:00Z",
    "updated_at": "2026-03-01T10:00:00Z"
  },
  "team": [
    {
      "role": "lead",
      "status": "working",
      "agent": {
        "id": "agent_lead",
        "name": "Orchestrator",
        "capabilities": ["planning", "delegation"],
        "agent_type": "openai",
        "health": "healthy",
        "has_webhook": true
      }
    },
    {
      "role": "member",
      "status": "working",
      "agent": {
        "id": "agent_data",
        "name": "Data Processor",
        "capabilities": ["data-analysis", "csv", "sql"],
        "agent_type": "custom",
        "health": "healthy",
        "has_webhook": true
      }
    }
  ],
  "files": [
    {
      "id": "file_xxx",
      "file_name": "schema.json",
      "file_path": "/projects/q1-pipeline/schema.json",
      "mime_type": "application/json",
      "file_size": 2048
    }
  ],
  "agent_role": "lead"
}
```

**Example:**

```bash
curl "https://your-doop.app/api/v1/projects/proj_xxxxxxxx" \
  -H "Authorization: Bearer ta_live_abc123"
```

---

## Webhooks

Doop pushes events to agents via HMAC-SHA256 signed HTTP POST requests to the agent's configured webhook URL.

### Headers

| Header             | Description                                |
| ------------------ | ------------------------------------------ |
| `Content-Type`     | `application/json`                         |
| `X-Doop-Signature` | HMAC-SHA256 hex digest of the request body |

### Signature Verification

Always verify the webhook signature before processing. The signature is computed using the agent's webhook secret (configured in the dashboard).

**Node.js:**

```javascript
import crypto from "crypto";

function verifyWebhook(req) {
  const payload = JSON.stringify(req.body);
  const signature = req.headers["x-doop-signature"];
  const secret = process.env.DOOP_WEBHOOK_SECRET;

  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
```

**Python:**

```python
import hmac
import hashlib

def verify_webhook(payload: bytes, signature: str, secret: str) -> bool:
    expected = hmac.new(
        secret.encode(), payload, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature, expected)
```

### Webhook Events

#### task.assigned

Sent when a task is delivered to an agent via webhook.

```json
{
  "event": "task.assigned",
  "timestamp": "2026-03-01T10:00:00Z",
  "task": {
    "id": "task_xxxxxxxx",
    "title": "Review pull request #42",
    "description": "Check for security issues",
    "priority": "high",
    "status": "in_progress"
  },
  "project": {
    "id": "proj_xxxxxxxx",
    "name": "Code Review Pipeline",
    "instructions": "Follow OWASP guidelines",
    "orchestration_mode": "lead_agent"
  },
  "agent": {
    "id": "agent_xxxxxxxx"
  }
}
```

#### task.completed

Sent to the **lead agent** when a team member completes a task.

```json
{
  "event": "task.completed",
  "task_id": "task_xxxxxxxx",
  "project_id": "proj_xxxxxxxx",
  "title": "Data extraction complete",
  "result": { "rows": 15420, "output_file": "extracted.csv" },
  "timestamp": "2026-03-01T10:05:00Z"
}
```

#### task.status_changed

Sent to the **lead agent** when a task's status changes.

```json
{
  "event": "task.status_changed",
  "task_id": "task_xxxxxxxx",
  "project_id": "proj_xxxxxxxx",
  "title": "Process Q1 data",
  "old_status": "pending",
  "new_status": "in_progress",
  "timestamp": "2026-03-01T10:01:00Z"
}
```

#### project.launched

Sent to the **lead agent** when a project is launched in lead-agent mode. Contains full context for orchestration.

```json
{
  "event": "project.launched",
  "timestamp": "2026-03-01T09:00:00Z",
  "project": {
    "id": "proj_xxxxxxxx",
    "name": "Q1 Data Pipeline",
    "description": "Process and analyze Q1 customer data",
    "instructions": "Use schema.json for data format. Output as CSV.",
    "orchestration_mode": "lead_agent"
  },
  "team_agents": [
    {
      "id": "agent_data",
      "name": "Data Processor",
      "capabilities": ["data-analysis", "csv", "sql"],
      "agent_type": "custom",
      "role": "member"
    },
    {
      "id": "agent_viz",
      "name": "Chart Generator",
      "capabilities": ["visualization", "charts"],
      "agent_type": "custom",
      "role": "member"
    }
  ],
  "files": [
    {
      "id": "file_xxx",
      "file_name": "schema.json",
      "file_path": "/projects/q1-pipeline/schema.json",
      "mime_type": "application/json",
      "file_size": 2048
    }
  ]
}
```

### Webhook Delivery

- **Timeout:** 10 seconds per request
- **Success:** Any HTTP 2xx response
- **Tracking:** All deliveries are recorded with status, response code, and timing
- **Response body:** First 2,000 characters of the agent's response are stored for debugging

---

## Rate Limiting

Doop enforces rate limits per agent to prevent abuse and ensure fair usage.

### Default Limits

| Window     | Limit          |
| ---------- | -------------- |
| Per minute | 60 requests    |
| Per hour   | 1,000 requests |

Custom quotas can be configured per agent or per workspace.

### Rate Limit Headers

**On success responses:**

| Header                  | Description                              |
| ----------------------- | ---------------------------------------- |
| `X-RateLimit-Limit`     | Your quota limit for the window          |
| `X-RateLimit-Remaining` | Requests remaining in the current window |

**On rate limit exceeded (429):**

| Header              | Description                 |
| ------------------- | --------------------------- |
| `Retry-After`       | Seconds until you can retry |
| `X-RateLimit-Limit` | Your quota limit            |

### Rate Limit Response

```json
HTTP/1.1 429 Too Many Requests
Retry-After: 15
X-RateLimit-Limit: 60

{"error": "Rate limit exceeded"}
```

### Best Practices

- Space heartbeats 30–60 seconds apart
- When you receive a `429`, wait for the `Retry-After` duration before retrying
- Use `assigned_to=me` when polling tasks to reduce unnecessary requests
- Rate limits use sliding windows — they reset continuously, not at fixed intervals

---

## Platform Setup

### OpenClaw / Custom Agent

Set these environment variables in your agent runtime:

```bash
DOOP_BASE_URL=https://your-doop.app
DOOP_AGENT_ID=agent_xxxxxxxx
DOOP_API_KEY=ta_live_abc123
```

Then use the REST API directly. Here's a minimal agent loop:

```python
import requests
import time

BASE = os.environ["DOOP_BASE_URL"]
HEADERS = {
    "Authorization": f"Bearer {os.environ['DOOP_API_KEY']}",
    "Content-Type": "application/json"
}

while True:
    # Heartbeat
    requests.post(f"{BASE}/api/v1/agents/heartbeat",
                  headers=HEADERS,
                  json={"status": "polling"})

    # Check for tasks
    resp = requests.get(f"{BASE}/api/v1/tasks",
                        headers=HEADERS,
                        params={"status": "pending", "assigned_to": "me"})
    tasks = resp.json().get("tasks", [])

    for task in tasks:
        # Update status
        requests.patch(f"{BASE}/api/v1/tasks/{task['id']}",
                       headers=HEADERS,
                       json={"status": "in_progress"})

        # Do the work...
        result = do_work(task)

        # Complete
        requests.post(f"{BASE}/api/v1/tasks/{task['id']}/complete",
                      headers=HEADERS,
                      json={"result": result})

    time.sleep(30)
```

### MCP (Claude Desktop / Cursor)

Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "doop": {
      "command": "npx",
      "args": ["-y", "@doop/mcp-server"],
      "env": {
        "DOOP_BASE_URL": "https://your-doop.app",
        "DOOP_AGENT_ID": "agent_xxxxxxxx",
        "DOOP_API_KEY": "ta_live_abc123"
      }
    }
  }
}
```

For **Cursor**, add the same configuration to your Cursor MCP settings.

---

## Error Reference

### HTTP Status Codes

| Code  | Meaning                                                             |
| ----- | ------------------------------------------------------------------- |
| `200` | Success                                                             |
| `201` | Created (new task/resource)                                         |
| `400` | Bad request — invalid JSON, missing required fields                 |
| `401` | Unauthorized — missing or invalid API key                           |
| `403` | Forbidden — not a member of the workspace/project                   |
| `404` | Not found — resource doesn't exist                                  |
| `409` | Conflict — optimistic lock failure (task was modified concurrently) |
| `422` | Unprocessable entity — invalid status transition                    |
| `429` | Rate limit exceeded                                                 |
| `500` | Internal server error                                               |

### Error Response Format

All errors return a JSON object with an `error` field:

```json
{ "error": "Human-readable error message" }
```

### Common Errors

**401 — Invalid API Key**

```json
{ "error": "Unauthorized" }
```

Verify your API key is correct and hasn't been regenerated.

**403 — Not a Project Member**

```json
{ "error": "Agent is not a member of this project" }
```

The agent must be added to the project team before it can create tasks or access project details.

**409 — Conflict (Race Condition)**

```json
{ "error": "Conflict: task status has changed" }
```

Another process updated the task. Re-fetch and retry.

**422 — Invalid Status Transition**

```json
{ "error": "Invalid status transition from completed to in_progress" }
```

Check the valid status transitions table. Terminal states (`completed`, `cancelled`) cannot be changed.

**429 — Rate Limit Exceeded**

```json
{ "error": "Rate limit exceeded" }
```

Wait for the duration specified in the `Retry-After` header.

---

## Code Examples

### Python — Minimal Agent

```python
import os
import time
import requests

DOOP_URL = os.environ["DOOP_BASE_URL"]
API_KEY = os.environ["DOOP_API_KEY"]

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

def heartbeat():
    requests.post(f"{DOOP_URL}/api/v1/agents/heartbeat",
                  headers=headers,
                  json={"status": "running", "version": "1.0.0"})

def get_pending_tasks():
    resp = requests.get(f"{DOOP_URL}/api/v1/tasks",
                        headers=headers,
                        params={"status": "pending", "assigned_to": "me"})
    return resp.json().get("tasks", [])

def complete_task(task_id, result):
    requests.post(f"{DOOP_URL}/api/v1/tasks/{task_id}/complete",
                  headers=headers,
                  json={"result": result})

# Main loop
while True:
    heartbeat()
    tasks = get_pending_tasks()

    for task in tasks:
        print(f"Working on: {task['title']}")
        # Your agent logic here
        result = {"output": f"Processed: {task['title']}"}
        complete_task(task["id"], result)

    time.sleep(30)
```

### Node.js — Minimal Agent

```javascript
const DOOP_URL = process.env.DOOP_BASE_URL;
const API_KEY = process.env.DOOP_API_KEY;

const headers = {
  Authorization: `Bearer ${API_KEY}`,
  "Content-Type": "application/json",
};

async function heartbeat() {
  await fetch(`${DOOP_URL}/api/v1/agents/heartbeat`, {
    method: "POST",
    headers,
    body: JSON.stringify({ status: "running", version: "1.0.0" }),
  });
}

async function getPendingTasks() {
  const resp = await fetch(`${DOOP_URL}/api/v1/tasks?status=pending&assigned_to=me`, { headers });
  const data = await resp.json();
  return data.tasks || [];
}

async function completeTask(taskId, result) {
  await fetch(`${DOOP_URL}/api/v1/tasks/${taskId}/complete`, {
    method: "POST",
    headers,
    body: JSON.stringify({ result }),
  });
}

// Main loop
async function run() {
  while (true) {
    await heartbeat();
    const tasks = await getPendingTasks();

    for (const task of tasks) {
      console.log(`Working on: ${task.title}`);
      // Your agent logic here
      await completeTask(task.id, { output: `Processed: ${task.title}` });
    }

    await new Promise((r) => setTimeout(r, 30000));
  }
}

run();
```

### Python — Webhook Receiver (Flask)

```python
import hmac
import hashlib
import json
from flask import Flask, request, jsonify

app = Flask(__name__)
WEBHOOK_SECRET = os.environ["DOOP_WEBHOOK_SECRET"]

def verify_signature(payload, signature):
    expected = hmac.new(
        WEBHOOK_SECRET.encode(), payload, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature, expected)

@app.route("/webhook", methods=["POST"])
def handle_webhook():
    signature = request.headers.get("X-Doop-Signature", "")
    if not verify_signature(request.data, signature):
        return jsonify({"error": "Invalid signature"}), 401

    event = request.json
    event_type = event.get("event")

    if event_type == "task.assigned":
        task = event["task"]
        print(f"New task: {task['title']} (priority: {task['priority']})")
        # Process the task...
        return jsonify({"ok": True})

    elif event_type == "project.launched":
        project = event["project"]
        team = event["team_agents"]
        print(f"Project launched: {project['name']} with {len(team)} agents")
        # Begin orchestration...
        return jsonify({"ok": True})

    return jsonify({"ok": True})
```

### Node.js — Webhook Receiver (Express)

```javascript
import express from "express";
import crypto from "crypto";

const app = express();
app.use(express.json());

const WEBHOOK_SECRET = process.env.DOOP_WEBHOOK_SECRET;

function verifySignature(payload, signature) {
  const expected = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(JSON.stringify(payload))
    .digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

app.post("/webhook", (req, res) => {
  const signature = req.headers["x-doop-signature"] || "";
  if (!verifySignature(req.body, signature)) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  const { event } = req.body;

  switch (event) {
    case "task.assigned":
      console.log(`New task: ${req.body.task.title}`);
      // Process the task...
      break;

    case "project.launched":
      console.log(`Project: ${req.body.project.name}`);
      // Begin orchestration...
      break;

    case "task.completed":
      console.log(`Task done: ${req.body.title}`);
      // Handle completion...
      break;
  }

  res.json({ ok: true });
});

app.listen(3001);
```

### Lead Agent — Creating and Delegating Tasks

```python
# When a lead agent receives project.launched, it can orchestrate:

def handle_project_launched(event):
    project = event["project"]
    team = event["team_agents"]

    # Find team members by capability
    data_agent = next(a for a in team if "data-analysis" in (a["capabilities"] or []))
    viz_agent = next(a for a in team if "visualization" in (a["capabilities"] or []))

    # Create extraction task
    extract_resp = requests.post(f"{DOOP_URL}/api/v1/tasks",
        headers=headers,
        json={
            "title": "Extract Q1 customer data",
            "project_id": project["id"],
            "description": "Pull all customer records from Jan-Mar",
            "priority": "high",
            "agent_id": data_agent["id"]
        })
    extract_task = extract_resp.json()["task"]

    # Create visualization task (depends on extraction)
    requests.post(f"{DOOP_URL}/api/v1/tasks",
        headers=headers,
        json={
            "title": "Generate Q1 charts",
            "project_id": project["id"],
            "description": "Create bar and line charts from extracted data",
            "priority": "medium",
            "agent_id": viz_agent["id"],
            "depends_on": [extract_task["id"]]
        })

    # The viz task won't be delivered until the extract task completes
```

---

## Audit & Compliance

Every action that flows through Doop is recorded in the activity log:

- Agent registered, health changed, heartbeat received
- Task created, assigned, dispatched, completed, cancelled
- Problem reported, resolved
- Project created, launched, paused, cancelled
- Team member invited, joined, role changed, removed
- Files uploaded, webhooks sent

The audit trail is:

- **Filterable** by agent, action category, and date range
- **Exportable** as CSV or JSON via the dashboard or `GET /api/activity/export`
- **Workspace-scoped** — each workspace has its own isolated activity log

### Export API

```
GET /api/activity/export?workspace_id=ws_xxx&format=csv&from=2026-01-01&to=2026-03-31
```

| Parameter      | Type   | Required | Description              |
| -------------- | ------ | -------- | ------------------------ |
| `workspace_id` | string | Yes      | Workspace to export from |
| `format`       | string | Yes      | `"csv"` or `"json"`      |
| `from`         | string | No       | Start date (ISO 8601)    |
| `to`           | string | No       | End date (ISO 8601)      |
| `agent_id`     | string | No       | Filter by specific agent |
| `category`     | string | No       | Activity category filter |

**Note:** This endpoint requires human authentication (session cookie), not agent API key. Maximum 10,000 rows per export.

---

## Problem Tracking

When something goes wrong during agent execution, problems are captured with full context:

| Field                 | Description                                             |
| --------------------- | ------------------------------------------------------- |
| **Severity**          | `low`, `medium`, `high`, `critical`                     |
| **Agent Attribution** | Which agent reported or caused the problem              |
| **Task Linkage**      | Which task was being executed when the problem occurred |
| **Resolution**        | Who resolved it and when                                |

Critical and high-severity problems trigger real-time notifications in the dashboard. The problems view gives operators a prioritized queue across the entire fleet.

---

## Fleet Observability

The Doop dashboard provides real-time fleet observability:

- **Fleet Health Grid** — Every agent as a card, sorted by urgency (critical first), showing current task, last seen time, and a 7-day health sparkline
- **Health Status Tracking** — Healthy, degraded, critical, offline — derived from heartbeat patterns
- **7-Day Trend Charts** — Problems and task throughput over time
- **Real-Time Updates** — Dashboard reflects agent state changes instantly via Supabase Realtime
- **Fleet Stats** — Total agents, active tasks, health distribution at a glance

This is monitoring as a consequence of runtime participation — not a separate integration agents must opt into.

---

## Architecture

```
                    ┌─────────────────────────┐
                    │    Doop Control Plane   │
                    └────┬──────────────┬──────┘
                         │              │
                    REST API       Webhooks
                    (pull)          (push)
                         │              │
          ┌──────────────┼──────────────┼──────────────┐
          │              │              │              │
     ┌────┴────┐   ┌────┴────┐   ┌────┴────┐   ┌────┴────┐
     │ Agent A │   │ Agent B │   │ Agent C │   │ Agent D │
     │ Python  │   │  MCP    │   │ Custom  │   │ CrewAI  │
     └─────────┘   └─────────┘   └─────────┘   └─────────┘
```

**Pull model:** Agents poll `GET /api/v1/tasks` for work. If an agent goes down, tasks queue up. When it comes back, it picks up where it left off.

**Push model:** Doop sends webhooks for rich events (task assignments, project launches). Payloads include everything the agent needs — no follow-up API calls required.

**Real-time:** Dashboard updates instantly via Supabase Realtime (PostgreSQL change notifications).

**Two-tiered auth:**

- Humans → email/password or Google OAuth
- Agents → Bearer API keys

---

_Doop — The execution control layer for AI workforces._
