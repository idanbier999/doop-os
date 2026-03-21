"use server";

import { z } from "zod";
import { requireAuth } from "@/lib/auth/session";
import * as workspacesRepo from "@/lib/db/repos/workspaces";

const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens"),
});

export async function createWorkspace(name: string, slug: string) {
  try {
    const parsed = createWorkspaceSchema.safeParse({ name, slug });
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    let user;
    try {
      user = await requireAuth();
    } catch {
      return { success: false, error: "Not authenticated" };
    }

    const workspace = await workspacesRepo.create(parsed.data.name, parsed.data.slug, user.id);

    return { success: true, workspaceId: workspace.id };
  } catch (err) {
    // Handle unique constraint violation on slug
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("unique") || message.includes("duplicate")) {
      return { success: false, error: "This slug is already taken" };
    }
    return { success: false, error: message };
  }
}
