-- =============================================================================
-- Doop — Initial Schema Migration
-- =============================================================================
-- This migration creates the complete database schema from scratch.
-- Run via: supabase db push (remote) or supabase start (local, auto-applies).
--
-- Requires the pg_net extension (enabled by default on Supabase hosted projects).
-- For local development, Supabase CLI enables it automatically.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- 1. Tables (ordered by foreign-key dependencies)
-- ---------------------------------------------------------------------------

-- Auth: users (Better Auth managed)
CREATE TABLE public."user" (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  "emailVerified" boolean NOT NULL DEFAULT false,
  image text,
  "createdAt" timestamp without time zone NOT NULL DEFAULT now(),
  "updatedAt" timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_pkey PRIMARY KEY (id),
  CONSTRAINT user_email_key UNIQUE (email)
);

-- Auth: verification tokens (Better Auth managed)
CREATE TABLE public.verification (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  value text NOT NULL,
  "expiresAt" timestamp without time zone NOT NULL,
  "createdAt" timestamp without time zone,
  "updatedAt" timestamp without time zone,
  CONSTRAINT verification_pkey PRIMARY KEY (id)
);

-- Waitlist
CREATE TABLE public.waitlist (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT waitlist_pkey PRIMARY KEY (id),
  CONSTRAINT waitlist_email_key UNIQUE (email)
);

-- Workspaces
CREATE TABLE public.workspaces (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT workspaces_pkey PRIMARY KEY (id),
  CONSTRAINT workspaces_slug_key UNIQUE (slug),
  CONSTRAINT workspaces_created_by_fkey FOREIGN KEY (created_by) REFERENCES public."user"(id)
);

-- Auth: OAuth accounts (Better Auth managed)
CREATE TABLE public.account (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  "accountId" text NOT NULL,
  "providerId" text NOT NULL,
  "userId" uuid NOT NULL,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamp without time zone,
  "refreshTokenExpiresAt" timestamp without time zone,
  scope text,
  password text,
  "createdAt" timestamp without time zone NOT NULL DEFAULT now(),
  "updatedAt" timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT account_pkey PRIMARY KEY (id),
  CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."user"(id) ON DELETE CASCADE
);

-- Auth: sessions (Better Auth managed)
CREATE TABLE public.session (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  "expiresAt" timestamp without time zone NOT NULL,
  token text NOT NULL,
  "createdAt" timestamp without time zone NOT NULL DEFAULT now(),
  "updatedAt" timestamp without time zone NOT NULL DEFAULT now(),
  "ipAddress" text,
  "userAgent" text,
  "userId" uuid NOT NULL,
  CONSTRAINT session_pkey PRIMARY KEY (id),
  CONSTRAINT session_token_key UNIQUE (token),
  CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."user"(id) ON DELETE CASCADE
);

-- Workspace members (join table)
CREATE TABLE public.workspace_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT workspace_members_pkey PRIMARY KEY (id),
  CONSTRAINT workspace_members_workspace_id_user_id_key UNIQUE (workspace_id, user_id),
  CONSTRAINT workspace_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE,
  CONSTRAINT workspace_members_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE
);

-- Workspace invitations
CREATE TABLE public.workspace_invitations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  token text NOT NULL,
  role text NOT NULL DEFAULT 'member'::text,
  created_by uuid NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  accepted_at timestamp with time zone,
  accepted_by uuid,
  revoked_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT workspace_invitations_pkey PRIMARY KEY (id),
  CONSTRAINT workspace_invitations_token_key UNIQUE (token),
  CONSTRAINT workspace_invitations_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE,
  CONSTRAINT workspace_invitations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public."user"(id),
  CONSTRAINT workspace_invitations_accepted_by_fkey FOREIGN KEY (accepted_by) REFERENCES public."user"(id)
);

-- Agents
CREATE TABLE public.agents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  agent_type text,
  api_key uuid DEFAULT gen_random_uuid(),
  stage text NOT NULL DEFAULT 'idle'::text,
  health text NOT NULL DEFAULT 'healthy'::text,
  last_seen_at timestamp with time zone,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  tags text[] DEFAULT '{}'::text[],
  platform text,
  webhook_url text,
  webhook_secret text,
  capabilities text[] DEFAULT '{}'::text[],
  CONSTRAINT agents_pkey PRIMARY KEY (id),
  CONSTRAINT agents_api_key_key UNIQUE (api_key),
  CONSTRAINT agents_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE
);

-- Notification settings (one per workspace)
CREATE TABLE public.notification_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  slack_enabled boolean DEFAULT false,
  slack_webhook_url text,
  notify_on_problem_severity text[] DEFAULT '{high,critical}'::text[],
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notification_settings_pkey PRIMARY KEY (id),
  CONSTRAINT notification_settings_workspace_id_key UNIQUE (workspace_id),
  CONSTRAINT notification_settings_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE
);

-- Agent quotas (rate-limit configuration)
CREATE TABLE public.agent_quotas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  agent_id uuid,
  max_requests_per_minute integer NOT NULL DEFAULT 60,
  max_requests_per_hour integer NOT NULL DEFAULT 1000,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT agent_quotas_pkey PRIMARY KEY (id),
  CONSTRAINT agent_quotas_workspace_id_agent_id_key UNIQUE (workspace_id, agent_id),
  CONSTRAINT agent_quotas_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE,
  CONSTRAINT agent_quotas_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE
);

