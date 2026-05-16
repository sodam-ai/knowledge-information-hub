// Knowledge Information Hub — Electron main (F3 in-process embed)
// Next.js standalone server.js를 같은 process에서 require로 실행 (fork X)

const { app, BrowserWindow, shell, Menu, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
const { join } = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");

const PORT = 3737;
const HOSTNAME = "127.0.0.1";
const APP_URL = `http://${HOSTNAME}:${PORT}`;

let mainWindow = null;

// ── Single Instance Lock (다중 실행 방지, EADDRINUSE 차단) ──
if (!app.requestSingleInstanceLock()) {
  process.exit(0);
}

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// ── 경로 ─────────────────────────────────────────────
function getStandalonePath() {
  return app.isPackaged
    ? join(process.resourcesPath, "app.asar.unpacked", ".next", "standalone")
    : join(__dirname, "..", ".next", "standalone");
}

function getDataDir() {
  const dir = join(app.getPath("userData"), "data");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function loadOrGenerateSessionSecret() {
  const file = join(app.getPath("userData"), "session.secret");
  if (fs.existsSync(file)) return fs.readFileSync(file, "utf-8").trim();
  const sec = crypto.randomBytes(32).toString("hex");
  fs.mkdirSync(app.getPath("userData"), { recursive: true });
  fs.writeFileSync(file, sec, { mode: 0o600 });
  return sec;
}

// ── In-process Next.js server (fork X, require O) ───
function startNextServerInProcess() {
  const standalone = getStandalonePath();
  const serverPath = join(standalone, "server.js");

  fs.mkdirSync(app.getPath("userData"), { recursive: true });
  const logFile = join(app.getPath("userData"), "kih-server.log");
  const logStream = fs.createWriteStream(logFile, { flags: "a" });
  logStream.write(
    `\n[${new Date().toISOString()}] in-process startNextServer\n  standalone: ${standalone}\n  serverPath exists: ${fs.existsSync(serverPath)}\n`
  );

  if (!fs.existsSync(serverPath)) {
    logStream.write(`[KIH] server.js not found: ${serverPath}\n`);
    app.quit();
    return;
  }

  // env BEFORE require (server.js reads at module load)
  Object.assign(process.env, {
    NODE_ENV: "production",
    PORT: String(PORT),
    HOSTNAME,
    KIH_DATA_DIR: getDataDir(),
    SESSION_SECRET: loadOrGenerateSessionSecret(),
    VIEW_PASSWORD: process.env.VIEW_PASSWORD ?? "1234",
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ?? "admin1234",
  });

  // cwd for standalone (server.js relative paths)
  process.chdir(standalone);

  // 비동기 에러 로그 (같은 process라 fork stdout pipe 불필요)
  process.on("uncaughtException", (err) => {
    logStream.write(
      `[${new Date().toISOString()}] uncaughtException: ${err.stack || err.message}\n`
    );
  });
  process.on("unhandledRejection", (reason) => {
    logStream.write(
      `[${new Date().toISOString()}] unhandledRejection: ${
        reason instanceof Error ? reason.stack : String(reason)
      }\n`
    );
  });

  // 같은 process에서 require — fork X, NODE_PATH hack X
  try {
    require(serverPath);
  } catch (err) {
    logStream.write(
      `[${new Date().toISOString()}] server.js require failed: ${err.stack || err.message}\n`
    );
    app.quit();
  }
}

// ── Server ready 대기 ────────────────────────────────
async function waitForServer(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${APP_URL}/login`);
      if (res.ok) return true;
    } catch {
      /* not ready */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

// ── BrowserWindow ────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: "Knowledge Information Hub",
    backgroundColor: "#fafafa",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(APP_URL)) return { action: "allow" };
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(APP_URL)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.loadURL(APP_URL);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ── App lifecycle ────────────────────────────────────
app.whenReady().then(async () => {
  startNextServerInProcess();

  const ready = await waitForServer();
  if (!ready) {
    console.error("[KIH] Next server failed to start in time");
    app.quit();
    return;
  }

  createWindow();

  // ── Auto-updater (packaged 빌드에서만) ───────────────
  if (app.isPackaged) {
    const updaterLog = join(app.getPath("userData"), "kih-server.log");
    const updaterStream = fs.createWriteStream(updaterLog, { flags: "a" });
    autoUpdater.autoDownload = true;
    autoUpdater.logger = {
      info:  (msg) => updaterStream.write(`[updater] ${msg}\n`),
      warn:  (msg) => updaterStream.write(`[updater] WARN ${msg}\n`),
      error: (msg) => updaterStream.write(`[updater] ERROR ${msg}\n`),
      debug: () => {},
    };
    autoUpdater.on("update-downloaded", () => {
      dialog.showMessageBox(mainWindow, {
        type: "info",
        title: "업데이트 준비됨",
        message: "새 버전이 다운로드되었습니다. 재시작하면 업데이트가 적용됩니다.",
        buttons: ["지금 재시작", "나중에"],
        defaultId: 0,
      }).then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall();
      });
    });
    autoUpdater.on("error", (err) => {
      updaterStream.write(`[updater] error: ${err.message}\n`);
    });
    setTimeout(() => autoUpdater.checkForUpdates(), 3000);
  }

  if (process.platform === "darwin") {
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        {
          label: "Knowledge Information Hub",
          submenu: [
            { role: "about" },
            { type: "separator" },
            { role: "hide" },
            { role: "hideOthers" },
            { role: "unhide" },
            { type: "separator" },
            { role: "quit" },
          ],
        },
        {
          label: "Edit",
          submenu: [
            { role: "undo" },
            { role: "redo" },
            { type: "separator" },
            { role: "cut" },
            { role: "copy" },
            { role: "paste" },
            { role: "selectAll" },
          ],
        },
      ])
    );
  } else {
    Menu.setApplicationMenu(null);
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
