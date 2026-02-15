"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface RegisterAgentStepProps {
  onComplete: () => void;
}

const mcpConfig = `{
  "mcpServers": {
    "mangistew": {
      "command": "node",
      "args": ["path/to/mangistew-mcp/build/index.js"],
      "env": {
        "MANGISTEW_API_KEY": "your_agent_api_key"
      }
    }
  }
}`;

export function RegisterAgentStep({ onComplete }: RegisterAgentStepProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(mcpConfig);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may fail in some environments
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-100">
          Connect your first agent
        </h2>
        <p className="mt-1 text-sm text-gray-400">
          Add this MCP configuration to your agent&apos;s client (Claude
          Desktop, Cursor, etc.) to connect it to Mangistew.
        </p>
      </div>

      <div className="relative">
        <pre className="rounded-lg border border-gray-800 bg-gray-900 p-4 text-sm text-gray-300 font-mono overflow-x-auto">
          {mcpConfig}
        </pre>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleCopy}
          className="absolute top-2 right-2"
        >
          {copied ? "Copied!" : "Copy"}
        </Button>
      </div>

      <p className="text-sm text-gray-500">
        Replace <code className="text-gray-400">your_agent_api_key</code> with
        the API key you receive after registering an agent via the MCP{" "}
        <code className="text-gray-400">register_agent</code> tool.
      </p>

      <div className="flex gap-2">
        <Button onClick={onComplete}>Continue</Button>
      </div>
    </div>
  );
}
