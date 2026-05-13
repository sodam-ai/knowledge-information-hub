"use server";

import { getDb, newId } from "@/lib/db/sqlite";
import { createLinkSchema, createNoteSchema } from "@/lib/validations";
import { normalizeUrl, sanitizeText, sanitizeImageUrl } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import type { ActionResult, Item, ItemCategory, Tag } from "@/types";
import crypto from "crypto";

// ───────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────

interface ItemRow {
  id: string;
  type: Item["type"];
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
}

function hydrateItem(row: ItemRow): Item {
  return {
    ...row,
    is_pinned: row.is_pinned === 1,
    is_deleted: row.is_deleted === 1,
  };
}

type SearchItem = Item & { tags: Tag[] };

function attachTagsToItems(itemRows: ItemRow[]): SearchItem[] {
  if (itemRows.length === 0) return [];
  const db = getDb();
  const ids = itemRows.map((r: ItemRow) => r.id);
  const placeholders = ids.map(() => "?").join(",");
  const tagRows = db
    .prepare<string[], { item_id: string; id: string; name: string; color: string | null; team_id: string }>(
      `SELECT it.item_id, t.id, t.name, t.color, t.team_id
         FROM item_tags it
         JOIN tags t ON t.id = it.tag_id
        WHERE it.item_id IN (${placeholders})`
    )
    .all(...ids);

  const tagsByItem = new Map<string, Tag[]>();
  for (const r of tagRows) {
    const list = tagsByItem.get(r.item_id) ?? [];
    list.push({ id: r.id, name: r.name, color: r.color, team_id: r.team_id });
    tagsByItem.set(r.item_id, list);
  }

  return itemRows.map((row) => ({
    ...hydrateItem(row),
    tags: tagsByItem.get(row.id) ?? [],
  }));
}

function isYouTubeUrl(url: string): boolean {
  return /youtube\.com\/(watch|shorts\/)|youtu\.be\//.test(url);
}

