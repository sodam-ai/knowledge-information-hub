import { z } from "zod";

// 내부 IP 차단 (SSRF 방지)
const BLOCKED_IP_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^\[?::1\]?$/,
  /^fc00:/i,
  /^fe80:/i,
];

export const safeUrlSchema = z
  .string()
  .min(1, "URL을 입력해주세요")
  .max(2048, "URL이 너무 깁니다")
  .refine((v) => {
    try {
      const url = new URL(v);
      if (!["http:", "https:"].includes(url.protocol)) return false;
      const host = url.hostname.toLowerCase();
      return !BLOCKED_IP_PATTERNS.some((p) => p.test(host));
    } catch {
      return false;
    }
  }, "유효하지 않거나 허용되지 않는 URL입니다");

// HTML/스크립트 문자 제거 (XSS 방지)
const sanitize = (v: string) => v.replace(/[<>&"'`]/g, "").trim();

const safeTextField = (max: number, msg?: string) =>
  z.string().max(max, msg ?? `${max}자 이하로 입력해주세요`).transform(sanitize);

// 그룹 카테고리 열거형 (SQL CHECK 제약과 동기화)
export const GROUP_CATEGORIES = [
  "ai",
  "dev",
  "design",
  "marketing",
  "study",
  "business",
  "investment",
  "etc",
] as const;

export const createTeamSchema = z.object({
  name: safeTextField(50).refine((v) => v.length >= 1, { message: "그룹 이름을 입력해주세요" }),
  description: safeTextField(200).optional(),
  category: z.enum(GROUP_CATEGORIES).optional(),
  is_public: z
    .union([z.boolean(), z.literal("true"), z.literal("false"), z.literal("")])
    .transform((v) => v === true || v === "true")
    .default(false),
});

export const joinTeamSchema = z.object({
  invite_code: z
    .string()
    .min(16, "유효하지 않은 초대 코드입니다")
    .max(64, "유효하지 않은 초대 코드입니다")
    .regex(/^[A-Za-z0-9_-]+$/, "유효하지 않은 초대 코드 형식입니다"),
});

export const createLinkSchema = z.object({
  type: z.literal("link"),
  url: safeUrlSchema,
  title: safeTextField(500).optional(),
  tags: z
    .array(safeTextField(30).refine((v) => v.length >= 1))
    .max(10, "태그는 최대 10개입니다")
    .optional()
    .default([]),
});

export const createNoteSchema = z.object({
  type: z.literal("note"),
  title: safeTextField(500).refine((v) => v.length >= 1, { message: "제목을 입력해주세요" }),
  content: z
    .string()
    .min(1, "내용을 입력해주세요")
    .max(50000, "내용이 너무 깁니다 (최대 5만자)")
    .transform((v) => v.replace(/</g, "&lt;").replace(/>/g, "&gt;").trim()),
  tags: z
    .array(safeTextField(30).refine((v) => v.length >= 1))
    .max(10, "태그는 최대 10개입니다")
    .optional()
    .default([]),
});

export const searchQuerySchema = z
  .string()
  .min(2, "검색어는 2자 이상 입력해주세요")
  .max(200, "검색어가 너무 깁니다")
  .transform(sanitize);

export const tagSchema = z.object({
  name: safeTextField(30).refine((v) => v.length >= 1, { message: "태그 이름을 입력해주세요" }),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "색상 코드는 #RRGGBB 형식이어야 합니다")
    .optional(),
});
