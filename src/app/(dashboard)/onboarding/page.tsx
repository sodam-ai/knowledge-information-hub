"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createTeam, joinTeam } from "@/actions/teams";
import Link from "next/link";
import { Users, Link2, Globe, Lock, ChevronDown } from "lucide-react";
import type { ActionResult, Team, GroupCategory } from "@/types";
import { CATEGORY_LABELS } from "@/types";
import { GROUP_CATEGORIES } from "@/lib/validations";

const createInitialState: ActionResult<Team> = {};
const joinInitialState: ActionResult = {};

export default function OnboardingPage() {
  const router = useRouter();
  const [isPublic, setIsPublic] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<GroupCategory | "">("");
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);

  const [createState, createAction, isCreatePending] = useActionState(
    createTeam,
    createInitialState
  );
  const [joinState, joinAction, isJoinPending] = useActionState(
    joinTeam,
    joinInitialState
  );

  useEffect(() => {
    if (createState.data) {
      router.push("/dashboard");
    }
  }, [createState, router]);

  useEffect(() => {
    if (!joinState.error && !isJoinPending && joinState !== joinInitialState) {
      router.push("/dashboard");
    }
  }, [joinState, isJoinPending, router]);

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg space-y-4">

        {/* 헤더 */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-11 h-11 bg-zinc-900 rounded-2xl mb-3">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-zinc-900">그룹 설정</h1>
          <p className="mt-1 text-sm text-zinc-500">
            새 그룹을 만들거나 초대 코드로 기존 그룹에 참여하세요
          </p>
        </div>

        {/* 그룹 만들기 */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-zinc-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-zinc-900 rounded-xl flex items-center justify-center flex-shrink-0">
                <Users className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-zinc-900">새 그룹 만들기</h2>
                <p className="text-xs text-zinc-500 mt-0.5">운영자로 새 공간을 시작합니다</p>
              </div>
            </div>
          </div>

          <form action={createAction} className="p-5 space-y-4">
            {createState.error && (
              <div className="p-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl">
                {createState.error}
              </div>
            )}

            {/* 그룹 이름 */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-600">
                그룹 이름 <span className="text-red-400">*</span>
              </label>
              <input
                name="name"
                type="text"
                required
                maxLength={50}
                placeholder="예: AI 스터디, 디자이너 모임"
                className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-shadow"
              />
            </div>

            {/* 그룹 설명 */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-600">
                그룹 소개 <span className="text-zinc-400 font-normal">(선택)</span>
              </label>
              <textarea
                name="description"
                maxLength={200}
                rows={2}
                placeholder="어떤 그룹인지 간단히 소개해주세요"
                className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-shadow resize-none"
              />
            </div>

            {/* 카테고리 */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-600">
                카테고리 <span className="text-zinc-400 font-normal">(선택)</span>
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowCategoryMenu(!showCategoryMenu)}
                  className="w-full flex items-center justify-between px-3 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-shadow bg-white"
                >
                  <span className={selectedCategory ? "text-zinc-900" : "text-zinc-400"}>
                    {selectedCategory
                      ? CATEGORY_LABELS[selectedCategory as GroupCategory]
                      : "카테고리 선택"}
                  </span>
                  <ChevronDown className="w-4 h-4 text-zinc-400" />
                </button>
                <input type="hidden" name="category" value={selectedCategory} />

                {showCategoryMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowCategoryMenu(false)} />
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-zinc-200 rounded-xl shadow-lg z-20 overflow-hidden">
                      {GROUP_CATEGORIES.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => {
                            setSelectedCategory(cat as GroupCategory);
                            setShowCategoryMenu(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-zinc-50 ${
                            selectedCategory === cat ? "text-zinc-900 font-medium bg-zinc-50" : "text-zinc-700"
                          }`}
                        >
                          {CATEGORY_LABELS[cat as GroupCategory]}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* 공개/비공개 토글 */}
            <div className="space-y-2">
              <span className="block text-xs font-medium text-zinc-600">공개 범위</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsPublic(false)}
                  className={`flex items-center gap-2.5 px-3 py-3 rounded-xl border text-left transition-all ${
                    !isPublic
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
                  }`}
                >
                  <Lock className="w-4 h-4 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium">비공개</p>
                    <p className={`text-xs mt-0.5 ${!isPublic ? "text-zinc-300" : "text-zinc-400"}`}>
                      초대 코드로만 참여
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPublic(true)}
                  className={`flex items-center gap-2.5 px-3 py-3 rounded-xl border text-left transition-all ${
                    isPublic
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
                  }`}
                >
                  <Globe className="w-4 h-4 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium">공개</p>
                    <p className={`text-xs mt-0.5 ${isPublic ? "text-zinc-300" : "text-zinc-400"}`}>
                      탐색에서 발견 가능
                    </p>
                  </div>
                </button>
              </div>
              <input type="hidden" name="is_public" value={isPublic ? "true" : "false"} />
            </div>

            <button
              type="submit"
              disabled={isCreatePending}
              className="w-full py-2.5 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-800 disabled:opacity-50 transition-colors"
            >
              {isCreatePending ? "생성 중..." : "그룹 만들기"}
            </button>
          </form>
        </div>

        {/* 초대 코드로 참여 */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-zinc-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <Link2 className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-zinc-900">초대 코드로 참여</h2>
                <p className="text-xs text-zinc-500 mt-0.5">받은 초대 코드를 입력하세요</p>
              </div>
            </div>
          </div>

          <form action={joinAction} className="p-5 space-y-3">
            {joinState.error && (
              <div className="p-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl">
                {joinState.error}
              </div>
            )}
            <input
              name="invite_code"
              type="text"
              required
              minLength={16}
              placeholder="초대 코드 입력 (예: aB3xY7...)"
              className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm font-mono text-zinc-900 placeholder:text-zinc-400 placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
            />
            <button
              type="submit"
              disabled={isJoinPending}
              className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isJoinPending ? "참여 중..." : "그룹 참여하기"}
            </button>
          </form>
        </div>

        {/* 하단 링크 */}
        <div className="flex items-center justify-center gap-4 pt-2">
          <Link
            href="/explore"
            className="text-xs text-zinc-500 hover:text-zinc-900 transition-colors flex items-center gap-1"
          >
            <Globe className="w-3.5 h-3.5" />
            공개 그룹 탐색
          </Link>
          <span className="text-zinc-300">·</span>
          <Link href="/dashboard" className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors">
            대시보드로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}
