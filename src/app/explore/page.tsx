import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ExploreClient from "./ExploreClient";

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { category } = await searchParams;

  const { data: groups, error } = await supabase.rpc("get_public_groups", {
    p_category: category ?? null,
    p_limit: 50,
    p_offset: 0,
  });

  return (
    <ExploreClient
      initialGroups={groups ?? []}
      activeCategory={category ?? ""}
      error={error?.message}
    />
  );
}
