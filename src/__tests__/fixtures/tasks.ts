export const taskFixtures = {
  pending: {
    id: "task-001",
    project_id: "proj-001",
    workspace_id: "ws-001",
    title: "Implement login",
    description: "Build login page with email/password",
    status: "pending" as const,
    priority: "high" as const,
    result: null,
    agent_id: null,
    created_at: "2024-01-15T10:00:00Z",
    updated_at: "2024-01-15T10:00:00Z",
  },
  inProgress: {
    id: "task-002",
    project_id: "proj-001",
    workspace_id: "ws-001",
    title: "Design database schema",
    description: "Create tables for users, projects, tasks",
    status: "in_progress" as const,
    priority: "medium" as const,
    result: null,
    agent_id: "agent-001",
    created_at: "2024-01-15T09:00:00Z",
    updated_at: "2024-01-15T11:00:00Z",
  },
  completed: {
    id: "task-003",
    project_id: "proj-001",
    workspace_id: "ws-001",
    title: "Set up CI/CD",
    description: "Configure GitHub Actions",
    status: "completed" as const,
    priority: "low" as const,
    result: { output: "Pipeline created" },
    agent_id: "agent-002",
    created_at: "2024-01-14T08:00:00Z",
    updated_at: "2024-01-15T12:00:00Z",
  },
};

export const dependencyFixtures = {
  // task-001 depends on task-003
  dep1: {
    id: "dep-001",
    task_id: "task-001",
    depends_on_task_id: "task-003",
    created_at: "2024-01-15T10:00:00Z",
  },
  // task-002 depends on task-001
  dep2: {
    id: "dep-002",
    task_id: "task-002",
    depends_on_task_id: "task-001",
    created_at: "2024-01-15T09:00:00Z",
  },
};
