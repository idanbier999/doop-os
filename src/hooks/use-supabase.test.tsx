import { renderHook } from "@testing-library/react";
import { useSupabase } from "@/hooks/use-supabase";
import { useSupabaseToken } from "@/contexts/supabase-token-context";
import { createClient } from "@/lib/supabase/client";

vi.mock("@/contexts/supabase-token-context", () => ({
  useSupabaseToken: vi.fn(() => "test-token"),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn((token: string) => ({ token, from: vi.fn() })),
}));

describe("useSupabase", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns a Supabase client", () => {
    const { result } = renderHook(() => useSupabase());
    expect(result.current).toBeDefined();
    expect(result.current.token).toBe("test-token");
    expect(createClient).toHaveBeenCalledWith("test-token");
  });

  it("memoizes the client (same reference on re-render with same token)", () => {
    const { result, rerender } = renderHook(() => useSupabase());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it("creates new client when token changes", () => {
    const mockUseSupabaseToken = vi.mocked(useSupabaseToken);
    mockUseSupabaseToken.mockReturnValue("token-a");

    const { result, rerender } = renderHook(() => useSupabase());
    const first = result.current;
    expect(first.token).toBe("token-a");

    mockUseSupabaseToken.mockReturnValue("token-b");
    rerender();

    expect(result.current.token).toBe("token-b");
    expect(result.current).not.toBe(first);
  });
});
