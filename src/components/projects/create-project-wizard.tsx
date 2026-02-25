"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileUpload, type UploadedFile } from "@/components/ui/file-upload";
import { useWorkspace } from "@/contexts/workspace-context";
import { useSupabase } from "@/hooks/use-supabase";
import { useNotifications } from "@/contexts/notification-context";
import { createProject } from "@/app/dashboard/projects/actions";

interface Agent {
  id: string;
  name: string;
  health: string;
  agent_type?: string | null;
}

export interface CreateProjectWizardProps {
  open: boolean;
  onClose: () => void;
  agents: Agent[];
}

const TOTAL_STEPS = 5;

const STEP_LABELS = [
  "Basics",
  "Files",
  "Agents",
  "Mode",
  "Review",
];

function healthColor(health: string): string {
  switch (health) {
    case "healthy":
      return "text-green-600 bg-green-50 border-green-300";
    case "degraded":
      return "text-yellow-600 bg-yellow-50 border-yellow-300";
    case "critical":
      return "text-red-600 bg-red-50 border-red-300";
    default:
      return "text-mac-gray bg-mac-light-gray border-mac-border";
  }
}

function StepIndicator({
  currentStep,
}: {
  currentStep: number;
}) {
  return (
    <div className="flex items-center justify-center mb-6">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => {
        const step = i + 1;
        const isActive = step === currentStep;
        const isCompleted = step < currentStep;

        return (
          <div key={step} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-[family-name:var(--font-pixel)] border-2 transition-colors ${
                  isCompleted
                    ? "bg-green-600 text-white border-green-600"
                    : isActive
                    ? "bg-mac-black text-mac-white border-mac-black"
                    : "bg-mac-light-gray text-mac-gray border-mac-border"
                }`}
              >
                {isCompleted ? "\u2713" : step}
              </div>
              <span
                className={`text-[10px] font-[family-name:var(--font-pixel)] whitespace-nowrap ${
                  isActive ? "text-mac-black font-bold" : "text-mac-gray"
                }`}
              >
                {STEP_LABELS[i]}
              </span>
            </div>
            {step < TOTAL_STEPS && (
              <div
                className={`w-8 h-0.5 mb-4 mx-1 transition-colors ${
                  isCompleted ? "bg-green-600" : "bg-mac-border"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function CreateProjectWizard({
  open,
  onClose,
  agents,
}: CreateProjectWizardProps) {
  const router = useRouter();
  const { workspaceId } = useWorkspace();
  const supabase = useSupabase();
  const { addToast } = useNotifications();

  // Step state
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1 — Basics
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [nameError, setNameError] = useState("");

  // Step 2 — Files
  const [tempProjectId] = useState(() => crypto.randomUUID());
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  // Step 3 — Agents
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [leadAgentId, setLeadAgentId] = useState<string>("");

  // Step 4 — Mode
  const [orchestrationMode, setOrchestrationMode] = useState<
    "manual" | "lead_agent"
  >("manual");

  function reset() {
    setStep(1);
    setSubmitting(false);
    setName("");
    setDescription("");
    setInstructions("");
    setNameError("");
    setSelectedAgentIds([]);
    setLeadAgentId("");
    setOrchestrationMode("manual");
    setUploadedFiles([]);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function validateStep(): boolean {
    if (step === 1) {
      if (!name.trim()) {
        setNameError("Project name is required");
        return false;
      }
      setNameError("");
    }
    return true;
  }

  function handleNext() {
    if (!validateStep()) return;
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  }

  function handleBack() {
    setStep((s) => Math.max(s - 1, 1));
  }

  const handleFilesUploaded = useCallback((files: UploadedFile[]) => {
    setUploadedFiles((prev) => {
      const existingPaths = new Set(prev.map((f) => f.path));
      const newFiles = files.filter((f) => !existingPaths.has(f.path));
      return [...prev, ...newFiles];
    });
  }, []);

  function toggleAgent(agentId: string) {
    setSelectedAgentIds((prev) => {
      const isSelected = prev.includes(agentId);
      if (isSelected) {
        const next = prev.filter((id) => id !== agentId);
        if (leadAgentId === agentId) {
          setLeadAgentId(next[0] ?? "");
        }
        return next;
      } else {
        return [...prev, agentId];
      }
    });
  }

  async function handleSubmit(status: "draft" | "active") {
    if (submitting) return;
    setSubmitting(true);

    try {
      const result = await createProject({
        workspaceId,
        name: name.trim(),
        description: description.trim() || undefined,
        instructions: instructions.trim() || undefined,
        orchestration_mode: orchestrationMode,
        leadAgentId: leadAgentId || undefined,
        agentIds: selectedAgentIds,
        status,
      });

      if (!result.success) {
        addToast({
          type: "critical",
          title: "Failed to create project",
          description: result.error ?? "Unknown error",
        });
        setSubmitting(false);
        return;
      }

      const projectId = result.projectId!;

      // Insert project_files records for uploaded files
      if (uploadedFiles.length > 0) {
        const fileRows = uploadedFiles
          .filter((f) => f.status === "complete")
          .map((f) => ({
            project_id: projectId,
            file_name: f.name,
            file_path: f.path,
            file_size: f.size,
            mime_type: f.type || null,
          }));

        if (fileRows.length > 0) {
          await supabase.from("project_files").insert(fileRows);
        }
      }

      addToast({
        type: "info",
        title:
          status === "active"
            ? "Project launched!"
            : "Project saved as draft",
        description: name.trim(),
      });

      handleClose();
      router.refresh();
    } catch {
      addToast({
        type: "critical",
        title: "Failed to create project",
        description: "An unexpected error occurred",
      });
      setSubmitting(false);
    }
  }

  const canLeadAgent = selectedAgentIds.length > 0;

  return (
    <dialog
      open={open}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 w-full h-full m-0 max-w-none p-4 ${
        open ? "" : "hidden"
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="border-2 border-mac-border-strong bg-mac-white rounded-lg shadow-[1px_1px_0px_var(--color-mac-shadow),0px_4px_12px_var(--color-mac-shadow-soft)] w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="border border-mac-border m-[2px] rounded-md flex flex-col flex-1 min-h-0">
          {/* Title bar */}
          <div className="mac-title-bar shrink-0">
            <button onClick={handleClose} className="mac-close-box" aria-label="Close" />
            <span className="mac-title-bar-title">New Project</span>
          </div>

          {/* Content */}
          <div className="p-6 flex flex-col flex-1 min-h-0 overflow-y-auto">
            <StepIndicator currentStep={step} />

            {/* Step 1 — Basics */}
            {step === 1 && (
              <div className="space-y-4">
                <h2 className="text-base font-bold font-[family-name:var(--font-pixel)] text-mac-black">
                  Project Basics
                </h2>
                <Input
                  label="Project Name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (e.target.value.trim()) setNameError("");
                  }}
                  placeholder="e.g. Q1 Research Sprint"
                  error={nameError}
                />
                <div className="w-full">
                  <label className="block text-sm font-bold text-mac-black mb-1 font-[family-name:var(--font-pixel)]">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of the project..."
                    rows={3}
                    className="block w-full rounded-md border border-mac-border bg-mac-white px-2 py-1.5 text-sm text-mac-black placeholder-mac-gray mac-inset focus:outline-none focus:ring-2 focus:ring-mac-highlight/50 resize-none"
                  />
                </div>
                <div className="w-full">
                  <label className="block text-sm font-bold text-mac-black mb-1 font-[family-name:var(--font-pixel)]">
                    Instructions{" "}
                    <span className="font-normal text-mac-gray">(Markdown supported)</span>
                  </label>
                  <textarea
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="Detailed instructions for agents working on this project. You can use **Markdown** to format."
                    rows={6}
                    className="block w-full rounded-md border border-mac-border bg-mac-white px-2 py-1.5 text-sm text-mac-black placeholder-mac-gray mac-inset focus:outline-none focus:ring-2 focus:ring-mac-highlight/50 resize-none font-mono"
                  />
                </div>
              </div>
            )}

            {/* Step 2 — Files */}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-base font-bold font-[family-name:var(--font-pixel)] text-mac-black">
                    Project Files
                  </h2>
                  <p className="mt-1 text-sm text-mac-dark-gray">
                    Upload reference files, specs, or assets for this project. Files are stored and linked after project creation.
                  </p>
                </div>
                <FileUpload
                  workspaceId={workspaceId}
                  projectId={tempProjectId}
                  onFilesUploaded={handleFilesUploaded}
                  maxFiles={10}
                  maxSizeMB={50}
                />
              </div>
            )}

            {/* Step 3 — Agent Team */}
            {step === 3 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-base font-bold font-[family-name:var(--font-pixel)] text-mac-black">
                    Agent Team
                  </h2>
                  <p className="mt-1 text-sm text-mac-dark-gray">
                    Select agents for this project. You can optionally designate one as the lead.
                  </p>
                </div>

                {agents.length === 0 ? (
                  <p className="text-sm text-mac-gray text-center py-8">
                    No agents available. Connect agents from the Agents page first.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                    {agents.map((agent) => {
                      const isSelected = selectedAgentIds.includes(agent.id);
                      return (
                        <button
                          key={agent.id}
                          type="button"
                          onClick={() => toggleAgent(agent.id)}
                          className={`flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-colors ${
                            isSelected
                              ? "border-mac-black bg-mac-highlight-soft"
                              : "border-mac-border bg-mac-white hover:border-mac-dark-gray"
                          }`}
                        >
                          <div
                            className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                              isSelected
                                ? "bg-mac-black border-mac-black"
                                : "border-mac-border bg-mac-white"
                            }`}
                          >
                            {isSelected && (
                              <span className="text-mac-white text-[10px] leading-none font-bold">
                                &#10003;
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold font-[family-name:var(--font-pixel)] text-mac-black truncate">
                                {agent.name}
                              </span>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded border font-[family-name:var(--font-pixel)] ${healthColor(
                                  agent.health
                                )}`}
                              >
                                {agent.health}
                              </span>
                            </div>
                            {agent.agent_type && (
                              <p className="mt-0.5 text-xs text-mac-gray">{agent.agent_type}</p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {selectedAgentIds.length > 0 && (
                  <div className="border-t border-mac-border pt-3">
                    <label className="block text-sm font-bold text-mac-black mb-2 font-[family-name:var(--font-pixel)]">
                      Lead Agent (optional)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setLeadAgentId("")}
                        className={`px-3 py-1 rounded-full text-xs border font-[family-name:var(--font-pixel)] transition-colors ${
                          leadAgentId === ""
                            ? "bg-mac-black text-mac-white border-mac-black"
                            : "bg-mac-white text-mac-dark-gray border-mac-border hover:border-mac-dark-gray"
                        }`}
                      >
                        None
                      </button>
                      {selectedAgentIds.map((id) => {
                        const agent = agents.find((a) => a.id === id);
                        if (!agent) return null;
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setLeadAgentId(id)}
                            className={`px-3 py-1 rounded-full text-xs border font-[family-name:var(--font-pixel)] transition-colors ${
                              leadAgentId === id
                                ? "bg-mac-black text-mac-white border-mac-black"
                                : "bg-mac-white text-mac-dark-gray border-mac-border hover:border-mac-dark-gray"
                            }`}
                          >
                            {agent.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 4 — Mode */}
            {step === 4 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-base font-bold font-[family-name:var(--font-pixel)] text-mac-black">
                    Orchestration Mode
                  </h2>
                  <p className="mt-1 text-sm text-mac-dark-gray">
                    How will work be assigned and coordinated?
                  </p>
                </div>
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setOrchestrationMode("manual")}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                      orchestrationMode === "manual"
                        ? "border-mac-black bg-mac-highlight-soft"
                        : "border-mac-border bg-mac-white hover:border-mac-dark-gray"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          orchestrationMode === "manual"
                            ? "border-mac-black"
                            : "border-mac-border"
                        }`}
                      >
                        {orchestrationMode === "manual" && (
                          <div className="w-2 h-2 rounded-full bg-mac-black" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-bold font-[family-name:var(--font-pixel)] text-mac-black">
                          Manual
                        </p>
                        <p className="mt-0.5 text-xs text-mac-dark-gray">
                          You create tasks and assign agents. Tarely pushes work via webhooks.
                        </p>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={!canLeadAgent || !leadAgentId}
                    onClick={() => {
                      if (canLeadAgent && leadAgentId) setOrchestrationMode("lead_agent");
                    }}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                      orchestrationMode === "lead_agent"
                        ? "border-mac-black bg-mac-highlight-soft"
                        : canLeadAgent && leadAgentId
                        ? "border-mac-border bg-mac-white hover:border-mac-dark-gray"
                        : "border-mac-border bg-mac-light-gray opacity-50 cursor-not-allowed"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          orchestrationMode === "lead_agent"
                            ? "border-mac-black"
                            : "border-mac-border"
                        }`}
                      >
                        {orchestrationMode === "lead_agent" && (
                          <div className="w-2 h-2 rounded-full bg-mac-black" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-bold font-[family-name:var(--font-pixel)] text-mac-black">
                          Lead Agent
                        </p>
                        <p className="mt-0.5 text-xs text-mac-dark-gray">
                          The lead agent orchestrates: creates subtasks, assigns team members.
                          {(!canLeadAgent || !leadAgentId) && (
                            <span className="text-mac-gray"> (Requires a lead agent selected in Step 3)</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Step 5 — Review & Launch */}
            {step === 5 && (
              <div className="space-y-4">
                <h2 className="text-base font-bold font-[family-name:var(--font-pixel)] text-mac-black">
                  Review &amp; Launch
                </h2>
                <div className="space-y-3 rounded-lg border border-mac-border bg-mac-light-gray p-4 text-sm">
                  <div className="flex gap-2">
                    <span className="font-bold font-[family-name:var(--font-pixel)] text-mac-black w-28 shrink-0">
                      Name
                    </span>
                    <span className="text-mac-dark-gray">{name}</span>
                  </div>
                  {description && (
                    <div className="flex gap-2">
                      <span className="font-bold font-[family-name:var(--font-pixel)] text-mac-black w-28 shrink-0">
                        Description
                      </span>
                      <span className="text-mac-dark-gray line-clamp-3">{description}</span>
                    </div>
                  )}
                  {instructions && (
                    <div className="flex gap-2">
                      <span className="font-bold font-[family-name:var(--font-pixel)] text-mac-black w-28 shrink-0">
                        Instructions
                      </span>
                      <span className="text-mac-gray text-xs line-clamp-2 font-mono">
                        {instructions.slice(0, 120)}{instructions.length > 120 ? "..." : ""}
                      </span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <span className="font-bold font-[family-name:var(--font-pixel)] text-mac-black w-28 shrink-0">
                      Files
                    </span>
                    <span className="text-mac-dark-gray">
                      {uploadedFiles.filter((f) => f.status === "complete").length} file(s)
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-bold font-[family-name:var(--font-pixel)] text-mac-black w-28 shrink-0">
                      Agents
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {selectedAgentIds.length === 0 ? (
                        <span className="text-mac-gray">None selected</span>
                      ) : (
                        selectedAgentIds.map((id) => {
                          const agent = agents.find((a) => a.id === id);
                          return (
                            <span
                              key={id}
                              className="text-xs px-2 py-0.5 rounded-full bg-mac-white border border-mac-border font-[family-name:var(--font-pixel)]"
                            >
                              {agent?.name ?? id}
                              {id === leadAgentId && (
                                <span className="ml-1 text-mac-gray">(lead)</span>
                              )}
                            </span>
                          );
                        })
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-bold font-[family-name:var(--font-pixel)] text-mac-black w-28 shrink-0">
                      Mode
                    </span>
                    <span className="text-mac-dark-gray capitalize">
                      {orchestrationMode === "lead_agent" ? "Lead Agent" : "Manual"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer navigation */}
          <div className="shrink-0 border-t border-mac-border px-6 py-4 flex items-center justify-between bg-mac-white rounded-b-md">
            <Button
              variant="secondary"
              onClick={step === 1 ? handleClose : handleBack}
              disabled={submitting}
            >
              {step === 1 ? "Cancel" : "Back"}
            </Button>

            <div className="flex items-center gap-2">
              {step < TOTAL_STEPS ? (
                <Button variant="primary" onClick={handleNext}>
                  Next
                </Button>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    disabled={submitting}
                    onClick={() => handleSubmit("draft")}
                  >
                    {submitting ? "Saving..." : "Save as Draft"}
                  </Button>
                  <Button
                    variant="primary"
                    disabled={submitting}
                    onClick={() => handleSubmit("active")}
                  >
                    {submitting ? "Launching..." : "Launch Project"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </dialog>
  );
}
