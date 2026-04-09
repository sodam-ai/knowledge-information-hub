"use client";

import { useActionState, useEffect } from "react";
import { joinTeam } from "@/actions/teams";
import { useRouter, useSearchParams } from "next/navigation";
import type { ActionResult } from "@/types";
import { Suspense } from "react";
import { Link2 } from "lucide-react";
import Link from "next/link";

const initialState: ActionResult = {};

function JoinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code") ?? "";
  const [state, formAction, isPending] = useActionState(joinTeam, initialState);

  useEffect(() => {
    if (!state.error && !isPending && state !== initialState) {
      router.push("/dashboard");
    }
  }, [state, isPending, router]);

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* 브랜드 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-600 rounded-2xl mb-4">
            <Link2 className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-zinc-900">그룹 초대</h1>
          <p className="mt-1.5 text-sm text-zinc-500">초대 코드를 확인하고 참여하세요</p>
        </div>

        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 space-y-4">
          <form action={formAction} className="space-y-3">
            {state.error && (
              <div className="p-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl">
                {state.error}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-600">
                초대 코드
              </label>
              <input
                name="invite_code"
                type="text"
                defaultValue={code}
                required
                minLength={16}
                placeholder="초대 코드 붙여넣기"
                className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm font-mono text-zinc-900 placeholder:text-zinc-400 placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? "참여 중..." : "그룹 참여하기"}
            </button>
          </form>

          <div className="flex items-center justify-center gap-4 pt-1">
            <Link href="/explore" className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors">
              공개 그룹 탐색
            </Link>
            <span className="text-zinc-200">·</span>
            <Link href="/dashboard" className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors">
              대시보드로
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50" />}>
      <JoinContent />
    </Suspense>
  );
}
