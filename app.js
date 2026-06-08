const KEY = "budget-ledger-state-v4";
const today = dateInput(new Date());
const thisMonth = today.slice(0, 7);
const $ = (id) => document.getElementById(id);
const $$ = (selector) => [...document.querySelectorAll(selector)];
let syncReady = false;
let syncTimer;
let undo = [];
let redo = [];
let toastTimer;
let currentLogin = { username: "local", role: "admin" };
const monthStart = (value = thisMonth) => `${value}-01`;
const monthEnd = (value = thisMonth) => dateInput(new Date(new Date(`${value}-01T12:00:00`).getFullYear(), new Date(`${value}-01T12:00:00`).getMonth() + 1, 0, 12));

const el = {};
[
  "activeUserLabel","activeBookLabel","monthFilter","monthSelect","yearInput","prevMonthBtn","nextMonthBtn","todayMonthBtn",
  "periodLabelBtn","periodPickerLabel","monthPickerPanel","pickerPrevYearBtn","pickerNextYearBtn","pickerYearLabel","pickerMonthGrid",
  "logoutBtn",
  "addTransactionBtn","transactionAddBtn","recurringAddBtn","viewRecurringBtn","undoBtn","redoBtn","incomeTotal","expenseTotal","remainderTotal","aumTotal",
  "quickTransactionForm","quickClearBtn","quickDate","quickType","quickCategory","quickAccount","quickToAccount","quickAmount","quickDescription",
  "budgetProgress","budgetSort","homeUpcoming","dailyAverage","dailyBars","transactionStartDate","transactionEndDate","transactionThisMonthBtn","searchTransactions","filterType","transactionRows","budgetForm","budgetId","budgetCategory",
  "budgetLimit","budgetPeriod","budgetGroup","budgetSubmitLabel","resetBudgetForm","budgetList","budgetCount","reportPeriodLabel","reportIncome",
  "reportExpense","reportRemaining","reportNetWorth","reportCategories","reportBudgets","reportAccounts","reportUpcoming","reportForecast",
  "assetTotal","debtTotal","netWorthTotal","accountForm","accountId","accountName","accountType","accountValue","accountOwed","accountBalance",
  "accountSubmitLabel","resetAccountForm","accountSummary","accountList","registerAccountSelect","registerBalance","registerRows","reconcileForm",
  "registerStartDate","registerEndDate","registerThisMonthBtn","statementDate","statementBalance","reconcileStatus","reconcileClearedBalance",
  "reconcileOutstanding","reconcileHelp","userForm","userId","userName","userEmail","userRole","userPassword","userPasswordConfirm","userSubmitLabel","resetUserForm","userCount",
  "userList","bookForm","bookId","bookName","bookSubmitLabel","resetBookForm","bookCount","bookList",
  "passwordForm","currentPassword","newPassword","newPasswordConfirm","passwordSubmitLabel",
  "themeSelect","exportCsvBtn","settingsExportCsvBtn","csvTemplateBtn","importCsvBtn","importCsvFile","importSpreadsheetBtn","importSpreadsheetFile","exportWorkbookBtn",
  "backupZipBtn","addDemoBtn","deleteDemoBtn","recurringForm","recurringId","recurringName","recurringType","recurringAccount","recurringToAccount",
  "recurringCategory","recurringAmount","recurringCadence","recurringNextDate","recurringSubmitLabel","resetRecurringForm","postDueRecurringBtn","recurringDialog","recurringDialogTitle","closeRecurringDialog",
  "recurringList","transactionDialog","transactionForm","transactionDialogTitle","closeTransactionDialog","transactionId","txnDate","txnType",
  "txnPayee","txnAccount","txnToAccount","txnCategory","txnAmount","txnDescription","txnNotes","txnPayPeriod","txnCleared","txnSubmitLabel",
  "addSplitBtn","splitRows","splitStatus","emptyStateTemplate","toast"
].forEach((id) => { el[id] = $(id); });

let state = normalize(load());
init();

async function init() {
  document.body.dataset.theme = state.theme;
  bind();
  resetAll();
  await loadSession();
  await hydrate();
  render();
}

function bind() {
  el.logoutBtn.onclick = logout;
  $$(".period-button").forEach((b) => b.onclick = () => setPeriod(b.dataset.period));
  el.monthSelect.onchange = monthFromControls;
  el.yearInput.onchange = monthFromControls;
  el.prevMonthBtn.onclick = () => shiftMonth(-1);
  el.nextMonthBtn.onclick = () => shiftMonth(1);
  el.todayMonthBtn.onclick = () => setMonth(thisMonth);
  el.monthFilter.onchange = () => setMonth(el.monthFilter.value || thisMonth);
  el.periodLabelBtn.onclick = toggleMonthPicker;
  el.pickerPrevYearBtn.onclick = () => shiftPickerYear(-1);
  el.pickerNextYearBtn.onclick = () => shiftPickerYear(1);
  document.addEventListener("click", closeMonthPicker);
  $$(".tab").forEach((b) => b.onclick = () => showTab(b.dataset.tab));
  el.undoBtn.onclick = undoLast;
  el.redoBtn.onclick = redoLast;
  el.addTransactionBtn.onclick = () => openTxn();
  el.transactionAddBtn.onclick = () => openTxn();
  el.recurringAddBtn.onclick = () => openRecurring();
  el.viewRecurringBtn.onclick = viewRecurringList;
  el.closeTransactionDialog.onclick = () => el.transactionDialog.close();
  el.quickTransactionForm.onsubmit = saveQuickTxn;
  el.quickClearBtn.onclick = resetQuick;
  el.searchTransactions.oninput = renderTransactions;
  el.filterType.onchange = renderTransactions;
  el.transactionStartDate.onchange = () => { state.transactionStartDate = el.transactionStartDate.value || monthStart(state.currentMonth); save(); renderTransactions(); };
  el.transactionEndDate.onchange = () => { state.transactionEndDate = el.transactionEndDate.value || monthEnd(state.currentMonth); save(); renderTransactions(); };
  el.transactionThisMonthBtn.onclick = () => { state.transactionStartDate = monthStart(state.currentMonth); state.transactionEndDate = monthEnd(state.currentMonth); save(); renderTransactions(); };
  el.budgetForm.onsubmit = saveBudget;
  el.resetBudgetForm.onclick = resetBudget;
  el.budgetSort.onchange = () => { state.budgetSort = el.budgetSort.value; save(); renderBudgets(); };
  el.accountForm.onsubmit = saveAccount;
  el.resetAccountForm.onclick = resetAccount;
  el.accountType.onchange = fillOpening;
  el.accountValue.oninput = fillOpening;
  el.accountOwed.oninput = fillOpening;
  el.registerAccountSelect.onchange = () => { state.activeRegisterAccountId = el.registerAccountSelect.value; save(); renderAccounts(); renderReports(); };
  el.registerStartDate.onchange = () => { state.registerStartDate = el.registerStartDate.value || monthStart(state.currentMonth); save(); renderRegister(); };
  el.registerEndDate.onchange = () => { state.registerEndDate = el.registerEndDate.value || monthEnd(state.currentMonth); save(); renderRegister(); };
  el.registerThisMonthBtn.onclick = () => { state.registerStartDate = monthStart(state.currentMonth); state.registerEndDate = monthEnd(state.currentMonth); save(); renderRegister(); };
  el.statementDate.oninput = renderReconcileStatus;
  el.statementBalance.oninput = renderReconcileStatus;
  el.reconcileForm.onsubmit = reconcile;
  el.userForm.onsubmit = saveUser;
  el.resetUserForm.onclick = resetUser;
  el.bookForm.onsubmit = saveBook;
  el.resetBookForm.onclick = resetBook;
  el.passwordForm.onsubmit = changeOwnPassword;
  el.themeSelect.onchange = () => { record(); state.theme = el.themeSelect.value; document.body.dataset.theme = state.theme; save(); if (syncReady) syncServer(); };
  el.exportCsvBtn.onclick = exportCsv;
  el.settingsExportCsvBtn.onclick = exportCsv;
  el.csvTemplateBtn.onclick = downloadCsvTemplate;
  el.importCsvBtn.onclick = () => el.importCsvFile.click();
  el.importCsvFile.onchange = importCsv;
  el.importSpreadsheetBtn.onclick = () => el.importSpreadsheetFile.click();
  el.importSpreadsheetFile.onchange = importSpreadsheet;
  el.exportWorkbookBtn.onclick = () => postDownload("/api/export-workbook", `budget-ledger-${stamp()}.xlsx`);
  el.backupZipBtn.onclick = () => postDownload("/api/backup-zip", `budget-ledger-backup-${stamp()}.zip`);
  el.addDemoBtn.onclick = addDemo;
  el.deleteDemoBtn.onclick = deleteDemo;
  el.recurringForm.onsubmit = saveRecurring;
  el.resetRecurringForm.onclick = resetRecurring;
  el.postDueRecurringBtn.onclick = postDueRecurring;
  el.closeRecurringDialog.onclick = () => el.recurringDialog.close();
  el.transactionForm.onsubmit = saveTxn;
  el.addSplitBtn.onclick = () => addSplit();
  [el.quickType, el.txnType, el.recurringType].forEach((x) => x.onchange = renderOptions);
  el.txnAmount.oninput = splitStatus;
}

function base() {
  const uid = id(), bid = id();
  return {
    version: 4, theme: "classic", currentMonth: thisMonth, periodMode: "month",
    activeUserId: uid, activeBookId: bid, activeRegisterAccountId: "", registerStartDate: monthStart(thisMonth), registerEndDate: monthEnd(thisMonth),
    budgetSort: "warnings",
    transactionStartDate: monthStart(thisMonth), transactionEndDate: monthEnd(thisMonth),
    users: [{ id: uid, name: "Admin", email: "", role: "admin" }],
    books: [{ id: bid, name: "Admin Budget", ownerUserId: uid }],
    ledgers: { [bid]: ledger({ transactions: [], accounts: [] }) }
  };
}

function load() {
  for (const key of [KEY, "budget-ledger-state-v3", "budget-ledger-state-v1"]) {
    const parsed = json(localStorage.getItem(key));
    if (parsed) return parsed;
  }
  return base();
}

