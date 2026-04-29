"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ActionResult, Collection } from "@/types";

export async function getCollections(teamId: string): Promise<ActionResult<Collection[]>> {
  if (!teamId) return { data: [] };
  const db = createServiceClient();
  const { data, error } = await db
    .from("collections")
    .select("*")
    .eq("team_id", teamId)
    .order("created_at", { ascending: true });
  if (error) return { error: error.message };
  return { data: (data ?? []) as Collection[] };
}

export async function createCollection(
  teamId: string,
  name: string
): Promise<ActionResult<Collection>> {
  if (!name || !name.trim()) return { error: "이름을 입력하세요." };
  if (name.trim().length > 50) return { error: "50자 이내로 입력하세요." };
  const db = createServiceClient();
  const { data, error } = await db
    .from("collections")
    .insert({ name: name.trim(), team_id: teamId })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") return { error: "이미 같은 이름의 컬렉션이 있습니다." };
    return { error: error.message };
  }
  revalidatePath("/dashboard");
  return { data: data as Collection };
}

export async function deleteCollection(collectionId: string): Promise<ActionResult> {
  const db = createServiceClient();
  const { error } = await db.from("collections").delete().eq("id", collectionId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return {};
}

export async function moveItemToCollection(
  itemId: string,
  collectionId: string | null
): Promise<ActionResult> {
  const db = createServiceClient();
  const { error } = await db
    .from("items")
    .update({ collection_id: collectionId, updated_at: new Date().toISOString() })
    .eq("id", itemId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return {};
}
