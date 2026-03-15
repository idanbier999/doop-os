"use client";

import { useEffect, useState } from "react";
import { useSupabase } from "@/hooks/use-supabase";
import { useWorkspace } from "@/contexts/workspace-context";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { testSlackWebhook } from "@/app/dashboard/settings/actions";

const SEVERITIES = ["low", "medium", "high", "critical"] as const;

interface NotificationRow {
  id: string;
  workspace_id: string;
  slack_enabled: boolean;
  slack_webhook_url: string | null;
  notify_on_problem_severity: string[];
  created_at: string;
  updated_at: string;
}

export function NotificationSettings() {
  const { workspaceId, userRole } = useWorkspace();
  const supabase = useSupabase();
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
      const { data, error } = await supabase
        .from("notification_settings")
        .select(
          "id, workspace_id, slack_enabled, slack_webhook_url, notify_on_problem_severity, created_at, updated_at"
        )
        .eq("workspace_id", workspaceId)
        .single();

      if (cancelled) return;

      if (error) {
        setLoading(false);
        return;
      }

      const row = data as NotificationRow;
      setSlackEnabled(row.slack_enabled);
      setWebhookUrl(row.slack_webhook_url || "");
      setSelectedSeverities(new Set(row.notify_on_problem_severity || ["high", "critical"]));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, supabase]);

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

    const { error } = await supabase
      .from("notification_settings")
      .update({
        slack_enabled: slackEnabled,
        slack_webhook_url: webhookUrl.trim() || null,
        notify_on_problem_severity: Array.from(selectedSeverities),
        updated_at: new Date().toISOString(),
      })
      .eq("workspace_id", workspaceId);

    setSaving(false);

    if (error) {
      setMessage({ text: error.message, type: "error" });
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

  function maskUrl(url: string) {
    if (!url) return "";
    if (url.length <= 12) return url;
    return url.slice(0, 8) + "\u2022".repeat(16) + url.slice(-4);
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
              value={showWebhookUrl ? webhookUrl : webhookUrl}
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
