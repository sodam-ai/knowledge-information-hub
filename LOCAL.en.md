# Knowledge Information Hub — Desktop App Guide (English)

> A single-user knowledge vault that runs entirely on your computer, no internet required.
> All data stays in a user folder. Back up that folder and you're done.

🌐 **한국어 문서**: [LOCAL.md](./LOCAL.md)
🌐 **Cloud mode (team)**: [README.en.md](./README.en.md)

---

## Who is this guide for?

- One person on one computer (family sharing OK)
- Must work even when the internet is down
- No dependency on Supabase, Vercel, or other external services
- Zero sign-up, login, or admin-page complexity

---

## Quick Start (5 minutes)

### Step 1 — Double-click the installer

Built artifact (built by a developer and handed to you):
```
dist-electron/KIH-Setup-1.3.2-x64.exe
```

- Double-click → if "Windows protected your PC" appears, click **"More info → Run anyway"**
- (Normal warning because the app isn't code-signed. One-time click.)

### Step 2 — Install

The NSIS wizard handles the rest. Just click "Next → Next → Install" with defaults.

### Step 3 — Launch

- Double-click **Knowledge Information Hub** in the Start menu or on the desktop
- An Electron window opens and goes **straight to the feed** (no password prompt)

---

## v1.3.2 Changes (2026-05-17)

| Change | Impact |
|---|---|
| ❌ **Password page removed** | First screen is the dashboard |
| ❌ **Admin page (`/admin`) removed** | No password-change UI (unnecessary for single user) |
| ❌ **Logout button removed** | Cleaner header |
| ✅ **🗑️ Trash page added** | Trash icon on the right of the header → `/trash` |
| ✅ **Trash actions** | Auto-load deleted items / restore / permanent delete / empty all |

---

## How to Use

### Save an item
1. **+ Add** button at the top right of the dashboard
2. Choose Link / Note / File
3. On save, title and thumbnail are auto-extracted (for links)

### Delete an item
1. Card menu (right side) → Delete
2. Item moves to the trash (not permanently deleted)

### Use the trash
- Click the 🗑️ icon on the right of the header → deleted items auto-load
- Per-item buttons:
  - ↩️ **Restore** — back to the dashboard
  - ✕ **Permanent delete** — irreversible (one confirmation dialog)
- Top **Empty all** — permanently delete everything in the trash (one confirmation dialog)

### Search
- Search box in the header (works from 1 character)
- Korean word-segment search supported (FTS5 unicode61)

---

## Data Location

```
%APPDATA%\knowledge-information-hub\
├── data/
│   ├── kih.db          ← all data (single DB file)
│   └── backups/        ← auto backups (30-day rotation)
├── session.secret      ← session signing key (auto-generated)
├── kih-server.log      ← server log
└── ...
```

**How to back up**: copy the entire folder above to an external drive / USB.

**How to move**: install v1.3.2 on the other PC → overwrite the folder above at the same location.

---

## FAQ

**Q. Nothing happens when I double-click the installer**
→ Likely blocked by Windows Defender SmartScreen. If the blue screen flashes, click "More info → Run anyway". If not, check your antivirus (Avast / Norton / etc.) quarantine list.

**Q. App opens but shows a blank screen**
→ Open Task Manager, end all "Knowledge Information Hub" processes, then launch again. If still broken, check `%APPDATA%\knowledge-information-hub\kih-server.log`.

**Q. Where is my data?**
→ `%APPDATA%\knowledge-information-hub\data\kih.db` (Windows shortcut: `Win+R` → type `%APPDATA%`)

**Q. The password screen came back**
→ You may have an old version (v1.2.x or earlier) installed. Uninstall "Knowledge Information Hub" from Control Panel, then install v1.3.2 fresh.

**Q. Does it work offline?**
→ ✅ Fully local. However, **link title / thumbnail extraction requires internet**. Without internet, the URL is stored as-is.

**Q. Can I sync between PCs?**
→ ❌ No sync feature in single-user mode. Manual backup / move only.

---

## Developer Build Guide

> Non-developers can skip this section. Reference only when building yourself.

### Requirements
- Node.js 22 (LTS recommended)
- Windows 10/11 (Electron build runs on Windows)
- 7 GB+ free disk (electron-builder temp files)

### Build commands
```powershell
cd "project folder"
npx @electron/rebuild -f -w better-sqlite3
npm run dist:win
```

Artifacts:
- `dist-electron/KIH-Setup-1.3.2-x64.exe` (installer, ~158 MB)
- `dist-electron/win-unpacked/Knowledge Information Hub.exe` (direct run)

### If the build hangs
This version routes Next.js build output to `.next-build` to bypass `.next` folder locking issues:
- Keep `distDir: ".next-build"` in `next.config.ts`
- Running 90+ other node processes simultaneously can hang the build → stop other Next.js dev servers

### Security notes
- Defaults in `.env.local` (e.g. `VIEW_PASSWORD=1234`) are placeholders. Desktop mode uses the auto-generated `session.secret`
- `data/*.db`, `PASSWORDS.md`, `.env*` are all `.gitignore`-blocked

---

## License

MIT — SoDam AI Studio
