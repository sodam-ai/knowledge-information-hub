"use client";

import { useState } from "react";
import { deleteAccount } from "@/actions/auth";
import { AlertTriangle } from "lucide-react";

export default function AccountSettings() {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, setIsPending] = useState(false);

  async function handleDelete() {
    setIsPending(true);
    await deleteAccount();
    setIsPending(false);
  }

  return (
    <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-6">
      <h2 className="text-sm font-semibold text-red-700 mb-1">계정 탈퇴</h2>
      <p className="text-xs text-zinc-500 mb-4">
        탈퇴하면 개인정보(이름, 이메일)가 즉시 삭제됩니다.
        그룹에 저장한 링크·노트는 &apos;탈퇴한 사용자&apos;로 유지됩니다.
      </p>

      {!showConfirm ? (
        <button
          onClick={() => setShowConfirm(true)}
          className="px-4 py-2 text-xs font-medium text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors"
        >
          계정 탈퇴
        </button>
      ) : (
        <div className="space-y-3 p-4 bg-red-50 rounded-xl border border-red-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-red-700 space-y-1">
              <p className="font-medium">정말 탈퇴하시겠습니까?</p>
              <p>• 이름, 이메일이 즉시 삭제됩니다</p>
              <p>• 그룹 콘텐츠는 유지됩니다</p>
              <p>• 90일간 동일 이메일로 재가입이 불가합니다</p>
              <p>• 이 작업은 되돌릴 수 없습니다</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowConfirm(false)}
              className="flex-1 py-2 text-xs border border-zinc-200 rounded-xl hover:bg-zinc-50 transition-colors text-zinc-600"
            >
              취소
            </button>
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="flex-1 py-2 text-xs font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? "처리 중..." : "탈퇴 확인"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
