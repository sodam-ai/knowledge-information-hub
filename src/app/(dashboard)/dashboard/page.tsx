import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ItemFeed from "@/components/items/ItemFeed";
import SaveItemButton from "@/components/items/SaveItemButton";
import SearchBar from "@/components/items/SearchBar";
import TeamHeader from "@/components/layout/TeamHeader";
import Link from "next/link";
import { Users, Plus } from "lucide-react";
import type { Team, ItemType } from "@/types";

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
  const { data: teamsData } = await supabase
    .from("user_teams")
    .select(
      "team_id, role, teams(id, name, invite_code, invite_expires_at, is_public, description, category, created_at)"
    )
    .eq("user_id", user.id)
    .is("left_at", null)
    .order("joined_at", { ascending: true });

  type TeamRow = Team;

  const myTeams = (teamsData ?? []).map((ut) => ({
    ...(ut.teams as unknown as TeamRow),
    role: ut.role as "admin" | "member",
  }));

  // ── 그룹이 없는 경우: 환영 + 탐색 화면 ──────────────────
  if (myTeams.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm text-center space-y-6">
          <div>
            <div className="inline-flex items-center justify-center w-16 h-16 bg-zinc-900 rounded-2xl mb-4">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-zinc-900">Knowledge Link Hub</h1>
            <p className="mt-2 text-sm text-zinc-500">
              그룹에 참여하거나 새로 만들어서 지식을 공유해보세요
            </p>
          </div>

          <div className="space-y-3">
            <Link
              href="/onboarding"
              className="flex items-center justify-center gap-2.5 w-full py-3 bg-zinc-900 text-white text-sm font-medium rounded-2xl hover:bg-zinc-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              그룹 만들기 또는 참여하기
            </Link>
            <Link
              href="/explore"
              className="flex items-center justify-center gap-2.5 w-full py-3 border border-zinc-200 bg-white text-zinc-700 text-sm font-medium rounded-2xl hover:bg-zinc-50 transition-colors"
            >
              <Users className="w-4 h-4" />
              공개 그룹 탐색
            </Link>
          </div>

          <p className="text-xs text-zinc-400">
            이미 초대 코드가 있다면{" "}
            <Link href="/onboarding" className="text-zinc-600 underline underline-offset-2">
              여기서
            </Link>{" "}
            참여할 수 있어요
          </p>
        </div>
      </div>
    );
  }

  // ── 그룹이 있는 경우: 피드 화면 ──────────────────────────
  const { team: teamIdParam } = await searchParams;
  const viewAll = !teamIdParam || teamIdParam === "all";
  const activeTeam =
    myTeams.find((t) => t.id === teamIdParam) ?? myTeams[0];

  type ItemWithTeam = {
    id: string;
    type: ItemType;
    title: string;
    content: string | null;
    url: string | null;
    url_hash: string | null;
    file_path: string | null;
    file_mime: string | null;
    thumbnail_url: string | null;
    collection_id: string | null;
    is_pinned: boolean;
    view_count: number;
    team_id: string;
    created_by: string | null;
    is_deleted: boolean;
    deleted_at: string | null;
    created_at: string;
    updated_at: string;
    item_tags: { tags: { id: string; name: string; color: string | null; team_id: string } }[];
    teams?: { id: string; name: string } | null;
  };

  let rawItems: ItemWithTeam[] = [];
  let totalCount = 0;

  if (viewAll) {
    const teamIds = myTeams.map((t) => t.id);
    const [{ data: allItems }, { count }] = await Promise.all([
      supabase
        .from("items")
        .select("*, item_tags(tag_id, tags(id, name, color, team_id)), teams(id, name)")
        .in("team_id", teamIds)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("items")
        .select("*", { count: "exact", head: true })
        .in("team_id", teamIds)
        .eq("is_deleted", false),
    ]);
    rawItems = (allItems ?? []) as unknown as ItemWithTeam[];
    totalCount = count ?? 0;
  } else {
    const [{ data: teamItems }, { count }] = await Promise.all([
      supabase
        .from("items")
        .select("*, item_tags(tag_id, tags(id, name, color, team_id))")
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
    rawItems = (teamItems ?? []) as unknown as ItemWithTeam[];
    totalCount = count ?? 0;
  }

  const mappedItems = rawItems.map(({ teams: teamsJoin, item_tags, ...rest }) => ({
    ...rest,
    tags: (item_tags ?? []).map(
      (it) => it.tags
    ),
    teamName: viewAll
      ? (teamsJoin as { id: string; name: string } | null)?.name ?? undefined
      : undefined,
  }));

  return (
    <div className="min-h-screen bg-zinc-50">
      <TeamHeader
        teams={myTeams}
        activeTeam={activeTeam}
        userId={user.id}
        isAllView={viewAll}
      />

      <main className="max-w-3xl mx-auto px-4 py-5 space-y-4">
        {/* 검색 */}
        <SearchBar teamId={viewAll ? "all" : activeTeam.id} />

        {/* 헤더 행 */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">
              {viewAll ? "전체 피드" : "최근 저장 항목"}
            </h2>
            {viewAll && myTeams.length > 1 && (
              <p className="text-xs text-zinc-400 mt-0.5">
                {myTeams.length}개 그룹의 콘텐츠
              </p>
            )}
            {!viewAll && mappedItems.length > 0 && (
              <p className="text-xs text-zinc-400 mt-0.5">
                {mappedItems.length}개
              </p>
            )}
          </div>

          {/* 저장 버튼: 특정 그룹에서만 */}
          {!viewAll && <SaveItemButton teamId={activeTeam.id} />}

          {/* 전체 피드에서는 그룹 선택 안내 */}
          {viewAll && (
            <Link
              href={`/dashboard?team=${myTeams[0].id}`}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              항목 저장
            </Link>
          )}
        </div>

        {/* 피드 */}
        <ItemFeed
          initialItems={mappedItems}
          teamId={viewAll ? "all" : activeTeam.id}
          totalCount={viewAll ? mappedItems.length : totalCount}
        />
      </main>
    </div>
  );
}
