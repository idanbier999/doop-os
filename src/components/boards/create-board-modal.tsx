"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/contexts/workspace-context";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const COLOR_PRESETS = [
  { value: "#0055CC", label: "Blue" },
  { value: "#007700", label: "Green" },
  { value: "#7722AA", label: "Purple" },
  { value: "#CC6600", label: "Orange" },
  { value: "#CC0000", label: "Red" },
  { value: "#007777", label: "Teal" },
  { value: "#CC0077", label: "Pink" },
  { value: "#666666", label: "Gray" },
];

interface CreateBoardModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreateBoardModal({ open, onClose }: CreateBoardModalProps) {
  const { workspaceId, userId } = useWorkspace();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedColor, setSelectedColor] = useState(COLOR_PRESETS[0].value);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Board name is required");
      return;
    }

    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { error: insertError } = await supabase.from("boards").insert({
      workspace_id: workspaceId,
      name: name.trim(),
      description: description.trim() || null,
      color: selectedColor,
      created_by: userId,
    });

    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setName("");
    setDescription("");
    setSelectedColor(COLOR_PRESETS[0].value);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Create Board">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Name"
          placeholder="e.g. Sprint 1, Customer Onboarding"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <div className="w-full">
          <label className="block text-sm font-bold text-mac-black mb-1 font-[family-name:var(--font-pixel)]">
            Description
          </label>
          <textarea
            placeholder="What is this board for?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-mac-border bg-mac-white px-2 py-1.5 text-sm text-mac-black placeholder-mac-gray shadow-[inset_1px_1px_0px_rgba(0,0,0,0.06)] focus:outline-none focus:ring-2 focus:ring-mac-highlight"
          />
        </div>

        <div className="w-full">
          <label className="block text-sm font-bold text-mac-black mb-2 font-[family-name:var(--font-pixel)]">
            Color
          </label>
          <div className="flex gap-2 flex-wrap">
            {COLOR_PRESETS.map((color) => (
              <button
                key={color.value}
                type="button"
                title={color.label}
                onClick={() => setSelectedColor(color.value)}
                className={`w-7 h-7 rounded-full border-2 transition-all ${
                  selectedColor === color.value
                    ? "border-mac-black ring-2 ring-mac-black ring-offset-1 ring-offset-mac-white"
                    : "border-mac-dark-gray hover:border-mac-black"
                }`}
                style={{ backgroundColor: color.value }}
              />
            ))}
          </div>
        </div>

        {error && (
          <p className="text-sm text-severity-critical font-[family-name:var(--font-pixel)]">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating..." : "Create Board"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
