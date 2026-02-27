import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSessionData = {
  user: {
    id: "user-001",
    email: "test@example.com",
    name: "Test User",
  },
  session: {
    id: "session-001",
    userId: "user-001",
  },
};

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Map()),
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

import { auth } from "@/lib/auth";
import { GET } from "./route";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/auth/token", () => {
  it("returns 401 when no session", async () => {
    (auth.api.getSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("returns a JWT token when authenticated", async () => {
    (auth.api.getSession as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockSessionData
    );

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.token).toBeDefined();
    expect(typeof json.token).toBe("string");
  });

  it("token contains correct claims (sub, role, aud, iss)", async () => {
    (auth.api.getSession as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockSessionData
    );

    const response = await GET();
    const json = await response.json();

    const decoded = jwt.decode(json.token) as jwt.JwtPayload;

    expect(decoded.sub).toBe("user-001");
    expect(decoded.role).toBe("authenticated");
    expect(decoded.aud).toBe("authenticated");
    expect(decoded.iss).toBe("supabase");
    expect(decoded.iat).toBeDefined();
    expect(decoded.exp).toBeDefined();
    expect(decoded.exp! - decoded.iat!).toBe(3600);
  });

  it("token is verifiable with SUPABASE_JWT_SECRET", async () => {
    (auth.api.getSession as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockSessionData
    );

    const response = await GET();
    const json = await response.json();

    const secret = process.env.SUPABASE_JWT_SECRET!;
    const decoded = jwt.verify(json.token, secret) as jwt.JwtPayload;

    expect(decoded.sub).toBe("user-001");
    expect(decoded.role).toBe("authenticated");
  });
});
