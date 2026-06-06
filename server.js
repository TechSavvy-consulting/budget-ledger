const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { exec } = require("node:child_process");

const root = __dirname;
const configPath = path.join(root, "budget-app.config.json");
const authConfigPath = path.join(root, "auth.config.local.json");
const dataPath = process.env.DATA_PATH || path.join(root, "budget-ledger-data.json");
const defaultConfig = {
  port: 4173,
  host: "127.0.0.1",
  openBrowser: true,
  authRequired: false,
};

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
};

const publicPaths = new Set(["/login", "/login.html", "/login.js", "/styles.css"]);
const sessions = new Map();
const sessionTtlMs = 1000 * 60 * 60 * 12;
const sessionCookie = "budget_session";
const maxLoginBody = 10_000;
const maxExportBody = 20_000_000;
const maxStateBody = 20_000_000;

function readConfig() {
  try {
    return { ...defaultConfig, ...JSON.parse(fs.readFileSync(configPath, "utf8")) };
  } catch {
    return defaultConfig;
  }
}

function readAuthConfig() {
  const envUsername = process.env.AUTH_USERNAME || process.env.ADMIN_USERNAME;
  const envPassword = process.env.AUTH_PASSWORD || process.env.ADMIN_PASSWORD;
  const envHash = process.env.AUTH_PASSWORD_HASH || process.env.ADMIN_PASSWORD_HASH;
  const envSalt = process.env.AUTH_PASSWORD_SALT || process.env.ADMIN_PASSWORD_SALT;
  const envIterations = Number(process.env.AUTH_PASSWORD_ITERATIONS || 210000);

  if (envUsername && envPassword) {
    return normalizeAuthUsers({ users: [createCredential(envUsername, envPassword, envIterations, "admin")] });
  }

  if (envUsername && envHash && envSalt) {
    return normalizeAuthUsers({ users: [{
      username: envUsername,
      hash: envHash,
      salt: envSalt,
      iterations: envIterations,
      digest: process.env.AUTH_PASSWORD_DIGEST || "sha256",
      role: "admin",
    }] });
  }

  try {
    const saved = JSON.parse(fs.readFileSync(authConfigPath, "utf8"));
    if (Array.isArray(saved.users) && saved.users.length) return normalizeAuthUsers(saved);
    if (saved.username && saved.hash && saved.salt) {
      return normalizeAuthUsers({ users: [{
        username: saved.username,
        hash: saved.hash,
        salt: saved.salt,
        iterations: Number(saved.iterations || 210000),
        digest: saved.digest || "sha256",
        role: "admin",
      }] });
    }
  } catch {
    // Intentionally ignored so the startup error can explain every valid option.
  }

  throw new Error(
    "Authentication is not configured. Create auth.config.local.json or set AUTH_USERNAME and AUTH_PASSWORD.",
  );
}

function normalizeAuthUsers(input = {}) {
  const users = (Array.isArray(input.users) ? input.users : [])
    .filter((user) => user && user.username && user.hash && user.salt)
    .map((user, index) => ({
      username: String(user.username).trim(),
      salt: String(user.salt),
      iterations: Number(user.iterations || 210000),
      digest: user.digest || "sha256",
      hash: String(user.hash),
      role: user.role === "user" ? "user" : index === 0 ? "admin" : "user",
    }));

  if (!users.length) throw new Error("Authentication has no configured users.");
  return { users };
}

function createCredential(username, password, iterations, role = "user") {
  const salt = crypto.randomBytes(16).toString("hex");
  return {
    username: String(username).trim(),
    role: role === "admin" ? "admin" : "user",
    salt,
    iterations,
    digest: "sha256",
    hash: hashPassword(password, salt, iterations, "sha256"),
  };
}

function hashPassword(password, salt, iterations, digest) {
  return crypto.pbkdf2Sync(String(password), salt, iterations, 32, digest).toString("hex");
}

