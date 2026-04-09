"use client";

import { useSearchParams } from "next/navigation";
import SaveItemButton from "@/components/items/SaveItemButton";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ShareContent() {
  const searchParams = useSearchParams();
  const url = searchParams.get("url") ?? searchParams.get("text") ?? "";
  const [teamId, setTeamId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from("user_teams")
        .select("team_id")
        .eq("user_id", user.id)
        .is("left_at", null)
        .order("joined_at", { ascending: true })
        .limit(1)
        .single();
      if (data) setTeamId(data.team_id);
    });
  }, []);

  if (!teamId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-sm text-gray-500">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <SaveItemButton teamId={teamId} prefillUrl={url} />
    </div>
  );
}
