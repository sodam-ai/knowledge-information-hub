export type UserRole = "admin" | "member";

export type ItemType = "link" | "note" | "file" | "ai_chat";

export type GroupCategory =
  | "ai"
  | "dev"
  | "design"
  | "marketing"
  | "study"
  | "business"
  | "investment"
  | "etc";

export const CATEGORY_LABELS: Record<GroupCategory, string> = {
  ai: "AI / 머신러닝",
  dev: "개발 / 프로그래밍",
  design: "디자인 / UX",
  marketing: "마케팅 / 성장",
  study: "학습 / 스터디",
  business: "비즈니스 / 창업",
  investment: "투자 / 재테크",
  etc: "기타",
};

export const CATEGORY_COLORS: Record<GroupCategory, { bg: string; text: string }> = {
  ai: { bg: "bg-violet-100", text: "text-violet-700" },
  dev: { bg: "bg-blue-100", text: "text-blue-700" },
  design: { bg: "bg-pink-100", text: "text-pink-700" },
  marketing: { bg: "bg-orange-100", text: "text-orange-700" },
  study: { bg: "bg-emerald-100", text: "text-emerald-700" },
  business: { bg: "bg-slate-100", text: "text-slate-700" },
  investment: { bg: "bg-amber-100", text: "text-amber-700" },
  etc: { bg: "bg-gray-100", text: "text-gray-600" },
};

export type ItemCategory =
  | "article"
  | "tutorial"
  | "tool"
  | "reference"
  | "document"
  | "idea"
  | "etc";

export const ITEM_CATEGORY_LABELS: Record<ItemCategory, string> = {
  article: "아티클 / 뉴스",
  tutorial: "튜토리얼",
  tool: "도구 / 서비스",
  reference: "레퍼런스",
  document: "문서 / PDF",
  idea: "아이디어",
  etc: "기타",
};

export const ITEM_CATEGORY_COLORS: Record<ItemCategory, { bg: string; text: string }> = {
  article:   { bg: "bg-blue-100",    text: "text-blue-700" },
  tutorial:  { bg: "bg-amber-100",   text: "text-amber-700" },
  tool:      { bg: "bg-emerald-100", text: "text-emerald-700" },
  reference: { bg: "bg-sky-100",     text: "text-sky-700" },
  document:  { bg: "bg-orange-100",  text: "text-orange-700" },
  idea:      { bg: "bg-pink-100",    text: "text-pink-700" },
  etc:       { bg: "bg-zinc-100",    text: "text-zinc-600" },
};

export interface Team {
  id: string;
  name: string;
  invite_code: string;
  invite_expires_at: string;
  is_public: boolean;
  description: string | null;
  category: GroupCategory | null;
  created_at: string;
}

export interface PublicGroup {
  id: string;
  name: string;
  description: string | null;
  category: GroupCategory | null;
  is_public: boolean;
  created_at: string;
  member_count: number;
  is_joined: boolean;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  is_anonymized: boolean;
  anonymized_at: string | null;
  created_at: string;
}

export interface UserTeam {
  user_id: string;
  team_id: string;
  role: UserRole;
  joined_at: string;
  invited_by: string | null;
  left_at: string | null;
}

export interface Item {
  id: string;
  type: ItemType;
  title: string;
  content: string | null;
  url: string | null;
  url_hash: string | null;
  file_path: string | null;
  file_mime: string | null;
  thumbnail_url: string | null;
  collection_id: string | null;
  category: ItemCategory | null;
  is_pinned: boolean;
  view_count: number;
  team_id: string;
  created_by: string | null;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  tags?: Tag[];
  creator?: Pick<User, "id" | "name" | "avatar_url"> | null;
}

export interface Tag {
  id: string;
  name: string;
  color: string | null;
  team_id: string;
}

export interface ItemTag {
  item_id: string;
  tag_id: string;
  is_auto: boolean;
}

export interface DeletedEmail {
  id: string;
  email_hash: string;
  deleted_at: string;
  blocked_until: string;
}

export interface Collection {
  id: string;
  name: string;
  team_id: string;
  created_by: string | null;
  created_at: string;
}


export interface CreateItemInput {
  type: ItemType;
  title?: string;
  content?: string;
  url?: string;
  tags?: string[];
}

export interface CreateTeamInput {
  name: string;
  description?: string;
  category?: GroupCategory;
  // is_public removed: all groups are public community
}

export interface ActionResult<T = void> {
  data?: T;
  error?: string;
}