function normalize(input = {}) {
  const b = base();
  const s = { ...b, ...input };
  s.theme = themes().includes(s.theme) ? s.theme : "classic";
  s.periodMode = ["week", "month", "year"].includes(s.periodMode) ? s.periodMode : "month";
  s.users = Array.isArray(s.users) && s.users.length ? s.users.map(user) : b.users;
  s.books = Array.isArray(s.books) && s.books.length ? s.books.map((x) => book(x, s.users[0].id)) : b.books;
  s.ledgers = s.ledgers && typeof s.ledgers === "object" ? s.ledgers : b.ledgers;
  s.books.forEach((bk) => s.ledgers[bk.id] = ledger(s.ledgers[bk.id] || {}));
  if (!s.users.some((u) => u.id === s.activeUserId)) s.activeUserId = s.users[0].id;
  if (!s.books.some((bk) => bk.id === s.activeBookId)) s.activeBookId = s.books[0].id;
  s.activeRegisterAccountId ||= "";
  s.budgetSort = ["warnings", "name", "amount"].includes(s.budgetSort) ? s.budgetSort : "warnings";
  s.registerStartDate = /^\d{4}-\d{2}-\d{2}$/.test(s.registerStartDate || "") ? s.registerStartDate : monthStart(s.currentMonth || thisMonth);
  s.registerEndDate = /^\d{4}-\d{2}-\d{2}$/.test(s.registerEndDate || "") ? s.registerEndDate : monthEnd(s.currentMonth || thisMonth);
  s.transactionStartDate = /^\d{4}-\d{2}-\d{2}$/.test(s.transactionStartDate || "") ? s.transactionStartDate : monthStart(s.currentMonth || thisMonth);
  s.transactionEndDate = /^\d{4}-\d{2}-\d{2}$/.test(s.transactionEndDate || "") ? s.transactionEndDate : monthEnd(s.currentMonth || thisMonth);
  return s;
}

async function loadSession() {
  try {
    const res = await fetch("/api/session");
    if (!res.ok) return;
    const session = await res.json();
    currentLogin = { username: session.username || "local", role: session.role === "admin" ? "admin" : "user" };
  } catch {}
}

function ensureLoginIdentity() {
  const username = currentLogin.username || "local";
  let u = state.users.find((x) => x.email === username);
  if (!u) {
    u = username === "admin" && state.users.length === 1 && !state.users[0].email ? state.users[0] : null;
    if (u) {
      u.email = username;
      u.role = currentLogin.role;
    }
  }
  if (!u) {
    u = user({ name: title(username.replace(/@.*/, "").replace(/[._-]+/g, " ")) || username, email: username, role: currentLogin.role });
    state.users.push(u);
  }
  u.role = currentLogin.role;
  let b = state.books.find((book) => book.ownerUserId === u.id);
  if (!b) {
    b = book({ name: `${u.name}'s Budget`, ownerUserId: u.id }, u.id);
    state.books.push(b);
    state.ledgers[b.id] = ledger({ transactions: [], accounts: [] });
  }
  state.activeUserId = u.id;
  state.activeBookId = b.id;
}

function ledger(x = {}) {
  return {
    transactions: Array.isArray(x.transactions) ? x.transactions.map(txn) : [],
    budgets: Array.isArray(x.budgets) ? x.budgets.map(budget) : budgets(),
    accounts: Array.isArray(x.accounts) ? x.accounts.map(account) : [],
    recurring: Array.isArray(x.recurring) ? x.recurring.map(recurring) : []
  };
}

function user(x = {}) { return { id: x.id || id(), name: x.name || "User", email: x.email || "", role: x.role === "admin" ? "admin" : "user", demo: !!x.demo }; }
function book(x = {}, owner) { return { id: x.id || id(), name: x.name || "Budget Book", ownerUserId: x.ownerUserId || owner, demo: !!x.demo }; }
function txn(x = {}) { return { id: x.id || id(), date: x.date || today, type: ["expense","income","transfer"].includes(x.type) ? x.type : "expense", payee: x.payee || "", accountId: x.accountId || "", toAccountId: x.toAccountId || "", category: x.category || "Other", description: x.description || x.payee || "Transaction", amount: +x.amount || 0, cleared: !!x.cleared, reconciled: !!x.reconciled, payPeriod: x.payPeriod || "none", notes: x.notes || "", splits: Array.isArray(x.splits) ? x.splits.map(split) : [], demo: !!x.demo }; }
function split(x = {}) { return { id: x.id || id(), category: x.category || "Other", amount: +x.amount || 0, memo: x.memo || "", type: x.type || "expense" }; }
function budget(x = {}) { return { id: x.id || id(), category: x.category || "Other", monthlyLimit: +x.monthlyLimit || 0, period: ["week","month","year"].includes(x.period) ? x.period : "month", group: x.group || "expense", demo: !!x.demo }; }
function account(x = {}) { const type = x.type === "liability" ? "liability" : "asset", value = +x.value || 0, owed = +x.owed || 0, openingBalance = +(x.openingBalance ?? x.balance ?? (type === "asset" ? value - owed : owed || value)) || 0; return { id: x.id || id(), name: x.name || "Account", type, value, owed, openingBalance, balance: openingBalance, statementDate: x.statementDate || "", statementBalance: +x.statementBalance || 0, demo: !!x.demo }; }
function recurring(x = {}) { return { id: x.id || id(), name: x.name || x.description || "Recurring item", type: ["expense","income","transfer"].includes(x.type) ? x.type : "expense", accountId: x.accountId || "", toAccountId: x.toAccountId || "", category: x.category || "Other", amount: +x.amount || 0, cadence: ["weekly","biweekly","monthly","yearly"].includes(x.cadence) ? x.cadence : "monthly", nextDate: x.nextDate || today, active: x.active !== false, demo: !!x.demo }; }
function budgets() { return ["Giving","Savings","Utilities","Debt Payment","Fuel","Grocery","Entertainment","Health","Travel","Other"].map((category) => budget({ category, monthlyLimit: category === "Grocery" ? 650 : 250 })); }
function accounts() { return [account({ name: "Checking" }), account({ name: "Savings" }), account({ name: "Credit Card", type: "liability" })]; }
function starters() { return [txn({ date: today, type: "income", category: "Income", description: "Example paycheck", amount: 2500, cleared: true }), txn({ date: today, type: "expense", category: "Grocery", description: "Example grocery run", amount: 86.42, cleared: true })]; }

function L() { return state.ledgers[state.activeBookId] || ledger(); }
function currentUser() { return state.users.find((x) => x.id === state.activeUserId) || state.users[0]; }
function currentBook() { return state.books.find((x) => x.id === state.activeBookId) || state.books[0]; }
function isAdmin() { return currentLogin.role === "admin"; }
function accessible() { return state.books.filter((x) => x.ownerUserId === state.activeUserId); }
function ensureAccess() { const list = accessible(); if (!list.some((x) => x.id === state.activeBookId)) state.activeBookId = list[0]?.id || state.books[0]?.id; }
function ensureUserBook(u) {
  let b = state.books.find((book) => book.ownerUserId === u.id);
  if (!b) {
    b = book({ name: `${u.name}'s Budget`, ownerUserId: u.id }, u.id);
    state.books.push(b);
    state.ledgers[b.id] = ledger({ transactions: [], accounts: [] });
  }
  return b;
}

function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
  if (syncReady) { clearTimeout(syncTimer); syncTimer = setTimeout(syncServer, 500); }
}
async function hydrate() {
  try {
    const res = await fetch("/api/state");
    if (res.status === 401) return;
    if (!res.ok) throw 0;
    syncReady = true;
    const body = await res.json();
    if (body.state) {
      state = normalize(body.state);
      ensureLoginIdentity();
      localStorage.setItem(KEY, JSON.stringify(state));
    } else {
      state = normalize(load());
      ensureLoginIdentity();
      syncServer();
    }
  } catch { syncReady = false; }
  document.body.dataset.theme = state.theme;
  syncMonth(state.currentMonth);
  setPeriod(state.periodMode, false);
  ensureAccess();
}
async function syncServer() {
  try {
    const res = await fetch("/api/state", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(state) });
    if (!res.ok) throw 0;
  } catch { syncReady = false; note("Saved locally. Server sync unavailable."); }
}

function render() {
  ensureAccess();
  renderTop();
  renderOptions();
  renderSummary();
  renderBudgets();
  renderTransactions();
  renderReports();
  renderAccounts();
  renderSettings();
  renderRecurring();
  splitStatus();
  el.undoBtn.disabled = !undo.length;
  el.redoBtn.disabled = !redo.length;
}

function renderTop() {
  el.activeUserLabel.textContent = `${currentUser()?.name || currentLogin.username} (${currentLogin.role})`;
  el.activeBookLabel.textContent = currentBook()?.name || "Budget Book";
  el.themeSelect.value = state.theme;
}

function renderOptions() {
  const cats = L().budgets.map((x) => opt(x.category, x.category)).join("") || opt("Other", "Other");
  [el.quickCategory, el.txnCategory, el.recurringCategory, ...$$(".split-category")].forEach((s) => keep(s, cats));
  const accs = L().accounts.map((x) => opt(x.id, x.name)).join("");
  [el.quickAccount, el.txnAccount, el.recurringAccount].forEach((s) => keep(s, opt("", "No account") + accs));
  [el.quickToAccount, el.txnToAccount, el.recurringToAccount].forEach((s) => keep(s, opt("", "None") + accs));
  keep(el.registerAccountSelect, accs || opt("", "No accounts"));
  if (!state.activeRegisterAccountId || !L().accounts.some((x) => x.id === state.activeRegisterAccountId)) state.activeRegisterAccountId = L().accounts[0]?.id || "";
  el.registerAccountSelect.value = state.activeRegisterAccountId;
}
function keep(select, html) { const val = select.value; select.innerHTML = html; if ([...select.options].some((x) => x.value === val)) select.value = val; }

