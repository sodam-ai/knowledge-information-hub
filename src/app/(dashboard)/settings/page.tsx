import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AccountSettings from "./AccountSettings";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("name, email")
    .eq("id", user.id)
    .single();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">설정</h1>
          <p className="mt-1 text-sm text-gray-500">계정 및 팀 설정을 관리합니다.</p>
        </div>

        {/* 프로필 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">내 계정</h2>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <span className="text-gray-400 w-12">이름</span>
              <span className="font-medium">{profile?.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400 w-12">이메일</span>
              <span className="font-medium">{profile?.email}</span>
            </div>
          </div>
        </div>

        {/* 계정 탈퇴 */}
        <AccountSettings />
      </div>
    </div>
  );
}
