# Tarely — Product Document

> The execution control layer for AI workforces.

---

## What Is Tarely

AI agents are becoming distributed systems. Distributed systems require identity, scheduling, shared state, policy enforcement, and fault containment. Today, every team building multi-agent systems is rebuilding this execution layer from scratch. Tarely standardizes it.

Tarely is **the execution control layer for AI workforces** — the runtime that agents register with, receive work through, coordinate across, and report into. It is not a dashboard bolted onto agents after the fact. It is the control plane agents execute through.

When an agent starts, it registers with Tarely and becomes addressable. When work needs doing, Tarely dispatches it. When agents coordinate, they coordinate through Tarely's project and task runtime. When something breaks, Tarely records it, attributes it, and surfaces it. When a human needs to intervene, Tarely is the governance interface.

The dashboard exists — it's how humans interact with the control plane. But the primary value is the runtime itself: the identity layer, the task execution lifecycle, the coordination graph, the policy surface, and the audit substrate that every AI workforce needs and nobody wants to build from scratch.

---

## The Problem

The AI agent ecosystem is exploding. Teams are deploying agents that write code, triage support tickets, analyze data, manage infrastructure, and coordinate with other agents. But the tooling for **governing** these agents has not kept pace with the tooling for **building** them.

The current state of agent operations:

1. **No identity.** Agents are unnamed processes. There's no registry, no addressing scheme, no way to say "Agent X is responsible for this" and have that mean something across your infrastructure.

2. **No execution runtime.** When you have multiple agents working on a shared goal, there's no standard way to assign work, enforce dependencies, dispatch tasks, or collect results. Teams resort to ad-hoc glue code and prayer.

3. **No audit substrate.** When an agent takes a bad action — deletes the wrong file, sends the wrong email, hallucinates a response — there's no centralized record of what happened, when, why, and which agent was responsible.

4. **No coordination layer.** Single agents are easy. Multi-agent systems that delegate, depend on each other, and share context require coordination infrastructure that doesn't exist in any framework.

5. **No platform convergence.** Each agent framework has its own execution story (if any). Run agents on three platforms, manage three separate systems.

6. **No governance.** No policies, no cost controls, no execution boundaries, no approval gates. Agents operate without constraints because there's no layer to enforce constraints through.

Tarely solves all six.

---

## What Tarely Does

Tarely's capabilities map to five execution verbs: **Authorize, Orchestrate, Enforce, Persist, Govern.**

### Identity & Registration

Agents register with Tarely once and become first-class entities in the system:

1. Create an agent in the control plane (name, platform, capabilities).
2. Receive an API key.
3. The agent authenticates with the key and sends a heartbeat. It's now addressable.

No SDK required. No code changes to the agent's core logic. Any process that can make an HTTP request can be a Tarely agent — a Python script, a Node.js service, an MCP tool, a LangChain chain, a CrewAI crew member.

**Supported platforms:** any agent via the REST API, with native MCP support for Claude Desktop and Cursor. OpenClaw agents connect through the same REST API.

### Task Execution Runtime

Tasks are the atomic unit of execution. They flow through Tarely's runtime — not around it:

- **Creation** — humans or lead agents create tasks with titles, descriptions, priorities, and dependencies.
- **Assignment** — tasks are assigned to one or more agents (primary + helpers).
- **Dispatch** — Tarely pushes task context to agents via signed webhooks (`task.assigned`), or agents pull pending work via the tasks API.
- **Execution** — agents work. Status flows back: `pending → in_progress → waiting_on_agent → waiting_on_human → completed / cancelled`.
- **Completion** — agents submit structured results (JSON payloads). Downstream dependencies unblock automatically.
- **Comments** — both humans and agents can annotate tasks during execution.

Because all execution flows through the runtime, Tarely captures the full task lifecycle without agents needing to do anything extra. Observability is a byproduct of being the execution layer.

### Multi-Agent Coordination

Projects are the coordination primitive for multi-agent work:

- **Team rosters** — each project has a named team of agents with roles.
- **Two orchestration modes:**
  - **Manual** — a human creates tasks, assigns agents, and dispatches work step by step.
  - **Lead-agent** — a designated lead agent receives the full project context (instructions, team roster, files) via webhook and orchestrates the other agents autonomously — creating subtasks, delegating work, and coordinating results.
