"use client";

import { useEffect, useState } from "react";
import { useWorkspace } from "@/contexts/workspace-context";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  testSlackWebhook,
  getNotificationSettings,
  saveNotificationSettings,
} from "@/app/dashboard/settings/actions";

const SEVERITIES = ["low", "medium", "high", "critical"] as const;

export function NotificationSettings() {
  const { workspaceId, userRole } = useWorkspace();
  const canEdit = userRole === "owner" || userRole === "admin";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const [slackEnabled, setSlackEnabled] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [showWebhookUrl, setShowWebhookUrl] = useState(false);
  const [selectedSeverities, setSelectedSeverities] = useState<Set<string>>(
    new Set(["high", "critical"])
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await getNotificationSettings(workspaceId);
      if (cancelled) return;

      if (result.settings) {
        setSlackEnabled(result.settings.slackEnabled ?? false);
        setWebhookUrl(result.settings.slackWebhookUrl || "");
        setSelectedSeverities(
          new Set(result.settings.notifyOnProblemSeverity || ["high", "critical"])
        );
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  // Auto-clear message after 3 seconds
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [message]);

  function toggleSeverity(severity: string) {
    setSelectedSeverities((prev) => {
      const next = new Set(prev);
      if (next.has(severity)) {
        next.delete(severity);
      } else {
        next.add(severity);
      }
      return next;
    });
  }

  async function handleTest() {
    if (!canEdit) return;

    setTesting(true);
    setMessage(null);

    const result = await testSlackWebhook(workspaceId);

    if (result.success) {
      setMessage({ text: "Test notification sent! Check your Slack channel.", type: "success" });
    } else {
      setMessage({ text: result.error ?? "Test failed", type: "error" });
    }

    setTesting(false);
  }

  async function handleSave() {
    if (!canEdit) return;

    setSaving(true);
    setMessage(null);

    const result = await saveNotificationSettings(workspaceId, {
      slackEnabled,
      slackWebhookUrl: webhookUrl.trim() || null,
      notifyOnProblemSeverity: Array.from(selectedSeverities),
    });

    setSaving(false);

    if (result.error) {
      setMessage({ text: result.error, type: "error" });
    } else {
      setMessage({ text: "Notification settings saved.", type: "success" });
    }
  }

  if (!canEdit) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-mac-dark-gray font-[family-name:var(--font-pixel)]">
            Contact your workspace admin to configure notifications.
          </p>
        </CardBody>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <Card title="Slack Notifications">
      <div className="space-y-5 max-w-lg">
        {/* Slack enabled toggle */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={slackEnabled}
              onChange={(e) => setSlackEnabled(e.target.checked)}
              className="h-4 w-4 rounded-[2px] border-mac-black accent-mac-black cursor-pointer"
            />
            <span className="text-sm font-bold text-mac-black font-[family-name:var(--font-pixel)]">
              {slackEnabled ? "Enabled" : "Disabled"}
            </span>
          </label>
        </div>

        {/* Webhook URL */}
        <div className="w-full">
          <label
            htmlFor="webhook-url"
            className="block text-sm font-bold text-mac-black mb-1 font-[family-name:var(--font-pixel)]"
          >
            Webhook URL
          </label>
          <div className="flex items-center gap-2">
            <input
              id="webhook-url"
              type={showWebhookUrl ? "text" : "password"}
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://hooks.slack.com/services/..."
              disabled={!slackEnabled}
              className={`block w-full rounded-[2px] border border-mac-black bg-mac-white px-2 py-1.5 text-sm text-mac-black placeholder-mac-gray shadow-[inset_1px_1px_0px_#555] focus:outline-none focus:ring-2 focus:ring-mac-black font-[family-name:var(--font-pixel)] disabled:bg-mac-light-gray disabled:text-mac-gray ${
                !showWebhookUrl && webhookUrl ? "tracking-wider" : ""
              }`}
            />
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={() => setShowWebhookUrl(!showWebhookUrl)}
              disabled={!slackEnabled}
            >
              {showWebhookUrl ? "Hide" : "Show"}
            </Button>
          </div>
        </div>

        {/* Severity checkboxes */}
        <div>
          <span className="block text-sm font-bold text-mac-black mb-2 font-[family-name:var(--font-pixel)]">
            Notify on severity
          </span>
          <div className="flex flex-wrap gap-4">
            {SEVERITIES.map((severity) => (
              <label key={severity} className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={selectedSeverities.has(severity)}
                  onChange={() => toggleSeverity(severity)}
                  disabled={!slackEnabled}
                  className="h-4 w-4 rounded-[2px] border-mac-black accent-mac-black cursor-pointer"
                />
                <span className="text-sm text-mac-black font-[family-name:var(--font-pixel)] capitalize">
                  {severity}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Save button and message */}
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
          <Button
            variant="secondary"
            onClick={handleTest}
            disabled={!slackEnabled || !webhookUrl.trim() || testing || saving}
          >
            {testing ? "Testing..." : "Test Webhook"}
          </Button>
          {message && (
            <span
              className={`text-sm font-[family-name:var(--font-pixel)] ${
                message.type === "error" ? "text-[#CC0000]" : "text-mac-black"
              }`}
            >
              {message.text}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
