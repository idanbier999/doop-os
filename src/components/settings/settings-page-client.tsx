"use client";

import { useState } from "react";
import { WorkspaceSettings } from "./workspace-settings";
import { TeamMembers } from "./team-members";
import { AgentsSettings } from "./agents-settings";

interface SettingsPageClientProps {
  workspace: { id: string; name: string; slug: string };
}

const tabs = [
  { key: "workspace", label: "Workspace" },
  { key: "team", label: "Team" },
  { key: "agents", label: "Agents" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

export function SettingsPageClient({ workspace }: SettingsPageClientProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("workspace");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-100">Settings</h1>

      <div className="border-b border-gray-800">
        <nav className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "border-b-2 border-blue-500 text-blue-400"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === "workspace" && (
        <WorkspaceSettings workspace={workspace} />
      )}
      {activeTab === "team" && <TeamMembers />}
      {activeTab === "agents" && <AgentsSettings />}
    </div>
  );
}
