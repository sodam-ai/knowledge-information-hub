import { getDb } from "@/lib/db/sqlite";
import ExploreClient from "./ExploreClient";
import type { PublicGroup, GroupCategory } from "@/types";

interface TeamRow {
  id: string;
  name: string;
  description: string | null;
  category: GroupCategory | null;
  is_public: number;
  created_at: string;
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const db = getDb();

  const params: string[] = [];
  let where = "is_public = 1";
  if (category) {
    where += " AND category = ?";
    params.push(category);
  }

  const rows = db
    .prepare<string[], TeamRow>(
      `SELECT id, name, description, category, is_public, created_at FROM teams
        WHERE ${where} ORDER BY created_at DESC LIMIT 50`
    )
    .all(...params);

  const groups: PublicGroup[] = rows.map((r: TeamRow) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    category: r.category,
    is_public: r.is_public === 1,
    created_at: r.created_at,
    member_count: 1,
    is_joined: true,
  }));

  return (
    <ExploreClient
      initialGroups={groups}
      activeCategory={category ?? ""}
    />
  );
}
