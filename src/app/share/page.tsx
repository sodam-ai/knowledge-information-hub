/**
 * PWA Web Share Target API 수신 라우트
 * manifest.json의 share_target.action과 일치
 */
import { Suspense } from "react";
import { getDb } from "@/lib/db/sqlite";
import ShareContent from "./ShareContent";

// 매 요청마다 SQLite 실시간 조회 — 정적 prerender 방지
export const dynamic = "force-dynamic";

export default async function SharePage() {
  const db = getDb();
  const teams = db
    .prepare<[], { id: string; name: string }>(
      "SELECT id, name FROM teams ORDER BY created_at ASC"
    )
    .all();

  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50" />}>
      <ShareContent teams={teams} />
    </Suspense>
  );
}
