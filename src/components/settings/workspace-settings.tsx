"use client";

import { useState } from "react";
import { useWorkspace } from "@/contexts/workspace-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { updateWorkspaceSettings } from "@/app/dashboard/settings/actions";

interface WorkspaceSettingsProps {
  workspace: { id: string; name: string; slug: string };
}

export function WorkspaceSettings({ workspace }: WorkspaceSettingsProps) {
  const { userRole } = useWorkspace();
  const [name, setName] = useState(workspace.name);
  const [slug, setSlug] = useState(workspace.slug);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const canEdit = userRole === "owner" || userRole === "admin";

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;

    setSaving(true);
    setMessage("");

    const result = await updateWorkspaceSettings(workspace.id, {
      name: name.trim(),
      slug: slug.trim(),
    });

    setSaving(false);

    if (result.error) {
      setMessage(result.error);
    } else {
      setMessage("Settings saved successfully.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold text-mac-black">Workspace Settings</h2>
      </CardHeader>
      <CardBody>
        <form onSubmit={handleSave} className="space-y-4 max-w-md">
          <Input
            label="Workspace Name"
            id="workspace-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!canEdit}
          />
          <Input
            label="Slug"
            id="workspace-slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            disabled={!canEdit}
          />
          {!canEdit && (
            <p className="text-sm text-mac-dark-gray">
              Only owners and admins can edit workspace settings.
            </p>
          )}
          {message && <p className="text-sm text-mac-gray">{message}</p>}
          {canEdit && (
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          )}
        </form>
      </CardBody>
    </Card>
  );
}
