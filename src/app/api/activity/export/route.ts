import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/database.types";
import { getAuthenticatedSupabase } from "@/lib/supabase/server-with-auth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ActivityRow = {
  id: string;
  action: string;
  details: Database["public"]["Tables"]["activity_log"]["Row"]["details"];
  created_at: string | null;
  user_id: string | null;
  workspace_id: string;
  agents: { name: string } | null;
};

type ExportRecord = {
  timestamp: string;
  agent_name: string;
  action: string;
  details: string;
  user: string;
};

import { CATEGORY_ACTIONS, ALL_KNOWN_ACTIONS } from "@/lib/activity-categories";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Flatten a `details` JSON value into a human-readable string.
 * - Simple objects (all values are primitives): "key=value; key=value"
 * - Arrays or nested objects: JSON.stringify
 * - Primitives: coerce to string
 * - null / undefined: empty string
 */
function flattenDetails(details: ActivityRow["details"]): string {
  if (details === null || details === undefined) {
    return "";
  }

  if (typeof details !== "object" || Array.isArray(details)) {
    return JSON.stringify(details);
  }

  // Plain object — check if all values are primitive
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
 * Escape a single CSV field value. Wraps the value in double quotes when it
 * contains a comma, double-quote, or newline. Existing double-quotes are
 * doubled per RFC 4180.
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
  // 2. Authenticate via Better Auth
  // -------------------------------------------------------------------------
  const { user, supabase } = await getAuthenticatedSupabase();

  if (!user || !supabase) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // -------------------------------------------------------------------------
  // 4. Authorize — verify workspace membership
  // -------------------------------------------------------------------------
  const { data: membership, error: membershipError } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("user_id", user.id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (membershipError) {
    console.error("[activity/export] membership check error:", membershipError);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  if (!membership) {
    return NextResponse.json({ error: "Not authorized for this workspace" }, { status: 403 });
  }

  // -------------------------------------------------------------------------
  // 5. Build query
  // -------------------------------------------------------------------------
  let query = supabase
    .from("activity_log")
    .select("id, action, details, created_at, user_id, workspace_id, agents(name)")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(10001); // Fetch one extra row to detect overflow

  // Optional: from date (inclusive)
  if (from) {
    if (isNaN(Date.parse(from))) {
      return NextResponse.json({ error: "Invalid 'from' date" }, { status: 400 });
    }
    query = query.gte("created_at", from);
  }

  // Optional: to date (inclusive — treat as end-of-day by adding one day)
  if (to) {
    const parsed = Date.parse(to);
    if (isNaN(parsed)) {
      return NextResponse.json({ error: "Invalid 'to' date" }, { status: 400 });
    }
    const toDate = new Date(parsed);
    toDate.setDate(toDate.getDate() + 1);
    query = query.lt("created_at", toDate.toISOString());
  }

  // Optional: agent filter
  if (agentId) {
    query = query.eq("agent_id", agentId);
  }

  // Optional: category filter
  if (category) {
    if (category === "audit_trail") {
      // All actions that are NOT in any known category
      query = query.not("action", "in", `(${ALL_KNOWN_ACTIONS.join(",")})`);
    } else if (CATEGORY_ACTIONS[category]) {
      query = query.in("action", CATEGORY_ACTIONS[category]);
    } else {
      return NextResponse.json({ error: `Unknown category: "${category}"` }, { status: 400 });
    }
  }

  // -------------------------------------------------------------------------
  // 6. Execute query and enforce row limit
  // -------------------------------------------------------------------------
  const { data: rows, error: queryError } = await query;

  if (queryError) {
    console.error("[activity/export] query error:", queryError);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  if (!rows || rows.length === 0) {
    // Return an empty export rather than an error
    const emptyRows: ActivityRow[] = [];
    return buildResponse(format, emptyRows);
  }

  if (rows.length > 10000) {
    return NextResponse.json(
      { error: "Too many results. Please narrow your filters." },
      { status: 400 }
    );
  }

  return buildResponse(format, rows as ActivityRow[]);
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
    timestamp: row.created_at ?? "",
    agent_name: row.agents?.name ?? "",
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
