import { render, screen } from "@testing-library/react";
import { HealthSparkline } from "@/components/agents/health-sparkline";

vi.mock("recharts", () => ({
  LineChart: ({ children, ...props }: any) => (
    <div data-testid="line-chart" {...props}>
      {children}
    </div>
  ),
  Line: (props: any) => <div data-testid="line" data-stroke={props.stroke} />,
  ResponsiveContainer: ({ children }: any) => (
    <div data-testid="responsive-container">{children}</div>
  ),
}));

describe("HealthSparkline", () => {
  it("returns null for empty updates", () => {
    const { container } = render(
      <HealthSparkline updates={[]} currentHealth="healthy" />
    );
    expect(container.innerHTML).toBe("");
  });

  it("returns null when all updates have null health", () => {
    const updates = [
      { health: null, created_at: "2024-01-01T00:00:00Z" },
      { health: null, created_at: "2024-01-02T00:00:00Z" },
    ];
    const { container } = render(
      <HealthSparkline updates={updates} currentHealth="healthy" />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders chart with valid data", () => {
    const updates = [
      { health: "healthy", created_at: "2024-01-01T00:00:00Z" },
      { health: "degraded", created_at: "2024-01-02T00:00:00Z" },
      { health: "critical", created_at: "2024-01-03T00:00:00Z" },
    ];
    render(<HealthSparkline updates={updates} currentHealth="healthy" />);

    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
    expect(screen.getByTestId("line-chart")).toBeInTheDocument();
    expect(screen.getByTestId("line")).toBeInTheDocument();
  });
});
