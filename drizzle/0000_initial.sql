-- Doop — Initial Migration (Drizzle)
-- Adapted from Supabase migration, minus RLS/pg_net/auth.uid dependencies.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "user" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "token" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "sessions_token_idx" ON "sessions" ("token");

CREATE TABLE IF NOT EXISTS "workspaces" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "created_by" uuid REFERENCES "user"("id"),
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "workspaces_slug_key" ON "workspaces" ("slug");
CREATE INDEX IF NOT EXISTS "idx_workspaces_created_by" ON "workspaces" ("created_by");

CREATE TABLE IF NOT EXISTS "workspace_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "role" text NOT NULL DEFAULT 'member',
  "created_at" timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "workspace_members_workspace_id_user_id_key" ON "workspace_members" ("workspace_id", "user_id");
CREATE INDEX IF NOT EXISTS "idx_workspace_members_user_id" ON "workspace_members" ("user_id");

CREATE TABLE IF NOT EXISTS "workspace_invitations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "token" text NOT NULL,
  "role" text NOT NULL DEFAULT 'member',
  "created_by" uuid NOT NULL REFERENCES "user"("id"),
  "expires_at" timestamptz NOT NULL,
  "accepted_at" timestamptz,
  "accepted_by" uuid REFERENCES "user"("id"),
  "revoked_at" timestamptz,
  "created_at" timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "workspace_invitations_token_key" ON "workspace_invitations" ("token");
CREATE INDEX IF NOT EXISTS "idx_workspace_invitations_workspace" ON "workspace_invitations" ("workspace_id");

CREATE TABLE IF NOT EXISTS "agents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "agent_type" text,
  "api_key_hash" text NOT NULL,
  "api_key_prefix" text NOT NULL,
  "stage" text NOT NULL DEFAULT 'idle',
  "health" text NOT NULL DEFAULT 'healthy',
  "last_seen_at" timestamptz,
  "metadata" jsonb DEFAULT '{}',
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "tags" text[] DEFAULT '{}',
  "platform" text,
  "webhook_url" text,
  "webhook_secret" text,
  "capabilities" text[] DEFAULT '{}',
  "owner_id" uuid REFERENCES "user"("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_agents_api_key_hash" ON "agents" ("api_key_hash");
CREATE INDEX IF NOT EXISTS "idx_agents_workspace" ON "agents" ("workspace_id");
CREATE INDEX IF NOT EXISTS "idx_agents_owner_id" ON "agents" ("owner_id");
CREATE INDEX IF NOT EXISTS "idx_agents_workspace_owner" ON "agents" ("workspace_id", "owner_id");

CREATE TABLE IF NOT EXISTS "notification_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "slack_enabled" boolean DEFAULT false,
  "slack_webhook_url" text,
  "notify_on_problem_severity" text[] DEFAULT '{high,critical}',
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "notification_settings_workspace_id_key" ON "notification_settings" ("workspace_id");

CREATE TABLE IF NOT EXISTS "agent_quotas" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "agent_id" uuid REFERENCES "agents"("id") ON DELETE CASCADE,
  "max_requests_per_minute" integer NOT NULL DEFAULT 60,
  "max_requests_per_hour" integer NOT NULL DEFAULT 1000,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "agent_quotas_workspace_id_agent_id_key" ON "agent_quotas" ("workspace_id", "agent_id");
CREATE INDEX IF NOT EXISTS "idx_agent_quotas_workspace_id" ON "agent_quotas" ("workspace_id");
CREATE INDEX IF NOT EXISTS "idx_agent_quotas_agent_id" ON "agent_quotas" ("agent_id");

CREATE TABLE IF NOT EXISTS "agent_updates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "agent_id" uuid NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "stage" text,
  "health" text,
  "message" text,
  "details" jsonb DEFAULT '{}',
  "created_at" timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_agent_updates_agent" ON "agent_updates" ("agent_id", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "rate_limit_windows" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "agent_id" uuid NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "window_type" text NOT NULL,
  "window_start" timestamptz NOT NULL,
  "request_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "rate_limit_windows_agent_window_key" ON "rate_limit_windows" ("agent_id", "window_type", "window_start");
CREATE INDEX IF NOT EXISTS "idx_rate_limit_windows_window_start" ON "rate_limit_windows" ("window_start");

CREATE TABLE IF NOT EXISTS "projects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "status" text NOT NULL DEFAULT 'draft',
  "lead_agent_id" uuid REFERENCES "agents"("id") ON DELETE SET NULL,
  "created_by" uuid REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "instructions" text,
  "orchestration_mode" text NOT NULL DEFAULT 'manual'
);
CREATE INDEX IF NOT EXISTS "idx_projects_workspace_id" ON "projects" ("workspace_id");
CREATE INDEX IF NOT EXISTS "idx_projects_lead_agent_id" ON "projects" ("lead_agent_id");
CREATE INDEX IF NOT EXISTS "idx_projects_status" ON "projects" ("status");