async function fetchYouTubeOEmbed(
  url: string
): Promise<{ title: string; thumbnail?: string } | null> {
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

// 클라이언트가 /api/og 라우트로 OG 메타를 받아 폼에 og_image/title을 채워 보냄.
// 서버 액션은 그 값을 사용. 클라이언트가 비워 보낸 경우 YouTube만 추가 시도, 그 외엔 URL 그대로 제목.
async function fetchLinkTitle(url: string): Promise<{ title: string; thumbnail?: string }> {
  if (isYouTubeUrl(url)) {
    const yt = await fetchYouTubeOEmbed(url);
    if (yt) return yt;
  }
  return { title: url };
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

function attachTags(itemId: string, teamId: string, tagNames: string[]): void {
  if (!tagNames.length) return;
  const db = getDb();
  const upsertTag = db.prepare(
    `INSERT INTO tags (id, name, team_id) VALUES (?, ?, ?)
     ON CONFLICT(name, team_id) DO UPDATE SET name = excluded.name
     RETURNING id`
  );
  const linkTag = db.prepare(
    `INSERT OR IGNORE INTO item_tags (item_id, tag_id, is_auto) VALUES (?, ?, 0)`
  );

  const insert = db.transaction((names: string[]) => {
    for (const name of names.slice(0, 10)) {
      const clean = sanitizeText(name.trim().toLowerCase(), 30);
      if (!clean) continue;
      const row = upsertTag.get(newId(), clean, teamId) as { id: string } | undefined;
      if (row?.id) linkTag.run(itemId, row.id);
    }
  });
  insert(tagNames);
}

// ───────────────────────────────────────────────────────────
// createItem
// ───────────────────────────────────────────────────────────
export async function createItem(
  teamId: string,
  _: ActionResult<Item>,
  formData: FormData
): Promise<ActionResult<Item>> {
  const db = getDb();
  const type = formData.get("type") as string;
  const rawTags = formData.get("tags") as string;
  const tagNames: string[] = rawTags
    ? rawTags.split(",").map((t) => t.trim()).filter(Boolean)
    : [];
  const collectionId = (formData.get("collection_id") as string | null) || null;

  const rawCategory = formData.get("category") as string | null;
  const VALID_CATEGORIES: ItemCategory[] = [
    "article", "tutorial", "tool", "reference", "document",
    "idea", "video", "code", "news", "design", "product", "etc",
  ];
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

    const duplicate = db
      .prepare<[string, string], { id: string; title: string }>(
        "SELECT id, title FROM items WHERE team_id = ? AND url_hash = ? AND is_deleted = 0 LIMIT 1"
      )
      .get(teamId, urlHash);

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

    const id = newId();
    try {
      db.prepare(
        `INSERT INTO items (id, type, title, url, url_hash, thumbnail_url, team_id, created_by, collection_id, category, content)
         VALUES (?, 'link', ?, ?, ?, ?, ?, NULL, ?, ?, ?)`
      ).run(
        id,
        finalTitle,
        url,
        urlHash,
        thumbnail ?? null,
        teamId,
        collectionId,
        userCategory ?? detectItemCategory("link", url),
        (formData.get("content") as string | null)?.trim() || null
      );
    } catch (err) {
      console.error("[createItem link] DB 오류:", err instanceof Error ? err.message : err);
      return { error: "저장 중 오류가 발생했습니다." };
    }

    attachTags(id, teamId, tagNames);
    const row = db.prepare<[string], ItemRow>("SELECT * FROM items WHERE id = ?").get(id);
    revalidatePath("/dashboard");

    const item = hydrateItem(row!);
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

    const id = newId();
    try {
      db.prepare(
        `INSERT INTO items (id, type, title, content, team_id, created_by, collection_id, category)
         VALUES (?, 'note', ?, ?, ?, NULL, ?, ?)`
      ).run(
        id,
        parsed.data.title,
        parsed.data.content,
        teamId,
        collectionId,
        userCategory ?? detectItemCategory("note")
      );
    } catch {
      return { error: "저장 중 오류가 발생했습니다." };
    }

    attachTags(id, teamId, tagNames);
    const row = db.prepare<[string], ItemRow>("SELECT * FROM items WHERE id = ?").get(id);
    revalidatePath("/dashboard");
    return { data: hydrateItem(row!) };
  }

  return { error: "지원하지 않는 콘텐츠 유형입니다." };
}

// ───────────────────────────────────────────────────────────
// softDeleteItem
// ───────────────────────────────────────────────────────────
export async function softDeleteItem(itemId: string): Promise<ActionResult> {
  try {
    const db = getDb();
    db.prepare(
      "UPDATE items SET is_deleted = 1, deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?"
    ).run(itemId);
    revalidatePath("/dashboard");
    return {};
  } catch {
    return { error: "삭제 중 오류가 발생했습니다." };
  }
}

// ───────────────────────────────────────────────────────────
// getMoreItems
// ───────────────────────────────────────────────────────────
export async function getMoreItems(
  teamId: string,
  offset: number,
  type?: "link" | "note"
): Promise<ActionResult<SearchItem[]>> {
  try {
    const db = getDb();
    const conds = ["is_deleted = 0"];
    const params: (string | number)[] = [];
    if (teamId !== "all") {
      conds.push("team_id = ?");
      params.push(teamId);
    }
    if (type) {
      conds.push("type = ?");
      params.push(type);
    }
    const sql = `SELECT * FROM items WHERE ${conds.join(" AND ")} ORDER BY created_at DESC LIMIT 20 OFFSET ?`;
    params.push(offset);
    const rows = db.prepare<typeof params, ItemRow>(sql).all(...params);
    return { data: attachTagsToItems(rows) };
  } catch {
    return { error: "불러오기 실패" };
  }
}

// ───────────────────────────────────────────────────────────
// updateItem
// ───────────────────────────────────────────────────────────
export async function updateItem(
  itemId: string,
  fields: { title?: string; content?: string; tags?: string; category?: ItemCategory | null }
): Promise<ActionResult> {
  const db = getDb();
  const item = db
    .prepare<[string], { id: string; team_id: string }>(
      "SELECT id, team_id FROM items WHERE id = ? AND is_deleted = 0 LIMIT 1"
    )
    .get(itemId);
  if (!item) return { error: "항목을 찾을 수 없습니다." };

  const updates: { col: string; val: string | null }[] = [];
  if (fields.title !== undefined) {
    const clean = sanitizeText(fields.title.trim(), 500);
    if (!clean || clean.length > 500) return { error: "제목은 1~500자여야 합니다." };
    updates.push({ col: "title", val: clean });
  }
  if (fields.content !== undefined) {
    updates.push({ col: "content", val: sanitizeText(fields.content.trim(), 50000) || null });
  }
  if (fields.category !== undefined) {
    updates.push({ col: "category", val: fields.category ?? null });
  }

  try {
    if (updates.length > 0) {
      const setClause = updates.map((u) => `${u.col} = ?`).join(", ");
      const sql = `UPDATE items SET ${setClause} WHERE id = ?`;
      db.prepare(sql).run(...updates.map((u) => u.val), itemId);
    }

    if (fields.tags !== undefined) {
      const rawTags = fields.tags
        .split(",")
        .map((t) => sanitizeText(t.trim().toLowerCase(), 30))
        .filter((t) => t.length > 0 && t.length <= 30)
        .slice(0, 10);

      db.prepare("DELETE FROM item_tags WHERE item_id = ?").run(itemId);
      if (rawTags.length > 0) attachTags(itemId, item.team_id, rawTags);
    }
  } catch {
    return { error: "수정 중 오류가 발생했습니다." };
  }

  revalidatePath("/dashboard");
  return {};
}

// ───────────────────────────────────────────────────────────
// togglePinItem
// ───────────────────────────────────────────────────────────
export async function togglePinItem(itemId: string): Promise<ActionResult<boolean>> {
  const db = getDb();
  const row = db
    .prepare<[string], { is_pinned: number }>(
      "SELECT is_pinned FROM items WHERE id = ? AND is_deleted = 0"
    )
    .get(itemId);
  if (!row) return { error: "항목을 찾을 수 없습니다." };

  const newPinned = row.is_pinned === 1 ? 0 : 1;
  try {
    db.prepare("UPDATE items SET is_pinned = ? WHERE id = ?").run(newPinned, itemId);
  } catch {
    return { error: "핀 처리 중 오류가 발생했습니다." };
  }

  revalidatePath("/dashboard");
  return { data: newPinned === 1 };
}

// ───────────────────────────────────────────────────────────
// searchItems (FTS5 2자+ / LIKE 1자 / tag 보강)
// ───────────────────────────────────────────────────────────
function escapeFts(q: string): string {
  // FTS5 phrase 매칭: 큰따옴표 escape 후 감싸기 — 사용자 입력의 연산자 무력화
  return `"${q.replace(/"/g, '""')}"`;
}

export async function searchItems(
  teamId: string,
  query: string
): Promise<ActionResult<SearchItem[]>> {
  const db = getDb();
  const q = query.startsWith("#") ? query.slice(1).trim() : query.trim();
  if (q.length < 1) return { error: "검색어를 입력해주세요." };
  if (q.length > 200) return { error: "검색어가 너무 깁니다." };

  try {
    let textRows: ItemRow[];

    if (q.length < 2) {
      // 1자 검색은 FTS5 토크나이저가 단일 글자 토큰을 인덱싱 안 함 — LIKE 직접 매칭
      const conds = ["is_deleted = 0", "(title LIKE ? OR content LIKE ? OR url LIKE ?)"];
      const params: (string | number)[] = [`%${q}%`, `%${q}%`, `%${q}%`];
      if (teamId !== "all") {
        conds.push("team_id = ?");
        params.push(teamId);
      }
      textRows = db
        .prepare<typeof params, ItemRow>(
          `SELECT * FROM items WHERE ${conds.join(" AND ")} ORDER BY created_at DESC LIMIT 20`
        )
        .all(...params);
    } else {
      // 2자+: FTS5 unicode61 토크나이저 + phrase 매칭
      const conds = ["i.is_deleted = 0", "items_fts MATCH ?"];
      const params: (string | number)[] = [escapeFts(q)];
      if (teamId !== "all") {
        conds.push("i.team_id = ?");
        params.push(teamId);
      }
      textRows = db
        .prepare<typeof params, ItemRow>(
          `SELECT i.* FROM items i JOIN items_fts ON items_fts.item_id = i.id
            WHERE ${conds.join(" AND ")} ORDER BY rank LIMIT 20`
        )
        .all(...params);
    }

    const textItems = attachTagsToItems(textRows);
    const textIds = new Set(textItems.map((i) => i.id));

    // 태그명 매칭으로 추가 결과 보강
    const tagRows = db
      .prepare<[string], { id: string }>(
        "SELECT id FROM tags WHERE name LIKE ? LIMIT 20"
      )
      .all(`%${q.toLowerCase()}%`);
    if (tagRows.length === 0) return { data: textItems };

    const tagIds = tagRows.map((r: { id: string }) => r.id);
    const tagPlaceholders = tagIds.map(() => "?").join(",");
    const linkRows = db
      .prepare<string[], { item_id: string }>(
        `SELECT DISTINCT item_id FROM item_tags WHERE tag_id IN (${tagPlaceholders}) LIMIT 50`
      )
      .all(...tagIds);

    const tagItemIds = linkRows
      .map((r: { item_id: string }) => r.item_id)
      .filter((id: string) => !textIds.has(id))
      .slice(0, 10);
    if (tagItemIds.length === 0) return { data: textItems };

    const placeholders = tagItemIds.map(() => "?").join(",");
    const tagItemConds = [`id IN (${placeholders})`, "is_deleted = 0"];
    const tagItemParams: string[] = [...tagItemIds];
    if (teamId !== "all") {
      tagItemConds.push("team_id = ?");
      tagItemParams.push(teamId);
    }
    const tagItemRows = db
      .prepare<typeof tagItemParams, ItemRow>(
        `SELECT * FROM items WHERE ${tagItemConds.join(" AND ")} ORDER BY created_at DESC`
      )
      .all(...tagItemParams);

    const tagItems = attachTagsToItems(tagItemRows);
    return { data: [...textItems, ...tagItems] };
  } catch (err) {
    console.error("[searchItems] 오류:", err instanceof Error ? err.message : err);
    return { error: "검색 중 오류가 발생했습니다." };
  }
}
