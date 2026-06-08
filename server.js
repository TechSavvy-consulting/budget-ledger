const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const zlib = require("node:zlib");
const { exec } = require("node:child_process");

const root = __dirname;
const configPath = path.join(root, "budget-app.config.json");
const authConfigPath = path.join(root, "auth.config.local.json");
const dataPath = process.env.DATA_PATH || path.join(root, "budget-ledger-data.json");
const worksheetTemplatePath = path.join(root, "templates", "budget-worksheet-template.xlsx");
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

const publicPaths = new Set(["/login", "/login.html", "/login.js", "/styles.css", "/assets/jess-simple-budget-ledger-logo.png", "/assets/mobile-login-qr.svg"]);
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

function newId() {
  return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex");
}

function titleName(value) {
  const clean = String(value || "User").replace(/@.*/, "").replace(/[._-]+/g, " ").trim();
  return clean.replace(/\b\w/g, (letter) => letter.toUpperCase()) || "User";
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

function readBinaryBody(req, limit = maxExportBody) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let length = 0;
    req.on("data", (chunk) => {
      length += chunk.length;
      if (length > limit) {
        reject(new Error("Request body is too large."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
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

async function handleChangeOwnPassword(req, res, session) {
  try {
    if (!auth) {
      sendJson(req, res, 200, { ok: true });
      return;
    }

    const raw = await readBody(req);
    const payload = JSON.parse(raw || "{}");
    const currentPassword = String(payload.currentPassword || "");
    const newPassword = String(payload.newPassword || "");
    const index = auth.users.findIndex((user) => user.username === session.username);
    const existing = index === -1 ? null : auth.users[index];

    if (!existing || verifyLogin(session.username, currentPassword) !== existing) {
      sendJson(req, res, 401, { ok: false, message: "Current password is incorrect." });
      return;
    }

    if (newPassword.length < 8) {
      sendJson(req, res, 400, { ok: false, message: "Use at least 8 characters for passwords." });
      return;
    }

    auth.users[index] = createCredential(existing.username, newPassword, existing.iterations || 210000, existing.role);
    writeAuthConfig();
    sendJson(req, res, 200, { ok: true });
  } catch {
    sendJson(req, res, 400, { ok: false, message: "Unable to change password." });
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
    const raw = await readExportBody(req);
    const state = JSON.parse(raw || "{}");
    const data = buildWorkbook(state);
    send(req, res, 200, data, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", {
      "Content-Disposition": 'attachment; filename="budget-ledger-export.xlsx"',
    });
  } catch (error) {
    sendJson(req, res, 500, { ok: false, message: error.message || "Workbook export failed." });
  }
}

async function handleBackupZip(req, res) {
  try {
    const state = await readExportBody(req);
    const files = {};
    for (const name of [
      "index.html",
      "styles.css",
      "app.js",
      "server.js",
      "login.html",
      "login.js",
      "budget-app.config.json",
      "package.json",
      "package-lock.json",
      "render.yaml",
      "README.md",
      "assets/jess-simple-budget-ledger-logo.png",
      "assets/mobile-login-qr.svg",
      "templates/budget-worksheet-template.xlsx",
    ]) {
      const source = path.join(root, name);
      if (fs.existsSync(source)) files[name] = fs.readFileSync(source);
    }
    files["budget-ledger-state.json"] = Buffer.from(state, "utf8");
    const data = createZip(files);
    send(req, res, 200, data, "application/zip", {
      "Content-Disposition": 'attachment; filename="budget-ledger-backup.zip"',
    });
  } catch (error) {
    sendJson(req, res, 500, { ok: false, message: error.message || "Backup failed." });
  }
}

async function handleSpreadsheetImport(req, res) {
  try {
    const buffer = await readBinaryBody(req);
    const result = parseBudgetWorksheet(buffer);
    sendJson(req, res, 200, { ok: true, ...result });
  } catch (error) {
    sendJson(req, res, 400, { ok: false, message: error.message || "Spreadsheet import failed." });
  }
}

function buildWorkbook(state) {
  if (!fs.existsSync(worksheetTemplatePath)) return buildGenericWorkbook(state);
  const files = parseZip(fs.readFileSync(worksheetTemplatePath));
  const filled = fillWorksheetTemplate(files, state);
  return createZip(filled);
}

function buildGenericWorkbook(state) {
  const sheets = workbookSheets(state);
  const files = {
    "[Content_Types].xml": contentTypesXml(sheets),
    "_rels/.rels": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    "xl/workbook.xml": workbookXml(sheets),
    "xl/_rels/workbook.xml.rels": workbookRelsXml(sheets),
  };
  sheets.forEach((sheet, index) => {
    files[`xl/worksheets/sheet${index + 1}.xml`] = worksheetXml(sheet.rows);
  });
  return createZip(files);
}

function workbookSheets(state = {}) {
  const books = Array.isArray(state.books) ? state.books : [];
  const ledgers = state.ledgers && typeof state.ledgers === "object" ? state.ledgers : state.ledger ? { [state.book?.id || "book"]: state.ledger } : {};
  const bookList = books.length ? books : [{ id: state.book?.id || Object.keys(ledgers)[0] || "book", name: state.book?.name || "Budget Book" }];
  const txnRows = [["Book","Date","Type","Payee","Description","Account","To Account","Category","Amount","Cleared","Reconciled","Notes"]];
  const accountRows = [["Book","Name","Type","Opening Balance","Current Balance","Statement Date","Statement Balance"]];
  const budgetRows = [["Book","Category","Group","Period","Limit"]];
  const recurringRows = [["Book","Name","Type","Account","To Account","Category","Amount","Cadence","Next Date"]];
  const summaryRows = [["Book","Income","Expenses","Assets","Liabilities","Net Worth","Transactions"]];

  for (const book of bookList) {
    const ledger = ledgers[book.id] || ledgers[Object.keys(ledgers)[0]] || {};
    const accounts = Array.isArray(ledger.accounts) ? ledger.accounts : [];
    const transactions = Array.isArray(ledger.transactions) ? ledger.transactions : [];
    const accountName = (id) => accounts.find((a) => a.id === id)?.name || "";
    transactions.forEach((t) => txnRows.push([book.name, t.date, t.type, t.payee, t.description, accountName(t.accountId), accountName(t.toAccountId), t.category, Number(t.amount || 0), !!t.cleared, !!t.reconciled, t.notes]));
    accounts.forEach((a) => accountRows.push([book.name, a.name, a.type, Number(a.openingBalance || 0), accountBalance(a, transactions, accounts), a.statementDate || "", Number(a.statementBalance || 0)]));
    (Array.isArray(ledger.budgets) ? ledger.budgets : []).forEach((b) => budgetRows.push([book.name, b.category, b.group, b.period, Number(b.monthlyLimit || 0)]));
    (Array.isArray(ledger.recurring) ? ledger.recurring : []).forEach((r) => recurringRows.push([book.name, r.name, r.type, accountName(r.accountId), accountName(r.toAccountId), r.category, Number(r.amount || 0), r.cadence, r.nextDate]));
    const income = transactions.filter((t) => t.type === "income").reduce((n, t) => n + Number(t.amount || 0), 0);
    const expenses = transactions.filter((t) => t.type === "expense").reduce((n, t) => n + Number(t.amount || 0), 0);
    const assets = accounts.filter((a) => a.type !== "liability").reduce((n, a) => n + accountBalance(a, transactions, accounts), 0);
    const liabilities = accounts.filter((a) => a.type === "liability").reduce((n, a) => n + accountBalance(a, transactions, accounts), 0);
    summaryRows.push([book.name, income, expenses, assets, liabilities, assets - liabilities, transactions.length]);
  }

  return [
    { name: "Summary", rows: summaryRows },
    { name: "Transactions", rows: txnRows },
    { name: "Accounts", rows: accountRows },
    { name: "Budgets", rows: budgetRows },
    { name: "Recurring", rows: recurringRows },
  ];
}

function accountBalance(account, transactions, accounts) {
  return Number(account.openingBalance || 0) + transactions.reduce((total, t) => total + accountDelta(t, account.id, accounts), 0);
}

function accountDelta(t, accountId, accounts) {
  const account = accounts.find((a) => a.id === accountId);
  const amount = Number(t.amount || 0);
  if (!account) return 0;
  if (t.type === "income" && t.accountId === accountId) return account.type === "liability" ? -amount : amount;
  if (t.type === "expense" && t.accountId === accountId) return account.type === "liability" ? amount : -amount;
  if (t.type === "transfer" && t.accountId === accountId) return account.type === "liability" ? amount : -amount;
  if (t.type === "transfer" && t.toAccountId === accountId) return account.type === "liability" ? -amount : amount;
  return 0;
}

function fillWorksheetTemplate(sourceFiles, state = {}) {
  const files = Object.fromEntries(Object.entries(sourceFiles).map(([name, data]) => [name, Buffer.from(data)]));
  const { book, ledger } = primaryLedger(state);
  const accounts = Array.isArray(ledger.accounts) ? ledger.accounts : [];
  const transactions = Array.isArray(ledger.transactions) ? ledger.transactions : [];
  const sheets = templateSheets(files);
  const monthSheets = sheets.filter((sheet) => !/^(aum|to copy worksheets|sheet1)$/i.test(sheet.name)).slice(0, 3);
  const months = transactionMonths(transactions).slice(0, monthSheets.length || 1);

  if (files["xl/workbook.xml"] && monthSheets.length) {
    let workbook = files["xl/workbook.xml"].toString("utf8");
    monthSheets.forEach((sheet, index) => {
      const name = monthSheetName(months[index] || months[0]);
      workbook = renameSheet(workbook, sheet.name, name);
      sheet.name = name;
    });
    files["xl/workbook.xml"] = Buffer.from(workbook, "utf8");
  }

  monthSheets.forEach((sheet, index) => {
    const month = months[index] || months[0];
    const monthTransactions = transactions.filter((t) => monthKey(t.date) === month);
    const xmlText = fillMonthlySheet(files[sheet.path]?.toString("utf8") || "", monthTransactions, accounts);
    files[sheet.path] = Buffer.from(xmlText, "utf8");
  });

  const aum = sheets.find((sheet) => /^aum$/i.test(sheet.name));
  if (aum && files[aum.path]) {
    files[aum.path] = Buffer.from(fillAumSheet(files[aum.path].toString("utf8"), book, ledger), "utf8");
  }

  delete files["xl/calcChain.xml"];
  if (files["[Content_Types].xml"]) {
    files["[Content_Types].xml"] = Buffer.from(files["[Content_Types].xml"].toString("utf8").replace(/<Override\b[^>]*PartName="\/xl\/calcChain\.xml"[^>]*\/>/g, ""), "utf8");
  }
  if (files["xl/_rels/workbook.xml.rels"]) {
    files["xl/_rels/workbook.xml.rels"] = Buffer.from(files["xl/_rels/workbook.xml.rels"].toString("utf8").replace(/<Relationship\b[^>]*Target="calcChain\.xml"[^>]*\/>/g, ""), "utf8");
  }
  return files;
}

function primaryLedger(state = {}) {
  const ledgers = state.ledgers && typeof state.ledgers === "object"
    ? state.ledgers
    : state.ledger
      ? { [state.book?.id || "book"]: state.ledger }
      : {};
  const books = Array.isArray(state.books) && state.books.length
    ? state.books
    : [{ id: state.book?.id || state.activeBookId || Object.keys(ledgers)[0] || "book", name: state.book?.name || "Household Budget" }];
  const book = books.find((entry) => entry.id === state.activeBookId) || books[0];
  return { book, ledger: ledgers[book.id] || ledgers[Object.keys(ledgers)[0]] || {} };
}

function transactionMonths(transactions) {
  const months = [...new Set(transactions.map((t) => monthKey(t.date)).filter(Boolean))].sort();
  return months.length ? months : [new Date().toISOString().slice(0, 7)];
}

function monthKey(date) {
  return /^\d{4}-\d{2}/.test(String(date || "")) ? String(date).slice(0, 7) : "";
}

function monthSheetName(month) {
  const [year, rawMonth] = String(month || new Date().toISOString().slice(0, 7)).split("-").map(Number);
  const names = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  return `${names[(rawMonth || 1) - 1]} ${year || new Date().getFullYear()}`;
}

function renameSheet(workbookXmlText, oldName, newName) {
  return workbookXmlText.replace(new RegExp(`(<sheet\\b[^>]*name=")${escapeRegExp(oldName)}("[^>]*>)`), `$1${xml(newName.slice(0, 31))}$2`);
}

function fillMonthlySheet(sheetXml, transactions, accounts) {
  let xmlText = sheetXml;
  for (let row = 4; row <= 49; row++) {
    for (const col of ["A","B","C","D","E","G","H","I","J","K"]) {
      xmlText = setSheetCell(xmlText, `${col}${row}`, "");
    }
  }

  const slots = [];
  for (let row = 4; row <= 49; row++) slots.push({ row, side: "left" });
  for (let row = 4; row <= 49; row++) slots.push({ row, side: "right" });

  transactions.slice(0, slots.length).forEach((t, index) => {
    const slot = slots[index];
    const cols = slot.side === "left"
      ? ["A","B","C","D","E"]
      : ["G","H","I","J","K"];
    const out = t.type === "income" ? "" : Number(t.amount || 0);
    const input = t.type === "income" ? Number(t.amount || 0) : "";
    const account = accounts.find((a) => a.id === t.accountId)?.name || "";
    const description = [t.payee || t.description || t.category || "Transaction", account].filter(Boolean).join(" - ");
    xmlText = setSheetCell(xmlText, `${cols[0]}${slot.row}`, dateToExcelSerial(t.date));
    xmlText = setSheetCell(xmlText, `${cols[1]}${slot.row}`, description);
    xmlText = setSheetCell(xmlText, `${cols[2]}${slot.row}`, t.cleared || t.reconciled ? "Y" : "");
    xmlText = setSheetCell(xmlText, `${cols[3]}${slot.row}`, out);
    xmlText = setSheetCell(xmlText, `${cols[4]}${slot.row}`, input);
  });
  return xmlText;
}

function fillAumSheet(sheetXml, book, ledger) {
  let xmlText = sheetXml;
  const accounts = Array.isArray(ledger.accounts) ? ledger.accounts : [];
  const transactions = Array.isArray(ledger.transactions) ? ledger.transactions : [];
  const assets = accounts.filter((a) => a.type !== "liability");
  const liabilities = accounts.filter((a) => a.type === "liability");

  xmlText = setSheetCell(xmlText, "A1", book?.name || "Household Budget");
  for (let row = 7; row <= 30; row++) {
    xmlText = setSheetCell(xmlText, `H${row}`, "");
    xmlText = setSheetCell(xmlText, `J${row}`, "");
  }
  for (let row = 33; row <= 45; row++) {
    xmlText = setSheetCell(xmlText, `H${row}`, "");
    xmlText = setSheetCell(xmlText, `I${row}`, "");
  }
  assets.slice(0, 24).forEach((account, index) => {
    const row = 7 + index;
    xmlText = setSheetCell(xmlText, `H${row}`, account.name);
    xmlText = setSheetCell(xmlText, `J${row}`, accountBalance(account, transactions, accounts));
  });
  liabilities.slice(0, 13).forEach((account, index) => {
    const row = 33 + index;
    xmlText = setSheetCell(xmlText, `H${row}`, account.name);
    xmlText = setSheetCell(xmlText, `I${row}`, Math.abs(accountBalance(account, transactions, accounts)));
  });
  return xmlText;
}

function parseBudgetWorksheet(buffer) {
  const files = parseZip(buffer);
  const strings = sharedStrings(files);
  const sheets = templateSheets(files);
  const ledger = { transactions: [], accounts: [], budgets: [], recurring: [] };
  const categories = new Set();

  const aum = sheets.find((sheet) => /^aum$/i.test(sheet.name));
  if (aum && files[aum.path]) {
    importAumAccounts(files[aum.path].toString("utf8"), strings, ledger);
  }

  let defaultAccount = ledger.accounts.find((a) => a.type !== "liability");
  if (!defaultAccount) {
    defaultAccount = importAccount({ name: "Spreadsheet Import", type: "asset", openingBalance: 0 });
    ledger.accounts.push(defaultAccount);
  }

  sheets
    .filter((sheet) => !/^(aum|to copy worksheets|sheet1)$/i.test(sheet.name))
    .forEach((sheet) => {
      const cells = sheetCells(files[sheet.path]?.toString("utf8") || "", strings);
      importMonthlyGrid(cells, sheet.name, ["A","B","C","D","E"], defaultAccount.id, ledger, categories);
      importMonthlyGrid(cells, sheet.name, ["G","H","I","J","K"], defaultAccount.id, ledger, categories);
    });

  for (const category of categories) {
    if (!/^income$/i.test(category) && !ledger.budgets.some((b) => b.category.toLowerCase() === category.toLowerCase())) {
      ledger.budgets.push(importBudget({ category, monthlyLimit: 0, period: "month", group: "expense" }));
    }
  }

  if (!ledger.transactions.length && ledger.accounts.length === 1 && ledger.accounts[0].name === "Spreadsheet Import") {
    ledger.accounts = [];
  }

  return {
    ledger,
    counts: {
      accounts: ledger.accounts.length,
      budgets: ledger.budgets.length,
      transactions: ledger.transactions.length,
    },
  };
}

function importAumAccounts(sheetXml, strings, ledger) {
  const cells = sheetCells(sheetXml, strings);
  const skip = /^(assets|liabilities|total|assets under management|checking accounts|savings accounts|cds|investments|real estate|vehicles|vehicle loan)$/i;
  for (let row = 7; row <= 45; row++) {
    const name = cleanText(cellValue(cells, `H${row}`));
    const assetValue = numberValue(cellValue(cells, `J${row}`));
    const liabilityValue = numberValue(cellValue(cells, `I${row}`));
    if (!name || skip.test(name)) continue;
    if (!assetValue && !liabilityValue) continue;
    if (/^[A-Z\s]+$/.test(name) && name.length < 20) continue;
    if (assetValue) ledger.accounts.push(importAccount({ name, type: "asset", openingBalance: assetValue }));
    else if (liabilityValue) ledger.accounts.push(importAccount({ name, type: "liability", openingBalance: liabilityValue }));
  }
}

function importMonthlyGrid(cells, sheetName, cols, accountId, ledger, categories) {
  let category = "";
  for (let row = 4; row <= 99; row++) {
    const first = cellValue(cells, `${cols[0]}${row}`);
    const description = cleanText(cellValue(cells, `${cols[1]}${row}`));
    const cleared = cleanText(cellValue(cells, `${cols[2]}${row}`));
    const out = numberValue(cellValue(cells, `${cols[3]}${row}`));
    const input = numberValue(cellValue(cells, `${cols[4]}${row}`));

    if (typeof first === "string" && cleanCategory(first)) {
      category = cleanCategory(first);
      continue;
    }

    const date = worksheetDate(first, sheetName);
    const amount = input || out;
    if (!date || !amount || !description) continue;
    if (/^(other|amt budgeted|income|giving|savings|utilities|debt pmt|fuel|grocery|entertainment|health|travel)$/i.test(description)) continue;

    const finalCategory = category || "Imported";
    categories.add(finalCategory);
    ledger.transactions.push(importTxn({
      date,
      type: input ? "income" : "expense",
      accountId,
      category: finalCategory,
      description: description || finalCategory,
      amount,
      cleared: boolText(cleared),
      reconciled: boolText(cleared),
    }));
  }
}

function importAccount({ name, type, openingBalance }) {
  return {
    id: crypto.randomUUID(),
    name: String(name || "Account"),
    type: type === "liability" ? "liability" : "asset",
    value: 0,
    owed: type === "liability" ? Number(openingBalance || 0) : 0,
    openingBalance: Number(openingBalance || 0),
    balance: Number(openingBalance || 0),
    statementDate: "",
    statementBalance: 0,
  };
}

function importBudget({ category, monthlyLimit, period, group }) {
  return {
    id: crypto.randomUUID(),
    category: String(category || "Other"),
    monthlyLimit: Number(monthlyLimit || 0),
    period: ["week","month","year"].includes(period) ? period : "month",
    group: group || "expense",
  };
}

function importTxn(input) {
  return {
    id: crypto.randomUUID(),
    date: input.date,
    type: input.type,
    payee: "",
    accountId: input.accountId,
    toAccountId: "",
    category: input.category,
    description: input.description,
    amount: Number(input.amount || 0),
    cleared: !!input.cleared,
    reconciled: !!input.reconciled,
    payPeriod: "none",
    notes: "",
    splits: [],
  };
}

function parseZip(buffer) {
  let eocd = -1;
  for (let index = buffer.length - 22; index >= 0; index--) {
    if (buffer.readUInt32LE(index) === 0x06054b50) {
      eocd = index;
      break;
    }
  }
  if (eocd === -1) throw new Error("Invalid workbook file.");
  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const files = {};
  for (let index = 0; index < count; index++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error("Invalid workbook directory.");
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.slice(offset + 46, offset + 46 + nameLength).toString("utf8").replaceAll("\\", "/");
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.slice(dataStart, dataStart + compressedSize);
    if (method === 0) files[name] = Buffer.from(compressed);
    else if (method === 8) files[name] = zlib.inflateRawSync(compressed);
    else throw new Error("Unsupported workbook compression.");
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

function templateSheets(files) {
  const workbook = files["xl/workbook.xml"]?.toString("utf8") || "";
  const rels = files["xl/_rels/workbook.xml.rels"]?.toString("utf8") || "";
  const targets = {};
  for (const match of rels.matchAll(/<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
    targets[match[1]] = normalizeWorkbookTarget(match[2]);
  }
  return [...workbook.matchAll(/<sheet\b[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)]
    .map((match) => ({ name: xmlDecode(match[1]), path: targets[match[2]] }))
    .filter((sheet) => sheet.path && files[sheet.path]);
}

function normalizeWorkbookTarget(target) {
  const clean = target.replace(/^\/+/, "");
  if (clean.startsWith("xl/")) return clean;
  return `xl/${clean}`;
}

function sharedStrings(files) {
  const text = files["xl/sharedStrings.xml"]?.toString("utf8") || "";
  return [...text.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((match) =>
    [...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((part) => xmlDecode(part[1])).join(""),
  );
}

function sheetCells(sheetXml, strings) {
  const cells = {};
  for (const match of sheetXml.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
    const ref = attr(match[1], "r");
    if (!ref) continue;
    const type = attr(match[1], "t");
    const body = match[2];
    const raw = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] || "";
    if (type === "s") cells[ref] = strings[Number(raw)] || "";
    else if (type === "inlineStr") cells[ref] = [...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((part) => xmlDecode(part[1])).join("");
    else if (raw !== "" && !Number.isNaN(Number(raw))) cells[ref] = Number(raw);
    else if (raw) cells[ref] = xmlDecode(raw);
  }
  return cells;
}

function cellValue(cells, ref) {
  return cells[ref] ?? "";
}

function setSheetCell(sheetXml, ref, value) {
  const cellPattern = /<c\b[^>]*(?:\/>|>[\s\S]*?<\/c>)/g;
  let replaced = false;
  let next = sheetXml.replace(cellPattern, (cell) => {
    if (attr(cell, "r") !== ref) return cell;
    replaced = true;
    const attrs = cell.match(/^<c\b([^>]*)>/)?.[1] || "";
    return buildTemplateCell(ref, value, attrs);
  });
  if (replaced) return next;

  const rowNumber = Number(ref.match(/\d+/)?.[0] || 1);
  const rowPattern = new RegExp(`(<row\\b(?=[^>]*\\br="${rowNumber}")[^>]*>)([\\s\\S]*?)(</row>)`);
  if (rowPattern.test(next)) {
    return next.replace(rowPattern, `$1$2${buildTemplateCell(ref, value)}$3`);
  }
  return next.replace("</sheetData>", `<row r="${rowNumber}">${buildTemplateCell(ref, value)}</row></sheetData>`);
}

function buildTemplateCell(ref, value, existingAttrs = "") {
  const style = existingAttrs.match(/\ss="[^"]+"/)?.[0] || "";
  if (value === "" || value === null || value === undefined) return `<c r="${ref}"${style}/>`;
  if (typeof value === "number" && Number.isFinite(value)) return `<c r="${ref}"${style}><v>${value}</v></c>`;
  return `<c r="${ref}"${style} t="inlineStr"><is><t>${xml(value)}</t></is></c>`;
}

function dateToExcelSerial(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) return "";
  const [year, month, day] = String(date).split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000) + 25569;
}

function worksheetDate(value, sheetName) {
  if (typeof value === "number" && value > 20000 && value < 80000) {
    return new Date((value - 25569) * 86400000).toISOString().slice(0, 10);
  }
  const raw = cleanText(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return "";
}

function monthFromSheetName(name) {
  const months = { january: "01", february: "02", march: "03", april: "04", may: "05", june: "06", july: "07", august: "08", september: "09", october: "10", november: "11", december: "12" };
  const match = String(name || "").match(/([A-Za-z]+)\s+(\d{4})/);
  if (!match) return "";
  const month = months[match[1].toLowerCase()];
  return month ? `${match[2]}-${month}` : "";
}

function cleanCategory(value) {
  const text = cleanText(value);
  if (!text || /^(date due|description|cleared|out|in|amt budgeted|total|balance|updated|other|rollover)$/i.test(text)) return "";
  return titleCase(text);
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function numberValue(value) {
  const number = Number(String(value ?? "").replace(/[$,]/g, ""));
  return Number.isFinite(number) ? Math.abs(number) : 0;
}

function boolText(value) {
  return /^(y|yes|true|1|x|cleared|reconciled)$/i.test(cleanText(value));
}

function titleCase(value) {
  return String(value || "").toLowerCase().split(/\s+/).filter(Boolean).map((part) => part[0].toUpperCase() + part.slice(1)).join(" ");
}

function attr(attrs, name) {
  return attrs.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] || "";
}

function xmlDecode(value) {
  return String(value ?? "")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function contentTypesXml(sheets) {
  const sheetOverrides = sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheetOverrides}</Types>`;
}

function workbookXml(sheets) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((sheet, index) => `<sheet name="${xml(sheet.name.slice(0, 31))}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")}</sheets></workbook>`;
}

function workbookRelsXml(sheets) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("")}</Relationships>`;
}

function worksheetXml(rows) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((row, r) => `<row r="${r + 1}">${row.map((value, c) => cellXml(value, r + 1, c)).join("")}</row>`).join("")}</sheetData></worksheet>`;
}

function cellXml(value, rowNumber, colIndex) {
  const ref = `${columnName(colIndex)}${rowNumber}`;
  if (typeof value === "number" && Number.isFinite(value)) return `<c r="${ref}"><v>${value}</v></c>`;
  return `<c r="${ref}" t="inlineStr"><is><t>${xml(value)}</t></is></c>`;
}

function columnName(index) {
  let n = index + 1, out = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    out = String.fromCharCode(65 + m) + out;
    n = Math.floor((n - m) / 26);
  }
  return out;
}

function xml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function createZip(files) {
  const entries = [];
  const central = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const data = Buffer.isBuffer(content) ? content : Buffer.from(String(content), "utf8");
    const nameBuffer = Buffer.from(name.replaceAll("\\", "/"), "utf8");
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    entries.push(local, nameBuffer, data);

    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(20, 4);
    dir.writeUInt16LE(20, 6);
    dir.writeUInt16LE(0, 8);
    dir.writeUInt16LE(0, 10);
    dir.writeUInt16LE(0, 12);
    dir.writeUInt16LE(0, 14);
    dir.writeUInt32LE(crc, 16);
    dir.writeUInt32LE(data.length, 20);
    dir.writeUInt32LE(data.length, 24);
    dir.writeUInt16LE(nameBuffer.length, 28);
    dir.writeUInt32LE(offset, 42);
    central.push(dir, nameBuffer);
    offset += local.length + nameBuffer.length + data.length;
  }
  const centralSize = central.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...entries, ...central, end]);
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function emptySavedState() {
  return { version: 4, theme: "classic", users: [], books: [], ledgers: {} };
}

function readSavedState() {
  if (!fs.existsSync(dataPath)) return null;
  const state = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  return {
    ...emptySavedState(),
    ...state,
    users: Array.isArray(state.users) ? state.users : [],
    books: Array.isArray(state.books) ? state.books : [],
    ledgers: state.ledgers && typeof state.ledgers === "object" ? state.ledgers : {},
  };
}

function writeSavedState(state) {
  fs.mkdirSync(path.dirname(dataPath), { recursive: true });
  fs.writeFileSync(dataPath, JSON.stringify(state, null, 2));
}

function blankLedger() {
  return { transactions: [], budgets: [], accounts: [], recurring: [] };
}

function ensureSessionUserBook(state, session, incoming = {}) {
  const username = session.username || "local";
  const role = session.role === "admin" ? "admin" : "user";
  const incomingUser = Array.isArray(incoming.users) ? incoming.users[0] : incoming.user;
  let user = state.users.find((entry) => entry.email === username);

  if (!user) {
    user = {
      id: newId(),
      name: incomingUser?.name || titleName(username),
      email: username,
      role,
    };
    state.users.push(user);
  }

  user.email = username;
  user.role = role;
  if (!user.name) user.name = incomingUser?.name || titleName(username);

  let book = state.books.find((entry) => entry.ownerUserId === user.id);
  if (!book) {
    const incomingBook = Array.isArray(incoming.books) ? incoming.books[0] : incoming.book;
    book = {
      id: newId(),
      name: incomingBook?.name || `${user.name}'s Budget`,
      ownerUserId: user.id,
    };
    state.books.push(book);
  }

  state.ledgers[book.id] ||= blankLedger();
  return { user, book };
}

function scopedStateForSession(state, session) {
  const { user, book } = ensureSessionUserBook(state, session);
  return {
    version: state.version || 4,
    theme: user.theme || state.theme || "classic",
    currentMonth: user.currentMonth || state.currentMonth,
    periodMode: user.periodMode || state.periodMode,
    activeUserId: user.id,
    activeBookId: book.id,
    activeRegisterAccountId: user.activeRegisterAccountId || "",
    registerStartDate: user.registerStartDate,
    registerEndDate: user.registerEndDate,
    transactionStartDate: user.transactionStartDate,
    transactionEndDate: user.transactionEndDate,
    users: [{ ...user }],
    books: [{ ...book }],
    ledgers: { [book.id]: state.ledgers[book.id] || blankLedger() },
  };
}

function firstIncomingLedger(incoming) {
  if (incoming.ledger && typeof incoming.ledger === "object") return incoming.ledger;
  if (incoming.ledgers && typeof incoming.ledgers === "object") {
    const active = incoming.activeBookId && incoming.ledgers[incoming.activeBookId];
    if (active) return active;
    const firstKey = Object.keys(incoming.ledgers)[0];
    if (firstKey) return incoming.ledgers[firstKey];
  }
  return blankLedger();
}

function mergeScopedState(fullState, incoming, session) {
  const { user, book } = ensureSessionUserBook(fullState, session, incoming);
  const incomingLedger = firstIncomingLedger(incoming);

  user.theme = incoming.theme || user.theme || fullState.theme || "classic";
  user.currentMonth = incoming.currentMonth || user.currentMonth;
  user.periodMode = incoming.periodMode || user.periodMode;
  user.activeRegisterAccountId = incoming.activeRegisterAccountId || "";
  user.registerStartDate = incoming.registerStartDate || user.registerStartDate;
  user.registerEndDate = incoming.registerEndDate || user.registerEndDate;
  user.transactionStartDate = incoming.transactionStartDate || user.transactionStartDate;
  user.transactionEndDate = incoming.transactionEndDate || user.transactionEndDate;
  fullState.ledgers[book.id] = incomingLedger;
  return fullState;
}

async function handleGetState(req, res, session) {
  try {
    const state = readSavedState();
    if (!state) {
      if (auth && session.role !== "admin") {
        const created = emptySavedState();
        const scoped = scopedStateForSession(created, session);
        writeSavedState(created);
        sendJson(req, res, 200, { ok: true, state: scoped });
        return;
      }
      sendJson(req, res, 200, { ok: true, state: null });
      return;
    }

    if (auth && session.role !== "admin") {
      const scoped = scopedStateForSession(state, session);
      writeSavedState(state);
      sendJson(req, res, 200, { ok: true, state: scoped });
      return;
    }

    sendJson(req, res, 200, { ok: true, state });
  } catch {
    sendJson(req, res, 500, { ok: false, message: "Saved state could not be read." });
  }
}

async function handlePutState(req, res, session) {
  try {
    const raw = await readBody(req, maxStateBody);
    const state = JSON.parse(raw || "{}");

    if (auth && session.role !== "admin") {
      const fullState = readSavedState() || emptySavedState();
      writeSavedState(mergeScopedState(fullState, state, session));
      sendJson(req, res, 200, { ok: true });
      return;
    }

    writeSavedState(state);
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
      if (body.includes("<title>Jess's Simple Household Budget Ledger</title>")) {
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

  if (pathname === "/api/auth/password" && req.method === "POST") {
    await handleChangeOwnPassword(req, res, session);
    return;
  }

  if (pathname === "/api/state" && req.method === "GET") {
    await handleGetState(req, res, session);
    return;
  }

  if (pathname === "/api/state" && req.method === "PUT") {
    await handlePutState(req, res, session);
    return;
  }

  if (pathname === "/api/export-workbook" && req.method === "POST") {
    await handleWorkbookExport(req, res);
    return;
  }

  if (pathname === "/api/import-spreadsheet" && req.method === "POST") {
    await handleSpreadsheetImport(req, res);
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
