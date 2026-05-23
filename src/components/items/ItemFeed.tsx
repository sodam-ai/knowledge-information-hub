"use client";

import { useState, useTransition, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import ItemCard from "./ItemCard";
import { getMoreItems } from "@/actions/items";
import type { Item, Tag, Collection, ItemCategory } from "@/types";
import { ITEM_CATEGORY_LABELS, ITEM_CATEGORY_COLORS } from "@/types";
import {
  Inbox, Plus, Loader2, Link2, FileText, Tag as TagIcon, X,
  Calendar, ChevronLeft, ChevronRight, FolderOpen, LayoutList, LayoutGrid,
  AlignJustify, ChevronDown,
} from "lucide-react";

type FilterType = "all" | "link" | "note";
type DateFilter = "all" | "today" | "yesterday" | "3days" | "week" | "month" | "3months" | "custom";
type ExtendedItem = Item & { tags?: Tag[]; teamName?: string };

interface ItemFeedProps {
  initialItems: ExtendedItem[];
  teamId: string;
  totalCount: number;
  onAddClick?: () => void;
  collections?: Collection[];
}

function sortItems(items: ExtendedItem[]) {
  return [...items].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

function filterByDate(
  items: ExtendedItem[],
  df: DateFilter,
  range: { from: string; to: string } | null
) {
  if (df === "all") return items;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (df === "today") return items.filter((i) => new Date(i.created_at) >= today);
  if (df === "yesterday") {
    const yStart = new Date(today); yStart.setDate(today.getDate() - 1);
    return items.filter((i) => { const d = new Date(i.created_at); return d >= yStart && d < today; });
  }
  if (df === "3days") {
    const d3 = new Date(today); d3.setDate(today.getDate() - 2);
    return items.filter((i) => new Date(i.created_at) >= d3);
  }
  if (df === "week") {
    const w = new Date(today); w.setDate(today.getDate() - 6);
    return items.filter((i) => new Date(i.created_at) >= w);
  }
  if (df === "month") {
    const m = new Date(today); m.setDate(today.getDate() - 29);
    return items.filter((i) => new Date(i.created_at) >= m);
  }
  if (df === "3months") {
    const m3 = new Date(today); m3.setDate(today.getDate() - 89);
    return items.filter((i) => new Date(i.created_at) >= m3);
  }
  if (df === "custom" && range) {
    const from = new Date(range.from);
    const to = new Date(range.to);
    to.setHours(23, 59, 59, 999);
    return items.filter((i) => {
      const d = new Date(i.created_at);
      return d >= from && d <= to;
    });
  }
  return items;
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

const WEEK_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const MONTH_NAMES = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];

export default function ItemFeed({
  initialItems,
  teamId,
  totalCount,
  onAddClick,
  collections,
}: ItemFeedProps) {
  const [filter, setFilter] = useState<FilterType>("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [collectionFilter, setCollectionFilter] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<ItemCategory | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [customRange, setCustomRange] = useState<{ from: string; to: string } | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [pickStep, setPickStep] = useState<"from" | "to">("from");
  const [tempFrom, setTempFrom] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<"list" | "grid" | "compact">("list");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "alpha" | "type">("newest");

  const filterBarRef = useRef<HTMLDivElement>(null);
  const [calendarPos, setCalendarPos] = useState<{ top: number; left: number; right: number } | null>(null);

  useEffect(() => {
    const savedMode = localStorage.getItem("kih-view-mode");
    const savedSort = localStorage.getItem("kih-sort-order");
    if (savedMode === "list" || savedMode === "grid" || savedMode === "compact") setViewMode(savedMode);
    if (savedSort === "newest" || savedSort === "oldest" || savedSort === "alpha" || savedSort === "type") setSortOrder(savedSort);
  }, []);

  useEffect(() => {
    if (!showCalendar) return;
    const rect = filterBarRef.current?.getBoundingClientRect();
    if (rect) {
      setCalendarPos({
        top: rect.bottom + 4,
        left: rect.left + 16,
        right: window.innerWidth - rect.right + 16,
      });
    }
  }, [showCalendar]);

  function handleViewMode(mode: "list" | "grid" | "compact") {
    setViewMode(mode);
    localStorage.setItem("kih-view-mode", mode);
  }

  function handleSortOrder(order: "newest" | "oldest" | "alpha" | "type") {
    setSortOrder(order);
    localStorage.setItem("kih-sort-order", order);
  }

  const [items, setItems] = useState(sortItems(initialItems));
  const [, startTransition] = useTransition();
  const loaderRef = useRef<HTMLDivElement>(null);

  const isLoadingRef = useRef(false);
  const itemsLengthRef = useRef(items.length);
  useEffect(() => { itemsLengthRef.current = items.length; }, [items.length]);

  useEffect(() => {
    setItems(sortItems(initialItems));
  }, [initialItems]);

  // 필터 파이프라인: 타입 -> 태그 -> 날짜 -> 컬렉션 -> 카테고리
  const typeFiltered = filter === "all" ? items : items.filter((i) => i.type === filter);
  const tagFiltered = tagFilter
    ? typeFiltered.filter((i) => i.tags?.some((t) => t.name === tagFilter))
    : typeFiltered;
  const dateFiltered = filterByDate(tagFiltered, dateFilter, customRange);
  const collectionFiltered = collectionFilter
    ? dateFiltered.filter((i) => i.collection_id === collectionFilter)
    : dateFiltered;
  const filtered = categoryFilter
    ? collectionFiltered.filter((i) => i.category === categoryFilter)
    : collectionFiltered;

  const nonPinnedItems = filtered.filter((i) => !i.is_pinned);
  const sortedNonPinned = (() => {
    if (sortOrder === "oldest") return [...nonPinnedItems].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    if (sortOrder === "alpha") return [...nonPinnedItems].sort((a, b) => a.title.localeCompare(b.title, "ko"));
    return nonPinnedItems;
  })();

  const linkCount = items.filter((i) => i.type === "link").length;
  const noteCount = items.filter((i) => i.type === "note").length;

  const hasMore =
    teamId !== "all" && filter === "all" && !tagFilter &&
    dateFilter === "all" && !collectionFilter && !categoryFilter &&
    items.length < totalCount;

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

  useEffect(() => {
    const el = loaderRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) handleLoadMore(); },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, handleLoadMore]);

  const handleTagClick = useCallback((tagName: string) => {
    setTagFilter((prev) => (prev === tagName ? null : tagName));
  }, []);

  const clearDateFilter = useCallback(() => {
    setDateFilter("all");
    setCustomRange(null);
    setShowCalendar(false);
    setPickStep("from");
    setTempFrom(null);
  }, []);

  const handleCalendarDayClick = useCallback((dateStr: string) => {
    if (pickStep === "from") {
      setTempFrom(dateStr);
      setPickStep("to");
    } else {
      const from = tempFrom ?? dateStr;
      const [f, t] = from <= dateStr ? [from, dateStr] : [dateStr, from];
      setCustomRange({ from: f, to: t });
      setDateFilter("custom");
      setShowCalendar(false);
      setPickStep("from");
      setTempFrom(null);
    }
  }, [pickStep, tempFrom]);

  // 달력 그리드 셀 배열 생성
  const calDays = (() => {
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const cells: (number | null)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  })();

  const todayStr = toDateStr(new Date());

  if (items.length === 0) {
    return (
      <div className="text-center py-14">
        <div className="w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center mx-auto mb-3.5">
          <Inbox className="w-6 h-6 text-zinc-400" />
        </div>
        <h3 className="text-sm font-semibold text-zinc-900 mb-1">저장된 항목이 없어요</h3>
        <p className="text-xs text-zinc-500 mb-5">링크나 노트를 저장해서 지식을 쌓아보세요.</p>
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
    <div className="lg:flex lg:gap-5 lg:items-start">
      {/* 필터 사이드바 — 모바일: sticky top, 데스크톱: left sidebar */}
      <div ref={filterBarRef} className="sticky top-14 z-20 -mx-4 px-4 pt-1 pb-2 bg-zinc-50/90 backdrop-blur-sm lg:mx-0 lg:px-4 lg:py-4 lg:bg-white lg:rounded-xl lg:border lg:border-zinc-200 lg:backdrop-blur-none lg:shadow-sm lg:w-[220px] lg:flex-shrink-0 lg:self-start">
        <p className="hidden lg:block text-xs font-semibold text-zinc-500 mb-3">필터</p>

        {/* 0행: 뷰 모드 + 정렬 */}
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex gap-0.5">
            <button
              onClick={() => handleViewMode("list")}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === "list" ? "bg-zinc-200 text-zinc-900" : "text-zinc-400 hover:text-zinc-600"
              }`}
              title="목록 보기"
            >
              <LayoutList className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleViewMode("compact")}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === "compact" ? "bg-zinc-200 text-zinc-900" : "text-zinc-400 hover:text-zinc-600"
              }`}
              title="컴팩트 보기"
            >
              <AlignJustify className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleViewMode("grid")}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === "grid" ? "bg-zinc-200 text-zinc-900" : "text-zinc-400 hover:text-zinc-600"
              }`}
              title="그리드 보기"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="relative">
            <select
              value={sortOrder}
              onChange={(e) => handleSortOrder(e.target.value as "newest" | "oldest" | "alpha" | "type")}
              className="pl-2 pr-6 py-1 text-xs text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200 rounded-lg transition-colors appearance-none cursor-pointer bg-transparent border-0 outline-none"
            >
              <option value="newest">최신순</option>
              <option value="oldest">오래된순</option>
              <option value="alpha">이름순</option>
              <option value="type">유형별</option>
            </select>
            <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-400 pointer-events-none" />
          </div>
        </div>

        {/* 1행: 타입 필터 탭 */}
        <div className="flex items-center gap-1 bg-zinc-100/80 rounded-xl p-1 lg:flex-col">
          <button
            onClick={() => setFilter("all")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg transition-all duration-150 ${
              filter === "all" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            전체 {items.length}
          </button>
          <button
            onClick={() => setFilter("link")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg transition-all duration-150 ${
              filter === "link" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            <Link2 className="w-3 h-3" />
            링크 {linkCount}
          </button>
          <button
            onClick={() => setFilter("note")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg transition-all duration-150 ${
              filter === "note" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            <FileText className="w-3 h-3" />
            노트 {noteCount}
          </button>
        </div>

        {/* 2행: 컬렉션 필터 */}
        {collections && collections.length > 0 && (
          <div className="flex gap-1.5 mt-1.5 overflow-x-auto lg:flex-wrap lg:overflow-x-visible" style={{ scrollbarWidth: "none" }}>
            <button
              onClick={() => setCollectionFilter(null)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                collectionFilter === null
                  ? "bg-violet-600 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              전체
            </button>
            {collections.map((c) => (
              <button
                key={c.id}
                onClick={() => setCollectionFilter((prev) => (prev === c.id ? null : c.id))}
                className={`flex-shrink-0 flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  collectionFilter === c.id
                    ? "bg-violet-600 text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                <FolderOpen className="w-3 h-3" />
                {c.name}
              </button>
            ))}
          </div>
        )}

        {/* 3행: 카테고리 필터 — 12개 전체 항시 표시, 개수 뱃지, 빈 항목 비활성 */}
        {items.some((i) => i.category) && (
          <div className="flex gap-1.5 mt-1.5 overflow-x-auto lg:flex-wrap lg:overflow-x-visible" style={{ scrollbarWidth: "none" }}>
            <button
              onClick={() => setCategoryFilter(null)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                categoryFilter === null
                  ? "bg-zinc-900 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              전체 {items.length}
            </button>
            {(Object.keys(ITEM_CATEGORY_LABELS) as ItemCategory[]).map((cat) => {
              const count = items.filter((i) => i.category === cat).length;
              const colors = ITEM_CATEGORY_COLORS[cat];
              const isEmpty = count === 0;
              return (
                <button
                  key={cat}
                  onClick={() => { if (!isEmpty) setCategoryFilter((prev) => prev === cat ? null : cat); }}
                  disabled={isEmpty}
                  className={`flex-shrink-0 flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    isEmpty
                      ? "bg-zinc-50 text-zinc-300 cursor-default"
                      : categoryFilter === cat
                      ? `${colors.bg} ${colors.text} ring-1 ring-current`
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                  }`}
                >
                  {ITEM_CATEGORY_LABELS[cat]}
                  {!isEmpty && <span className="text-[10px] opacity-60">{count}</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* 4행: 날짜 필터 탭 */}
        <div className="flex items-center gap-1 mt-1.5 overflow-x-auto lg:flex-wrap lg:overflow-x-visible" style={{ scrollbarWidth: "none" }}>
          {(["all", "today", "yesterday", "3days", "week", "month", "3months"] as const).map((d) => (
            <button
              key={d}
              onClick={() => {
                setDateFilter(d);
                setShowCalendar(false);
                setTempFrom(null);
                setPickStep("from");
              }}
              className={`flex-shrink-0 px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                dateFilter === d && !showCalendar
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-500 hover:bg-zinc-200"
              }`}
            >
              {d === "all" ? "전체" : d === "today" ? "오늘" : d === "yesterday" ? "어제" : d === "3days" ? "3일" : d === "week" ? "7일" : d === "month" ? "30일" : "90일"}
            </button>
          ))}

          {/* 달력 피커 토글 버튼 */}
          <button
            onClick={() => {
              setShowCalendar((p) => !p);
              if (!showCalendar) {
                setPickStep("from");
                setTempFrom(null);
              }
            }}
            className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
              dateFilter === "custom" || showCalendar
                ? "bg-zinc-900 text-white"
                : "text-zinc-500 hover:bg-zinc-200"
            }`}
          >
            <Calendar className="w-3 h-3" />
            {dateFilter === "custom" && customRange
              ? `${customRange.from.slice(5)} ~ ${customRange.to.slice(5)}`
              : "날짜 선택"}
            {dateFilter === "custom" && (
              <X
                className="w-2.5 h-2.5"
                onClick={(e) => { e.stopPropagation(); clearDateFilter(); }}
              />
            )}
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

      {/* 아이템 영역 — 데스크톱에서 flex-1 */}
      <div className="flex-1 min-w-0 space-y-3 mt-2 lg:mt-0">
      {/* 달력 포털 — sticky z-20 stacking context 외부에서 렌더링 */}
      {showCalendar && calendarPos && typeof document !== "undefined" && createPortal(
        <>
          <div
            className="fixed inset-0 z-[60]"
            onClick={() => { setShowCalendar(false); setPickStep("from"); setTempFrom(null); }}
          />
          <div
            style={{ position: "fixed", top: calendarPos.top, left: calendarPos.left, right: calendarPos.right, zIndex: 70 }}
            className="bg-white border border-zinc-200 rounded-2xl shadow-lg p-3"
          >
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear((y) => y - 1); } else setCalMonth((m) => m - 1); }}
                className="p-1 rounded-lg hover:bg-zinc-100 text-zinc-500"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-semibold text-zinc-900">{calYear}년 {MONTH_NAMES[calMonth]}</span>
              <button
                onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear((y) => y + 1); } else setCalMonth((m) => m + 1); }}
                className="p-1 rounded-lg hover:bg-zinc-100 text-zinc-500"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <p className="text-center text-xs text-zinc-400 mb-2">
              {pickStep === "from" ? "시작 날짜를 선택하세요" : "종료 날짜를 선택하세요"}
            </p>
            <div className="grid grid-cols-7 mb-1">
              {WEEK_LABELS.map((w) => (
                <div key={w} className="text-center text-xs text-zinc-400 py-0.5">{w}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-0.5">
              {calDays.map((day, idx) => {
                if (day === null) return <div key={`e-${idx}`} />;
                const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const isToday = dateStr === todayStr;
                const isFrom = dateStr === tempFrom || (dateFilter === "custom" && dateStr === customRange?.from);
                const isTo = dateFilter === "custom" && dateStr === customRange?.to;
                const inRange = dateFilter === "custom" && customRange ? dateStr > customRange.from && dateStr < customRange.to : false;
                const isTempRange = pickStep === "to" && tempFrom ? dateStr > tempFrom : false;
                return (
                  <button
                    key={dateStr}
                    onClick={() => handleCalendarDayClick(dateStr)}
                    className={`flex items-center justify-center h-8 w-full text-xs rounded-full transition-colors ${
                      isFrom ? "bg-zinc-900 text-white"
                      : isTo ? "bg-zinc-700 text-white"
                      : inRange || isTempRange ? "bg-zinc-100 text-zinc-700"
                      : isToday ? "font-bold text-zinc-900 ring-1 ring-zinc-300"
                      : "text-zinc-700 hover:bg-zinc-100"
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        </>,
        document.body
      )}

      {/* 아이템 목록 */}
      {filtered.length === 0 ? (
        <div className="text-center py-10 text-xs text-zinc-400">
          {dateFilter !== "all"
            ? "해당 날짜 범위에 저장된 항목이 없어요"
            : tagFilter
            ? `#${tagFilter} 태그가 있는 항목이 없어요`
            : filter === "link"
            ? "저장된 링크가 없어요"
            : "저장된 노트가 없어요"}
        </div>
      ) : (
        (() => {
          const containerClass = viewMode === "grid" ? "grid grid-cols-2 gap-2" : viewMode === "compact" ? "space-y-0.5" : "space-y-1";
          return (
            <div className="space-y-3">
              {/* 핀 고정 섹션 */}
              {filtered.some((i) => i.is_pinned) && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-amber-500 px-0.5">고정됨</p>
                  <div className={containerClass}>
                    {filtered.filter((i) => i.is_pinned).map((item) => (
                      <ItemCard key={item.id} item={item} onTagClick={handleTagClick} collections={collections} viewMode={viewMode} />
                    ))}
                  </div>
                </div>
              )}
              {sortOrder === "type" ? (
                [
                  { label: "링크", type: "link" as const, icon: <Link2 className="w-3 h-3" /> },
                  { label: "노트", type: "note" as const, icon: <FileText className="w-3 h-3" /> },
                ].map(({ label, type, icon }) => {
                  const typeItems = sortedNonPinned.filter((i) => i.type === type);
                  if (typeItems.length === 0) return null;
                  return (
                    <div key={type} className="space-y-1">
                      <p className="text-xs font-medium text-zinc-400 px-0.5 flex items-center gap-1">
                        {icon}{label}
                      </p>
                      <div className={containerClass}>
                        {typeItems.map((item) => (
                          <ItemCard key={item.id} item={item} onTagClick={handleTagClick} collections={collections} viewMode={viewMode} />
                        ))}
                      </div>
                    </div>
                  );
                })
              ) : sortOrder === "alpha" ? (
                <div className={containerClass}>
                  {sortedNonPinned.map((item) => (
                    <ItemCard key={item.id} item={item} onTagClick={handleTagClick} collections={collections} viewMode={viewMode} />
                  ))}
                </div>
              ) : (
                groupItemsByDate(sortedNonPinned).map((group) => (
                  <div key={group.label} className="space-y-1">
                    <p className="text-xs font-medium text-zinc-400 px-0.5">{group.label}</p>
                    <div className={containerClass}>
                      {group.items.map((item) => (
                        <ItemCard key={item.id} item={item} onTagClick={handleTagClick} collections={collections} viewMode={viewMode} />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          );
        })()
      )}

      {/* 무한 스크롤 트리거 */}
      {hasMore && (
        <div ref={loaderRef} className="flex justify-center py-3">
          <Loader2 className="w-4 h-4 animate-spin text-zinc-300" />
        </div>
      )}

      {!hasMore && items.length >= totalCount && totalCount > 0 && filter === "all" && !tagFilter && dateFilter === "all" && teamId !== "all" && (
        <p className="text-center text-xs text-zinc-400 py-2">모든 항목을 불러왔습니다</p>
      )}
      </div>
    </div>
  );
}
