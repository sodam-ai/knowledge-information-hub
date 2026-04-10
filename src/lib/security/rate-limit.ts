/**
 * In-memory sliding-window rate limiter.
 * Resets on cold start — acceptable for small/single-instance deployments.
 * Swap the store to Upstash Redis for multi-instance production use.
 */
import crypto from "crypto";

interface Slot {
  count: number;
  resetAt: number;
}

const store = new Map<string, Slot>();

// Periodic GC — removes stale entries to prevent memory leaks
try {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of store) {
      if (v.resetAt < now) store.delete(k);
    }
  }, 60_000);
  // Don't block process exit in Node.js
  if (typeof timer === "object" && "unref" in timer) timer.unref();
} catch {
  // Edge runtime may not support setInterval — safe to ignore
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Check and increment a rate limit counter.
 * @param identifier - raw key string (hashed internally so raw PINs are never stored)
 * @param limit      - max allowed calls within the window
 * @param windowMs   - sliding window duration in milliseconds
 */
export function checkRateLimit(
  identifier: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const key = crypto.createHash("sha256").update(identifier).digest("hex");
  const now = Date.now();
  const slot = store.get(key);

  if (!slot || slot.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  if (slot.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((slot.resetAt - now) / 1000),
    };
  }

  slot.count++;
  return {
    allowed: true,
    remaining: limit - slot.count,
    retryAfterSeconds: 0,
  };
}
