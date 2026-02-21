"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface RegisterAgentStepProps {
  onComplete: () => void;
}

const mcpConfig = `{
  "mcpServers": {
    "tarely": {
      "command": "node",
      "args": ["path/to/tarely-mcp/build/index.js"],
      "env": {
        "TARELY_API_KEY": "your_agent_api_key"
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
        <h2 className="text-xl font-semibold text-mac-black">
          Connect your first agent
        </h2>
        <p className="mt-1 text-sm text-mac-gray">
          Add this MCP configuration to your agent&apos;s client (Claude
          Desktop, Cursor, etc.) to connect it to Tarely.
        </p>
      </div>

      <div className="relative">
        <pre className="rounded-lg border border-mac-border bg-mac-white p-4 text-sm text-mac-dark-gray font-mono overflow-x-auto">
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

      <p className="text-sm text-mac-dark-gray">
        Replace <code className="text-mac-gray">your_agent_api_key</code> with
        the API key you receive after registering an agent via the MCP{" "}
        <code className="text-mac-gray">register_agent</code> tool.
      </p>

      <div className="flex gap-2">
        <Button onClick={onComplete}>Continue</Button>
      </div>
    </div>
  );
}