-- Agent updates (heartbeat / status timeline)
CREATE TABLE public.agent_updates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL,
  stage text,
  health text,
  message text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT agent_updates_pkey PRIMARY KEY (id),
  CONSTRAINT agent_updates_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE
);

-- Rate-limit sliding windows
CREATE TABLE public.rate_limit_windows (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL,
  window_type text NOT NULL,
  window_start timestamp with time zone NOT NULL,
  request_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT rate_limit_windows_pkey PRIMARY KEY (id),
  CONSTRAINT rate_limit_windows_agent_id_window_type_window_start_key UNIQUE (agent_id, window_type, window_start),
  CONSTRAINT rate_limit_windows_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE
);

-- Projects
CREATE TABLE public.projects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft'::text,
  lead_agent_id uuid,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  instructions text,
  orchestration_mode text NOT NULL DEFAULT 'manual'::text,
  CONSTRAINT projects_pkey PRIMARY KEY (id),
  CONSTRAINT projects_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE,
  CONSTRAINT projects_lead_agent_id_fkey FOREIGN KEY (lead_agent_id) REFERENCES public.agents(id) ON DELETE SET NULL,
  CONSTRAINT projects_created_by_fkey FOREIGN KEY (created_by) REFERENCES public."user"(id) ON DELETE SET NULL
);

-- Project ↔ Agent assignments
CREATE TABLE public.project_agents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  agent_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member'::text,
  created_at timestamp with time zone DEFAULT now(),
  status text NOT NULL DEFAULT 'idle'::text,
  CONSTRAINT project_agents_pkey PRIMARY KEY (id),
  CONSTRAINT project_agents_project_id_agent_id_key UNIQUE (project_id, agent_id),
  CONSTRAINT project_agents_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE,
  CONSTRAINT project_agents_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE
);

-- Project file attachments
CREATE TABLE public.project_files (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  mime_type text,
  uploaded_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT project_files_pkey PRIMARY KEY (id),
  CONSTRAINT project_files_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE,
  CONSTRAINT project_files_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public."user"(id) ON DELETE SET NULL
);

-- Tasks
CREATE TABLE public.tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  agent_id uuid,
  assigned_to uuid,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending'::text,
  priority text NOT NULL DEFAULT 'medium'::text,
  result jsonb,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  project_id uuid,
  CONSTRAINT tasks_pkey PRIMARY KEY (id),
  CONSTRAINT tasks_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE,
  CONSTRAINT tasks_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE SET NULL,
  CONSTRAINT tasks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public."user"(id),
  CONSTRAINT tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES public."user"(id),
  CONSTRAINT tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL
);

-- Task ↔ Agent assignments
CREATE TABLE public.task_agents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL,
  agent_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'helper'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT task_agents_pkey PRIMARY KEY (id),
  CONSTRAINT task_agents_task_id_agent_id_key UNIQUE (task_id, agent_id),
  CONSTRAINT task_agents_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE,
  CONSTRAINT task_agents_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE
);

-- Task comments
CREATE TABLE public.task_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  agent_id uuid,
  user_id uuid,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT task_comments_pkey PRIMARY KEY (id),
  CONSTRAINT task_comments_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE,
  CONSTRAINT task_comments_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id),
  CONSTRAINT task_comments_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE SET NULL,
  CONSTRAINT task_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE SET NULL
);

-- Task dependencies (DAG edges)
CREATE TABLE public.task_dependencies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL,
  depends_on_task_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT task_dependencies_pkey PRIMARY KEY (id),
  CONSTRAINT task_dependencies_task_id_depends_on_task_id_key UNIQUE (task_id, depends_on_task_id),
  CONSTRAINT task_dependencies_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE,
  CONSTRAINT task_dependencies_depends_on_task_id_fkey FOREIGN KEY (depends_on_task_id) REFERENCES public.tasks(id) ON DELETE CASCADE
);

-- Problems (agent issues / incidents)
CREATE TABLE public.problems (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL,
  severity text NOT NULL DEFAULT 'medium'::text,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open'::text,
  resolved_by uuid,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  task_id uuid,
  CONSTRAINT problems_pkey PRIMARY KEY (id),
  CONSTRAINT problems_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE,
  CONSTRAINT problems_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public."user"(id),
  CONSTRAINT problems_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE SET NULL
);

-- Activity log (audit trail)
CREATE TABLE public.activity_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  agent_id uuid,
  user_id uuid,
  action text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT activity_log_pkey PRIMARY KEY (id),
  CONSTRAINT activity_log_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE,
  CONSTRAINT activity_log_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE SET NULL,
  CONSTRAINT activity_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id)
);

-- Webhook deliveries
CREATE TABLE public.webhook_deliveries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL,
  task_id uuid,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending'::text,
  response_code integer,
  response_body text,
  attempts integer NOT NULL DEFAULT 0,
  last_attempt_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  last_error text,
  delivered_at timestamp with time zone,
  CONSTRAINT webhook_deliveries_pkey PRIMARY KEY (id),
  CONSTRAINT webhook_deliveries_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE,
  CONSTRAINT webhook_deliveries_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------------------
-- 2. Indexes (beyond primary keys and unique constraints)
-- ---------------------------------------------------------------------------

