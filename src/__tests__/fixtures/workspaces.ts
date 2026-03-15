export const workspaceFixtures = {
  default: {
    id: "ws-001",
    name: "Acme Corp",
    slug: "acme-corp",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    notification_settings: {
      slack_webhook_url: "https://hooks.slack.com/services/T00/B00/xxx",
    },
  },
};

export const memberFixtures = {
  owner: {
    id: "member-001",
    workspace_id: "ws-001",
    user_id: "user-001",
    role: "owner" as const,
    created_at: "2024-01-01T00:00:00Z",
  },
  member: {
    id: "member-002",
    workspace_id: "ws-001",
    user_id: "user-002",
    role: "member" as const,
    created_at: "2024-01-02T00:00:00Z",
  },
};