function safeEqualHex(left, right) {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function verifyLogin(username, password) {
  const user = auth.users.find((entry) => entry.username === username);
  if (!user) return null;
  const attempted = hashPassword(password, user.salt, user.iterations, user.digest);
  return safeEqualHex(attempted, user.hash) ? user : null;
}

function writeAuthConfig() {
  fs.writeFileSync(authConfigPath, JSON.stringify({ users: auth.users }, null, 2));
}

function publicAuthUsers() {
  return auth.users.map((user) => ({ username: user.username, role: user.role }));
}

function isSecureRequest(req) {
  return (
    req.socket.encrypted ||
    String(req.headers["x-forwarded-proto"] || "")
      .split(",")[0]
      .trim() === "https"
  );
}

function baseHeaders(req, type = "text/plain; charset=utf-8") {
  const headers = {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
  };

  if (isSecureRequest(req)) {
    headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
  }

  return headers;
}

function send(req, res, status, body, type = "text/plain; charset=utf-8", extraHeaders = {}) {
  res.writeHead(status, {
    ...baseHeaders(req, type),
    ...extraHeaders,
  });
  res.end(body);
}

function sendJson(req, res, status, value, extraHeaders = {}) {
  send(req, res, status, JSON.stringify(value), "application/json; charset=utf-8", extraHeaders);
}

function redirect(req, res, location) {
  send(req, res, 302, "", "text/plain; charset=utf-8", { Location: location });
}

function parseCookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie || "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return index === -1
          ? [part, ""]
          : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      }),
  );
}

