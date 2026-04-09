"use client";

import { useState } from "react";
import { softDeleteItem } from "@/actions/items";
import { formatDate } from "@/lib/utils";
import type { Item, Tag } from "@/types";
import { Link2, FileText, Trash2, ExternalLink } from "lucide-react";

interface ItemCardProps {
  item: Item & { tags?: Tag[] };
}

export default function ItemCard({ item }: ItemCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);

  async function handleDelete() {
    if (!confirm("이 항목을 삭제할까요? 30일 안에 복구할 수 있습니다.")) return;
    setIsDeleting(true);
    const result = await softDeleteItem(item.id);
    if (!result.error) {
      setDeleted(true);
    }
    setIsDeleting(false);
  }

  if (deleted) return null;

  let hostname = "";
  try {
    if (item.url) hostname = new URL(item.url).hostname.replace(/^www\./, "");
  } catch {
    hostname = "";
  }

  return (
    <article className="group bg-white rounded-2xl border border-zinc-200 p-4 hover:border-zinc-300 hover:shadow-sm transition-all">
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
          {/* 제목 + 삭제 */}
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

            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 text-zinc-300 hover:text-red-400 transition-all disabled:opacity-30"
              aria-label="삭제"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

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
    </article>
  );
}
