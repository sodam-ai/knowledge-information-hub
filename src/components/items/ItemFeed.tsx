"use client";

import { useState, useTransition, useEffect, useRef, useCallback } from "react";
import ItemCard from "./ItemCard";
import { getMoreItems } from "@/actions/items";
import type { Item, Tag } from "@/types";
import { Inbox, Plus, Loader2, Link2, FileText, Tag as TagIcon, X } from "lucide-react";

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

type DateGroup = { label: string; items: ExtendedItem[] };

function groupItemsByDate(items: ExtendedItem[]): DateGroup[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 6);
  const monthStart = new Date(todayStart);
  monthStart.setDate(monthStart.getDate() - 29);

  const buckets: DateGroup[] = [
    { label: "오늘", items: [] },
    { label: "어제", items: [] },
    { label: "이번 주", items: [] },
    { label: "이번 달", items: [] },
    { label: "그 이전", items: [] },
  ];

  for (const item of items) {
    const d = new Date(item.created_at);
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (dayStart >= todayStart) {
      buckets[0].items.push(item);
    } else if (dayStart >= yesterdayStart) {
      buckets[1].items.push(item);
    } else if (dayStart >= weekStart) {
      buckets[2].items.push(item);
    } else if (dayStart >= monthStart) {
      buckets[3].items.push(item);
    } else {
      buckets[4].items.push(item);
    }
  }

  return buckets.filter((g) => g.items.length > 0);
}

export default function ItemFeed({
  initialItems,
  teamId,
  totalCount,
  onAddClick,
}: ItemFeedProps) {
  const [filter, setFilter] = useState<FilterType>("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [items, setItems] = useState(sortItems(initialItems));
  const [, startTransition] = useTransition();
  const loaderRef = useRef<HTMLDivElement>(null);

  // 동기 guard — stale closure 없이 중복 로딩 방지
  const isLoadingRef = useRef(false);
  // items.length를 ref로 관리해 handleLoadMore 의존성에서 제거
  const itemsLengthRef = useRef(items.length);
  useEffect(() => { itemsLengthRef.current = items.length; }, [items.length]);

  // 서버 새로고침(router.refresh) 후 initialItems 동기화 — totalCount 변경 감지
  const prevTotalRef = useRef(totalCount);
  useEffect(() => {
    if (totalCount !== prevTotalRef.current) {
      prevTotalRef.current = totalCount;
      setItems(sortItems(initialItems));
    }
  }, [totalCount, initialItems]);

  // 타입 필터 적용
  const typeFiltered = filter === "all" ? items : items.filter((i) => i.type === filter);
  // 태그 필터 추가 적용
  const filtered = tagFilter
    ? typeFiltered.filter((i) => i.tags?.some((t) => t.name === tagFilter))
    : typeFiltered;

  const linkCount = items.filter((i) => i.type === "link").length;
  const noteCount = items.filter((i) => i.type === "note").length;

  // teamId === "all" → 커뮤니티 전체 피드, 페이지네이션 비활성
  const hasMore =
    teamId !== "all" && filter === "all" && !tagFilter && items.length < totalCount;

  const handleLoadMore = useCallback(() => {
    if (isLoadingRef.current || !hasMore) return;
    isLoadingRef.current = true;
    startTransition(async () => {
      try {
        const result = await getMoreItems(teamId, itemsLengthRef.current);
        if (result.data) {
          setItems((prev) => sortItems([...prev, ...result.data!]));
        }
      } finally {
        isLoadingRef.current = false;
      }
    });
  }, [hasMore, teamId]);

  // 무한 스크롤
  useEffect(() => {
    const el = loaderRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) handleLoadMore();
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, handleLoadMore]);

  // 태그 필터 핸들러
  const handleTagClick = useCallback((tagName: string) => {
    setTagFilter((prev) => (prev === tagName ? null : tagName));
  }, []);

  if (items.length === 0) {
    return (
      <div className="text-center py-14">
        <div className="w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center mx-auto mb-3.5">
          <Inbox className="w-6 h-6 text-zinc-400" />
        </div>
        <h3 className="text-sm font-semibold text-zinc-900 mb-1">
          저장된 항목이 없어요
        </h3>
        <p className="text-xs text-zinc-500 mb-5">
          링크나 노트를 저장해서 지식을 쌓아보세요.
        </p>
        {onAddClick && (
          <button
            onClick={onAddClick}
            className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white text-xs font-medium rounded-xl hover:bg-zinc-800 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            첫 항목 저장하기
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 필터 탭 — sticky (TeamHeader h-14 아래) */}
      <div className="sticky top-14 z-20 -mx-4 px-4 pt-1 pb-2 bg-zinc-50/90 backdrop-blur-sm">
        <div className="flex items-center gap-1 bg-zinc-100/80 rounded-xl p-1">
          <button
            onClick={() => setFilter("all")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg transition-all duration-150 ${
              filter === "all"
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            전체 {items.length}
          </button>
          <button
            onClick={() => setFilter("link")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg transition-all duration-150 ${
              filter === "link"
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            <Link2 className="w-3 h-3" />
            링크 {linkCount}
          </button>
          <button
            onClick={() => setFilter("note")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg transition-all duration-150 ${
              filter === "note"
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            <FileText className="w-3 h-3" />
            노트 {noteCount}
          </button>
        </div>

        {/* 태그 필터 활성 표시 */}
        {tagFilter && (
          <div className="flex items-center gap-1.5 mt-1.5 px-1">
            <TagIcon className="w-3 h-3 text-zinc-400" />
            <span className="text-xs text-zinc-500">태그 필터:</span>
            <button
              onClick={() => setTagFilter(null)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-700 transition-colors"
            >
              #{tagFilter}
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
        )}
      </div>

      {/* 아이템 목록 */}
      {filtered.length === 0 ? (
        <div className="text-center py-10 text-xs text-zinc-400">
          {tagFilter
            ? `#${tagFilter} 태그가 있는 항목이 없어요`
            : filter === "link"
            ? "저장된 링크가 없어요"
            : "저장된 노트가 없어요"}
        </div>
      ) : (
        <div className="space-y-3">
          {/* 핀 고정 섹션 */}
          {filtered.some((i) => i.is_pinned) && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-amber-500 px-0.5">고정됨</p>
              {filtered.filter((i) => i.is_pinned).map((item) => (
                <ItemCard key={item.id} item={item} onTagClick={handleTagClick} />
              ))}
            </div>
          )}
          {/* 날짜별 그룹 */}
          {groupItemsByDate(filtered.filter((i) => !i.is_pinned)).map((group) => (
            <div key={group.label} className="space-y-1">
              <p className="text-xs font-medium text-zinc-400 px-0.5">{group.label}</p>
              {group.items.map((item) => (
                <ItemCard key={item.id} item={item} onTagClick={handleTagClick} />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* 무한 스크롤 트리거 영역 */}
      {hasMore && (
        <div ref={loaderRef} className="flex justify-center py-3">
          <Loader2 className="w-4 h-4 animate-spin text-zinc-300" />
        </div>
      )}

      {!hasMore && items.length >= totalCount && totalCount > 0 && filter === "all" && !tagFilter && teamId !== "all" && (
        <p className="text-center text-xs text-zinc-400 py-2">
          모든 항목을 불러왔습니다
        </p>
      )}
    </div>
  );
}
