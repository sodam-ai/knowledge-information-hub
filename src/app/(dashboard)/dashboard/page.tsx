import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
import ItemFeed from "@/components/items/ItemFeed";
import SaveItemButton from "@/components/items/SaveItemButton";
import SearchBar from "@/components/items/SearchBar";
import TeamHeader from "@/components/layout/TeamHeader";
import type { Team, ItemType, ItemCategory } from "@/types";

export default async function DashboardPage() {
  const db = createServiceClient();

  const { data: teamsData } = await db
    .from("teams")
    .select("*")
    .order("created_at", { ascending: true });

  let allTeams = (teamsData ?? []) as Team[];

  // 팀이 없으면 기본 워크스페이스를 자동 생성
  if (allTeams.length === 0) {
    const inviteCode = crypto.randomBytes(10).toString("hex").toUpperCase().slice(0, 20);
    const expires = new Date(Date.now() + 10 * 365 * 24 * 3600 * 1000).toISOString();
    await db.from("teams").insert({
      name: "Knowledge Information Hub",
      is_public: false,
      invite_code: inviteCode,
      invite_expires_at: expires,
    });
    const { data: refreshed } = await db
      .from("teams")
      .select("*")
      .order("created_at", { ascending: true });
    allTeams = (refreshed ?? []) as Team[];
  }

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
    category: ItemCategory | null;
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

  const [{ data: allItems }, { count }] = await Promise.all([
    db
      .from("items")
      .select("*, item_tags(tag_id, tags(id, name, color, team_id)), teams(id, name)")
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(50),
    db
      .from("items")
      .select("*", { count: "exact", head: true })
      .eq("is_deleted", false),
  ]);

  const rawItems = (allItems ?? []) as unknown as ItemWithTeam[];
  const totalCount = count ?? 0;

  const mappedItems = rawItems.map(({ teams: teamsJoin, item_tags, ...rest }) => ({
    ...rest,
    tags: (item_tags ?? []).map((it) => it.tags),
    teamName: (teamsJoin as { id: string; name: string } | null)?.name ?? undefined,
  }));

  return (
    <div className="min-h-screen bg-zinc-50">
      <TeamHeader />

      <main className="max-w-5xl mx-auto px-4 py-5 space-y-4">
        <SearchBar teamId="all" />

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">전체 피드</h2>
            {totalCount > 0 && (
              <p className="text-xs text-zinc-400 mt-0.5">{totalCount}개 항목</p>
            )}
          </div>
          <SaveItemButton teamId={allTeams[0].id} />
        </div>

        <ItemFeed
          key="all"
          initialItems={mappedItems}
          teamId="all"
          totalCount={mappedItems.length}
          collections={[]}
        />
      </main>
    </div>
  );
}
