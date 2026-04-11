/**
 * Rate limiter — Upstash Redis (production) with in-memory fallback (dev/test).
 * Uses @upstash/ratelimit sliding-window algorithm.
 * Fail-open: if Redis is unavailable, the request is allowed.
 */
import crypto from "crypto";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

// ── In-memory fallback (single-instance / dev) ─────────────────────────────

interface Slot { count: number; resetAt: number; }
const memStore = new Map<string, Slot>();

try {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of memStore) {
      if (v.resetAt < now) memStore.delete(k);
    }
  }, 60_000);
  if (typeof timer === "object" && "unref" in timer) timer.unref();
} catch { /* edge runtime */ }

function checkMemory(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const slot = memStore.get(key);
  if (!slot || slot.resetAt <= now) {
    memStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }
  if (slot.count >= limit) {
    return { allowed: false, remaining: 0, retryAfterSeconds: Math.ceil((slot.resetAt - now) / 1000) };
  }
  slot.count++;
  return { allowed: true, remaining: limit - slot.count, retryAfterSeconds: 0 };
}

// ── Upstash Redis limiter ──────────────────────────────────────────────────

type UpstashLimiter = { limit: (id: string) => Promise<{ success: boolean; remaining: number; reset: number }> };
const limiterCache = new Map<string, UpstashLimiter>();

function msToWindow(ms: number): string {
  const secs = Math.round(ms / 1000);
  if (secs % 3600 === 0) return `${secs / 3600} h`;
  if (secs % 60 === 0) return `${secs / 60} m`;
  return `${secs} s`;
}

async function getUpstashLimiter(
  limit: number,
  windowMs: number
): Promise<UpstashLimiter | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token || url.includes("placeholder")) return null;

  const cacheKey = `${limit}:${windowMs}`;
  if (limiterCache.has(cacheKey)) return limiterCache.get(cacheKey)!;

  try {
    const { Redis } = await import("@upstash/redis");
    const { Ratelimit } = await import("@upstash/ratelimit");
    const redis = new Redis({ url, token });
    const rl = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, msToWindow(windowMs) as `${number} ${"ms" | "s" | "m" | "h" | "d"}`),
      analytics: false,
    });
    limiterCache.set(cacheKey, rl);
    return rl;
  } catch {
    return null;
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Check and increment a rate limit counter.
 * @param identifier - raw key (hashed with SHA-256 internally — raw PINs never stored)
 * @param limit      - max allowed calls within the window
 * @param windowMs   - sliding window duration in milliseconds
 */
export async function checkRateLimit(
  identifier: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const key = crypto.createHash("sha256").update(identifier).digest("hex");

  const upstash = await getUpstashLimiter(limit, windowMs);
  if (upstash) {
    try {
      const result = await upstash.limit(key);
      return {
        allowed: result.success,
        remaining: result.remaining,
        retryAfterSeconds: result.success ? 0 : Math.ceil((result.reset - Date.now()) / 1000),
      };
    } catch {
      // Fail-open: Redis 장애 시 허용
      return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
    }
  }

  return checkMemory(key, limit, windowMs);
}
