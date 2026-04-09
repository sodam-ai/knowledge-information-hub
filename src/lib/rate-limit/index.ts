import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redis;
}

// 엔드포인트별 rate limiter 정의 (PRD 04_PROJECT_SPEC.md 기준)
const limiters = {
  // 분당 20건/IP — 아이템 저장
  items: () =>
    new Ratelimit({ redis: getRedis()!, limiter: Ratelimit.slidingWindow(20, "1 m") }),
  // 분당 30건/IP — 검색
  search: () =>
    new Ratelimit({ redis: getRedis()!, limiter: Ratelimit.slidingWindow(30, "1 m") }),
  // 시간당 5건/IP — 팀 합류 (브루트포스 방지)
  join: () =>
    new Ratelimit({ redis: getRedis()!, limiter: Ratelimit.slidingWindow(5, "1 h") }),
  // 시간당 3건/IP — 팀 생성
  createTeam: () =>
    new Ratelimit({ redis: getRedis()!, limiter: Ratelimit.slidingWindow(3, "1 h") }),
  // 분당 30건/IP — 태그
  tags: () =>
    new Ratelimit({ redis: getRedis()!, limiter: Ratelimit.slidingWindow(30, "1 m") }),
};

type LimiterKey = keyof typeof limiters;

export async function checkRateLimit(
  request: NextRequest,
  type: LimiterKey
): Promise<NextResponse | null> {
  const r = getRedis();

  // Redis 미연결 시 fail-open (요청 허용) — Sentry에 알림은 별도 처리
  if (!r) {
    console.warn("[RateLimit] Redis 미연결 — fail-open 모드");
    return null;
  }

  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "anonymous";

    const limiter = limiters[type]();
    const { success, limit, remaining, reset } = await limiter.limit(ip);

    if (!success) {
      return new NextResponse(
        JSON.stringify({
          error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Limit": String(limit),
            "X-RateLimit-Remaining": String(remaining),
            "X-RateLimit-Reset": String(reset),
            "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)),
          },
        }
      );
    }

    return null;
  } catch (err) {
    // Redis 오류 시 fail-open
    console.error("[RateLimit] Redis 오류 — fail-open:", err);
    return null;
  }
}
