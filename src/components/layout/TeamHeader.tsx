"use client";

import { useState } from "react";
import { signOut } from "@/actions/auth";
import { leaveTeam, regenerateInviteCode } from "@/actions/teams";
import Link from "next/link";
import {
  ChevronDown,
  Copy,
  LogOut,
  Settings,
  Users,
  Globe,
  Lock,
  Check,
  Plus,
  RefreshCw,
} from "lucide-react";
import type { Team, GroupCategory } from "@/types";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/types";

interface TeamHeaderProps {
  teams: (Team & { role: "admin" | "member" })[];
  activeTeam: Team & { role: "admin" | "member" };
  userId: string;
}

export default function TeamHeader({ teams, activeTeam }: TeamHeaderProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteCode, setInviteCode] = useState(activeTeam.invite_code);
  const [copied, setCopied] = useState(false);
  const [isRegenPending, setIsRegenPending] = useState(false);

  const inviteLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/join?code=${inviteCode}`
      : `/join?code=${inviteCode}`;

  async function handleCopyInvite() {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleRegenCode() {
    if (!confirm("초대 코드를 재발급하면 기존 링크가 무효화됩니다. 계속할까요?")) return;
    setIsRegenPending(true);
    const result = await regenerateInviteCode(activeTeam.id);
    if (result.data) setInviteCode(result.data);
    setIsRegenPending(false);
  }

  const catColors = activeTeam.category
    ? CATEGORY_COLORS[activeTeam.category as GroupCategory]
    : null;

  const inviteExpiry = new Date(activeTeam.invite_expires_at);
  const isExpired = inviteExpiry < new Date();

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-zinc-200">
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-3">

        {/* 왼쪽: 그룹 이름 + 선택 드롭다운 */}
        <div className="relative min-w-0">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="flex items-center gap-2 min-w-0 hover:opacity-80 transition-opacity"
          >
            <div className="w-7 h-7 bg-zinc-900 text-white rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0">
              {activeTeam.name.slice(0, 1).toUpperCase()}
            </div>
            <span className="text-sm font-semibold text-zinc-900 truncate max-w-[140px]">
              {activeTeam.name}
            </span>
            {activeTeam.is_public ? (
              <Globe className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
            )}
            <ChevronDown
              className={`w-3.5 h-3.5 text-zinc-400 flex-shrink-0 transition-transform ${showMenu ? "rotate-180" : ""}`}
            />
          </button>

          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-zinc-200 rounded-2xl shadow-lg z-20 overflow-hidden">

                {/* 현재 그룹 정보 */}
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
                  <p className="text-xs text-zinc-400 mt-1">
                    {activeTeam.role === "admin" ? "운영자" : "회원"}
                  </p>
                </div>

                {/* 그룹 목록 */}
                {teams.length > 1 && (
                  <div className="p-1 border-b border-zinc-100">
                    {teams
                      .filter((t) => t.id !== activeTeam.id)
                      .map((team) => (
                        <Link
                          key={team.id}
                          href={`/dashboard?team=${team.id}`}
                          onClick={() => setShowMenu(false)}
                          className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
                        >
                          <div className="w-6 h-6 bg-zinc-200 rounded-lg flex items-center justify-center text-xs font-bold text-zinc-600 flex-shrink-0">
                            {team.name.slice(0, 1).toUpperCase()}
                          </div>
                          <span className="truncate text-sm">{team.name}</span>
                          {team.is_public ? (
                            <Globe className="w-3 h-3 text-zinc-400 ml-auto flex-shrink-0" />
                          ) : (
                            <Lock className="w-3 h-3 text-zinc-400 ml-auto flex-shrink-0" />
                          )}
                        </Link>
                      ))}
                  </div>
                )}

                <div className="p-1">
                  <Link
                    href="/explore"
                    onClick={() => setShowMenu(false)}
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm text-zinc-600 hover:bg-zinc-50 transition-colors"
                  >
                    <Globe className="w-4 h-4 text-zinc-400" />
                    그룹 탐색
                  </Link>
                  <Link
                    href="/onboarding"
                    onClick={() => setShowMenu(false)}
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm text-zinc-600 hover:bg-zinc-50 transition-colors"
                  >
                    <Plus className="w-4 h-4 text-zinc-400" />
                    새 그룹 만들기
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>

        {/* 오른쪽: 액션 버튼 */}
        <div className="flex items-center gap-1 flex-shrink-0">

          {/* 초대 */}
          <div className="relative">
            <button
              onClick={() => setShowInvite(!showInvite)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
            >
              <Users className="w-3.5 h-3.5" />
              <span className="hidden sm:block">초대</span>
            </button>

            {showInvite && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowInvite(false)} />
                <div className="absolute top-full right-0 mt-2 w-72 bg-white border border-zinc-200 rounded-2xl shadow-lg z-20 p-4 space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-zinc-900 mb-2">참여 링크</p>
                    <div className="flex items-center gap-2">
                      <input
                        readOnly
                        value={inviteLink}
                        className="flex-1 px-2.5 py-2 text-xs border border-zinc-200 rounded-lg bg-zinc-50 text-zinc-700 truncate font-mono"
                      />
                      <button
                        onClick={handleCopyInvite}
                        className={`flex-shrink-0 p-2 rounded-lg transition-all ${
                          copied
                            ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                            : "border border-zinc-200 hover:bg-zinc-50 text-zinc-500"
                        }`}
                      >
                        {copied ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                    {copied && (
                      <p className="text-xs text-emerald-600 mt-1">복사되었습니다!</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span>
                      만료:{" "}
                      {isExpired ? (
                        <span className="text-red-500">만료됨</span>
                      ) : (
                        inviteExpiry.toLocaleString("ko-KR", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      )}
                    </span>
                  </div>

                  {activeTeam.role === "admin" && (
                    <button
                      onClick={handleRegenCode}
                      disabled={isRegenPending}
                      className="w-full py-2 flex items-center justify-center gap-1.5 text-xs text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50 disabled:opacity-50 transition-colors"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isRegenPending ? "animate-spin" : ""}`} />
                      {isRegenPending ? "재발급 중..." : "코드 재발급"}
                    </button>
                  )}

                  <p className="text-xs text-zinc-400">
                    링크 공유 시 72시간 동안 유효합니다.
                  </p>
                </div>
              </>
            )}
          </div>

          {/* 설정 */}
          <Link
            href="/settings"
            className="p-1.5 text-zinc-500 hover:bg-zinc-100 rounded-lg transition-colors"
            title="설정"
          >
            <Settings className="w-4 h-4" />
          </Link>

          {/* 로그아웃 */}
          <form action={signOut}>
            <button
              type="submit"
              className="p-1.5 text-zinc-500 hover:bg-zinc-100 rounded-lg transition-colors"
              title="로그아웃"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
