import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { sanitizeText, sanitizeImageUrl } from "@/lib/utils";

// ── SSRF 방어 ──────────────────────────────────────────────────────────────
// RFC 1918 사설 IP, loopback, link-local, 클라우드 메타데이터 주소를 차단합니다.
const BLOCKED: RegExp[] = [
  /^localhost$/i,
  /^127\./,                        // 127.0.0.0/8 loopback
  /^10\./,                         // 10.0.0.0/8
  /^172\.(1[6-9]|2\d|3[01])\./,   // 172.16.0.0/12
  /^192\.168\./,                    // 192.168.0.0/16
  /^169\.254\./,                    // link-local / AWS 메타데이터
  /^0\./,                           // 0.0.0.0/8
  /^::1$/,                          // IPv6 loopback
  /^fe80:/i,                        // IPv6 link-local
  /^fc00:/i,                        // IPv6 unique-local (fc00::/7)
  /^fd[0-9a-f]{2}:/i,              // IPv6 unique-local (fd00::/8)
  /\.internal$/i,                   // *.internal (GCP, .klh.internal 포함)
  /\.local$/i,                      // mDNS / Bonjour
  /^metadata\.google\.internal$/i,  // GCP 메타데이터 서버
];

function isSafeUrl(url: URL): boolean {
  if (url.protocol !== "https:") return false;
  const h = url.hostname.toLowerCase();
  return !BLOCKED.some((r) => r.test(h));
}

// ── HTML 메타 추출 ──────────────────────────────────────────────────────────

interface OgMeta {
  title?: string;
  description?: string;
  image?: string;
}

/**
 * HTML 문자열에서 og:*, twitter:*, <title> 메타데이터를 추출합니다.
 * 정규식은 content 앞뒤 속성 순서 모두 처리합니다.
 */
function extractMeta(html: string): OgMeta {
  // <head> 이후만 파싱 (속도 최적화)
  const headEnd = html.indexOf("</head>");
  const head = headEnd > -1 ? html.slice(0, headEnd) : html.slice(0, 8_000);

  const get = (property: string): string | undefined => {
    // property="og:xxx" content="..."  또는  content="..." property="og:xxx"
    return (
      head.match(new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']{1,600})["']`, "i"))?.[1] ??
      head.match(new RegExp(`<meta[^>]+content=["']([^"']{1,600})["'][^>]+property=["']${property}["']`, "i"))?.[1]
    );
  };

  const rawTitle =
    get("og:title") ??
    get("twitter:title") ??
    head.match(/<title[^>]*>([^<]{1,300})<\/title>/i)?.[1];

  const rawDesc = get("og:description") ?? get("twitter:description");
  const rawImg  = get("og:image") ?? get("twitter:image");

  return {
    title:       rawTitle ? sanitizeText(rawTitle, 300) : undefined,
    description: rawDesc  ? sanitizeText(rawDesc,  500) : undefined,
    image:       rawImg   ? (sanitizeImageUrl(rawImg) ?? undefined) : undefined,
  };
}

// ── Route Handler ──────────────────────────────────────────────────────────

const TIMEOUT_MS = 5_000;
const MAX_BYTES  = 512 * 1_024; // 512 KB (head 영역으로 충분)

export async function GET(req: NextRequest) {
  // Rate limit: IP별 분당 20회
  const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
  const rl = await checkRateLimit(`og:${ip}`, 20, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too Many Requests" }, { status: 429 });
  }

  const rawUrl = req.nextUrl.searchParams.get("url");
  if (!rawUrl) {
    return NextResponse.json({ error: "url 파라미터가 필요합니다." }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: "유효하지 않은 URL입니다." }, { status: 400 });
  }

  if (!isSafeUrl(parsed)) {
    // 보안: SSRF 시도 여부를 노출하지 않음
    return NextResponse.json({ error: "허용되지 않는 URL입니다." }, { status: 400 });
  }

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(rawUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml;q=0.9",
        "Accept-Language": "ko,en;q=0.8",
      },
      redirect: "follow",
    });
    clearTimeout(timeoutId);

    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("text/html")) {
      // HTML이 아니면 메타 없음으로 응답 (오류 아님)
      return NextResponse.json({}, { headers: { "Cache-Control": "public, max-age=60" } });
    }

    // 응답 스트림을 MAX_BYTES까지만 읽음
    const reader = res.body?.getReader();
    if (!reader) throw new Error("no body");

    const chunks: Uint8Array[] = [];
    let total = 0;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      chunks.push(value);
      // </head> 이후는 메타 없으므로 일찍 중단
      const partial = new TextDecoder().decode(value);
      if (total > MAX_BYTES || partial.includes("</head>")) {
        reader.cancel().catch(() => {});
        break;
      }
    }

    // 청크 병합
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) { merged.set(c, offset); offset += c.length; }

    const html = new TextDecoder().decode(merged);
    const meta = extractMeta(html);

    return NextResponse.json(meta, {
      headers: {
        // 5분 캐시: 동일 URL 재요청 시 서버 부하 감소
        "Cache-Control": "public, max-age=300, s-maxage=600, stale-while-revalidate=60",
      },
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      return NextResponse.json({ error: "요청 시간 초과" }, { status: 422 });
    }
    // 내부 오류 세부정보 노출 금지 (OWASP A05)
    return NextResponse.json({ error: "메타데이터를 가져올 수 없습니다." }, { status: 422 });
  }
}
