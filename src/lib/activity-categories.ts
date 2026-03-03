/**
 * Mapping of activity filter categories to their constituent action types.
 * Shared between the client-side filter component and the server-side export API.
 */
export const CATEGORY_ACTIONS: Record<string, string[]> = {
  agent_lifecycle: ["agent_registered", "status_update", "agent.auto_offline"],
  task_events: ["task_created", "task_updated", "task_completed", "task_comment"],
  problems: ["problem_reported"],
};

export const ALL_KNOWN_ACTIONS: string[] = Object.values(CATEGORY_ACTIONS).flat();
