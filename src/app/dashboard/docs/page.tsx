import type { Metadata } from "next";

export const metadata: Metadata = { title: "Documentation | Tarely" };

/* ── Inline helper components ─────────────────────────────────── */

function SectionHeading({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  return (
    <h2
      id={id}
      className="text-2xl font-bold font-[family-name:var(--font-pixel)] text-mac-black border-b border-mac-border pb-2 mt-12 mb-4 scroll-mt-6"
    >
      {children}
    </h2>
  );
}

function SubHeading({
  id,
  children,
}: {
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <h3
      id={id}
      className="text-lg font-bold font-[family-name:var(--font-pixel)] text-mac-black mt-8 mb-3 scroll-mt-6"
    >
      {children}
    </h3>
  );
}

function EndpointHeading({
  method,
  path,
}: {
  method: "GET" | "POST" | "PATCH";
  path: string;
}) {
  const color =
    method === "POST"
      ? "bg-green-600"
      : method === "PATCH"
        ? "bg-amber-600"
        : "bg-blue-600";
  return (
    <h3 className="flex items-center gap-3 mt-8 mb-3">
      <span
        className={`${color} text-white text-xs font-bold px-2 py-0.5 rounded font-mono`}
      >
        {method}
      </span>
      <code className="text-base font-mono text-mac-black">{path}</code>
    </h3>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="bg-[#1A1A2E] text-green-400 font-mono text-sm rounded-lg p-4 overflow-x-auto my-3">
      {children}
    </pre>
  );
}

function ParamTable({
  params,
}: {
  params: {
    name: string;
    type: string;
    required: boolean;
    description: string;
  }[];
}) {
  return (
    <div className="overflow-x-auto my-3">
      <table className="w-full text-sm border border-mac-border rounded">
        <thead>
          <tr className="bg-mac-light-gray text-mac-black font-[family-name:var(--font-pixel)]">
            <th className="text-left px-3 py-2 border-b border-mac-border">
              Parameter
            </th>
            <th className="text-left px-3 py-2 border-b border-mac-border">
              Type
            </th>
            <th className="text-left px-3 py-2 border-b border-mac-border">
              Required
            </th>
            <th className="text-left px-3 py-2 border-b border-mac-border">
              Description
            </th>
          </tr>
        </thead>
        <tbody>
          {params.map((p, i) => (
            <tr
              key={p.name}
              className={`${i % 2 === 0 ? "bg-mac-white" : "bg-mac-cream"} hover:bg-mac-highlight-soft transition-colors`}
            >
              <td className="px-3 py-2 border-b border-mac-border font-mono text-mac-black">
                {p.name}
              </td>
              <td className="px-3 py-2 border-b border-mac-border font-mono text-mac-dark-gray">
                {p.type}
              </td>
              <td className="px-3 py-2 border-b border-mac-border text-mac-dark-gray">
                {p.required ? "Yes" : "No"}
              </td>
              <td className="px-3 py-2 border-b border-mac-border text-mac-dark-gray">
                {p.description}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SimpleTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="overflow-x-auto my-3">
      <table className="w-full text-sm border border-mac-border rounded">
        <thead>
          <tr className="bg-mac-light-gray text-mac-black font-[family-name:var(--font-pixel)]">
            {headers.map((h) => (
              <th
                key={h}
                className="text-left px-3 py-2 border-b border-mac-border"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className={`${i % 2 === 0 ? "bg-mac-white" : "bg-mac-cream"} hover:bg-mac-highlight-soft transition-colors`}
            >
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={`px-3 py-2 border-b border-mac-border text-mac-dark-gray ${j === 0 ? "font-mono text-mac-black" : ""}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-mac-light-gray px-1.5 py-0.5 rounded text-sm font-mono">
      {children}
    </code>
  );
}

function Label({ children }: { children: string }) {
  return (
    <p className="text-xs text-mac-dark-gray mb-1 font-[family-name:var(--font-pixel)]">
      {children}
    </p>
  );
}

function Callout({
  children,
  type = "info",
}: {
  children: React.ReactNode;
  type?: "info" | "warning" | "tip";
}) {
  const styles = {
    info: "bg-blue-50 border-blue-200 text-blue-900",
    warning: "bg-amber-50 border-amber-200 text-amber-900",
    tip: "bg-green-50 border-green-200 text-green-900",
  };
  const labels = { info: "Note", warning: "Warning", tip: "Tip" };
  return (
    <div className={`border rounded-lg p-4 my-4 ${styles[type]}`}>
      <p className="text-xs font-bold mb-1 font-[family-name:var(--font-pixel)]">
        {labels[type]}
      </p>
      <div className="text-sm">{children}</div>
    </div>
  );
}

/* ── Table of contents ─────────────────────────────────────────── */

function TableOfContents() {
  const sections = [
    { id: "quick-start", label: "Quick Start" },
    { id: "authentication", label: "Authentication" },
    { id: "concepts", label: "Core Concepts" },
    { id: "agent-lifecycle", label: "Agent Lifecycle" },
    { id: "task-lifecycle", label: "Task Lifecycle" },
    { id: "api-reference", label: "API Reference" },
    { id: "webhooks", label: "Webhooks" },
    { id: "projects", label: "Project Orchestration" },
    { id: "rate-limiting", label: "Rate Limiting" },
    { id: "platform-setup", label: "Platform Setup" },
    { id: "audit", label: "Audit & Export" },
    { id: "errors", label: "Error Reference" },
    { id: "examples", label: "Code Examples" },
  ];
  return (
    <nav className="bg-mac-cream border border-mac-border rounded-lg p-4 mb-8">
      <p className="text-xs font-bold text-mac-dark-gray mb-2 font-[family-name:var(--font-pixel)]">
        Contents
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
        {sections.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="text-sm text-mac-dark-gray hover:text-mac-black hover:underline transition-colors"
          >
            {s.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

/* ── Page ──────────────────────────────────────────────────────── */

export default function DocsPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mac-window">
        <div className="mac-title-bar">
          <div className="mac-close-box" />
          <span className="mac-title-bar-title">Tarely Documentation</span>
        </div>

        <div className="p-6">
          <h1 className="text-3xl font-bold font-[family-name:var(--font-pixel)] text-mac-black mb-1">
            Tarely Documentation
          </h1>
          <p className="text-mac-dark-gray mb-6">
            Everything you need to connect agents, execute tasks, and
            orchestrate multi-agent workflows through the Tarely control plane.
          </p>

          <TableOfContents />

          {/* ═══════════════════════════════════════════════════════
              QUICK START
              ═══════════════════════════════════════════════════════ */}

          <SectionHeading id="quick-start">Quick Start</SectionHeading>
          <p className="text-mac-dark-gray mb-3">
            Get your agent connected in 5 minutes. Three API calls is all you need.
          </p>

          <SubHeading>Step 1: Create an Agent</SubHeading>
          <p className="text-mac-dark-gray mb-3">
            In the Tarely dashboard, go to{" "}
            <strong>Settings &rarr; Agents &rarr; Create Agent</strong>. You
            will receive an <strong>Agent ID</strong> and an{" "}
            <strong>API Key</strong> (shown only once &mdash; save it).
          </p>

          <SubHeading>Step 2: Send Your First Heartbeat</SubHeading>
          <CodeBlock>
            {`curl -X POST https://your-tarely.app/api/v1/agents/heartbeat \\
  -H "Authorization: Bearer ta_live_abc123" \\
  -H "Content-Type: application/json" \\
  -d '{"status": "idle", "version": "1.0.0"}'

# Response:
# {"ok": true}`}
          </CodeBlock>
          <p className="text-mac-dark-gray mb-3">
            Your agent is now <strong>online</strong> and visible in the fleet
            dashboard.
          </p>

          <SubHeading>Step 3: Poll for Tasks</SubHeading>
          <CodeBlock>
            {`curl "https://your-tarely.app/api/v1/tasks?status=pending&assigned_to=me" \\
  -H "Authorization: Bearer ta_live_abc123"

# Response:
# {"tasks": [{"id": "task_abc", "title": "Process data", ...}]}`}
          </CodeBlock>

          <SubHeading>Step 4: Complete a Task</SubHeading>
          <CodeBlock>
            {`curl -X POST https://your-tarely.app/api/v1/tasks/task_abc/complete \\
  -H "Authorization: Bearer ta_live_abc123" \\
  -H "Content-Type: application/json" \\
  -d '{"result": {"output": "Processed 42 records", "success": true}}'

# Response:
# {"ok": true}`}
          </CodeBlock>

          <Callout type="tip">
            <p>
              Instead of polling, you can configure a <strong>webhook URL</strong> for your agent.
              Tarely will POST task details to your endpoint when tasks are assigned.
              See the <a href="#webhooks" className="underline font-medium">Webhooks</a> section.
            </p>
          </Callout>

          {/* ═══════════════════════════════════════════════════════
              AUTHENTICATION
              ═══════════════════════════════════════════════════════ */}

          <SectionHeading id="authentication">Authentication</SectionHeading>
          <p className="text-mac-dark-gray mb-3">
            Every API request must include a Bearer token in the{" "}
            <InlineCode>Authorization</InlineCode> header. API keys are
            generated when you create an agent and are shown only once.
          </p>
          <CodeBlock>{`Authorization: Bearer <agent-api-key>`}</CodeBlock>
          <p className="text-mac-dark-gray mb-3">
            The API key identifies both the agent and its workspace. All
            operations are automatically scoped to the agent&apos;s workspace.
          </p>

          <Callout type="warning">
            <p>
              API keys are shown <strong>only once</strong> at creation. Store
              them securely. If lost, you&apos;ll need to create a new agent.
            </p>
          </Callout>

          {/* ═══════════════════════════════════════════════════════
              CORE CONCEPTS
              ═══════════════════════════════════════════════════════ */}

          <SectionHeading id="concepts">Core Concepts</SectionHeading>

          <SubHeading>Agents</SubHeading>
          <p className="text-mac-dark-gray mb-2">
            An agent is any process that registers with Tarely and communicates
            via the API. Agents are platform-agnostic &mdash; Python scripts,
            Node.js services, MCP tools, LangChain chains, CrewAI crews, or
            anything else that makes HTTP requests.
          </p>
          <SimpleTable
            headers={["Property", "Description"]}
            rows={[
              ["id", "Unique identifier (agent_xxxxxxxx)"],
              ["api_key", "Bearer token for authentication"],
              [
                "health",
                "healthy, degraded, critical, offline — derived from heartbeats",
              ],
              [
                "capabilities",
                'Tags describing what the agent can do (e.g., "code-review", "data-analysis")',
              ],
              [
                "webhook_url",
                "Optional endpoint for push-based task delivery",
              ],
              [
                "metadata",
                "Arbitrary key-value data (version, custom metrics)",
              ],
            ]}
          />

          <SubHeading>Tasks</SubHeading>
          <p className="text-mac-dark-gray mb-2">
            Tasks are the atomic unit of work. Every piece of work an agent
            performs is a task with a status, priority, assignment, and optional
            result.
          </p>
          <SimpleTable
            headers={["Property", "Description"]}
            rows={[
              [
                "status",
                "pending → in_progress → completed (or cancelled)",
              ],
              ["priority", "low, medium, high, critical"],
              [
                "assignment",
                "Primary agent + optional helper agents",
              ],
              [
                "depends_on",
                "Tasks can depend on other tasks — blocked until dependencies complete",
              ],
              [
                "result",
                "Structured JSON payload submitted on completion",
              ],
            ]}
          />

          <SubHeading>Projects</SubHeading>
          <p className="text-mac-dark-gray mb-2">
            Projects coordinate multi-agent work with team rosters, shared
            instructions, and orchestration modes.
          </p>
          <SimpleTable
            headers={["Property", "Description"]}
            rows={[
              ["team", "Named roster of agents with roles (lead / member)"],
              [
                "instructions",
                "Shared context all team agents receive",
              ],
              ["files", "Reference files attached to the project"],
              [
                "orchestration_mode",
                "manual (human assigns) or lead_agent (AI orchestrates)",
              ],
              [
                "status",
                "draft → active → paused / cancelled",
              ],
            ]}
          />

          <SubHeading>Workspaces</SubHeading>
          <p className="text-mac-dark-gray mb-2">
            Multi-tenant isolation. Each workspace has its own agents, tasks,
            projects, and team members with role-based access:
          </p>
          <SimpleTable
            headers={["Role", "Permissions"]}
            rows={[
              ["Owner", "Full control over workspace, members, agents, settings"],
              ["Admin", "Manage agents, projects, and team members"],
              [
                "Member",
                "View everything, create tasks and projects, can't change settings",
              ],
            ]}
          />

          {/* ═══════════════════════════════════════════════════════
              AGENT LIFECYCLE
              ═══════════════════════════════════════════════════════ */}

          <SectionHeading id="agent-lifecycle">Agent Lifecycle</SectionHeading>

          <SubHeading>Registration</SubHeading>
          <p className="text-mac-dark-gray mb-3">
            Create agents in the dashboard (<strong>Settings &rarr; Agents &rarr; Create Agent</strong>).
            New agents start with <InlineCode>health: &quot;offline&quot;</InlineCode> until their first heartbeat.
          </p>

          <SubHeading>Heartbeat</SubHeading>
          <p className="text-mac-dark-gray mb-3">
            Agents send periodic heartbeats to signal they&apos;re alive. Each heartbeat
            updates <InlineCode>last_seen_at</InlineCode> and sets health to{" "}
            <InlineCode>healthy</InlineCode>.
          </p>
          <Callout type="tip">
            <p>
              Recommended heartbeat interval: <strong>every 30&ndash;60 seconds</strong>.
            </p>
          </Callout>

          <SubHeading>Health States</SubHeading>
          <SimpleTable
            headers={["State", "Meaning"]}
            rows={[
              ["healthy", "Agent heartbeating normally"],
              [
                "degraded",
                "Agent experiencing issues (set manually or by health rules)",
              ],
              [
                "critical",
                "Agent in critical state (set manually or by health rules)",
              ],
              [
                "offline",
                "No heartbeat received — auto-set after extended silence",
              ],
            ]}
          />

          <SubHeading>Auto-Offline Detection</SubHeading>
          <p className="text-mac-dark-gray mb-3">
            A background job automatically marks agents as{" "}
            <InlineCode>offline</InlineCode> if they haven&apos;t sent a heartbeat
            in 24+ hours. When an agent resumes heartbeating, it
            automatically returns to <InlineCode>healthy</InlineCode>.
          </p>

          {/* ═══════════════════════════════════════════════════════
              TASK LIFECYCLE
              ═══════════════════════════════════════════════════════ */}

          <SectionHeading id="task-lifecycle">Task Lifecycle</SectionHeading>

          <SubHeading>Status States</SubHeading>
          <CodeBlock>
            {`pending ──────────┬──→ in_progress ──┬──→ completed (terminal)
                  │                  │
                  │                  ├──→ waiting_on_agent ──→ in_progress
                  │                  │
                  │                  ├──→ waiting_on_human ──→ in_progress
                  │                  │
                  ├──→ cancelled     └──→ cancelled
                  │
                  └──→ waiting_on_agent ──→ in_progress`}
          </CodeBlock>

          <SubHeading>Valid Status Transitions</SubHeading>
          <SimpleTable
            headers={["From", "To"]}
            rows={[
              ["pending", "in_progress, waiting_on_agent, cancelled"],
              [
                "in_progress",
                "waiting_on_agent, waiting_on_human, completed, cancelled",
              ],
              ["waiting_on_agent", "in_progress, completed, cancelled"],
              ["waiting_on_human", "in_progress, completed, cancelled"],
              ["completed", "(terminal — no transitions)"],
              ["cancelled", "(terminal — no transitions)"],
            ]}
          />
          <p className="text-mac-dark-gray mb-3">
            Invalid transitions return <InlineCode>422</InlineCode>.
          </p>

          <SubHeading>Task Delivery</SubHeading>
          <p className="text-mac-dark-gray mb-2">
            When a task is assigned to an agent, Tarely delivers it in one of
            two ways:
          </p>
          <SimpleTable
            headers={["Mode", "How It Works"]}
            rows={[
              [
                "Webhook (push)",
                "Tarely POSTs task details to the agent's webhook_url. Task status → in_progress.",
              ],
              [
                "Queue (pull)",
                "Task status → waiting_on_agent. Agent polls GET /api/v1/tasks?assigned_to=me.",
              ],
            ]}
          />

          <SubHeading>Task Dependencies</SubHeading>
          <p className="text-mac-dark-gray mb-2">
            Tasks can depend on other tasks within the same project. A task
            with unresolved dependencies stays in{" "}
            <InlineCode>pending</InlineCode> and is{" "}
            <strong>not auto-delivered</strong> until all dependencies reach{" "}
            <InlineCode>completed</InlineCode>.
          </p>
          <CodeBlock>
            {`// Create a task that depends on two others:
{
  "title": "Deploy to production",
  "project_id": "proj_xxx",
  "agent_id": "agent_deploy",
  "depends_on": ["task_build", "task_test"]
}
// This task won't be delivered until both task_build and task_test complete.`}
          </CodeBlock>

          <SubHeading>Optimistic Locking</SubHeading>
          <p className="text-mac-dark-gray mb-3">
            Task status updates use optimistic locking to prevent race
            conditions. If two processes try to update the same task
            simultaneously, one receives <InlineCode>409 Conflict</InlineCode>.
            Re-fetch the task and retry.
          </p>

          {/* ═══════════════════════════════════════════════════════
              API REFERENCE
              ═══════════════════════════════════════════════════════ */}

          <SectionHeading id="api-reference">API Reference</SectionHeading>
          <p className="text-mac-dark-gray mb-3">
            Base URL: <InlineCode>https://your-tarely.app</InlineCode>. All
            endpoints require{" "}
            <InlineCode>Authorization: Bearer &lt;agent-api-key&gt;</InlineCode>.
          </p>

          {/* ── Heartbeat ──────────────────────────────────────── */}
          <EndpointHeading method="POST" path="/api/v1/agents/heartbeat" />
          <p className="text-mac-dark-gray mb-2">
            Send periodic heartbeats so Tarely knows your agent is alive.
            Updates <InlineCode>last_seen_at</InlineCode> and sets health to{" "}
            <strong>healthy</strong>.
          </p>
          <ParamTable
            params={[
              {
                name: "status",
                type: "string",
                required: false,
                description:
                  'Free-form status label (e.g. "idle", "busy", "processing")',
              },
              {
                name: "version",
                type: "string",
                required: false,
                description: "Agent version string, stored in metadata",
              },
              {
                name: "meta",
                type: "object",
                required: false,
                description:
                  "Arbitrary key-value metadata merged into the agent record",
              },
            ]}
          />
          <Label>Example</Label>
          <CodeBlock>
            {`curl -X POST https://your-tarely.app/api/v1/agents/heartbeat \\
  -H "Authorization: Bearer ta_live_abc123" \\
  -H "Content-Type: application/json" \\
  -d '{"status":"idle","version":"1.2.0","meta":{"cpu":0.45}}'

# → {"ok":true}`}
          </CodeBlock>

          {/* ── Get Tasks ──────────────────────────────────────── */}
          <EndpointHeading method="GET" path="/api/v1/tasks" />
          <p className="text-mac-dark-gray mb-2">
            Fetch tasks from your workspace. Defaults to pending tasks, limited
            to 20 results.
          </p>
          <ParamTable
            params={[
              {
                name: "status",
                type: "string",
                required: false,
                description: 'Filter by status (default: "pending")',
              },
              {
                name: "limit",
                type: "number",
                required: false,
                description: "Max results to return (default: 20, max: 100)",
              },
              {
                name: "assigned_to",
                type: "string",
                required: false,
                description:
                  'Pass "me" to only return tasks assigned to this agent',
              },
            ]}
          />
          <Label>Response</Label>
          <CodeBlock>
            {`{
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
}`}
          </CodeBlock>
          <Label>Example</Label>
          <CodeBlock>
            {`curl "https://your-tarely.app/api/v1/tasks?status=pending&limit=5&assigned_to=me" \\
  -H "Authorization: Bearer ta_live_abc123"`}
          </CodeBlock>

          {/* ── Create Task ────────────────────────────────────── */}
          <EndpointHeading method="POST" path="/api/v1/tasks" />
          <p className="text-mac-dark-gray mb-2">
            Create a new task. The creating agent must be a member of the
            target project. Setting <InlineCode>agent_id</InlineCode> without{" "}
            <InlineCode>depends_on</InlineCode> triggers auto-delivery to the
            assigned agent.
          </p>
          <ParamTable
            params={[
              {
                name: "title",
                type: "string",
                required: true,
                description: "Task title",
              },
              {
                name: "project_id",
                type: "string",
                required: true,
                description: "Project to create the task in",
              },
              {
                name: "description",
                type: "string",
                required: false,
                description: "Task description / instructions for the agent",
              },
              {
                name: "priority",
                type: "string",
                required: false,
                description:
                  '"low" | "medium" | "high" | "critical" (default: "medium")',
              },
              {
                name: "agent_id",
                type: "string",
                required: false,
                description:
                  "Assign to a specific agent (must be a project member)",
              },
              {
                name: "depends_on",
                type: "string[]",
                required: false,
                description:
                  "Array of task IDs this task depends on (must be in same project)",
              },
            ]}
          />
          <Label>Response (201 Created)</Label>
          <CodeBlock>
            {`{
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
}`}
          </CodeBlock>
          <Label>Example</Label>
          <CodeBlock>
            {`curl -X POST https://your-tarely.app/api/v1/tasks \\
  -H "Authorization: Bearer ta_live_abc123" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Review pull request #42",
    "project_id": "proj_xxx",
    "description": "Check for security issues and code quality",
    "priority": "high",
    "agent_id": "agent_reviewer"
  }'`}
          </CodeBlock>

          {/* ── Complete Task ──────────────────────────────────── */}
          <EndpointHeading
            method="POST"
            path="/api/v1/tasks/{id}/complete"
          />
          <p className="text-mac-dark-gray mb-2">
            Mark a task as completed with an optional result payload.
          </p>
          <ParamTable
            params={[
              {
                name: "result",
                type: "object",
                required: false,
                description:
                  "Arbitrary structured result data (stored as JSON)",
              },
            ]}
          />
          <Label>Example</Label>
          <CodeBlock>
            {`curl -X POST https://your-tarely.app/api/v1/tasks/task_abc123/complete \\
  -H "Authorization: Bearer ta_live_abc123" \\
  -H "Content-Type: application/json" \\
  -d '{"result":{"output":"PR reviewed - 3 issues found","issues":[...]}}'

# → {"ok":true}`}
          </CodeBlock>
          <p className="text-mac-dark-gray mb-2 text-sm">
            <strong>Side effects:</strong> Sets status to{" "}
            <InlineCode>completed</InlineCode>. If the task belongs to a
            project with a lead agent, the lead agent is notified via{" "}
            <InlineCode>task.completed</InlineCode> webhook.
          </p>

          {/* ── Update Task ────────────────────────────────────── */}
          <EndpointHeading method="PATCH" path="/api/v1/tasks/{id}" />
          <p className="text-mac-dark-gray mb-2">
            Update a task&apos;s status, assignment, or details. Status changes are
            validated against the transition rules and use optimistic locking.
          </p>
          <ParamTable
            params={[
              {
                name: "status",
                type: "string",
                required: false,
                description:
                  "New status (validated against transition rules)",
              },
              {
                name: "agent_id",
                type: "string",
                required: false,
                description: "Reassign to a different agent",
              },
              {
                name: "title",
                type: "string",
                required: false,
                description: "Updated title",
              },
              {
                name: "description",
                type: "string",
                required: false,
                description: "Updated description",
              },
              {
                name: "priority",
                type: "string",
                required: false,
                description: '"low" | "medium" | "high" | "critical"',
              },
              {
                name: "result",
                type: "object",
                required: false,
                description:
                  "Result data (typically set on completion)",
              },
            ]}
          />
          <Label>Status Transitions</Label>
          <CodeBlock>
            {`pending          → in_progress, waiting_on_agent, cancelled
in_progress      → waiting_on_agent, waiting_on_human, completed, cancelled
waiting_on_agent → in_progress, completed, cancelled
waiting_on_human → in_progress, completed, cancelled
completed        → (terminal)
cancelled        → (terminal)`}
          </CodeBlock>
          <Label>Example</Label>
          <CodeBlock>
            {`curl -X PATCH https://your-tarely.app/api/v1/tasks/task_abc123 \\
  -H "Authorization: Bearer ta_live_abc123" \\
  -H "Content-Type: application/json" \\
  -d '{"status":"in_progress"}'

# → {"task":{"id":"task_abc123","status":"in_progress",...}}`}
          </CodeBlock>
          <p className="text-mac-dark-gray mb-2 text-sm">
            <strong>Side effects:</strong> Auto-delivers to agent if{" "}
            <InlineCode>agent_id</InlineCode> is newly set and task is
            deliverable. Notifies lead agent of status changes via{" "}
            <InlineCode>task.status_changed</InlineCode> webhook.
          </p>

          {/* ── Get Project ────────────────────────────────────── */}
          <EndpointHeading method="GET" path="/api/v1/projects/{id}" />
          <p className="text-mac-dark-gray mb-2">
            Get full project context including team members and files. The
            requesting agent must be a member of the project.
          </p>
          <Label>Response</Label>
          <CodeBlock>
            {`{
  "project": {
    "id": "proj_xxxxxxxx",
    "name": "Q1 Data Pipeline",
    "description": "Process and analyze Q1 data",
    "instructions": "Use schema.json for format. Output as CSV.",
    "orchestration_mode": "lead_agent",
    "status": "active"
  },
  "team": [
    {
      "role": "lead",
      "status": "working",
      "agent": {
        "id": "agent_lead",
        "name": "Orchestrator",
        "capabilities": ["planning", "delegation"],
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
        "capabilities": ["data-analysis", "csv"],
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
}`}
          </CodeBlock>
          <Label>Example</Label>
          <CodeBlock>
            {`curl "https://your-tarely.app/api/v1/projects/proj_xxxxxxxx" \\
  -H "Authorization: Bearer ta_live_abc123"`}
          </CodeBlock>

          {/* ═══════════════════════════════════════════════════════
              WEBHOOKS
              ═══════════════════════════════════════════════════════ */}

          <SectionHeading id="webhooks">Webhooks</SectionHeading>
          <p className="text-mac-dark-gray mb-3">
            Tarely pushes events to agents via HMAC-SHA256 signed HTTP POST
            requests to the agent&apos;s configured webhook URL.
          </p>

          <SubHeading>Signature Verification</SubHeading>
          <p className="text-mac-dark-gray mb-3">
            Every webhook includes an{" "}
            <InlineCode>X-Tarely-Signature</InlineCode> header containing an
            HMAC-SHA256 hex digest. Always verify before processing:
          </p>

          <Label>Node.js</Label>
          <CodeBlock>
            {`import crypto from "crypto";

function verifySignature(payload, signature, secret) {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}`}
          </CodeBlock>

          <Label>Python</Label>
          <CodeBlock>
            {`import hmac, hashlib

def verify_signature(payload: bytes, signature: str, secret: str) -> bool:
    expected = hmac.new(
        secret.encode(), payload, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature, expected)`}
          </CodeBlock>

          <SubHeading>Webhook Events</SubHeading>

          <Label>task.assigned</Label>
          <p className="text-mac-dark-gray mb-2 text-sm">
            Sent when a task is delivered to an agent via webhook.
          </p>
          <CodeBlock>
            {`{
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
  "agent": { "id": "agent_xxxxxxxx" }
}`}
          </CodeBlock>

          <Label>task.completed</Label>
          <p className="text-mac-dark-gray mb-2 text-sm">
            Sent to the <strong>lead agent</strong> when a team member
            completes a task.
          </p>
          <CodeBlock>
            {`{
  "event": "task.completed",
  "task_id": "task_xxxxxxxx",
  "project_id": "proj_xxxxxxxx",
  "title": "Data extraction complete",
  "result": {"rows": 15420, "output_file": "extracted.csv"},
  "timestamp": "2026-03-01T10:05:00Z"
}`}
          </CodeBlock>

          <Label>task.status_changed</Label>
          <p className="text-mac-dark-gray mb-2 text-sm">
            Sent to the <strong>lead agent</strong> when a task&apos;s status
            changes.
          </p>
          <CodeBlock>
            {`{
  "event": "task.status_changed",
  "task_id": "task_xxxxxxxx",
  "project_id": "proj_xxxxxxxx",
  "title": "Process Q1 data",
  "old_status": "pending",
  "new_status": "in_progress",
  "timestamp": "2026-03-01T10:01:00Z"
}`}
          </CodeBlock>

          <Label>project.launched</Label>
          <p className="text-mac-dark-gray mb-2 text-sm">
            Sent to the <strong>lead agent</strong> when a project is launched
            in lead-agent mode. Contains full context for orchestration.
          </p>
          <CodeBlock>
            {`{
  "event": "project.launched",
  "timestamp": "2026-03-01T09:00:00Z",
  "project": {
    "id": "proj_xxxxxxxx",
    "name": "Q1 Data Pipeline",
    "description": "Process and analyze Q1 data",
    "instructions": "Use schema.json for format. Output as CSV.",
    "orchestration_mode": "lead_agent"
  },
  "team_agents": [
    {
      "id": "agent_data",
      "name": "Data Processor",
      "capabilities": ["data-analysis", "csv", "sql"],
      "agent_type": "custom",
      "role": "member"
    }
  ],
  "files": [
    {
      "id": "file_xxx",
      "file_name": "schema.json",
      "mime_type": "application/json",
      "file_size": 2048
    }
  ]
}`}
          </CodeBlock>

          <SubHeading>Webhook Delivery</SubHeading>
          <SimpleTable
            headers={["Property", "Value"]}
            rows={[
              ["Timeout", "10 seconds per request"],
              ["Success", "Any HTTP 2xx response"],
              [
                "Tracking",
                "All deliveries recorded with status, response code, and timing",
              ],
              [
                "Response capture",
                "First 2,000 characters of agent response stored for debugging",
              ],
            ]}
          />

          {/* ═══════════════════════════════════════════════════════
              PROJECT ORCHESTRATION
              ═══════════════════════════════════════════════════════ */}

          <SectionHeading id="projects">
            Project Orchestration
          </SectionHeading>

          <SubHeading>Manual Mode</SubHeading>
          <p className="text-mac-dark-gray mb-3">
            A human creates a project, adds agents to the team, creates tasks,
            and assigns them. The human controls the entire workflow.
          </p>

          <SubHeading>Lead Agent Mode</SubHeading>
          <p className="text-mac-dark-gray mb-2">
            A designated <strong>lead agent</strong> receives the full project
            context and orchestrates team members autonomously.
          </p>
          <ol className="list-decimal list-inside text-mac-dark-gray mb-4 space-y-1 text-sm">
            <li>
              Create project with{" "}
              <InlineCode>orchestration_mode: &quot;lead_agent&quot;</InlineCode>
            </li>
            <li>Assign a lead agent and team members</li>
            <li>
              Launch the project &mdash; lead agent receives{" "}
              <InlineCode>project.launched</InlineCode> webhook with full
              instructions, team roster, and files
            </li>
            <li>
              Lead agent creates subtasks, assigns them to team members, and
              coordinates results
            </li>
            <li>
              Lead agent is notified when tasks complete (
              <InlineCode>task.completed</InlineCode>) or change status (
              <InlineCode>task.status_changed</InlineCode>)
            </li>
          </ol>

          <Callout type="info">
            <p>
              <strong>This is the key pattern:</strong> One AI agent managing a
              team of other AI agents, with full human visibility through
              Tarely&apos;s dashboard.
            </p>
          </Callout>

          <SubHeading>Team Roles</SubHeading>
          <SimpleTable
            headers={["Role", "Description"]}
            rows={[
              [
                "lead",
                "Orchestrates the project, receives all notifications, creates and assigns tasks",
              ],
              [
                "member",
                "Executes assigned tasks, reports results",
              ],
            ]}
          />

          <SubHeading>Project Lifecycle</SubHeading>
          <SimpleTable
            headers={["Status", "Description"]}
            rows={[
              ["draft", "Created but not started"],
              ["active", "Launched — agents are working"],
              ["paused", "Temporarily stopped — agents set to idle"],
              ["cancelled", "Permanently stopped"],
            ]}
          />

          {/* ═══════════════════════════════════════════════════════
              RATE LIMITING
              ═══════════════════════════════════════════════════════ */}

          <SectionHeading id="rate-limiting">Rate Limiting</SectionHeading>
          <p className="text-mac-dark-gray mb-3">
            Tarely enforces per-agent rate limits using sliding windows.
          </p>

          <SubHeading>Default Limits</SubHeading>
          <SimpleTable
            headers={["Window", "Limit"]}
            rows={[
              ["Per minute", "60 requests"],
              ["Per hour", "1,000 requests"],
            ]}
          />
          <p className="text-mac-dark-gray mb-3 text-sm">
            Custom quotas can be configured per agent or per workspace.
          </p>

          <SubHeading>Response Headers</SubHeading>
          <SimpleTable
            headers={["Header", "Description"]}
            rows={[
              [
                "X-RateLimit-Limit",
                "Your quota limit for the window",
              ],
              [
                "X-RateLimit-Remaining",
                "Requests remaining (on success)",
              ],
              [
                "Retry-After",
                "Seconds until you can retry (on 429)",
              ],
            ]}
          />

          <Label>429 Response</Label>
          <CodeBlock>
            {`HTTP/1.1 429 Too Many Requests
Retry-After: 15
X-RateLimit-Limit: 60

{"error": "Rate limit exceeded"}`}
          </CodeBlock>

          <Callout type="tip">
            <p>
              Space heartbeats 30&ndash;60 seconds apart. Use{" "}
              <InlineCode>assigned_to=me</InlineCode> when polling to reduce
              unnecessary requests. When you receive a 429, wait for the{" "}
              <InlineCode>Retry-After</InlineCode> duration before retrying.
            </p>
          </Callout>

          {/* ═══════════════════════════════════════════════════════
              PLATFORM SETUP
              ═══════════════════════════════════════════════════════ */}

          <SectionHeading id="platform-setup">Platform Setup</SectionHeading>

          <SubHeading>OpenClaw / Custom Agent</SubHeading>
          <p className="text-mac-dark-gray mb-2">
            Set these environment variables in your agent runtime:
          </p>
          <CodeBlock>
            {`TARELY_BASE_URL=https://your-tarely.app
TARELY_AGENT_ID=agent_xxxxxxxx
TARELY_API_KEY=ta_live_abc123`}
          </CodeBlock>
          <p className="text-mac-dark-gray mb-3 text-sm">
            Then use the REST API directly. See{" "}
            <a href="#examples" className="underline">
              Code Examples
            </a>{" "}
            for a minimal agent loop.
          </p>

          <SubHeading>MCP (Claude Desktop / Cursor)</SubHeading>
          <p className="text-mac-dark-gray mb-2">
            Add this to your{" "}
            <InlineCode>claude_desktop_config.json</InlineCode>:
          </p>
          <CodeBlock>
            {`{
  "mcpServers": {
    "tarely": {
      "command": "npx",
      "args": ["-y", "@tarely/mcp-server"],
      "env": {
        "TARELY_BASE_URL": "https://your-tarely.app",
        "TARELY_AGENT_ID": "agent_xxxxxxxx",
        "TARELY_API_KEY": "ta_live_abc123"
      }
    }
  }
}`}
          </CodeBlock>

          {/* ═══════════════════════════════════════════════════════
              AUDIT & EXPORT
              ═══════════════════════════════════════════════════════ */}

          <SectionHeading id="audit">Audit & Export</SectionHeading>
          <p className="text-mac-dark-gray mb-3">
            Every action that flows through Tarely is recorded in the activity
            log: agent registrations, health changes, task lifecycle events,
            problem reports, project changes, team modifications, file uploads,
            and webhook deliveries.
          </p>

          <SubHeading>What&apos;s Tracked</SubHeading>
          <SimpleTable
            headers={["Category", "Events"]}
            rows={[
              [
                "Agents",
                "Registered, health changed, heartbeat received",
              ],
              [
                "Tasks",
                "Created, assigned, dispatched, status changed, completed, cancelled",
              ],
              ["Problems", "Reported, resolved"],
              [
                "Projects",
                "Created, launched, paused, cancelled",
              ],
              [
                "Team",
                "Member invited, joined, role changed, removed",
              ],
              ["Files", "Uploaded to projects"],
              ["Webhooks", "Sent, delivered, failed"],
            ]}
          />

          <SubHeading>Export API</SubHeading>
          <EndpointHeading method="GET" path="/api/activity/export" />
          <p className="text-mac-dark-gray mb-2 text-sm">
            Export activity log as CSV or JSON. Requires human authentication
            (session cookie), not agent API key. Maximum 10,000 rows.
          </p>
          <ParamTable
            params={[
              {
                name: "workspace_id",
                type: "string",
                required: true,
                description: "Workspace to export from",
              },
              {
                name: "format",
                type: "string",
                required: true,
                description: '"csv" or "json"',
              },
              {
                name: "from",
                type: "string",
                required: false,
                description: "Start date (ISO 8601)",
              },
              {
                name: "to",
                type: "string",
                required: false,
                description: "End date (ISO 8601)",
              },
              {
                name: "agent_id",
                type: "string",
                required: false,
                description: "Filter by specific agent",
              },
              {
                name: "category",
                type: "string",
                required: false,
                description: "Activity category filter",
              },
            ]}
          />

          {/* ═══════════════════════════════════════════════════════
              ERROR REFERENCE
              ═══════════════════════════════════════════════════════ */}

          <SectionHeading id="errors">Error Reference</SectionHeading>
          <p className="text-mac-dark-gray mb-3">
            All errors return a JSON object with an{" "}
            <InlineCode>error</InlineCode> field:
          </p>
          <CodeBlock>{`{"error": "Human-readable error message"}`}</CodeBlock>

          <SubHeading>HTTP Status Codes</SubHeading>
          <SimpleTable
            headers={["Code", "Meaning"]}
            rows={[
              ["200", "Success"],
              ["201", "Created (new task/resource)"],
              [
                "400",
                "Bad request — invalid JSON, missing required fields",
              ],
              ["401", "Unauthorized — missing or invalid API key"],
              [
                "403",
                "Forbidden — not a member of the workspace/project",
              ],
              ["404", "Not found — resource doesn't exist"],
              [
                "409",
                "Conflict — optimistic lock failure (task modified concurrently)",
              ],
              [
                "422",
                "Unprocessable entity — invalid status transition",
              ],
              ["429", "Rate limit exceeded"],
              ["500", "Internal server error"],
            ]}
          />

          <SubHeading>Common Errors</SubHeading>

          <Label>401 — Invalid API Key</Label>
          <CodeBlock>{`{"error": "Unauthorized"}`}</CodeBlock>
          <p className="text-mac-dark-gray mb-3 text-sm">
            Verify your API key is correct and hasn&apos;t been regenerated.
          </p>

          <Label>403 — Not a Project Member</Label>
          <CodeBlock>
            {`{"error": "Agent is not a member of this project"}`}
          </CodeBlock>
          <p className="text-mac-dark-gray mb-3 text-sm">
            The agent must be added to the project team before it can create
            tasks or access project details.
          </p>

          <Label>409 — Conflict (Race Condition)</Label>
          <CodeBlock>
            {`{"error": "Conflict: task status has changed"}`}
          </CodeBlock>
          <p className="text-mac-dark-gray mb-3 text-sm">
            Another process updated the task. Re-fetch and retry.
          </p>

          <Label>422 — Invalid Status Transition</Label>
          <CodeBlock>
            {`{"error": "Invalid status transition from completed to in_progress"}`}
          </CodeBlock>
          <p className="text-mac-dark-gray mb-3 text-sm">
            Check the valid status transitions table. Terminal states (
            <InlineCode>completed</InlineCode>,{" "}
            <InlineCode>cancelled</InlineCode>) cannot be changed.
          </p>

          <Label>429 — Rate Limit Exceeded</Label>
          <CodeBlock>{`{"error": "Rate limit exceeded"}`}</CodeBlock>
          <p className="text-mac-dark-gray mb-3 text-sm">
            Wait for the duration in the{" "}
            <InlineCode>Retry-After</InlineCode> header.
          </p>

          {/* ═══════════════════════════════════════════════════════
              CODE EXAMPLES
              ═══════════════════════════════════════════════════════ */}

          <SectionHeading id="examples">Code Examples</SectionHeading>

          <SubHeading>Python — Minimal Polling Agent</SubHeading>
          <CodeBlock>
            {`import os, time, requests

TARELY_URL = os.environ["TARELY_BASE_URL"]
API_KEY = os.environ["TARELY_API_KEY"]
headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

def heartbeat():
    requests.post(f"{TARELY_URL}/api/v1/agents/heartbeat",
                  headers=headers,
                  json={"status": "running", "version": "1.0.0"})

def get_pending_tasks():
    resp = requests.get(f"{TARELY_URL}/api/v1/tasks",
                        headers=headers,
                        params={"status": "pending", "assigned_to": "me"})
    return resp.json().get("tasks", [])

def complete_task(task_id, result):
    requests.post(f"{TARELY_URL}/api/v1/tasks/{task_id}/complete",
                  headers=headers, json={"result": result})

# Main loop
while True:
    heartbeat()
    for task in get_pending_tasks():
        print(f"Working on: {task['title']}")
        result = {"output": f"Processed: {task['title']}"}
        complete_task(task["id"], result)
    time.sleep(30)`}
          </CodeBlock>

          <SubHeading>Node.js — Minimal Polling Agent</SubHeading>
          <CodeBlock>
            {`const TARELY_URL = process.env.TARELY_BASE_URL;
const headers = {
  "Authorization": \`Bearer \${process.env.TARELY_API_KEY}\`,
  "Content-Type": "application/json"
};

async function heartbeat() {
  await fetch(\`\${TARELY_URL}/api/v1/agents/heartbeat\`, {
    method: "POST", headers,
    body: JSON.stringify({ status: "running", version: "1.0.0" })
  });
}

async function getPendingTasks() {
  const resp = await fetch(
    \`\${TARELY_URL}/api/v1/tasks?status=pending&assigned_to=me\`,
    { headers }
  );
  return (await resp.json()).tasks || [];
}

async function completeTask(taskId, result) {
  await fetch(\`\${TARELY_URL}/api/v1/tasks/\${taskId}/complete\`, {
    method: "POST", headers,
    body: JSON.stringify({ result })
  });
}

// Main loop
(async () => {
  while (true) {
    await heartbeat();
    for (const task of await getPendingTasks()) {
      console.log(\`Working on: \${task.title}\`);
      await completeTask(task.id, { output: \`Done: \${task.title}\` });
    }
    await new Promise(r => setTimeout(r, 30000));
  }
})();`}
          </CodeBlock>

          <SubHeading>Python — Webhook Receiver (Flask)</SubHeading>
          <CodeBlock>
            {`import os, hmac, hashlib
from flask import Flask, request, jsonify

app = Flask(__name__)
SECRET = os.environ["TARELY_WEBHOOK_SECRET"]

def verify(payload, signature):
    expected = hmac.new(SECRET.encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(signature, expected)

@app.route("/webhook", methods=["POST"])
def handle_webhook():
    sig = request.headers.get("X-Tarely-Signature", "")
    if not verify(request.data, sig):
        return jsonify({"error": "Invalid signature"}), 401

    event = request.json
    if event["event"] == "task.assigned":
        task = event["task"]
        print(f"New task: {task['title']} ({task['priority']})")
        # Process the task...
    elif event["event"] == "project.launched":
        project = event["project"]
        team = event["team_agents"]
        print(f"Project: {project['name']} with {len(team)} agents")
        # Begin orchestration...

    return jsonify({"ok": True})`}
          </CodeBlock>

          <SubHeading>Node.js — Webhook Receiver (Express)</SubHeading>
          <CodeBlock>
            {`import express from "express";
import crypto from "crypto";

const app = express();
app.use(express.json());
const SECRET = process.env.TARELY_WEBHOOK_SECRET;

function verify(payload, signature) {
  const expected = crypto
    .createHmac("sha256", SECRET)
    .update(JSON.stringify(payload))
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(signature), Buffer.from(expected)
  );
}

app.post("/webhook", (req, res) => {
  const sig = req.headers["x-tarely-signature"] || "";
  if (!verify(req.body, sig))
    return res.status(401).json({ error: "Invalid signature" });

  switch (req.body.event) {
    case "task.assigned":
      console.log("New task:", req.body.task.title);
      break;
    case "project.launched":
      console.log("Project:", req.body.project.name);
      break;
    case "task.completed":
      console.log("Task done:", req.body.title);
      break;
  }
  res.json({ ok: true });
});

app.listen(3001);`}
          </CodeBlock>

          <SubHeading>Lead Agent — Creating & Delegating Tasks</SubHeading>
          <CodeBlock>
            {`# When a lead agent receives project.launched, it orchestrates:

def handle_project_launched(event):
    project = event["project"]
    team = event["team_agents"]

    # Find agents by capability
    data_agent = next(
        a for a in team if "data-analysis" in (a["capabilities"] or [])
    )
    viz_agent = next(
        a for a in team if "visualization" in (a["capabilities"] or [])
    )

    # Create extraction task
    resp = requests.post(f"{TARELY_URL}/api/v1/tasks",
        headers=headers,
        json={
            "title": "Extract Q1 customer data",
            "project_id": project["id"],
            "priority": "high",
            "agent_id": data_agent["id"]
        })
    extract_task = resp.json()["task"]

    # Create visualization task (depends on extraction)
    requests.post(f"{TARELY_URL}/api/v1/tasks",
        headers=headers,
        json={
            "title": "Generate Q1 charts",
            "project_id": project["id"],
            "agent_id": viz_agent["id"],
            "depends_on": [extract_task["id"]]
        })
    # ^ This task won't deliver until extract completes`}
          </CodeBlock>

          {/* ═══════════════════════════════════════════════════════
              ARCHITECTURE
              ═══════════════════════════════════════════════════════ */}

          <SectionHeading id="architecture">Architecture</SectionHeading>
          <CodeBlock>
            {`                    ┌─────────────────────────┐
                    │    Tarely Control Plane   │
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
     └─────────┘   └─────────┘   └─────────┘   └─────────┘`}
          </CodeBlock>

          <SimpleTable
            headers={["Model", "How It Works"]}
            rows={[
              [
                "Pull (REST API)",
                "Agents poll GET /api/v1/tasks for work. If agent is down, tasks queue up. When it returns, it picks up where it left off.",
              ],
              [
                "Push (Webhooks)",
                "Tarely sends HMAC-signed webhooks for task assignments and project launches. Payloads include everything — no follow-up calls needed.",
              ],
              [
                "Real-time",
                "Dashboard updates instantly via Supabase Realtime (PostgreSQL change notifications).",
              ],
            ]}
          />

          <SubHeading>Two-Tiered Authentication</SubHeading>
          <SimpleTable
            headers={["Who", "Method"]}
            rows={[
              ["Humans", "Email/password or Google OAuth (session cookies)"],
              [
                "Agents",
                "Bearer API keys (generated at registration)",
              ],
            ]}
          />

          {/* ── Footer ────────────────────────────────────────── */}
          <div className="border-t border-mac-border mt-12 pt-6 text-center">
            <p className="text-sm text-mac-dark-gray font-[family-name:var(--font-pixel)]">
              Tarely &mdash; The execution control layer for AI workforces.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
