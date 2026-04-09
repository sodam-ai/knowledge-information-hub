"use server";

import { createClient } from "@/lib/supabase/server";
import { createTeamSchema, joinTeamSchema } from "@/lib/validations";
import { revalidatePath } from "next/cache";
import type { ActionResult, Team, PublicGroup } from "@/types";
import crypto from "crypto";

function generateInviteCode(): string {
  // 암호학적으로 안전한 20자 난수 (브루트포스 방지: 경우의 수 64^20)
  return crypto.randomBytes(15).toString("base64url").slice(0, 20);
}

export async function createTeam(
  _: ActionResult<Team>,
  formData: FormData
): Promise<ActionResult<Team>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const parsed = createTeamSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    category: formData.get("category") || undefined,
    is_public: formData.get("is_public"),
  });
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  // 그룹 소속 10개 제한 (서버 액션 레벨)
  const { count } = await supabase
    .from("user_teams")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("left_at", null);

  if ((count ?? 0) >= 10) {
    return { error: "최대 10개 그룹까지 소속될 수 있습니다." };
  }

  const inviteCode = generateInviteCode();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 72);
  const teamId = crypto.randomUUID();

  const { error: teamError } = await supabase.from("teams").insert({
    id: teamId,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    category: parsed.data.category ?? null,
    is_public: parsed.data.is_public,
    invite_code: inviteCode,
    invite_expires_at: expiresAt.toISOString(),
  });

  if (teamError) {
    console.error("[createTeam] DB 오류:", teamError.code);
    return { error: "그룹 생성 중 오류가 발생했습니다." };
  }

  // 그룹 생성자를 운영자(admin)로 등록
  const { error: memberError } = await supabase.from("user_teams").insert({
    user_id: user.id,
    team_id: teamId,
    role: "admin",
  });

  if (memberError) {
    if (memberError.message.includes("user_team_limit_exceeded")) {
      return { error: "최대 10개 그룹까지 소속될 수 있습니다." };
    }
    return { error: "그룹 생성 중 오류가 발생했습니다." };
  }

  // 첫 실행 샘플 콘텐츠 3개 자동 생성
  await supabase.from("items").insert([
    {
      type: "link",
      title: "지식 그룹 시작 가이드",
      url: "https://github.com",
      url_hash: crypto.createHash("sha256").update("https://github.com").digest("hex"),
      team_id: teamId,
      created_by: user.id,
    },
    {
      type: "note",
      title: "🎉 그룹에 오신 것을 환영합니다!",
      content:
        "이 공간은 링크, 노트, 파일을 한 곳에 모아두는 지식 창고입니다.\n\n✅ 링크 저장: URL을 붙여넣으면 제목이 자동으로 추출됩니다.\n✅ 노트 저장: 회의록, 아이디어, 메모를 빠르게 저장하세요.\n✅ 태그: 태그로 분류하면 나중에 쉽게 찾을 수 있습니다.\n✅ 검색: 검색창에서 키워드로 빠르게 찾으세요.",
      team_id: teamId,
      created_by: user.id,
    },
    {
      type: "note",
      title: "멤버 초대하기",
      content:
        "상단 '초대' 버튼에서 참여 링크를 복사해서 보내세요.\n참여 링크는 72시간 동안 유효합니다.",
      team_id: teamId,
      created_by: user.id,
    },
  ]);

  // user_teams 등록 후 팀 조회 (SELECT RLS 통과)
  const { data: team } = await supabase
    .from("teams")
    .select()
    .eq("id", teamId)
    .single();

  revalidatePath("/dashboard");
  revalidatePath("/explore");
  return { data: team };
}

