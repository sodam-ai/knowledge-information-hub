"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import ItemFeed from "./ItemFeed";
import SaveItemButton from "./SaveItemButton";
import type { Item, Tag, Collection } from "@/types";

type ExtendedItem = Item & { tags?: Tag[]; teamName?: string };

interface DashboardFeedProps {
  teamId: string;
  initialItems: ExtendedItem[];
  totalCount: number;
  collections: Collection[];
}

export default function DashboardFeed({
  teamId,
  initialItems,
  totalCount,
  collections,
}: DashboardFeedProps) {
  const [items, setItems] = useState(initialItems);
  const [total, setTotal] = useState(totalCount);
  const router = useRouter();

  // router.refresh() 완료 후 서버 실제 데이터로 재동기화
  useEffect(() => {
    setItems(initialItems);
    setTotal(totalCount);
  }, [initialItems, totalCount]);

  const handleItemSaved = useCallback(
    (newItem: ExtendedItem) => {
      // 즉시 낙관적 업데이트 → 다이얼로그 닫히는 순간 피드에 노출
      setItems((prev) => [newItem, ...prev]);
      setTotal((t) => t + 1);
      // 백그라운드에서 서버 재동기화 (eventual consistency)
      router.refresh();
    },
    [router]
  );

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">전체 피드</h2>
          {total > 0 && (
            <p className="text-xs text-zinc-400 mt-0.5">{total}개 항목</p>
          )}
        </div>
        <SaveItemButton teamId={teamId} onItemSaved={handleItemSaved} />
      </div>

      <ItemFeed
        initialItems={items}
        teamId={teamId}
        totalCount={total}
        collections={collections}
      />
    </>
  );
}