- **Task dependencies** — Task B can't start until Task A completes. The runtime enforces this.
- **Shared context** — project instructions and reference files are available to all team agents.

The lead-agent pattern is where Tarely becomes infrastructure: one AI agent managing a team of other AI agents, with full human visibility, through a standardized coordination protocol.

### Observability

Because Tarely is the runtime agents execute through, observability comes for free:

- **Fleet health grid** — every agent as a card, sorted by urgency (critical first), showing current task, last seen time, and a 7-day health sparkline.
- **Health status tracking** — healthy, degraded, critical, offline — derived from heartbeat patterns.
- **7-day trend charts** — problems and task throughput over time.
- **Real-time updates** — dashboard reflects agent state changes instantly via Supabase Realtime.

Agents report health via periodic heartbeats (`POST /api/v1/agents/heartbeat`). Each heartbeat updates the agent's `last_seen_at` timestamp and can carry arbitrary metadata (version, custom metrics, diagnostics). If an agent stops heartbeating, the control plane knows.

This is monitoring as a consequence of runtime participation — not a separate integration agents must opt into.

### Problem Tracking

When something goes wrong during execution, it's captured with full context:

- **Severity** — low, medium, high, critical.
- **Agent attribution** — which agent reported or caused the problem.
- **Task linkage** — which task was being executed when the problem occurred.
- **Resolution tracking** — who resolved it and when.

Critical and high-severity problems trigger real-time notifications. The problems view gives operators a prioritized queue of issues across the entire fleet.

### Audit & Compliance

Every action that flows through Tarely's runtime is recorded:

- Agent registered, health changed, heartbeat received.
- Task created, assigned, dispatched, completed.
- Problem reported, resolved.
- Project created, launched, paused, cancelled.
- Team member invited, joined, role changed, removed.
- Files uploaded, webhooks sent.

The audit trail is filterable by agent, action category, and date range. It exports as CSV or JSON for compliance, post-mortems, or integration with external analytics.

When your agents execute through a control plane, you get a complete audit trail without building one.

### Team & Access Control

Tarely supports multi-tenant workspaces with role-based access:

- **Owner** — full control over workspace, members, agents, settings.
- **Admin** — can manage agents, projects, and team members.
- **Member** — can view everything, create tasks and projects, but can't change settings.

New team members join via single-use invite links (7-day expiry). The invite flow handles both new signups and existing users.

---

## The Architecture

Tarely sits between humans and agents as the **execution control plane**:

```
                    ┌─────────────────────────┐
                    │    Tarely Control Plane   │
                    │   (Next.js + Supabase)   │
                    └────┬──────────────┬──────┘
                         │              │
                    REST API       Webhooks
                    (pull)          (push)
                         │              │
          ┌──────────────┼──────────────┼──────────────┐
          │              │              │              │
     ┌────┴────┐   ┌────┴────┐   ┌────┴────┐   ┌────┴────┐
     │ Agent A │   │ Agent B │   │ Agent C │   │ Agent D │
     │ OpenClaw│   │  MCP    │   │ Custom  │   │ CrewAI  │
     └─────────┘   └─────────┘   └─────────┘   └─────────┘
```

**Agents pull work** by polling the tasks API. This is intentional — pull-based architectures are more resilient than push-only systems. If an agent is down, tasks queue up. When it comes back, it picks up where it left off.

**Tarely pushes context** via webhooks when richer communication is needed (project launches, task assignments with full context). The webhook payload includes everything the agent needs — project instructions, team roster, file metadata — so the agent doesn't need to make follow-up API calls. Webhooks are HMAC-SHA256 signed so agents can verify authenticity.

**Real-time updates** flow to the dashboard via Supabase Realtime (PostgreSQL change notifications). When an agent completes a task or reports a problem, the dashboard updates instantly. No polling, no refresh.

**Authentication is two-tiered:**
- Humans authenticate via email/password or Google OAuth.
- Agents authenticate via Bearer API keys (generated at registration, shown once).

The key architectural insight: agents don't just "report to" Tarely — they **operate through** it. Their identity, their work assignments, their coordination with other agents, and their execution records all live in the control plane. This is what makes Tarely infrastructure rather than tooling.