function renderSummary() {
  const p = periodTxns(), inc = sum(p.filter((x) => x.type === "income")), exp = sum(p.filter((x) => x.type === "expense")), nw = totals();
  el.incomeTotal.textContent = money(inc); el.expenseTotal.textContent = money(exp); el.remainderTotal.textContent = money(inc - exp); el.aumTotal.textContent = money(nw.netWorth);
  el.assetTotal.textContent = money(nw.assets); el.debtTotal.textContent = money(nw.liabilities); el.netWorthTotal.textContent = money(nw.netWorth); el.accountSummary.textContent = `${money(nw.netWorth)} net`;
  renderHomeUpcoming();
  const buckets = buildBuckets(), max = Math.max(...buckets.map((x) => x.amount), 1), spent = sum(buckets);
  el.dailyAverage.textContent = `${money(spent / Math.max(buckets.length, 1))}${state.periodMode === "year" ? "/month" : "/day"}`;
  el.dailyBars.style.gridTemplateColumns = `repeat(${buckets.length}, minmax(7px, 1fr))`;
  el.dailyBars.innerHTML = buckets.map((x) => {
    const height = Math.max(x.amount / max * 150, x.amount ? 8 : 3);
    return `<div class="bar" title="${esc(x.label)}: ${money(x.amount)}" style="height:${height}px"><span>${esc(x.shortLabel)}</span></div>`;
  }).join("");
}

function renderBudgets() {
  const spent = byCategory(periodTxns().filter((x) => x.type === "expense"));
  const list = sortedBudgets(spent);
  el.budgetCount.textContent = `${list.length} categories`;
  el.budgetSort.value = state.budgetSort;
  el.budgetProgress.innerHTML = list.map((b) => progress(b, spent[b.category] || 0)).join("") || emptyHtml();
  el.budgetList.innerHTML = list.map((b) => item(b.category, `${b.group} / ${money(b.monthlyLimit)} ${b.period}`, `<button class="row-button" onclick="editBudget('${b.id}')">Edit</button><button class="row-button danger" onclick="deleteBudget('${b.id}')">Delete</button>`)).join("") || emptyHtml();
}

function sortedBudgets(spent) {
  return L().budgets.slice().sort((a, b) => {
    const av = spent[a.category] || 0, bv = spent[b.category] || 0;
    if (state.budgetSort === "name") return a.category.localeCompare(b.category);
    if (state.budgetSort === "amount") return bv - av || b.monthlyLimit - a.monthlyLimit || a.category.localeCompare(b.category);
    const ar = limit(a) ? av / limit(a) : 0, br = limit(b) ? bv / limit(b) : 0;
    return br - ar || bv - av || a.category.localeCompare(b.category);
  });
}

function renderTransactions() {
  const q = el.searchTransactions.value.toLowerCase(), type = el.filterType.value;
  if (!state.transactionStartDate) state.transactionStartDate = monthStart(state.currentMonth);
  if (!state.transactionEndDate) state.transactionEndDate = monthEnd(state.currentMonth);
  el.transactionStartDate.value = state.transactionStartDate;
  el.transactionEndDate.value = state.transactionEndDate;
  const rows = L().transactions.filter((x) =>
    (!state.transactionStartDate || x.date >= state.transactionStartDate) &&
    (!state.transactionEndDate || x.date <= state.transactionEndDate) &&
    (type === "all" || x.type === type) &&
    `${x.date} ${x.payee} ${x.description} ${x.category}`.toLowerCase().includes(q)
  ).sort((a, b) => b.date.localeCompare(a.date));
  el.transactionRows.innerHTML = rows.map((x) => {
    const a = L().accounts.find((n) => n.id === x.accountId), b = L().accounts.find((n) => n.id === x.toAccountId);
    const acct = x.type === "transfer" ? `${a?.name || "No account"} -> ${b?.name || "No account"}` : a?.name || "No account";
    return `<tr><td>${fmt(x.date)}</td><td><strong>${esc(x.payee || x.description)}</strong><div class="item-meta">${esc(x.description)}</div></td><td>${esc(x.splits.length ? `Split (${x.splits.length})` : x.category)}</td><td>${esc(acct)}</td><td>${x.reconciled ? "Reconciled" : x.cleared ? "Cleared" : "Open"}</td><td class="numeric amount ${x.type}">${x.type === "income" ? "+" : x.type === "expense" ? "-" : ""}${money(x.amount)}</td><td><div class="actions"><button class="row-button" onclick="editTransaction('${x.id}')">Edit</button><button class="row-button danger" onclick="deleteTransaction('${x.id}')">Delete</button></div></td></tr>`;
  }).join("") || `<tr><td colspan="7">${emptyHtml("No transactions", "Add one to start tracking.")}</td></tr>`;
}

function renderReports() {
  const p = periodTxns(), inc = sum(p.filter((x) => x.type === "income")), exp = sum(p.filter((x) => x.type === "expense")), by = Object.entries(byCategory(p.filter((x) => x.type === "expense"))).sort((a, b) => b[1] - a[1]), nw = totals();
  el.reportPeriodLabel.textContent = period().label; el.reportIncome.textContent = money(inc); el.reportExpense.textContent = money(exp); el.reportRemaining.textContent = money(inc - exp); el.reportNetWorth.textContent = money(nw.netWorth);
  el.reportCategories.innerHTML = by.slice(0, 6).map(([c, v]) => bar(c, v, Math.max(...by.map((x) => x[1]), 1))).join("") || emptyHtml();
  el.reportBudgets.innerHTML = L().budgets.map((b) => progress(b, byCategory(p.filter((x) => x.type === "expense"))[b.category] || 0)).join("") || emptyHtml();
  const accountHtml = L().accounts.map((a) => item(a.name, a.type, `<div class="amount ${a.type}">${money(balance(a))}</div>`, "account-item compact")).join("") || emptyHtml();
  const up = upcoming(), cash = L().accounts.filter((a) => a.type === "asset").reduce((n, a) => n + balance(a), 0) + up.reduce((n, r) => n + (r.type === "income" ? r.amount : r.type === "expense" ? -r.amount : 0), 0);
  const upcomingHtml = up.map((r) => recurringLine(r)).join("") || emptyHtml();
  el.reportAccounts.innerHTML = accountHtml;
  el.reportForecast.textContent = `${money(cash)} forecast`;
  el.reportUpcoming.innerHTML = upcomingHtml;
}

function renderHomeUpcoming() {
  el.homeUpcoming.innerHTML = upcoming().slice(0, 5).map((r) => recurringLine(r)).join("") || emptyHtml("Nothing due soon", "Recurring bills and income due in the next 30 days will show here.");
}

function renderAccounts() {
  el.accountList.innerHTML = L().accounts.map((a) => item(a.name, `${a.type} / opening ${money(a.openingBalance)}`, `<div class="amount ${a.type}">${money(balance(a))}</div><div class="actions"><button class="row-button" onclick="showRegister('${a.id}')">Register</button><button class="row-button" onclick="editAccount('${a.id}')">Edit</button><button class="row-button danger" onclick="deleteAccount('${a.id}')">Delete</button></div>`)).join("") || emptyHtml();
  renderRegister();
}
function renderRegister() {
  renderOptions();
  const a = L().accounts.find((x) => x.id === state.activeRegisterAccountId);
  if (!a) { el.registerRows.innerHTML = `<tr><td colspan="6">${emptyHtml("No accounts", "Add an account first.")}</td></tr>`; return; }
  el.registerBalance.textContent = `${money(balance(a))} balance`;
  if (!state.registerStartDate) state.registerStartDate = monthStart(state.currentMonth);
  if (!state.registerEndDate) state.registerEndDate = monthEnd(state.currentMonth);
  el.registerStartDate.value = state.registerStartDate;
  el.registerEndDate.value = state.registerEndDate;
  if (!el.statementDate.value) el.statementDate.value = a.statementDate || today;
  if (!el.statementBalance.value && a.statementBalance) el.statementBalance.value = a.statementBalance;
  let run = +a.openingBalance || 0;
  const start = state.registerStartDate, end = state.registerEndDate;
  const rows = [{ opening: true, date: "", description: start ? `Balance before ${fmt(start)}` : "Opening balance", delta: run, running: run }];
  L().transactions.filter((x) => x.accountId === a.id || x.toAccountId === a.id).sort((x, y) => x.date.localeCompare(y.date)).forEach((x) => {
    const d = delta(x, a.id);
    if (!d) return;
    run += d;
    if ((!start || x.date >= start) && (!end || x.date <= end)) rows.push({ transaction: x, date: x.date, description: x.description, delta: d, running: run });
  });
  el.registerRows.innerHTML = rows.map((r) => r.opening
    ? `<tr><td>${r.date ? fmt(r.date) : ""}</td><td>${esc(r.description)}</td><td></td><td></td><td class="numeric amount ${r.delta >= 0 ? "income" : "expense"}">${money(r.delta)}</td><td class="numeric">${money(r.running)}</td></tr>`
    : `<tr><td>${fmt(r.date)}</td><td><strong>${esc(r.transaction.payee || r.description)}</strong><div class="item-meta">${esc(r.description)}</div></td><td><label class="inline-check"><input type="checkbox" ${r.transaction.cleared || r.transaction.reconciled ? "checked" : ""} ${r.transaction.reconciled ? "disabled" : ""} onchange="toggleCleared('${r.transaction.id}', this.checked)"><span>Seen</span></label></td><td><label class="inline-check"><input type="checkbox" ${r.transaction.reconciled ? "checked" : ""} disabled><span>Locked</span></label></td><td class="numeric amount ${r.delta >= 0 ? "income" : "expense"}">${money(r.delta)}</td><td class="numeric">${money(r.running)}</td></tr>`
  ).join("");
  renderReconcileStatus();
}