-- activity_log
CREATE INDEX idx_activity_log_workspace ON public.activity_log (workspace_id, created_at DESC);
CREATE INDEX idx_activity_log_agent_id ON public.activity_log (agent_id);
CREATE INDEX idx_activity_log_user_id ON public.activity_log (user_id);

-- agent_quotas
CREATE INDEX idx_agent_quotas_workspace_id ON public.agent_quotas (workspace_id);
CREATE INDEX idx_agent_quotas_agent_id ON public.agent_quotas (agent_id);

-- agent_updates
CREATE INDEX idx_agent_updates_agent ON public.agent_updates (agent_id, created_at DESC);

-- agents
CREATE INDEX idx_agents_workspace ON public.agents (workspace_id);
CREATE INDEX idx_agents_api_key ON public.agents (api_key);
CREATE INDEX idx_agents_tags ON public.agents USING gin (tags);

-- problems
CREATE INDEX idx_problems_agent ON public.problems (agent_id, status);
CREATE INDEX idx_problems_task ON public.problems (task_id);
CREATE INDEX idx_problems_resolved_by ON public.problems (resolved_by);

-- project_agents
CREATE INDEX idx_project_agents_project_id ON public.project_agents (project_id);
CREATE INDEX idx_project_agents_agent_id ON public.project_agents (agent_id);
CREATE UNIQUE INDEX idx_project_agents_one_lead_per_project ON public.project_agents (project_id) WHERE (role = 'lead'::text);

-- project_files
CREATE INDEX idx_project_files_project_id ON public.project_files (project_id);

-- projects
CREATE INDEX idx_projects_workspace_id ON public.projects (workspace_id);
CREATE INDEX idx_projects_lead_agent_id ON public.projects (lead_agent_id);
CREATE INDEX idx_projects_status ON public.projects (status);

-- rate_limit_windows
CREATE INDEX idx_rate_limit_windows_window_start ON public.rate_limit_windows (window_start);

-- task_agents
CREATE INDEX idx_task_agents_task ON public.task_agents (task_id);
CREATE INDEX idx_task_agents_agent ON public.task_agents (agent_id);
CREATE UNIQUE INDEX idx_task_agents_one_primary ON public.task_agents (task_id) WHERE (role = 'primary'::text);

-- task_comments
CREATE INDEX idx_task_comments_task ON public.task_comments (task_id, created_at);
CREATE INDEX idx_task_comments_workspace ON public.task_comments (workspace_id);
CREATE INDEX idx_task_comments_agent_id ON public.task_comments (agent_id);
CREATE INDEX idx_task_comments_user_id ON public.task_comments (user_id);

-- task_dependencies
CREATE INDEX idx_task_dependencies_task_id ON public.task_dependencies (task_id);
CREATE INDEX idx_task_dependencies_depends_on ON public.task_dependencies (depends_on_task_id);

-- tasks
CREATE INDEX idx_tasks_workspace ON public.tasks (workspace_id, status);
CREATE INDEX idx_tasks_agent ON public.tasks (agent_id);
CREATE INDEX idx_tasks_assigned_to ON public.tasks (assigned_to);
CREATE INDEX idx_tasks_created_by ON public.tasks (created_by);
CREATE INDEX idx_tasks_project_id ON public.tasks (project_id);

-- webhook_deliveries
CREATE INDEX idx_webhook_deliveries_agent_id ON public.webhook_deliveries (agent_id);
CREATE INDEX idx_webhook_deliveries_task_id ON public.webhook_deliveries (task_id);
CREATE INDEX idx_webhook_deliveries_status ON public.webhook_deliveries (status);

-- workspace_invitations
CREATE INDEX idx_workspace_invitations_workspace ON public.workspace_invitations (workspace_id);
CREATE INDEX idx_workspace_invitations_token ON public.workspace_invitations (token);

-- workspace_members
CREATE INDEX idx_workspace_members_user_id ON public.workspace_members (user_id);

-- workspaces
CREATE INDEX idx_workspaces_created_by ON public.workspaces (created_by);