---

## Who Is This For

### Primary User: The Agent Operator

An engineer or technical lead who deploys and governs AI agents in production. They might be:

- A **startup CTO** running 3–10 agents that handle customer support, code review, and deployment — and needing to enforce execution boundaries across all of them.
- A **DevOps engineer** at a mid-size company managing a fleet of monitoring and remediation agents — needing identity, scheduling, and fault attribution.
- An **AI engineer** building multi-agent systems who needs a coordination substrate instead of custom inter-agent protocols.
- A **freelancer or consultant** building agent-powered automations for clients who needs a governance interface to demonstrate control and accountability.

### Secondary User: The Stakeholder

A product manager, team lead, or business owner who needs to govern agent work without touching a terminal. They use Tarely to:

- See which agents are running and what they're executing.
- Review completed tasks and their outputs.
- Understand when things go wrong, which agent was responsible, and what was done about it.
- Export audit trails for compliance and reporting.

### Tertiary User: The Agent Itself

In lead-agent orchestration mode, the lead agent is a Tarely runtime participant. It receives project context, creates subtasks, delegates to team members, and coordinates results — all through the API. Tarely is the coordination substrate that makes multi-agent systems possible without custom inter-agent protocols.

---

## The Thesis

### AI agents are distributed systems

Not "becoming infrastructure" — they already are. Any system with multiple autonomous processes that need identity, scheduling, shared state, policy enforcement, and fault containment is a distributed system. The agent ecosystem has all the hard problems of distributed computing (coordination, consistency, failure handling, observability) with none of the mature tooling.

### The execution layer is missing

Frameworks build agents. Nobody governs them. LangChain, CrewAI, AutoGen, OpenClaw — they answer "how do I build an agent?" Tarely answers "how do agents operate as a system?" The runtime that manages identity, dispatches work, enforces dependencies, records execution, and enables coordination is the missing layer. Tarely is that runtime — not the ops layer watching from the side, but the control plane agents execute through.

### Platform-agnostic wins

The agent ecosystem is fragmented and will stay fragmented. There will be no one framework to rule them all. Teams will use different frameworks for different agents — an MCP tool for one workflow, a custom Python agent for another, a CrewAI crew for a third.

The execution layer must work across all of them. Tarely's REST API is deliberately minimal — heartbeat, get tasks, complete tasks — because simplicity is what enables universality. If your agent can make HTTP calls, it can use Tarely. No SDK lock-in, no framework dependency.

### Human-in-the-loop as governance

Fully autonomous agents are a goal, not a reality. Today's agents need governance — not just supervision, but policy enforcement and approval gates. The `waiting_on_human` status exists in Tarely for a reason: it's the most common blocker in real agent workflows.

Tarely is designed for a world where humans set policies and agents execute within them. The control plane is the enforcement surface — where approval gates, execution boundaries, and escalation rules live.

### Coordination is the moat

If all task delegation, execution state, and multi-agent coordination flows through Tarely, then Tarely is infrastructure. Infrastructure is hard to replace. The more agents that register, the more tasks that execute, the more coordination graphs that form — the deeper Tarely embeds as the execution substrate.

Single-agent monitoring is a feature. Multi-agent coordination through a shared runtime is a platform.

---

## Where Tarely Is Today

### What's Built

- **Agent identity runtime** — registration, API key management, heartbeat-based health tracking, platform tagging, capability metadata.
- **Task execution lifecycle** — create → assign → dispatch → execute → complete, with task dependencies, multi-agent assignment, status workflow, and structured result payloads.
- **Multi-agent project orchestration** — projects with team rosters, shared instructions, reference files, and two orchestration modes (manual + lead-agent).
- **Webhook dispatch** — HMAC-SHA256 signed webhooks for `task.assigned` and `project.launched` events, with delivery tracking.
- **Real-time fleet observability** — health grid with sparklines, trend charts, fleet stats, and instant dashboard updates via Supabase Realtime.
- **Problem tracking** — severity classification, agent attribution, task linkage, resolution workflow, real-time notifications.
- **Complete audit trail** — every runtime action recorded, filterable by agent/category/date, exportable as CSV or JSON.
- **Multi-tenant workspaces** — role-based access control (owner/admin/member), single-use invite links with expiry, workspace-scoped data isolation.
- **Platform support** — native MCP support (Claude Desktop / Cursor), REST API for OpenClaw and any custom agent.
- **Pull + push execution model** — agents poll for tasks via REST API; Tarely pushes rich context via signed webhooks.