function renderSettings() {
  const admin = isAdmin();
  [el.userForm.closest(".tool-panel"), el.bookForm.closest(".tool-panel")].forEach((panel) => panel.hidden = !admin);
  [el.backupZipBtn, el.addDemoBtn, el.deleteDemoBtn].forEach((button) => button.hidden = !admin);
  el.userCount.textContent = `${state.users.length} users`;
  el.userList.innerHTML = state.users.map((u) => item(u.name, `${u.email || "No login"} / ${u.role}`, `<button class="row-button" onclick="editUser('${u.id}')">Edit</button><button class="row-button danger" onclick="deleteUser('${u.id}')">Delete</button>`, "user-item")).join("");
  el.bookCount.textContent = `${state.books.length} books`;
  el.bookList.innerHTML = state.books.map((b) => item(b.name, `Owner: ${state.users.find((u) => u.id === b.ownerUserId)?.name || "Unknown"}`, `<button class="row-button" onclick="editBook('${b.id}')">Edit</button><button class="row-button danger" onclick="deleteBook('${b.id}')">Delete</button>`, "book-item")).join("");
}
function renderRecurring() {
  el.recurringList.innerHTML = L().recurring.slice().sort((a, b) => a.nextDate.localeCompare(b.nextDate)).map((r) => item(r.name, `${r.type} / ${r.cadence} / next ${fmt(r.nextDate)}`, `<div class="amount ${r.type}">${money(r.amount)}</div><div class="actions"><button class="row-button" onclick="editRecurring('${r.id}')">Edit</button><button class="row-button danger" onclick="deleteRecurring('${r.id}')">Delete</button></div>`, "recurring-item")).join("") || emptyHtml();
}

function resetAll() { resetQuick(); resetBudget(); resetAccount(); resetUser(); resetBook(); resetRecurring(); resetTxn(); }
function resetQuick() { el.quickDate.value = today; el.quickType.value = "expense"; el.quickAmount.value = ""; el.quickDescription.value = ""; }
function resetBudget() { el.budgetId.value = ""; el.budgetCategory.value = ""; el.budgetLimit.value = ""; el.budgetPeriod.value = "month"; el.budgetGroup.value = "expense"; el.budgetSubmitLabel.textContent = "Save Budget"; }
function resetAccount() { el.accountId.value = ""; el.accountName.value = ""; el.accountType.value = "asset"; el.accountValue.value = ""; el.accountOwed.value = ""; el.accountBalance.value = ""; el.accountSubmitLabel.textContent = "Save Account"; }
function resetUser() { el.userId.value = ""; el.userName.value = ""; el.userEmail.value = ""; el.userRole.value = "user"; el.userPassword.value = ""; el.userPasswordConfirm.value = ""; el.userSubmitLabel.textContent = "Add User"; }
function resetBook() { el.bookId.value = ""; el.bookName.value = ""; el.bookSubmitLabel.textContent = "Update Book"; }
function resetRecurring() { el.recurringId.value = ""; el.recurringName.value = ""; el.recurringType.value = "expense"; el.recurringAccount.value = ""; el.recurringToAccount.value = ""; el.recurringCategory.value = L().budgets[0]?.category || "Other"; el.recurringAmount.value = ""; el.recurringCadence.value = "monthly"; el.recurringNextDate.value = today; el.recurringSubmitLabel.textContent = "Save Recurring"; }
function resetTxn() { el.transactionId.value = ""; el.txnDate.value = today; el.txnType.value = "expense"; el.txnPayee.value = ""; el.txnAccount.value = ""; el.txnToAccount.value = ""; el.txnCategory.value = L().budgets[0]?.category || "Other"; el.txnAmount.value = ""; el.txnDescription.value = ""; el.txnNotes.value = ""; el.txnPayPeriod.value = "none"; el.txnCleared.checked = false; el.splitRows.innerHTML = ""; el.txnSubmitLabel.textContent = "Save Transaction"; }

function saveQuickTxn(e) { e.preventDefault(); const t = txn({ date: el.quickDate.value, type: el.quickType.value, category: el.quickCategory.value, accountId: el.quickAccount.value, toAccountId: el.quickToAccount.value, amount: el.quickAmount.value, description: el.quickDescription.value.trim() }); if (validTxn(t)) { record(); L().transactions.push(t); save(); resetQuick(); render(); note("Transaction added."); } }
function openTxn(t = null) { resetTxn(); renderOptions(); if (t) fillTxn(t); el.transactionDialogTitle.textContent = t ? "Edit Transaction" : "Add Transaction"; el.transactionDialog.showModal(); }
function fillTxn(t) { el.transactionId.value = t.id; el.txnDate.value = t.date; el.txnType.value = t.type; el.txnPayee.value = t.payee; el.txnAccount.value = t.accountId; el.txnToAccount.value = t.toAccountId; el.txnCategory.value = t.category; el.txnAmount.value = t.amount; el.txnDescription.value = t.description; el.txnNotes.value = t.notes; el.txnPayPeriod.value = t.payPeriod; el.txnCleared.checked = t.cleared; t.splits.forEach(addSplit); el.txnSubmitLabel.textContent = "Update Transaction"; }
function saveTxn(e) { e.preventDefault(); const old = L().transactions.find((x) => x.id === el.transactionId.value); if (old?.reconciled) return note("Reconciled transactions are locked. Unreconciled history can be edited."); const t = txn({ id: el.transactionId.value || id(), date: el.txnDate.value, type: el.txnType.value, payee: el.txnPayee.value.trim(), accountId: el.txnAccount.value, toAccountId: el.txnToAccount.value, category: el.txnCategory.value, amount: el.txnAmount.value, description: el.txnDescription.value.trim(), notes: el.txnNotes.value.trim(), payPeriod: el.txnPayPeriod.value, cleared: el.txnCleared.checked, reconciled: old?.reconciled, splits: readSplits() }); if (!validTxn(t)) return; record(); upsert(L().transactions, t); save(); render(); el.transactionDialog.close(); }
function validTxn(t) {
  if (!t.description || !t.amount) return note("Add a description and amount first."), false;
  if (!t.accountId) return note("Choose the bank, card, or asset account for this transaction."), false;
  if (!L().accounts.some((a) => a.id === t.accountId)) return note("The selected account does not exist."), false;
  if (t.type === "transfer") {
    if (!t.toAccountId || t.accountId === t.toAccountId) return note("Transfers need two different accounts."), false;
    if (!L().accounts.some((a) => a.id === t.toAccountId)) return note("The destination account does not exist."), false;
  }
  if (t.splits.length) {
    const splitTotal = sum(t.splits);
    if (Math.abs(splitTotal - t.amount) > .009) return note(`Split total must equal the transaction amount. Difference: ${money(t.amount - splitTotal)}.`), false;
  }
  return true;
}
function editTransaction(id) { const t = L().transactions.find((x) => x.id === id); if (!t) return; if (t.reconciled) return note("Reconciled transactions are locked."); openTxn(t); }
function deleteTransaction(id) { const t = L().transactions.find((x) => x.id === id); if (t?.reconciled) return note("Reconciled transactions are locked."); if (confirm("Delete transaction?")) { record(); L().transactions = L().transactions.filter((x) => x.id !== id); save(); render(); } }
function addSplit(x = {}) { const row = document.createElement("div"); row.className = "split-row"; row.innerHTML = `<select class="split-category"></select><input class="split-amount" type="number" min="0" step="0.01" placeholder="Amount"><input class="split-memo" maxlength="80" placeholder="Memo"><button class="row-button danger" type="button">Remove</button>`; el.splitRows.append(row); renderOptions(); row.querySelector(".split-category").value = x.category || L().budgets[0]?.category || "Other"; row.querySelector(".split-amount").value = x.amount || ""; row.querySelector(".split-memo").value = x.memo || ""; row.querySelector(".split-amount").oninput = splitStatus; row.querySelector("button").onclick = () => { row.remove(); splitStatus(); }; }
function readSplits() { return $$(".split-row").map((r) => split({ category: r.querySelector(".split-category").value, amount: r.querySelector(".split-amount").value, memo: r.querySelector(".split-memo").value })).filter((x) => x.amount > 0); }
function splitStatus() { const total = sum(readSplits()), amount = +el.txnAmount.value || 0; el.splitStatus.textContent = total ? `Split total ${money(total)} / Remaining ${money(amount - total)}` : "No splits"; el.splitStatus.classList.toggle("is-error", total && Math.abs(amount - total) > .009); }

