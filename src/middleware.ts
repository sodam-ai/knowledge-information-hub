import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { checkRateLimit } from "@/lib/rate-limit";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rate Limiting (API 엔드포인트별 적용)
  if (pathname === "/api/items" && request.method === "POST") {
    const limited = await checkRateLimit(request, "items");
    if (limited) return limited;
  }

  if (pathname.includes("/api/search")) {
    const limited = await checkRateLimit(request, "search");
    if (limited) return limited;
  }

  if (pathname.includes("/api/teams/join")) {
    const limited = await checkRateLimit(request, "join");
    if (limited) return limited;
  }

  if (pathname === "/api/teams" && request.method === "POST") {
    const limited = await checkRateLimit(request, "createTeam");
    if (limited) return limited;
  }

  if (pathname.includes("/tags") && request.method === "POST") {
    const limited = await checkRateLimit(request, "tags");
    if (limited) return limited;
  }

  // Supabase Auth 세션 갱신 + 인증 라우팅
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * 정적 파일과 Next.js 내부 경로 제외:
     * - _next/static (정적 파일)
     * - _next/image (이미지 최적화)
     * - favicon.ico, manifest.json, icons (PWA)
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|icon-|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
