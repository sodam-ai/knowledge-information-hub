"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { createTeamNoAuth } from "@/actions/teams";
import { GROUP_CATEGORIES } from "@/lib/validations";
import type { ActionResult, Team } from "@/types";
import { Link2 } from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  ai: "AI",
  dev: "개발",
  design: "디자인",
  marketing: "마케팅",
  study: "스터디",
  business: "비즈니스",
  investment: "투자",
  etc: "기타",
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full py-3 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-800 disabled:opacity-50 transition-colors"
    >
      {pending ? "생성 중..." : "그룹 만들기"}
    </button>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [state, formAction] = useActionState<ActionResult<Team>, FormData>(
    createTeamNoAuth,
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
            <Link2 className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-zinc-900">새 그룹 만들기</h1>
          <p className="mt-1 text-sm text-zinc-500">
            링크와 노트를 함께 모을 공간을 만드세요
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
              그룹 이름 <span className="text-red-400">*</span>
            </label>
            <input
              name="name"
              type="text"
              required
              maxLength={50}
              placeholder="예: AI 리서치, 프로젝트 링크 모음"
              className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm text-zinc-900 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-shadow placeholder:text-zinc-400"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-700">
              설명{" "}
              <span className="text-zinc-400 font-normal">(선택)</span>
            </label>
            <textarea
              name="description"
              maxLength={200}
              rows={2}
              placeholder="이 그룹은 어떤 것을 모으나요?"
              className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm text-zinc-900 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-shadow resize-none placeholder:text-zinc-400"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-700">
              카테고리{" "}
              <span className="text-zinc-400 font-normal">(선택)</span>
            </label>
            <select
              name="category"
              className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm text-zinc-900 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-shadow"
            >
              <option value="">카테고리 없음</option>
              {GROUP_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_LABELS[cat] ?? cat}
                </option>
              ))}
            </select>
          </div>

          <SubmitButton />
        </form>
      </div>
    </div>
  );
}