-- ---------------------------------------------------------------------------
-- 3. Functions
-- ---------------------------------------------------------------------------

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Check if calling user belongs to any workspace
CREATE OR REPLACE FUNCTION public.check_user_workspace_membership()
RETURNS TABLE(workspace_id uuid, role text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT wm.workspace_id, wm.role
  FROM workspace_members wm
  WHERE wm.user_id = auth.uid()
  LIMIT 1;
$$;

-- Create a workspace and add the calling user as owner
CREATE OR REPLACE FUNCTION public.create_workspace_for_user(workspace_name text, workspace_slug text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  existing_workspace_id uuid;
  new_workspace_id uuid;
BEGIN
  SELECT wm.workspace_id INTO existing_workspace_id
  FROM workspace_members wm
  WHERE wm.user_id = auth.uid()
  LIMIT 1;

  IF existing_workspace_id IS NOT NULL THEN
    RETURN existing_workspace_id;
  END IF;

  INSERT INTO workspaces (name, slug, created_by)
  VALUES (workspace_name, workspace_slug, auth.uid())
  RETURNING id INTO new_workspace_id;

  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (new_workspace_id, auth.uid(), 'owner');

  RETURN new_workspace_id;
END;
$$;

-- Get all workspace IDs for a user
CREATE OR REPLACE FUNCTION public.get_user_workspace_ids(uid uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT workspace_id FROM workspace_members WHERE user_id = uid;
$$;

-- Get workspace member emails (scoped to caller's workspace membership)
CREATE OR REPLACE FUNCTION public.get_workspace_member_emails(ws_id uuid)
RETURNS TABLE(email text, user_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT u.email::text, wm.user_id
  FROM workspace_members wm
  JOIN public."user" u ON u.id::uuid = wm.user_id
  WHERE wm.workspace_id = ws_id
    AND ws_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE workspace_members.user_id = auth.uid()
    );
END;
$$;

-- Check if user is admin or owner of a workspace
CREATE OR REPLACE FUNCTION public.is_workspace_admin_or_owner(ws_id uuid, uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = ws_id AND user_id = uid AND role IN ('owner', 'admin')
  );
$$;

-- Check if user is owner of a workspace
CREATE OR REPLACE FUNCTION public.is_workspace_owner(ws_id uuid, uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = ws_id AND user_id = uid AND role = 'owner'
  );
$$;

-- Atomically increment rate-limit counter (upsert)
CREATE OR REPLACE FUNCTION public.increment_rate_limit(p_agent_id uuid, p_window_type text, p_window_start timestamp with time zone)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO rate_limit_windows (agent_id, window_type, window_start, request_count)
  VALUES (p_agent_id, p_window_type, p_window_start, 1)
  ON CONFLICT (agent_id, window_type, window_start)
  DO UPDATE SET request_count = rate_limit_windows.request_count + 1
  RETURNING request_count INTO v_count;

  RETURN v_count;
END;
$$;

-- Mark agents with no heartbeat in 5 minutes as offline
CREATE OR REPLACE FUNCTION public.mark_stale_agents_offline()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH updated AS (
    UPDATE agents a
    SET health = 'offline', updated_at = now()
    FROM (
      SELECT id, health AS previous_health
      FROM agents
      WHERE health != 'offline'
        AND last_seen_at IS NOT NULL
        AND last_seen_at::timestamptz < now() - interval '5 minutes'
      FOR UPDATE
    ) old
    WHERE a.id = old.id
    RETURNING a.id, a.workspace_id, a.name, old.previous_health
  )
  INSERT INTO activity_log (workspace_id, action, agent_id, details)
  SELECT
    workspace_id,
    'agent.auto_offline',
    id,
    jsonb_build_object(
      'agent_name', name,
      'previous_health', previous_health,
      'reason', 'no_heartbeat_5m'
    )
  FROM updated;
$$;

-- Create default notification settings when a workspace is created
CREATE OR REPLACE FUNCTION public.create_default_notification_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO notification_settings (workspace_id)
  VALUES (NEW.id)
  ON CONFLICT (workspace_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Send Slack notification when a problem is created
--
-- SECURITY NOTE (SSRF): This function reads the Slack webhook URL from
-- notification_settings, which is admin-configurable only. The URL is not
-- user-supplied at invocation time. Accepted risk: a workspace admin could
-- set a malicious URL. Mitigation: pg_net runs in a restricted network context
-- and Slack URLs are validated in the application layer before saving.
CREATE OR REPLACE FUNCTION public.notify_slack_on_problem()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  slack_url text;
  agent_name text;
  workspace_name text;
  task_title text;
  severity_thresholds text[];
  payload jsonb;
  fields jsonb;
BEGIN
  SELECT a.name, w.name INTO agent_name, workspace_name
  FROM agents a
  JOIN workspaces w ON w.id = a.workspace_id
  WHERE a.id = NEW.agent_id;

  SELECT ns.slack_webhook_url, ns.notify_on_problem_severity
  INTO slack_url, severity_thresholds
  FROM notification_settings ns
  JOIN agents a ON a.workspace_id = ns.workspace_id
  WHERE a.id = NEW.agent_id
    AND ns.slack_enabled = true
    AND ns.slack_webhook_url IS NOT NULL;

  IF slack_url IS NULL OR NOT (NEW.severity = ANY(severity_thresholds)) THEN
    RETURN NEW;
  END IF;

  IF NEW.task_id IS NOT NULL THEN
    SELECT title INTO task_title FROM tasks WHERE id = NEW.task_id;
  END IF;

  fields := jsonb_build_array(
    jsonb_build_object('type', 'mrkdwn', 'text', '*Agent:*' || E'\n' || COALESCE(agent_name, 'Unknown')),
    jsonb_build_object('type', 'mrkdwn', 'text', '*Severity:*' || E'\n' || NEW.severity),
    jsonb_build_object('type', 'mrkdwn', 'text', '*Workspace:*' || E'\n' || COALESCE(workspace_name, 'Unknown'))
  );

  IF task_title IS NOT NULL THEN
    fields := fields || jsonb_build_array(
      jsonb_build_object('type', 'mrkdwn', 'text', '*Blocked Task:*' || E'\n' || task_title)
    );
  END IF;

  payload := jsonb_build_object(
    'blocks', jsonb_build_array(
      jsonb_build_object(
        'type', 'header',
        'text', jsonb_build_object(
          'type', 'plain_text',
          'text', CASE NEW.severity
            WHEN 'critical' THEN 'Critical Problem Reported'
            WHEN 'high' THEN 'High Priority Problem'
            ELSE 'Problem Reported'
          END || ': ' || NEW.title
        )
      ),
      jsonb_build_object('type', 'section', 'fields', fields),
      jsonb_build_object(
        'type', 'section',
        'text', jsonb_build_object(
          'type', 'mrkdwn',
          'text', COALESCE(NEW.description, '_No description provided_')
        )
      )
    )
  );

  PERFORM net.http_post(
    url := slack_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := payload
  );

  RETURN NEW;
END;
$$;

-- Notify Edge Function to process pending webhook deliveries.
-- NOTE: Update the URL below to match your Supabase project.
-- For hosted Supabase: https://<project-ref>.supabase.co/functions/v1/process-webhook-deliveries
-- For local development: http://localhost:54321/functions/v1/process-webhook-deliveries
--
-- SECURITY NOTE: This function calls an Edge Function via HTTP. The Authorization
-- header uses the service_role key from app.settings. On hosted Supabase, internal
-- Edge Function calls don't strictly require auth (the header is harmless). For
-- self-hosted deployments, set app.settings.service_role_key via ALTER SYSTEM or
-- postgresql.conf to authenticate the request.
CREATE OR REPLACE FUNCTION public.notify_webhook_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'net'
AS $$
BEGIN
  PERFORM net.http_post(
    url := coalesce(
      current_setting('app.settings.supabase_url', true),
      'http://localhost:54321'
    ) || '/functions/v1/process-webhook-deliveries',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(
        current_setting('app.settings.service_role_key', true),
        ''
      )
    ),
    timeout_milliseconds := 10000
  );
  RETURN NEW;
END;
$$;

-- Sync primary agent assignment from task_agents to tasks.agent_id
CREATE OR REPLACE FUNCTION public.sync_primary_agent_to_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.role = 'primary' AND NEW.role != 'primary' THEN
    UPDATE public.tasks SET agent_id = NULL, updated_at = now() WHERE id = NEW.task_id;
  ELSIF TG_OP IN ('INSERT','UPDATE') AND NEW.role = 'primary' THEN
    UPDATE public.tasks SET agent_id = NEW.agent_id, updated_at = now() WHERE id = NEW.task_id;
  ELSIF TG_OP = 'DELETE' AND OLD.role = 'primary' THEN
    UPDATE public.tasks SET agent_id = NULL, updated_at = now() WHERE id = OLD.task_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Auto-dispatch downstream tasks when dependencies are satisfied
CREATE OR REPLACE FUNCTION public.dispatch_ready_tasks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  downstream_task     RECORD;
  unmet_dep_count     INTEGER;
  assigned_agent      RECORD;
  task_project        RECORD;
  dispatch_payload    JSONB;
BEGIN
  IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  FOR downstream_task IN
    SELECT t.*
    FROM task_dependencies td
    JOIN tasks t ON t.id = td.task_id
    WHERE td.depends_on_task_id = NEW.id
      AND t.status = 'pending'
  LOOP
    SELECT COUNT(*) INTO unmet_dep_count
    FROM task_dependencies td2
    JOIN tasks dep ON dep.id = td2.depends_on_task_id
    WHERE td2.task_id = downstream_task.id
      AND dep.status <> 'completed';

    IF unmet_dep_count = 0 THEN
      UPDATE tasks
      SET status = 'in_progress', updated_at = now()
      WHERE id = downstream_task.id;

      IF downstream_task.project_id IS NOT NULL THEN
        SELECT id, name, status, orchestration_mode
        INTO task_project
        FROM projects
        WHERE id = downstream_task.project_id;
      ELSE
        task_project := NULL;
      END IF;

      dispatch_payload := jsonb_build_object(
        'event',      'task.ready',
        'task',       jsonb_build_object(
                        'id',          downstream_task.id,
                        'title',       downstream_task.title,
                        'description', downstream_task.description,
                        'status',      'in_progress',
                        'priority',    downstream_task.priority,
                        'workspace_id',downstream_task.workspace_id,
                        'project_id',  downstream_task.project_id
                      ),
        'trigger',    jsonb_build_object(
                        'completed_task_id',    NEW.id,
                        'completed_task_title', NEW.title
                      ),
        'project',    CASE
                        WHEN task_project IS NOT NULL THEN
                          jsonb_build_object(
                            'id',                   task_project.id,
                            'name',                 task_project.name,
                            'status',               task_project.status,
                            'orchestration_mode',   task_project.orchestration_mode
                          )
                        ELSE NULL
                      END,
        'dispatched_at', now()
      );

      FOR assigned_agent IN
        SELECT a.id AS agent_id, a.webhook_url, ta.role
        FROM task_agents ta
        JOIN agents a ON a.id = ta.agent_id
        WHERE ta.task_id = downstream_task.id
          AND a.webhook_url IS NOT NULL
          AND a.webhook_url <> ''
      LOOP
        INSERT INTO webhook_deliveries (
          agent_id, task_id, event_type, payload, status, attempts, created_at
        ) VALUES (
          assigned_agent.agent_id, downstream_task.id, 'task.ready',
          dispatch_payload, 'pending', 0, now()
        );
      END LOOP;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Auto-update project status based on task completion
CREATE OR REPLACE FUNCTION public.update_project_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_project_id        UUID;
  v_current_status    TEXT;
  v_total             INTEGER;
  v_completed         INTEGER;
  v_cancelled         INTEGER;
  v_new_status        TEXT;
BEGIN
  v_project_id := COALESCE(NEW.project_id, OLD.project_id);

  IF v_project_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status = OLD.status AND NEW.project_id IS NOT DISTINCT FROM OLD.project_id THEN
    RETURN NEW;
  END IF;

  SELECT status INTO v_current_status
  FROM projects WHERE id = v_project_id;

  IF NOT FOUND THEN RETURN NEW; END IF;

  IF v_current_status IN ('paused', 'cancelled') THEN
    RETURN NEW;
  END IF;

  SELECT
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE status = 'completed') AS completed,
    COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled
  INTO v_total, v_completed, v_cancelled
  FROM tasks WHERE project_id = v_project_id;

  IF v_total = 0 THEN RETURN NEW; END IF;

  IF v_completed = v_total THEN
    v_new_status := 'completed';
  ELSIF v_completed = (v_total - v_cancelled) AND (v_total - v_cancelled) > 0 THEN
    v_new_status := 'completed';
  ELSE
    IF v_current_status = 'draft' THEN
      IF EXISTS (
        SELECT 1 FROM tasks
        WHERE project_id = v_project_id
          AND status IN ('in_progress', 'completed', 'waiting_on_agent', 'waiting_on_human')
        LIMIT 1
      ) THEN
        v_new_status := 'active';
      ELSE
        RETURN NEW;
      END IF;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  IF v_new_status IS NOT NULL AND v_new_status <> v_current_status THEN
    UPDATE projects SET status = v_new_status, updated_at = now()
    WHERE id = v_project_id;

    INSERT INTO activity_log (workspace_id, action, details)
    SELECT
      p.workspace_id,
      'project.status_auto_updated',
      jsonb_build_object(
        'project_id',   v_project_id,
        'old_status',   v_current_status,
        'new_status',   v_new_status,
        'trigger_task', NEW.id,
        'total_tasks',  v_total,
        'completed_tasks', v_completed
      )
    FROM projects p WHERE p.id = v_project_id;
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Triggers
-- ---------------------------------------------------------------------------

-- updated_at auto-maintenance
CREATE TRIGGER update_agents_updated_at
  BEFORE UPDATE ON public.agents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_workspaces_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_notification_settings_updated_at
  BEFORE UPDATE ON public.notification_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Auto-create notification settings for new workspaces
CREATE TRIGGER trigger_create_notification_settings
  AFTER INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.create_default_notification_settings();

-- Slack notification on new problem
CREATE TRIGGER trigger_slack_on_problem
  AFTER INSERT ON public.problems
  FOR EACH ROW EXECUTE FUNCTION public.notify_slack_on_problem();

-- Sync task_agents.primary → tasks.agent_id
CREATE TRIGGER trg_sync_primary_agent
  AFTER INSERT OR UPDATE OR DELETE ON public.task_agents
  FOR EACH ROW EXECUTE FUNCTION public.sync_primary_agent_to_task();

-- Auto-dispatch downstream tasks when a task completes
CREATE TRIGGER trg_dispatch_ready_tasks
  AFTER UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.dispatch_ready_tasks();

-- Auto-update project status when task status changes
CREATE TRIGGER trg_update_project_status
  AFTER UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_project_status();

-- Process webhook deliveries via Edge Function
CREATE TRIGGER trigger_process_webhook_delivery
  AFTER INSERT ON public.webhook_deliveries
  FOR EACH STATEMENT EXECUTE FUNCTION public.notify_webhook_delivery();

-- ---------------------------------------------------------------------------
-- 5. Row Level Security
-- ---------------------------------------------------------------------------

-- Enable RLS on all tables
ALTER TABLE public."user" ENABLE ROW LEVEL SECURITY;
-- SECURITY NOTE: verification has RLS enabled but no policies. This is intentional.
-- Better Auth manages this table via a direct pg.Pool connection (bypasses RLS).
-- No Supabase client ever queries this table directly.
ALTER TABLE public.verification ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_updates ENABLE ROW LEVEL SECURITY;
-- SECURITY NOTE: rate_limit_windows has RLS enabled but no policies. This is intentional.
-- Only accessed by the SECURITY DEFINER function check_and_increment_rate_limit(),
-- which runs as the function owner (bypasses RLS). No client-side access needed.
ALTER TABLE public.rate_limit_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- ── user ──
CREATE POLICY user_select_own ON public."user"
  AS PERMISSIVE FOR SELECT TO public
  USING (id = auth.uid());

CREATE POLICY user_update_own ON public."user"
  AS PERMISSIVE FOR UPDATE TO public
  USING (id = auth.uid());

-- ── account ──
CREATE POLICY account_select_own ON public.account
  AS PERMISSIVE FOR SELECT TO public
  USING ("userId" = auth.uid());

CREATE POLICY account_delete_own ON public.account
  AS PERMISSIVE FOR DELETE TO public
  USING ("userId" = auth.uid());

-- ── session ──
CREATE POLICY session_select_own ON public.session
  AS PERMISSIVE FOR SELECT TO public
  USING ("userId" = auth.uid());

CREATE POLICY session_delete_own ON public.session
  AS PERMISSIVE FOR DELETE TO public
  USING ("userId" = auth.uid());

-- ── waitlist ──
CREATE POLICY waitlist_public_insert ON public.waitlist
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (email IS NOT NULL AND email ~* '^[^@]+@[^@]+\.[^@]+$'::text);

-- ── workspaces ──
CREATE POLICY "Authenticated users can create workspaces" ON public.workspaces
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view their workspaces" ON public.workspaces
  AS PERMISSIVE FOR SELECT TO public
  USING (id IN (SELECT workspace_id FROM workspace_members WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "Owners and admins can update workspaces" ON public.workspaces
  AS PERMISSIVE FOR UPDATE TO public
  USING (id IN (SELECT workspace_id FROM workspace_members WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin')))
  WITH CHECK (id IN (SELECT workspace_id FROM workspace_members WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin')));

CREATE POLICY "Owners can delete workspaces" ON public.workspaces
  AS PERMISSIVE FOR DELETE TO public
  USING (id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role = 'owner'));

-- ── workspace_members ──
CREATE POLICY "Users can view workspace members" ON public.workspace_members
  AS PERMISSIVE FOR SELECT TO public
  USING (workspace_id IN (SELECT get_user_workspace_ids((SELECT auth.uid()))));

CREATE POLICY "Owners and admins can insert workspace members" ON public.workspace_members
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin')));

CREATE POLICY "Owners can update workspace members" ON public.workspace_members
  AS PERMISSIVE FOR UPDATE TO public
  USING (is_workspace_owner(workspace_id, (SELECT auth.uid())));

CREATE POLICY "Owners and admins can delete workspace members" ON public.workspace_members
  AS PERMISSIVE FOR DELETE TO public
  USING (is_workspace_admin_or_owner(workspace_id, (SELECT auth.uid())));

-- ── workspace_invitations ──
CREATE POLICY workspace_invitations_select ON public.workspace_invitations
  AS PERMISSIVE FOR SELECT TO public
  USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

CREATE POLICY workspace_invitations_insert ON public.workspace_invitations
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (is_workspace_admin_or_owner(workspace_id, auth.uid()));

CREATE POLICY workspace_invitations_update ON public.workspace_invitations
  AS PERMISSIVE FOR UPDATE TO public
  USING (is_workspace_admin_or_owner(workspace_id, auth.uid()));

CREATE POLICY workspace_invitations_delete ON public.workspace_invitations
  AS PERMISSIVE FOR DELETE TO public
  USING (is_workspace_admin_or_owner(workspace_id, auth.uid()));

-- ── agents ──
CREATE POLICY "Workspace members can view agents" ON public.agents
  AS PERMISSIVE FOR SELECT TO public
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "Workspace members can insert agents" ON public.agents
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "Workspace members can update agents" ON public.agents
  AS PERMISSIVE FOR UPDATE TO public
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = (SELECT auth.uid())))
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "Owners and admins can delete agents" ON public.agents
  AS PERMISSIVE FOR DELETE TO public
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin')));

-- ── notification_settings ──
CREATE POLICY "Workspace members can view notification settings" ON public.notification_settings
  AS PERMISSIVE FOR SELECT TO public
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "Owners and admins can insert notification settings" ON public.notification_settings
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin')));

CREATE POLICY "Owners and admins can update notification settings" ON public.notification_settings
  AS PERMISSIVE FOR UPDATE TO public
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin')));

CREATE POLICY "Owners and admins can delete notification settings" ON public.notification_settings
  AS PERMISSIVE FOR DELETE TO public
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin')));

-- ── agent_quotas ──
CREATE POLICY "Users can view quotas in their workspace" ON public.agent_quotas
  AS PERMISSIVE FOR SELECT TO public
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "Admins and owners can insert quotas" ON public.agent_quotas
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role IN ('admin', 'owner')));

CREATE POLICY "Admins and owners can update quotas" ON public.agent_quotas
  AS PERMISSIVE FOR UPDATE TO public
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role IN ('admin', 'owner')))
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role IN ('admin', 'owner')));

