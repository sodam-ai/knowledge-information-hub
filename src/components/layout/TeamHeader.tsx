"use client";

import Link from "next/link";
import { Trash2 } from "lucide-react";

export default function TeamHeader() {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-zinc-200">
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-3">

        {/* 앱 로고 + 이름 */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 bg-zinc-900 text-white rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-zinc-900 truncate">Knowledge Information Hub</span>
        </div>

        {/* 오른쪽: 휴지통 */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <Link
            href="/trash"
            className="p-1.5 text-zinc-500 hover:bg-zinc-100 rounded-lg transition-colors"
            title="휴지통"
            aria-label="휴지통"
          >
            <Trash2 className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}
