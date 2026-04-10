import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  // Vercel 프록시 환경에서 실제 호스트 사용
  const forwardedHost = request.headers.get("x-forwarded-host");
  const baseUrl = forwardedHost
    ? `https://${forwardedHost}`
    : process.env.NEXT_PUBLIC_SITE_URL ?? "";

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/login?error=auth_callback_failed`);
  }

  // 세션 쿠키를 redirect 응답에 직접 설정하기 위해 커스텀 클라이언트 사용
  const successResponse = NextResponse.redirect(`${baseUrl}${next}`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // 세션 쿠키를 redirect 응답에 직접 포함
          cookiesToSet.forEach(({ name, value, options }) => {
            successResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[auth/callback] error:", error.message);
    return NextResponse.redirect(`${baseUrl}/login?error=auth_callback_failed`);
  }

  return successResponse;
}