CREATE POLICY "Admins and owners can delete quotas" ON public.agent_quotas
  AS PERMISSIVE FOR DELETE TO public
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role IN ('admin', 'owner')));

-- ── agent_updates ──
CREATE POLICY "Workspace members can view agent updates" ON public.agent_updates
  AS PERMISSIVE FOR SELECT TO public
  USING (agent_id IN (SELECT id FROM agents WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = (SELECT auth.uid()))));

CREATE POLICY "Workspace members can insert agent updates" ON public.agent_updates
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (agent_id IN (SELECT id FROM agents WHERE workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))));

-- ── projects ──
CREATE POLICY projects_select ON public.projects
  AS PERMISSIVE FOR SELECT TO public
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = (SELECT auth.uid())));

CREATE POLICY projects_insert ON public.projects
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

CREATE POLICY projects_update ON public.projects
  AS PERMISSIVE FOR UPDATE TO public
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin')));

CREATE POLICY projects_delete ON public.projects
  AS PERMISSIVE FOR DELETE TO public
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin')));

-- ── project_agents ──
CREATE POLICY project_agents_select ON public.project_agents
  AS PERMISSIVE FOR SELECT TO public
  USING (project_id IN (SELECT id FROM projects WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = (SELECT auth.uid()))));

CREATE POLICY project_agents_insert ON public.project_agents
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))));