export async function joinTeam(
  _: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const parsed = joinTeamSchema.safeParse({
    invite_code: formData.get("invite_code"),
  });
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  // 초대 코드 조회 + 만료 확인
  const { data: team, error } = await supabase
    .from("teams")
    .select("id, name, invite_expires_at")
    .eq("invite_code", parsed.data.invite_code)
    .single();

  if (error || !team) {
    return { error: "유효하지 않은 초대 코드입니다." };
  }

  if (new Date(team.invite_expires_at) < new Date()) {
    return {
      error: "초대 코드가 만료되었습니다. 운영자에게 새 초대 링크를 요청하세요.",
    };
  }

  // 그룹 소속 10개 제한
  const { count: userTeamCount } = await supabase
    .from("user_teams")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("left_at", null);

  if ((userTeamCount ?? 0) >= 10) {
    return { error: "최대 10개 그룹까지 소속될 수 있습니다." };
  }

  // 이미 소속 여부 확인
  const { data: existing } = await supabase
    .from("user_teams")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("team_id", team.id)
    .is("left_at", null)
    .maybeSingle();

  if (existing) {
    return { error: "이미 참여 중인 그룹입니다." };
  }

  const { error: joinError } = await supabase.from("user_teams").insert({
    user_id: user.id,
    team_id: team.id,
    role: "member",
  });

  if (joinError) {
    if (joinError.message.includes("team_member_limit_exceeded")) {
      return { error: "그룹 정원이 초과되었습니다." };
    }
    return { error: "그룹 참여 중 오류가 발생했습니다." };
  }

  revalidatePath("/dashboard");
  return {};
}

export async function joinPublicGroup(groupId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  // 공개 그룹 여부 확인
  const { data: group, error: groupError } = await supabase
    .from("teams")
    .select("id, name, is_public")
    .eq("id", groupId)
    .eq("is_public", true)
    .single();

  if (groupError || !group) {
    return { error: "존재하지 않거나 공개되지 않은 그룹입니다." };
  }

  // 그룹 소속 10개 제한
  const { count: userTeamCount } = await supabase
    .from("user_teams")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("left_at", null);

  if ((userTeamCount ?? 0) >= 10) {
    return { error: "최대 10개 그룹까지 소속될 수 있습니다." };
  }

  // 이미 소속 여부 확인
  const { data: existing } = await supabase
    .from("user_teams")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("team_id", group.id)
    .is("left_at", null)
    .maybeSingle();

  if (existing) {
    return { error: "이미 참여 중인 그룹입니다." };
  }

  const { error: joinError } = await supabase.from("user_teams").insert({
    user_id: user.id,
    team_id: group.id,
    role: "member",
  });

  if (joinError) {
    if (joinError.message.includes("team_member_limit_exceeded")) {
      return { error: "그룹 정원이 초과되었습니다." };
    }
    return { error: "그룹 참여 중 오류가 발생했습니다." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/explore");
  return {};
}

export async function getPublicGroups(
  category?: string
): Promise<ActionResult<PublicGroup[]>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { data, error } = await supabase.rpc("get_public_groups", {
    p_category: category ?? null,
    p_limit: 50,
    p_offset: 0,
  });

  if (error) {
    console.error("[getPublicGroups] RPC 오류:", error.code);
    return { error: "그룹 목록을 불러오는 중 오류가 발생했습니다." };
  }

  return { data: data ?? [] };
}

export async function regenerateInviteCode(
  teamId: string
): Promise<ActionResult<string>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  // 운영자(admin) 권한 확인
  const { data: membership } = await supabase
    .from("user_teams")
    .select("role")
    .eq("user_id", user.id)
    .eq("team_id", teamId)
    .is("left_at", null)
    .single();

  if (!membership || membership.role !== "admin") {
    return { error: "운영자만 초대 코드를 재발급할 수 있습니다." };
  }

  const newCode = generateInviteCode();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 72);

  const { error } = await supabase
    .from("teams")
    .update({
      invite_code: newCode,
      invite_expires_at: expiresAt.toISOString(),
    })
    .eq("id", teamId);

  if (error) return { error: "초대 코드 재발급 중 오류가 발생했습니다." };

  return { data: newCode };
}

export async function getTeamMembers(
  teamId: string
): Promise<ActionResult<{ id: string; name: string; email: string; role: "admin" | "member"; joined_at: string }[]>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { data: membership } = await supabase
    .from("user_teams")
    .select("role")
    .eq("user_id", user.id)
    .eq("team_id", teamId)
    .is("left_at", null)
    .single();
  if (!membership) return { error: "접근 권한이 없습니다." };

  const { data, error } = await supabase
    .from("user_teams")
    .select("role, joined_at, users(id, name, email)")
    .eq("team_id", teamId)
    .is("left_at", null)
    .order("joined_at", { ascending: true });

  if (error) return { error: "멤버 목록을 불러올 수 없습니다." };

  const members = (data ?? []).map((row) => {
    const u = row.users as unknown as { id: string; name: string; email: string };
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: row.role as "admin" | "member",
      joined_at: row.joined_at,
    };
  });

  return { data: members };
}

