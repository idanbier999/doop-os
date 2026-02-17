"use client";

import { useState } from "react";
import type { Json } from "@/lib/database.types";

function JsonNode({ data, depth = 0 }: { data: Json; depth?: number }) {
  const [collapsed, setCollapsed] = useState(depth > 1);

  if (data === null || data === undefined) {
    return <span className="text-mac-gray">null</span>;
  }

  if (typeof data === "string") {
    return <span className="text-[#007700]">&quot;{data}&quot;</span>;
  }

  if (typeof data === "number") {
    return <span className="text-[#CC6600]">{data}</span>;
  }

  if (typeof data === "boolean") {
    return (
      <span className="text-[#CC0000]">{data ? "true" : "false"}</span>
    );
  }

  if (Array.isArray(data)) {
    if (data.length === 0) return <span className="text-mac-gray">[]</span>;
    return (
      <span>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-mac-gray hover:text-mac-black"
        >
          {collapsed ? "[...]" : "["}
        </button>
        {!collapsed && (
          <>
            <div className="ml-4">
              {data.map((item, i) => (
                <div key={i}>
                  <JsonNode data={item} depth={depth + 1} />
                  {i < data.length - 1 && (
                    <span className="text-mac-light-gray">,</span>
                  )}
                </div>
              ))}
            </div>
            <span className="text-mac-gray">]</span>
          </>
        )}
      </span>
    );
  }

  if (typeof data === "object") {
    const entries = Object.entries(data);
    if (entries.length === 0)
      return <span className="text-mac-gray">{"{}"}</span>;
    return (
      <span>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-mac-gray hover:text-mac-black"
        >
          {collapsed ? "{...}" : "{"}
        </button>
        {!collapsed && (
          <>
            <div className="ml-4">
              {entries.map(([key, value], i) => (
                <div key={key}>
                  <span className="text-[#0055CC]">&quot;{key}&quot;</span>
                  <span className="text-mac-dark-gray">: </span>
                  <JsonNode data={value as Json} depth={depth + 1} />
                  {i < entries.length - 1 && (
                    <span className="text-mac-light-gray">,</span>
                  )}
                </div>
              ))}
            </div>
            <span className="text-mac-gray">{"}"}</span>
          </>
        )}
      </span>
    );
  }

  return <span className="text-mac-gray">{String(data)}</span>;
}

interface TaskResultViewerProps {
  result: Json | null;
}

export function TaskResultViewer({ result }: TaskResultViewerProps) {
  return (
    <div className="p-4 font-[family-name:var(--font-pixel)]">
      {result === null || result === undefined ? (
        <p className="text-sm text-mac-gray text-center py-4">No results yet</p>
      ) : (
        <pre className="overflow-x-auto text-xs font-mono leading-relaxed text-mac-black">
          <JsonNode data={result} />
        </pre>
      )}
    </div>
  );
}
