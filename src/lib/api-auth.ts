import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function authenticateAgent(request: NextRequest) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const apiKey = header.slice(7);
  if (!apiKey) return null;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("agents")
    .select("id, workspace_id, name")
    .eq("api_key", apiKey)
    .single();

  return data; // null if key invalid/not found
}
