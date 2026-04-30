"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { createLinkSchema, createNoteSchema } from "@/lib/validations";
import { normalizeUrl, sanitizeText, sanitizeImageUrl } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import type { ActionResult, Item, ItemCategory } from "@/types";
import crypto from "crypto";

const MICROLINK_TIMEOUT_MS = 7000;

function isYouTubeUrl(url: string): boolean {
  return /youtube\.com\/(watch|shorts\/)|youtu\.be\//.test(url);
}

async function fetchYouTubeOEmbed(url: string): Promise<{ title: string; thumbnail?: string } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      { signal: controller.signal, cache: "no-store" }
    );
    clearTimeout(timeout);
    if (!res.ok) return null;
    const json = await res.json();
    const title = sanitizeText(json?.title, 500);
    const thumbnail = sanitizeImageUrl(json?.thumbnail_url) ?? undefined;
    if (!title) return null;
    return { title, thumbnail };
  } catch {
    return null;
  }
}

async function fetchLinkTitle(url: string): Promise<{ title: string; thumbnail?: string }> {
  if (isYouTubeUrl(url)) {
    const yt = await fetchYouTubeOEmbed(url);
    if (yt) return yt;
  }

  try {
    const apiUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (process.env.MICROLINK_API_KEY) {
      headers["x-api-key"] = process.env.MICROLINK_API_KEY;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MICROLINK_TIMEOUT_MS);

    const res = await fetch(apiUrl, { headers, signal: controller.signal, cache: "no-store" });
    clearTimeout(timeout);

    if (!res.ok) throw new Error("microlink 응답 오류");

    const json = await res.json();
    const rawTitle = json?.data?.title;
    const rawImage = json?.data?.image?.url ?? json?.data?.screenshot?.url;

    return {
      title: sanitizeText(rawTitle, 500) || url,
      thumbnail: sanitizeImageUrl(rawImage) ?? undefined,
    };
  } catch {
    return { title: url };
  }
}

function detectItemCategory(type: string, url?: string | null): ItemCategory | null {
  if (type === "note") return "idea";
  if (type === "link" && url) {
    const u = url.toLowerCase();
    if (/youtube\.com\/(watch|shorts\/)|youtu\.be|vimeo\.com|twitch\.tv|bilibili\.com/.test(u))
      return "video";
    if (/github\.com|gitlab\.com|npmjs\.com|pypi\.org|hub\.docker\.com|codepen\.io|jsfiddle\.net|codesandbox\.io/.test(u))
      return "code";
    if (/figma\.com|dribbble\.com|behance\.net|unsplash\.com|framer\.com|canva\.com/.test(u))
      return "design";
    if (/amazon\.com|amazon\.co\.kr|coupang\.com|gmarket\.co\.kr|11st\.co\.kr|shopping\.naver|shop\./.test(u))
      return "product";
    if (/techcrunch\.com|theverge\.com|wired\.com|zdnet\.com|ycombinator\.com\/item|hnews\.|hacker-news\.|news\.ycombinator\.com/.test(u))
      return "news";
    if (/vercel\.com|notion\.so|linear\.app|slack\.com|airtable\.com|zapier\.com|make\.com/.test(u))
      return "tool";
    if (/udemy\.com|coursera\.|\/tutorial|\/guide|learn\.|egghead\.io|frontendmasters\.com/.test(u))
      return "tutorial";
    if (/\bdocs\.|\/docs\/|developer\.|\.dev\/|mdn\.web|stackoverflow\.com|devdocs\.io/.test(u))
      return "reference";
    if (u.endsWith(".pdf") || u.includes(".pdf?") || u.includes("/pdf/"))
      return "document";
    return "article";
  }
  return null;
}


