"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CreateWorkspaceStep } from "@/components/onboarding/create-workspace-step";
import { RegisterAgentStep } from "@/components/onboarding/register-agent-step";
import { DoneStep } from "@/components/onboarding/done-step";

const steps = ["Create Workspace", "Connect Agent", "Done"];

export function OnboardingWizard() {
  const [step, setStep] = useState(0);
  const supabase = createClient();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 p-4">
      <div className="w-full max-w-lg">
        {/* Step indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            {steps.map((label, i) => (
              <div key={label} className="flex items-center gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                    i <= step
                      ? "bg-blue-600 text-white"
                      : "bg-gray-800 text-gray-500"
                  }`}
                >
                  {i + 1}
                </div>
                <span
                  className={`text-sm ${
                    i <= step ? "text-gray-200" : "text-gray-600"
                  }`}
                >
                  {label}
                </span>
                {i < steps.length - 1 && (
                  <div
                    className={`h-px w-8 ${
                      i < step ? "bg-blue-600" : "bg-gray-800"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
          {step === 0 && (
            <CreateWorkspaceStep
              supabase={supabase}
              onComplete={() => setStep(1)}
            />
          )}
          {step === 1 && (
            <RegisterAgentStep onComplete={() => setStep(2)} />
          )}
          {step === 2 && <DoneStep />}
        </div>
      </div>
    </div>
  );
}
