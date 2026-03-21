// Compatibility layer: re-exports Drizzle types in the shape that components expect.
// Components use `Tables<"agents">` which maps to the Drizzle InferSelectModel type.

import type * as DbTypes from "@/lib/db/types";

// JSON type — arbitrary JSON values
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// Tables helper — maps table name to the Drizzle select model type
export type Tables<T extends keyof TableMap> = TableMap[T];

type TableMap = {
  user: DbTypes.User;
  sessions: DbTypes.Session;
  workspaces: DbTypes.Workspace;
  workspace_members: DbTypes.WorkspaceMember;
  workspace_invitations: DbTypes.WorkspaceInvitation;
  agents: DbTypes.Agent;
  notification_settings: DbTypes.NotificationSetting;
  agent_quotas: DbTypes.AgentQuota;
  agent_updates: DbTypes.AgentUpdate;
  rate_limit_windows: DbTypes.RateLimitWindow;
  projects: DbTypes.Project;
  project_agents: DbTypes.ProjectAgent;
  project_files: DbTypes.ProjectFile;
  tasks: DbTypes.Task;
  task_agents: DbTypes.TaskAgent;
  task_comments: DbTypes.TaskComment;
  task_dependencies: DbTypes.TaskDependency;
  problems: DbTypes.Problem;
  activity_log: DbTypes.ActivityLogEntry;
  webhook_deliveries: DbTypes.WebhookDelivery;
  waitlist: DbTypes.WaitlistEntry;
};

// Database type — kept for backward compatibility with type-only imports
export type Database = {
  public: {
    Tables: {
      [K in keyof TableMap]: {
        Row: TableMap[K];
        Insert: unknown;
        Update: unknown;
      };
    };
  };
};
