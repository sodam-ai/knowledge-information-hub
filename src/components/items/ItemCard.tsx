"use client";

import { useState } from "react";
import { softDeleteItem, updateItem, togglePinItem } from "@/actions/items";
import { formatDate } from "@/lib/utils";
import type { Item, Tag } from "@/types";
import { Link2, FileText, Trash2, ExternalLink, Pencil, Pin, PinOff, X, Check } from "lucide-react";

interface ItemCardProps {
  item: Item & { tags?: Tag[] };
}

export default function ItemCard({ item: initialItem }: ItemCardProps) {
  const [item, setItem] = useState(initialItem);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isPinning, setIsPinning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 수정 폼 상태
  const [editTitle, setEditTitle] = useState(item.title);
  const [editContent, setEditContent] = useState(item.content ?? "");
  const [editTags, setEditTags] = useState(
    item.tags?.map((t) => t.name).join(", ") ?? ""
  );
  const [editError, setEditError] = useState<string | null>(null);

  async function handleDelete() {
    if (!confirm("이 항목을 삭제할까요? 30일 안에 복구할 수 있습니다.")) return;
    setIsDeleting(true);
    const result = await softDeleteItem(item.id);
    if (!result.error) setDeleted(true);
    setIsDeleting(false);
  }

  async function handlePin() {
    setIsPinning(true);
    const result = await togglePinItem(item.id);
    if (!result.error && result.data !== undefined) {
      setItem((prev) => ({ ...prev, is_pinned: result.data! }));
    }
    setIsPinning(false);
  }

  function handleEditOpen() {
    setEditTitle(item.title);
    setEditContent(item.content ?? "");
    setEditTags(item.tags?.map((t) => t.name).join(", ") ?? "");
    setEditError(null);
    setIsEditing(true);
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
    });

    if (result.error) {
      setEditError(result.error);
      setIsSaving(false);
      return;
    }

    // 로컬 상태 즉시 반영
    setItem((prev) => ({
      ...prev,
      title: editTitle,
      content: item.type === "note" ? editContent : prev.content,
      tags: editTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .map((name) => ({ id: name, name, color: null, team_id: prev.team_id })),
    }));
    setIsSaving(false);
    setIsEditing(false);
  }

  if (deleted) return null;

  let hostname = "";
  try {
    if (item.url) hostname = new URL(item.url).hostname.replace(/^www\./, "");
  } catch {
    hostname = "";
  }

  return (
    <article
      className={`group bg-white rounded-2xl border transition-all ${
        item.is_pinned
          ? "border-amber-200 shadow-sm shadow-amber-50"
          : "border-zinc-200 hover:border-zinc-300 hover:shadow-sm"
      }`}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* 타입 아이콘 */}
          <div className="mt-0.5 flex-shrink-0">
            {item.type === "link" ? (
              <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center">
                <Link2 className="w-4 h-4 text-blue-500" />
              </div>
            ) : (
              <div className="w-8 h-8 bg-amber-50 rounded-xl flex items-center justify-center">
                <FileText className="w-4 h-4 text-amber-500" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            {/* 제목 + 액션 버튼 */}
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-medium text-zinc-900 line-clamp-2 leading-snug flex-1">
                {item.type === "link" && item.url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-blue-600 transition-colors inline-flex items-start gap-1"
                  >
                    <span className="line-clamp-2">{item.title}</span>
                    <ExternalLink className="w-3 h-3 mt-0.5 flex-shrink-0 opacity-0 group-hover:opacity-60 transition-opacity" />
                  </a>
                ) : (
                  item.title
                )}
              </h3>

              {/* 액션 버튼 (hover 시 표시) */}
              <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                {/* 핀 */}
                <button
                  onClick={handlePin}
                  disabled={isPinning}
                  className={`p-1.5 rounded-lg transition-all disabled:opacity-30 ${
                    item.is_pinned
                      ? "text-amber-500 hover:bg-amber-50 opacity-100"
                      : "text-zinc-300 hover:text-amber-400 hover:bg-amber-50"
                  }`}
                  title={item.is_pinned ? "핀 해제" : "핀 고정"}
                >
                  {item.is_pinned ? (
                    <PinOff className="w-3.5 h-3.5" />
                  ) : (
                    <Pin className="w-3.5 h-3.5" />
                  )}
                </button>

                {/* 수정 */}
                <button
                  onClick={handleEditOpen}
                  className="p-1.5 rounded-lg text-zinc-300 hover:text-zinc-600 hover:bg-zinc-100 transition-all"
                  title="수정"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>

                {/* 삭제 */}
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="p-1.5 rounded-lg text-zinc-300 hover:text-red-400 hover:bg-red-50 transition-all disabled:opacity-30"
                  title="삭제"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 핀 배지 */}
            {item.is_pinned && (
              <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium mt-0.5">
                <Pin className="w-2.5 h-2.5" />
                고정됨
              </span>
            )}

            {/* 노트 미리보기 */}
            {item.type === "note" && item.content && (
              <p className="mt-1.5 text-xs text-zinc-500 line-clamp-2 leading-relaxed">
                {item.content}
              </p>
            )}

            {/* 링크 도메인 */}
            {item.type === "link" && hostname && (
              <p className="mt-1 text-xs text-zinc-400 truncate">{hostname}</p>
            )}

            {/* 태그 + 날짜 */}
            <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
              {item.tags?.slice(0, 5).map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600"
                  style={
                    tag.color
                      ? { backgroundColor: `${tag.color}18`, color: tag.color }
                      : undefined
                  }
                >
                  #{tag.name}
                </span>
              ))}
              <span className="text-xs text-zinc-400 ml-auto">
                {formatDate(item.created_at)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 인라인 수정 폼 */}
      {isEditing && (
        <div className="border-t border-zinc-100 p-4 space-y-3 bg-zinc-50 rounded-b-2xl">
          {editError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {editError}
            </p>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-600">제목</label>
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              maxLength={500}
              className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm text-zinc-900 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-shadow"
            />
          </div>

          {item.type === "note" && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-600">내용</label>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                maxLength={50000}
                rows={3}
                className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm text-zinc-900 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-shadow resize-none"
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-600">태그 (쉼표로 구분)</label>
            <input
              value={editTags}
              onChange={(e) => setEditTags(e.target.value)}
              placeholder="AI, 디자인, 참고자료"
              className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm text-zinc-900 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-shadow"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setIsEditing(false)}
              className="flex items-center gap-1.5 px-3 py-2 border border-zinc-200 text-xs font-medium text-zinc-600 rounded-xl hover:bg-zinc-100 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              취소
            </button>
            <button
              onClick={handleEditSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 text-white text-xs font-medium rounded-xl hover:bg-zinc-800 disabled:opacity-50 transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              {isSaving ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