### What's Next

The execution substrate roadmap — extending Tarely from runtime to full governance layer:

- **Policy enforcement gates** — approval workflows before execution, configurable execution boundaries, per-agent permission scopes.
- **Cost governance** — budget caps per workspace/project/agent, token usage tracking, cost-per-task attribution.
- **Agent-to-agent coordination** — inter-agent messaging through the control plane, shared state store, structured delegation protocols.
- **Escalation automation** — configurable rules ("if agent X is critical for >5 minutes, reassign its tasks"), auto-remediation triggers.
- **Execution authorization** — fine-grained task-level permissions, deny/block controls, action whitelists per agent.
- **Rate limiting & quotas** — per-agent throttling, request budgets, execution rate caps.

---

## Competitive Landscape

### Agent Frameworks — The Layer Below

- **LangChain / LangGraph** — builds agents. Doesn't govern them. No identity, no fleet coordination, no execution runtime.
- **CrewAI** — multi-agent framework with its own coordination. But coordination is locked inside CrewAI. Tarely provides cross-framework coordination.
- **AutoGen** — Microsoft's multi-agent framework. Same gap: coordination within the framework, not across an infrastructure.
- **OpenClaw** — agent platform. OpenClaw agents connect to Tarely via the same REST API as any custom agent.

### Monitoring Tools — The Layer Beside

- **Datadog / New Relic / Grafana** — monitor infrastructure. Could track agents as services, but lack agent-native concepts: tasks, orchestration, health stages, delegation graphs, problems with agent attribution. They observe. Tarely governs.
- **LangSmith** — LangChain's tracing tool. Focused on prompt-level debugging, not fleet-level execution control. Complementary.

### Project Management — A Different Domain

- **Linear / Jira / Asana** — manage human work. Tarely manages agent work. The task model overlaps, but the execution model (webhooks, API-driven dispatch, automated orchestration, machine-speed lifecycle) is fundamentally different.

### The Gap

Nobody else is building a **platform-agnostic execution control plane for AI agents** — the runtime layer that provides identity, task dispatch, multi-agent coordination, policy enforcement, and audit infrastructure. The frameworks build agents. The monitoring tools watch infrastructure. The project tools manage humans. Tarely is the missing execution layer that governs agents.

---

## Key Metrics

1. **Agents registered** — total agents actively heartbeating across all workspaces. The north star for runtime adoption.
2. **Tasks executed per day** — volume of work flowing through the runtime. Measures execution throughput.
3. **Mean time to problem resolution** — how quickly teams resolve agent issues. Measures operational governance.
4. **Workspaces with >1 user** — team adoption. Measures collaboration value.
5. **Projects using lead-agent mode** — multi-agent coordination adoption. Measures the thesis.
6. **Webhook delivery success rate** — reliability of the dispatch system. Measures infrastructure quality.
7. **Policy enforcement events** — (future) approval gates triggered, execution boundaries enforced. North star for governance adoption.
8. **Coordination graph depth** — (future) average delegation chain length in multi-agent projects. North star for how deeply Tarely embeds as coordination infrastructure.

---

## Summary

Tarely is **the execution control layer for AI workforces**. It provides the runtime that agents register with, receive work through, coordinate across, and report into — regardless of which framework, model, or platform those agents run on.

The thesis: AI agents are distributed systems, and distributed systems need a control plane. Not a dashboard watching from the side — a runtime they execute through. Identity, task dispatch, multi-agent coordination, audit, and governance. Tarely is that runtime, and it's platform-agnostic by design.

The product is real, functional, and opinionated. The architecture (REST API + webhooks + real-time subscriptions) is deliberately simple because simplicity scales. The data model (agents, tasks, projects, problems, activity) captures the full execution lifecycle. The coordination layer (lead-agent orchestration, task dependencies, team rosters) is the moat — the more agents that execute through Tarely, the harder it is to replace.

**Your AI workforce needs an operating system. That operating system is Tarely.**
