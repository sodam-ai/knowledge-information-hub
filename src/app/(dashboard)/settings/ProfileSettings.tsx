"use client";

import { useActionState } from "react";
import { updateProfile } from "@/actions/auth";
import { User, Check } from "lucide-react";
import type { ActionResult } from "@/types";

const initialState: ActionResult = {};

interface ProfileSettingsProps {
  name: string;
}

export default function ProfileSettings({ name }: ProfileSettingsProps) {
  const [state, formAction, isPending] = useActionState(updateProfile, initialState);

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 space-y-5">
      <h2 className="text-sm font-semibold text-zinc-900">내 프로필</h2>

      {state.error && (
        <div className="p-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl">
          {state.error}
        </div>
      )}

      {!state.error && state !== initialState && (
        <div className="flex items-center gap-2 p-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl">
          <Check className="w-3.5 h-3.5 flex-shrink-0" />
          프로필이 업데이트되었습니다.
        </div>
      )}

      <form action={formAction} className="space-y-3">
        <div className="space-y-1.5">
          <label htmlFor="name" className="block text-xs font-medium text-zinc-600">
            이름
          </label>
          <div className="flex items-center gap-2.5 border border-zinc-200 rounded-xl focus-within:ring-2 focus-within:ring-zinc-900 focus-within:border-transparent transition-shadow">
            <User className="w-4 h-4 text-zinc-400 flex-shrink-0 ml-3" />
            <input
              id="name"
              name="name"
              type="text"
              defaultValue={name}
              required
              maxLength={50}
              placeholder="홍길동"
              className="flex-1 py-2.5 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 bg-transparent focus:outline-none"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 bg-zinc-900 text-white text-xs font-medium rounded-xl hover:bg-zinc-800 disabled:opacity-50 transition-colors"
        >
          {isPending ? "저장 중..." : "저장"}
        </button>
      </form>
    </div>
  );
}
