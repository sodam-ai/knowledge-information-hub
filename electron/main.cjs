// Knowledge Information Hub — Electron main process
// Next.js standalone server를 자식 프로세스로 fork하고 BrowserWindow에서 로드

const { app, BrowserWindow, shell, Menu } = require("electron");
const { fork } = require("node:child_process");
const { join } = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");

const PORT = 3737;
const HOSTNAME = "127.0.0.1";
const APP_URL = `http://${HOSTNAME}:${PORT}`;

let nextServer = null;
let mainWindow = null;

// ───────────────────────────────────────────────────────────
// 경로 결정 (패키징 전/후 분기)
// ───────────────────────────────────────────────────────────
function getStandalonePath() {
  if (app.isPackaged) {
    return join(process.resourcesPath, "app.asar.unpacked", ".next", "standalone");
  }
  return join(__dirname, "..", ".next", "standalone");
}

function getDataDir() {
  const dir = join(app.getPath("userData"), "data");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function loadOrGenerateSessionSecret() {
  const file = join(app.getPath("userData"), "session.secret");
  if (fs.existsSync(file)) {
    return fs.readFileSync(file, "utf-8").trim();
  }
  const sec = crypto.randomBytes(32).toString("hex");
  fs.mkdirSync(app.getPath("userData"), { recursive: true });
  fs.writeFileSync(file, sec, { mode: 0o600 });
  return sec;
}

// ───────────────────────────────────────────────────────────
// Next 서버 자식 프로세스
// ───────────────────────────────────────────────────────────
function startNextServer() {
  const standalone = getStandalonePath();
  const serverPath = join(standalone, "server.js");

  if (!fs.existsSync(serverPath)) {
    console.error(`[KIH] server.js not found: ${serverPath}`);
    app.quit();
    return;
  }

  const env = {
    ...process.env,
    NODE_ENV: "production",
    PORT: String(PORT),
    HOSTNAME,
    KIH_DATA_DIR: getDataDir(),
    SESSION_SECRET: loadOrGenerateSessionSecret(),
    VIEW_PASSWORD: process.env.VIEW_PASSWORD ?? "1234",
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ?? "admin1234",
  };

  nextServer = fork(serverPath, [], {
    env,
    cwd: standalone,
    silent: false,
  });

  nextServer.on("error", (err) => console.error("[KIH] next server error:", err));
  nextServer.on("exit", (code) => console.log("[KIH] next server exit:", code));
}

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

// ───────────────────────────────────────────────────────────
// BrowserWindow
// ───────────────────────────────────────────────────────────
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

// ───────────────────────────────────────────────────────────
// App lifecycle
// ───────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  startNextServer();

  const ready = await waitForServer();
  if (!ready) {
    console.error("[KIH] Next server failed to start in time");
    app.quit();
    return;
  }

  createWindow();

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

app.on("before-quit", () => {
  if (nextServer && !nextServer.killed) {
    nextServer.kill();
    nextServer = null;
  }
});
