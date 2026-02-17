"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface CreateWorkspaceStepProps {
  onComplete: (workspaceId: string) => void;
  supabase: ReturnType<typeof import("@/lib/supabase/client").createClient>;
}

export function CreateWorkspaceStep({
  onComplete,
  supabase,
}: CreateWorkspaceStepProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function handleNameChange(value: string) {
    setName(value);
    setSlug(
      value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) {
      setError("Name and slug are required.");
      return;
    }

    setSubmitting(true);
    setError("");

    const { data, error: rpcError } = await supabase.rpc(
      "create_workspace_for_user",
      {
        workspace_name: name.trim(),
        workspace_slug: slug.trim(),
      }
    );

    setSubmitting(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    onComplete(data as string);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-mac-black">
          Create your workspace
        </h2>
        <p className="mt-1 text-sm text-mac-gray">
          A workspace is where your team and agents collaborate.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Workspace Name"
          id="ws-name"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="My Team"
          required
        />
        <Input
          label="Slug"
          id="ws-slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="my-team"
          required
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating..." : "Create Workspace"}
        </Button>
      </form>
    </div>
  );
}