function buildCookie(req, value, maxAgeSeconds) {
  const parts = [
    `${sessionCookie}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
  ];

  if (isSecureRequest(req) || process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function getSession(req) {
  const token = parseCookies(req)[sessionCookie];
  if (!token) return null;

  const session = sessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }

  session.expiresAt = Date.now() + sessionTtlMs;
  return session;
}

function createSession(req, res, username) {
  const user = auth.users.find((entry) => entry.username === username);
  const token = crypto.randomBytes(32).toString("base64url");
  sessions.set(token, {
    username,
    role: user?.role || "user",
    expiresAt: Date.now() + sessionTtlMs,
  });
  res.setHeader("Set-Cookie", buildCookie(req, token, Math.floor(sessionTtlMs / 1000)));
}

function clearSession(req, res) {
  const token = parseCookies(req)[sessionCookie];
  if (token) sessions.delete(token);
  res.setHeader("Set-Cookie", buildCookie(req, "", 0));
}

function resolveRequestPath(urlPath) {
  const cleanPath = decodeURIComponent(urlPath.split("?")[0]);
  const requested = cleanPath === "/" ? "/index.html" : cleanPath;
  const normalized = requested === "/login" ? "/login.html" : requested;
  const resolved = path.resolve(root, `.${normalized}`);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return resolved;
}

function openBrowser(url) {
  if (process.platform === "win32") {
    exec(`start "" "${url}"`);
  } else if (process.platform === "darwin") {
    exec(`open "${url}"`);
  } else {
    exec(`xdg-open "${url}"`);
  }
}

function acceptsHtml(req) {
  return String(req.headers.accept || "").includes("text/html");
}

function readBody(req, limit = maxLoginBody) {
  return readLimitedBody(req, limit);
}

function readExportBody(req) {
  return readLimitedBody(req, maxExportBody);
}

function readLimitedBody(req, limit) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > limit) {
        reject(new Error("Request body is too large."));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function handleLogin(req, res) {
  try {
    const raw = await readBody(req);
    const contentType = String(req.headers["content-type"] || "");
    const payload = contentType.includes("application/json")
      ? JSON.parse(raw || "{}")
      : Object.fromEntries(new URLSearchParams(raw));

    const user = verifyLogin(String(payload.username || ""), String(payload.password || ""));
    if (user) {
      createSession(req, res, user.username);
      sendJson(req, res, 200, { ok: true, username: user.username });
      return;
    }

    sendJson(req, res, 401, { ok: false, message: "Invalid username or password." });
  } catch {
    sendJson(req, res, 400, { ok: false, message: "Unable to process login." });
  }
}

async function handleGetAuthUsers(req, res) {
  if (!auth) {
    sendJson(req, res, 200, { ok: true, users: [] });
    return;
  }
  sendJson(req, res, 200, { ok: true, users: publicAuthUsers() });
}

async function handleSaveAuthUser(req, res) {
  try {
    if (!auth) {
      sendJson(req, res, 200, { ok: true, users: [] });
      return;
    }
    const raw = await readBody(req);
    const payload = JSON.parse(raw || "{}");
    const username = String(payload.username || "").trim();
    const previousUsername = String(payload.previousUsername || username).trim();
    const password = String(payload.password || "");
    const role = payload.role === "admin" ? "admin" : "user";
    const previousUsers = auth.users.map((user) => ({ ...user }));

    if (!username) {
      sendJson(req, res, 400, { ok: false, message: "Login username is required." });
      return;
    }

    const existingIndex = auth.users.findIndex((user) => user.username === previousUsername);
    const nameTaken = auth.users.some((user, index) => user.username === username && index !== existingIndex);
    if (nameTaken) {
      sendJson(req, res, 409, { ok: false, message: "That login username already exists." });
      return;
    }

    if (existingIndex === -1 && !password) {
      sendJson(req, res, 400, { ok: false, message: "Password is required for a new login." });
      return;
    }

    if (existingIndex === -1) {
      auth.users.push(createCredential(username, password, 210000, role));
    } else if (password) {
      auth.users[existingIndex] = createCredential(username, password, auth.users[existingIndex].iterations || 210000, role);
    } else {
      auth.users[existingIndex] = { ...auth.users[existingIndex], username, role };
    }

    if (!auth.users.some((user) => user.role === "admin")) {
      auth.users = previousUsers;
      sendJson(req, res, 400, { ok: false, message: "Keep at least one admin login user." });
      return;
    }

    writeAuthConfig();
    sendJson(req, res, 200, { ok: true, users: publicAuthUsers() });
  } catch {
    sendJson(req, res, 400, { ok: false, message: "Unable to save login user." });
  }
}

async function handleDeleteAuthUser(req, res) {
  try {
    if (!auth) {
      sendJson(req, res, 200, { ok: true, users: [] });
      return;
    }
    const raw = await readBody(req);
    const payload = JSON.parse(raw || "{}");
    const username = String(payload.username || "").trim();

    if (auth.users.length <= 1) {
      sendJson(req, res, 400, { ok: false, message: "Keep at least one login user." });
      return;
    }

    const nextUsers = auth.users.filter((user) => user.username !== username);
    if (nextUsers.length === auth.users.length) {
      sendJson(req, res, 404, { ok: false, message: "Login user was not found." });
      return;
    }

    if (!nextUsers.some((user) => user.role === "admin")) {
      sendJson(req, res, 400, { ok: false, message: "Keep at least one admin login user." });
      return;
    }

    auth.users = nextUsers;
    writeAuthConfig();
    sendJson(req, res, 200, { ok: true, users: publicAuthUsers() });
  } catch {
    sendJson(req, res, 400, { ok: false, message: "Unable to delete login user." });
  }
}

function serveFile(req, res, filePath) {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      send(req, res, 404, "Not found");
      return;
    }

    const type = contentTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    send(req, res, 200, data, type);
  });
}

async function handleWorkbookExport(req, res) {
  try {
    const state = await readExportBody(req);
    const outputDir = path.join(os.tmpdir(), "budget-ledger-exports");
    fs.mkdirSync(outputDir, { recursive: true });
    const statePath = path.join(outputDir, `budget-state-${Date.now()}.json`);
    const outputPath = path.join(outputDir, `budget-ledger-${Date.now()}.xlsx`);
    fs.writeFileSync(statePath, state);

    const pythonPath =
      process.env.PYTHON_EXE ||
      path.join(
        process.env.USERPROFILE || "",
        ".cache",
        "codex-runtimes",
        "codex-primary-runtime",
        "dependencies",
        "python",
        "python.exe",
      );
    const scriptPath = path.join(root, "scripts", "export_workbook.py");
    await runCommand(pythonPath, [scriptPath, statePath, outputPath], root);
    const data = fs.readFileSync(outputPath);
    send(req, res, 200, data, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", {
      "Content-Disposition": 'attachment; filename="budget-ledger-export.xlsx"',
    });
    scheduleCleanup([statePath, outputPath]);
  } catch (error) {
    sendJson(req, res, 500, { ok: false, message: error.message || "Workbook export failed." });
  }
}

async function handleBackupZip(req, res) {
  try {
    const state = await readExportBody(req);
    const outputDir = path.join(os.tmpdir(), "budget-ledger-exports");
    const stagingDir = path.join(outputDir, `backup-${Date.now()}`);
    const zipPath = `${stagingDir}.zip`;
    fs.mkdirSync(stagingDir, { recursive: true });

    for (const name of [
      "index.html",
      "styles.css",
      "app.js",
      "server.js",
      "launch-budget-app.bat",
      "budget-app.config.json",
      "Budget worksheet template (2).xlsx",
    ]) {
      const source = path.join(root, name);
      if (fs.existsSync(source)) fs.copyFileSync(source, path.join(stagingDir, name));
    }
    fs.writeFileSync(path.join(stagingDir, "budget-ledger-state.json"), state);
    await runCommand("powershell.exe", [
      "-NoProfile",
      "-Command",
      `Compress-Archive -Path '${stagingDir.replaceAll("'", "''")}\\*' -DestinationPath '${zipPath.replaceAll("'", "''")}' -Force`,
    ], root);
    const data = fs.readFileSync(zipPath);
    send(req, res, 200, data, "application/zip", {
      "Content-Disposition": 'attachment; filename="budget-ledger-backup.zip"',
    });
    scheduleCleanup([stagingDir, zipPath]);
  } catch (error) {
    sendJson(req, res, 500, { ok: false, message: error.message || "Backup failed." });
  }
}

async function handleGetState(req, res) {
  try {
    if (!fs.existsSync(dataPath)) {
      sendJson(req, res, 200, { ok: true, state: null });
      return;
    }
    const state = JSON.parse(fs.readFileSync(dataPath, "utf8"));
    sendJson(req, res, 200, { ok: true, state });
  } catch {
    sendJson(req, res, 500, { ok: false, message: "Saved state could not be read." });
  }
}

async function handlePutState(req, res) {
  try {
    const raw = await readBody(req, maxStateBody);
    const state = JSON.parse(raw || "{}");
    fs.mkdirSync(path.dirname(dataPath), { recursive: true });
    fs.writeFileSync(dataPath, JSON.stringify(state, null, 2));
    sendJson(req, res, 200, { ok: true });
  } catch {
    sendJson(req, res, 400, { ok: false, message: "Saved state could not be written." });
  }
}

function scheduleCleanup(paths) {
  setTimeout(() => {
    for (const target of paths) {
      fs.rmSync(target, { recursive: true, force: true });
    }
  }, 3000).unref();
}

function runCommand(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = require("node:child_process").spawn(command, args, {
      cwd,
      windowsHide: true,
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr || `${command} exited with code ${code}`));
    });
  });
}

function openExistingAppOrReport(error) {
  const url = `http://${host}:${port}`;
  const req = http.get(url, (res) => {
    let body = "";
    res.setEncoding("utf8");
    res.on("data", (chunk) => {
      body += chunk;
      if (body.length > 20000) req.destroy();
    });
    res.on("end", () => {
      if (body.includes("<title>Budget Ledger</title>")) {
        console.log(`Budget Ledger is already running at ${url}`);
        if (shouldOpenBrowser) openBrowser(url);
        process.exit(0);
      }

      console.error(`Port ${port} is already in use by another app.`);
      console.error("Edit budget-app.config.json to use a different port, then run again.");
      process.exit(1);
    });
  });

  req.setTimeout(1500, () => {
    req.destroy();
    console.error(`Port ${port} is already in use, but Budget Ledger did not respond at ${url}.`);
    console.error("Edit budget-app.config.json to use a different port, then run again.");
    process.exit(1);
  });

  req.on("error", () => {
    console.error(`Port ${port} is already in use.`);
    console.error(error.message);
    console.error("Edit budget-app.config.json to use a different port, then run again.");
    process.exit(1);
  });
}

const config = readConfig();
const auth = config.authRequired ? readAuthConfig() : null;
const port = Number(process.env.PORT || config.port || defaultConfig.port);
const host = process.env.HOST || (process.env.PORT ? "0.0.0.0" : config.host || defaultConfig.host);
const shouldOpenBrowser =
  !process.env.PORT &&
  String(process.env.OPEN_BROWSER ?? config.openBrowser).toLowerCase() !== "false";

setInterval(() => {
  if (!auth) return;
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(token);
  }
}, 1000 * 60 * 15).unref();

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = requestUrl.pathname;
  const session = auth ? getSession(req) : { username: "local" };

  if (pathname === "/api/login" && req.method === "POST") {
    if (!auth) {
      sendJson(req, res, 200, { ok: true, username: "local" });
      return;
    }
    await handleLogin(req, res);
    return;
  }

  if (pathname === "/api/logout" && req.method === "POST") {
    if (auth) clearSession(req, res);
    sendJson(req, res, 200, { ok: true });
    return;
  }

  if (pathname === "/api/session" && req.method === "GET") {
    if (!auth) {
      sendJson(req, res, 200, { authenticated: true, username: "local", role: "admin" });
      return;
    }
    if (!session) {
      sendJson(req, res, 401, { authenticated: false });
      return;
    }
    sendJson(req, res, 200, { authenticated: true, username: session.username, role: session.role || "user" });
    return;
  }

  if (auth && (pathname === "/login" || pathname === "/login.html") && session) {
    redirect(req, res, "/");
    return;
  }

  if (auth && !session && !publicPaths.has(pathname)) {
    if (pathname.startsWith("/api/")) {
      sendJson(req, res, 401, { ok: false, message: "Authentication required." });
    } else if (acceptsHtml(req) || req.method === "GET") {
      redirect(req, res, "/login");
    } else {
      send(req, res, 401, "Authentication required.");
    }
    return;
  }

  if (pathname === "/api/auth/users" && req.method === "GET") {
    if (auth && session.role !== "admin") {
      sendJson(req, res, 403, { ok: false, message: "Admin access required." });
      return;
    }
    await handleGetAuthUsers(req, res);
    return;
  }

  if (pathname === "/api/auth/users" && req.method === "PUT") {
    if (auth && session.role !== "admin") {
      sendJson(req, res, 403, { ok: false, message: "Admin access required." });
      return;
    }
    await handleSaveAuthUser(req, res);
    return;
  }

  if (pathname === "/api/auth/users" && req.method === "DELETE") {
    if (auth && session.role !== "admin") {
      sendJson(req, res, 403, { ok: false, message: "Admin access required." });
      return;
    }
    await handleDeleteAuthUser(req, res);
    return;
  }

  if (pathname === "/api/state" && req.method === "GET") {
    await handleGetState(req, res);
    return;
  }

  if (pathname === "/api/state" && req.method === "PUT") {
    await handlePutState(req, res);
    return;
  }

  if (pathname === "/api/export-workbook" && req.method === "POST") {
    await handleWorkbookExport(req, res);
    return;
  }

  if (pathname === "/api/backup-zip" && req.method === "POST") {
    await handleBackupZip(req, res);
    return;
  }

  if (pathname.startsWith("/api/")) {
    sendJson(req, res, 404, { ok: false, message: "Not found." });
    return;
  }

  const filePath = resolveRequestPath(pathname);
  if (!filePath) {
    send(req, res, 403, "Forbidden");
    return;
  }

  serveFile(req, res, filePath);
});

server.listen(port, host, () => {
  const url = `http://${host}:${port}`;
  console.log(`Budget Ledger running at ${url}`);
  console.log(auth ? `Authentication enabled for ${auth.users.length} login user(s).` : "Authentication disabled.");
  console.log("Edit budget-app.config.json to change the local port.");
  console.log("Press Ctrl+C to stop the server.");
  if (shouldOpenBrowser) openBrowser(url);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    openExistingAppOrReport(error);
  } else {
    console.error(error.message);
    process.exit(1);
  }
});
