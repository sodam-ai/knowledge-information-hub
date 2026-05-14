import crypto from "crypto";
import { getDb, newId } from "@/lib/db/sqlite";

// 매 요청마다 SQLite 실시간 조회 — 정적 prerender 방지
export const dynamic = "force-dynamic";
import ItemFeed from "@/components/items/ItemFeed";
import SaveItemButton from "@/components/items/SaveItemButton";
import SearchBar from "@/components/items/SearchBar";
import TeamHeader from "@/components/layout/TeamHeader";
import type { Team, ItemType, ItemCategory, Tag } from "@/types";

interface TeamRow {
  id: string;
  name: string;
  invite_code: string;
  invite_expires_at: string;
  is_public: number;
  description: string | null;
  category: string | null;
  created_at: string;
}

interface ItemRowJoined {
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
  is_pinned: number;
  view_count: number;
  team_id: string;
  created_by: string | null;
  is_deleted: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  team_name: string | null;
}

interface TagJoinRow {
  item_id: string;
  id: string;
  name: string;
  color: string | null;
  team_id: string;
}

export default async function DashboardPage() {
  const db = getDb();

  let allTeams = db
    .prepare<[], TeamRow>("SELECT * FROM teams ORDER BY created_at ASC")
    .all();

  if (allTeams.length === 0) {
    const inviteCode = crypto.randomBytes(10).toString("hex").toUpperCase().slice(0, 20);
    const expires = new Date(Date.now() + 10 * 365 * 24 * 3600 * 1000).toISOString();
    db.prepare(
      `INSERT INTO teams (id, name, is_public, invite_code, invite_expires_at)
       VALUES (?, ?, 0, ?, ?)`
    ).run(newId(), "Knowledge Information Hub", inviteCode, expires);
    allTeams = db
      .prepare<[], TeamRow>("SELECT * FROM teams ORDER BY created_at ASC")
      .all();
  }

  const rawItems = db
    .prepare<[], ItemRowJoined>(
      `SELECT i.*, t.name AS team_name
         FROM items i
         LEFT JOIN teams t ON t.id = i.team_id
        WHERE i.is_deleted = 0
        ORDER BY i.created_at DESC
        LIMIT 50`
    )
    .all();

  const totalRow = db
    .prepare<[], { c: number }>(
      "SELECT count(*) AS c FROM items WHERE is_deleted = 0"
    )
    .get();
  const totalCount = totalRow?.c ?? 0;

  const itemIds = rawItems.map((i: ItemRowJoined) => i.id);
  const tagsByItem = new Map<string, Tag[]>();
  if (itemIds.length > 0) {
    const placeholders = itemIds.map(() => "?").join(",");
    const tagRows = db
      .prepare<string[], TagJoinRow>(
        `SELECT it.item_id, t.id, t.name, t.color, t.team_id
           FROM item_tags it
           JOIN tags t ON t.id = it.tag_id
          WHERE it.item_id IN (${placeholders})`
      )
      .all(...itemIds);

    for (const r of tagRows) {
      const list = tagsByItem.get(r.item_id) ?? [];
      list.push({ id: r.id, name: r.name, color: r.color, team_id: r.team_id });
      tagsByItem.set(r.item_id, list);
    }
  }

  const mappedItems = rawItems.map(({ team_name, ...rest }: ItemRowJoined) => ({
    ...rest,
    is_pinned: rest.is_pinned === 1,
    is_deleted: rest.is_deleted === 1,
    tags: tagsByItem.get(rest.id) ?? [],
    teamName: team_name ?? undefined,
  }));

  const teamsArr = allTeams.map((t: TeamRow) => ({ ...t, is_public: t.is_public === 1 })) as Team[];

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
          <SaveItemButton teamId={teamsArr[0].id} />
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
