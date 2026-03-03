import { NextRequest, NextResponse } from "next/server";
import { authenticateAgent } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkAndRecordRequest } from "@/lib/rate-limiter";

interface Quota {
  maxPerMinute: number;
  maxPerHour: number;
}

interface CachedQuota {
  quota: Quota;
  expiresAt: number;
}

const DEFAULT_QUOTA: Quota = {
  maxPerMinute: 60,
  maxPerHour: 1000,
};

const CACHE_TTL_MS = 60_000; // 60 seconds
const quotaCache = new Map<string, CachedQuota>();

/** Reset the in-memory quota cache — exported for testing. */
export function resetQuotaCache(): void {
  quotaCache.clear();
}

async function getQuota(
  agentId: string,
  workspaceId: string
): Promise<Quota> {
  const cacheKey = `${agentId}:${workspaceId}`;
  const cached = quotaCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.quota;
  }

  try {
    const supabase = createAdminClient();

    // Try agent-specific quota first
    const { data: agentQuota } = await supabase
      .from("agent_quotas")
      .select("max_requests_per_minute, max_requests_per_hour")
      .eq("agent_id", agentId)
      .eq("workspace_id", workspaceId)
      .single();

    if (agentQuota) {
      const quota: Quota = {
        maxPerMinute: agentQuota.max_requests_per_minute,
        maxPerHour: agentQuota.max_requests_per_hour,
      };
      quotaCache.set(cacheKey, { quota, expiresAt: Date.now() + CACHE_TTL_MS });
      return quota;
    }

    // Try workspace default (agent_id IS NULL)
    const { data: workspaceQuota } = await supabase
      .from("agent_quotas")
      .select("max_requests_per_minute, max_requests_per_hour")
      .is("agent_id", null)
      .eq("workspace_id", workspaceId)
      .single();

    if (workspaceQuota) {
      const quota: Quota = {
        maxPerMinute: workspaceQuota.max_requests_per_minute,
        maxPerHour: workspaceQuota.max_requests_per_hour,
      };
      quotaCache.set(cacheKey, { quota, expiresAt: Date.now() + CACHE_TTL_MS });
      return quota;
    }
  } catch {
    // Fail open — use defaults
  }

  // Hardcoded default
  quotaCache.set(cacheKey, {
    quota: DEFAULT_QUOTA,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
  return DEFAULT_QUOTA;
}

type RouteHandler = (
  request: NextRequest,
  context?: unknown
) => Promise<NextResponse>;

/**
 * Higher-order function that wraps an API route handler with rate limiting.
 * Calls `authenticateAgent` to get the agent context, looks up quota,
 * then checks both minute and hour windows.
 *
 * If auth fails, passes through to let the inner handler deal with 401.
 * If rate limit is exceeded, returns 429 with Retry-After header.
 */
export function withRateLimit(handler: RouteHandler): RouteHandler {
  return async (request: NextRequest, context?: unknown) => {
    const agent = await authenticateAgent(request);

    // If auth fails, pass through — let the handler return 401 itself
    if (!agent) {
      return handler(request, context);
    }

    const quota = await getQuota(agent.id, agent.workspace_id);

    // Check minute window
    const minuteResult = await checkAndRecordRequest(
      agent.id,
      "minute",
      quota.maxPerMinute
    );

    if (!minuteResult.allowed) {
      const retryAfterSeconds = Math.ceil(
        (minuteResult.retryAfterMs ?? 60_000) / 1000
      );
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfterSeconds),
            "X-RateLimit-Limit": String(quota.maxPerMinute),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    // Check hour window
    const hourResult = await checkAndRecordRequest(
      agent.id,
      "hour",
      quota.maxPerHour
    );

    if (!hourResult.allowed) {
      const retryAfterSeconds = Math.ceil(
        (hourResult.retryAfterMs ?? 3_600_000) / 1000
      );
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfterSeconds),
            "X-RateLimit-Limit": String(quota.maxPerHour),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    // Call the actual handler
    const response = await handler(request, context);

    // Set rate limit headers on successful responses
    response.headers.set("X-RateLimit-Limit", String(quota.maxPerMinute));
    response.headers.set(
      "X-RateLimit-Remaining",
      String(Math.max(0, quota.maxPerMinute - minuteResult.currentCount))
    );

    return response;
  };
}
