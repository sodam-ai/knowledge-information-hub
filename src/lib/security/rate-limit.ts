import crypto from "crypto";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

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

export async function checkRateLimit(
  identifier: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const key = crypto.createHash("sha256").update(identifier).digest("hex");
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
