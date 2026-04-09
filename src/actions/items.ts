"use server";

import { createClient } from "@/lib/supabase/server";
import { createLinkSchema, createNoteSchema } from "@/lib/validations";
import { normalizeUrl, sanitizeText, sanitizeImageUrl } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import type { ActionResult, Item } from "@/types";
import crypto from "crypto";

const MICROLINK_TIMEOUT_MS = 3000;

async function fetchLinkTitle(url: string): Promise<{ title: string; thumbnail?: string }> {
  try {
    const apiUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (process.env.MICROLINK_API_KEY) {
      headers["x-api-key"] = process.env.MICROLINK_API_KEY;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MICROLINK_TIMEOUT_MS);

    const res = await fetch(apiUrl, { headers, signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) throw new Error("microlink 응답 오류");

    const json = await res.json();
    const rawTitle = json?.data?.title;
    const rawImage = json?.data?.image?.url ?? json?.data?.screenshot?.url;

    return {
      // 위생 처리: HTML 태그 제거, 500자 절단
      title: sanitizeText(rawTitle, 500) || url,
      thumbnail: sanitizeImageUrl(rawImage) ?? undefined,
    };
  } catch {
    // microlink 장애 시 폴백: URL을 임시 제목으로 저장
    return { title: url };
  }
}

export async function createItem(
  teamId: string,
  _: ActionResult<Item>,
  formData: FormData
): Promise<ActionResult<Item>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const type = formData.get("type") as string;
  const rawTags = formData.get("tags") as string;
  const tagNames: string[] = rawTags
    ? rawTags.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  // 링크 처리
  if (type === "link") {
    const parsed = createLinkSchema.safeParse({
      type: "link",
      url: formData.get("url"),
      title: formData.get("title") || undefined,
      tags: tagNames,
    });
    if (!parsed.success) return { error: parsed.error.errors[0].message };

    const { url, title: manualTitle } = parsed.data;
    const normalizedUrl = normalizeUrl(url);
    const urlHash = crypto.createHash("sha256").update(normalizedUrl).digest("hex");

    // URL 중복 감지 (경고 토스트용 — 차단 아님)
    const { data: duplicate } = await supabase
      .from("items")
      .select("id, title")
      .eq("team_id", teamId)
      .eq("url_hash", urlHash)
      .eq("is_deleted", false)
      .maybeSingle();

    // microlink.io 제목 자동 추출 (manualTitle 없을 때만)
    let finalTitle = manualTitle ?? "";
    let thumbnail: string | undefined;
    let titleExtractFailed = false;

    if (!finalTitle) {
      const result = await fetchLinkTitle(url);
      finalTitle = result.title;
      thumbnail = result.thumbnail;
      // URL 그대로 반환됐다면 추출 실패
      if (finalTitle === url) titleExtractFailed = true;
    }

    const { data: item, error } = await supabase
      .from("items")
      .insert({
        type: "link",
        title: finalTitle,
        url,
        url_hash: urlHash,
        thumbnail_url: thumbnail ?? null,
        team_id: teamId,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error("[createItem link] DB 오류:", error.code);
      return { error: "저장 중 오류가 발생했습니다." };
    }

    await attachTags(supabase, item.id, teamId, tagNames);
    revalidatePath("/dashboard");

    return {
      data: item,
      // 중복 / 제목 추출 실패 정보를 함께 전달
      ...(duplicate ? { error: `duplicate:${duplicate.title}` } : {}),
      ...(titleExtractFailed ? { error: "title_failed" } : {}),
    };
  }

  // 노트 처리
  if (type === "note") {
    const parsed = createNoteSchema.safeParse({
      type: "note",
      title: formData.get("title"),
      content: formData.get("content"),
      tags: tagNames,
    });
    if (!parsed.success) return { error: parsed.error.errors[0].message };

    const { data: item, error } = await supabase
      .from("items")
      .insert({
        type: "note",
        title: parsed.data.title,
        content: parsed.data.content,
        team_id: teamId,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) return { error: "저장 중 오류가 발생했습니다." };

    await attachTags(supabase, item.id, teamId, tagNames);
    revalidatePath("/dashboard");
    return { data: item };
  }

  return { error: "지원하지 않는 콘텐츠 유형입니다." };
}

async function attachTags(
  supabase: Awaited<ReturnType<typeof createClient>>,
  itemId: string,
  teamId: string,
  tagNames: string[]
) {
  if (!tagNames.length) return;

  for (const name of tagNames.slice(0, 10)) {
    // upsert 태그
    const { data: tag } = await supabase
      .from("tags")
      .upsert({ name, team_id: teamId }, { onConflict: "name,team_id" })
      .select()
      .single();

    if (tag) {
      await supabase
        .from("item_tags")
        .upsert({ item_id: itemId, tag_id: tag.id }, { onConflict: "item_id,tag_id" });
    }
  }
}

export async function softDeleteItem(itemId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { error } = await supabase
    .from("items")
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq("id", itemId);
  // RLS 정책이 본인 or admin 검증

  if (error) return { error: "삭제 중 오류가 발생했습니다." };

  revalidatePath("/dashboard");
  return {};
}

export async function getMoreItems(
  teamId: string,
  offset: number,
  type?: "link" | "note"
): Promise<ActionResult<(Item & { tags: { id: string; name: string; color: string | null }[] })[]>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { data: membership } = await supabase
    .from("user_teams")
    .select("team_id")
    .eq("user_id", user.id)
    .eq("team_id", teamId)
    .is("left_at", null)
    .single();

  if (!membership) return { error: "접근 권한이 없습니다." };

  let query = supabase
    .from("items")
    .select("*, item_tags(tag_id, tags(id, name, color))")
    .eq("team_id", teamId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .range(offset, offset + 19);

  if (type) query = query.eq("type", type);

  const { data, error } = await query;
  if (error) return { error: "불러오기 실패" };

  const items = (data ?? []).map((item) => ({
    ...item,
    tags: (item.item_tags ?? []).map(
      (it: { tags: { id: string; name: string; color: string | null } }) => it.tags
    ),
  }));

  return { data: items };
}

export async function updateItem(
  itemId: string,
  fields: { title?: string; content?: string; tags?: string }
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  // 소유권 확인
  const { data: item } = await supabase
    .from("items")
    .select("id, team_id, created_by")
    .eq("id", itemId)
    .eq("is_deleted", false)
    .single();

  if (!item) return { error: "항목을 찾을 수 없습니다." };

  // 그룹 멤버인지 확인
  const { data: membership } = await supabase
    .from("user_teams")
    .select("role")
    .eq("user_id", user.id)
    .eq("team_id", item.team_id)
    .is("left_at", null)
    .single();

  if (!membership) return { error: "접근 권한이 없습니다." };

  // 작성자 본인 또는 운영자만 수정 가능
  if (item.created_by !== user.id && membership.role !== "admin") {
    return { error: "수정 권한이 없습니다." };
  }

  const updates: Record<string, string> = {};
  if (fields.title !== undefined) {
    const clean = sanitizeText(fields.title.trim(), 500);
    if (!clean || clean.length > 500) return { error: "제목은 1~500자여야 합니다." };
    updates.title = clean;
  }
  if (fields.content !== undefined) {
    updates.content = sanitizeText(fields.content.trim(), 50000);
  }

  if (Object.keys(updates).length > 0) {
    updates.updated_at = new Date().toISOString();
    const { error: updateErr } = await supabase
      .from("items")
      .update(updates)
      .eq("id", itemId);
    if (updateErr) return { error: "수정 중 오류가 발생했습니다." };
  }

  // 태그 업데이트
  if (fields.tags !== undefined) {
    const rawTags = fields.tags
      .split(",")
      .map((t) => sanitizeText(t.trim().toLowerCase(), 30))
      .filter((t) => t.length > 0 && t.length <= 30)
      .slice(0, 10);

    // 기존 태그 연결 삭제
    await supabase.from("item_tags").delete().eq("item_id", itemId);

    if (rawTags.length > 0) {
      // 태그 upsert
      const { data: tagRows } = await supabase
        .from("tags")
        .upsert(
          rawTags.map((name) => ({ name, team_id: item.team_id })),
          { onConflict: "name,team_id", ignoreDuplicates: false }
        )
        .select("id");

      if (tagRows && tagRows.length > 0) {
        await supabase.from("item_tags").insert(
          tagRows.map((t) => ({ item_id: itemId, tag_id: t.id, is_auto: false }))
        );
      }
    }
  }

  revalidatePath("/dashboard");
  return {};
}

export async function togglePinItem(itemId: string): Promise<ActionResult<boolean>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { data: item } = await supabase
    .from("items")
    .select("id, team_id, is_pinned, created_by")
    .eq("id", itemId)
    .eq("is_deleted", false)
    .single();

  if (!item) return { error: "항목을 찾을 수 없습니다." };

  const { data: membership } = await supabase
    .from("user_teams")
    .select("role")
    .eq("user_id", user.id)
    .eq("team_id", item.team_id)
    .is("left_at", null)
    .single();

  if (!membership) return { error: "접근 권한이 없습니다." };
  if (item.created_by !== user.id && membership.role !== "admin") {
    return { error: "핀 권한이 없습니다." };
  }

  const newPinned = !item.is_pinned;
  const { error } = await supabase
    .from("items")
    .update({ is_pinned: newPinned, updated_at: new Date().toISOString() })
    .eq("id", itemId);

  if (error) return { error: "핀 처리 중 오류가 발생했습니다." };

  revalidatePath("/dashboard");
  return { data: newPinned };
}

export async function searchItems(
  teamId: string,
  query: string
): Promise<ActionResult<Item[]>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  if (query.length < 2) return { error: "검색어는 2자 이상 입력해주세요." };
  if (query.length > 200) return { error: "검색어가 너무 깁니다." };

  // pg_trgm similarity 검색 + tsvector 검색 병행
  const { data, error } = await supabase.rpc("search_items", {
    p_team_id: teamId,
    p_query: query,
  });

  if (error) {
    console.error("[searchItems] RPC 오류:", error.code);
    return { error: "검색 중 오류가 발생했습니다." };
  }

  return { data: data ?? [] };
}
