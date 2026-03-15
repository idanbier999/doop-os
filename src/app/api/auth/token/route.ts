import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { signSupabaseToken } from "@/lib/jwt";
import { headers } from "next/headers";

export async function GET() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = signSupabaseToken(session.user.id);

  return NextResponse.json({ token });
}
