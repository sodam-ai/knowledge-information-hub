/**
 * PWA Web Share Target API 수신 라우트
 * manifest.json의 share_target.action과 일치
 */
import { Suspense } from "react";
import { createServiceClient } from "@/lib/supabase/server";
import ShareContent from "./ShareContent";

export default async function SharePage() {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("teams")
    .select("id, name")
    .order("created_at", { ascending: true });

  const teams = (data ?? []) as { id: string; name: string }[];

  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50" />}>
      <ShareContent teams={teams} />
    </Suspense>
  );
}
