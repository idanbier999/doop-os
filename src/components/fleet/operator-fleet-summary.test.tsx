import { render, screen, fireEvent } from "@testing-library/react";
import { OperatorFleetSummary, type OperatorGroup } from "./operator-fleet-summary";

const mockOperators: OperatorGroup[] = [
  {
    operatorId: "user-1",
    operatorName: "Alice",
    agentCount: 3,
    healthBreakdown: { healthy: 2, degraded: 1, critical: 0, offline: 0 },
    openProblems: 0,
  },
  {
    operatorId: "user-2",
    operatorName: "Bob",
    agentCount: 2,
    healthBreakdown: { healthy: 0, degraded: 0, critical: 1, offline: 1 },
    openProblems: 2,
  },
  {
    operatorId: null,
    operatorName: "Unassigned",
    agentCount: 1,
    healthBreakdown: { healthy: 1, degraded: 0, critical: 0, offline: 0 },
    openProblems: 0,
  },
];

describe("OperatorFleetSummary", () => {
  it("renders one card per operator", () => {
    render(
      <OperatorFleetSummary
        operators={mockOperators}
        onSelectOperator={vi.fn()}
      />
    );
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Unassigned")).toBeInTheDocument();
  });

  it("sorts critical operators first, Unassigned last", () => {
    render(
      <OperatorFleetSummary
        operators={mockOperators}
        onSelectOperator={vi.fn()}
      />
    );
    const buttons = screen.getAllByRole("button");
    // Bob (1 critical) should be first, then Alice (0 critical, 3 agents), then Unassigned
    expect(buttons[0]).toHaveTextContent("Bob");
    expect(buttons[1]).toHaveTextContent("Alice");
    expect(buttons[2]).toHaveTextContent("Unassigned");
  });

  it("returns null when operators.length <= 1", () => {
    const { container } = render(
      <OperatorFleetSummary
        operators={[mockOperators[0]]}
        onSelectOperator={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("calls onSelectOperator when card clicked", () => {
    const handler = vi.fn();
    render(
      <OperatorFleetSummary
        operators={mockOperators}
        onSelectOperator={handler}
      />
    );
    fireEvent.click(screen.getByText("Alice"));
    expect(handler).toHaveBeenCalledWith("user-1");
  });

  it("selected card has highlight styling", () => {
    render(
      <OperatorFleetSummary
        operators={mockOperators}
        selectedOperatorId="user-1"
        onSelectOperator={vi.fn()}
      />
    );
    const aliceCard = screen.getByText("Alice").closest("button");
    expect(aliceCard?.className).toContain("border-mac-highlight");
  });

  it("shows open problems count", () => {
    render(
      <OperatorFleetSummary
        operators={mockOperators}
        onSelectOperator={vi.fn()}
      />
    );
    expect(screen.getByText("2 open problems")).toBeInTheDocument();
  });
});
