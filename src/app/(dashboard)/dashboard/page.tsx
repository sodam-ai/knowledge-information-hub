import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ItemFeed from "@/components/items/ItemFeed";
import SaveItemButton from "@/components/items/SaveItemButton";
import SearchBar from "@/components/items/SearchBar";
import TeamHeader from "@/components/layout/TeamHeader";
import type { Team, GroupCategory } from "@/types";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // 소속 그룹 목록
  const { data: teams } = await supabase
    .from("user_teams")
    .select(
      "team_id, role, teams(id, name, invite_code, invite_expires_at, is_public, description, category, created_at)"
    )
    .eq("user_id", user.id)
    .is("left_at", null)
    .order("joined_at", { ascending: true });

  type TeamRow = Team;

  const myTeams = (teams ?? []).map((ut) => ({
    ...(ut.teams as unknown as TeamRow),
    role: ut.role as "admin" | "member",
  }));

  if (myTeams.length === 0) redirect("/onboarding");

  // URL ?team= 파라미터로 활성 그룹 결정
  const { team: teamIdParam } = await searchParams;
  const activeTeam =
    myTeams.find((t) => t.id === teamIdParam) ?? myTeams[0];

  // 활성 그룹의 최신 아이템 30개 + 전체 개수
  const [{ data: items }, { count: totalCount }] = await Promise.all([
    supabase
      .from("items")
      .select("*, item_tags(tag_id, tags(id, name, color))")
      .eq("team_id", activeTeam.id)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("items")
      .select("*", { count: "exact", head: true })
      .eq("team_id", activeTeam.id)
      .eq("is_deleted", false),
  ]);

  const mappedItems = (items ?? []).map((item) => ({
    ...item,
    tags: (item.item_tags ?? []).map(
      (it: { tags: { id: string; name: string; color: string | null } }) =>
        it.tags
    ),
  }));

  return (
    <div className="min-h-screen bg-zinc-50">
      <TeamHeader
        teams={myTeams}
        activeTeam={activeTeam}
        userId={user.id}
      />

      <main className="max-w-3xl mx-auto px-4 py-5 space-y-4">
        {/* 검색 */}
        <SearchBar teamId={activeTeam.id} />

        {/* 저장 버튼 */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">
              최근 저장 항목
            </h2>
            {mappedItems.length > 0 && (
              <p className="text-xs text-zinc-400 mt-0.5">
                {mappedItems.length}개
              </p>
            )}
          </div>
          <SaveItemButton teamId={activeTeam.id} />
        </div>

        {/* 피드 */}
        <ItemFeed
          initialItems={mappedItems}
          teamId={activeTeam.id}
          totalCount={totalCount ?? 0}
        />
      </main>
    </div>
  );
}
