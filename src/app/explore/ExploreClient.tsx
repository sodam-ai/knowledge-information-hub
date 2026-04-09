"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { joinPublicGroup } from "@/actions/teams";
import Link from "next/link";
import { Globe, Users, ArrowLeft, Search } from "lucide-react";
import type { PublicGroup, GroupCategory } from "@/types";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/types";
import { GROUP_CATEGORIES } from "@/lib/validations";

interface ExploreClientProps {
  initialGroups: PublicGroup[];
  activeCategory: string;
  error?: string;
}

export default function ExploreClient({
  initialGroups,
  activeCategory,
  error,
}: ExploreClientProps) {
  const router = useRouter();
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  const filtered = initialGroups.filter((g) =>
    searchQuery
      ? g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.description?.toLowerCase().includes(searchQuery.toLowerCase())
      : true
  );

  async function handleJoin(groupId: string) {
    setJoiningId(groupId);
    setJoinError(null);
    const result = await joinPublicGroup(groupId);
    if (result.error) {
      setJoinError(result.error);
    } else {
      startTransition(() => router.push("/dashboard"));
    }
    setJoiningId(null);
  }

  function handleCategoryChange(cat: string) {
    const url = cat ? `/explore?category=${cat}` : "/explore";
    startTransition(() => router.push(url));
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* 상단 헤더 */}
      <header className="sticky top-0 z-30 bg-white border-b border-zinc-200">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-500 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-zinc-600" />
              <span className="text-sm font-semibold text-zinc-900">그룹 탐색</span>
            </div>
          </div>
          <Link
            href="/onboarding"
            className="px-3 py-1.5 text-xs font-medium text-zinc-700 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
          >
            + 새 그룹
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {/* 검색 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="그룹 이름 또는 설명으로 검색"
            className="w-full pl-9 pr-4 py-2.5 border border-zinc-200 rounded-xl text-sm bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-shadow"
          />
        </div>

        {/* 카테고리 필터 */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => handleCategoryChange("")}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              !activeCategory
                ? "bg-zinc-900 text-white"
                : "bg-white border border-zinc-200 text-zinc-600 hover:border-zinc-300"
            }`}
          >
            전체
          </button>
          {GROUP_CATEGORIES.map((cat) => {
            const colors = CATEGORY_COLORS[cat as GroupCategory];
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => handleCategoryChange(cat)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  isActive
                    ? `${colors.bg} ${colors.text} border border-transparent`
                    : "bg-white border border-zinc-200 text-zinc-600 hover:border-zinc-300"
                }`}
              >
                {CATEGORY_LABELS[cat as GroupCategory]}
              </button>
            );
          })}
        </div>

        {/* 에러 */}
        {(error || joinError) && (
          <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl">
            {error || joinError}
          </div>
        )}

        {/* 결과 수 */}
        {filtered.length > 0 && (
          <p className="text-xs text-zinc-400">
            {filtered.length}개 그룹
          </p>
        )}

        {/* 그룹 목록 */}
        {isPending ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-zinc-200 p-5 animate-pulse">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-zinc-100 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-zinc-100 rounded w-1/3" />
                    <div className="h-3 bg-zinc-100 rounded w-2/3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 bg-zinc-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Globe className="w-7 h-7 text-zinc-400" />
            </div>
            <h3 className="text-sm font-medium text-zinc-900 mb-1">
              {searchQuery ? "검색 결과가 없습니다" : "공개 그룹이 없습니다"}
            </h3>
            <p className="text-sm text-zinc-500 mb-5">
              {searchQuery
                ? "다른 키워드로 검색하거나 카테고리를 바꿔보세요"
                : "첫 번째 공개 그룹을 만들어보세요"}
            </p>
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-800 transition-colors"
            >
              <Users className="w-4 h-4" />
              그룹 만들기
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((group) => {
              const catColors = group.category
                ? CATEGORY_COLORS[group.category]
                : null;
              const isJoining = joiningId === group.id;

              return (
                <div
                  key={group.id}
                  className="bg-white rounded-2xl border border-zinc-200 p-5 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-start gap-3">
                    {/* 아바타 */}
                    <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-bold text-sm">
                      {group.name.slice(0, 1).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-semibold text-zinc-900 leading-tight">
                              {group.name}
                            </h3>
                            {group.category && catColors && (
                              <span
                                className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${catColors.bg} ${catColors.text}`}
                              >
                                {CATEGORY_LABELS[group.category]}
                              </span>
                            )}
                          </div>
                          {group.description && (
                            <p className="mt-1 text-xs text-zinc-500 line-clamp-2 leading-relaxed">
                              {group.description}
                            </p>
                          )}
                          <div className="mt-2 flex items-center gap-1 text-xs text-zinc-400">
                            <Users className="w-3 h-3" />
                            <span>{group.member_count.toLocaleString()}명 참여 중</span>
                          </div>
                        </div>

                        {/* 참여 버튼 */}
                        <div className="flex-shrink-0">
                          {group.is_joined ? (
                            <Link
                              href={`/dashboard?team=${group.id}`}
                              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
                            >
                              바로가기
                            </Link>
                          ) : (
                            <button
                              onClick={() => handleJoin(group.id)}
                              disabled={isJoining}
                              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-zinc-900 rounded-lg hover:bg-zinc-800 disabled:opacity-50 transition-colors"
                            >
                              {isJoining ? "참여 중..." : "참여하기"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
