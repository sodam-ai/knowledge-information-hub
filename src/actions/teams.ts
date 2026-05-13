"use server";

import { getDb, newId } from "@/lib/db/sqlite";
import { createTeamSchema } from "@/lib/validations";
import { revalidatePath } from "next/cache";
import type { ActionResult, Team, PublicGroup, GroupCategory } from "@/types";
import crypto from "crypto";

// ───────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────

interface TeamRow {
  id: string;
  name: string;
  invite_code: string;
  invite_expires_at: string;
  is_public: number;
  description: string | null;
  category: GroupCategory | null;
  created_at: string;
}

function hydrateTeam(row: TeamRow): Team {
  return {
    ...row,
    is_public: row.is_public === 1,
  };
}

function generateInviteCode(): string {
  return crypto.randomBytes(15).toString("base64url").slice(0, 20).toUpperCase();
}

// ───────────────────────────────────────────────────────────
// createTeamNoAuth — 새 워크스페이스 생성 + 샘플 콘텐츠 3개
// ───────────────────────────────────────────────────────────
export async function createTeamNoAuth(
  _: ActionResult<Team>,
  formData: FormData
): Promise<ActionResult<Team>> {
  const parsed = createTeamSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    category: formData.get("category") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const inviteCode = generateInviteCode();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 72);
  const teamId = newId();

  try {
    const db = getDb();
    db.prepare(
      `INSERT INTO teams (id, name, description, category, is_public, invite_code, invite_expires_at)
       VALUES (?, ?, ?, ?, 1, ?, ?)`
    ).run(
      teamId,
      parsed.data.name,
      parsed.data.description ?? null,
      parsed.data.category ?? null,
      inviteCode,
      expiresAt.toISOString()
    );

    const sampleStmt = db.prepare(
      `INSERT INTO items (id, type, title, content, url, url_hash, team_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`
    );
    const githubHash = crypto.createHash("sha256").update("https://github.com").digest("hex");

    sampleStmt.run(
      newId(),
      "link",
      "지식 그룹 시작 가이드",
      null,
      "https://github.com",
      githubHash,
      teamId
    );
    sampleStmt.run(
      newId(),
      "note",
      "🎉 그룹에 오신 것을 환영합니다!",
      "이 공간은 링크, 노트, 파일을 한 곳에 모아두는 지식 창고입니다.\n\n✅ 링크 저장: URL을 붙여넣으면 제목이 자동으로 추출됩니다.\n✅ 노트 저장: 회의록, 아이디어, 메모를 빠르게 저장하세요.\n✅ 태그: 태그로 분류하면 나중에 쉽게 찾을 수 있습니다.\n✅ 검색: 검색창에서 키워드로 빠르게 찾으세요.",
      null,
      null,
      teamId
    );
    sampleStmt.run(
      newId(),
      "note",
      "항목 저장하기",
      "상단 '항목 저장' 버튼을 눌러 링크나 노트를 저장하세요.",
      null,
      null,
      teamId
    );

    const row = db.prepare<[string], TeamRow>("SELECT * FROM teams WHERE id = ?").get(teamId);
    revalidatePath("/dashboard");
    revalidatePath("/explore");
    return { data: hydrateTeam(row!) };
  } catch (err) {
    console.error("[createTeamNoAuth] DB 오류:", err instanceof Error ? err.message : err);
    return { error: "그룹 생성 중 오류가 발생했습니다." };
  }
}

