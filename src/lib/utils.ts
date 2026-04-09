import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** URL 정규화 — SHA-256 해시 전처리 (utm 파라미터, 트레일링 슬래시 제거) */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url.toLowerCase());
    // utm_* 파라미터 제거
    const keysToDelete: string[] = [];
    parsed.searchParams.forEach((_, key) => {
      if (key.startsWith("utm_") || key === "fbclid" || key === "gclid") {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach((key) => parsed.searchParams.delete(key));
    // 트레일링 슬래시 제거 (루트 제외)
    if (parsed.pathname !== "/" && parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

/** microlink.io 응답 데이터 위생 처리 (XSS 방지) */
export function sanitizeText(text: string | null | undefined, maxLength: number): string {
  if (!text) return "";
  // HTML 태그 제거
  const stripped = text.replace(/<[^>]*>/g, "").trim();
  // 길이 절단
  return stripped.slice(0, maxLength);
}

/** 이미지 URL 검증 — HTTPS만 허용, javascript:/data: 차단 */
export function sanitizeImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (!url.startsWith("https://")) return null;
  return url;
}

/** 날짜 포맷 (한국어) */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 7) return `${diffDay}일 전`;

  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
