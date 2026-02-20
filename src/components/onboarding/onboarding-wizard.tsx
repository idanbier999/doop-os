"use client";

import { useState } from "react";
import { useSupabase } from "@/hooks/use-supabase";
import { CreateWorkspaceStep } from "@/components/onboarding/create-workspace-step";
import { RegisterAgentStep } from "@/components/onboarding/register-agent-step";
import { DoneStep } from "@/components/onboarding/done-step";

const steps = ["Set Up Control Plane", "Connect Agent", "Done"];

export function OnboardingWizard() {
  const [step, setStep] = useState(0);
  const supabase = useSupabase();

  return (
    <div className="flex min-h-screen items-center justify-center bg-mac-light-gray p-4">
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
                      : "bg-mac-white text-mac-dark-gray"
                  }`}
                >
                  {i + 1}
                </div>
                <span
                  className={`text-sm ${
                    i <= step ? "text-mac-black" : "text-mac-gray"
                  }`}
                >
                  {label}
                </span>
                {i < steps.length - 1 && (
                  <div
                    className={`h-px w-8 ${
                      i < step ? "bg-blue-600" : "bg-mac-white"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="rounded-lg border border-mac-border bg-mac-white p-6">
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
