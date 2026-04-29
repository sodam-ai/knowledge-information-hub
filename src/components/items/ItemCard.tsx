"use client";

import { useState, useEffect, useCallback } from "react";
import { softDeleteItem, updateItem, togglePinItem } from "@/actions/items";
import { moveItemToCollection } from "@/actions/collections";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/utils";
import type { Item, Tag, Collection, ItemCategory } from "@/types";
import { ITEM_CATEGORY_LABELS, ITEM_CATEGORY_COLORS } from "@/types";
import {
  Link2, FileText, Paperclip, Trash2, ExternalLink, Pencil,
  Pin, PinOff, X, Check, Users, ChevronDown, ChevronUp,
  Calendar, Hash, FolderOpen,
} from "lucide-react";

interface ItemCardProps {
  item: Item & { tags?: Tag[]; teamName?: string };
  onTagClick?: (tagName: string) => void;
  collections?: Collection[];
}

// ── 상세 시트 ──────────────────────────────────────────────────────────────────

interface DetailSheetProps {
  item: Item & { tags?: Tag[]; teamName?: string };
  onClose: () => void;
  onEditClick: () => void;
  onDeleteClick: () => void;
}

function DetailSheet({ item, onClose, onEditClick, onDeleteClick }: DetailSheetProps) {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Esc 키 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <>
      {/* 오버레이 */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 외부 래퍼: 포지셔닝 */}
      <div
        className={`
          fixed z-50
          bottom-0 left-0 right-0
          sm:left-1/2 sm:right-auto sm:bottom-auto sm:top-1/2
          sm:-translate-x-1/2 sm:-translate-y-1/2
          sm:w-full sm:max-w-lg
        `}
        role="dialog"
        aria-modal="true"
        aria-label={item.title}
      >
        {/* 내부 래퍼: 비주얼 + 슬라이드 */}
        <div
          className={`
            bg-white shadow-2xl overflow-y-auto
            rounded-t-2xl max-h-[88vh]
            sm:rounded-2xl sm:border sm:border-zinc-200 sm:max-h-[80vh] sm:shadow-xl
            transition-transform duration-300 ease-out
            sm:transition-none sm:translate-y-0
            ${entered ? "translate-y-0" : "translate-y-full"}
          `}
        >
          {/* Handle bar */}
          <div className="flex justify-center pt-3 pb-0 sm:hidden" aria-hidden="true">
            <div className="w-10 h-1 rounded-full bg-zinc-200" />
          </div>

          {/* 썸네일 (링크 + 이미지 있을 때) */}
          {item.type === "link" && item.thumbnail_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.thumbnail_url}
              alt=""
              className="w-full h-40 object-cover sm:rounded-t-2xl bg-zinc-100"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          )}

          <div className="px-5 pt-4 pb-6 space-y-4">
            {/* 헤더: 제목 + 닫기 */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2 min-w-0">
                {item.type === "link" ? (
                  <Link2 className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                ) : item.type === "file" ? (
                  <Paperclip className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <FileText className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                )}
                <h2 className="text-base font-semibold text-zinc-900 leading-snug">
                  {item.title}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="flex-shrink-0 p-1.5 rounded-xl hover:bg-zinc-100 text-zinc-400 transition-colors"
                aria-label="닫기"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 링크 URL */}
            {item.type === "link" && item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition-colors group"
              >
                <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate flex-1 min-w-0">{item.url}</span>
                <span className="text-xs text-zinc-400 group-hover:text-blue-400 flex-shrink-0">열기 →</span>
              </a>
            )}

            {/* 파일 다운로드 */}
            {item.type === "file" && item.file_path && (
              <a
                href={item.file_path}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="flex items-center gap-2 px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-emerald-700 hover:bg-emerald-50 hover:border-emerald-200 transition-colors group"
              >
                <Paperclip className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate flex-1 min-w-0">{item.title}</span>
                <span className="text-xs text-zinc-400 group-hover:text-emerald-500 flex-shrink-0">다운로드 →</span>
              </a>
            )}

            {/* 노트 본문 */}
            {item.type === "note" && item.content && (
              <div className="px-3 py-3 bg-zinc-50 rounded-xl border border-zinc-100">
                <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">
                  {item.content}
                </p>
              </div>
            )}

            {/* 태그 */}
            {(item.tags?.length ?? 0) > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <Hash className="w-3.5 h-3.5 text-zinc-300 flex-shrink-0" />
                {item.tags?.map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600"
                    style={
                      tag.color
                        ? { backgroundColor: `${tag.color}18`, color: tag.color }
                        : undefined
                    }
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            )}

            {/* 메타 정보 */}
            <div className="flex items-center gap-3 text-xs text-zinc-400">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatDate(item.created_at)}
              </span>
              {item.teamName && (
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {item.teamName}
                </span>
              )}
            </div>

            {/* 액션 버튼 */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => { onEditClick(); }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-zinc-200 text-sm font-medium text-zinc-700 rounded-xl hover:bg-zinc-50 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
                수정
              </button>
              <button
                onClick={() => { onDeleteClick(); onClose(); }}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 border border-red-100 text-sm font-medium text-red-500 rounded-xl hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                삭제
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── 메인 카드 ──────────────────────────────────────────────────────────────────

export default function ItemCard({ item: initialItem, onTagClick, collections }: ItemCardProps) {
  const [item, setItem] = useState(initialItem);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isPinning, setIsPinning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  const { success, error: toastError } = useToast();

  const NOTE_PREVIEW_LIMIT = 80;
  const isLongNote =
    item.type === "note" && (item.content?.length ?? 0) > NOTE_PREVIEW_LIMIT;

  const [editTitle, setEditTitle] = useState(item.title);
  const [editContent, setEditContent] = useState(item.content ?? "");
  const [editTags, setEditTags] = useState(
    item.tags?.map((t) => t.name).join(", ") ?? ""
  );
  const [editCollectionId, setEditCollectionId] = useState<string | null>(item.collection_id);
  const [editCategory, setEditCategory] = useState<ItemCategory | null>(item.category);
  const [editError, setEditError] = useState<string | null>(null);

  const handleDelete = useCallback(async () => {
    if (!confirm("이 항목을 삭제할까요? 30일 안에 복구할 수 있습니다.")) return;
    setIsDeleting(true);
    const result = await softDeleteItem(item.id);
    if (!result.error) {
      setDeleted(true);
      success("항목이 삭제되었어요.");
    } else {
      toastError("삭제 중 오류가 발생했어요.");
    }
    setIsDeleting(false);
  }, [item.id, success, toastError]);

  async function handlePin(e: React.MouseEvent) {
    e.stopPropagation();
    setIsPinning(true);
    const result = await togglePinItem(item.id);
    if (!result.error && result.data !== undefined) {
      setItem((prev) => ({ ...prev, is_pinned: result.data! }));
      success(result.data ? "핀 고정되었어요." : "핀이 해제되었어요.");
    } else if (result.error) {
      toastError("핀 처리 중 오류가 발생했어요.");
    }
    setIsPinning(false);
  }

  function handleEditOpen(e?: React.MouseEvent) {
    e?.stopPropagation();
    setEditTitle(item.title);
    setEditContent(item.content ?? "");
    setEditTags(item.tags?.map((t) => t.name).join(", ") ?? "");
    setEditCollectionId(item.collection_id);
    setEditCategory(item.category);
    setEditError(null);
    setIsEditing(true);
    setShowDetail(false);
  }

  async function handleEditSave() {
    if (!editTitle.trim()) {
      setEditError("제목을 입력해주세요.");
      return;
    }
    setIsSaving(true);
    setEditError(null);

    const result = await updateItem(item.id, {
      title: editTitle,
      content: item.type === "note" ? editContent : undefined,
      tags: editTags,
      category: editCategory,
    });

    if (result.error) {
      setEditError(result.error);
      setIsSaving(false);
      return;
    }

    if (editCollectionId !== item.collection_id) {
      await moveItemToCollection(item.id, editCollectionId);
    }

    setItem((prev) => ({
      ...prev,
      title: editTitle,
      content: item.type === "note" ? editContent : prev.content,
      collection_id: editCollectionId,
      category: editCategory,
      tags: editTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .map((name) => ({ id: name, name, color: null, team_id: prev.team_id })),
    }));
    setIsSaving(false);
    setIsEditing(false);
    success("수정되었어요.");
  }

  function handleCardClick() {
    if (isEditing) return;
    setShowDetail(true);
  }

  if (deleted) return null;

  let hostname = "";
  try {
    if (item.url) hostname = new URL(item.url).hostname.replace(/^www\./, "");
  } catch {
    hostname = "";
  }

  return (
    <>
      <article
        onClick={handleCardClick}
        className={`group bg-white rounded-lg border transition-all duration-150 cursor-pointer select-none ${
          item.is_pinned
            ? "border-amber-200 shadow-sm"
            : "border-zinc-200 hover:border-zinc-300 hover:shadow-sm"
        }`}
      >
        <div className="px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            {/* 타입 아이콘 */}
            <div className="flex-shrink-0">
              {item.type === "link" ? (
                <Link2 className="w-3.5 h-3.5 text-blue-400" />
              ) : item.type === "file" ? (
                <Paperclip className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-amber-400" />
              )}
            </div>

            {/* 중앙 콘텐츠 */}
            <div className="flex-1 min-w-0">
              {/* 행 1: 핀 + 제목 */}
              <div className="flex items-center gap-1 min-w-0">
                {item.is_pinned && (
                  <Pin className="w-2.5 h-2.5 text-amber-400 flex-shrink-0" />
                )}
                <h3 className="text-sm font-medium text-zinc-900 truncate leading-snug">
                  {item.type === "link" && item.url ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="hover:text-blue-600 transition-colors duration-150 inline-flex items-center gap-1 max-w-full"
                    >
                      <span className="truncate">{item.title}</span>
                      <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-0 group-hover:opacity-40 transition-opacity" />
                    </a>
                  ) : (
                    item.title
                  )}
                </h3>
              </div>

              {/* 행 2: 메타 — 줄바꿈 없음 */}
              <div className="flex items-center gap-1.5 mt-0.5 overflow-hidden">
                {item.type === "link" && hostname && (
                  <span className="text-xs text-zinc-400 truncate flex-shrink min-w-0 max-w-[60px] sm:max-w-[80px]">
                    {hostname}
                  </span>
                )}
                {item.type === "file" && item.file_mime && (
                  <span className="text-xs text-zinc-400 flex-shrink-0 font-medium">
                    {item.file_mime.split("/")[1]?.toUpperCase() ?? "파일"}
                  </span>
                )}
                {item.type === "link" && item.content && (
                  <span className="text-xs text-zinc-400 truncate flex-shrink min-w-0 max-w-[100px] sm:max-w-[150px] line-clamp-1">
                    {item.content}
                  </span>
                )}
                {item.type === "note" && item.content && !isExpanded && (
                  <span className="text-xs text-zinc-400 truncate flex-shrink min-w-0 max-w-[80px] sm:max-w-[120px]">
                    {item.content}
                  </span>
                )}
                {item.type === "note" && item.content && isExpanded && (
                  <span className="text-xs text-zinc-400 flex-shrink min-w-0">
                    {item.content}
                  </span>
                )}
                {isLongNote && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                    className="text-zinc-300 hover:text-zinc-500 transition-colors flex-shrink-0"
                    aria-label={isExpanded ? "접기" : "펼치기"}
                  >
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                )}

                {item.teamName && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium bg-zinc-900 text-white flex-shrink-0">
                    <Users className="w-2 h-2" />
                    {item.teamName}
                  </span>
                )}

                {item.collection_id && (() => {
                  const col = collections?.find((c) => c.id === item.collection_id);
                  return col ? (
                    <span className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 font-medium flex-shrink-0">
                      <FolderOpen className="w-3 h-3" />
                      {col.name}
                    </span>
                  ) : null;
                })()}

                {item.category && (() => {
                  const colors = ITEM_CATEGORY_COLORS[item.category];
                  return (
                    <span className={`inline-flex items-center text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${colors.bg} ${colors.text}`}>
                      {ITEM_CATEGORY_LABELS[item.category]}
                    </span>
                  );
                })()}

                {/* 태그 최대 2개 */}
                {item.tags?.slice(0, 2).map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onTagClick?.(tag.name); }}
                    className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium flex-shrink-0 bg-zinc-100 text-zinc-500 transition-opacity ${
                      onTagClick ? "hover:opacity-60 cursor-pointer" : "cursor-default"
                    }`}
                    style={
                      tag.color
                        ? { backgroundColor: `${tag.color}18`, color: tag.color }
                        : undefined
                    }
                  >
                    #{tag.name}
                  </button>
                ))}
                {(item.tags?.length ?? 0) > 2 && (
                  <span className="text-xs text-zinc-400 flex-shrink-0">
                    +{(item.tags?.length ?? 0) - 2}
                  </span>
                )}

                <span className="text-xs text-zinc-400 ml-auto flex-shrink-0 pl-1 whitespace-nowrap">
                  {formatDate(item.created_at)}
                </span>
              </div>
            </div>

            {/* 썸네일 (링크만) */}
            {item.type === "link" && item.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.thumbnail_url}
                alt=""
                className="w-14 h-10 object-cover rounded-md flex-shrink-0 bg-zinc-100"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            ) : item.type === "link" && hostname ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`https://www.google.com/s2/favicons?domain=${hostname}&sz=32`}
                alt=""
                className="w-5 h-5 rounded flex-shrink-0 opacity-60"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            ) : null}

            {/* 액션 버튼 — 모바일 항상, 데스크톱 hover */}
            <div
              className="flex items-center gap-0.5 flex-shrink-0 ml-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={(e) => handlePin(e)}
                disabled={isPinning}
                className={`p-1 rounded-md transition-all duration-150 disabled:opacity-30 ${
                  item.is_pinned
                    ? "text-amber-400 hover:bg-amber-50"
                    : "text-zinc-300 hover:text-amber-400 hover:bg-amber-50"
                }`}
                title={item.is_pinned ? "핀 해제" : "핀 고정"}
                aria-label={item.is_pinned ? "핀 해제" : "핀 고정"}
              >
                {item.is_pinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
              </button>
              <button
                onClick={handleEditOpen}
                className="p-1 rounded-md text-zinc-300 hover:text-zinc-600 hover:bg-zinc-100 transition-all duration-150"
                title="수정"
                aria-label="수정"
              >
                <Pencil className="w-3 h-3" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                disabled={isDeleting}
                className="p-1 rounded-md text-zinc-300 hover:text-red-400 hover:bg-red-50 transition-all duration-150 disabled:opacity-30"
                title="삭제"
                aria-label="삭제"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* 인라인 수정 폼 */}
        {isEditing && (
          <div
            className="border-t border-zinc-100 px-3 py-3 space-y-2.5 bg-zinc-50/60 rounded-b-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {editError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {editError}
              </p>
            )}

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-500">제목</label>
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                maxLength={500}
                className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-lg text-sm text-zinc-900 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-shadow"
              />
            </div>

            {item.type === "note" && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-500">내용</label>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  maxLength={50000}
                  rows={3}
                  className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-lg text-sm text-zinc-900 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-shadow resize-none"
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-500">
                태그 <span className="text-zinc-400 font-normal">(쉼표로 구분)</span>
              </label>
              <input
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
                placeholder="AI, 디자인, 참고자료"
                className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-lg text-sm text-zinc-900 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-shadow"
              />
            </div>

            {collections && collections.length > 0 && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-500">컬렉션</label>
                <select
                  value={editCollectionId ?? ""}
                  onChange={(e) => setEditCollectionId(e.target.value || null)}
                  className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
                >
                  <option value="">컬렉션 없음</option>
                  {collections.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-500">카테고리</label>
              <select
                value={editCategory ?? ""}
                onChange={(e) => setEditCategory((e.target.value as ItemCategory) || null)}
                className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
              >
                <option value="">없음</option>
                {(Object.keys(ITEM_CATEGORY_LABELS) as ItemCategory[]).map((cat) => (
                  <option key={cat} value={cat}>{ITEM_CATEGORY_LABELS[cat]}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-1.5">
              <button
                onClick={() => setIsEditing(false)}
                className="flex items-center gap-1 px-2.5 py-1.5 border border-zinc-200 text-xs font-medium text-zinc-600 rounded-lg hover:bg-zinc-100 transition-colors"
              >
                <X className="w-3 h-3" />취소
              </button>
              <button
                onClick={handleEditSave}
                disabled={isSaving}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-zinc-900 text-white text-xs font-medium rounded-lg hover:bg-zinc-800 disabled:opacity-50 transition-colors"
              >
                <Check className="w-3 h-3" />
                {isSaving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        )}
      </article>

      {/* 상세 시트 */}
      {showDetail && (
        <DetailSheet
          item={item}
          onClose={() => setShowDetail(false)}
          onEditClick={() => handleEditOpen()}
          onDeleteClick={handleDelete}
        />
      )}
    </>
  );
}
