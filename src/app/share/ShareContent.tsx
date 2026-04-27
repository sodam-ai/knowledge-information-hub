"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import SaveItemButton from "@/components/items/SaveItemButton";

interface Props {
  teams: { id: string; name: string }[];
}

export default function ShareContent({ teams }: Props) {
  const searchParams = useSearchParams();
  const url = searchParams.get("url") ?? searchParams.get("text") ?? "";
  const [selectedTeamId, setSelectedTeamId] = useState(teams[0]?.id ?? "");

  if (teams.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <p className="text-sm text-zinc-500">저장할 그룹이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-3">
        {teams.length > 1 && (
          <select
            value={selectedTeamId}
            onChange={(e) => setSelectedTeamId(e.target.value)}
            className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}
        <SaveItemButton teamId={selectedTeamId} prefillUrl={url} />
      </div>
    </div>
  );
}