CREATE POLICY project_agents_update ON public.project_agents
  AS PERMISSIVE FOR UPDATE TO public
  USING (project_id IN (SELECT id FROM projects WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))));

CREATE POLICY project_agents_delete ON public.project_agents
  AS PERMISSIVE FOR DELETE TO public
  USING (project_id IN (SELECT id FROM projects WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))));

-- ── project_files ──
CREATE POLICY project_files_select ON public.project_files
  AS PERMISSIVE FOR SELECT TO public
  USING (project_id IN (SELECT id FROM projects WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = (SELECT auth.uid()))));

CREATE POLICY project_files_insert ON public.project_files
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = (SELECT auth.uid()))));

CREATE POLICY project_files_update ON public.project_files
  AS PERMISSIVE FOR UPDATE TO public
  USING (project_id IN (SELECT id FROM projects WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = (SELECT auth.uid()))));

CREATE POLICY project_files_delete ON public.project_files
  AS PERMISSIVE FOR DELETE TO public
  USING (project_id IN (SELECT id FROM projects WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))));

-- ── tasks ──
CREATE POLICY "Workspace members can view tasks" ON public.tasks
  AS PERMISSIVE FOR SELECT TO public
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "Admins and owners can insert tasks" ON public.tasks
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

CREATE POLICY "Admins and owners can update tasks" ON public.tasks
  AS PERMISSIVE FOR UPDATE TO public
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