// ───────────────────────────────────────────────────────────
// joinTeamByCodeNoAuth — 초대 코드로 워크스페이스 ID 조회
// ───────────────────────────────────────────────────────────
export async function joinTeamByCodeNoAuth(
  _: ActionResult<{ id: string }>,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const raw = ((formData.get("invite_code") as string | null) ?? "").trim().toUpperCase();
  if (raw.length < 4) return { error: "초대 코드를 입력해주세요." };

  const db = getDb();
  const team = db
    .prepare<[string], { id: string; name: string; invite_expires_at: string }>(
      "SELECT id, name, invite_expires_at FROM teams WHERE invite_code = ?"
    )
    .get(raw);

  if (!team) return { error: "유효하지 않은 초대 코드입니다." };
  if (new Date(team.invite_expires_at) < new Date()) {
    return { error: "초대 코드가 만료되었습니다. 운영자에게 새 초대 링크를 요청하세요." };
  }
  return { data: { id: team.id } };
}

// ───────────────────────────────────────────────────────────
// getTeamInfo
// ───────────────────────────────────────────────────────────
export async function getTeamInfo(teamId: string): Promise<ActionResult<Team>> {
  const db = getDb();
  const row = db.prepare<[string], TeamRow>("SELECT * FROM teams WHERE id = ?").get(teamId);
  if (!row) return { error: "그룹을 찾을 수 없습니다." };
  return { data: hydrateTeam(row) };
}

// ───────────────────────────────────────────────────────────
// updateTeam — 단일 사용자 모드: admin 체크 없음
// ───────────────────────────────────────────────────────────
export async function updateTeam(
  teamId: string,
  fields: { name?: string; description?: string; category?: string }
): Promise<ActionResult> {
  const updates: { col: string; val: string | null }[] = [];

  if (fields.name !== undefined) {
    const name = fields.name.trim();
    if (!name || name.length < 2 || name.length > 40)
      return { error: "그룹 이름은 2~40자여야 합니다." };
    updates.push({ col: "name", val: name });
  }
  if (fields.description !== undefined) {
    updates.push({ col: "description", val: fields.description.trim().slice(0, 200) || null });
  }
  if (fields.category !== undefined) {
    updates.push({ col: "category", val: fields.category || null });
  }
  if (updates.length === 0) return {};

  try {
    const db = getDb();
    const setClause = updates.map((u) => `${u.col} = ?`).join(", ");
    db.prepare(`UPDATE teams SET ${setClause} WHERE id = ?`).run(
      ...updates.map((u) => u.val),
      teamId
    );
  } catch {
    return { error: "그룹 정보 수정 중 오류가 발생했습니다." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/explore");
  return {};
}

// ───────────────────────────────────────────────────────────
// regenerateInviteCode
// ───────────────────────────────────────────────────────────
export async function regenerateInviteCode(teamId: string): Promise<ActionResult<string>> {
  const newCode = generateInviteCode();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 72);

  try {
    const db = getDb();
    db.prepare("UPDATE teams SET invite_code = ?, invite_expires_at = ? WHERE id = ?").run(
      newCode,
      expiresAt.toISOString(),
      teamId
    );
    return { data: newCode };
  } catch {
    return { error: "초대 코드 재발급 중 오류가 발생했습니다." };
  }
}

// ───────────────────────────────────────────────────────────
// joinPublicGroup — 단일 사용자 모드: 그룹 참여 개념 없음, 대시보드 갱신만
// ───────────────────────────────────────────────────────────
export async function joinPublicGroup(_groupId: string): Promise<ActionResult> {
  revalidatePath("/dashboard");
  return {};
}

// ───────────────────────────────────────────────────────────
// getPublicGroups — explore 페이지용 워크스페이스 목록
// ───────────────────────────────────────────────────────────
export async function getPublicGroups(
  category?: string
): Promise<ActionResult<PublicGroup[]>> {
  try {
    const db = getDb();
    const params: string[] = [];
    let where = "is_public = 1";
    if (category) {
      where += " AND category = ?";
      params.push(category);
    }

    const rows = db
      .prepare<string[], TeamRow>(
        `SELECT * FROM teams WHERE ${where} ORDER BY created_at DESC LIMIT 50`
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

    return { data: groups };
  } catch {
    return { error: "그룹 목록을 불러오는 중 오류가 발생했습니다." };
  }
}
