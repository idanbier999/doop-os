import { getDb } from "@/lib/db/client";
import { tasks, taskDependencies } from "@/lib/db/schema";
import type { Task } from "@/lib/db/types";
import { eq, and, inArray, sql } from "drizzle-orm";

export interface DependencyGraph {
  tasks: Record<string, Task>;
  edges: Array<{ from: string; to: string }>; // from depends on to
}

/**
 * Get pending tasks in a project whose dependencies are all completed
 * (i.e., they are ready to be dispatched).
 */
export async function getReadyTasks(projectId: string): Promise<Task[]> {
  const db = getDb();

  // Fetch all pending tasks in the project
  const pendingTasks = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.projectId, projectId), eq(tasks.status, "pending")));

  if (pendingTasks.length === 0) return [];

  const pendingIds = pendingTasks.map((t) => t.id);

  // Fetch all dependencies for these tasks
  const deps = await db
    .select({
      taskId: taskDependencies.taskId,
      dependsOnTaskId: taskDependencies.dependsOnTaskId,
    })
    .from(taskDependencies)
    .where(inArray(taskDependencies.taskId, pendingIds));

  // Group dependencies by task_id
  const depsByTask: Record<string, string[]> = {};
  for (const dep of deps) {
    if (!depsByTask[dep.taskId]) depsByTask[dep.taskId] = [];
    depsByTask[dep.taskId].push(dep.dependsOnTaskId);
  }

  // Tasks with no dependencies are immediately ready
  const tasksWithDeps = pendingTasks.filter((t) => depsByTask[t.id]?.length > 0);
  const tasksWithoutDeps = pendingTasks.filter((t) => !depsByTask[t.id]?.length);

  if (tasksWithDeps.length === 0) return tasksWithoutDeps;

  // For tasks with dependencies, check if all depends_on tasks are completed
  const allDepIds = [...new Set(tasksWithDeps.flatMap((t) => depsByTask[t.id]))];

  const depTaskStatuses = await db
    .select({ id: tasks.id, status: tasks.status })
    .from(tasks)
    .where(inArray(tasks.id, allDepIds));

  const statusById: Record<string, string> = {};
  for (const t of depTaskStatuses) {
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
export async function getBlockingTasks(taskId: string): Promise<Task[]> {
  const db = getDb();

  const deps = await db
    .select({ dependsOnTaskId: taskDependencies.dependsOnTaskId })
    .from(taskDependencies)
    .where(eq(taskDependencies.taskId, taskId));

  if (deps.length === 0) return [];

  const depIds = deps.map((d) => d.dependsOnTaskId);

  return db
    .select()
    .from(tasks)
    .where(and(inArray(tasks.id, depIds), sql`${tasks.status} != 'completed'`));
}

/**
 * Returns a structured dependency graph for a project.
 * edges: { from: taskId, to: taskId } means "from depends on to"
 */
export async function getDependencyGraph(projectId: string): Promise<DependencyGraph> {
  const db = getDb();

  const projectTasks = await db.select().from(tasks).where(eq(tasks.projectId, projectId));

  const tasksById: Record<string, Task> = {};
  for (const t of projectTasks) {
    tasksById[t.id] = t;
  }

  const taskIds = projectTasks.map((t) => t.id);
  if (taskIds.length === 0) return { tasks: tasksById, edges: [] };

  const deps = await db
    .select({
      taskId: taskDependencies.taskId,
      dependsOnTaskId: taskDependencies.dependsOnTaskId,
    })
    .from(taskDependencies)
    .where(inArray(taskDependencies.taskId, taskIds));

  const edges = deps.map((d) => ({
    from: d.taskId,
    to: d.dependsOnTaskId,
  }));

  return { tasks: tasksById, edges };
}

/**
 * Returns true if all dependencies for a task are satisfied (completed).
 */
export async function canTaskStart(taskId: string): Promise<boolean> {
  const blocking = await getBlockingTasks(taskId);
  return blocking.length === 0;
}

/**
 * Returns tasks that depend on the given task (would be unblocked
 * when this task completes).
 */
export async function getDownstreamTasks(taskId: string): Promise<Task[]> {
  const db = getDb();

  const deps = await db
    .select({ taskId: taskDependencies.taskId })
    .from(taskDependencies)
    .where(eq(taskDependencies.dependsOnTaskId, taskId));

  if (deps.length === 0) return [];

  const downstreamIds = deps.map((d) => d.taskId);

  return db.select().from(tasks).where(inArray(tasks.id, downstreamIds));
}

/**
 * Add a dependency edge: taskId depends on dependsOnTaskId.
 */
export async function addDependency(taskId: string, dependsOnTaskId: string): Promise<void> {
  const db = getDb();
  await db.insert(taskDependencies).values({
    taskId,
    dependsOnTaskId,
  });
}