CREATE POLICY "Admins and owners can delete tasks" ON public.tasks
  AS PERMISSIVE FOR DELETE TO public
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

-- ── task_agents ──
CREATE POLICY "Workspace members can view task_agents" ON public.task_agents
  AS PERMISSIVE FOR SELECT TO public
  USING (task_id IN (SELECT id FROM tasks WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = (SELECT auth.uid()))));

CREATE POLICY "Workspace members can insert task_agents" ON public.task_agents
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (task_id IN (SELECT id FROM tasks WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = (SELECT auth.uid()))));

CREATE POLICY "Workspace members can update task_agents" ON public.task_agents
  AS PERMISSIVE FOR UPDATE TO public
  USING (task_id IN (SELECT id FROM tasks WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = (SELECT auth.uid()))))
  WITH CHECK (task_id IN (SELECT id FROM tasks WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = (SELECT auth.uid()))));

CREATE POLICY "Admins and owners can delete task_agents" ON public.task_agents
  AS PERMISSIVE FOR DELETE TO public
  USING (task_id IN (SELECT id FROM tasks WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))));

-- ── task_comments ──
CREATE POLICY "Workspace members can view task comments" ON public.task_comments
  AS PERMISSIVE FOR SELECT TO public
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "Workspace members can insert task comments" ON public.task_comments
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "Users can update their own comments" ON public.task_comments
  AS PERMISSIVE FOR UPDATE TO public
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own comments" ON public.task_comments
  AS PERMISSIVE FOR DELETE TO public
  USING (user_id = (SELECT auth.uid()));

