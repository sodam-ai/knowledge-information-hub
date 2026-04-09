"use client";

import { useState, useActionState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createItem } from "@/actions/items";
import { Plus, Link2, FileText, X, AlertCircle, Info } from "lucide-react";
import type { ActionResult, Item } from "@/types";

interface SaveItemButtonProps {
  teamId: string;
  prefillUrl?: string;
  open?: boolean;
  onClose?: () => void;
}

const initialState: ActionResult<Item> = {};

export default function SaveItemButton({
  teamId,
  prefillUrl,
  open: controlledOpen,
  onClose,
}: SaveItemButtonProps) {
  const [internalOpen, setInternalOpen] = useState(!!prefillUrl);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onClose
    ? (v: boolean) => { if (!v) onClose(); }
    : setInternalOpen;

  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"link" | "note">("link");
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [titleFailed, setTitleFailed] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const boundAction = createItem.bind(null, teamId);
  const [state, formAction, isPending] = useActionState(
    async (prev: ActionResult<Item>, formData: FormData) => {
      setDuplicateWarning(null);
      setTitleFailed(false);
      const result = await boundAction(prev, formData);

      if (result.error === "title_failed") {
        setTitleFailed(true);
        return {};
      }
      if (result.error?.startsWith("duplicate:")) {
        setDuplicateWarning(result.error.replace("duplicate:", ""));
        return {};
      }
      if (!result.error) {
        formRef.current?.reset();
        setOpen(false);
        router.refresh();
      }
      return result;
    },
    initialState
  );

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-800 transition-colors shadow-sm"
      >
        <Plus className="w-4 h-4" />
        저장하기
      </button>
    );
  }

  return (
    <>
      {/* 오버레이 */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
        onClick={() => setOpen(false)}
      />

      {/* 다이얼로그 */}
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-md z-50 bg-white rounded-2xl shadow-xl border border-zinc-200">

        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 pt-5 pb-0">
          <h2 className="text-base font-semibold text-zinc-900">새 항목 저장</h2>
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-xl hover:bg-zinc-100 text-zinc-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 탭 */}
        <div className="flex gap-0 mt-4 mx-5 bg-zinc-100 rounded-xl p-1">
          {(["link", "note"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg transition-all ${
                activeTab === tab
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              {tab === "link" ? (
                <><Link2 className="w-3.5 h-3.5" /> 링크</>
              ) : (
                <><FileText className="w-3.5 h-3.5" /> 노트</>
              )}
            </button>
          ))}
        </div>

        <form ref={formRef} action={formAction} className="p-5 space-y-3.5">
          <input type="hidden" name="type" value={activeTab} />

          {/* 에러 */}
          {state.error && (
            <div className="flex items-start gap-2 p-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              {state.error}
            </div>
          )}

          {/* 중복 경고 */}
          {duplicateWarning && (
            <div className="flex items-start gap-2 p-3 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>
                이미 저장된 링크예요:{" "}
                <strong>{duplicateWarning}</strong>
                <br />
                <span className="text-amber-600">그래도 저장하려면 다시 제출하세요.</span>
              </span>
            </div>
          )}

          {/* 제목 추출 실패 */}
          {titleFailed && (
            <div className="flex items-start gap-2 p-3 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-xl">
              <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              제목 자동 추출에 실패했어요. URL로 저장되었으니 직접 수정해보세요.
            </div>
          )}

          {activeTab === "link" ? (
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-600">
                URL <span className="text-red-400">*</span>
              </label>
              <input
                name="url"
                type="url"
                defaultValue={prefillUrl}
                required
                placeholder="https://example.com"
                className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-shadow"
              />
              <p className="text-xs text-zinc-400">제목은 자동으로 추출됩니다.</p>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-600">
                  제목 <span className="text-red-400">*</span>
                </label>
                <input
                  name="title"
                  type="text"
                  required
                  maxLength={500}
                  placeholder="메모 제목"
                  className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-shadow"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-600">
                  내용 <span className="text-red-400">*</span>
                </label>
                <textarea
                  name="content"
                  required
                  maxLength={50000}
                  rows={4}
                  placeholder="내용을 입력하세요..."
                  className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-shadow resize-none"
                />
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-zinc-600">
              태그{" "}
              <span className="text-zinc-400 font-normal">(쉼표로 구분, 최대 10개)</span>
            </label>
            <input
              name="tags"
              type="text"
              placeholder="AI, 디자인, 참고자료"
              className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-shadow"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex-1 py-2.5 border border-zinc-200 text-sm font-medium text-zinc-700 rounded-xl hover:bg-zinc-50 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-2.5 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-800 disabled:opacity-50 transition-colors"
            >
              {isPending ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
