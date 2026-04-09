import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getTeamMembers } from "@/actions/teams";
import GroupSettingsClient from "./GroupSettingsClient";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Team, GroupCategory } from "@/types";

export default async function GroupSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { team: teamId } = await searchParams;
  if (!teamId) redirect("/dashboard");

  // 멤버십 확인
  const { data: membership } = await supabase
    .from("user_teams")
    .select("role, teams(id, name, description, category, is_public, invite_code, invite_expires_at, created_at)")
    .eq("user_id", user.id)
    .eq("team_id", teamId)
    .is("left_at", null)
    .single();

  if (!membership) redirect("/dashboard");

  const team = membership.teams as unknown as Team;
  const role = membership.role as "admin" | "member";

  const membersResult = await getTeamMembers(teamId);
  const members = membersResult.data ?? [];

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="sticky top-0 z-30 bg-white border-b border-zinc-200">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link
            href={`/dashboard?team=${teamId}`}
            className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-500 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 bg-zinc-900 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {team.name.slice(0, 1).toUpperCase()}
            </div>
            <span className="text-sm font-semibold text-zinc-900 truncate">{team.name}</span>
            <span className="text-xs text-zinc-400 flex-shrink-0">설정</span>
          </div>
        </div>
      </header>

      <GroupSettingsClient
        team={team}
        members={members}
        currentUserId={user.id}
        role={role}
      />
    </div>
  );
}