CREATE TABLE IF NOT EXISTS "project_agents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "agent_id" uuid NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "role" text NOT NULL DEFAULT 'member',
  "created_at" timestamptz DEFAULT now(),
  "status" text NOT NULL DEFAULT 'idle'
);
CREATE UNIQUE INDEX IF NOT EXISTS "project_agents_project_id_agent_id_key" ON "project_agents" ("project_id", "agent_id");
CREATE INDEX IF NOT EXISTS "idx_project_agents_project_id" ON "project_agents" ("project_id");
CREATE INDEX IF NOT EXISTS "idx_project_agents_agent_id" ON "project_agents" ("agent_id");

CREATE TABLE IF NOT EXISTS "project_files" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "file_name" text NOT NULL,
  "file_path" text NOT NULL,
  "file_size" bigint,
  "mime_type" text,
  "uploaded_by" uuid REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_project_files_project_id" ON "project_files" ("project_id");

CREATE TABLE IF NOT EXISTS "tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "agent_id" uuid REFERENCES "agents"("id") ON DELETE SET NULL,
  "assigned_to" uuid REFERENCES "user"("id"),
  "title" text NOT NULL,
  "description" text,
  "status" text NOT NULL DEFAULT 'pending',
  "priority" text NOT NULL DEFAULT 'medium',
  "result" jsonb,
  "created_by" uuid REFERENCES "user"("id"),
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "project_id" uuid REFERENCES "projects"("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "idx_tasks_workspace" ON "tasks" ("workspace_id", "status");
CREATE INDEX IF NOT EXISTS "idx_tasks_agent" ON "tasks" ("agent_id");
CREATE INDEX IF NOT EXISTS "idx_tasks_assigned_to" ON "tasks" ("assigned_to");
CREATE INDEX IF NOT EXISTS "idx_tasks_created_by" ON "tasks" ("created_by");
CREATE INDEX IF NOT EXISTS "idx_tasks_project_id" ON "tasks" ("project_id");

CREATE TABLE IF NOT EXISTS "task_agents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "task_id" uuid NOT NULL REFERENCES "tasks"("id") ON DELETE CASCADE,
  "agent_id" uuid NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "role" text NOT NULL DEFAULT 'helper',
  "created_at" timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "task_agents_task_id_agent_id_key" ON "task_agents" ("task_id", "agent_id");
CREATE INDEX IF NOT EXISTS "idx_task_agents_task" ON "task_agents" ("task_id");
CREATE INDEX IF NOT EXISTS "idx_task_agents_agent" ON "task_agents" ("agent_id");

CREATE TABLE IF NOT EXISTS "task_comments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "task_id" uuid NOT NULL REFERENCES "tasks"("id") ON DELETE CASCADE,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id"),
  "agent_id" uuid REFERENCES "agents"("id") ON DELETE SET NULL,
  "user_id" uuid REFERENCES "user"("id") ON DELETE SET NULL,
  "content" text NOT NULL,
  "created_at" timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_task_comments_task" ON "task_comments" ("task_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_task_comments_workspace" ON "task_comments" ("workspace_id");
