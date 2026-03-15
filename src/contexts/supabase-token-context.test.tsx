import { renderHook, act, waitFor } from "@testing-library/react";
import { SupabaseTokenProvider, useSupabaseToken } from "@/contexts/supabase-token-context";

describe("SupabaseTokenContext", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("provides initial token to children", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SupabaseTokenProvider token="initial-token">{children}</SupabaseTokenProvider>
    );

    const { result } = renderHook(() => useSupabaseToken(), { wrapper });
    expect(result.current).toBe("initial-token");
  });

  it("useSupabaseToken throws when used outside provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      renderHook(() => useSupabaseToken());
    }).toThrow("useSupabaseToken must be used within SupabaseTokenProvider");

    spy.mockRestore();
  });

  it("useSupabaseToken returns the token value", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SupabaseTokenProvider token="my-jwt-token">{children}</SupabaseTokenProvider>
    );

    const { result } = renderHook(() => useSupabaseToken(), { wrapper });
    expect(result.current).toBe("my-jwt-token");
  });

  it("refreshes token on interval", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ token: "refreshed-token" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SupabaseTokenProvider token="initial-token">{children}</SupabaseTokenProvider>
    );

    const { result } = renderHook(() => useSupabaseToken(), { wrapper });
    expect(result.current).toBe("initial-token");

    // Advance 45 minutes to trigger the interval
    await act(async () => {
      vi.advanceTimersByTime(45 * 60 * 1000);
    });

    expect(fetchSpy).toHaveBeenCalledWith("/api/auth/token");

    await waitFor(() => {
      expect(result.current).toBe("refreshed-token");
    });

    fetchSpy.mockRestore();
  });
});
