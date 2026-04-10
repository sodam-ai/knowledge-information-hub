"use client";

import { useState, useTransition } from "react";
import ItemCard from "./ItemCard";
import { getMoreItems } from "@/actions/items";
import type { Item, Tag } from "@/types";
import { Inbox, Plus, Loader2, Link2, FileText } from "lucide-react";

type FilterType = "all" | "link" | "note";

type ExtendedItem = Item & { tags?: Tag[]; teamName?: string };

interface ItemFeedProps {
  initialItems: ExtendedItem[];
  teamId: string;
  totalCount: number;
  onAddClick?: () => void;
}

function sortItems(items: ExtendedItem[]) {
  return [...items].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

export default function ItemFeed({ initialItems, teamId, totalCount, onAddClick }: ItemFeedProps) {
  const [filter, setFilter] = useState<FilterType>("all");
  const [items, setItems] = useState(sortItems(initialItems));
  const [isPending, startTransition] = useTransition();

  const filtered = filter === "all" ? items : items.filter((i) => i.type === filter);
  const linkCount = items.filter((i) => i.type === "link").length;
  const noteCount = items.filter((i) => i.type === "note").length;

  // teamId === "all" means community view — disable load more
  const hasMore = teamId !== "all" && filter === "all" && items.length < totalCount;

  function handleLoadMore() {
    startTransition(async () => {
      const result = await getMoreItems(teamId, items.length);
      if (result.data) {
        setItems((prev) => sortItems([...prev, ...result.data!]));
      }
    });
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-14 h-14 bg-zinc-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Inbox className="w-7 h-7 text-zinc-400" />
        </div>
        <h3 className="text-sm font-semibold text-zinc-900 mb-1">
          아직 저장된 항목이 없어요
        </h3>
        <p className="text-sm text-zinc-500 mb-5">
          링크나 노트를 저장해서 그룹 창고를 채워보세요.
        </p>
        {onAddClick && (
          <button
            onClick={onAddClick}
            className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            첫 항목 저장하기
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 필터 탭 */}
      <div className="flex items-center gap-1 bg-zinc-100 rounded-xl p-1">
        <button
          onClick={() => setFilter("all")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg transition-all ${
            filter === "all" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
          }`}
        >
          전체 {items.length}
        </button>
        <button
          onClick={() => setFilter("link")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg transition-all ${
            filter === "link" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
          }`}
        >
          <Link2 className="w-3 h-3" />
          링크 {linkCount}
        </button>
        <button
          onClick={() => setFilter("note")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg transition-all ${
            filter === "note" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
          }`}
        >
          <FileText className="w-3 h-3" />
          노트 {noteCount}
        </button>
      </div>

      {/* 아이템 목록 */}
      {filtered.length === 0 ? (
        <div className="text-center py-10 text-sm text-zinc-400">
          {filter === "link" ? "저장된 링크가 없어요" : "저장된 노트가 없어요"}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {/* 더 보기 */}
      {hasMore && (
        <button
          onClick={handleLoadMore}
          disabled={isPending}
          className="w-full py-2.5 border border-zinc-200 rounded-xl text-xs font-medium text-zinc-500 hover:bg-zinc-50 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {isPending ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              불러오는 중...
            </>
          ) : (
            `더 보기 (${totalCount - items.length}개 남음)`
          )}
        </button>
      )}
    </div>
  );
}
