import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateWebhookUrl } from "@/lib/url-validation";
import type { Json } from "@/lib/database.types";

interface DispatchResult {
  success: boolean;
  deliveryId?: string;
  error?: string;
}

/**
 * Dispatches a webhook payload to an agent.
 * Signs with HMAC-SHA256 using the agent's webhook_secret.
 * Records the delivery attempt in webhook_deliveries.
 * Returns immediately after the first attempt (no retries — retries are handled
 * by the webhook delivery Edge Function or a separate worker).
 */
export async function dispatchToAgent(
  agentId: string,
  payload: Record<string, unknown>,
  taskId?: string
): Promise<DispatchResult> {
  const supabase = createAdminClient();

  // Fetch agent to get webhook_url and webhook_secret
  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select("id, name, webhook_url, webhook_secret")
    .eq("id", agentId)
    .single();

  if (agentError || !agent) {
    return { success: false, error: agentError?.message ?? "Agent not found" };
  }

  if (!agent.webhook_url) {
    return { success: false, error: "Agent has no webhook URL configured" };
  }

  // SSRF protection: validate webhook URL against private/internal ranges
  const urlValidation = validateWebhookUrl(agent.webhook_url);
  if (!urlValidation.valid) {
    return { success: false, error: `Invalid webhook URL: ${urlValidation.error}` };
  }

  const eventType = (payload.event as string) ?? "event";
  const payloadBody = JSON.stringify(payload);

  // Create webhook_deliveries record (status: pending)
  const { data: delivery, error: deliveryError } = await supabase
    .from("webhook_deliveries")
    .insert({
      agent_id: agentId,
      task_id: taskId ?? null,
      event_type: eventType,
      payload: payload as unknown as Json,
      status: "pending",
      attempts: 0,
    })
    .select("id")
    .single();

  if (deliveryError || !delivery) {
    return { success: false, error: deliveryError?.message ?? "Failed to create delivery record" };
  }

  const deliveryId = delivery.id;

  // Build headers with optional HMAC signature
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (agent.webhook_secret) {
    const signature = crypto
      .createHmac("sha256", agent.webhook_secret)
      .update(payloadBody)
      .digest("hex");
    headers["X-Doop-Signature"] = signature;
  }

  try {
    const response = await fetch(agent.webhook_url, {
      method: "POST",
      headers,
      body: payloadBody,
      signal: AbortSignal.timeout(10000),
    });

    const responseBody = await response.text().catch(() => "");

    if (response.ok) {
      await supabase
        .from("webhook_deliveries")
        .update({
          status: "delivered",
          delivered_at: new Date().toISOString(),
          attempts: 1,
          last_attempt_at: new Date().toISOString(),
          response_code: response.status,
          response_body: responseBody.slice(0, 2000),
        })
        .eq("id", deliveryId);

      return { success: true, deliveryId };
    }

    const errMsg = `HTTP ${response.status}: ${response.statusText}`;
    await supabase
      .from("webhook_deliveries")
      .update({
        status: "failed",
        attempts: 1,
        last_attempt_at: new Date().toISOString(),
        response_code: response.status,
        response_body: responseBody.slice(0, 2000),
        last_error: errMsg,
      })
      .eq("id", deliveryId);

    return { success: false, deliveryId, error: errMsg };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await supabase
      .from("webhook_deliveries")
      .update({
        status: "failed",
        attempts: 1,
        last_attempt_at: new Date().toISOString(),
        last_error: errMsg,
      })
      .eq("id", deliveryId);

    return { success: false, deliveryId, error: errMsg };
  }
}
