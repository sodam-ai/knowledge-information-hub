"use server";

import { getDb, newId } from "@/lib/db/sqlite";
import { revalidatePath } from "next/cache";
import type { ActionResult, Collection } from "@/types";

export async function getCollections(teamId: string): Promise<ActionResult<Collection[]>> {
  if (!teamId) return { data: [] };
  try {
    const db = getDb();
    const rows = db
      .prepare<[string], Collection>(
        "SELECT * FROM collections WHERE team_id = ? ORDER BY created_at ASC"
      )
      .all(teamId);
    return { data: rows };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "조회 실패" };
  }
}

export async function createCollection(
  teamId: string,
  name: string
): Promise<ActionResult<Collection>> {
  if (!name || !name.trim()) return { error: "이름을 입력하세요." };
  const trimmed = name.trim();
  if (trimmed.length > 50) return { error: "50자 이내로 입력하세요." };

  const db = getDb();
  const id = newId();

  try {
    db.prepare(
      "INSERT INTO collections (id, name, team_id) VALUES (?, ?, ?)"
    ).run(id, trimmed, teamId);

    const row = db
      .prepare<[string], Collection>("SELECT * FROM collections WHERE id = ?")
      .get(id);

    revalidatePath("/dashboard");
    return { data: row! };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("UNIQUE")) {
      return { error: "이미 같은 이름의 컬렉션이 있습니다." };
    }
    return { error: "컬렉션 생성 중 오류가 발생했습니다." };
  }
}

export async function deleteCollection(collectionId: string): Promise<ActionResult> {
  try {
    const db = getDb();
    db.prepare("DELETE FROM collections WHERE id = ?").run(collectionId);
    revalidatePath("/dashboard");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "삭제 실패" };
  }
}

export async function moveItemToCollection(
  itemId: string,
  collectionId: string | null
): Promise<ActionResult> {
  try {
    const db = getDb();
    db.prepare("UPDATE items SET collection_id = ? WHERE id = ?").run(collectionId, itemId);
    revalidatePath("/dashboard");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "이동 실패" };
  }
}