function saveBudget(e) { e.preventDefault(); const b = budget({ id: el.budgetId.value || id(), category: title(el.budgetCategory.value), monthlyLimit: el.budgetLimit.value, period: el.budgetPeriod.value, group: el.budgetGroup.value }); record(); upsert(L().budgets, b); save(); resetBudget(); render(); }
function editBudget(id) { const b = L().budgets.find((x) => x.id === id); if (!b) return; el.budgetId.value = b.id; el.budgetCategory.value = b.category; el.budgetLimit.value = b.monthlyLimit; el.budgetPeriod.value = b.period; el.budgetGroup.value = b.group; el.budgetSubmitLabel.textContent = "Update Budget"; }
function deleteBudget(id) {
  const b = L().budgets.find((x) => x.id === id);
  if (!b) return;
  const txns = L().transactions.filter((x) => x.category === b.category || x.splits.some((s) => s.category === b.category));
  const rec = L().recurring.filter((x) => x.category === b.category);
  const refs = txns.length + rec.length;
  if (refs && !confirm(`"${b.category}" is used by ${refs} transaction or recurring row(s). Delete this budget target AND all those dependent rows? This cannot be undone with import/export backup unless you exported first.`)) return;
  if (!refs && !confirm("Delete budget?")) return;
  record();
  L().budgets = L().budgets.filter((x) => x.id !== id);
  if (refs) {
    L().transactions = L().transactions.filter((x) => x.category !== b.category && !x.splits.some((s) => s.category === b.category));
    L().recurring = L().recurring.filter((x) => x.category !== b.category);
  }
  save();
  render();
}
function saveAccount(e) { e.preventDefault(); const a = account({ id: el.accountId.value || id(), name: el.accountName.value.trim(), type: el.accountType.value, value: el.accountValue.value, owed: el.accountOwed.value, openingBalance: el.accountBalance.value }); record(); upsert(L().accounts, a); save(); resetAccount(); render(); }
function editAccount(id) { const a = L().accounts.find((x) => x.id === id); if (!a) return; el.accountId.value = a.id; el.accountName.value = a.name; el.accountType.value = a.type; el.accountValue.value = a.value || ""; el.accountOwed.value = a.owed || ""; el.accountBalance.value = a.openingBalance; el.accountSubmitLabel.textContent = "Update Account"; }
function deleteAccount(id) {
  const a = L().accounts.find((x) => x.id === id);
  if (!a) return;
  const txns = L().transactions.filter((x) => x.accountId === id || x.toAccountId === id);
  const rec = L().recurring.filter((x) => x.accountId === id || x.toAccountId === id);
  const refs = txns.length + rec.length;
  if (refs && !confirm(`"${a.name}" is used by ${refs} transaction or recurring row(s). Delete the account AND all those dependent rows? Use Backup App Folder first if you may need this history.`)) return;
  if (!refs && !confirm("Delete account?")) return;
  record();
  L().accounts = L().accounts.filter((x) => x.id !== id);
  if (refs) {
    L().transactions = L().transactions.filter((x) => x.accountId !== id && x.toAccountId !== id);
    L().recurring = L().recurring.filter((x) => x.accountId !== id && x.toAccountId !== id);
  }
  if (state.activeRegisterAccountId === id) state.activeRegisterAccountId = L().accounts[0]?.id || "";
  save();
  render();
}
function showRegister(id) { state.activeRegisterAccountId = id; save(); showTab("accounts"); renderAccounts(); }
function fillOpening() { if (!el.accountValue.value && !el.accountOwed.value) return; el.accountBalance.value = el.accountType.value === "asset" ? (+el.accountValue.value || 0) - (+el.accountOwed.value || 0) : (+el.accountOwed.value || +el.accountValue.value || 0); }
function accountTxns(a) { return L().transactions.filter((x) => x.accountId === a.id || x.toAccountId === a.id); }
function reconcileMath(a) {
  const date = el.statementDate.value || today;
  const statement = +el.statementBalance.value || 0;
  const cleared = (+a.openingBalance || 0) + accountTxns(a).filter((x) => x.date <= date && (x.cleared || x.reconciled)).reduce((n, x) => n + delta(x, a.id), 0);
  const outstanding = accountTxns(a).filter((x) => x.date <= date && !x.cleared && !x.reconciled).reduce((n, x) => n + delta(x, a.id), 0);
  return { date, statement, cleared, outstanding, difference: statement - cleared };
}
function renderReconcileStatus() {
  const a = L().accounts.find((x) => x.id === state.activeRegisterAccountId);
  if (!a) return;
  const m = reconcileMath(a);
  el.reconcileClearedBalance.textContent = money(m.cleared);
  el.reconcileOutstanding.textContent = money(m.outstanding);
  el.reconcileStatus.textContent = `${money(m.difference)} difference`;
  el.reconcileStatus.classList.toggle("is-good", Math.abs(m.difference) < .01);
  el.reconcileStatus.classList.toggle("is-alert", Math.abs(m.difference) >= .01);
}
function toggleCleared(id, checked) {
  const t = L().transactions.find((x) => x.id === id);
  if (!t || t.reconciled) return;
  record();
  t.cleared = checked;
  save();
  renderRegister();
  renderTransactions();
}
function reconcile(e) {
  e.preventDefault();
  const a = L().accounts.find((x) => x.id === state.activeRegisterAccountId);
  if (!a) return;
  const m = reconcileMath(a);
  if (Math.abs(m.difference) >= .01) return note("Difference must be $0.00 before reconciling.");
  record();
  a.statementDate = m.date;
  a.statementBalance = m.statement;
  accountTxns(a).forEach((t) => { if (t.date <= a.statementDate && (t.cleared || t.reconciled)) t.reconciled = true; });
  save();
  render();
  note("Cleared transactions reconciled.");
}

