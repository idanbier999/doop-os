"use client";

import { useState } from "react";
import { WorkspaceSettings } from "./workspace-settings";
import { TeamMembers } from "./team-members";
import { AgentsSettings } from "./agents-settings";
import { NotificationSettings } from "./notification-settings";

interface SettingsPageClientProps {
  workspace: { id: string; name: string; slug: string };
}

const tabs = [
  { key: "workspace", label: "Workspace" },
  { key: "team", label: "Team" },
  { key: "agents", label: "Agents" },
  { key: "notifications", label: "Notifications" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

export function SettingsPageClient({ workspace }: SettingsPageClientProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("workspace");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-mac-black font-[family-name:var(--font-pixel)]">
        Settings
      </h1>

      <div className="border-b border-mac-dark-gray">
        <nav className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 text-sm font-bold font-[family-name:var(--font-pixel)] transition-colors ${
                activeTab === tab.key
                  ? "border-b-2 border-mac-black text-mac-black"
                  : "text-mac-dark-gray hover:text-mac-black"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === "workspace" && <WorkspaceSettings workspace={workspace} />}
      {activeTab === "team" && <TeamMembers />}
      {activeTab === "agents" && <AgentsSettings />}
      {activeTab === "notifications" && <NotificationSettings />}
    </div>
  );
}
