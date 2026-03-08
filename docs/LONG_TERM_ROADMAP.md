# Tarely — Long-Term Roadmap

> From execution runtime to the standard control plane for AI workforces.

---

## Current State

Tarely today is a functional execution control plane with:
- Agent identity, registration, and health monitoring (heartbeat-based, auto-offline detection)
- Task execution runtime with full lifecycle, dependencies, and multi-agent assignment
- Multi-agent project orchestration (manual + lead-agent modes)
- HMAC-SHA256 signed webhook dispatch with delivery tracking
- Real-time fleet dashboard with health grid, sparklines, trend charts
- Problem tracking with severity, attribution, and resolution workflow
- Per-operator fleet ownership with scoped alerts and permissions
- Complete audit trail with CSV/JSON export
- Multi-tenant workspaces with RBAC (owner/admin/member)
- API rate limiting with per-agent quotas
- 294+ tests, 25 database tables, 3 agent-facing API routes

**What's missing for launch:** reliability guarantees, external alerting, and a clear developer on-ramp.

---

## Execution Order

```
Phase A (production readiness)     <- CURRENT FOCUS
  A.1 Workspace Context
  A.2 Webhook Reliability
  A.3 External Alerts
  A.4 Quickstart Docs
         |
  ---- LAUNCH ----                 <- Ship when runtime is stable
         |
         v
Phase B (developer adoption)       <- POST-LAUNCH, driven by early user feedback
  B.1 Agent SDKs                   <- Critical
  B.2 Execution Debugging          <- Critical
  B.3 Agent Playground             <- Nice-to-have, not a launch gate
         |
         v
Phase C (governance — minimal)     <- Built from real usage patterns, not speculation
  C.1 Basic Policy Enforcement
  C.2 Escalation Rules
  C.3 Cost Tracking (scope TBD by user demand)
         |
         v
Phase D (platform expansion)       <- Growth phase
  D.1 Agent Templates
  D.2 Agent Ecosystem
```

The launch gate is after Phase A, not Phase B. Ship when the runtime is reliable and developers can connect agents. Improve developer experience post-launch based on what real users struggle with.

---

## Phase A — MVP Completion (Production Readiness)

**Goal:** Bring the system to a state where companies can run agents through it reliably and securely. No new concepts — harden and complete what exists. These are not features. They are production blockers.

### A.1 Workspace Context

Org-level shared knowledge that flows to agents automatically.

**Core needs:**
- `description` and `context` text fields on `workspaces` table (migration)
- Optional "Tell us about your org" step in onboarding wizard
- Editable context fields in workspace settings page
- Inject workspace context into webhook payloads (`task.assigned`, `project.launched`)
- New `GET /api/v1/workspace` endpoint for agents to pull context on demand
- Update API docs page to document the new endpoint and payload fields

**Why it matters:** Without org-level context, every agent operates in isolation. Companies need their agents to know "we use TypeScript, we deploy to AWS, here are our coding standards" without configuring each agent individually. This is table-stakes for enterprise adoption.

**Completion criteria:**
- Set context in settings -> create task -> webhook payload includes workspace context
- Agent can `GET /api/v1/workspace` and receive org context
- Onboarding collects context optionally
- Context editable from settings at any time

### A.2 Webhook Reliability Layer

Retry failed webhook deliveries so task dispatch is durable.

**Core needs:**
- Add `next_retry_at`, `max_attempts`, `attempt_count` columns to `webhook_deliveries`
- Exponential backoff schedule: 30s -> 60s -> 120s -> 240s -> 480s
- On failure, set `next_retry_at` instead of leaving delivery as permanently failed
- Edge Function or pg_cron job that retries failed deliveries every minute
- Mark deliveries as `permanently_failed` after max attempts exhausted
- Dashboard UI showing delivery status, retry count, and next retry time per delivery

**Why it matters:** Today a single failed webhook means a lost task execution. In production, network blips happen constantly. Without retries, operators can't trust that dispatched work will reach their agents. This is a blocker for any serious deployment.

**Completion criteria:**
- Failed webhook retries automatically with exponential backoff
- Permanently failed deliveries stop retrying and are visible in dashboard
- Successful retry updates delivery status to `delivered`
- No task execution lost due to transient network failure

### A.3 External Alert Channels

Push critical events outside the dashboard — operators aren't always staring at a browser tab.

**Core needs:**
- Shared Slack message builder library (Block Kit payloads for problems, offline events, task failures)
- Postgres trigger on `problems` INSERT that fires a Slack notification Edge Function
- Respect existing `notification_settings` — check `slack_enabled` and severity thresholds
- Refactor existing `testSlackWebhook` settings action to use the shared builder

**Why it matters:** Real-time toasts in the dashboard are great when you're looking. When an agent goes critical at 3 AM, the operator needs a Slack ping. Without external alerting, Tarely is a monitoring tool you have to actively watch — that defeats the purpose of autonomous agents.

