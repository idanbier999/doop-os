import type { Metadata } from "next";
import { requireWorkspaceMembership } from "@/lib/workspace";
import { SettingsPageClient } from "@/components/settings/settings-page-client";

export const metadata: Metadata = { title: "Settings | Doop" };

export default async function SettingsPage() {
  const { workspace } = await requireWorkspaceMembership();

  return <SettingsPageClient workspace={workspace} />;
}
