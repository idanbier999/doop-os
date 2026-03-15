"use client";

import { useState } from "react";
import { useSupabase } from "@/hooks/use-supabase";
import { useWorkspace } from "@/contexts/workspace-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardBody } from "@/components/ui/card";

interface WorkspaceSettingsProps {
  workspace: { id: string; name: string; slug: string };
}

export function WorkspaceSettings({ workspace }: WorkspaceSettingsProps) {
  const { userRole } = useWorkspace();
  const [name, setName] = useState(workspace.name);
  const [slug, setSlug] = useState(workspace.slug);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const supabase = useSupabase();

  const canEdit = userRole === "owner" || userRole === "admin";

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;

    setSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("workspaces")
      .update({ name: name.trim(), slug: slug.trim() })
      .eq("id", workspace.id);

    setSaving(false);

    if (error) {
      setMessage(error.message);
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
