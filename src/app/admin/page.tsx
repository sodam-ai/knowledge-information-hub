"use client";

import { useActionState, useState } from "react";
import { changeViewPassword, changeAdminPassword, verifyAdminAccess } from "@/actions/site-auth";
import type { ActionResult } from "@/types";
import { Lock, ShieldCheck } from "lucide-react";
import Link from "next/link";

const initialState: ActionResult<boolean> = {};

export default function AdminPage() {
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState("");
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlockPending, setUnlockPending] = useState(false);

  const [viewState, viewAction, viewPending] = useActionState(changeViewPassword, initialState);
  const [adminState, adminAction, adminPending] = useActionState(changeAdminPassword, initialState);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    setUnlockError(null);
    setUnlockPending(true);
    const result = await verifyAdminAccess(unlockPassword);
    setUnlockPending(false);
    if (result.error) {
      setUnlockError(result.error);
      setUnlockPassword("");
    } else {
      setAdminUnlocked(true);
    }
  }

  if (!adminUnlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4 py-12">
        <div className="w-full max-w-xs space-y-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-zinc-900 rounded-2xl mb-4 shadow-sm">
              <Lock className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-xl font-bold text-zinc-900">관리자 설정</h1>
            <p className="mt-1 text-sm text-zinc-500">관리자 비밀번호를 입력하세요</p>
          </div>
          <form onSubmit={handleUnlock} className="space-y-3">
            {unlockError && (
              <div className="p-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl text-center">
                {unlockError}
              </div>
            )}
            <input
              type="password"
              value={unlockPassword}
              onChange={(e) => setUnlockPassword(e.target.value)}
              placeholder="관리자 비밀번호"
              required
              autoFocus
              className="w-full px-4 py-3 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent bg-zinc-50"
            />
            <button
              type="submit"
              disabled={unlockPending}
              className="w-full py-3 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-50 transition-all"
            >
              {unlockPending ? "확인 중..." : "확인"}
            </button>
          </form>
          <div className="text-center">
            <Link href="/dashboard" className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors">
              ← 대시보드로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-sm space-y-6">

        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-zinc-900 rounded-2xl mb-4 shadow-sm">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">관리자 설정</h1>
        </div>

        {/* 열람 비밀번호 변경 */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-zinc-900 mb-1">열람 비밀번호 변경</h2>
          <p className="text-xs text-zinc-400 mb-4">숫자 4자리로만 구성된 비밀번호</p>
          <form action={viewAction} className="space-y-3">
            {viewState.error && (
              <div className="p-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl text-center">
                {viewState.error}
              </div>
            )}
            {viewState.data === true && (
              <div className="p-3 text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-xl text-center">
                열람 비밀번호가 변경되었습니다.
              </div>
            )}
            <input
              type="password"
              name="admin_password"
              placeholder="관리자 비밀번호"
              required
              className="w-full px-4 py-3 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent bg-zinc-50"
            />
            <input
              type="password"
              name="new_password"
              placeholder="새 열람 비밀번호 (숫자 4자리)"
              required
              maxLength={4}
              inputMode="numeric"
              pattern="[0-9]{4}"
              className="w-full px-4 py-3 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent bg-zinc-50"
            />
            <input
              type="password"
              name="confirm_password"
              placeholder="새 비밀번호 재입력"
              required
              maxLength={4}
              inputMode="numeric"
              pattern="[0-9]{4}"
              className="w-full px-4 py-3 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent bg-zinc-50"
            />
            <button
              type="submit"
              disabled={viewPending}
              className="w-full py-3 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {viewPending ? "변경 중..." : "열람 비밀번호 변경"}
            </button>
          </form>
        </div>

        {/* 관리자 비밀번호 변경 */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-zinc-900 mb-1">관리자 비밀번호 변경</h2>
          <p className="text-xs text-zinc-400 mb-4">현재 비밀번호 확인 후 변경 가능</p>
          <form action={adminAction} className="space-y-3">
            {adminState.error && (
              <div className="p-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl text-center">
                {adminState.error}
              </div>
            )}
            {adminState.data === true && (
              <div className="p-3 text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-xl text-center">
                관리자 비밀번호가 변경되었습니다.
              </div>
            )}
            <input
              type="password"
              name="current_admin_password"
              placeholder="현재 관리자 비밀번호"
              required
              className="w-full px-4 py-3 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent bg-zinc-50"
            />
            <input
              type="password"
              name="new_admin_password"
              placeholder="새 관리자 비밀번호 (4자 이상)"
              required
              minLength={4}
              className="w-full px-4 py-3 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent bg-zinc-50"
            />
            <input
              type="password"
              name="confirm_admin_password"
              placeholder="새 비밀번호 재입력"
              required
              className="w-full px-4 py-3 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent bg-zinc-50"
            />
            <button
              type="submit"
              disabled={adminPending}
              className="w-full py-3 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {adminPending ? "변경 중..." : "관리자 비밀번호 변경"}
            </button>
          </form>
        </div>

        <div className="text-center">
          <Link href="/dashboard" className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors">
            ← 대시보드로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}
