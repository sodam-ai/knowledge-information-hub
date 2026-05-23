# Knowledge Information Hub (KIH)

> A **personal knowledge vault desktop app** that runs entirely on your own computer  
> No sign-up · No login · Fully local · Works offline

[한국어 →](./README.md) | [Detailed Usage Guide →](./LOCAL.en.md)

---

## Key Features

| Feature | Description |
|---------|-------------|
| Save links & notes | Auto-extract URL title and thumbnail, text memos |
| Tags & categories | 12 auto-detected categories, up to 10 tags, sidebar filter |
| Full-text search | Korean single-character FTS5 search, tag search boost |
| Instant feed update | Feed updates immediately on save (optimistic update) |
| Trash bin | Soft delete, restore, permanent delete |
| Auto backup | Daily DB backup, 30-day retention |
| Fully local | SQLite single file — no Supabase, Vercel, or Redis needed |

---

## Installation

### Regular Users — Setup Wizard

If you received a built installer from the developer:

1. Double-click `KIH-Setup-x.x.x-x64.exe`
2. If "Windows protected your PC" appears → click **More info → Run anyway** (no code signing, one-time only)
3. Follow the NSIS wizard: "Next → Next → Install"
4. Launch **Knowledge Information Hub** from the Start Menu or desktop → feed screen opens immediately

> Detailed usage guide: [LOCAL.en.md](./LOCAL.en.md)

---

## Data Location

```
%APPDATA%\knowledge-information-hub\
├── data/
│   ├── kih.db        ← All your data (single SQLite file)
│   └── backups/      ← Auto backups (30-day retention)
├── session.secret    ← Session signing key (auto-generated)
└── kih-server.log    ← Server log
```

**Backup**: Copy the entire folder above to an external drive or USB.  
**Migrate to new PC**: Install the app on the new PC, then overwrite the same folder path.

---

## Developer Build Guide

### Requirements

- Node.js 22 LTS · Windows 10/11
- 7 GB+ free disk space

### Build Windows Installer

```powershell
npm install
npm run dist:win
```

Output:

```
dist-electron/
├── KIH-Setup-x.x.x-x64.exe           ← Distributable installer
└── win-unpacked/
    └── Knowledge Information Hub.exe  ← Direct run (no install)
```

### Development Server

```powershell
npm run dev     # http://localhost:3737
```

---

## Folder Structure

```
knowledge-information-hub/
├── electron/
│   ├── main.cjs            # Electron main process (embeds Next.js)
│   └── assets/             # Icon resources
├── src/
│   ├── actions/            # Server Actions (CRUD)
│   ├── app/
│   │   ├── (dashboard)/    # Dashboard · Explore · Trash
│   │   ├── api/og/         # OG meta extraction API (SSRF protected)
│   │   ├── onboarding/     # First-run initialization screen
│   │   └── share/          # Link share page
│   ├── components/
│   │   ├── items/          # ItemCard · ItemFeed · DashboardFeed · SaveItemButton
│   │   ├── layout/         # TeamHeader
│   │   └── ui/             # Toast system
│   └── lib/
│       ├── db/sqlite.ts    # better-sqlite3 singleton
│       ├── security/       # SSRF defense · input validation
│       └── validations/    # Zod schemas
├── db/
│   └── migrations/         # SQLite migrations (001~)
├── scripts/
│   ├── build-local.mjs     # Standalone build script
│   └── backup.mjs          # Auto-backup script
├── electron-builder.yml    # Electron packaging config
├── LOCAL.md                # User guide (Korean)
├── LOCAL.en.md             # User guide (English)
└── package.json
```

---

## FAQ

**Q. The app opened but shows a blank screen**  
→ Open Task Manager, end all "Knowledge Information Hub" processes, then relaunch. If still blank, check `%APPDATA%\knowledge-information-hub\kih-server.log`.

**Q. Where is my data stored?**  
→ `%APPDATA%\knowledge-information-hub\data\kih.db` (Windows shortcut: `Win+R` → type `%APPDATA%`)

**Q. Does it work without internet?**  
→ ✅ Fully local. However, **auto-extracting link titles and thumbnails requires internet**. Without it, the URL is saved as-is.

**Q. Can I sync across multiple PCs?**  
→ ❌ Single-user mode only. Manual backup and migration is the only option.

---

## License

MIT License — Copyright (c) 2026 SoDam AI Studio

See [LICENSE](./LICENSE) for details.
