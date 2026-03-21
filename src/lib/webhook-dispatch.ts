import crypto from "node:crypto";
import { getDb } from "@/lib/db/client";
import { agents, webhookDeliveries } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { validateWebhookUrl } from "@/lib/url-validation";

interface DispatchResult {
  success: boolean;
  deliveryId?: string;
  error?: string;
}

/**
 * Dispatches a webhook payload to an agent.
 * Signs with HMAC-SHA256 using the agent's webhook_secret.
 * Records the delivery attempt in webhook_deliveries.
 * Returns immediately after the first attempt (no retries -- retries are handled
 * by a separate worker).
 */
export async function dispatchToAgent(
  agentId: string,
  payload: Record<string, unknown>,
  taskId?: string
): Promise<DispatchResult> {
  const db = getDb();

  // Fetch agent to get webhook_url and webhook_secret
  const agentRows = await db
    .select({
      id: agents.id,
      name: agents.name,
      webhookUrl: agents.webhookUrl,
      webhookSecret: agents.webhookSecret,
    })
    .from(agents)
    .where(eq(agents.id, agentId))
    .limit(1);

  const agent = agentRows[0];
  if (!agent) {
    return { success: false, error: "Agent not found" };
  }

  if (!agent.webhookUrl) {
    return { success: false, error: "Agent has no webhook URL configured" };
  }

  // SSRF protection: validate webhook URL against private/internal ranges
  const urlValidation = validateWebhookUrl(agent.webhookUrl);
  if (!urlValidation.valid) {
    return { success: false, error: `Invalid webhook URL: ${urlValidation.error}` };
  }

  const eventType = (payload.event as string) ?? "event";
  const payloadBody = JSON.stringify(payload);

  // Create webhook_deliveries record (status: pending)
  const deliveryRows = await db
    .insert(webhookDeliveries)
    .values({
      agentId,
      taskId: taskId ?? null,
      eventType,
      payload,
      status: "pending",
      attempts: 0,
    })
    .returning({ id: webhookDeliveries.id });

  const delivery = deliveryRows[0];
  if (!delivery) {
    return { success: false, error: "Failed to create delivery record" };
  }

  const deliveryId = delivery.id;

  // Build headers with optional HMAC signature
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (agent.webhookSecret) {
    const signature = crypto
      .createHmac("sha256", agent.webhookSecret)
      .update(payloadBody)
      .digest("hex");
    headers["X-Doop-Signature"] = signature;
  }

  try {
    const response = await fetch(agent.webhookUrl, {
      method: "POST",
      headers,
      body: payloadBody,
      signal: AbortSignal.timeout(10000),
    });

    const responseBody = await response.text().catch(() => "");

    if (response.ok) {
      await db
        .update(webhookDeliveries)
        .set({
          status: "delivered",
          deliveredAt: new Date(),
          attempts: 1,
          lastAttemptAt: new Date(),
          responseCode: response.status,
          responseBody: responseBody.slice(0, 2000),
        })
        .where(eq(webhookDeliveries.id, deliveryId));

      return { success: true, deliveryId };
    }

    const errMsg = `HTTP ${response.status}: ${response.statusText}`;
    await db
      .update(webhookDeliveries)
      .set({
        status: "failed",
        attempts: 1,
        lastAttemptAt: new Date(),
        responseCode: response.status,
        responseBody: responseBody.slice(0, 2000),
        lastError: errMsg,
      })
      .where(eq(webhookDeliveries.id, deliveryId));

    return { success: false, deliveryId, error: errMsg };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await db
      .update(webhookDeliveries)
      .set({
        status: "failed",
        attempts: 1,
        lastAttemptAt: new Date(),
        lastError: errMsg,
      })
      .where(eq(webhookDeliveries.id, deliveryId));

    return { success: false, deliveryId, error: errMsg };
  }
}
