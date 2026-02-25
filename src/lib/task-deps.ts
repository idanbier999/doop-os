import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
type TaskDependencyRow = Database["public"]["Tables"]["task_dependencies"]["Row"];

export interface DependencyGraph {
  tasks: Record<string, TaskRow>;
  edges: Array<{ from: string; to: string }>; // from depends on to
}

function getSupabase(supabase?: SupabaseClient<Database>): SupabaseClient<Database> {
  return supabase ?? (createClient() as SupabaseClient<Database>);
}

/**
 * Returns tasks in a project that are ready to be dispatched:
 * all their dependencies are 'completed' and they are still 'pending'.
 */
export async function getReadyTasks(
  projectId: string,
  supabase?: SupabaseClient<Database>
): Promise<TaskRow[]> {
  const db = getSupabase(supabase);

  // Fetch all pending tasks in the project
  const { data: pendingTasks, error: tasksError } = await db
    .from("tasks")
    .select("*")
    .eq("project_id", projectId)
    .eq("status", "pending");

  if (tasksError || !pendingTasks) return [];

  if (pendingTasks.length === 0) return [];

  const pendingIds = pendingTasks.map((t) => t.id);

  // Fetch all dependencies for these tasks
  const { data: deps, error: depsError } = await db
    .from("task_dependencies")
    .select("task_id, depends_on_task_id")
    .in("task_id", pendingIds);

  if (depsError) return [];

  // Group dependencies by task_id
  const depsByTask: Record<string, string[]> = {};
  for (const dep of deps ?? []) {
    if (!depsByTask[dep.task_id]) depsByTask[dep.task_id] = [];
    depsByTask[dep.task_id].push(dep.depends_on_task_id);
  }

  // Tasks with no dependencies are immediately ready
  const tasksWithDeps = pendingTasks.filter((t) => depsByTask[t.id]?.length > 0);
  const tasksWithoutDeps = pendingTasks.filter((t) => !depsByTask[t.id]?.length);

  if (tasksWithDeps.length === 0) return tasksWithoutDeps;

  // For tasks with dependencies, check if all depends_on tasks are completed
  const allDepIds = [...new Set(tasksWithDeps.flatMap((t) => depsByTask[t.id]))];

  const { data: depTasks, error: depTasksError } = await db
    .from("tasks")
    .select("id, status")
    .in("id", allDepIds);

  if (depTasksError || !depTasks) return tasksWithoutDeps;

  const statusById: Record<string, string> = {};
  for (const t of depTasks) {
    statusById[t.id] = t.status;
  }

  const unlockedByDeps = tasksWithDeps.filter((t) =>
    depsByTask[t.id].every((depId) => statusById[depId] === "completed")
  );

  return [...tasksWithoutDeps, ...unlockedByDeps];
}

/**
 * Returns the list of tasks that block a given task (incomplete dependencies).
 */
export async function getBlockingTasks(
  taskId: string,
  supabase?: SupabaseClient<Database>
): Promise<TaskRow[]> {
  const db = getSupabase(supabase);

  const { data: deps, error: depsError } = await db
    .from("task_dependencies")
    .select("depends_on_task_id")
    .eq("task_id", taskId);

  if (depsError || !deps || deps.length === 0) return [];

  const depIds = deps.map((d) => d.depends_on_task_id);

  const { data: depTasks, error: tasksError } = await db
    .from("tasks")
    .select("*")
    .in("id", depIds)
    .neq("status", "completed");

  if (tasksError || !depTasks) return [];

  return depTasks;
}

/**
 * Returns a structured dependency graph for a project.
 * edges: { from: taskId, to: taskId } means "from depends on to"
 */
export async function getDependencyGraph(
  projectId: string,
  supabase?: SupabaseClient<Database>
): Promise<DependencyGraph> {
  const db = getSupabase(supabase);

  const { data: tasks, error: tasksError } = await db
    .from("tasks")
    .select("*")
    .eq("project_id", projectId);

  if (tasksError || !tasks) return { tasks: {}, edges: [] };

  const tasksById: Record<string, TaskRow> = {};
  for (const t of tasks) {
    tasksById[t.id] = t;
  }

  const taskIds = tasks.map((t) => t.id);
  if (taskIds.length === 0) return { tasks: tasksById, edges: [] };

  const { data: deps, error: depsError } = await db
    .from("task_dependencies")
    .select("task_id, depends_on_task_id")
    .in("task_id", taskIds);

  if (depsError || !deps) return { tasks: tasksById, edges: [] };

  const edges = deps.map((d) => ({
    from: d.task_id,
    to: d.depends_on_task_id,
  }));

  return { tasks: tasksById, edges };
}

/**
 * Returns true if all dependencies for a task are satisfied (completed).
 */
export async function canTaskStart(
  taskId: string,
  supabase?: SupabaseClient<Database>
): Promise<boolean> {
  const blocking = await getBlockingTasks(taskId, supabase);
  return blocking.length === 0;
}

/**
 * Returns tasks that depend on the given task (tasks that would be
 * unblocked when this task completes).
 */
export async function getDownstreamTasks(
  taskId: string,
  supabase?: SupabaseClient<Database>
): Promise<TaskRow[]> {
  const db = getSupabase(supabase);

  const { data: deps, error: depsError } = await db
    .from("task_dependencies")
    .select("task_id")
    .eq("depends_on_task_id", taskId);

  if (depsError || !deps || deps.length === 0) return [];

  const downstreamIds = deps.map((d) => d.task_id);

  const { data: downstreamTasks, error: tasksError } = await db
    .from("tasks")
    .select("*")
    .in("id", downstreamIds);

  if (tasksError || !downstreamTasks) return [];

  return downstreamTasks;
}
