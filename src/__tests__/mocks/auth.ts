import { vi } from "vitest";

export const mockSession = {
  user: {
    id: "user-001",
    email: "test@example.com",
    name: "Test User",
    emailVerified: true,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    image: null,
  },
  session: {
    id: "session-001",
    userId: "user-001",
    token: "session-token-001",
    expiresAt: new Date(Date.now() + 86400000),
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ipAddress: "127.0.0.1",
    userAgent: "test",
  },
};

export const mockAuth = {
  api: {
    getSession: vi.fn().mockResolvedValue(mockSession),
  },
  handler: vi.fn(),
};

export function setupAuthMock() {
  vi.mock("@/lib/auth", () => ({
    auth: mockAuth,
  }));
}

export function resetAuthMock() {
  mockAuth.api.getSession.mockResolvedValue(mockSession);
}
