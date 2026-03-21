import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import * as schema from "./schema";

// Select types (for reading from DB)
export type User = InferSelectModel<typeof schema.users>;
export type Session = InferSelectModel<typeof schema.sessions>;
export type Workspace = InferSelectModel<typeof schema.workspaces>;
export type WorkspaceMember = InferSelectModel<typeof schema.workspaceMembers>;
export type WorkspaceInvitation = InferSelectModel<typeof schema.workspaceInvitations>;
export type Agent = InferSelectModel<typeof schema.agents>;
export type NotificationSetting = InferSelectModel<typeof schema.notificationSettings>;
export type AgentQuota = InferSelectModel<typeof schema.agentQuotas>;
export type AgentUpdate = InferSelectModel<typeof schema.agentUpdates>;
export type RateLimitWindow = InferSelectModel<typeof schema.rateLimitWindows>;
export type Project = InferSelectModel<typeof schema.projects>;
export type ProjectAgent = InferSelectModel<typeof schema.projectAgents>;
export type ProjectFile = InferSelectModel<typeof schema.projectFiles>;
export type Task = InferSelectModel<typeof schema.tasks>;
export type TaskAgent = InferSelectModel<typeof schema.taskAgents>;
export type TaskComment = InferSelectModel<typeof schema.taskComments>;
export type TaskDependency = InferSelectModel<typeof schema.taskDependencies>;
export type Problem = InferSelectModel<typeof schema.problems>;
export type ActivityLogEntry = InferSelectModel<typeof schema.activityLog>;
export type WebhookDelivery = InferSelectModel<typeof schema.webhookDeliveries>;
export type WaitlistEntry = InferSelectModel<typeof schema.waitlist>;

// Insert types (for writing to DB)
export type NewUser = InferInsertModel<typeof schema.users>;
export type NewSession = InferInsertModel<typeof schema.sessions>;
export type NewWorkspace = InferInsertModel<typeof schema.workspaces>;
export type NewWorkspaceMember = InferInsertModel<typeof schema.workspaceMembers>;
export type NewWorkspaceInvitation = InferInsertModel<typeof schema.workspaceInvitations>;
export type NewAgent = InferInsertModel<typeof schema.agents>;
export type NewNotificationSetting = InferInsertModel<typeof schema.notificationSettings>;
export type NewAgentQuota = InferInsertModel<typeof schema.agentQuotas>;
export type NewAgentUpdate = InferInsertModel<typeof schema.agentUpdates>;
export type NewRateLimitWindow = InferInsertModel<typeof schema.rateLimitWindows>;
export type NewProject = InferInsertModel<typeof schema.projects>;
export type NewProjectAgent = InferInsertModel<typeof schema.projectAgents>;
export type NewProjectFile = InferInsertModel<typeof schema.projectFiles>;
export type NewTask = InferInsertModel<typeof schema.tasks>;
export type NewTaskAgent = InferInsertModel<typeof schema.taskAgents>;
export type NewTaskComment = InferInsertModel<typeof schema.taskComments>;
export type NewTaskDependency = InferInsertModel<typeof schema.taskDependencies>;
export type NewProblem = InferInsertModel<typeof schema.problems>;
export type NewActivityLogEntry = InferInsertModel<typeof schema.activityLog>;
export type NewWebhookDelivery = InferInsertModel<typeof schema.webhookDeliveries>;
export type NewWaitlistEntry = InferInsertModel<typeof schema.waitlist>;
