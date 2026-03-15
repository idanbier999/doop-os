"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export interface OperatorGroup {
  operatorId: string | null;
  operatorName: string;
  agentCount: number;
  healthBreakdown: { healthy: number; degraded: number; critical: number; offline: number };
  openProblems: number;
}

interface OperatorFleetSummaryProps {
  operators: OperatorGroup[];
  selectedOperatorId?: string | null;
  onSelectOperator: (operatorId: string | null) => void;
  onClearFilter?: () => void;
}

const healthDotColors: Record<string, string> = {
  critical: "bg-health-critical",
  degraded: "bg-health-degraded",
  offline: "bg-health-offline",
  healthy: "bg-health-healthy",
};

function sortOperators(operators: OperatorGroup[]): OperatorGroup[] {
  return [...operators].sort((a, b) => {
    // Unassigned always last
    if (a.operatorId === null && b.operatorId !== null) return 1;
    if (a.operatorId !== null && b.operatorId === null) return -1;
    // Critical agents first
    if (a.healthBreakdown.critical !== b.healthBreakdown.critical) {
      return b.healthBreakdown.critical - a.healthBreakdown.critical;
    }
    // Then agent count desc
    return b.agentCount - a.agentCount;
  });
}

export function OperatorFleetSummary({
  operators,
  selectedOperatorId,
  onSelectOperator,
  onClearFilter,
}: OperatorFleetSummaryProps) {
  if (operators.length <= 1) return null;

  const sorted = sortOperators(operators);

  return (
    <Card title="Operator Overview">
      <div className="p-4">
        {selectedOperatorId !== undefined && onClearFilter && (
          <div className="mb-3">
            <Button variant="ghost" size="sm" onClick={onClearFilter}>
              Show All Operators
            </Button>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sorted.map((op) => {
            const isSelected = selectedOperatorId === op.operatorId;
            return (
              <button
                key={op.operatorId ?? "unassigned"}
                onClick={() => onSelectOperator(op.operatorId)}
                className={`text-left border rounded-lg p-3 transition-colors ${
                  isSelected
                    ? "border-mac-highlight bg-mac-highlight-soft/30"
                    : "border-mac-border bg-mac-white hover:border-mac-border hover:bg-mac-highlight-soft/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-mac-black truncate font-[family-name:var(--font-pixel)]">
                    {op.operatorName}
                  </span>
                  <span className="text-xs text-mac-gray font-[family-name:var(--font-pixel)]">
                    {op.agentCount} agent{op.agentCount !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-1">
                  {(["critical", "degraded", "offline", "healthy"] as const).map((health) => {
                    const count = op.healthBreakdown[health];
                    return Array.from({ length: count }).map((_, i) => (
                      <span
                        key={`${health}-${i}`}
                        className={`inline-block h-2 w-2 rounded-full ${healthDotColors[health]}`}
                      />
                    ));
                  })}
                </div>
                {op.openProblems > 0 && (
                  <p
                    className="mt-1.5 text-xs font-[family-name:var(--font-pixel)]"
                    style={{ color: "var(--color-health-critical)" }}
                  >
                    {op.openProblems} open problem{op.openProblems !== 1 ? "s" : ""}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