**Completion criteria:**
- Critical problem reported -> Slack notification sent (when configured)
- Agent goes offline -> Slack notification (when configured)
- Severity threshold filtering works (don't Slack on low-severity)
- Existing Slack test action still works, uses shared builder

### A.4 Agent Quickstart Documentation

A developer should go from "what is Tarely?" to "my agent is heartbeating" in under 10 minutes.

**Core needs:**
- Quickstart guide: create workspace -> register agent -> get API key -> send first heartbeat -> poll for tasks -> complete a task
- Code examples in Python and JavaScript/Node (curl as fallback)
- Minimal copy-paste snippets for the three core API calls
- Explanation of pull (polling) vs push (webhook) execution models
- Troubleshooting section: common errors, rate limiting, auth failures
- Link from dashboard docs page or in-app onboarding

**Why it matters:** The API is simple (3 endpoints), but developers won't discover that without a clear on-ramp. Every minute of friction in initial setup is a lost adoption opportunity. The quickstart is the most important growth lever at this stage.

**Completion criteria:**
- A developer with no prior Tarely knowledge can connect an agent in <10 minutes
- Code examples are copy-pasteable and work against a real Tarely instance
- Covers both polling and webhook workflows

### Phase A — Definition of Done

- [ ] System is production-stable for real company workloads
- [ ] Webhook failures don't cause lost task executions
- [ ] Critical alerts reach operators outside the dashboard
- [ ] Developers can connect their first agent in under 10 minutes
- [ ] Workspace context flows to agents automatically

**Phase A complete = ready to launch.**

---

## LAUNCH

Launch happens immediately after Phase A. The runtime is reliable, alerts work outside the dashboard, and developers have a clear on-ramp. That's enough. Everything after this is built on real usage data.

**Launch success metrics:**

| Metric | Target | What it proves |
|--------|--------|----------------|
| Active companies | 10+ | Market demand exists |
| Heartbeating agents | 100+ | Agents are actually running, not just registered |
| Tasks executed | 1,000+ | Tarely is a real control plane, not just a monitoring dashboard |

All three metrics must be hit. Companies without active agents means shelfware. Agents without tasks means passive monitoring. Tasks without scale means a toy. The combination proves Tarely is infrastructure that companies operate through.

---

## Phase B — Developer Adoption (Post-Launch)

**Goal:** Reduce integration friction based on what real users struggle with. This phase runs after launch — priorities may shift based on early user feedback.

### B.1 Agent SDKs (Critical)

Lightweight wrappers for the core API — not a framework, not an abstraction layer.

**Core needs:**
- Python package (`tarely`) and Node package (`@tarely/sdk`)
- Three core methods: `heartbeat()`, `get_tasks()`, `complete_task()`
- Auto-heartbeat background thread/interval (configurable frequency)
- Webhook handler helper for receiving `task.assigned` events with signature verification
- Zero required dependencies beyond standard HTTP libraries
- Published to PyPI and npm

**Why it matters:** The REST API is deliberately minimal, but even minimal APIs have boilerplate: auth headers, JSON parsing, error handling, heartbeat scheduling. SDKs eliminate that boilerplate. The goal is `pip install tarely` -> 5 lines of code -> agent is running.

**Completion criteria:**
- `pip install tarely` and `npm install @tarely/sdk` work
- Agent heartbeating in <5 lines of code per language
- Webhook signature verification is one function call
- No framework dependency

### B.2 Task Execution Debugging (Critical)

When a task fails, show exactly what happened — don't make operators guess.

**Core needs:**
- Task detail view shows: webhook payload sent, agent response, delivery attempts with timestamps
- Timeline of status transitions with who/what triggered each change
- For cancelled tasks: reason/context if available
- Link from problems to the specific task execution that failed
- Webhook delivery log accessible from task detail

**Why it matters:** "Task cancelled" is useless without context. Operators need to see: was the webhook delivered? Did the agent respond? What was the response? Without execution debugging, every failure requires manual investigation across multiple dashboard pages.

**Completion criteria:**
- Task failure -> operator can see full execution history in one place
- Webhook delivery status visible from task detail
- Status transition timeline shows trigger (agent API call, manual action, system)

### B.3 Agent Playground (Nice-to-Have)

Test the execution pipeline without deploying a real agent. Useful for demos and onboarding but not a launch gate.

**Core needs:**
- In-dashboard "simulate agent" button that creates a temporary agent identity
- Send a test heartbeat, receive a test task, complete it — all from the browser
- Show the full request/response cycle for learning

**Why it matters:** Breaks the chicken-and-egg problem for demos and sales. Not required for real agent deployments.

**Completion criteria:**
- New user can simulate full agent lifecycle from dashboard without writing code

### Phase B — Definition of Done

- [ ] Developers can integrate agents in minutes with SDKs
- [ ] Task execution failures are debuggable from the dashboard
- [ ] Priorities have been validated against real user feedback

---

## Phase C — Governance Layer (Minimal, Usage-Driven)

**Goal:** Add organizational control over agent behavior — but only what real users are asking for. Build the minimum governance surface, expand based on actual demand.

**Important:** This phase is intentionally scoped down. A full governance system (permissions, policies, cost tracking, approval gates, escalation automation) is a product in itself. At this stage, build only what early adopters need. Expand when usage patterns confirm what to build next.

### C.1 Basic Policy Enforcement

Simple, high-impact controls that early adopters will need first.

**Core needs:**
- Per-agent allow/deny controls (can this agent execute tasks or not)
- Approval gates for specific agents (task requires human approval before execution)
- Basic UI in settings to manage these controls
- Policy check in task completion API: denied = 403, approval-required = 202

**Explicitly deferred:** Action whitelists, time-based restrictions, max concurrent task limits. Build these when users ask for them.

**Why it matters:** The first governance request from every company is "how do I stop this agent from doing things?" A simple on/off switch and an approval gate cover 80% of early governance needs.

**Completion criteria:**
- Admin can block an agent from executing tasks
- Admin can require approval before an agent's tasks proceed
- Approvals are manageable from the dashboard

### C.2 Escalation Rules

Automated response to common operational incidents.

**Core needs:**
- Simple condition/action rules: "if agent offline >N minutes, notify Slack"
- "If agent critical >N minutes, reassign tasks" (builds on Phase A.3 Slack integration)
- Cooldown to prevent alert storms
- Evaluation via pg_cron every minute

**Explicitly deferred:** Complex multi-condition rules, custom action types, escalation chains. Start simple.

**Why it matters:** The first thing companies ask after getting alerts is "can the system fix it automatically?" Basic escalation rules answer this without building a full automation engine.

**Completion criteria:**
- Configurable escalation rules with cooldowns
- At least two action types: notify Slack, reassign tasks
- Rules manageable from settings

### C.3 Cost Tracking (Scope TBD)

Track agent execution costs. Scope determined by what early users actually need.

**Minimum core needs:**
- `POST /api/v1/cost/report` endpoint for agents to report token usage
- Per-agent cost aggregation visible in dashboard
- Workspace-level spending overview

**Deferred until demand is clear:** Budget caps, automatic enforcement, per-task cost attribution, daily/monthly breakdowns. These are valuable but complex — build them when users prove they need them.

**Why it matters:** Companies will ask "how much is this costing me?" The answer needs to exist somewhere. Whether it needs enforcement and caps depends on how companies actually use the data.

**Completion criteria:**
- Agents can report cost data
- Dashboard shows per-agent spending
- Scope of enforcement features determined by user feedback

### Phase C — Definition of Done

- [ ] Basic agent controls exist (block, require approval)
- [ ] Automated escalation handles common incidents
- [ ] Cost data is visible
- [ ] All governance features are driven by real user requests, not speculation

---

## Phase D — Platform Expansion

**Goal:** Create network effects and accelerate adoption. This phase moves Tarely from "tool" to "ecosystem."

### D.1 Agent Templates

Pre-built agent configurations that new users can deploy immediately.

**Core needs:**
- Template registry: curated agent configs (name, type, capabilities, starter code)
- Categories: research agents, coding agents, operations agents, data agents
- One-click deploy: creates agent, generates API key, provides copy-paste code
- At least 5 official templates at launch

**Why it matters:** Templates eliminate the cold-start problem. Instead of "register an agent and figure out what to build," it's "pick a template, deploy, customize." Dramatically reduces time-to-value.

### D.2 Agent Ecosystem

A catalog of ready-to-run agents that work with Tarely out of the box.

**Core needs:**
- Marketplace page: browse, filter, deploy pre-built agents
- Partner integrations: third-party agents that register with Tarely natively
- Standardized agent packaging format

**Why it matters:** When a company can pick a "Customer Support Triage Agent" from a marketplace and have it heartbeating in 5 minutes — that's when Tarely becomes a platform. Network effects begin when agents attract users and users attract builders.

### Phase D — Definition of Done

- [ ] New users can go from signup to running agents in minutes via templates
- [ ] The platform functions as an ecosystem, not just a runtime
- [ ] Network effects are measurable

---

## Risk Awareness

1. **Over-building before usage.** The biggest risk is building governance, cost tracking, and escalation before 10 companies are using the core runtime. Phase A -> Launch -> learn -> build is the correct sequence.

2. **SDK scope creep.** SDKs must stay minimal. Three methods, zero framework dependency. The moment the SDK becomes a framework, it undermines Tarely's platform-agnostic positioning.

3. **Governance complexity.** A full policy engine is a product in itself. Phase C starts with allow/deny and approval gates — not a rules engine. Expand only when usage patterns justify it.

4. **Template quality.** Bad templates are worse than no templates. Five excellent official templates beat fifty mediocre community ones. Quality over quantity.

---

## Summary

The roadmap prioritizes getting Tarely into real hands fast:

- **Phase A** completes production readiness — the minimum for real workloads
- **Launch** happens immediately after Phase A — don't wait for perfect developer experience
- **Phase B** improves developer adoption based on what early users actually struggle with
- **Phase C** adds governance incrementally — build what users ask for, not what we guess they'll need
- **Phase D** expands the platform into an ecosystem

The central principle: **ship early, learn from real usage, build governance and ecosystem on top of proven demand.** The runtime is the product. Everything else is built on evidence.
