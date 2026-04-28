"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { joinTeamByCodeNoAuth } from "@/actions/teams";
import type { ActionResult } from "@/types";
import { Users } from "lucide-react";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full py-3 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-800 disabled:opacity-50 transition-colors"
    >
      {pending ? "확인 중..." : "그룹 참여하기"}
    </button>
  );
}

export default function JoinPage() {
  const router = useRouter();
  const [state, formAction] = useActionState<ActionResult<{ id: string }>, FormData>(
    joinTeamByCodeNoAuth,
    {}
  );

  useEffect(() => {
    if (state.data?.id) {
      router.push(`/dashboard?team=${state.data.id}`);
    }
  }, [state.data, router]);

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-zinc-900 rounded-2xl mb-4">
            <Users className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-zinc-900">초대 코드로 참여하기</h1>
          <p className="mt-1 text-sm text-zinc-500">
            운영자에게 받은 초대 코드를 입력하세요
          </p>
        </div>

        <form action={formAction} className="space-y-4">
          {state.error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
              {state.error}
            </p>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-700">
              초대 코드 <span className="text-red-400">*</span>
            </label>
            <input
              name="invite_code"
              type="text"
              required
              autoComplete="off"
              autoCapitalize="characters"
              placeholder="초대 코드를 입력하세요"
              onChange={(e) => {
                e.target.value = e.target.value.toUpperCase();
              }}
              className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm text-zinc-900 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-shadow placeholder:text-zinc-400 tracking-widest"
            />
          </div>

          <SubmitButton />
        </form>
      </div>
    </div>
  );
}
