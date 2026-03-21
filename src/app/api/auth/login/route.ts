import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createSession, setSessionCookie } from "@/lib/auth/session";

// Simple in-memory rate limiter for login attempts
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 60_000; // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);

  if (!entry || entry.resetAt <= now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (entry.count >= MAX_ATTEMPTS) {
    return false;
  }

  entry.count++;
  return true;
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "unknown";

  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }

  const body = await request.json();
  const name = (body.name as string)?.trim();

  if (!name || name.length < 1 || name.length > 100) {
    return NextResponse.json({ error: "Name must be 1-100 characters" }, { status: 400 });
  }

  const db = getDb();

  // Atomic find-or-create: insert if not exists, fetch if already exists
  const [inserted] = await db
    .insert(users)
    .values({ name })
    .onConflictDoNothing({ target: users.name })
    .returning();

  let userId: string;
  if (inserted) {
    userId = inserted.id;
  } else {
    const [existing] = await db.select().from(users).where(eq(users.name, name)).limit(1);
    userId = existing.id;
  }

  // Create session
  const token = await createSession(userId);
  await setSessionCookie(token);

  return NextResponse.json({ success: true, userId });
}
