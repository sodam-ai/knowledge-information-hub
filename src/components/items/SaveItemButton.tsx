"use client";

import { useState, useActionState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createItem } from "@/actions/items";
import { getCollections } from "@/actions/collections";
import { useToast } from "@/components/ui/toast";
import {
  Plus, Link2, FileText, X, AlertCircle, Info,
  Loader2, Sparkles, Clipboard,
} from "lucide-react";
import type { ActionResult, Item, Collection, ItemCategory } from "@/types";
import { ITEM_CATEGORY_LABELS } from "@/types";

interface SaveItemButtonProps {
  teamId: string;
  prefillUrl?: string;
  open?: boolean;
  onClose?: () => void;
}

interface OgMeta {
  title?: string;
  description?: string;
  image?: string;
}

const OG_DEBOUNCE_MS = 600;

function isValidHttpsUrl(s: string): boolean {
  try {
    return new URL(s).protocol === "https:";
  } catch {
    return false;
  }
}

const initialState: ActionResult<Item> = {};

function extractTagKeywords(og: OgMeta): string[] {
  const combined = `${og.title ?? ""} ${og.description ?? ""}`;
  const tokens = combined
    .split(/[\s\-_|·•,.:;!?'"()\[\]{}\/\\]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && t.length <= 20);
  const stopWords = new Set(["the", "and", "for", "with", "from", "are", "was", "has", "not", "you", "our", "can", "this", "that", "how", "what", "get", "its", "all", "more", "your"]);
  const seen = new Set<string>();
  return tokens
    .filter((t) => !stopWords.has(t.toLowerCase()))
    .filter((t) => { const l = t.toLowerCase(); if (seen.has(l)) return false; seen.add(l); return true; })
    .slice(0, 6);
}

// ── Dialog (분리된 컴포넌트 — 마운트 시 슬라이드 애니메이션 트리거) ──────────
interface DialogProps {
  onClose: () => void;
  children: React.ReactNode;
}

function BottomSheetDialog({ onClose, children }: DialogProps) {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <>
      {/* 오버레이 */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 외부 래퍼: 포지셔닝 (모바일=바텀, 데스크톱=중앙) */}
      <div
        className={`
          fixed z-50
          bottom-0 left-0 right-0
          sm:left-1/2 sm:right-auto sm:bottom-auto sm:top-1/2
          sm:-translate-x-1/2 sm:-translate-y-1/2
          sm:w-full sm:max-w-md
        `}
        role="dialog"
        aria-modal="true"
        aria-label="새 항목 저장"
      >
        {/* 내부 래퍼: 비주얼 + 슬라이드 애니메이션 (모바일 전용) */}
        <div
          className={`
            bg-white shadow-2xl overflow-y-auto
            rounded-t-2xl max-h-[92dvh]
            sm:rounded-2xl sm:border sm:border-zinc-200 sm:max-h-[85vh] sm:shadow-xl
            transition-transform duration-300 ease-out
            sm:transition-none sm:translate-y-0
            ${entered ? "translate-y-0" : "translate-y-full"}
          `}
        >
          {/* Handle bar — 모바일 전용 */}
          <div className="flex justify-center pt-3 pb-0 sm:hidden" aria-hidden="true">
            <div className="w-10 h-1 rounded-full bg-zinc-200" />
          </div>
          {children}
        </div>
      </div>
    </>
  );
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────────
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
  const { success, warning } = useToast();
  const [activeTab, setActiveTab] = useState<"link" | "note">("link");
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [titleFailed, setTitleFailed] = useState(false);
  const [saveCollections, setSaveCollections] = useState<Collection[]>([]);
  const formRef = useRef<HTMLFormElement>(null);

  // ── OG 미리보기 상태 ──────────────────────────────────────────────────────
  const [urlValue, setUrlValue] = useState(prefillUrl ?? "");
  const [ogMeta, setOgMeta] = useState<OgMeta | null>(null);
  const [ogLoading, setOgLoading] = useState(false);
  const [titleOverride, setTitleOverride] = useState("");
  const [clipboardHint, setClipboardHint] = useState(false);
  const [tagsValue, setTagsValue] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchOg = useCallback(async (url: string) => {
    if (!isValidHttpsUrl(url)) {
      setOgMeta(null);
      setTitleOverride("");
      return;
    }
    setOgLoading(true);
    try {
      const res = await fetch(`/api/og?url=${encodeURIComponent(url)}`);
      if (res.ok) {
        const data: OgMeta = await res.json();
        setOgMeta(data);
        if (data.title) setTitleOverride(data.title);
      }
    } catch {
      // OG 실패는 무시 — 서버가 제목을 추출합니다
    } finally {
      setOgLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!urlValue) {
      setOgMeta(null);
      setTitleOverride("");
      return;
    }
    debounceRef.current = setTimeout(() => fetchOg(urlValue), OG_DEBOUNCE_MS);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [urlValue, open, fetchOg]);

  // 다이얼로그 열릴 때 초기화
  useEffect(() => {
    if (open) {
      setUrlValue(prefillUrl ?? "");
      setOgMeta(null);
      setTitleOverride("");
      setDuplicateWarning(null);
      setTitleFailed(false);
      setTagsValue("");
      getCollections(teamId).then((res) => { if (res.data) setSaveCollections(res.data); });
    } else {
      setSaveCollections([]);
    }
  }, [open, prefillUrl, teamId]);

  // ── 열기 — 클립보드 URL 자동 감지 ────────────────────────────────────────
  const handleOpen = useCallback(async () => {
    let detected = "";
    try {
      const text = await navigator.clipboard.readText();
      if (isValidHttpsUrl(text)) {
        detected = text;
        setClipboardHint(true);
        setTimeout(() => setClipboardHint(false), 2500);
      }
    } catch {
      // 클립보드 권한 없으면 무시
    }
    if (detected) setUrlValue(detected);
    setOpen(true);
  }, [setOpen]);

  // ── Server Action ─────────────────────────────────────────────────────────
  const boundAction = createItem.bind(null, teamId);
  const [state, formAction, isPending] = useActionState(
    async (prev: ActionResult<Item>, formData: FormData) => {
      setDuplicateWarning(null);
      setTitleFailed(false);
      const result = await boundAction(prev, formData);

      if (result.error === "title_failed") {
        formRef.current?.reset();
        setOpen(false);
        router.refresh();
        warning("저장됐어요 — 제목 자동 추출 실패, 직접 수정해보세요.");
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
        success("저장되었어요!");
      }
      return result;
    },
    initialState
  );

  const suggestedTags = ogMeta ? extractTagKeywords(ogMeta) : [];

  function addSuggestedTag(tag: string) {
    const current = tagsValue.split(",").map((t) => t.trim()).filter(Boolean);
    if (!current.includes(tag)) {
      setTagsValue(current.length > 0 ? `${tagsValue.trimEnd()}, ${tag}` : tag);
    }
  }

  // ── 닫힌 상태: 버튼만 ─────────────────────────────────────────────────────
  if (!open) {
    return (
      <button
        onClick={handleOpen}
        className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-800 active:scale-[0.97] transition-all shadow-sm"
      >
        <Plus className="w-4 h-4" />
        저장하기
      </button>
    );
  }

  // ── 열린 상태: 다이얼로그 ────────────────────────────────────────────────
  return (
    <BottomSheetDialog onClose={() => setOpen(false)}>
      {/* 헤더 */}
      <div className="flex items-center justify-between px-5 pt-4 pb-0 sm:pt-5">
        <h2 className="text-base font-semibold text-zinc-900">새 항목 저장</h2>
        <button
          onClick={() => setOpen(false)}
          className="p-1.5 rounded-xl hover:bg-zinc-100 text-zinc-400 transition-colors"
          aria-label="닫기"
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

      <form ref={formRef} action={formAction} className="px-4 pt-3 pb-4 sm:p-5 space-y-3">
        <input type="hidden" name="type" value={activeTab} />

        {/* 서버 에러 */}
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
              이미 저장된 링크예요: <strong>{duplicateWarning}</strong>
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
          <div className="space-y-2.5">
            {/* URL 입력 */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-600">
                URL <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <input
                  name="url"
                  type="url"
                  value={urlValue}
                  onChange={(e) => setUrlValue(e.target.value)}
                  required
                  placeholder="https://example.com"
                  className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-shadow"
                />
                {/* 클립보드 감지 힌트 */}
                {clipboardHint && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-emerald-600 font-medium pointer-events-none">
                    <Clipboard className="w-3 h-3" />
                    자동 입력됨
                  </span>
                )}
              </div>
            </div>

            {/* 제목 (OG 자동 추출 + 편집 가능) */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-600">
                제목
                {ogLoading && <Loader2 className="w-3 h-3 animate-spin text-zinc-400" />}
                {ogMeta?.title && !ogLoading && (
                  <span className="inline-flex items-center gap-0.5 text-zinc-400 font-normal">
                    <Sparkles className="w-3 h-3 text-amber-400" />자동 추출됨
                  </span>
                )}
              </label>
              <input
                name="title"
                type="text"
                value={titleOverride}
                onChange={(e) => setTitleOverride(e.target.value)}
                maxLength={500}
                placeholder={ogLoading ? "추출 중..." : "비워두면 자동 추출"}
                className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-shadow"
              />
            </div>

            {/* OG 미리보기 카드 */}
            {ogMeta?.image && (
              <div className="flex items-center gap-3 p-2.5 bg-zinc-50 border border-zinc-100 rounded-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={ogMeta.image}
                  alt=""
                  className="w-14 h-10 object-cover rounded-lg flex-shrink-0 bg-zinc-200"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
                {ogMeta.description && (
                  <p className="text-xs text-zinc-400 line-clamp-2 flex-1 min-w-0">
                    {ogMeta.description}
                  </p>
                )}
              </div>
            )}
            <input type="hidden" name="og_image" value={ogMeta?.image ?? ""} />

            {/* 메모 (선택) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-600">
                메모 <span className="text-zinc-400 font-normal">(선택)</span>
              </label>
              <textarea
                name="content"
                placeholder="이 링크에 대한 개인 메모..."
                rows={2}
                maxLength={2000}
                className="w-full px-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-xl resize-none placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 focus:border-zinc-400 transition-colors"
              />
            </div>
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

        {/* 카테고리 */}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-zinc-600">카테고리</label>
          <select
            key={activeTab}
            name="category"
            defaultValue={activeTab === "note" ? "idea" : ""}
            className="w-full px-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-zinc-400 focus:border-zinc-400 transition-colors appearance-none"
          >
            <option value="">자동 감지</option>
            {(Object.entries(ITEM_CATEGORY_LABELS) as [ItemCategory, string][]).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-zinc-600">
            태그{" "}
            <span className="text-zinc-400 font-normal">(쉼표로 구분, 최대 10개)</span>
          </label>
          <input
            name="tags"
            type="text"
            value={tagsValue}
            onChange={(e) => setTagsValue(e.target.value)}
            placeholder="AI, 디자인, 참고자료"
            className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-shadow"
          />
          {activeTab === "link" && suggestedTags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {suggestedTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => addSuggestedTag(tag)}
                  className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-colors"
                >
                  <Plus className="w-2.5 h-2.5" />
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {saveCollections.length > 0 && (
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-zinc-600">
              컬렉션 <span className="text-zinc-400 font-normal">(선택)</span>
            </label>
            <select
              name="collection_id"
              className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
            >
              <option value="">없음</option>
              {saveCollections.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex gap-2 pt-1 pb-1 sm:pb-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex-1 py-2.5 border border-zinc-200 text-sm font-medium text-zinc-700 rounded-xl hover:bg-zinc-50 active:scale-[0.98] transition-all"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 py-2.5 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-50 transition-all"
          >
            {isPending ? (
              <span className="flex items-center justify-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />저장 중...
              </span>
            ) : "저장"}
          </button>
        </div>
      </form>
    </BottomSheetDialog>
  );
}
