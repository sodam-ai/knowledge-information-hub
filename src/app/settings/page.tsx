"use client";

import { useActionState, useEffect, useState, Suspense } from "react";
import { updateTeam, regenerateInviteCode, getTeamInfo } from "@/actions/teams";
import { getCollections, createCollection, deleteCollection } from "@/actions/collections";
import type { ActionResult, Team, Collection } from "@/types";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Copy, Check, RefreshCw, SlidersHorizontal, Trash2, Plus } from "lucide-react";

const initialSaveState: ActionResult<boolean> = {};
const initialInviteState: ActionResult<string> = {};

function SettingsContent() {
  const searchParams = useSearchParams();
  const teamId = searchParams.get("team") ?? "";

  const [team, setTeam] = useState<Team | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!teamId) { setLoadError("그룹 ID가 없습니다."); return; }
    getTeamInfo(teamId).then((res) => {
      if (res.error) { setLoadError(res.error); return; }
      if (res.data) {
        setTeam(res.data);
        setInviteCode(res.data.invite_code ?? "");
      }
    });
    getCollections(teamId).then((res) => {
      if (res.data) setCollections(res.data);
    });
  }, [teamId]);

  const [saveState, saveAction, savePending] = useActionState(
    async (_: ActionResult<boolean>, formData: FormData): Promise<ActionResult<boolean>> => {
      const result = await updateTeam(teamId, {
        name: (formData.get("name") as string) || undefined,
        description: (formData.get("description") as string) || undefined,
      });
      if (result.error) return { error: result.error };
      // 저장 성공 시 로컬 상태도 업데이트
      const name = formData.get("name") as string;
      if (name && team) setTeam({ ...team, name });
      return { data: true };
    },
    initialSaveState
  );

  const [regenState, regenAction, regenPending] = useActionState(
    async (_: ActionResult<string>): Promise<ActionResult<string>> => {
      const result = await regenerateInviteCode(teamId);
      if (result.data) setInviteCode(result.data);
      return result;
    },
    initialInviteState
  );

  const handleCopy = () => {
    if (!inviteCode) return;
    navigator.clipboard.writeText(inviteCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const [createColState, createColAction, createColPending] = useActionState(
    async (_: ActionResult<Collection>, formData: FormData): Promise<ActionResult<Collection>> => {
      const name = formData.get("collection_name") as string;
      const result = await createCollection(teamId, name);
      if (result.error) return result;
      if (result.data) setCollections((prev) => [...prev, result.data!]);
      return {};
    },
    {} as ActionResult<Collection>
  );

  async function handleDeleteCollection(collectionId: string) {
    if (!confirm("컬렉션을 삭제할까요? 아이템은 그대로 유지됩니다.")) return;
    setDeletingId(collectionId);
    const result = await deleteCollection(collectionId);
    if (!result.error) setCollections((prev) => prev.filter((c) => c.id !== collectionId));
    setDeletingId(null);
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
        <div className="text-center space-y-3">
          <p className="text-sm text-red-500">{loadError}</p>
          <Link href="/dashboard" className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors">
            ← 대시보드로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-sm space-y-6">

        {/* 헤더 */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-zinc-900 rounded-2xl mb-4 shadow-sm">
            <SlidersHorizontal className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">그룹 설정</h1>
          {team && <p className="mt-1 text-sm text-zinc-500">{team.name}</p>}
        </div>

        {/* 섹션 1: 그룹 정보 변경 */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-zinc-900 mb-1">그룹 정보 변경</h2>
          <p className="text-xs text-zinc-400 mb-4">그룹 이름과 설명을 수정합니다</p>
          <form action={saveAction} className="space-y-3">
            {saveState.error && (
              <div className="p-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl text-center">
                {saveState.error}
              </div>
            )}
            {saveState.data === true && (
              <div className="p-3 text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-xl text-center">
                그룹 정보가 저장되었습니다.
              </div>
            )}
            <input
              type="text"
              name="name"
              defaultValue={team?.name ?? ""}
              placeholder="그룹 이름 (2~40자)"
              required
              minLength={2}
              maxLength={40}
              className="w-full px-4 py-3 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent bg-zinc-50"
            />
            <textarea
              name="description"
              defaultValue={team?.description ?? ""}
              placeholder="그룹 설명 (선택, 200자 이내)"
              maxLength={200}
              rows={3}
              className="w-full px-4 py-3 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent bg-zinc-50 resize-none"
            />
            <button
              type="submit"
              disabled={savePending || !team}
              className="w-full py-3 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {savePending ? "저장 중..." : "저장"}
            </button>
          </form>
        </div>

        {/* 섹션 2: 초대 코드 */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-zinc-900 mb-1">초대 코드</h2>
          <p className="text-xs text-zinc-400 mb-4">
            코드를 공유하면 누구나 그룹에 참여할 수 있습니다 (72시간 유효)
          </p>

          {regenState.error && (
            <div className="mb-3 p-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl text-center">
              {regenState.error}
            </div>
          )}

          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 px-4 py-3 border border-zinc-200 rounded-xl text-sm font-mono bg-zinc-50 text-zinc-900 truncate select-all">
              {inviteCode || "로딩 중..."}
            </div>
            <button
              onClick={handleCopy}
              disabled={!inviteCode}
              className="flex-shrink-0 p-3 border border-zinc-200 rounded-xl hover:bg-zinc-50 transition-colors disabled:opacity-40"
              title="복사"
            >
              {copied
                ? <Check className="w-4 h-4 text-emerald-500" />
                : <Copy className="w-4 h-4 text-zinc-500" />}
            </button>
          </div>

          <form action={regenAction}>
            <button
              type="submit"
              disabled={regenPending || !team}
              className="w-full flex items-center justify-center gap-2 py-2.5 border border-zinc-200 text-zinc-600 text-sm font-medium rounded-xl hover:bg-zinc-50 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${regenPending ? "animate-spin" : ""}`} />
              {regenPending ? "재발급 중..." : "새 코드 발급"}
            </button>
          </form>
        </div>

        {/* 섹션 3: 컬렉션 관리 */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-zinc-900 mb-1">컬렉션 관리</h2>
          <p className="text-xs text-zinc-400 mb-4">아이템을 폴더처럼 묶어 분류할 수 있습니다</p>

          {createColState.error && (
            <div className="mb-3 p-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl text-center">
              {createColState.error}
            </div>
          )}

          {collections.length > 0 && (
            <ul className="space-y-1.5 mb-4">
              {collections.map((c) => (
                <li key={c.id} className="flex items-center justify-between px-3 py-2 bg-zinc-50 rounded-xl">
                  <span className="text-sm text-zinc-800 truncate">{c.name}</span>
                  <button
                    onClick={() => handleDeleteCollection(c.id)}
                    disabled={deletingId === c.id}
                    className="p-1 text-zinc-400 hover:text-red-500 transition-colors disabled:opacity-40 flex-shrink-0"
                    title="삭제"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form action={createColAction} className="flex gap-2">
            <input
              type="text"
              name="collection_name"
              placeholder="새 컬렉션 이름 (최대 50자)"
              maxLength={50}
              required
              className="flex-1 px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent bg-zinc-50"
            />
            <button
              type="submit"
              disabled={createColPending || !team}
              className="flex items-center gap-1 px-3 py-2 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-800 disabled:opacity-50 transition-colors flex-shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              추가
            </button>
          </form>
        </div>

        {/* 하단 링크 */}
        <div className="text-center space-y-2">
          <div>
            <Link
              href={`/dashboard?team=${teamId}`}
              className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              ← 대시보드로 돌아가기
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="w-6 h-6 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin" />
      </div>
    }>
      <SettingsContent />
    </Suspense>
  );
}
