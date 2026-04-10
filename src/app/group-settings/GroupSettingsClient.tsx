"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateTeam,
  kickMember,
  transferAdmin,
  leaveTeam,
} from "@/actions/teams";
import { Crown, UserMinus, LogOut, Shield, ChevronDown } from "lucide-react";
import type { Team, GroupCategory } from "@/types";
import { CATEGORY_LABELS } from "@/types";
import { GROUP_CATEGORIES } from "@/lib/validations";

interface Member {
  id: string;
  name: string;
  email: string;
  role: "admin" | "member";
  joined_at: string;
}

interface GroupSettingsClientProps {
  team: Team;
  members: Member[];
  currentUserId: string;
  role: "admin" | "member";
}

export default function GroupSettingsClient({
  team,
  members: initialMembers,
  currentUserId,
  role,
}: GroupSettingsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [members, setMembers] = useState(initialMembers);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 그룹 정보 폼
  const [name, setName] = useState(team.name);
  const [description, setDescription] = useState(team.description ?? "");
  const [category, setCategory] = useState<string>(team.category ?? "");
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  function showMsg(type: "error" | "success", msg: string) {
    if (type === "error") { setError(msg); setSuccess(null); }
    else { setSuccess(msg); setError(null); }
    setTimeout(() => { setError(null); setSuccess(null); }, 3000);
  }

  function handleSaveGroup() {
    startTransition(async () => {
      const result = await updateTeam(team.id, { name, description, category });
      if (result.error) showMsg("error", result.error);
      else showMsg("success", "그룹 정보가 저장되었습니다.");
    });
  }

  function handleKick(userId: string, userName: string) {
    if (!confirm(`"${userName}"을(를) 강제 탈퇴시킬까요?`)) return;
    startTransition(async () => {
      const result = await kickMember(team.id, userId);
      if (result.error) showMsg("error", result.error);
      else {
        setMembers((prev) => prev.filter((m) => m.id !== userId));
        showMsg("success", `${userName}을(를) 탈퇴시켰습니다.`);
      }
    });
  }

  function handleTransfer(userId: string, userName: string) {
    if (!confirm(`"${userName}"에게 운영자 권한을 양도할까요?\n본인은 회원으로 변경됩니다.`)) return;
    startTransition(async () => {
      const result = await transferAdmin(team.id, userId);
      if (result.error) showMsg("error", result.error);
      else router.push(`/dashboard?team=${team.id}`);
    });
  }

  function handleLeave() {
    startTransition(async () => {
      const result = await leaveTeam(team.id);
      if (result.error) {
        showMsg("error", result.error);
        setShowLeaveConfirm(false);
      } else {
        router.push("/dashboard");
      }
    });
  }


  return (
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      {/* 전역 메시지 */}
      {error && (
        <div className="p-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl">{error}</div>
      )}
      {success && (
        <div className="p-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl">{success}</div>
      )}

      {/* 그룹 정보 (운영자만 수정) */}
      {role === "admin" && (
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-900">그룹 정보</h2>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-600">그룹 이름</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-600">설명 <span className="text-zinc-400">(선택)</span></label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              rows={2}
              placeholder="그룹을 한 줄로 소개해보세요"
              className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
            />
            <p className="text-xs text-zinc-400 text-right">{description.length}/200</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-600">카테고리</label>
            <div className="relative">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full appearance-none px-3 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent bg-white"
              >
                <option value="">선택 안 함</option>
                {GROUP_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{CATEGORY_LABELS[cat as GroupCategory]}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
            </div>
          </div>

          <button
            onClick={handleSaveGroup}
            disabled={isPending}
            className="px-4 py-2 bg-zinc-900 text-white text-xs font-medium rounded-xl hover:bg-zinc-800 disabled:opacity-50 transition-colors"
          >
            {isPending ? "저장 중..." : "저장"}
          </button>
        </div>
      )}

      {/* 멤버 목록 */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">멤버</h2>
          <span className="text-xs text-zinc-400">{members.length}명</span>
        </div>

        <div className="space-y-2">
          {members.map((member) => {
            const isMe = member.id === currentUserId;
            const joinDate = new Date(member.joined_at).toLocaleDateString("ko-KR", {
              year: "numeric", month: "short", day: "numeric",
            });

            return (
              <div
                key={member.id}
                className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-zinc-50 transition-colors"
              >
                <div className="w-8 h-8 bg-zinc-200 rounded-full flex items-center justify-center text-xs font-bold text-zinc-600 flex-shrink-0">
                  {member.name.slice(0, 1).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-zinc-900 truncate">
                      {member.name}
                      {isMe && <span className="text-zinc-400 font-normal"> (나)</span>}
                    </span>
                    {member.role === "admin" && (
                      <span className="flex-shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                        <Crown className="w-2.5 h-2.5" />
                        운영자
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 truncate">{joinDate} 참여</p>
                </div>

                {role === "admin" && !isMe && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {member.role === "member" && (
                      <button
                        onClick={() => handleTransfer(member.id, member.name)}
                        disabled={isPending}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-amber-500 hover:bg-amber-50 transition-all"
                        title="운영자 양도"
                      >
                        <Shield className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {member.role === "member" && (
                      <button
                        onClick={() => handleKick(member.id, member.name)}
                        disabled={isPending}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-all"
                        title="강제 탈퇴"
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 그룹 탈퇴 */}
      <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-red-700 mb-1">그룹 탈퇴</h2>
        <p className="text-xs text-zinc-500 mb-4">
          {role === "admin"
            ? "운영자는 다른 회원을 운영자로 지정한 후 탈퇴할 수 있습니다."
            : "탈퇴 후에는 초대 코드 없이 재참여할 수 없습니다."}
        </p>

        {!showLeaveConfirm ? (
          <button
            onClick={() => setShowLeaveConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            그룹 탈퇴
          </button>
        ) : (
          <div className="space-y-3 p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-xs text-red-700 font-medium">정말 탈퇴하시겠습니까?</p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="flex-1 py-2 text-xs border border-zinc-200 rounded-xl hover:bg-zinc-50 text-zinc-600 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleLeave}
                disabled={isPending}
                className="flex-1 py-2 text-xs font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {isPending ? "탈퇴 중..." : "탈퇴 확인"}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