async function saveUser(e) {
  e.preventDefault();
  const old = state.users.find((x) => x.id === el.userId.value);
  const password = el.userPassword.value;
  const confirm = el.userPasswordConfirm.value;
  const u = user({ id: el.userId.value || id(), name: el.userName.value.trim(), email: el.userEmail.value.trim(), role: el.userRole.value });
  if (!u.name || !u.email) return note("Add a name and login username.");
  if (!old && !password) return note("Add a password for the new login.");
  if (password && password.length < 8) return note("Use at least 8 characters for passwords.");
  if (password !== confirm) return note("Passwords do not match.");
  if (old?.role === "admin" && u.role !== "admin" && state.users.filter((x) => x.role === "admin").length < 2) return note("Keep at least one admin.");
  const authSaved = await saveAuthUser(old?.email || u.email, u.email, password, u.role);
  if (!authSaved) return;
  record();
  if (!el.userId.value) { state.users.push(u); ensureUserBook(u); }
  else { upsert(state.users, u); ensureUserBook(u); }
  save();
  resetUser();
  render();
  note("User saved.");
}
function editUser(id) { const u = state.users.find((x) => x.id === id); if (!u) return; el.userId.value = u.id; el.userName.value = u.name; el.userEmail.value = u.email; el.userRole.value = u.role; el.userPassword.value = ""; el.userPasswordConfirm.value = ""; el.userSubmitLabel.textContent = "Update User"; showTab("settings"); }
async function saveAuthUser(previousUsername, username, password, role) {
  try {
    const res = await fetch("/api/auth/users", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ previousUsername, username, password, role }) });
    if (res.ok) return true;
    const body = await res.json().catch(() => ({}));
    note(body.message || "Login user could not be saved.");
    return false;
  } catch { note("Login user could not be saved."); return false; }
}
async function deleteAuthUser(username) {
  if (!username) return true;
  try {
    const res = await fetch("/api/auth/users", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username }) });
    return res.ok;
  } catch { return false; }
}
async function deleteUser(id) { if (state.users.length < 2) return note("Keep at least one user."); const removed = state.users.find((u) => u.id === id); if (removed?.role === "admin" && state.users.filter((x) => x.role === "admin").length < 2) return note("Keep at least one admin."); if (confirm("Delete user and owned book?")) { const authDeleted = await deleteAuthUser(removed?.email); if (!authDeleted) return note("Login user could not be deleted."); record(); const owned = state.books.filter((b) => b.ownerUserId === id).map((b) => b.id); state.users = state.users.filter((u) => u.id !== id); state.books = state.books.filter((b) => b.ownerUserId !== id); owned.forEach((x) => delete state.ledgers[x]); state.activeUserId = state.users[0].id; ensureAccess(); save(); render(); } }
function saveBook(e) { e.preventDefault(); const existing = state.books.find((x) => x.id === el.bookId.value); if (!existing) return note("Choose a book to edit first."); const name = el.bookName.value.trim(); if (!name) return; record(); existing.name = name; save(); resetBook(); render(); }
function editBook(id) { const b = state.books.find((x) => x.id === id); if (!b) return; el.bookId.value = b.id; el.bookName.value = b.name; el.bookSubmitLabel.textContent = "Update Book"; showTab("settings"); }
function deleteBook(id) { if (state.books.length < 2) return note("Keep at least one book."); if (confirm("Delete book?")) { record(); state.books = state.books.filter((b) => b.id !== id); delete state.ledgers[id]; ensureAccess(); save(); render(); } }
async function changeOwnPassword(e) {
  e.preventDefault();
  const currentPassword = el.currentPassword.value;
  const newPassword = el.newPassword.value;
  const confirm = el.newPasswordConfirm.value;
  if (!currentPassword || !newPassword) return note("Enter your current and new password.");
  if (newPassword.length < 8) return note("Use at least 8 characters for passwords.");
  if (newPassword !== confirm) return note("New passwords do not match.");
  try {
    const res = await fetch("/api/auth/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return note(body.message || "Password could not be changed.");
    el.currentPassword.value = "";
    el.newPassword.value = "";
    el.newPasswordConfirm.value = "";
    note("Password changed.");
  } catch {
    note("Password could not be changed.");
  }
}
function openRecurring(r = null) { resetRecurring(); renderOptions(); if (r) { el.recurringId.value = r.id; el.recurringName.value = r.name; el.recurringType.value = r.type; el.recurringAccount.value = r.accountId; el.recurringToAccount.value = r.toAccountId; el.recurringCategory.value = r.category; el.recurringAmount.value = r.amount; el.recurringCadence.value = r.cadence; el.recurringNextDate.value = r.nextDate; el.recurringSubmitLabel.textContent = "Update Recurring"; el.recurringDialogTitle.textContent = "Edit Recurring Transaction"; } else { el.recurringDialogTitle.textContent = "Add Recurring Transaction"; } el.recurringDialog.showModal(); }
function viewRecurringList() { showTab("transactions"); el.recurringList.scrollIntoView({ behavior: "smooth", block: "start" }); }
function saveRecurring(e) { e.preventDefault(); const r = recurring({ id: el.recurringId.value || id(), name: el.recurringName.value.trim(), type: el.recurringType.value, accountId: el.recurringAccount.value, toAccountId: el.recurringToAccount.value, category: el.recurringCategory.value, amount: el.recurringAmount.value, cadence: el.recurringCadence.value, nextDate: el.recurringNextDate.value }); if (!r.name || !r.amount) return note("Add a name and amount."); if (!r.accountId) return note("Choose the account for this recurring item."); if (r.type === "transfer" && (!r.toAccountId || r.accountId === r.toAccountId)) return note("Recurring transfers need two different accounts."); record(); upsert(L().recurring, r); save(); resetRecurring(); el.recurringDialog.close(); render(); viewRecurringList(); }
function editRecurring(id) { const r = L().recurring.find((x) => x.id === id); if (!r) return; showTab("transactions"); openRecurring(r); }
function deleteRecurring(id) { if (confirm("Delete recurring item?")) { record(); L().recurring = L().recurring.filter((x) => x.id !== id); save(); render(); } }
function postDueRecurring() { const due = L().recurring.filter((r) => r.active && r.nextDate <= today); if (!due.length) return note("No recurring items are due."); record(); due.forEach((r) => { L().transactions.push(txn({ date: r.nextDate, type: r.type, payee: r.name, accountId: r.accountId, toAccountId: r.toAccountId, category: r.category, description: r.name, amount: r.amount, notes: `Posted from recurring ${r.cadence} item.` })); r.nextDate = nextDate(r.nextDate, r.cadence); }); save(); render(); }

function addDemo() {
  record();
  state.books.forEach((book) => seedLedgerDemo(state.ledgers[book.id] = ledger(state.ledgers[book.id] || {})));
  save();
  render();
  note("Six months of demo activity added to every ledger.");
}
function seedLedgerDemo(bookLedger) {
  ["transactions","accounts","budgets","recurring"].forEach((k) => bookLedger[k] = bookLedger[k].filter((x) => !x.demo));
  const checking = account({ name: "Demo Checking", openingBalance: 1850, demo: true });
  const savings = account({ name: "Demo Emergency Fund", openingBalance: 4200, demo: true });
  const card = account({ name: "Demo Rewards Card", type: "liability", openingBalance: 320, demo: true });
  bookLedger.accounts.push(checking, savings, card);
  const budgetRows = [
    ["Housing", 1650], ["Grocery", 720], ["Utilities", 310], ["Fuel", 240], ["Insurance", 190],
    ["Dining", 260], ["Health", 160], ["Entertainment", 180], ["Savings", 500], ["Debt Payment", 350],
  ];
  budgetRows.forEach(([category, monthlyLimit]) => upsert(bookLedger.budgets, budget({ category, monthlyLimit, demo: true })));
  const start = new Date(`${thisMonth}-01T12:00:00`);
  start.setMonth(start.getMonth() - 5);
  for (let i = 0; i < 6; i++) {
    const y = start.getFullYear(), m = start.getMonth() + i;
    const d = (day) => dateInput(new Date(y, m, day, 12));
    bookLedger.transactions.push(
      txn({ date: d(1), type: "income", accountId: checking.id, category: "Income", payee: "TechSavvy Payroll", description: "Paycheck", amount: 2850, cleared: true, demo: true }),
      txn({ date: d(15), type: "income", accountId: checking.id, category: "Income", payee: "TechSavvy Payroll", description: "Paycheck", amount: 2850, cleared: true, demo: true }),
      txn({ date: d(2), type: "expense", accountId: checking.id, category: "Housing", payee: "Oak Street Rentals", description: "Rent", amount: 1625, cleared: true, demo: true }),
      txn({ date: d(4), type: "expense", accountId: checking.id, category: "Utilities", payee: "City Utilities", description: "Electric and water", amount: 188 + i * 4, cleared: true, demo: true }),
      txn({ date: d(6), type: "expense", accountId: card.id, category: "Grocery", payee: "Neighborhood Market", description: "Weekly groceries", amount: 154 + i * 3, cleared: true, demo: true }),
      txn({ date: d(9), type: "expense", accountId: card.id, category: "Fuel", payee: "Fuel Stop", description: "Gas", amount: 54 + i, cleared: true, demo: true }),
      txn({ date: d(12), type: "expense", accountId: checking.id, category: "Insurance", payee: "Family Insurance", description: "Auto insurance", amount: 183, cleared: true, demo: true }),
      txn({ date: d(18), type: "expense", accountId: card.id, category: "Dining", payee: "Local Cafe", description: "Dining out", amount: 72 + i * 2, cleared: true, demo: true }),
      txn({ date: d(20), type: "expense", accountId: checking.id, category: "Debt Payment", payee: "Card Payment", description: "Credit card payment", amount: 350, cleared: true, demo: true }),
      txn({ date: d(22), type: "transfer", accountId: checking.id, toAccountId: savings.id, category: "Savings", payee: "Emergency Fund", description: "Monthly savings transfer", amount: 500, cleared: true, demo: true }),
      txn({ date: d(25), type: "expense", accountId: card.id, category: "Entertainment", payee: "Streaming Bundle", description: "Subscriptions", amount: 48, cleared: true, demo: true }),
      txn({ date: d(27), type: "expense", accountId: checking.id, category: "Health", payee: "Pharmacy", description: "Prescriptions", amount: 42 + i, cleared: true, demo: true }),
    );
  }
  bookLedger.recurring.push(
    recurring({ name: "Rent", type: "expense", accountId: checking.id, category: "Housing", amount: 1625, cadence: "monthly", nextDate: today, demo: true }),
    recurring({ name: "Paycheck", type: "income", accountId: checking.id, category: "Income", amount: 2850, cadence: "biweekly", nextDate: today, demo: true }),
    recurring({ name: "Savings Transfer", type: "transfer", accountId: checking.id, toAccountId: savings.id, category: "Savings", amount: 500, cadence: "monthly", nextDate: today, demo: true }),
  );
}
function deleteDemo() {
  if (!confirm("Delete demo and starter data? Personal users, books, and real ledger entries will be kept.")) return;
  record();
  state.users = state.users.filter((x) => !x.demo);
  state.books = state.books.filter((x) => !x.demo);
  Object.keys(state.ledgers).forEach((bookId) => {
    if (!state.books.some((b) => b.id === bookId)) {
      delete state.ledgers[bookId];
      return;
    }
    const l = state.ledgers[bookId] = ledger(state.ledgers[bookId] || {});
    ["transactions","accounts","budgets","recurring"].forEach((key) => l[key] = l[key].filter((x) => !x.demo));
    removeStarterSeed(l);
  });
  ensureAccess();
  save();
  render();
  note("Demo data removed.");
}
function removeStarterSeed(bookLedger) {
  const starterDescriptions = new Set(["Example paycheck", "Example grocery run"]);
  const starterAccountNames = new Set(["checking", "savings", "credit card"]);
  const hadStarterRows = bookLedger.transactions.some((t) => starterDescriptions.has(t.description));
  bookLedger.transactions = bookLedger.transactions.filter((t) => !starterDescriptions.has(t.description));
  if (!hadStarterRows) return;
  const used = new Set(bookLedger.transactions.flatMap((t) => [t.accountId, t.toAccountId]).filter(Boolean));
  bookLedger.accounts = bookLedger.accounts.filter((a) => {
    const starterAccount = starterAccountNames.has(a.name.toLowerCase()) && !a.demo && (+a.openingBalance || 0) === 0 && !used.has(a.id);
    return !starterAccount;
  });
}

function balance(a) { return (+a.openingBalance || 0) + L().transactions.reduce((n, t) => n + delta(t, a.id), 0); }
function delta(t, aid) { const a = L().accounts.find((x) => x.id === aid), amt = +t.amount || 0; if (!a) return 0; if (t.type === "income" && t.accountId === aid) return a.type === "liability" ? -amt : amt; if (t.type === "expense" && t.accountId === aid) return a.type === "liability" ? amt : -amt; if (t.type === "transfer" && t.accountId === aid) return a.type === "liability" ? amt : -amt; if (t.type === "transfer" && t.toAccountId === aid) return a.type === "liability" ? -amt : amt; return 0; }
function totals() { const assets = L().accounts.filter((a) => a.type === "asset").reduce((n, a) => n + balance(a), 0), liabilities = L().accounts.filter((a) => a.type === "liability").reduce((n, a) => n + balance(a), 0); return { assets, liabilities, netWorth: assets - liabilities }; }
function period() { const [y, m] = (state.currentMonth || thisMonth).split("-").map(Number), mode = state.periodMode; if (mode === "year") return { start: `${y}-01-01`, end: `${y}-12-31`, label: `${y}` }; if (mode === "week") { const d = new Date(y, m - 1, state.currentMonth === thisMonth ? +today.slice(-2) : 1, 12), s = new Date(d); s.setDate(d.getDate() - d.getDay()); const e = new Date(s); e.setDate(s.getDate() + 6); return { start: dateInput(s), end: dateInput(e), label: `${fmt(dateInput(s))} - ${fmt(dateInput(e))}` }; } const end = new Date(y, m, 0).getDate(); return { start: `${state.currentMonth}-01`, end: `${state.currentMonth}-${String(end).padStart(2, "0")}`, label: new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" }) }; }
function periodTxns() { const p = period(); return L().transactions.filter((t) => t.date >= p.start && t.date <= p.end); }
function buildBuckets() { const p = period(); if (state.periodMode === "year") return Array.from({ length: 12 }, (_, i) => { const mm = `${p.start.slice(0,4)}-${String(i + 1).padStart(2, "0")}`, label = new Date(+p.start.slice(0,4), i, 1).toLocaleDateString("en-US", { month: "short" }); return { start: `${mm}-01`, end: `${mm}-31`, label, shortLabel: label, amount: sum(L().transactions.filter((t) => t.type === "expense" && t.date.startsWith(mm))) }; }); const out = []; for (let d = new Date(`${p.start}T12:00:00`), e = new Date(`${p.end}T12:00:00`); d <= e; d.setDate(d.getDate() + 1)) { const day = dateInput(d); out.push({ start: day, end: day, label: fmt(day), shortLabel: String(d.getDate()), amount: sum(periodTxns().filter((t) => t.type === "expense" && t.date === day)) }); } return out; }
function byCategory(list) { return list.reduce((g, t) => { (t.splits.length ? t.splits : [t]).forEach((x) => g[x.category] = (g[x.category] || 0) + (+x.amount || 0)); return g; }, {}); }
function limit(b) { const y = b.period === "year" ? b.monthlyLimit : b.period === "week" ? b.monthlyLimit * 52 : b.monthlyLimit * 12; return state.periodMode === "year" ? y : state.periodMode === "week" ? y / 52 : y / 12; }
function upcoming() { const end = new Date(`${today}T12:00:00`); end.setDate(end.getDate() + 30); const e = dateInput(end); return L().recurring.filter((r) => r.active && r.nextDate <= e).sort((a, b) => a.nextDate.localeCompare(b.nextDate)); }
function nextDate(value, cadence) { const d = new Date(`${value}T12:00:00`); if (cadence === "weekly") d.setDate(d.getDate() + 7); else if (cadence === "biweekly") d.setDate(d.getDate() + 14); else if (cadence === "yearly") d.setFullYear(d.getFullYear() + 1); else d.setMonth(d.getMonth() + 1); return dateInput(d); }

const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
let pickerYear = Number(thisMonth.slice(0, 4));
function syncMonth(value) {
  const v = /^\d{4}-\d{2}$/.test(value) ? value : thisMonth, [y, m] = v.split("-").map(Number);
  state.currentMonth = v;
  pickerYear = y;
  el.monthFilter.value = v;
  el.monthSelect.value = String(m - 1);
  el.yearInput.value = String(y);
  if (el.periodPickerLabel) el.periodPickerLabel.textContent = `${monthNames[m - 1]} ${y}`;
  renderMonthPicker();
}
function monthFromControls() { setMonth(`${Math.min(2200, Math.max(1900, +el.yearInput.value || +thisMonth.slice(0,4)))}-${String(+el.monthSelect.value + 1).padStart(2, "0")}`); }
function setMonth(v) { syncMonth(v); save(); render(); }
function shiftMonth(n) { const [y, m] = state.currentMonth.split("-").map(Number); setMonth(dateInput(new Date(y, m - 1 + n, 1, 12)).slice(0, 7)); }
function toggleMonthPicker(event) {
  event.stopPropagation();
  const open = el.monthPickerPanel.hidden;
  el.monthPickerPanel.hidden = !open;
  el.periodLabelBtn.setAttribute("aria-expanded", String(open));
  renderMonthPicker();
}
function closeMonthPicker(event) {
  if (!el.monthPickerPanel || el.monthPickerPanel.hidden) return;
  if (event.target.closest(".graphical-month-picker")) return;
  el.monthPickerPanel.hidden = true;
  el.periodLabelBtn.setAttribute("aria-expanded", "false");
}
function shiftPickerYear(delta) {
  pickerYear = Math.min(2200, Math.max(1900, pickerYear + delta));
  renderMonthPicker();
}
function renderMonthPicker() {
  if (!el.pickerMonthGrid) return;
  el.pickerYearLabel.textContent = String(pickerYear);
  const active = state.currentMonth;
  el.pickerMonthGrid.innerHTML = monthNames.map((name, index) => {
    const value = `${pickerYear}-${String(index + 1).padStart(2, "0")}`;
    return `<button class="month-cell ${value === active ? "is-active" : ""}" type="button" data-month="${value}">${name.slice(0, 3)}</button>`;
  }).join("");
  el.pickerMonthGrid.querySelectorAll("[data-month]").forEach((button) => {
    button.onclick = () => {
      el.monthPickerPanel.hidden = true;
      el.periodLabelBtn.setAttribute("aria-expanded", "false");
      setMonth(button.dataset.month);
    };
  });
}
function setPeriod(p, draw = true) { state.periodMode = ["week","month","year"].includes(p) ? p : "month"; $$(".period-button").forEach((b) => b.classList.toggle("is-active", b.dataset.period === state.periodMode)); save(); if (draw) render(); }
function showTab(name) { $$(".tab").forEach((b) => b.classList.toggle("is-active", b.dataset.tab === name)); $$(".view").forEach((v) => v.classList.toggle("is-active", v.id === name)); }
async function logout() { try { await fetch("/api/logout", { method: "POST" }); } catch {} localStorage.removeItem(KEY); localStorage.removeItem("budget-ledger-state-v3"); localStorage.removeItem("budget-ledger-state-v1"); window.location.assign("/login"); }
function record() { undo.push(JSON.stringify(state)); if (undo.length > 5) undo.shift(); redo = []; }
function restore(s) { state = normalize(JSON.parse(s)); syncMonth(state.currentMonth); document.body.dataset.theme = state.theme; save(); render(); }
function undoLast() { if (undo.length) { redo.push(JSON.stringify(state)); restore(undo.pop()); } }
function redoLast() { if (redo.length) { undo.push(JSON.stringify(state)); restore(redo.pop()); } }
function exportState() {
  if (isAdmin()) return state;
  const user = currentUser(), book = currentBook();
  return {
    version: state.version,
    theme: state.theme,
    currentMonth: state.currentMonth,
    periodMode: state.periodMode,
    activeUserId: user.id,
    activeBookId: book.id,
    activeRegisterAccountId: state.activeRegisterAccountId,
    registerStartDate: state.registerStartDate,
    registerEndDate: state.registerEndDate,
    transactionStartDate: state.transactionStartDate,
    transactionEndDate: state.transactionEndDate,
    users: [user],
    books: [book],
    ledgers: { [book.id]: L() },
  };
}
function exportJson() { download(new Blob([JSON.stringify(exportState(), null, 2)], { type: "application/json" }), `budget-ledger-backup-${stamp()}.json`); }
function csvHeaders() { return ["section","id","date","type","payee","description","account","toAccount","category","amount","cleared","reconciled","notes","payPeriod","splitsJson","name","accountType","openingBalance","value","owed","statementDate","statementBalance","monthlyLimit","period","group","cadence","nextDate","active"]; }
function csvRows(includeExamples = false) {
  const accountName = (id) => L().accounts.find((a) => a.id === id)?.name || "";
  const rows = [csvHeaders()];
  if (includeExamples) {
    rows.push(["account","","","","","","","","","","","","","","","Checking","asset","1000","1000","0","","","","","","","",""]);
    rows.push(["budget","","","","","","","","Grocery","","","","","","","Grocery","","","","","","","650","month","expense","","",""]);
    rows.push(["recurring","","","expense","","Rent","Checking","","Housing","1625","","","","","","Rent","","","","","","","","","","monthly","2026-07-01","true"]);
    rows.push(["transaction","","2026-07-01","expense","Grocery Store","Weekly groceries","Checking","","Grocery","125.50","yes","no","Example row","none","[]","","","","","","","","","","","","",""]);
    return rows;
  }
  L().accounts.forEach((a) => rows.push(["account",a.id,"","","","","","","","","","","","","",a.name,a.type,a.openingBalance,a.value,a.owed,a.statementDate,a.statementBalance,"","","","","",""]));
  L().budgets.forEach((b) => rows.push(["budget",b.id,"","","","","","",b.category,"","","","","","",b.category,"","","","","","",b.monthlyLimit,b.period,b.group,"","",""]));
  L().recurring.forEach((r) => rows.push(["recurring",r.id,"",r.type,"",r.name,accountName(r.accountId),accountName(r.toAccountId),r.category,r.amount,"","","","","",r.name,"","","","","","","","", "",r.cadence,r.nextDate,r.active]));
  L().transactions.forEach((t) => rows.push(["transaction",t.id,t.date,t.type,t.payee,t.description,accountName(t.accountId),accountName(t.toAccountId),t.category,t.amount,t.cleared,t.reconciled,t.notes,t.payPeriod,JSON.stringify(t.splits || []),"","","","","","","","","","","","",""]));
  return rows;
}
function exportCsv() { download(new Blob([csvRows().map((r) => r.map(csv).join(",")).join("\n")], { type: "text/csv" }), `budget-ledger-${stamp()}.csv`); }
function downloadCsvTemplate() { download(new Blob([csvRows(true).map((r) => r.map(csv).join(",")).join("\n")], { type: "text/csv" }), "budget-ledger-import-template.csv"); }
async function importJson(e) {
  const f = e.target.files?.[0];
  e.target.value = "";
  if (!f) return;
  try {
    const imported = JSON.parse(await f.text());
    if (!confirm(isAdmin() ? "Replace current ledger data with this JSON backup?" : "Replace your current book data with this JSON backup?")) return;
    record();
    if (isAdmin()) state = normalize(stateFromImport(imported));
    else state.ledgers[state.activeBookId] = ledger(firstImportLedger(imported));
    ensureLoginIdentity();
    save();
    render();
    note("JSON import complete.");
  } catch { note("Could not import JSON."); }
}
async function importCsv(e) {
  const f = e.target.files?.[0];
  e.target.value = "";
  if (!f) return;
  const rows = parseCsv(await f.text());
  if (rows.length < 2) return;
  const head = rows[0].map((x) => String(x || "").replace(/^\uFEFF/, "").trim().toLowerCase());
  const get = (r, k) => {
    const i = head.indexOf(k.toLowerCase());
    return i >= 0 ? r[i] || "" : "";
  };
  const has = (r, k) => {
    const i = head.indexOf(k.toLowerCase());
    return i >= 0 && r[i] !== undefined && String(r[i]).trim() !== "";
  };
  if (!confirm("Import this CSV into the current book? It can add accounts, budgets, recurring items, and transactions.")) return;
  record();
  const counts = { accounts: 0, budgets: 0, recurring: 0, transactions: 0 };
  const txnSig = (t) => [t.date,t.type,t.payee,t.description,t.accountId,t.toAccountId,t.category,+t.amount || 0,t.notes].map((x) => String(x ?? "").trim().toLowerCase()).join("|");
  const recSig = (r) => [r.name,r.type,r.accountId,r.toAccountId,r.category,+r.amount || 0,r.cadence,r.nextDate].map((x) => String(x ?? "").trim().toLowerCase()).join("|");
  const existingTxnSigs = new Set(L().transactions.map(txnSig));
  const existingRecSigs = new Set(L().recurring.map(recSig));
  rows.slice(1).forEach((r) => {
    const section = String(get(r, "section") || (get(r, "date") && get(r, "amount") ? "transaction" : "")).trim().toLowerCase();
    if (section === "account") {
      const name = get(r, "name") || get(r, "account");
      if (!name) return;
      const rowId = get(r, "id");
      let existing = L().accounts.find((a) => a.id === rowId) || L().accounts.find((a) => a.name.toLowerCase() === name.toLowerCase());
      const input = { ...existing, id: existing?.id || rowId || undefined, name };
      if (has(r, "accounttype") || has(r, "type")) input.type = get(r, "accounttype") || get(r, "type");
      if (has(r, "openingbalance") || has(r, "amount")) input.openingBalance = get(r, "openingbalance") || get(r, "amount");
      if (has(r, "value")) input.value = get(r, "value");
      if (has(r, "owed")) input.owed = get(r, "owed");
      if (has(r, "statementdate")) input.statementDate = get(r, "statementdate");
      if (has(r, "statementbalance")) input.statementBalance = get(r, "statementbalance");
      const next = account(input);
      existing ? Object.assign(existing, next, { id: existing.id }) : L().accounts.push(next);
      counts.accounts++;
      return;
    }
    if (section === "budget") {
      const category = get(r, "category") || get(r, "name");
      if (!category) return;
      const rowId = get(r, "id");
      let existing = L().budgets.find((b) => b.id === rowId) || L().budgets.find((b) => b.category.toLowerCase() === category.toLowerCase());
      const input = { ...existing, id: existing?.id || rowId || undefined, category };
      if (has(r, "monthlylimit") || has(r, "amount")) input.monthlyLimit = get(r, "monthlylimit") || get(r, "amount");
      if (has(r, "period")) input.period = get(r, "period");
      if (has(r, "group")) input.group = get(r, "group");
      const next = budget(input);
      existing ? Object.assign(existing, next, { id: existing.id }) : L().budgets.push(next);
      counts.budgets++;
      return;
    }
    if (section === "recurring") {
      const accountId = accountIdFromName(get(r, "account"));
      const rowId = get(r, "id");
      const row = recurring({
        id: rowId || undefined,
        name: get(r, "name") || get(r, "description"),
        type: get(r, "type"),
        accountId,
        toAccountId: accountIdFromName(get(r, "toaccount")),
        category: get(r, "category"),
        amount: get(r, "amount"),
        cadence: get(r, "cadence"),
        nextDate: get(r, "nextdate") || get(r, "date"),
        active: has(r, "active") ? bool(get(r, "active")) : true,
      });
      const existing = L().recurring.find((x) => x.id === row.id);
      const sig = recSig(row);
      if (row.name && row.accountId && row.amount && (existing || !existingRecSigs.has(sig))) {
        existing ? Object.assign(existing, row, { id: existing.id }) : L().recurring.push(row);
        existingRecSigs.add(sig);
        counts.recurring++;
      }
      return;
    }
    if (section === "transaction" || !section) {
      const accountId = accountIdFromName(get(r, "account"));
      const rowId = get(r, "id");
      const row = txn({
        id: rowId || undefined,
        date: get(r,"date"),
        type: get(r,"type"),
        payee: get(r,"payee"),
        description: get(r,"description"),
        accountId,
        toAccountId: accountIdFromName(get(r,"toaccount")),
        category: get(r,"category"),
        amount: get(r,"amount"),
        cleared: bool(get(r,"cleared")),
        reconciled: bool(get(r,"reconciled")),
        notes: get(r,"notes"),
        payPeriod: get(r,"payperiod") || "none",
        splits: json(get(r,"splitsjson")) || [],
      });
      const existing = L().transactions.find((x) => x.id === row.id);
      const sig = txnSig(row);
      if (row.accountId && row.amount && (existing || !existingTxnSigs.has(sig))) {
        existing ? Object.assign(existing, row, { id: existing.id }) : L().transactions.push(row);
        existingTxnSigs.add(sig);
        counts.transactions++;
      }
    }
  });
  save();
  render();
  note(`CSV import complete: ${counts.accounts} accounts, ${counts.budgets} budgets, ${counts.recurring} recurring, ${counts.transactions} transactions.`);
}
async function importSpreadsheet(e) {
  const f = e.target.files?.[0];
  e.target.value = "";
  if (!f) return;
  if (!confirm("Import matching data from this spreadsheet into the current book?")) return;
  try {
    const res = await fetch("/api/import-spreadsheet", { method: "POST", headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }, body: await f.arrayBuffer() });
    const body = await res.json();
    if (!res.ok || !body.ledger) throw new Error(body.message || "Spreadsheet import failed.");
    record();
    mergeLedger(body.ledger);
    save();
    render();
    const c = body.counts || {};
    note(`Spreadsheet import complete: ${c.accounts || 0} accounts, ${c.budgets || 0} budgets, ${c.transactions || 0} transactions.`);
  } catch (error) {
    note(error.message || "Spreadsheet import failed.");
  }
}
async function postDownload(url, name) {
  try {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(exportState()) });
    if (!r.ok) {
      let message = "Export failed.";
      try { message = (await r.json()).message || message; } catch {}
      throw new Error(message);
    }
    download(await r.blob(), name);
  } catch (error) {
    note(error.message || "Export failed.");
  }
}

