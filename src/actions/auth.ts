"use server";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import crypto from "crypto";
import { sanitizeText } from "@/lib/utils";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { isWeakPin } from "@/lib/security/pin-blocklist";
import type { ActionResult } from "@/types";

// ── PIN 인증 헬퍼 ─────────────────────────────────────

function buildInternalEmail(username: string): string {
  return `${username}@klh.internal`;
}

function hashPin(pin: string): string {
  const secret = process.env.AUTH_INTERNAL_SECRET;
  if (!secret) throw new Error("AUTH_INTERNAL_SECRET 환경변수가 설정되지 않았습니다");
  return crypto.createHmac("sha256", secret).update(pin).digest("hex");
}

// ── 유효성 검사 스키마 ────────────────────────────────

const pinField = z
  .string()
  .regex(/^\d{4}$/, "PIN은 4자리 숫자여야 합니다");

const pinSignUpSchema = z.object({
  name: z
    .string()
    .min(1, "이름을 입력해주세요")
    .max(50, "이름은 50자 이하입니다")
    .transform((v) => v.trim()),
  pin: pinField,
});

const pinSignInSchema = z.object({
  pin: pinField,
});

// ── 회원가입 ─────────────────────────────────────────

export async function signUp(
  _: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const raw = {
    name: formData.get("name") as string,
    pin: formData.get("pin") as string,
  };

  const parsed = pinSignUpSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const { name, pin } = parsed.data;

  // 취약 PIN 차단 (신규 가입만)
  if (isWeakPin(pin)) {
    return { error: "너무 쉬운 PIN입니다. 다른 번호를 선택해주세요." };
  }

  // 가입 Rate Limit: 동일 PIN으로 1시간에 3회
  const rl = checkRateLimit(`signup:${pin}`, 3, 60 * 60 * 1000);
  if (!rl.allowed) {
    return {
      error: `잠시 후 다시 시도해주세요. (${rl.retryAfterSeconds}초 후 가능)`,
    };
  }

  const internalEmail = buildInternalEmail(pin);
  const serviceClient = createServiceClient();

  // 탈퇴 PIN 재가입 차단
  const emailHash = crypto.createHash("sha256").update(internalEmail).digest("hex");
  const { data: blocked } = await serviceClient
    .from("deleted_emails")
    .select("blocked_until")
    .eq("email_hash", emailHash)
    .gt("blocked_until", new Date().toISOString())
    .maybeSingle();

  if (blocked) {
    return { error: "해당 PIN은 90일간 재가입이 제한됩니다." };
  }

  // PIN 중복 확인
  const { data: existingUser } = await serviceClient
    .from("users")
    .select("id")
    .eq("email", internalEmail)
    .maybeSingle();

  if (existingUser) {
    return { error: "이미 사용 중인 PIN입니다. 다른 번호를 선택해주세요." };
  }

  // Supabase 계정 생성 (내부 이메일 + HMAC 해시된 PIN)
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: internalEmail,
    password: hashPin(pin),
    options: { data: { name } },
  });

  if (error) {
    if (error.message.includes("already registered")) {
      return { error: "이미 사용 중인 PIN입니다. 다른 번호를 선택해주세요." };
    }
    return { error: "가입 중 오류가 발생했습니다. 다시 시도해주세요." };
  }

  redirect("/dashboard");
}

// ── 로그인 ─────────────────────────────────────────

export async function signIn(
  _: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const raw = {
    pin: formData.get("pin") as string,
  };

  const parsed = pinSignInSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const { pin } = parsed.data;

  // 로그인 Rate Limit: 동일 PIN으로 10분에 5회
  const rl = checkRateLimit(`login:${pin}`, 5, 10 * 60 * 1000);
  if (!rl.allowed) {
    return {
      error: `로그인 시도가 너무 많습니다. ${rl.retryAfterSeconds}초 후 다시 시도해주세요.`,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: buildInternalEmail(pin),
    password: hashPin(pin),
  });

  if (error) {
    return { error: "PIN이 올바르지 않습니다." };
  }

  redirect("/dashboard");
}

// ── 로그아웃 ─────────────────────────────────────────

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// ── 회원 탈퇴 ─────────────────────────────────────────

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
    const { data: otherAdmins } = await serviceClient
      .from("user_teams")
      .select("user_id")
      .eq("team_id", ut.team_id)
      .eq("role", "admin")
      .neq("user_id", user.id)
      .is("left_at", null);

    if (!otherAdmins || otherAdmins.length === 0) {
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

  await serviceClient
    .from("users")
    .update({
      email: `deleted-${user.id}@knowledge-link-hub.invalid`,
      name: "[탈퇴한 사용자]",
      avatar_url: null,
      username: null,
      is_anonymized: true,
      anonymized_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  await serviceClient
    .from("items")
    .update({ created_by: null })
    .eq("created_by", user.id);

  await serviceClient
    .from("user_teams")
    .update({ left_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("left_at", null);

  await serviceClient.from("deleted_emails").insert({
    email_hash: emailHash,
    blocked_until: blockedUntil.toISOString(),
  });

  await serviceClient.auth.admin.deleteUser(user.id);

  redirect("/login");
}

// ── 프로필 수정 ─────────────────────────────────────────

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
    .update({ name })
    .eq("id", user.id);

  if (error) return { error: "프로필 업데이트 중 오류가 발생했습니다." };

  revalidatePath("/settings");
  return {};
}