CREATE INDEX IF NOT EXISTS "idx_task_comments_agent_id" ON "task_comments" ("agent_id");
CREATE INDEX IF NOT EXISTS "idx_task_comments_user_id" ON "task_comments" ("user_id");

CREATE TABLE IF NOT EXISTS "task_dependencies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "task_id" uuid NOT NULL REFERENCES "tasks"("id") ON DELETE CASCADE,
  "depends_on_task_id" uuid NOT NULL REFERENCES "tasks"("id") ON DELETE CASCADE,
  "created_at" timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "task_dependencies_task_id_depends_on_task_id_key" ON "task_dependencies" ("task_id", "depends_on_task_id");
CREATE INDEX IF NOT EXISTS "idx_task_dependencies_task_id" ON "task_dependencies" ("task_id");
CREATE INDEX IF NOT EXISTS "idx_task_dependencies_depends_on" ON "task_dependencies" ("depends_on_task_id");

CREATE TABLE IF NOT EXISTS "problems" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "agent_id" uuid NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "severity" text NOT NULL DEFAULT 'medium',
  "title" text NOT NULL,
  "description" text,
  "status" text NOT NULL DEFAULT 'open',
  "resolved_by" uuid REFERENCES "user"("id"),
  "resolved_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  "task_id" uuid REFERENCES "tasks"("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "idx_problems_agent" ON "problems" ("agent_id", "status");
CREATE INDEX IF NOT EXISTS "idx_problems_task" ON "problems" ("task_id");
CREATE INDEX IF NOT EXISTS "idx_problems_resolved_by" ON "problems" ("resolved_by");

CREATE TABLE IF NOT EXISTS "activity_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "agent_id" uuid REFERENCES "agents"("id") ON DELETE SET NULL,
  "user_id" uuid REFERENCES "user"("id"),
  "action" text NOT NULL,
  "details" jsonb DEFAULT '{}',
  "created_at" timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_activity_log_workspace" ON "activity_log" ("workspace_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_activity_log_agent_id" ON "activity_log" ("agent_id");
CREATE INDEX IF NOT EXISTS "idx_activity_log_user_id" ON "activity_log" ("user_id");

CREATE TABLE IF NOT EXISTS "webhook_deliveries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "agent_id" uuid NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "task_id" uuid REFERENCES "tasks"("id") ON DELETE SET NULL,
  "event_type" text NOT NULL,
  "payload" jsonb NOT NULL DEFAULT '{}',
  "status" text NOT NULL DEFAULT 'pending',
  "response_code" integer,
  "response_body" text,
  "attempts" integer NOT NULL DEFAULT 0,
  "last_attempt_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  "last_error" text,
  "delivered_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "idx_webhook_deliveries_agent_id" ON "webhook_deliveries" ("agent_id");
CREATE INDEX IF NOT EXISTS "idx_webhook_deliveries_task_id" ON "webhook_deliveries" ("task_id");
CREATE INDEX IF NOT EXISTS "idx_webhook_deliveries_status" ON "webhook_deliveries" ("status");

CREATE TABLE IF NOT EXISTS "waitlist" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "waitlist_email_key" ON "waitlist" ("email");

-- ---------------------------------------------------------------------------
-- Functions & Triggers (kept in DB)
-- ---------------------------------------------------------------------------

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_agents_updated_at
  BEFORE UPDATE ON agents FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_workspaces_updated_at
  BEFORE UPDATE ON workspaces FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_notification_settings_updated_at
  BEFORE UPDATE ON notification_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Create default notification settings when a workspace is created
CREATE OR REPLACE FUNCTION create_default_notification_settings()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO notification_settings (workspace_id)
  VALUES (NEW.id)
  ON CONFLICT (workspace_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_workspace_default_notification_settings
  AFTER INSERT ON workspaces FOR EACH ROW EXECUTE FUNCTION create_default_notification_settings();

-- Drizzle migration journal
CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
  "id" serial PRIMARY KEY,
  "hash" text NOT NULL,
  "created_at" bigint
);
