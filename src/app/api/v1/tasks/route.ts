import { NextRequest, NextResponse } from "next/server";
import { authenticateAgent } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status") ?? "pending";
  const limit = Math.min(Number(searchParams.get("limit")) || 20, 100);
  const assignedTo = searchParams.get("assigned_to");

  const supabase = createAdminClient();

  let query = supabase
    .from("tasks")
    .select("id, title, description, status, priority, created_at")
    .eq("workspace_id", agent.workspace_id)
    .eq("status", status)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (assignedTo === "me") {
    query = query.eq("agent_id", agent.id);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch tasks" },
      { status: 500 }
    );
  }

  return NextResponse.json({ tasks: data });
}
