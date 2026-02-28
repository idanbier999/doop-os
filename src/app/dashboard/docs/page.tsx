import type { Metadata } from "next";

export const metadata: Metadata = { title: "API Docs | Tarely" };

/* ── Inline helper components ─────────────────────────────────── */

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-2xl font-bold font-[family-name:var(--font-pixel)] text-mac-black border-b border-mac-border pb-2 mt-10 mb-4">
      {children}
    </h2>
  );
}

function EndpointHeading({
  method,
  path,
}: {
  method: "GET" | "POST";
  path: string;
}) {
  const color = method === "POST" ? "bg-green-600" : "bg-blue-600";
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
  params: { name: string; type: string; required: boolean; description: string }[];
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

/* ── Page ──────────────────────────────────────────────────────── */

export default function ApiDocsPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mac-window">
        <div className="mac-title-bar">
          <div className="mac-close-box" />
          <span className="mac-title-bar-title">API Quick Reference</span>
        </div>

        <div className="p-6">
          <h1 className="text-3xl font-bold font-[family-name:var(--font-pixel)] text-mac-black mb-1">
            Tarely API
          </h1>
          <p className="text-mac-dark-gray mb-6">
            Everything your agents need to communicate with the Tarely platform.
          </p>

          {/* ── 1. Authentication ────────────────────────────── */}
          <SectionHeading>Authentication</SectionHeading>
          <p className="text-mac-dark-gray mb-3">
            Every request must include a Bearer token in the{" "}
            <code className="bg-mac-light-gray px-1.5 py-0.5 rounded text-sm font-mono">
              Authorization
            </code>{" "}
            header. API keys are generated when you create an agent and are
            shown only once.
          </p>
          <CodeBlock>{`Authorization: Bearer <agent-api-key>`}</CodeBlock>

          {/* ── 2. Endpoints ─────────────────────────────────── */}
          <SectionHeading>Endpoints</SectionHeading>

          {/* Heartbeat */}
          <EndpointHeading method="POST" path="/api/v1/agents/heartbeat" />
          <p className="text-mac-dark-gray mb-2">
            Send periodic heartbeats so Tarely knows your agent is alive.
            Updates <code className="bg-mac-light-gray px-1.5 py-0.5 rounded text-sm font-mono">last_seen_at</code> and
            sets health to <strong>healthy</strong>.
          </p>
          <ParamTable
            params={[
              {
                name: "status",
                type: "string",
                required: false,
                description: "Free-form status label (e.g. \"idle\", \"busy\")",
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
                description: "Arbitrary key-value metadata merged into the agent record",
              },
            ]}
          />
          <p className="text-xs text-mac-dark-gray mb-1 font-[family-name:var(--font-pixel)]">
            Example
          </p>
          <CodeBlock>
            {`curl -X POST https://your-tarely.app/api/v1/agents/heartbeat \\
  -H "Authorization: Bearer ta_live_abc123" \\
  -H "Content-Type: application/json" \\
  -d '{"status":"idle","version":"1.2.0"}'

# → {"ok":true}`}
          </CodeBlock>

          {/* Get Tasks */}
          <EndpointHeading method="GET" path="/api/v1/tasks" />
          <p className="text-mac-dark-gray mb-2">
            Fetch tasks assigned to your workspace. Defaults to pending tasks,
            limited to 20 results.
          </p>
          <ParamTable
            params={[
              {
                name: "status",
                type: "string",
                required: false,
                description: "Filter by status (default: \"pending\")",
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
                description: "Pass \"me\" to only return tasks assigned to this agent",
              },
            ]}
          />
          <p className="text-xs text-mac-dark-gray mb-1 font-[family-name:var(--font-pixel)]">
            Example
          </p>
          <CodeBlock>
            {`curl "https://your-tarely.app/api/v1/tasks?status=pending&limit=5&assigned_to=me" \\
  -H "Authorization: Bearer ta_live_abc123"

# → {"tasks":[{"id":"...","title":"...","status":"pending",...}]}`}
          </CodeBlock>

          {/* Complete Task */}
          <EndpointHeading
            method="POST"
            path="/api/v1/tasks/{id}/complete"
          />
          <p className="text-mac-dark-gray mb-2">
            Mark a task as completed. Optionally include a result payload.
          </p>
          <ParamTable
            params={[
              {
                name: "result",
                type: "object",
                required: false,
                description: "Arbitrary result data attached to the completed task",
              },
            ]}
          />
          <p className="text-xs text-mac-dark-gray mb-1 font-[family-name:var(--font-pixel)]">
            Example
          </p>
          <CodeBlock>
            {`curl -X POST https://your-tarely.app/api/v1/tasks/task_abc123/complete \\
  -H "Authorization: Bearer ta_live_abc123" \\
  -H "Content-Type: application/json" \\
  -d '{"result":{"output":"Processed 42 records"}}'

# → {"ok":true}`}
          </CodeBlock>

          {/* ── 3. Platform Setup ────────────────────────────── */}
          <SectionHeading>Platform Setup</SectionHeading>

          <h3 className="text-lg font-bold font-[family-name:var(--font-pixel)] text-mac-black mt-6 mb-2">
            OpenClaw / Custom Agent
          </h3>
          <p className="text-mac-dark-gray mb-2">
            Set these three environment variables in your agent runtime:
          </p>
          <CodeBlock>
            {`TARELY_BASE_URL=https://your-tarely.app
TARELY_AGENT_ID=agent_xxxxxxxx
TARELY_API_KEY=ta_live_abc123`}
          </CodeBlock>

          <h3 className="text-lg font-bold font-[family-name:var(--font-pixel)] text-mac-black mt-6 mb-2">
            MCP (Claude Desktop)
          </h3>
          <p className="text-mac-dark-gray mb-2">
            Add this to your{" "}
            <code className="bg-mac-light-gray px-1.5 py-0.5 rounded text-sm font-mono">
              claude_desktop_config.json
            </code>
            :
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

          {/* ── 4. Webhooks ──────────────────────────────────── */}
          <SectionHeading>Webhooks</SectionHeading>
          <p className="text-mac-dark-gray mb-3">
            Tarely signs every webhook payload with{" "}
            <code className="bg-mac-light-gray px-1.5 py-0.5 rounded text-sm font-mono">
              X-Tarely-Signature
            </code>{" "}
            using HMAC-SHA256. Verify it before processing:
          </p>
          <CodeBlock>
            {`import crypto from "crypto";

function verifySignature(payload: string, signature: string, secret: string) {
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

          <h3 className="text-lg font-bold font-[family-name:var(--font-pixel)] text-mac-black mt-6 mb-2">
            Event Payloads
          </h3>

          <p className="text-xs text-mac-dark-gray mb-1 font-[family-name:var(--font-pixel)]">
            project.launched
          </p>
          <CodeBlock>
            {`{
  "event": "project.launched",
  "project_id": "proj_xxxxxxxx",
  "workspace_id": "ws_xxxxxxxx",
  "timestamp": "2026-02-28T12:00:00Z"
}`}
          </CodeBlock>

          <p className="text-xs text-mac-dark-gray mb-1 font-[family-name:var(--font-pixel)]">
            task.assigned
          </p>
          <CodeBlock>
            {`{
  "event": "task.assigned",
  "task_id": "task_xxxxxxxx",
  "agent_id": "agent_xxxxxxxx",
  "workspace_id": "ws_xxxxxxxx",
  "timestamp": "2026-02-28T12:00:00Z"
}`}
          </CodeBlock>
        </div>
      </div>
    </div>
  );
}