export async function createItem(
  teamId: string,
  _: ActionResult<Item>,
  formData: FormData
): Promise<ActionResult<Item>> {
  const supabase = createServiceClient();

  const type = formData.get("type") as string;
  const rawTags = formData.get("tags") as string;
  const tagNames: string[] = rawTags
    ? rawTags.split(",").map((t) => t.trim()).filter(Boolean)
    : [];
  const collectionId = (formData.get("collection_id") as string | null) || null;

  const rawCategory = formData.get("category") as string | null;
  const VALID_CATEGORIES: ItemCategory[] = ["article", "tutorial", "tool", "reference", "document", "idea", "video", "code", "news", "design", "product", "etc"];
  const userCategory: ItemCategory | null =
    rawCategory && VALID_CATEGORIES.includes(rawCategory as ItemCategory)
      ? (rawCategory as ItemCategory)
      : null;

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

    const { data: duplicate } = await supabase
      .from("items")
      .select("id, title")
      .eq("team_id", teamId)
      .eq("url_hash", urlHash)
      .eq("is_deleted", false)
      .maybeSingle();

    const clientOgImage = sanitizeImageUrl(formData.get("og_image") as string | null);

    let finalTitle = manualTitle ?? "";
    let thumbnail: string | undefined = clientOgImage ?? undefined;
    let titleExtractFailed = false;

    if (!finalTitle) {
      const ogResult = await fetchLinkTitle(url);
      finalTitle = ogResult.title;
      if (!thumbnail) thumbnail = ogResult.thumbnail;
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
        created_by: null,
        collection_id: collectionId,
        category: userCategory ?? detectItemCategory("link", url),
        content: (formData.get("content") as string | null)?.trim() || null,
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
      ...(duplicate ? { error: `duplicate:${duplicate.title}` } : {}),
      ...(titleExtractFailed ? { error: "title_failed" } : {}),
    };
  }

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
        created_by: null,
        collection_id: collectionId,
        category: userCategory ?? detectItemCategory("note"),
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
  supabase: ReturnType<typeof createServiceClient>,
  itemId: string,
  teamId: string,
  tagNames: string[]
) {
  if (!tagNames.length) return;

  for (const name of tagNames.slice(0, 10)) {
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
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("items")
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq("id", itemId);

  if (error) return { error: "삭제 중 오류가 발생했습니다." };

  revalidatePath("/dashboard");
  return {};
}

export async function getMoreItems(
  teamId: string,
  offset: number,
  type?: "link" | "note"
): Promise<ActionResult<(Item & { tags: { id: string; name: string; color: string | null }[] })[]>> {
  const supabase = createServiceClient();

  let query = supabase
    .from("items")
    .select("*, item_tags(tag_id, tags(id, name, color, team_id))")
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .range(offset, offset + 19);

  if (teamId !== "all") query = query.eq("team_id", teamId);
  if (type) query = query.eq("type", type);

  const { data, error } = await query;
  if (error) return { error: "불러오기 실패" };

  type TagRow = { id: string; name: string; color: string | null; team_id: string };
  const rawItems = (data ?? []) as unknown as (Item & { item_tags?: { tags: TagRow }[] })[];
  const items = rawItems.map((item) => ({
    ...item,
    tags: (item.item_tags ?? []).map((it: { tags: TagRow }) => it.tags),
  }));

  return { data: items };
}

export async function updateItem(
  itemId: string,
  fields: { title?: string; content?: string; tags?: string; category?: ItemCategory | null }
): Promise<ActionResult> {
  const supabase = createServiceClient();

  const { data: item } = await supabase
    .from("items")
    .select("id, team_id")
    .eq("id", itemId)
    .eq("is_deleted", false)
    .single();

  if (!item) return { error: "항목을 찾을 수 없습니다." };

  const updates: Record<string, string | null> = {};
  if (fields.title !== undefined) {
    const clean = sanitizeText(fields.title.trim(), 500);
    if (!clean || clean.length > 500) return { error: "제목은 1~500자여야 합니다." };
    updates.title = clean;
  }
  if (fields.content !== undefined) {
    updates.content = sanitizeText(fields.content.trim(), 50000);
  }
  if (fields.category !== undefined) {
    updates.category = fields.category ?? null;
  }

  if (Object.keys(updates).length > 0) {
    updates.updated_at = new Date().toISOString();
    const { error: updateErr } = await supabase
      .from("items")
      .update(updates)
      .eq("id", itemId);
    if (updateErr) return { error: "수정 중 오류가 발생했습니다." };
  }

  if (fields.tags !== undefined) {
    const rawTags = fields.tags
      .split(",")
      .map((t) => sanitizeText(t.trim().toLowerCase(), 30))
      .filter((t) => t.length > 0 && t.length <= 30)
      .slice(0, 10);

    await supabase.from("item_tags").delete().eq("item_id", itemId);

    if (rawTags.length > 0) {
      const { data: tagRows } = await supabase
        .from("tags")
        .upsert(
          rawTags.map((name) => ({ name, team_id: item.team_id })),
          { onConflict: "name,team_id", ignoreDuplicates: false }
        )
        .select("id");

      if (tagRows && tagRows.length > 0) {
        await supabase.from("item_tags").insert(
          tagRows.map((t: { id: string }) => ({ item_id: itemId, tag_id: t.id, is_auto: false }))
        );
      }
    }
  }

  revalidatePath("/dashboard");
  return {};
}

export async function togglePinItem(itemId: string): Promise<ActionResult<boolean>> {
  const supabase = createServiceClient();

  const { data: item } = await supabase
    .from("items")
    .select("id, is_pinned")
    .eq("id", itemId)
    .eq("is_deleted", false)
    .single();

  if (!item) return { error: "항목을 찾을 수 없습니다." };

  const newPinned = !item.is_pinned;
  const { error } = await supabase
    .from("items")
    .update({ is_pinned: newPinned, updated_at: new Date().toISOString() })
    .eq("id", itemId);

  if (error) return { error: "핀 처리 중 오류가 발생했습니다." };

  revalidatePath("/dashboard");
  return { data: newPinned };
}

type SearchItem = Item & { tags: { id: string; name: string; color: string | null; team_id: string }[] };
type STagRow = { id: string; name: string; color: string | null; team_id: string };

function normalizeItemRows(data: unknown[]): SearchItem[] {
  const raw = data as (Item & { item_tags?: { tags: STagRow }[] })[];
  return raw.map((item) => ({
    ...item,
    tags: (item.item_tags ?? []).map((it: { tags: STagRow }) => it.tags),
  }));
}

export async function searchItems(
  teamId: string,
  query: string
): Promise<ActionResult<SearchItem[]>> {
  const supabase = createServiceClient();

  // Strip leading # for tag-prefix searches
  const q = query.startsWith("#") ? query.slice(1).trim() : query.trim();

  if (q.length < 1) return { error: "검색어를 입력해주세요." };
  if (q.length > 200) return { error: "검색어가 너무 깁니다." };

  async function fetchTagMatchItems(excludeIds: Set<string>): Promise<SearchItem[]> {
    const { data: matchedTags } = await supabase
      .from("tags")
      .select("id")
      .ilike("name", `%${q}%`)
      .limit(20);
    if (!matchedTags?.length) return [];

    const tagIds = matchedTags.map((t: { id: string }) => t.id);
    const { data: linkRows } = await supabase
      .from("item_tags")
      .select("item_id")
      .in("tag_id", tagIds)
      .limit(50);
    if (!linkRows?.length) return [];

    const newIds = ([...new Set(linkRows.map((r: { item_id: string }) => r.item_id))] as string[])
      .filter((id) => !excludeIds.has(id))
      .slice(0, 10);
    if (!newIds.length) return [];

    let tagQ = supabase
      .from("items")
      .select("*, item_tags(tag_id, tags(id, name, color, team_id))")
      .eq("is_deleted", false)
      .in("id", newIds)
      .order("created_at", { ascending: false });
    if (teamId !== "all") tagQ = tagQ.eq("team_id", teamId);
    const { data } = await tagQ;
    return normalizeItemRows(data ?? []);
  }

  if (teamId === "all" || q.length < 2) {
    let dbQ = supabase
      .from("items")
      .select("*, item_tags(tag_id, tags(id, name, color, team_id))")
      .eq("is_deleted", false)
      .or(`title.ilike.%${q}%,content.ilike.%${q}%,url.ilike.%${q}%`)
      .order("created_at", { ascending: false })
      .limit(20);
    if (teamId !== "all") dbQ = dbQ.eq("team_id", teamId);

    const { data, error } = await dbQ;
    if (error) {
      console.error("[searchItems:ilike] 오류:", error.code);
      return { error: "검색 중 오류가 발생했습니다." };
    }

    const textItems = normalizeItemRows(data ?? []);
    const textIds = new Set(textItems.map((i) => i.id));
    const tagItems = await fetchTagMatchItems(textIds);
    return { data: [...textItems, ...tagItems] };
  }

  // 2자 이상, 특정 팀: pg_trgm similarity RPC
  const { data, error } = await supabase.rpc("search_items", {
    p_team_id: teamId,
    p_query: q,
  });

  if (error) {
    console.error("[searchItems] RPC 오류:", error.code);
    return { error: "검색 중 오류가 발생했습니다." };
  }

  const rpcItems = (data ?? []) as SearchItem[];
  const rpcIds = new Set(rpcItems.map((i) => i.id));
  const tagItems = await fetchTagMatchItems(rpcIds);
  return { data: [...rpcItems, ...tagItems] };
}
