"use client";

import { useState } from "react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import type { Json } from "@/lib/database.types";

function JsonNode({ data, depth = 0 }: { data: Json; depth?: number }) {
  const [collapsed, setCollapsed] = useState(depth > 1);

  if (data === null || data === undefined) {
    return <span className="text-gray-500">null</span>;
  }

  if (typeof data === "string") {
    return <span className="text-health-healthy">&quot;{data}&quot;</span>;
  }

  if (typeof data === "number") {
    return <span className="text-severity-medium">{data}</span>;
  }

  if (typeof data === "boolean") {
    return (
      <span className="text-severity-critical">{data ? "true" : "false"}</span>
    );
  }

  if (Array.isArray(data)) {
    if (data.length === 0) return <span className="text-gray-400">[]</span>;
    return (
      <span>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-gray-400 hover:text-gray-200"
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
                    <span className="text-gray-600">,</span>
                  )}
                </div>
              ))}
            </div>
            <span className="text-gray-400">]</span>
          </>
        )}
      </span>
    );
  }

  if (typeof data === "object") {
    const entries = Object.entries(data);
    if (entries.length === 0)
      return <span className="text-gray-400">{"{}"}</span>;
    return (
      <span>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-gray-400 hover:text-gray-200"
        >
          {collapsed ? "{...}" : "{"}
        </button>
        {!collapsed && (
          <>
            <div className="ml-4">
              {entries.map(([key, value], i) => (
                <div key={key}>
                  <span className="text-severity-low">&quot;{key}&quot;</span>
                  <span className="text-gray-500">: </span>
                  <JsonNode data={value as Json} depth={depth + 1} />
                  {i < entries.length - 1 && (
                    <span className="text-gray-600">,</span>
                  )}
                </div>
              ))}
            </div>
            <span className="text-gray-400">{"}"}</span>
          </>
        )}
      </span>
    );
  }

  return <span className="text-gray-400">{String(data)}</span>;
}

interface MetadataViewerProps {
  metadata: Json | null;
}

export function MetadataViewer({ metadata }: MetadataViewerProps) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold text-gray-200">Metadata</h2>
      </CardHeader>
      <CardBody>
        {metadata === null || metadata === undefined ? (
          <p className="text-sm text-gray-500">No metadata</p>
        ) : (
          <pre className="overflow-x-auto text-xs font-mono leading-relaxed">
            <JsonNode data={metadata} />
          </pre>
        )}
      </CardBody>
    </Card>
  );
}