function progress(b, spent) { const l = limit(b), pct = l ? Math.min(spent / l * 100, 100) : 0; return `<article class="progress-item"><div class="item-row"><div><div class="item-title">${esc(b.category)}</div><div class="item-meta">Budgeted ${money(l)} / Spent ${money(spent)}</div></div><div class="amount ${l - spent < 0 ? "expense" : "income"}">${money(l - spent)}</div></div><div class="progress-track"><div class="progress-fill ${pct >= 100 ? "over" : pct >= 80 ? "warning" : ""}" style="width:${pct}%"></div></div></article>`; }
function bar(label, amount, max) { return `<article class="progress-item"><div class="item-row"><div class="item-title">${esc(label)}</div><div class="amount expense">${money(amount)}</div></div><div class="progress-track"><div class="progress-fill warning" style="width:${Math.max(amount / max * 100, 8)}%"></div></div></article>`; }
function recurringLine(r) { return item(r.name, `${fmt(r.nextDate)} / ${r.cadence}`, `<div class="amount ${r.type}">${r.type === "income" ? "+" : r.type === "expense" ? "-" : ""}${money(r.amount)}</div>`); }
function item(title, meta, action = "", cls = "account-item") { return `<article class="${cls}"><div class="item-row"><div><div class="item-title">${esc(title)}</div><div class="item-meta">${esc(meta)}</div></div><div class="actions">${action}</div></div></article>`; }
function emptyHtml(a = "No entries yet", b = "Your saved items will appear here.") { return `<div class="empty-state"><strong>${a}</strong><span>${b}</span></div>`; }
function upsert(list, row) { const i = list.findIndex((x) => x.id === row.id); i >= 0 ? list[i] = row : list.push(row); }
function sum(list, key = "amount") { return list.reduce((n, x) => n + (+x[key] || 0), 0); }
function opt(v, t) { return `<option value="${esc(v)}">${esc(t)}</option>`; }
function esc(v) { return String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }
function money(v) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(+v || 0); }
function fmt(d) { return new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
function dateInput(d) { return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
function title(v) { return String(v || "").toLowerCase().split(/\s+/).filter(Boolean).map((p) => p[0].toUpperCase() + p.slice(1)).join(" "); }
function stamp() { return new Date().toISOString().slice(0, 10); }
function id() { return crypto.randomUUID(); }
function json(t) { try { return t ? JSON.parse(t) : null; } catch { return null; } }
function bool(v) { return /true|yes|1|reconciled|cleared/i.test(String(v || "")); }
function themes() { return ["classic","slate","forest","berry","ocean","copper","orchid","graphite","mint","ruby","sky","contrast"]; }
function firstImportLedger(imported) { if (imported?.ledger) return imported.ledger; if (imported?.ledgers) return imported.ledgers[imported.activeBookId] || imported.ledgers[Object.keys(imported.ledgers)[0]] || imported; return imported; }
function stateFromImport(imported) {
  if (imported?.users && imported?.books && imported?.ledgers) return imported;
  if (imported?.user && imported?.book && imported?.ledger) return { version: imported.version || 4, theme: imported.theme || "classic", currentMonth: imported.currentMonth || thisMonth, periodMode: imported.periodMode || "month", activeUserId: imported.user.id, activeBookId: imported.book.id, users: [imported.user], books: [imported.book], ledgers: { [imported.book.id]: imported.ledger } };
  const b = base();
  b.ledgers[b.activeBookId] = ledger(imported);
  return b;
}
function accountIdFromName(name) {
  const label = String(name || "").trim();
  if (!label) return "";
  let a = L().accounts.find((x) => x.name.toLowerCase() === label.toLowerCase());
  if (!a) {
    a = account({ name: label });
    L().accounts.push(a);
  }
  return a.id;
}
function mergeLedger(imported) {
  const next = ledger(imported);
  const byAccount = new Map(L().accounts.map((a) => [a.name.toLowerCase(), a]));
  next.accounts.forEach((a) => {
    const existing = byAccount.get(a.name.toLowerCase());
    if (existing) Object.assign(existing, { ...a, id: existing.id });
    else L().accounts.push(a);
  });
  const byBudget = new Map(L().budgets.map((b) => [b.category.toLowerCase(), b]));
  next.budgets.forEach((b) => {
    const existing = byBudget.get(b.category.toLowerCase());
    if (existing) Object.assign(existing, { ...b, id: existing.id });
    else L().budgets.push(b);
  });
  L().recurring.push(...next.recurring);
  L().transactions.push(...next.transactions.map((t) => {
    const importedAccount = next.accounts.find((a) => a.id === t.accountId);
    const importedTo = next.accounts.find((a) => a.id === t.toAccountId);
    return txn({ ...t, accountId: importedAccount ? accountIdFromName(importedAccount.name) : t.accountId, toAccountId: importedTo ? accountIdFromName(importedTo.name) : t.toAccountId });
  }));
}
function csv(v) { return `"${String(v ?? "").replaceAll('"','""')}"`; }
function parseCsv(text) { const rows = []; let row = [], cell = "", q = false; for (let i = 0; i < text.length; i++) { const c = text[i], n = text[i + 1]; if (q && c === '"' && n === '"') { cell += '"'; i++; } else if (c === '"') q = !q; else if (!q && c === ",") { row.push(cell); cell = ""; } else if (!q && (c === "\n" || c === "\r")) { if (c === "\r" && n === "\n") i++; row.push(cell); if (row.some(Boolean)) rows.push(row); row = []; cell = ""; } else cell += c; } row.push(cell); if (row.some(Boolean)) rows.push(row); return rows; }
function download(blob, name) { const a = document.createElement("a"), url = URL.createObjectURL(blob); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url); }
function note(msg) { clearTimeout(toastTimer); el.toast.textContent = msg; el.toast.classList.add("is-visible"); toastTimer = setTimeout(() => el.toast.classList.remove("is-visible"), 2600); }

Object.assign(window, { editTransaction, deleteTransaction, editBudget, deleteBudget, editAccount, deleteAccount, showRegister, toggleCleared, editUser, deleteUser, editBook, deleteBook, editRecurring, deleteRecurring });