-- ── task_dependencies ──
CREATE POLICY task_dependencies_select ON public.task_dependencies
  AS PERMISSIVE FOR SELECT TO public
  USING (task_id IN (SELECT id FROM tasks WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = (SELECT auth.uid()))));

CREATE POLICY task_dependencies_insert ON public.task_dependencies
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (task_id IN (SELECT id FROM tasks WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = (SELECT auth.uid()))));

CREATE POLICY task_dependencies_update ON public.task_dependencies
  AS PERMISSIVE FOR UPDATE TO public
  USING (task_id IN (SELECT id FROM tasks WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = (SELECT auth.uid()))));

CREATE POLICY task_dependencies_delete ON public.task_dependencies
  AS PERMISSIVE FOR DELETE TO public
  USING (task_id IN (SELECT id FROM tasks WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))));

-- ── problems ──
CREATE POLICY "Workspace members can view problems" ON public.problems
  AS PERMISSIVE FOR SELECT TO public
  USING (agent_id IN (SELECT id FROM agents WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = (SELECT auth.uid()))));

CREATE POLICY "Workspace members can insert problems" ON public.problems
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (agent_id IN (SELECT id FROM agents WHERE workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))));

CREATE POLICY "Workspace members can update problems" ON public.problems
  AS PERMISSIVE FOR UPDATE TO public
  USING (agent_id IN (SELECT id FROM agents WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = (SELECT auth.uid()))))
  WITH CHECK (agent_id IN (SELECT id FROM agents WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = (SELECT auth.uid()))));

CREATE POLICY "Admins and owners can delete problems" ON public.problems
  AS PERMISSIVE FOR DELETE TO public
  USING (agent_id IN (SELECT id FROM agents WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))));

-- ── activity_log ──
CREATE POLICY "Workspace members can view activity log" ON public.activity_log
  AS PERMISSIVE FOR SELECT TO public
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "Workspace members can insert activity log" ON public.activity_log
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = (SELECT auth.uid())));

-- ── webhook_deliveries ──
-- SECURITY NOTE: Only SELECT policy exists. INSERT/UPDATE/DELETE are performed by
-- the admin Supabase client (service_role key, bypasses RLS) and SECURITY DEFINER
-- functions. End users can only read deliveries for agents in their workspaces.
CREATE POLICY webhook_deliveries_select ON public.webhook_deliveries
  AS PERMISSIVE FOR SELECT TO public
  USING (agent_id IN (SELECT id FROM agents WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = (SELECT auth.uid()))));
