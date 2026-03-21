import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { activityLog, agents, workspaceMembers } from "@/lib/db/schema";
import { eq, and, gte, lt, inArray, notInArray } from "drizzle-orm";
import { desc } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";

import { CATEGORY_ACTIONS, ALL_KNOWN_ACTIONS } from "@/lib/activity-categories";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ActivityRow = {
  id: string;
  action: string;
  details: unknown;
  created_at: Date | null;
  user_id: string | null;
  workspace_id: string;
  agent_name: string | null;
};

type ExportRecord = {
  timestamp: string;
  agent_name: string;
  action: string;
  details: string;
  user: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Flatten a `details` JSON value into a human-readable string.
 */
function flattenDetails(details: unknown): string {
  if (details === null || details === undefined) {
    return "";
  }

  if (typeof details !== "object" || Array.isArray(details)) {
    return JSON.stringify(details);
  }

  const entries = Object.entries(details as Record<string, unknown>);
  const allPrimitive = entries.every(([, v]) => {
    return v === null || typeof v !== "object";
  });

  if (allPrimitive) {
    return entries.map(([k, v]) => `${k}=${v ?? ""}`).join("; ");
  }

  return JSON.stringify(details);
}

/**
 * Escape a single CSV field value.
 */
function escapeCSVField(value: string): string {
  let safe = value;

  // Neutralize CSV formula injection
  if (/^[=+\-@\t\r]/.test(safe)) {
    safe = "'" + safe;
  }

  if (safe.includes('"') || safe.includes(",") || safe.includes("\n") || safe.includes("\r")) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

/**
 * Build a single CSV row from an ordered array of string values.
 */
function buildCSVRow(fields: string[]): string {
  return fields.map(escapeCSVField).join(",");
}

/**
 * Return today's date as YYYY-MM-DD for use in the filename.
 */
function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<NextResponse> {
  // -------------------------------------------------------------------------
  // 1. Parse and validate query params
  // -------------------------------------------------------------------------
  const { searchParams } = request.nextUrl;

  const format = searchParams.get("format");
  const workspaceId = searchParams.get("workspace_id");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const agentId = searchParams.get("agent_id");
  const category = searchParams.get("category");

  if (!workspaceId) {
    return NextResponse.json(
      { error: "Missing required parameter: workspace_id" },
      { status: 400 }
    );
  }

  if (!format) {
    return NextResponse.json({ error: "Missing required parameter: format" }, { status: 400 });
  }

  if (format !== "csv" && format !== "json") {
    return NextResponse.json(
      { error: 'Invalid format. Must be "csv" or "json".' },
      { status: 400 }
    );
  }

  // -------------------------------------------------------------------------
  // 2. Authenticate via session
  // -------------------------------------------------------------------------
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // -------------------------------------------------------------------------
  // 3. Authorize — verify workspace membership
  // -------------------------------------------------------------------------
  const db = getDb();

  const membershipRows = await db
    .select({ id: workspaceMembers.id })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.userId, user.id), eq(workspaceMembers.workspaceId, workspaceId)))
    .limit(1);

  if (membershipRows.length === 0) {
    return NextResponse.json({ error: "Not authorized for this workspace" }, { status: 403 });
  }

  // -------------------------------------------------------------------------
  // 4. Build conditions
  // -------------------------------------------------------------------------
  const conditions = [eq(activityLog.workspaceId, workspaceId)];

  // Optional: from date (inclusive)
  if (from) {
    if (isNaN(Date.parse(from))) {
      return NextResponse.json({ error: "Invalid 'from' date" }, { status: 400 });
    }
    conditions.push(gte(activityLog.createdAt, new Date(from)));
  }

  // Optional: to date (inclusive — treat as end-of-day by adding one day)
  if (to) {
    const parsed = Date.parse(to);
    if (isNaN(parsed)) {
      return NextResponse.json({ error: "Invalid 'to' date" }, { status: 400 });
    }
    const toDate = new Date(parsed);
    toDate.setDate(toDate.getDate() + 1);
    conditions.push(lt(activityLog.createdAt, toDate));
  }

  // Optional: agent filter
  if (agentId) {
    conditions.push(eq(activityLog.agentId, agentId));
  }

  // Optional: category filter
  if (category) {
    if (category === "audit_trail") {
      // All actions that are NOT in any known category
      conditions.push(notInArray(activityLog.action, ALL_KNOWN_ACTIONS));
    } else if (CATEGORY_ACTIONS[category]) {
      conditions.push(inArray(activityLog.action, CATEGORY_ACTIONS[category]));
    } else {
      return NextResponse.json({ error: `Unknown category: "${category}"` }, { status: 400 });
    }
  }

  // -------------------------------------------------------------------------
  // 5. Execute query with left join for agent name
  // -------------------------------------------------------------------------
  let rows: ActivityRow[];
  try {
    const result = await db
      .select({
        id: activityLog.id,
        action: activityLog.action,
        details: activityLog.details,
        created_at: activityLog.createdAt,
        user_id: activityLog.userId,
        workspace_id: activityLog.workspaceId,
        agent_name: agents.name,
      })
      .from(activityLog)
      .leftJoin(agents, eq(activityLog.agentId, agents.id))
      .where(and(...conditions))
      .orderBy(desc(activityLog.createdAt))
      .limit(10001); // Fetch one extra row to detect overflow

    rows = result;
  } catch (err) {
    console.error("[activity/export] query error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  if (rows.length === 0) {
    return buildResponse(format, []);
  }

  if (rows.length > 10000) {
    return NextResponse.json(
      { error: "Too many results. Please narrow your filters." },
      { status: 400 }
    );
  }

  return buildResponse(format, rows);
}

// ---------------------------------------------------------------------------
// Response builders
// ---------------------------------------------------------------------------

function buildResponse(format: "csv" | "json", rows: ActivityRow[]): NextResponse {
  const date = todayDateString();
  const filename = `activity-export-${date}.${format}`;

  if (format === "json") {
    return buildJSONResponse(rows, filename);
  }

  return buildCSVResponse(rows, filename);
}

function toExportRecord(row: ActivityRow): ExportRecord {
  return {
    timestamp: row.created_at?.toISOString() ?? "",
    agent_name: row.agent_name ?? "",
    action: row.action,
    details: flattenDetails(row.details),
    user: row.user_id ?? "",
  };
}

function buildJSONResponse(rows: ActivityRow[], filename: string): NextResponse {
  const records = rows.map(toExportRecord);
  const body = JSON.stringify(records, null, 2);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

function buildCSVResponse(rows: ActivityRow[], filename: string): NextResponse {
  const CSV_COLUMNS: (keyof ExportRecord)[] = [
    "timestamp",
    "agent_name",
    "action",
    "details",
    "user",
  ];

  const headerRow = buildCSVRow(CSV_COLUMNS);

  const dataRows = rows.map((row) => {
    const record = toExportRecord(row);
    return buildCSVRow(CSV_COLUMNS.map((col) => String(record[col])));
  });

  const csvBody = [headerRow, ...dataRows].join("\r\n");

  return new NextResponse(csvBody, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
