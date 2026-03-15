import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashApiKey } from "@/lib/api-key-hash";

export async function authenticateAgent(request: NextRequest) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const apiKey = header.slice(7);
  if (!apiKey) return null;

  const keyHash = hashApiKey(apiKey);

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("agents")
    .select("id, workspace_id, name")
    .eq("api_key_hash", keyHash)
    .single();

  return data; // null if key invalid/not found
}
