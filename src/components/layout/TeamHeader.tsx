"use client";

import { useState } from "react";
import { signOut } from "@/actions/site-auth";
import Link from "next/link";
import {
  ChevronDown,
  LogOut,
  Plus,
  Settings,
  LayoutGrid,
} from "lucide-react";
import type { Team, GroupCategory } from "@/types";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/types";

interface TeamHeaderProps {
  teams: Team[];
  activeTeam: Team;
  isAllView?: boolean;
}

export default function TeamHeader({ teams, activeTeam, isAllView }: TeamHeaderProps) {
  const [showMenu, setShowMenu] = useState(false);

  const catColors = activeTeam.category
    ? CATEGORY_COLORS[activeTeam.category as GroupCategory]
    : null;

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-zinc-200">
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-3">

        {/* 왼쪽: 그룹 이름 + 선택 드롭다운 */}
        <div className="relative min-w-0">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="flex items-center gap-2 min-w-0 hover:opacity-80 transition-opacity"
          >
            {isAllView ? (
              <div className="w-7 h-7 bg-zinc-900 text-white rounded-lg flex items-center justify-center flex-shrink-0">
                <LayoutGrid className="w-3.5 h-3.5" />
              </div>
            ) : (
              <div className="w-7 h-7 bg-zinc-900 text-white rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0">
                {activeTeam.name.slice(0, 1).toUpperCase()}
              </div>
            )}
            <span className="text-sm font-semibold text-zinc-900 truncate max-w-[100px] sm:max-w-[180px]">
              {isAllView ? "전체 피드" : activeTeam.name}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-zinc-400 flex-shrink-0 transition-transform ${showMenu ? "rotate-180" : ""}`}
            />
          </button>

          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-zinc-200 rounded-2xl shadow-lg z-20 overflow-hidden">

                {/* 전체 피드 옵션 */}
                <div className="p-1 border-b border-zinc-100">
                  <Link
                    href="/dashboard"
                    onClick={() => setShowMenu(false)}
                    className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm transition-colors ${
                      isAllView
                        ? "bg-zinc-100 text-zinc-900 font-medium"
                        : "text-zinc-700 hover:bg-zinc-50"
                    }`}
                  >
                    <div className="w-6 h-6 bg-zinc-900 rounded-lg flex items-center justify-center flex-shrink-0">
                      <LayoutGrid className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-sm">전체 피드</span>
                  </Link>
                </div>

                {/* 현재 그룹 정보 (specific team view) */}
                {!isAllView && (
                  <div className="px-3 py-3 border-b border-zinc-100">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-zinc-900 truncate">{activeTeam.name}</span>
                      {activeTeam.category && catColors && (
                        <span className={`flex-shrink-0 text-xs px-1.5 py-0.5 rounded-full font-medium ${catColors.bg} ${catColors.text}`}>
                          {CATEGORY_LABELS[activeTeam.category as GroupCategory]}
                        </span>
                      )}
                    </div>
                    {activeTeam.description && (
                      <p className="text-xs text-zinc-400 line-clamp-1">{activeTeam.description}</p>
                    )}
                  </div>
                )}

                {/* 그룹 목록 */}
                {teams.length > 0 && (
                  <div className="p-1">
                    {teams
                      .filter((t) => isAllView || t.id !== activeTeam.id)
                      .map((team) => (
                        <Link
                          key={team.id}
                          href={`/dashboard?team=${team.id}`}
                          onClick={() => setShowMenu(false)}
                          className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm transition-colors ${
                            !isAllView && team.id === activeTeam.id
                              ? "bg-zinc-100 text-zinc-900 font-medium"
                              : "text-zinc-700 hover:bg-zinc-50"
                          }`}
                        >
                          <div className="w-6 h-6 bg-zinc-200 rounded-lg flex items-center justify-center text-xs font-bold text-zinc-600 flex-shrink-0">
                            {team.name.slice(0, 1).toUpperCase()}
                          </div>
                          <span className="truncate text-sm">{team.name}</span>
                        </Link>
                      ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* 오른쪽: 액션 버튼 */}
        <div className="flex items-center gap-1 flex-shrink-0">

          {/* 새 그룹 만들기 */}
          <Link
            href="/onboarding"
            className="p-1.5 text-zinc-500 hover:bg-zinc-100 rounded-lg transition-colors"
            title="새 그룹 만들기"
            aria-label="새 그룹 만들기"
          >
            <Plus className="w-4 h-4" />
          </Link>

          {/* 관리자 설정 */}
          <Link
            href="/admin"
            className="p-1.5 text-zinc-500 hover:bg-zinc-100 rounded-lg transition-colors"
            title="관리자 설정"
            aria-label="관리자 설정"
          >
            <Settings className="w-4 h-4" />
          </Link>

          {/* 로그아웃 */}
          <form action={signOut}>
            <button
              type="submit"
              className="p-1.5 text-zinc-500 hover:bg-zinc-100 rounded-lg transition-colors"
              title="로그아웃"
              aria-label="로그아웃"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
