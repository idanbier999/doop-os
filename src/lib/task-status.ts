const TRANSITIONS: Record<string, string[]> = {
  pending: ["in_progress", "waiting_on_agent", "cancelled"],
  in_progress: ["waiting_on_agent", "waiting_on_human", "completed", "cancelled"],
  waiting_on_agent: ["in_progress", "completed", "cancelled"],
  waiting_on_human: ["in_progress", "completed", "cancelled"],
  completed: [],
  cancelled: [],
};

const TERMINAL = new Set(["completed", "cancelled"]);

export function isValidTransition(from: string, to: string): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function isTerminalStatus(status: string): boolean {
  return TERMINAL.has(status);
}
