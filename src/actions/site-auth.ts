"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import {
  createSessionToken,
  hashPassword,
  sessionCookieOptions,
  SESSION_COOKIE,
} from "@/lib/auth/session";
import type { ActionResult } from "@/types";

async function getStoredPasswordHash(): Promise<string | null> {
  const db = createServiceClient();
  const { data } = await db
    .from("site_config")
    .select("value")
    .eq("key", "view_password_hash")
    .maybeSingle();
  return data?.value ?? null;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function verifyAdminPassword(input: string): Promise<boolean> {
  const db = createServiceClient();
  const { data } = await db
    .from("site_config")
    .select("value")
    .eq("key", "admin_password_hash")
    .maybeSingle();

  if (data?.value) {
    // UI를 통해 변경된 이후 — 해시 비교
    const inputHash = await hashPassword(input);
    return timingSafeEqual(inputHash, data.value);
  }

  // 최초 설정 — 환경 변수 평문 비교
  const envAdmin = process.env.ADMIN_PASSWORD ?? "";
  return timingSafeEqual(input, envAdmin);
}

export async function signIn(
  _: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const password = (formData.get("password") as string)?.trim();
  if (!password) return { error: "비밀번호를 입력해주세요." };

  const storedHash = await getStoredPasswordHash();
  const envPassword = process.env.VIEW_PASSWORD;
  const expected = storedHash ?? (envPassword ? await hashPassword(envPassword) : null);
  if (!expected) return { error: "서버 설정 오류입니다. 관리자에게 문의하세요." };

  const inputHash = await hashPassword(password);
  if (!timingSafeEqual(inputHash, expected)) {
    return { error: "비밀번호가 올바르지 않습니다." };
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, await createSessionToken(), sessionCookieOptions());
  redirect("/dashboard");
}

export async function signOut() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect("/login");
}

export async function changeViewPassword(
  _: ActionResult<boolean>,
  formData: FormData
): Promise<ActionResult<boolean>> {
  const adminPassword = (formData.get("admin_password") as string)?.trim();
  const newPassword = (formData.get("new_password") as string)?.trim();
  const confirmPassword = (formData.get("confirm_password") as string)?.trim();

  if (!adminPassword || !newPassword || !confirmPassword) {
    return { error: "모든 항목을 입력해주세요." };
  }

  if (!(await verifyAdminPassword(adminPassword))) {
    return { error: "관리자 비밀번호가 올바르지 않습니다." };
  }

  if (newPassword !== confirmPassword) return { error: "새 비밀번호가 일치하지 않습니다." };
  if (!/^\d{4}$/.test(newPassword)) return { error: "열람 비밀번호는 숫자 4자리여야 합니다." };

  const newHash = await hashPassword(newPassword);
  const db = createServiceClient();
  const { error } = await db
    .from("site_config")
    .upsert({ key: "view_password_hash", value: newHash, updated_at: new Date().toISOString() });

  if (error) return { error: "비밀번호 변경 중 오류가 발생했습니다." };
  return { data: true };
}

export async function verifyAdminAccess(password: string): Promise<ActionResult<boolean>> {
  if (!password) return { error: "비밀번호를 입력해주세요." };
  const ok = await verifyAdminPassword(password);
  if (!ok) return { error: "관리자 비밀번호가 올바르지 않습니다." };
  return { data: true };
}

export async function changeAdminPassword(
  _: ActionResult<boolean>,
  formData: FormData
): Promise<ActionResult<boolean>> {
  const currentPassword = (formData.get("current_admin_password") as string)?.trim();
  const newPassword = (formData.get("new_admin_password") as string)?.trim();
  const confirmPassword = (formData.get("confirm_admin_password") as string)?.trim();

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: "모든 항목을 입력해주세요." };
  }

  if (!(await verifyAdminPassword(currentPassword))) {
    return { error: "현재 관리자 비밀번호가 올바르지 않습니다." };
  }

  if (newPassword !== confirmPassword) return { error: "새 비밀번호가 일치하지 않습니다." };
  if (newPassword.length < 4) return { error: "비밀번호는 4자 이상이어야 합니다." };

  const newHash = await hashPassword(newPassword);
  const db = createServiceClient();
  const { error } = await db
    .from("site_config")
    .upsert({ key: "admin_password_hash", value: newHash, updated_at: new Date().toISOString() });

  if (error) return { error: "비밀번호 변경 중 오류가 발생했습니다." };
  return { data: true };
}
