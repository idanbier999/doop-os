import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type MemberInfo = {
  userId: string;
  name: string;
  email: string;
  role: string;
};

export async function getWorkspaceMemberMap(
  supabase: SupabaseClient<Database>,
  workspaceId: string
): Promise<Map<string, MemberInfo>> {
  const { data } = await supabase
    .from("workspace_members")
    .select("user_id, role, user:user!workspace_members_user_id_fkey(name, email)")
    .eq("workspace_id", workspaceId);

  const map = new Map<string, MemberInfo>();

  if (!data) return map;

  for (const row of data) {
    const user = row.user as unknown as { name: string | null; email: string | null } | null;
    map.set(row.user_id, {
      userId: row.user_id,
      name: user?.name ?? "Unknown",
      email: user?.email ?? "Unknown",
      role: row.role,
    });
  }

  return map;
}
