import { getAuthenticatedSupabase } from "@/lib/supabase/server-with-auth";
import { redirect } from "next/navigation";

export default async function RootPage() {
  const { user } = await getAuthenticatedSupabase();

  if (user) {
    redirect("/dashboard");
  } else {
    redirect("/login");
  }
}