export async function updateTeam(
  teamId: string,
  fields: { name?: string; description?: string; category?: string; is_public?: boolean }
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { data: membership } = await supabase
    .from("user_teams")
    .select("role")
    .eq("user_id", user.id)
    .eq("team_id", teamId)
    .is("left_at", null)
    .single();
  if (!membership || membership.role !== "admin") return { error: "운영자만 수정할 수 있습니다." };

  const updates: Record<string, unknown> = {};
  if (fields.name !== undefined) {
    const name = fields.name.trim();
    if (!name || name.length < 2 || name.length > 40) return { error: "그룹 이름은 2~40자여야 합니다." };
    updates.name = name;
  }
  if (fields.description !== undefined) updates.description = fields.description.trim().slice(0, 200) || null;
  if (fields.category !== undefined) updates.category = fields.category || null;
  if (fields.is_public !== undefined) updates.is_public = fields.is_public;

  const { error } = await supabase.from("teams").update(updates).eq("id", teamId);
  if (error) return { error: "그룹 정보 수정 중 오류가 발생했습니다." };

  revalidatePath("/dashboard");
  revalidatePath("/explore");
  return {};
}

export async function kickMember(teamId: string, userId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  if (user.id === userId) return { error: "자신을 강제 탈퇴할 수 없습니다." };

  const { data: membership } = await supabase
    .from("user_teams")
    .select("role")
    .eq("user_id", user.id)
    .eq("team_id", teamId)
    .is("left_at", null)
    .single();
  if (!membership || membership.role !== "admin") return { error: "운영자만 강제 탈퇴할 수 있습니다." };

  const { data: target } = await supabase
    .from("user_teams")
    .select("role")
    .eq("user_id", userId)
    .eq("team_id", teamId)
    .is("left_at", null)
    .single();
  if (target?.role === "admin") return { error: "운영자는 강제 탈퇴할 수 없습니다. 역할을 먼저 변경하세요." };

  const { error } = await supabase
    .from("user_teams")
    .update({ left_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("team_id", teamId);

  if (error) return { error: "강제 탈퇴 처리 중 오류가 발생했습니다." };
  revalidatePath("/dashboard");
  return {};
}

export async function transferAdmin(teamId: string, userId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  if (user.id === userId) return { error: "자신에게 운영자를 양도할 수 없습니다." };

  const { data: membership } = await supabase
    .from("user_teams")
    .select("role")
    .eq("user_id", user.id)
    .eq("team_id", teamId)
    .is("left_at", null)
    .single();
  if (!membership || membership.role !== "admin") return { error: "운영자만 권한을 양도할 수 있습니다." };

  const [{ error: e1 }, { error: e2 }] = await Promise.all([
    supabase.from("user_teams").update({ role: "admin" }).eq("user_id", userId).eq("team_id", teamId).is("left_at", null),
    supabase.from("user_teams").update({ role: "member" }).eq("user_id", user.id).eq("team_id", teamId).is("left_at", null),
  ]);

  if (e1 || e2) return { error: "운영자 양도 중 오류가 발생했습니다." };
  revalidatePath("/dashboard");
  return {};
}

export async function leaveTeam(teamId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  // 마지막 운영자 탈퇴 차단
  const { data: membership } = await supabase
    .from("user_teams")
    .select("role")
    .eq("user_id", user.id)
    .eq("team_id", teamId)
    .is("left_at", null)
    .single();

  if (membership?.role === "admin") {
    const { count: adminCount } = await supabase
      .from("user_teams")
      .select("*", { count: "exact", head: true })
      .eq("team_id", teamId)
      .eq("role", "admin")
      .is("left_at", null);

    if ((adminCount ?? 0) <= 1) {
      const { count: memberCount } = await supabase
        .from("user_teams")
        .select("*", { count: "exact", head: true })
        .eq("team_id", teamId)
        .eq("role", "member")
        .is("left_at", null);

      if ((memberCount ?? 0) > 0) {
        return {
          error: "다른 회원을 운영자로 지정한 후 탈퇴할 수 있습니다.",
        };
      }
    }
  }

  const { error } = await supabase
    .from("user_teams")
    .update({ left_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("team_id", teamId);

  if (error) return { error: "그룹 탈퇴 중 오류가 발생했습니다." };

  revalidatePath("/dashboard");
  revalidatePath("/explore");
  return {};
}
