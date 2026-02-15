"use client";

import { useState, useCallback, useMemo } from "react";
import { useRealtime } from "@/hooks/use-realtime";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ProblemFilters } from "@/components/problems/problem-filters";
import { ProblemActions } from "@/components/problems/problem-actions";
import { formatDate } from "@/lib/utils";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

type ProblemWithAgent = {
  id: string;
  agent_id: string;
  severity: string;
  title: string;
  description: string | null;
  status: string;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string | null;
  agents: { name: string; agent_type: string | null } | null;
};

interface ProblemsTableProps {
  initialProblems: ProblemWithAgent[];
  agents: { id: string; name: string }[];
}

export function ProblemsTable({
  initialProblems,
  agents,
}: ProblemsTableProps) {
  const [problems, setProblems] =
    useState<ProblemWithAgent[]>(initialProblems);
  const [severityFilter, setSeverityFilter] = useState("all");
  const [agentFilter, setAgentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  type SortField = "created_at" | "severity";
  type SortDir = "asc" | "desc";
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const severityOrder: Record<string, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const handlePayload = useCallback(
    (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      if (payload.eventType === "INSERT") {
        const newProblem = payload.new as ProblemWithAgent;
        const agentData = agents.find(a => a.id === (newProblem as { agent_id?: string }).agent_id);
        setProblems((prev) => [{
          ...newProblem,
          agents: agentData ? { name: agentData.name, agent_type: null } : null
        }, ...prev]);
      } else if (payload.eventType === "UPDATE") {
        const updated = payload.new as ProblemWithAgent;
        setProblems((prev) =>
          prev.map((p) =>
            p.id === updated.id ? { ...updated, agents: p.agents } : p
          )
        );
      } else if (payload.eventType === "DELETE") {
        const old = payload.old as { id?: string };
        if (old.id) {
          setProblems((prev) => prev.filter((p) => p.id !== old.id));
        }
      }
    },
    [agents]
  );

  useRealtime({
    table: "problems",
    onPayload: handlePayload,
  });

  const filtered = useMemo(() => {
    const result = problems.filter((p) => {
      if (severityFilter !== "all" && p.severity !== severityFilter) return false;
      if (agentFilter !== "all" && p.agent_id !== agentFilter) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      return true;
    });

    result.sort((a, b) => {
      if (sortField === "severity") {
        const diff =
          (severityOrder[b.severity] ?? 0) - (severityOrder[a.severity] ?? 0);
        return sortDir === "desc" ? diff : -diff;
      }
      // created_at
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      return sortDir === "desc" ? bTime - aTime : aTime - bTime;
    });

    return result;
  }, [problems, severityFilter, agentFilter, statusFilter, sortField, sortDir]);

  return (
    <div className="space-y-4">
      <ProblemFilters
        agents={agents}
        severity={severityFilter}
        agentId={agentFilter}
        status={statusFilter}
        onSeverityChange={setSeverityFilter}
        onAgentChange={setAgentFilter}
        onStatusChange={setStatusFilter}
      />

      {filtered.length === 0 ? (
        <EmptyState
          message="No problems found"
          description="Adjust filters or wait for agents to report issues"
        />
      ) : (
        <div className="rounded-lg border border-gray-800 bg-gray-900 overflow-hidden">
          <Table>
            <Thead>
              <Tr>
                <Th>
                  <button
                    onClick={() => toggleSort("severity")}
                    className="flex items-center gap-1 hover:text-gray-200"
                  >
                    Severity
                    {sortField === "severity" && (
                      <span className="text-xs">
                        {sortDir === "desc" ? "\u2193" : "\u2191"}
                      </span>
                    )}
                  </button>
                </Th>
                <Th>Title</Th>
                <Th>Agent</Th>
                <Th>Status</Th>
                <Th>
                  <button
                    onClick={() => toggleSort("created_at")}
                    className="flex items-center gap-1 hover:text-gray-200"
                  >
                    Created
                    {sortField === "created_at" && (
                      <span className="text-xs">
                        {sortDir === "desc" ? "\u2193" : "\u2191"}
                      </span>
                    )}
                  </button>
                </Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {filtered.map((problem) => (
                <Tr key={problem.id}>
                  <Td>
                    <Badge variant="severity" value={problem.severity} />
                  </Td>
                  <Td>
                    <span className="font-medium text-gray-100">
                      {problem.title}
                    </span>
                    {problem.description && (
                      <p className="mt-0.5 text-xs text-gray-500 line-clamp-1">
                        {problem.description}
                      </p>
                    )}
                  </Td>
                  <Td>{problem.agents?.name || "Unknown"}</Td>
                  <Td>
                    <Badge variant="status" value={problem.status} />
                  </Td>
                  <Td className="whitespace-nowrap">
                    {formatDate(problem.created_at)}
                  </Td>
                  <Td>
                    <ProblemActions
                      problemId={problem.id}
                      status={problem.status}
                      agentId={problem.agent_id}
                      problemTitle={problem.title}
                    />
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </div>
      )}
    </div>
  );
}
