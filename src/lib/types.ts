import type { Task } from "./db/types";

export type TaskAgent = {
  agent_id: string;
  role: "primary" | "helper";
  agents: { name: string };
};

export type TaskWithAgents = Task & {
  agents?: { name: string } | null;
  task_agents?: TaskAgent[];
};
