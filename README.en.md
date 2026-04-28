# Knowledge Link Hub

> An **open-access group knowledge vault** for links and notes — no account required

[한국어 문서 보기 →](./README.md)

---

## Table of Contents

- [Project Overview](#project-overview)
- [Key Features](#key-features)
- [Installation & Setup](#installation--setup)
- [Environment Variables](#environment-variables)
- [Supabase Migrations](#supabase-migrations)
- [Folder Structure](#folder-structure)
- [Deployment](#deployment)
- [Production Notes](#production-notes)
- [Guide for Non-Developers](#guide-for-non-developers)
- [License](#license)

---

## Project Overview

**Knowledge Link Hub** is an open-access knowledge vault where teams, study groups, and communities save links and notes together — and find them quickly at any time.

Anyone who knows the **4-digit view password** can access immediately. No sign-up, no accounts.

- **Stack**: Next.js 15 (App Router) · TypeScript · Supabase (PostgreSQL) · Tailwind CSS
- **Auth**: Single site-wide view password (4-digit numeric) · Web Crypto API HMAC-SHA256 sessions
- **Security**: SSRF defense · Rate limiting · Input validation · HttpOnly session cookie
- **Admin**: Change view/admin passwords at `/admin`
- **Copyright**: SoDam AI Studio

---

## Key Features

### Access
- No sign-up — just enter the 4-digit view password for instant access
- Sessions last 7 days (HMAC-SHA256 signed cookie, HttpOnly)
- Change view and admin passwords anytime at `/admin`

### Groups
- Create groups (public / private)
- Join via invite code at `/join` — enter the code from your admin, expiry auto-verified
- Browse public groups at `/explore`
- Categories: AI / Dev / Design / Marketing / Learning / Business / Investment / Other

### Content
- Save links (auto OG meta extraction — title + thumbnail)
- Save notes (text memos)
- Tag classification (comma-separated, up to 10 tags, tag filtering)
- All / Links / Notes filter tabs
- All-groups feed (unified view across all your groups)
- Search from 1 character (Korean consonants, alphabet, URL address)
  - 2+ characters: pg_trgm similarity search (title · content · URL · tags)
  - 1 character: direct ilike matching
- Card click → detail sheet (full content, thumbnail, tags, edit/delete)
- Link title click → opens external URL directly
- Inline editing (title · content · tags)
- Pin (pinned items appear in a top section of your feed)
- Date group headers (Today / Yesterday / This Week / This Month / Earlier)
- Soft delete (recoverable within 30 days)
- Infinite scroll (IntersectionObserver)
- Group onboarding (`/onboarding` — enter name, description, category and jump in)

### UI/UX
- Toast notification system (real-time feedback for save, edit, delete, error)
- Save bottom sheet (slide-up on mobile, modal on desktop)
- Clipboard auto-detect (auto-fills URL field if you've copied a link)
- OG meta preview (title + thumbnail appear as you type a URL)
- Card detail sheet (bottom sheet pattern, mobile and desktop)
- Compact card layout (2-row fixed, max 2 tags shown + overflow indicator)
- Fully responsive at 375px — header, cards, dialogs all optimized for mobile
- Accessibility: aria-labels on key buttons (pin, edit, delete, group switch, logout)
- Error boundary (error.tsx), skeleton loading (loading.tsx), global 404 (not-found.tsx)

### Security
- SSRF defense: blocks private IPs, loopback, cloud metadata endpoints (HTTPS-only)
- Rate limiting: OG extraction (20/min) via Upstash Redis sliding window
- Input validation: Zod schemas + HTML escaping
- Security headers: X-Frame-Options, CSP, HSTS, X-Content-Type-Options
- Session cookie: HttpOnly · SameSite=Strict · Secure (production)
- Password hashing: HMAC-SHA256 (Web Crypto API, timing-safe comparison)

---

## Installation & Setup

### Prerequisites
- Node.js 18+ (Node 20 LTS recommended)
- npm
- Supabase account and project
- Upstash Redis account (for rate limiting — free tier is enough)

### Step 1 — Clone the repository

```bash
git clone https://github.com/sodam-ai/knowledge-link-hub.git
cd knowledge-link-hub
```

### Step 2 — Install dependencies

```bash
npm install
```

### Step 3 — Configure environment variables

```bash
cp .env.example .env.local
# Open .env.local and fill in your values (see Environment Variables section below)
```

### Step 4 — Run Supabase migrations

In your Supabase Dashboard SQL Editor, run the files in `supabase/migrations/` in numeric order (001 → 009).

### Step 5 — Start the development server

```bash
npm run dev
```

Visit `http://localhost:3000` and enter the view password (default: `1234`).

---

## Environment Variables

Set these in your `.env.local` file:

```env
# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...   # server-only — never expose to client

# Site URL
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# View password — 4-digit numeric (initial value, changeable at /admin)
VIEW_PASSWORD=1234

# Admin password — used to access /admin and change view password
ADMIN_PASSWORD=your-admin-password

# Session signing secret — never expose; changing it invalidates all sessions
# Generate: openssl rand -hex 32
SESSION_SECRET=your-random-64-hex-chars

# Upstash Redis — rate limiting (recommended, fail-open if missing)
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=AX...

# Microlink.io — URL title auto-extraction (optional)
MICROLINK_API_KEY=
```

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-only) |
| `NEXT_PUBLIC_SITE_URL` | Yes | Site URL (e.g., `http://localhost:3000`) |
| `VIEW_PASSWORD` | Yes | Initial 4-digit numeric view password |
| `ADMIN_PASSWORD` | Yes | Initial admin password (change at `/admin`) |
| `SESSION_SECRET` | Yes | HMAC secret for session signing |
| `UPSTASH_REDIS_REST_URL` | Recommended | Upstash Redis URL (rate limiting) |
| `UPSTASH_REDIS_REST_TOKEN` | Recommended | Upstash Redis token |
| `MICROLINK_API_KEY` | Optional | Microlink API for URL title extraction |

> **Important**: Never commit `.env.local` to git. It is already listed in `.gitignore`.

---

## Supabase Migrations

In Supabase Dashboard > SQL Editor, run these files **in order**:

```
supabase/migrations/
├── 001_initial_schema.sql       # Base table structure
├── 002_search_rpc.sql           # Search RPC functions
├── 003_user_profile_trigger.sql
├── 004_fix_rls_recursion.sql
├── 005_groups_upgrade.sql
├── 006_username_auth.sql
├── 007_public_only.sql
├── 008_search_rpc_url.sql
└── 009_site_config.sql          # Password hash storage table (required)
```

> **Migration 009 is required.** The view/admin password change feature depends on the `site_config` table.

---

## Folder Structure

```
knowledge-link-hub/
├── src/
│   ├── actions/
│   │   ├── site-auth.ts       # Login & password change server actions
│   │   ├── items.ts           # Content CRUD server actions
│   │   └── teams.ts           # Group server actions (incl. invite code join)
│   ├── app/
│   │   ├── (auth)/login/      # View password login page
│   │   ├── (dashboard)/       # Dashboard (feed, group switch)
│   │   │   ├── error.tsx      #   Error boundary (prevents white screen of death)
│   │   │   └── loading.tsx    #   Skeleton loading UI
│   │   ├── not-found.tsx      # Global 404 page
│   │   ├── admin/             # Admin settings (password change)
│   │   ├── api/og/            # OG meta extraction API
│   │   ├── explore/           # Public group discovery page
│   │   ├── join/              # Join group via invite code
│   │   ├── onboarding/        # Create new group onboarding
│   │   └── share/             # Link share page
│   ├── components/
│   │   ├── items/             # ItemCard, ItemFeed, SaveItemButton, SearchBar
│   │   ├── layout/            # TeamHeader (group switch + admin link)
│   │   └── ui/                # Toast notification system
│   ├── lib/
│   │   ├── auth/session.ts    # Web Crypto API session management
│   │   ├── supabase/          # Supabase clients (server, client)
│   │   ├── security/          # Rate limiter
│   │   ├── validations/       # Zod schemas
│   │   └── utils.ts           # Utility functions
│   ├── middleware.ts           # Session cookie validation middleware
│   └── types/                 # TypeScript type definitions
├── supabase/
│   └── migrations/            # SQL migration files (001–009)
├── .env.example               # Environment variable template (no real values)
├── .gitignore
├── LICENSE                    # MIT License (SoDam AI Studio)
└── package.json
```

---

## Deployment

### Vercel (Recommended)

1. Import the repository at [vercel.com](https://vercel.com)
2. Add all environment variables in Vercel Dashboard > Settings > Environment Variables
   - Generate a fresh `SESSION_SECRET`: `openssl rand -hex 32`
   - Set secure `VIEW_PASSWORD` and `ADMIN_PASSWORD` before going live
3. Run SQL migrations 001–009 in your Supabase SQL Editor
4. After deploy, change passwords at `/admin`

```bash
# Using Vercel CLI
npm i -g vercel
vercel --prod
```

---

## Production Notes

1. **`SUPABASE_SERVICE_ROLE_KEY` is server-only** — exposing it in client code gives full DB access to anyone.
2. **Never expose `SESSION_SECRET`** — changing it invalidates all active sessions. Generate with `openssl rand -hex 32`.
3. **Change default passwords** — after deployment, go to `/admin` and change both `VIEW_PASSWORD` and `ADMIN_PASSWORD`.
4. **Migration order matters** — always run SQL files in 001→009 order.
5. **Migration 009 is required** — password change functionality requires the `site_config` table.
6. **Rate limiting** — without Upstash Redis, the system fails open (no limits). Always configure in production.
7. **Soft delete cleanup** — deleted items auto-purge after 30 days if you configure Supabase `pg_cron`.
8. **OG meta extraction** — the `/api/og` endpoint is session-protected and SSRF-defended. Microlink is optional.

---

## Guide for Non-Developers

> No coding experience needed! Just follow these steps.

### What You Need
- A computer (Windows / Mac)
- Internet connection
- [Node.js](https://nodejs.org) installed (LTS version recommended)
- A [Supabase](https://supabase.com) free account
- An [Upstash](https://upstash.com) free account (Redis, recommended)

### Step-by-Step

**1. Install Node.js**
- Download the "LTS" version from [nodejs.org](https://nodejs.org) and install it
- After installation, open a terminal and type `node --version` — if you see a version number, you're good

**2. Download the source code**
- Click the green `Code` button at the top of this page > `Download ZIP`, then unzip it
- Or run: `git clone https://github.com/sodam-ai/knowledge-link-hub.git`

**3. Open a terminal in the folder**
- Windows: Shift+right-click inside the folder > "Open PowerShell window here" or "Open in Terminal"
- Mac: Right-click the folder in Finder > "Services" > "New Terminal at Folder"

**4. Run the install command**
```
npm install
```
(Takes 1–3 minutes depending on your internet speed)

**5. Set up Supabase**
- Sign up at [supabase.com](https://supabase.com) and create a new project
- Go to Project Settings > API and copy the `Project URL` and `anon public` key
- Copy `.env.example` to `.env.local` and paste in the values
- Also copy the `service_role` key from the same page
- For `SESSION_SECRET`, type any long random string (64+ characters)

**6. Set up the database**
- Go to Supabase Dashboard > SQL Editor
- Open each file in `supabase/migrations/` one by one (001 to 009) and run them in order

**7. Start the app**
```
npm run dev
```
Visit `http://localhost:3000` in your browser and enter the view password (default: `1234`).

**8. Change your passwords (important!)**
- Go to `/admin` (default admin password: `12341234`)
- Change both the view password and admin password before sharing with anyone

**9. Invite others**
- Go to `/admin` > generate an invite code
- Share the code with whoever you want to invite
- They visit `/join` on your site and enter the code
- Invite codes expire — share them before the expiry date

### Frequently Asked Questions

**Q. I get "npm: command not found"**
A. Node.js isn't installed. Download the LTS version from [nodejs.org](https://nodejs.org).

**Q. I get "EADDRINUSE"**
A. Another program is using the same port. Run `npx kill-port 3000` and try again.

**Q. I forgot my password**
A. Check the `VIEW_PASSWORD` or `ADMIN_PASSWORD` value in your `.env.local` file. On Vercel, check Settings > Environment Variables.

**Q. The invite code isn't working**
A. The code may have expired — ask your admin for a new one. Codes are case-insensitive (auto-uppercased on entry).

---

## License

MIT License — Copyright (c) 2026 SoDam AI Studio

See [LICENSE](./LICENSE) for full terms.
