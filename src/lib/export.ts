// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface ActivityExportEntry {
  timestamp: string; // ISO 8601 from created_at
  agent_name: string; // agents.name or "System" when null
  action: string; // activity_log.action
  details: string; // flattened details JSON
  user: string; // user_id or "" when null
}

// ---------------------------------------------------------------------------
// Raw row shape (activity_log joined with agents)
// ---------------------------------------------------------------------------

type ActivityEntry = {
  created_at?: Date | string | null;
  createdAt?: Date | string | null;
  action: string;
  details: unknown;
  user_id?: string | null;
  userId?: string | null;
  agents?: { name: string } | null;
  agentName?: string | null;
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/**
 * Flatten a JSON value into a human-readable string suitable for a CSV cell.
 */
function flattenDetails(details: unknown): string {
  if (details === null || details === undefined) {
    return "";
  }

  // Primitive values
  if (typeof details === "string" || typeof details === "number" || typeof details === "boolean") {
    return String(details);
  }

  // Arrays
  if (Array.isArray(details)) {
    return JSON.stringify(details);
  }

  // Plain object
  if (typeof details === "object") {
    const pairs: string[] = [];

    for (const [key, value] of Object.entries(details as Record<string, unknown>)) {
      if (value === null || value === undefined) {
        pairs.push(`${key}=`);
      } else if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        pairs.push(`${key}=${value}`);
      } else {
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
 */
function escapeCsvValue(value: string): string {
  let safe = value;

  // Neutralize formula injection
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

  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// ---------------------------------------------------------------------------
// Public: toExportEntries
// ---------------------------------------------------------------------------

/**
 * Map raw activity_log rows (optionally joined with agents) into the
 * flat ActivityExportEntry shape used by both export functions.
 */
export function toExportEntries(entries: ActivityEntry[]): ActivityExportEntry[] {
  return entries.map((entry) => {
    let timestamp: string;
    const dateValue = entry.created_at ?? entry.createdAt;
    if (dateValue) {
      const d = new Date(dateValue);
      timestamp = isNaN(d.getTime()) ? String(dateValue) : d.toISOString();
    } else {
      timestamp = "";
    }

    const agent_name = entry.agents?.name ?? entry.agentName ?? "System";

    const details = flattenDetails(entry.details);

    const user = entry.user_id ?? entry.userId ?? "";

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

export function exportToJSON(data: ActivityExportEntry[], filename: string): void {
  const json = JSON.stringify(data, null, 2);
  triggerDownload(json, filename, "application/json");
}
