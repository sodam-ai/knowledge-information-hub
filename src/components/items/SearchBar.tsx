"use client";

import { useState, useTransition, useRef } from "react";
import { searchItems } from "@/actions/items";
import ItemCard from "./ItemCard";
import type { Item, Tag } from "@/types";
import { Search, X, Loader2 } from "lucide-react";

interface SearchBarProps {
  teamId: string;
}

export default function SearchBar({ teamId }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<(Item & { tags?: Tag[] })[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const isAllFeed = teamId === "all";

  function handleSearch(q: string) {
    setQuery(q);
    setError(null);

    if (q.length < 1) {
      setResults(null);
      return;
    }

    startTransition(async () => {
      const result = await searchItems(teamId, q);
      if (result.error) {
        setError(result.error);
        setResults(null);
      } else {
        setResults((result.data ?? []) as (Item & { tags?: Tag[] })[]);
      }
    });
  }

  function handleClear() {
    setQuery("");
    setResults(null);
    setError(null);
    inputRef.current?.focus();
  }

  const isOpen = (results !== null || isPending || error) && query.length >= 1;

  return (
    <div className="relative">
      {/* 입력창 */}
      <div className="relative">
        {isPending ? (
          <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 animate-spin pointer-events-none" />
        ) : (
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
        )}
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="제목, 내용, URL, #태그 검색..."
          className="w-full pl-9 pr-9 py-2.5 border border-zinc-200 rounded-xl text-sm bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-shadow"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 검색 결과 드롭다운 */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={handleClear} />
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-zinc-200 rounded-2xl shadow-xl z-20 max-h-[480px] overflow-y-auto">
            {isPending && (
              <div className="flex items-center justify-center gap-2 p-5 text-sm text-zinc-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                검색 중...
              </div>
            )}
            {error && (
              <div className="p-4 text-sm text-red-500 text-center">{error}</div>
            )}
            {!isPending && results !== null && results.length === 0 && (
              <div className="py-10 px-4 text-center">
                <p className="text-sm text-zinc-500">
                  &ldquo;{query}&rdquo;에 대한 결과가 없어요
                </p>
                <p className="text-xs text-zinc-400 mt-1">#태그명으로 태그 검색도 가능해요</p>
              </div>
            )}
            {!isPending && results && results.length > 0 && (
              <div className="p-2">
                <p className="px-2 py-1.5 text-xs text-zinc-400 font-medium">
                  {results.length}개 결과
                </p>
                <div className="space-y-1">
                  {results.map((item) => (
                    <ItemCard key={item.id} item={item} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
