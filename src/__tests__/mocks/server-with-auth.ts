import { vi } from "vitest";
import { createMockSupabaseClient, type MockSupabaseChain } from "./supabase";
import { mockSession } from "./auth";

let currentMock: ReturnType<typeof createMockSupabaseClient>;

export function getServerWithAuthMock() {
  currentMock = createMockSupabaseClient();
  return currentMock;
}

export function setupServerWithAuthMock() {
  currentMock = createMockSupabaseClient();

  vi.mock("@/lib/supabase/server-with-auth", () => ({
    getAuthenticatedSupabase: vi.fn(async () => ({
      session: mockSession,
      supabase: currentMock.client,
      user: mockSession.user,
    })),
  }));

  return currentMock;
}

export function getLatestMock() {
  return currentMock;
}
