"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createWorkspace } from "@/app/onboarding/actions";

interface CreateWorkspaceStepProps {
  onComplete: (workspaceId: string) => void;
}

export function CreateWorkspaceStep({ onComplete }: CreateWorkspaceStepProps) {
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

    const result = await createWorkspace(name.trim(), slug.trim());

    setSubmitting(false);

    if (!result.success) {
      setError(result.error ?? "Failed to create workspace");
      return;
    }

    onComplete(result.workspaceId!);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-mac-black">Set up your control plane</h2>
        <p className="mt-1 text-sm text-mac-gray">
          Your control plane is where you audit, govern, and operate your AI agents.
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
          {submitting ? "Creating..." : "Create Control Plane"}
        </Button>
      </form>
    </div>
  );
}
