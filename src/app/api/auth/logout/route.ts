import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { destroySession, clearSessionCookie, COOKIE_NAME } from "@/lib/auth/session";

export async function POST() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;

  if (token) {
    await destroySession(token);
  }
  await clearSessionCookie();

  return NextResponse.json({ success: true });
}
