"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createAgent } from "@/app/dashboard/agents/actions";

interface RegisterAgentStepProps {
  workspaceId: string;
  onComplete: () => void;
}

export function RegisterAgentStep({ workspaceId, onComplete }: RegisterAgentStepProps) {
  const [step, setStep] = useState<"form" | "result">("form");
  const [agentName, setAgentName] = useState("");
  const [platform, setPlatform] = useState<"openclaw" | "mcp">("openclaw");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdAgent, setCreatedAgent] = useState<{
    agentId: string;
    apiKey: string;
    apiKeyLast4: string;
    name: string;
    platform: string | null;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleCreateAgent() {
    if (!agentName.trim() || !workspaceId) return;
    setCreating(true);
    setCreateError(null);
    try {
      const result = await createAgent(workspaceId, agentName.trim(), platform);
      if (result.success) {
        setCreatedAgent({
          agentId: result.agentId!,
          apiKey: result.apiKey!,
          apiKeyLast4: result.apiKeyLast4!,
          name: result.name!,
          platform: result.platform ?? null,
        });
        setStep("result");
      } else {
        setCreateError(result.error ?? "Failed to create agent");
      }
    } catch {
      setCreateError("An unexpected error occurred");
    } finally {
      setCreating(false);
    }
  }

  function getConfigSnippet(): string {
    if (!createdAgent) return "";
    if (platform === "openclaw") {
      const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
      return JSON.stringify(
        {
          TARELY_API_BASE_URL: baseUrl,
          TARELY_AGENT_API_KEY: createdAgent.apiKey,
          TARELY_AGENT_ID: createdAgent.agentId,
        },
        null,
        2
      );
    }
    return JSON.stringify(
      {
        mcpServers: {
          tarely: {
            command: "node",
            args: ["path/to/tarely-mcp/build/index.js"],
            env: {
              TARELY_API_KEY: createdAgent.apiKey,
            },
          },
        },
      },
      null,
      2
    );
  }

  async function handleCopyConfig() {
    try {
      await navigator.clipboard.writeText(getConfigSnippet());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may fail in some environments
    }
  }

  if (step === "form") {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-mac-black">
            Register your first agent
          </h2>
          <p className="mt-1 text-sm text-mac-gray">
            Give your agent a name and select its platform to connect it to Tarely.
          </p>
        </div>

        <div>
          <label htmlFor="agent-name" className="block text-sm font-bold text-mac-black mb-1 font-[family-name:var(--font-pixel)]">
            Agent Name
          </label>
          <input
            id="agent-name"
            type="text"
            value={agentName}
            onChange={e => setAgentName(e.target.value)}
            placeholder="e.g. my-research-agent"
            className="w-full rounded-[2px] border border-mac-black bg-mac-white px-3 py-1.5 text-sm text-mac-black font-[family-name:var(--font-pixel)] shadow-[inset_1px_1px_0px_#555] focus:outline-none focus:ring-2 focus:ring-mac-black"
            onKeyDown={e => {
              if (e.key === "Enter" && agentName.trim() && !creating) {
                handleCreateAgent();
              }
            }}
          />
        </div>

        <div>
          <label htmlFor="agent-platform" className="block text-sm font-bold text-mac-black mb-1 font-[family-name:var(--font-pixel)]">
            Platform
          </label>
          <select
            id="agent-platform"
            value={platform}
            onChange={e => setPlatform(e.target.value as "openclaw" | "mcp")}
            className="w-full rounded-[2px] border border-mac-black bg-mac-white px-2 py-1.5 text-sm text-mac-black font-[family-name:var(--font-pixel)] shadow-[inset_1px_1px_0px_#555] focus:outline-none focus:ring-2 focus:ring-mac-black"
          >
            <option value="openclaw">OpenClaw</option>
            <option value="mcp">MCP (Claude/Cursor)</option>
          </select>
        </div>

        {createError && (
          <p className="text-sm text-severity-critical">{createError}</p>
        )}

        <div className="flex justify-end">
          <Button
            variant="primary"
            disabled={creating || !agentName.trim()}
            onClick={handleCreateAgent}
          >
            {creating ? "Creating..." : "Create Agent"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-mac-black">
          Agent registered
        </h2>
        <p className="mt-1 text-sm text-mac-gray">
          Save the API key and configuration below — the key is shown only once.
        </p>
      </div>

      <div className="space-y-1">
        <p className="text-sm text-mac-dark-gray">
          <span className="font-bold text-mac-black">Agent:</span> {createdAgent?.name}
        </p>
        <p className="text-sm text-mac-dark-gray">
          <span className="font-bold text-mac-black">ID:</span>{" "}
          <code className="text-xs font-mono bg-mac-light-gray px-1 py-0.5 rounded">{createdAgent?.agentId}</code>
        </p>
      </div>

      <div className="rounded-lg border border-amber-400 bg-amber-50 px-3 py-2">
        <p className="text-sm font-bold text-amber-800 font-[family-name:var(--font-pixel)]">
          API Key (shown once)
        </p>
        <p className="mt-1 font-mono text-sm text-amber-900 break-all select-all">
          {createdAgent?.apiKey}
        </p>
        <p className="mt-1 text-xs text-amber-700">
          This key is shown once. Store it safely.
        </p>
      </div>

      <div className="relative">
        <pre className="rounded-lg bg-zinc-900 text-zinc-100 p-4 text-sm font-mono overflow-x-auto">
          {getConfigSnippet()}
        </pre>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleCopyConfig}
          className="absolute top-2 right-2"
        >
          {copied ? "Copied!" : "Copy"}
        </Button>
      </div>

      <div className="flex justify-end">
        <Button onClick={onComplete}>
          Continue to Dashboard
        </Button>
      </div>
    </div>
  );
}
