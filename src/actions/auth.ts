"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import crypto from "crypto";
import { sanitizeText } from "@/lib/utils";
import type { ActionResult } from "@/types";

const signUpSchema = z.object({
  email: z.string().email("올바른 이메일 형식이 아닙니다."),
  password: z
    .string()
    .min(8, "비밀번호는 8자 이상이어야 합니다.")
    .max(100, "비밀번호가 너무 깁니다."),
  name: z.string().min(1, "이름을 입력해주세요.").max(50, "이름은 50자 이하입니다."),
});

const signInSchema = z.object({
  email: z.string().email("올바른 이메일 형식이 아닙니다."),
  password: z.string().min(1, "비밀번호를 입력해주세요."),
});

export async function signUp(
  _: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const raw = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    name: formData.get("name") as string,
  };

  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const { email, password, name } = parsed.data;

  // 탈퇴 이메일 재가입 차단
  const emailHash = crypto.createHash("sha256").update(email.toLowerCase()).digest("hex");
  const serviceClient = createServiceClient();
  const { data: blocked } = await serviceClient
    .from("deleted_emails")
    .select("blocked_until")
    .eq("email_hash", emailHash)
    .gt("blocked_until", new Date().toISOString())
    .maybeSingle();

  if (blocked) {
    return { error: "해당 이메일로는 90일간 재가입이 제한됩니다." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });

  if (error) {
    if (error.message.includes("already registered")) {
      return { error: "이미 가입된 이메일입니다." };
    }
    return { error: "회원가입 중 오류가 발생했습니다. 다시 시도해주세요." };
  }

  redirect("/dashboard");
}

export async function signIn(
  _: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const raw = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: "이메일 또는 비밀번호가 올바르지 않습니다." };
  }

  redirect("/dashboard");
}


export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function deleteAccount(): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "로그인이 필요합니다." };

  const serviceClient = createServiceClient();

  // 관리자 승계 확인
  const { data: adminTeams } = await serviceClient
    .from("user_teams")
    .select("team_id")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .is("left_at", null);

  for (const ut of adminTeams ?? []) {
    // 이 팀에 다른 admin이 있는지 확인
    const { data: otherAdmins } = await serviceClient
      .from("user_teams")
      .select("user_id")
      .eq("team_id", ut.team_id)
      .eq("role", "admin")
      .neq("user_id", user.id)
      .is("left_at", null);

    if (!otherAdmins || otherAdmins.length === 0) {
      // 가장 오래된 멤버 자동 승격
      const { data: oldestMember } = await serviceClient
        .from("user_teams")
        .select("user_id")
        .eq("team_id", ut.team_id)
        .eq("role", "member")
        .is("left_at", null)
        .order("joined_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (oldestMember) {
        await serviceClient
          .from("user_teams")
          .update({ role: "admin" })
          .eq("team_id", ut.team_id)
          .eq("user_id", oldestMember.user_id);
      }
    }
  }

  // 원자적 탈퇴 처리
  const emailHash = crypto
    .createHash("sha256")
    .update(user.email!.toLowerCase())
    .digest("hex");

  const blockedUntil = new Date();
  blockedUntil.setDate(blockedUntil.getDate() + 90);

  // 1. User 익명화
  await serviceClient
    .from("users")
    .update({
      email: `deleted-${user.id}@knowledge-link-hub.invalid`,
      name: "[탈퇴한 사용자]",
      avatar_url: null,
      is_anonymized: true,
      anonymized_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  // 2. Item.created_by → NULL
  await serviceClient
    .from("items")
    .update({ created_by: null })
    .eq("created_by", user.id);

  // 3. UserTeam left_at 기록
  await serviceClient
    .from("user_teams")
    .update({ left_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("left_at", null);

  // 4. DeletedEmails 해시 저장
  await serviceClient.from("deleted_emails").insert({
    email_hash: emailHash,
    blocked_until: blockedUntil.toISOString(),
  });

  // 5. Supabase Auth 삭제
  await serviceClient.auth.admin.deleteUser(user.id);

  redirect("/login");
}

export async function updateProfile(
  prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const raw = formData.get("name") as string;
  const name = sanitizeText(raw?.trim() ?? "", 50);

  if (!name || name.length < 1) return { error: "이름을 입력해주세요." };
  if (name.length > 50) return { error: "이름은 50자 이하여야 합니다." };

  const { error } = await supabase
    .from("users")
    .update({ name, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) return { error: "프로필 업데이트 중 오류가 발생했습니다." };

  revalidatePath("/settings");
  return {};
}
