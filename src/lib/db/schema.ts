import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  jsonb,
  integer,
  bigint,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Auth: users (simplified — no email/password, just name)
// ---------------------------------------------------------------------------
export const users = pgTable(
  "user",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("users_name_idx").on(t.name)]
);

// ---------------------------------------------------------------------------
// Auth: sessions (simple cookie-based sessions)
// ---------------------------------------------------------------------------
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("sessions_token_idx").on(t.token)]
);

// ---------------------------------------------------------------------------
// Workspaces
// ---------------------------------------------------------------------------
export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("workspaces_slug_key").on(t.slug),
    index("idx_workspaces_created_by").on(t.createdBy),
  ]
);

// ---------------------------------------------------------------------------
// Workspace members
// ---------------------------------------------------------------------------
export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("workspace_members_workspace_id_user_id_key").on(t.workspaceId, t.userId),
    index("idx_workspace_members_user_id").on(t.userId),
  ]
);

// ---------------------------------------------------------------------------
// Workspace invitations
// ---------------------------------------------------------------------------
export const workspaceInvitations = pgTable(
  "workspace_invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    role: text("role").notNull().default("member"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    acceptedBy: uuid("accepted_by").references(() => users.id),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("workspace_invitations_token_key").on(t.token),
    index("idx_workspace_invitations_workspace").on(t.workspaceId),
  ]
);

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------
export const agents = pgTable(
  "agents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    agentType: text("agent_type"),
    apiKeyHash: text("api_key_hash").notNull(),
    apiKeyPrefix: text("api_key_prefix").notNull(),
    stage: text("stage").notNull().default("idle"),
    health: text("health").notNull().default("healthy"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    tags: text("tags")
      .array()
      .default(sql`'{}'::text[]`),
    platform: text("platform"),
    webhookUrl: text("webhook_url"),
    webhookSecret: text("webhook_secret"),
    capabilities: text("capabilities")
      .array()
      .default(sql`'{}'::text[]`),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [
    uniqueIndex("idx_agents_api_key_hash").on(t.apiKeyHash),
    index("idx_agents_workspace").on(t.workspaceId),
    index("idx_agents_owner_id").on(t.ownerId),
    index("idx_agents_workspace_owner").on(t.workspaceId, t.ownerId),
  ]
);

// ---------------------------------------------------------------------------
// Notification settings
// ---------------------------------------------------------------------------
export const notificationSettings = pgTable(
  "notification_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    slackEnabled: boolean("slack_enabled").default(false),
    slackWebhookUrl: text("slack_webhook_url"),
    notifyOnProblemSeverity: text("notify_on_problem_severity")
      .array()
      .default(sql`'{high,critical}'::text[]`),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [uniqueIndex("notification_settings_workspace_id_key").on(t.workspaceId)]
);

// ---------------------------------------------------------------------------
// Agent quotas
// ---------------------------------------------------------------------------
export const agentQuotas = pgTable(
  "agent_quotas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "cascade" }),
    maxRequestsPerMinute: integer("max_requests_per_minute").notNull().default(60),
    maxRequestsPerHour: integer("max_requests_per_hour").notNull().default(1000),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("agent_quotas_workspace_id_agent_id_key").on(t.workspaceId, t.agentId),
    index("idx_agent_quotas_workspace_id").on(t.workspaceId),
    index("idx_agent_quotas_agent_id").on(t.agentId),
  ]
);

// ---------------------------------------------------------------------------
// Agent updates (heartbeat timeline)
// ---------------------------------------------------------------------------
export const agentUpdates = pgTable(
  "agent_updates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    stage: text("stage"),
    health: text("health"),
    message: text("message"),
    details: jsonb("details").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("idx_agent_updates_agent").on(t.agentId, t.createdAt)]
);

// ---------------------------------------------------------------------------
// Rate-limit sliding windows
// ---------------------------------------------------------------------------
export const rateLimitWindows = pgTable(
  "rate_limit_windows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    windowType: text("window_type").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    requestCount: integer("request_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("rate_limit_windows_agent_window_key").on(t.agentId, t.windowType, t.windowStart),
    index("idx_rate_limit_windows_window_start").on(t.windowStart),
  ]
);

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------
export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status").notNull().default("draft"),
    leadAgentId: uuid("lead_agent_id").references(() => agents.id, { onDelete: "set null" }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    instructions: text("instructions"),
    orchestrationMode: text("orchestration_mode").notNull().default("manual"),
  },
  (t) => [
    index("idx_projects_workspace_id").on(t.workspaceId),
    index("idx_projects_lead_agent_id").on(t.leadAgentId),
    index("idx_projects_status").on(t.status),
  ]
);

