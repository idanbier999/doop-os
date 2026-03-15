import type { Tables } from "./database.types";

export type TaskAgent = {
  agent_id: string;
  role: "primary" | "helper";
  agents: { name: string };
};

export type TaskWithAgents = Tables<"tasks"> & {
  agents?: { name: string } | null;
  task_agents?: TaskAgent[];
};
