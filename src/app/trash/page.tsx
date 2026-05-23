"use client";

import { useEffect, useState, useCallback } from "react";
import { getTrashedItems, restoreItem, permanentDeleteItem } from "@/actions/items";
import Link from "next/link";
import { ArrowLeft, Trash2, RotateCcw, X } from "lucide-react";
import type { Item, Tag } from "@/types";

type TrashItem = Item & { tags: Tag[] };

export default function TrashPage() {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getTrashedItems();
    setItems((result.data as TrashItem[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleRestore(id: string) {
    setPendingId(id);
    await restoreItem(id);
    setPendingId(null);
    await load();
  }

  async function handleDelete(id: string) {
    if (!confirm("영구 삭제하면 복원할 수 없습니다. 삭제하시겠습니까?")) return;
    setPendingId(id);
    await permanentDeleteItem(id);
    setPendingId(null);
    await load();
  }

  async function handleEmptyTrash() {
    if (!confirm(`휴지통의 항목 ${items.length}개를 모두 영구 삭제합니다. 계속하시겠습니까?`)) return;
    for (const item of items) {
      await permanentDeleteItem(item.id);
    }
    await load();
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* 헤더 */}
      <header className="sticky top-0 z-30 bg-white border-b border-zinc-200">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/dashboard"
              className="p-1.5 text-zinc-500 hover:bg-zinc-100 rounded-lg transition-colors flex-shrink-0"
              aria-label="대시보드로 돌아가기"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-2 min-w-0">
              <Trash2 className="w-4 h-4 text-zinc-500 flex-shrink-0" />
              <span className="text-sm font-semibold text-zinc-900 truncate">휴지통</span>
              {!loading && items.length > 0 && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600">
                  {items.length}
                </span>
              )}
            </div>
          </div>
          {!loading && items.length > 0 && (
            <button
              onClick={handleEmptyTrash}
              className="text-xs text-red-500 hover:text-red-700 transition-colors flex-shrink-0"
            >
              모두 비우기
            </button>
          )}
        </div>
      </header>

      {/* 본문 */}
      <main className="max-w-3xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-zinc-400 text-sm">
            불러오는 중...
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-zinc-400">
            <Trash2 className="w-10 h-10" />
            <p className="text-sm">휴지통이 비어있습니다.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="bg-white border border-zinc-200 rounded-xl px-4 py-3 flex items-start gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900 truncate">{item.title}</p>
                  {item.url && (
                    <p className="text-xs text-zinc-400 truncate mt-0.5">{item.url}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleRestore(item.id)}
                    disabled={pendingId === item.id}
                    title="복원"
                    aria-label="복원"
                    className="p-1.5 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-40"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    disabled={pendingId === item.id}
                    title="영구 삭제"
                    aria-label="영구 삭제"
                    className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