// ---------------------------------------------------------------------------
// Project agents
// ---------------------------------------------------------------------------
export const projectAgents = pgTable(
  "project_agents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    status: text("status").notNull().default("idle"),
  },
  (t) => [
    uniqueIndex("project_agents_project_id_agent_id_key").on(t.projectId, t.agentId),
    index("idx_project_agents_project_id").on(t.projectId),
    index("idx_project_agents_agent_id").on(t.agentId),
  ]
);

// ---------------------------------------------------------------------------
// Project files
// ---------------------------------------------------------------------------
export const projectFiles = pgTable(
  "project_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    filePath: text("file_path").notNull(),
    fileSize: bigint("file_size", { mode: "number" }),
    mimeType: text("mime_type"),
    uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("idx_project_files_project_id").on(t.projectId)]
);

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------
export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),
    assignedTo: uuid("assigned_to").references(() => users.id),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").notNull().default("pending"),
    priority: text("priority").notNull().default("medium"),
    result: jsonb("result"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  },
  (t) => [
    index("idx_tasks_workspace").on(t.workspaceId, t.status),
    index("idx_tasks_agent").on(t.agentId),
    index("idx_tasks_assigned_to").on(t.assignedTo),
    index("idx_tasks_created_by").on(t.createdBy),
    index("idx_tasks_project_id").on(t.projectId),
  ]
);

// ---------------------------------------------------------------------------
// Task agents
// ---------------------------------------------------------------------------
export const taskAgents = pgTable(
  "task_agents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("helper"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("task_agents_task_id_agent_id_key").on(t.taskId, t.agentId),
    index("idx_task_agents_task").on(t.taskId),
    index("idx_task_agents_agent").on(t.agentId),
  ]
);

// ---------------------------------------------------------------------------
// Task comments
// ---------------------------------------------------------------------------
export const taskComments = pgTable(
  "task_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("idx_task_comments_task").on(t.taskId, t.createdAt),
    index("idx_task_comments_workspace").on(t.workspaceId),
    index("idx_task_comments_agent_id").on(t.agentId),
    index("idx_task_comments_user_id").on(t.userId),
  ]
);

// ---------------------------------------------------------------------------
// Task dependencies (DAG edges)
// ---------------------------------------------------------------------------
export const taskDependencies = pgTable(
  "task_dependencies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    dependsOnTaskId: uuid("depends_on_task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("task_dependencies_task_id_depends_on_task_id_key").on(t.taskId, t.dependsOnTaskId),
    index("idx_task_dependencies_task_id").on(t.taskId),
    index("idx_task_dependencies_depends_on").on(t.dependsOnTaskId),
  ]
);

// ---------------------------------------------------------------------------
// Problems (agent incidents)
// ---------------------------------------------------------------------------
export const problems = pgTable(
  "problems",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    severity: text("severity").notNull().default("medium"),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").notNull().default("open"),
    resolvedBy: uuid("resolved_by").references(() => users.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
  },
  (t) => [
    index("idx_problems_agent").on(t.agentId, t.status),
    index("idx_problems_task").on(t.taskId),
    index("idx_problems_resolved_by").on(t.resolvedBy),
  ]
);

// ---------------------------------------------------------------------------
// Activity log (audit trail)
// ---------------------------------------------------------------------------
export const activityLog = pgTable(
  "activity_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),
    userId: uuid("user_id").references(() => users.id),
    action: text("action").notNull(),
    details: jsonb("details").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("idx_activity_log_workspace").on(t.workspaceId, t.createdAt),
    index("idx_activity_log_agent_id").on(t.agentId),
    index("idx_activity_log_user_id").on(t.userId),
  ]
);

// ---------------------------------------------------------------------------
// Webhook deliveries
// ---------------------------------------------------------------------------
export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").notNull().default({}),
    status: text("status").notNull().default("pending"),
    responseCode: integer("response_code"),
    responseBody: text("response_body"),
    attempts: integer("attempts").notNull().default(0),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    lastError: text("last_error"),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  },
  (t) => [
    index("idx_webhook_deliveries_agent_id").on(t.agentId),
    index("idx_webhook_deliveries_task_id").on(t.taskId),
    index("idx_webhook_deliveries_status").on(t.status),
  ]
);

// ---------------------------------------------------------------------------
// Waitlist
// ---------------------------------------------------------------------------
export const waitlist = pgTable(
  "waitlist",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("waitlist_email_key").on(t.email)]
);
