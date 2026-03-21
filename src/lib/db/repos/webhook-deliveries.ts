import { getDb } from "@/lib/db/client";
import { webhookDeliveries } from "@/lib/db/schema";
import type { WebhookDelivery, NewWebhookDelivery } from "@/lib/db/types";
import { eq } from "drizzle-orm";

/**
 * Create a new webhook delivery record. Returns the inserted row.
 */
export async function create(data: NewWebhookDelivery): Promise<WebhookDelivery> {
  const db = getDb();
  const rows = await db.insert(webhookDeliveries).values(data).returning();
  return rows[0];
}

/**
 * Update the status of a webhook delivery.
 */
export async function updateStatus(
  id: string,
  update: {
    status: string;
    responseCode?: number;
    responseBody?: string;
    lastError?: string;
    attempts?: number;
    deliveredAt?: Date;
  }
): Promise<WebhookDelivery | undefined> {
  const db = getDb();

  const set: Record<string, unknown> = {
    status: update.status,
    lastAttemptAt: new Date(),
  };
  if (update.responseCode !== undefined) set.responseCode = update.responseCode;
  if (update.responseBody !== undefined) set.responseBody = update.responseBody;
  if (update.lastError !== undefined) set.lastError = update.lastError;
  if (update.attempts !== undefined) set.attempts = update.attempts;
  if (update.deliveredAt !== undefined) set.deliveredAt = update.deliveredAt;

  const rows = await db
    .update(webhookDeliveries)
    .set(set)
    .where(eq(webhookDeliveries.id, id))
    .returning();

  return rows[0];
}
