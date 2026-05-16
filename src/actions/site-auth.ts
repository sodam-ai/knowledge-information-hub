"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/sqlite";
import {
  createSessionToken,
  hashPassword,
  sessionCookieOptions,
  SESSION_COOKIE,
} from "@/lib/auth/session";
import type { ActionResult } from "@/types";

interface SiteConfigRow {
  value: string;
}

function getStoredPasswordHash(): string | null {
  const db = getDb();
  const row = db
    .prepare<[string], SiteConfigRow>("SELECT value FROM site_config WHERE key = ?")
    .get("view_password_hash");
  return row?.value ?? null;
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
  const db = getDb();
  const row = db
    .prepare<[string], SiteConfigRow>("SELECT value FROM site_config WHERE key = ?")
    .get("admin_password_hash");

  if (row?.value) {
    const inputHash = await hashPassword(input);
    return timingSafeEqual(inputHash, row.value);
  }

  // 최초 설정 — 환경변수 평문 비교
  const envAdmin = process.env.ADMIN_PASSWORD ?? "";
  return timingSafeEqual(input, envAdmin);
}

function upsertSiteConfig(key: string, value: string): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO site_config (key, value, updated_at) VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(key, value);
}

function getAuthEnabledFlag(): boolean {
  const db = getDb();
  const row = db
    .prepare<[string], SiteConfigRow>("SELECT value FROM site_config WHERE key = ?")
    .get("auth_enabled");
  return row?.value !== "0";
}

export async function getAuthEnabled(): Promise<boolean> {
  return getAuthEnabledFlag();
}

export async function setAuthEnabled(
  enabled: boolean,
  adminPassword: string
): Promise<ActionResult<boolean>> {
  if (!adminPassword) return { error: "관리자 비밀번호를 입력해주세요." };
  if (!(await verifyAdminPassword(adminPassword))) {
    return { error: "관리자 비밀번호가 올바르지 않습니다." };
  }
  try {
    upsertSiteConfig("auth_enabled", enabled ? "1" : "0");
    return { data: enabled };
  } catch {
    return { error: "설정 변경 중 오류가 발생했습니다." };
  }
}

export async function signIn(
  _: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  if (!getAuthEnabledFlag()) {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, await createSessionToken(), sessionCookieOptions());
    redirect("/dashboard");
  }

  const password = (formData.get("password") as string)?.trim();
  if (!password) return { error: "비밀번호를 입력해주세요." };

  const storedHash = getStoredPasswordHash();
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

  try {
    const newHash = await hashPassword(newPassword);
    upsertSiteConfig("view_password_hash", newHash);
    return { data: true };
  } catch {
    return { error: "비밀번호 변경 중 오류가 발생했습니다." };
  }
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

  try {
    const newHash = await hashPassword(newPassword);
    upsertSiteConfig("admin_password_hash", newHash);
    return { data: true };
  } catch {
    return { error: "비밀번호 변경 중 오류가 발생했습니다." };
  }
}
