import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const storedState = request.cookies.get("naver_oauth_state")?.value;

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL!;

  // CSRF 방지
  if (!code || !state || state !== storedState) {
    return NextResponse.redirect(`${baseUrl}/login?error=invalid_state`);
  }

  try {
    const clientId = process.env.NAVER_CLIENT_ID!;
    const clientSecret = process.env.NAVER_CLIENT_SECRET!;
    const redirectUri = `${baseUrl}/api/auth/naver/callback`;

    // 1. 코드 → 액세스 토큰 교환
    const tokenRes = await fetch("https://nid.naver.com/oauth2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
        state,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return NextResponse.redirect(`${baseUrl}/login?error=naver_token_failed`);
    }

    // 2. 네이버 사용자 정보 조회
    const userRes = await fetch("https://openapi.naver.com/v1/nid/me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const userData = await userRes.json();
    const naverUser = userData.response;

    if (!naverUser?.email) {
      return NextResponse.redirect(`${baseUrl}/login?error=naver_no_email`);
    }

    const email: string = naverUser.email;
    const name: string = naverUser.name || naverUser.nickname || "네이버 사용자";
    const avatarUrl: string | undefined = naverUser.profile_image;

    // 3. 탈퇴 이메일 차단 확인
    const serviceClient = createServiceClient();
    const emailHash = (await import("crypto"))
      .createHash("sha256")
      .update(email.toLowerCase())
      .digest("hex");

    const { data: blocked } = await serviceClient
      .from("deleted_emails")
      .select("blocked_until")
      .eq("email_hash", emailHash)
      .gt("blocked_until", new Date().toISOString())
      .maybeSingle();

    if (blocked) {
      return NextResponse.redirect(`${baseUrl}/login?error=account_blocked`);
    }

    // 4. 매직 링크 생성 (사용자 없으면 자동 생성)
    const { data: linkData, error: linkError } = await serviceClient.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: {
        data: { name, avatar_url: avatarUrl },
        redirectTo: `${baseUrl}/auth/callback`,
      },
    });

    if (linkError) throw linkError;

    const response = NextResponse.redirect(linkData.properties.action_link);
    response.cookies.delete("naver_oauth_state");
    return response;
  } catch (err) {
    console.error("[naver-callback]", err);
    return NextResponse.redirect(`${baseUrl}/login?error=naver_login_failed`);
  }
}
