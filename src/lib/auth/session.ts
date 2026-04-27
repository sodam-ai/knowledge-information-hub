// Web Crypto API 기반 세션 관리 (Edge Runtime + Node.js 18+ 호환)

const SESSION_DAYS = 7;
export const SESSION_COOKIE = "klh_session";

function hexEncode(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexDecode(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

async function getHmacKey(): Promise<CryptoKey> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET 환경변수 미설정");
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function createSessionToken(): Promise<string> {
  const exp = String(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const key = await getHmacKey();
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(exp));
  return `${exp}.${hexEncode(sig)}`;
}

export async function verifySessionToken(token: string): Promise<boolean> {
  try {
    const [exp, sig] = token.split(".");
    if (!exp || !sig) return false;
    if (Date.now() >= Number(exp)) return false;
    const key = await getHmacKey();
    return crypto.subtle.verify("HMAC", key, hexDecode(sig).buffer as ArrayBuffer, new TextEncoder().encode(exp));
  } catch {
    return false;
  }
}

export async function hashPassword(password: string): Promise<string> {
  const key = await getHmacKey();
  const hash = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(password));
  return hexEncode(hash);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    secure: process.env.NODE_ENV === "production",
  };
}
