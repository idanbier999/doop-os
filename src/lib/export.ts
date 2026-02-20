import type { Tables } from "@/lib/database.types";
import type { Json } from "@/lib/database.types";

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface ActivityExportEntry {
  timestamp: string;   // ISO 8601 from created_at
  agent_name: string;  // agents.name or "System" when null
  action: string;      // activity_log.action
  details: string;     // flattened details JSON
  user: string;        // user_id or "" when null
}

// ---------------------------------------------------------------------------
// Raw Supabase row shape (activity_log joined with agents)
// ---------------------------------------------------------------------------

type ActivityEntry = Tables<"activity_log"> & {
  agents?: { name: string } | null;
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Flatten a Json value into a human-readable string suitable for a CSV cell.
 *
 * Rules:
 *  - null / undefined  → ""
 *  - primitive         → String(value)
 *  - plain object      → "key=value" pairs joined by "; "
 *                        If a value is itself non-primitive, JSON.stringify it.
 *  - array / complex   → JSON.stringify
 */
function flattenDetails(details: Json | null | undefined): string {
  if (details === null || details === undefined) {
    return "";
  }

  // Primitive values
  if (
    typeof details === "string" ||
    typeof details === "number" ||
    typeof details === "boolean"
  ) {
    return String(details);
  }

  // Arrays → JSON
  if (Array.isArray(details)) {
    return JSON.stringify(details);
  }

  // Plain object → dot-notation key=value pairs
  if (typeof details === "object") {
    const pairs: string[] = [];

    for (const [key, value] of Object.entries(details)) {
      if (value === null || value === undefined) {
        pairs.push(`${key}=`);
      } else if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        pairs.push(`${key}=${value}`);
      } else {
        // Nested object or array — stringify the value inline
        pairs.push(`${key}=${JSON.stringify(value)}`);
      }
    }

    return pairs.join("; ");
  }

  // Fallback
  return JSON.stringify(details);
}

/**
 * Escape a single value for safe inclusion in a CSV cell.
 *
 * RFC 4180: wrap in double-quotes if the value contains a comma, double-quote,
 * or newline. Double up any internal double-quotes.
 *
 * Also neutralizes CSV formula injection by prefixing values that start with
 * dangerous characters (=, +, -, @, \t, \r) with a single quote.
 */
function escapeCsvValue(value: string): string {
  let safe = value;

  // Neutralize formula injection — prefix with single-quote
  if (/^[=+\-@\t\r]/.test(safe)) {
    safe = "'" + safe;
  }

  const needsQuoting = /[",\n\r]/.test(safe);
  if (!needsQuoting) {
    return safe;
  }
  const escaped = safe.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Trigger a browser download for the given content blob.
 */
function triggerDownload(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";

  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  // Release the object URL after a short delay to let the download start
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// ---------------------------------------------------------------------------
// Public: toExportEntries
// ---------------------------------------------------------------------------

/**
 * Map raw Supabase activity_log rows (optionally joined with agents) into the
 * flat ActivityExportEntry shape used by both export functions.
 */
export function toExportEntries(entries: ActivityEntry[]): ActivityExportEntry[] {
  return entries.map((entry) => {
    let timestamp: string;
    if (entry.created_at) {
      const d = new Date(entry.created_at);
      timestamp = isNaN(d.getTime()) ? entry.created_at : d.toISOString();
    } else {
      timestamp = "";
    }

    const agent_name = entry.agents?.name ?? "System";

    const details = flattenDetails(entry.details);

    const user = entry.user_id ?? "";

    return {
      timestamp,
      agent_name,
      action: entry.action,
      details,
      user,
    };
  });
}

// ---------------------------------------------------------------------------
// Public: exportToCSV
// ---------------------------------------------------------------------------

const CSV_COLUMNS: Array<keyof ActivityExportEntry> = [
  "timestamp",
  "agent_name",
  "action",
  "details",
  "user",
];

/**
 * Serialize an array of ActivityExportEntry records to CSV and trigger a
 * browser file download.
 *
 * @param data     - The records to export.
 * @param filename - The suggested filename (e.g. "activity-2026-02-20.csv").
 */
export function exportToCSV(data: ActivityExportEntry[], filename: string): void {
  const headerRow = CSV_COLUMNS.join(",");

  const dataRows = data.map((entry) => {
    return CSV_COLUMNS.map((col) => escapeCsvValue(entry[col])).join(",");
  });

  const csv = "\uFEFF" + [headerRow, ...dataRows].join("\r\n");

  triggerDownload(csv, filename, "text/csv;charset=utf-8;");
}

// ---------------------------------------------------------------------------
// Public: exportToJSON
// ---------------------------------------------------------------------------

/**
 * Serialize an array of ActivityExportEntry records to pretty-printed JSON and
 * trigger a browser file download.
 *
 * @param data     - The records to export.
 * @param filename - The suggested filename (e.g. "activity-2026-02-20.json").
 */
export function exportToJSON(data: ActivityExportEntry[], filename: string): void {
  const json = JSON.stringify(data, null, 2);
  triggerDownload(json, filename, "application/json");
}
