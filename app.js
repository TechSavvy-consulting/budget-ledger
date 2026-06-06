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
const monthStart = (value = thisMonth) => `${value}-01`;
const monthEnd = (value = thisMonth) => dateInput(new Date(new Date(`${value}-01T12:00:00`).getFullYear(), new Date(`${value}-01T12:00:00`).getMonth() + 1, 0, 12));

const el = {};
[
  "activeUserSelect","activeBookSelect","monthFilter","monthSelect","yearInput","prevMonthBtn","nextMonthBtn","todayMonthBtn",
  "periodLabelBtn","periodPickerLabel","monthPickerPanel","pickerPrevYearBtn","pickerNextYearBtn","pickerYearLabel","pickerMonthGrid",
  "addTransactionBtn","transactionAddBtn","recurringAddBtn","viewRecurringBtn","undoBtn","redoBtn","incomeTotal","expenseTotal","remainderTotal","aumTotal",
  "quickTransactionForm","quickClearBtn","quickDate","quickType","quickCategory","quickAccount","quickToAccount","quickAmount","quickDescription",
  "budgetProgress","dailyAverage","dailyBars","searchTransactions","filterType","transactionRows","budgetForm","budgetId","budgetCategory",
  "budgetLimit","budgetPeriod","budgetGroup","budgetSubmitLabel","resetBudgetForm","budgetList","budgetCount","reportPeriodLabel","reportIncome",
  "reportExpense","reportRemaining","reportNetWorth","reportCategories","reportBudgets","reportAccounts","reportUpcoming","reportForecast",
  "assetTotal","debtTotal","netWorthTotal","accountForm","accountId","accountName","accountType","accountValue","accountOwed","accountBalance",
  "accountSubmitLabel","resetAccountForm","accountSummary","accountList","registerAccountSelect","registerBalance","registerRows","reconcileForm",
  "registerStartDate","registerEndDate","registerThisMonthBtn","statementDate","statementBalance","reconcileStatus","reconcileClearedBalance",
  "reconcileOutstanding","reconcileHelp","userForm","userId","userName","userEmail","userPassword","userPasswordConfirm","userSubmitLabel","resetUserForm","userCount",
  "userList","bookForm","bookId","bookName","bookOwner","bookSubmitLabel","resetBookForm","bookCount","bookList","shareForm","shareUserSelect",
  "shareList","themeSelect","exportCsvBtn","exportJsonBtn","importJsonBtn","importJsonFile","importCsvBtn","importCsvFile","exportWorkbookBtn",
  "backupZipBtn","addDemoBtn","deleteDemoBtn","recurringForm","recurringId","recurringName","recurringType","recurringAccount","recurringToAccount",
  "recurringCategory","recurringAmount","recurringCadence","recurringNextDate","recurringSubmitLabel","resetRecurringForm","postDueRecurringBtn","recurringDialog","recurringDialogTitle","closeRecurringDialog",
  "recurringList","transactionDialog","transactionForm","transactionDialogTitle","closeTransactionDialog","transactionId","txnDate","txnType",
  "txnPayee","txnAccount","txnToAccount","txnCategory","txnAmount","txnDescription","txnNotes","txnPayPeriod","txnCleared","txnSubmitLabel",
  "addSplitBtn","splitRows","splitStatus","emptyStateTemplate","toast"
].forEach((id) => { el[id] = $(id); });

let state = normalize(load());
init();

function init() {
  document.body.dataset.theme = state.theme;
  applyLoginSelection();
  bind();
  resetAll();
  syncMonth(state.currentMonth);
  setPeriod(state.periodMode, false);
  ensureAccess();
  render();
  hydrate();
}

function bind() {
  el.activeUserSelect.onchange = () => { state.activeUserId = el.activeUserSelect.value; ensureAccess(); save(); render(); };
  el.activeBookSelect.onchange = () => { state.activeBookId = el.activeBookSelect.value; save(); render(); };
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
  el.budgetForm.onsubmit = saveBudget;
  el.resetBudgetForm.onclick = resetBudget;
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
  el.shareForm.onsubmit = shareBook;
  el.themeSelect.onchange = () => { record(); state.theme = el.themeSelect.value; document.body.dataset.theme = state.theme; save(); };
  el.exportCsvBtn.onclick = exportCsv;
  el.exportJsonBtn.onclick = exportJson;
  el.importJsonBtn.onclick = () => el.importJsonFile.click();
  el.importJsonFile.onchange = importJson;
  el.importCsvBtn.onclick = () => el.importCsvFile.click();
  el.importCsvFile.onchange = importCsv;
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
    users: [{ id: uid, name: "Personal", email: "" }],
    books: [{ id: bid, name: "Household Budget", ownerUserId: uid, sharedUserIds: [] }],
    ledgers: { [bid]: ledger({ transactions: starters(), accounts: accounts() }) }
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
  s.theme = ["classic", "slate", "forest", "berry"].includes(s.theme) ? s.theme : "classic";
  s.periodMode = ["week", "month", "year"].includes(s.periodMode) ? s.periodMode : "month";
  s.users = Array.isArray(s.users) && s.users.length ? s.users.map(user) : b.users;
  s.books = Array.isArray(s.books) && s.books.length ? s.books.map((x) => book(x, s.users[0].id)) : b.books;
  s.ledgers = s.ledgers && typeof s.ledgers === "object" ? s.ledgers : b.ledgers;
  s.books.forEach((bk) => s.ledgers[bk.id] = ledger(s.ledgers[bk.id] || {}));
  if (!s.users.some((u) => u.id === s.activeUserId)) s.activeUserId = s.users[0].id;
  if (!s.books.some((bk) => bk.id === s.activeBookId)) s.activeBookId = s.books[0].id;
  s.activeRegisterAccountId ||= "";
  s.registerStartDate = /^\d{4}-\d{2}-\d{2}$/.test(s.registerStartDate || "") ? s.registerStartDate : monthStart(s.currentMonth || thisMonth);
  s.registerEndDate = /^\d{4}-\d{2}-\d{2}$/.test(s.registerEndDate || "") ? s.registerEndDate : monthEnd(s.currentMonth || thisMonth);
  return s;
}

function applyLoginSelection() {
  try {
    const selection = JSON.parse(sessionStorage.getItem("budget-ledger-open-selection") || "null");
    sessionStorage.removeItem("budget-ledger-open-selection");
    if (!selection) return;
    if (state.users.some((u) => u.id === selection.userId)) state.activeUserId = selection.userId;
    if (state.books.some((b) => b.id === selection.bookId)) state.activeBookId = selection.bookId;
  } catch {}
}

function ledger(x = {}) {
  return {
    transactions: Array.isArray(x.transactions) ? x.transactions.map(txn) : [],
    budgets: Array.isArray(x.budgets) ? x.budgets.map(budget) : budgets(),
    accounts: Array.isArray(x.accounts) ? x.accounts.map(account) : accounts(),
    recurring: Array.isArray(x.recurring) ? x.recurring.map(recurring) : []
  };
}

function user(x = {}) { return { id: x.id || id(), name: x.name || "User", email: x.email || "", demo: !!x.demo }; }
function book(x = {}, owner) { return { id: x.id || id(), name: x.name || "Budget Book", ownerUserId: x.ownerUserId || owner, sharedUserIds: Array.isArray(x.sharedUserIds) ? x.sharedUserIds : [], demo: !!x.demo }; }
function txn(x = {}) { return { id: x.id || id(), date: x.date || today, type: ["expense","income","transfer"].includes(x.type) ? x.type : "expense", payee: x.payee || "", accountId: x.accountId || "", toAccountId: x.toAccountId || "", category: x.category || "Other", description: x.description || x.payee || "Transaction", amount: +x.amount || 0, cleared: !!x.cleared, reconciled: !!x.reconciled, payPeriod: x.payPeriod || "none", notes: x.notes || "", splits: Array.isArray(x.splits) ? x.splits.map(split) : [], demo: !!x.demo }; }
function split(x = {}) { return { id: x.id || id(), category: x.category || "Other", amount: +x.amount || 0, memo: x.memo || "", type: x.type || "expense" }; }
function budget(x = {}) { return { id: x.id || id(), category: x.category || "Other", monthlyLimit: +x.monthlyLimit || 0, period: ["week","month","year"].includes(x.period) ? x.period : "month", group: x.group || "expense", demo: !!x.demo }; }
function account(x = {}) { const type = x.type === "liability" ? "liability" : "asset", value = +x.value || 0, owed = +x.owed || 0, openingBalance = +(x.openingBalance ?? x.balance ?? (type === "asset" ? value - owed : owed || value)) || 0; return { id: x.id || id(), name: x.name || "Account", type, value, owed, openingBalance, balance: openingBalance, statementDate: x.statementDate || "", statementBalance: +x.statementBalance || 0, demo: !!x.demo }; }
function recurring(x = {}) { return { id: x.id || id(), name: x.name || x.description || "Recurring item", type: ["expense","income","transfer"].includes(x.type) ? x.type : "expense", accountId: x.accountId || "", toAccountId: x.toAccountId || "", category: x.category || "Other", amount: +x.amount || 0, cadence: ["weekly","biweekly","monthly","yearly"].includes(x.cadence) ? x.cadence : "monthly", nextDate: x.nextDate || today, active: x.active !== false, demo: !!x.demo }; }
function budgets() { return ["Giving","Savings","Utilities","Debt Payment","Fuel","Grocery","Entertainment","Health","Travel","Other"].map((category) => budget({ category, monthlyLimit: category === "Grocery" ? 650 : 250 })); }
function accounts() { return [account({ name: "Checking" }), account({ name: "Savings" }), account({ name: "Credit Card", type: "liability" })]; }
function starters() { return [txn({ date: today, type: "income", category: "Income", description: "Example paycheck", amount: 2500, cleared: true }), txn({ date: today, type: "expense", category: "Grocery", description: "Example grocery run", amount: 86.42, cleared: true })]; }

function L() { return state.ledgers[state.activeBookId] || ledger(); }
function currentBook() { return state.books.find((x) => x.id === state.activeBookId) || state.books[0]; }
function accessible() { return state.books.filter((x) => x.ownerUserId === state.activeUserId || x.sharedUserIds.includes(state.activeUserId)); }
function ensureAccess() { const list = accessible(); if (!list.some((x) => x.id === state.activeBookId)) state.activeBookId = list[0]?.id || state.books[0]?.id; }

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
      localStorage.setItem(KEY, JSON.stringify(state));
      document.body.dataset.theme = state.theme;
      syncMonth(state.currentMonth);
      setPeriod(state.periodMode, false);
      render();
      note("Server data loaded.");
    } else syncServer();
  } catch { syncReady = false; }
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
  el.activeUserSelect.innerHTML = state.users.map((x) => opt(x.id, x.name)).join("");
  el.activeUserSelect.value = state.activeUserId;
  el.activeBookSelect.innerHTML = accessible().map((x) => opt(x.id, x.name)).join("");
  el.activeBookSelect.value = state.activeBookId;
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
  const list = L().budgets;
  el.budgetCount.textContent = `${list.length} categories`;
  el.budgetProgress.innerHTML = list.map((b) => progress(b, spent[b.category] || 0)).join("") || emptyHtml();
  el.budgetList.innerHTML = list.map((b) => item(b.category, `${b.group} / ${money(b.monthlyLimit)} ${b.period}`, `<button class="row-button" onclick="editBudget('${b.id}')">Edit</button><button class="row-button danger" onclick="deleteBudget('${b.id}')">Delete</button>`)).join("") || emptyHtml();
}

function renderTransactions() {
  const q = el.searchTransactions.value.toLowerCase(), type = el.filterType.value;
  const rows = periodTxns().filter((x) => (type === "all" || x.type === type) && `${x.date} ${x.payee} ${x.description} ${x.category}`.toLowerCase().includes(q)).sort((a, b) => b.date.localeCompare(a.date));
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
  const upcomingHtml = up.map((r) => item(r.name, `${fmt(r.nextDate)} / ${r.cadence}`, `<div class="amount ${r.type}">${r.type === "income" ? "+" : r.type === "expense" ? "-" : ""}${money(r.amount)}</div>`)).join("") || emptyHtml();
  el.reportAccounts.innerHTML = accountHtml;
  el.reportForecast.textContent = `${money(cash)} forecast`;
  el.reportUpcoming.innerHTML = upcomingHtml;
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
  el.bookOwner.innerHTML = state.users.map((u) => opt(u.id, u.name)).join("");
  el.bookOwner.value = state.activeUserId;
  el.userCount.textContent = `${state.users.length} users`;
  el.userList.innerHTML = state.users.map((u) => item(u.name, u.email || "No email", `<button class="row-button" onclick="editUser('${u.id}')">Edit</button><button class="row-button danger" onclick="deleteUser('${u.id}')">Delete</button>`, "user-item")).join("");
  el.bookCount.textContent = `${state.books.length} books`;
  el.bookList.innerHTML = state.books.map((b) => item(b.name, `Owner: ${state.users.find((u) => u.id === b.ownerUserId)?.name || "Unknown"}`, `<button class="row-button" onclick="editBook('${b.id}')">Edit</button><button class="row-button danger" onclick="deleteBook('${b.id}')">Delete</button>`, "book-item")).join("");
  const bk = currentBook(), shared = bk.sharedUserIds.map((id) => state.users.find((u) => u.id === id)).filter(Boolean);
  el.shareUserSelect.innerHTML = state.users.filter((u) => u.id !== bk.ownerUserId && !bk.sharedUserIds.includes(u.id)).map((u) => opt(u.id, u.name)).join("");
  el.shareForm.querySelector("button").disabled = !el.shareUserSelect.options.length;
  el.shareList.innerHTML = `<div class="share-summary"><div><div class="item-title">${esc(bk.name)}</div><div class="item-meta">Owner: ${esc(state.users.find((u) => u.id === bk.ownerUserId)?.name || "Unknown")}</div></div>${shared.map((u) => `<div class="share-chip"><span>${esc(u.name)}</span><button class="row-button danger" onclick="unshareBook('${bk.id}','${u.id}')">Remove</button></div>`).join("") || `<div class="item-meta">Not shared yet.</div>`}</div>`;
}
function renderRecurring() {
  el.recurringList.innerHTML = L().recurring.slice().sort((a, b) => a.nextDate.localeCompare(b.nextDate)).map((r) => item(r.name, `${r.type} / ${r.cadence} / next ${fmt(r.nextDate)}`, `<div class="amount ${r.type}">${money(r.amount)}</div><div class="actions"><button class="row-button" onclick="editRecurring('${r.id}')">Edit</button><button class="row-button danger" onclick="deleteRecurring('${r.id}')">Delete</button></div>`, "recurring-item")).join("") || emptyHtml();
}

function resetAll() { resetQuick(); resetBudget(); resetAccount(); resetUser(); resetBook(); resetRecurring(); resetTxn(); }
function resetQuick() { el.quickDate.value = today; el.quickType.value = "expense"; el.quickAmount.value = ""; el.quickDescription.value = ""; }
function resetBudget() { el.budgetId.value = ""; el.budgetCategory.value = ""; el.budgetLimit.value = ""; el.budgetPeriod.value = "month"; el.budgetGroup.value = "expense"; el.budgetSubmitLabel.textContent = "Save Budget"; }
function resetAccount() { el.accountId.value = ""; el.accountName.value = ""; el.accountType.value = "asset"; el.accountValue.value = ""; el.accountOwed.value = ""; el.accountBalance.value = ""; el.accountSubmitLabel.textContent = "Save Account"; }
function resetUser() { el.userId.value = ""; el.userName.value = ""; el.userEmail.value = ""; el.userPassword.value = ""; el.userPasswordConfirm.value = ""; el.userSubmitLabel.textContent = "Add User"; }
function resetBook() { el.bookId.value = ""; el.bookName.value = ""; el.bookOwner.value = state.activeUserId; el.bookSubmitLabel.textContent = "Add Book"; }
function resetRecurring() { el.recurringId.value = ""; el.recurringName.value = ""; el.recurringType.value = "expense"; el.recurringAmount.value = ""; el.recurringCadence.value = "monthly"; el.recurringNextDate.value = today; el.recurringSubmitLabel.textContent = "Save Recurring"; }
function resetTxn() { el.transactionId.value = ""; el.txnDate.value = today; el.txnType.value = "expense"; el.txnPayee.value = ""; el.txnAccount.value = ""; el.txnToAccount.value = ""; el.txnCategory.value = L().budgets[0]?.category || "Other"; el.txnAmount.value = ""; el.txnDescription.value = ""; el.txnNotes.value = ""; el.txnPayPeriod.value = "none"; el.txnCleared.checked = false; el.splitRows.innerHTML = ""; el.txnSubmitLabel.textContent = "Save Transaction"; }

function saveQuickTxn(e) { e.preventDefault(); const t = txn({ date: el.quickDate.value, type: el.quickType.value, category: el.quickCategory.value, accountId: el.quickAccount.value, toAccountId: el.quickToAccount.value, amount: el.quickAmount.value, description: el.quickDescription.value.trim() }); if (validTxn(t)) { record(); L().transactions.push(t); save(); resetQuick(); render(); note("Transaction added."); } }
function openTxn(t = null) { resetTxn(); renderOptions(); if (t) fillTxn(t); el.transactionDialogTitle.textContent = t ? "Edit Transaction" : "Add Transaction"; el.transactionDialog.showModal(); }
function fillTxn(t) { el.transactionId.value = t.id; el.txnDate.value = t.date; el.txnType.value = t.type; el.txnPayee.value = t.payee; el.txnAccount.value = t.accountId; el.txnToAccount.value = t.toAccountId; el.txnCategory.value = t.category; el.txnAmount.value = t.amount; el.txnDescription.value = t.description; el.txnNotes.value = t.notes; el.txnPayPeriod.value = t.payPeriod; el.txnCleared.checked = t.cleared; t.splits.forEach(addSplit); el.txnSubmitLabel.textContent = "Update Transaction"; }
function saveTxn(e) { e.preventDefault(); const old = L().transactions.find((x) => x.id === el.transactionId.value), t = txn({ id: el.transactionId.value || id(), date: el.txnDate.value, type: el.txnType.value, payee: el.txnPayee.value.trim(), accountId: el.txnAccount.value, toAccountId: el.txnToAccount.value, category: el.txnCategory.value, amount: el.txnAmount.value, description: el.txnDescription.value.trim(), notes: el.txnNotes.value.trim(), payPeriod: el.txnPayPeriod.value, cleared: el.txnCleared.checked, reconciled: old?.reconciled, splits: readSplits() }); if (!validTxn(t)) return; record(); upsert(L().transactions, t); save(); render(); el.transactionDialog.close(); }
function validTxn(t) { if (!t.description || !t.amount) return note("Add a description and amount first."), false; if (t.type === "transfer" && (!t.accountId || !t.toAccountId || t.accountId === t.toAccountId)) return note("Transfers need two different accounts."), false; return true; }
function editTransaction(id) { const t = L().transactions.find((x) => x.id === id); if (t) openTxn(t); }
function deleteTransaction(id) { if (confirm("Delete transaction?")) { record(); L().transactions = L().transactions.filter((x) => x.id !== id); save(); render(); } }
function addSplit(x = {}) { const row = document.createElement("div"); row.className = "split-row"; row.innerHTML = `<select class="split-category"></select><input class="split-amount" type="number" min="0" step="0.01" placeholder="Amount"><input class="split-memo" maxlength="80" placeholder="Memo"><button class="row-button danger" type="button">Remove</button>`; el.splitRows.append(row); renderOptions(); row.querySelector(".split-category").value = x.category || L().budgets[0]?.category || "Other"; row.querySelector(".split-amount").value = x.amount || ""; row.querySelector(".split-memo").value = x.memo || ""; row.querySelector(".split-amount").oninput = splitStatus; row.querySelector("button").onclick = () => { row.remove(); splitStatus(); }; }
function readSplits() { return $$(".split-row").map((r) => split({ category: r.querySelector(".split-category").value, amount: r.querySelector(".split-amount").value, memo: r.querySelector(".split-memo").value })).filter((x) => x.amount > 0); }
function splitStatus() { const total = sum(readSplits()), amount = +el.txnAmount.value || 0; el.splitStatus.textContent = total ? `Split total ${money(total)} / Remaining ${money(amount - total)}` : "No splits"; el.splitStatus.classList.toggle("is-error", total && Math.abs(amount - total) > .009); }

function saveBudget(e) { e.preventDefault(); const b = budget({ id: el.budgetId.value || id(), category: title(el.budgetCategory.value), monthlyLimit: el.budgetLimit.value, period: el.budgetPeriod.value, group: el.budgetGroup.value }); record(); upsert(L().budgets, b); save(); resetBudget(); render(); }
function editBudget(id) { const b = L().budgets.find((x) => x.id === id); if (!b) return; el.budgetId.value = b.id; el.budgetCategory.value = b.category; el.budgetLimit.value = b.monthlyLimit; el.budgetPeriod.value = b.period; el.budgetGroup.value = b.group; el.budgetSubmitLabel.textContent = "Update Budget"; }
function deleteBudget(id) { if (confirm("Delete budget?")) { record(); L().budgets = L().budgets.filter((x) => x.id !== id); save(); render(); } }
function saveAccount(e) { e.preventDefault(); const a = account({ id: el.accountId.value || id(), name: el.accountName.value.trim(), type: el.accountType.value, value: el.accountValue.value, owed: el.accountOwed.value, openingBalance: el.accountBalance.value }); record(); upsert(L().accounts, a); save(); resetAccount(); render(); }
function editAccount(id) { const a = L().accounts.find((x) => x.id === id); if (!a) return; el.accountId.value = a.id; el.accountName.value = a.name; el.accountType.value = a.type; el.accountValue.value = a.value || ""; el.accountOwed.value = a.owed || ""; el.accountBalance.value = a.openingBalance; el.accountSubmitLabel.textContent = "Update Account"; }
function deleteAccount(id) { if (confirm("Delete account?")) { record(); L().accounts = L().accounts.filter((x) => x.id !== id); save(); render(); } }
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
  const u = user({ id: el.userId.value || id(), name: el.userName.value.trim(), email: el.userEmail.value.trim() });
  if (!u.name || !u.email) return note("Add a name and login username.");
  if (!old && !password) return note("Add a password for the new login.");
  if (password && password.length < 8) return note("Use at least 8 characters for passwords.");
  if (password !== confirm) return note("Passwords do not match.");
  const authSaved = await saveAuthUser(old?.email || u.email, u.email, password);
  if (!authSaved) return;
  record();
  if (!el.userId.value) { const b = book({ name: `${u.name}'s Budget`, ownerUserId: u.id }, u.id); state.users.push(u); state.books.push(b); state.ledgers[b.id] = ledger(); }
  else upsert(state.users, u);
  save();
  resetUser();
  render();
  note("User saved.");
}
function editUser(id) { const u = state.users.find((x) => x.id === id); if (!u) return; el.userId.value = u.id; el.userName.value = u.name; el.userEmail.value = u.email; el.userPassword.value = ""; el.userPasswordConfirm.value = ""; el.userSubmitLabel.textContent = "Update User"; showTab("settings"); }
async function saveAuthUser(previousUsername, username, password) {
  try {
    const res = await fetch("/api/auth/users", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ previousUsername, username, password }) });
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
async function deleteUser(id) { if (state.users.length < 2) return note("Keep at least one user."); if (confirm("Delete user and owned books?")) { record(); const removed = state.users.find((u) => u.id === id); const owned = state.books.filter((b) => b.ownerUserId === id).map((b) => b.id); state.users = state.users.filter((u) => u.id !== id); state.books = state.books.filter((b) => b.ownerUserId !== id).map((b) => ({ ...b, sharedUserIds: b.sharedUserIds.filter((x) => x !== id) })); owned.forEach((x) => delete state.ledgers[x]); state.activeUserId = state.users[0].id; ensureAccess(); save(); await deleteAuthUser(removed?.email); render(); } }
function saveBook(e) { e.preventDefault(); const b = book({ id: el.bookId.value || id(), name: el.bookName.value.trim(), ownerUserId: el.bookOwner.value }, state.activeUserId); if (!b.name) return; record(); if (!el.bookId.value) { state.books.push(b); state.ledgers[b.id] = ledger(); state.activeBookId = b.id; } else upsert(state.books, { ...b, sharedUserIds: currentBook().sharedUserIds.filter((x) => x !== b.ownerUserId) }); save(); resetBook(); render(); }
function editBook(id) { const b = state.books.find((x) => x.id === id); if (!b) return; el.bookId.value = b.id; el.bookName.value = b.name; el.bookOwner.value = b.ownerUserId; el.bookSubmitLabel.textContent = "Update Book"; showTab("settings"); }
function deleteBook(id) { if (state.books.length < 2) return note("Keep at least one book."); if (confirm("Delete book?")) { record(); state.books = state.books.filter((b) => b.id !== id); delete state.ledgers[id]; ensureAccess(); save(); render(); } }
function shareBook(e) { e.preventDefault(); const u = el.shareUserSelect.value, b = currentBook(); if (u && !b.sharedUserIds.includes(u)) { record(); b.sharedUserIds.push(u); save(); render(); } }
function unshareBook(bid, uid) { const b = state.books.find((x) => x.id === bid); if (b) { record(); b.sharedUserIds = b.sharedUserIds.filter((x) => x !== uid); save(); render(); } }

function openRecurring(r = null) { resetRecurring(); renderOptions(); if (r) { ["Id","Name","Type","Account","ToAccount","Category","Amount","Cadence","NextDate"].forEach((k) => { const key = `recurring${k}`; if (el[key]) el[key].value = r[k.charAt(0).toLowerCase() + k.slice(1)] || ""; }); el.recurringSubmitLabel.textContent = "Update Recurring"; el.recurringDialogTitle.textContent = "Edit Recurring Transaction"; } else { el.recurringDialogTitle.textContent = "Add Recurring Transaction"; } el.recurringDialog.showModal(); }
function viewRecurringList() { showTab("transactions"); el.recurringList.scrollIntoView({ behavior: "smooth", block: "start" }); }
function saveRecurring(e) { e.preventDefault(); const r = recurring({ id: el.recurringId.value || id(), name: el.recurringName.value.trim(), type: el.recurringType.value, accountId: el.recurringAccount.value, toAccountId: el.recurringToAccount.value, category: el.recurringCategory.value, amount: el.recurringAmount.value, cadence: el.recurringCadence.value, nextDate: el.recurringNextDate.value }); if (!r.name || !r.amount) return; if (r.type === "transfer" && (!r.accountId || !r.toAccountId || r.accountId === r.toAccountId)) return note("Recurring transfers need two different accounts."); record(); upsert(L().recurring, r); save(); resetRecurring(); el.recurringDialog.close(); render(); viewRecurringList(); }
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
  if (!confirm("Delete all budget, ledger, user, book, and account data?")) return;
  record();
  state = normalize(base());
  save();
  render();
  note("All data reset.");
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
function record() { undo.push(JSON.stringify(state)); if (undo.length > 5) undo.shift(); redo = []; }
function restore(s) { state = normalize(JSON.parse(s)); syncMonth(state.currentMonth); document.body.dataset.theme = state.theme; save(); render(); }
function undoLast() { if (undo.length) { redo.push(JSON.stringify(state)); restore(undo.pop()); } }
function redoLast() { if (redo.length) { undo.push(JSON.stringify(state)); restore(redo.pop()); } }
function exportJson() { download(new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }), `budget-ledger-backup-${stamp()}.json`); }
function exportCsv() { const rows = [["book","date","type","payee","description","account","toAccount","category","amount","cleared","reconciled","notes"], ...L().transactions.map((t) => [currentBook().name,t.date,t.type,t.payee,t.description,L().accounts.find((a) => a.id === t.accountId)?.name || "",L().accounts.find((a) => a.id === t.toAccountId)?.name || "",t.category,t.amount,t.cleared,t.reconciled,t.notes])]; download(new Blob([rows.map((r) => r.map(csv).join(",")).join("\n")], { type: "text/csv" }), `budget-ledger-${stamp()}.csv`); }
async function importJson(e) { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; try { const next = normalize(JSON.parse(await f.text())); if (confirm("Replace current ledger data?")) { record(); state = next; save(); render(); } } catch { note("Could not import JSON."); } }
async function importCsv(e) { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; const rows = parseCsv(await f.text()); if (rows.length < 2) return; const head = rows[0].map((x) => x.toLowerCase()), get = (r, k) => r[head.indexOf(k)] || ""; record(); rows.slice(1).forEach((r) => L().transactions.push(txn({ date: get(r,"date"), type: get(r,"type"), payee: get(r,"payee"), description: get(r,"description"), category: get(r,"category"), amount: get(r,"amount"), cleared: /true|yes|1/i.test(get(r,"cleared")) }))); save(); render(); }
async function postDownload(url, name) { try { const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(state) }); if (!r.ok) throw 0; download(await r.blob(), name); } catch { note("Export failed."); } }

function progress(b, spent) { const l = limit(b), pct = l ? Math.min(spent / l * 100, 100) : 0; return `<article class="progress-item"><div class="item-row"><div><div class="item-title">${esc(b.category)}</div><div class="item-meta">Budgeted ${money(l)} / Spent ${money(spent)}</div></div><div class="amount ${l - spent < 0 ? "expense" : "income"}">${money(l - spent)}</div></div><div class="progress-track"><div class="progress-fill ${pct >= 100 ? "over" : pct >= 80 ? "warning" : ""}" style="width:${pct}%"></div></div></article>`; }
function bar(label, amount, max) { return `<article class="progress-item"><div class="item-row"><div class="item-title">${esc(label)}</div><div class="amount expense">${money(amount)}</div></div><div class="progress-track"><div class="progress-fill warning" style="width:${Math.max(amount / max * 100, 8)}%"></div></div></article>`; }
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
function csv(v) { return `"${String(v ?? "").replaceAll('"','""')}"`; }
function parseCsv(text) { const rows = []; let row = [], cell = "", q = false; for (let i = 0; i < text.length; i++) { const c = text[i], n = text[i + 1]; if (q && c === '"' && n === '"') { cell += '"'; i++; } else if (c === '"') q = !q; else if (!q && c === ",") { row.push(cell); cell = ""; } else if (!q && (c === "\n" || c === "\r")) { if (c === "\r" && n === "\n") i++; row.push(cell); if (row.some(Boolean)) rows.push(row); row = []; cell = ""; } else cell += c; } row.push(cell); if (row.some(Boolean)) rows.push(row); return rows; }
function download(blob, name) { const a = document.createElement("a"), url = URL.createObjectURL(blob); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url); }
function note(msg) { clearTimeout(toastTimer); el.toast.textContent = msg; el.toast.classList.add("is-visible"); toastTimer = setTimeout(() => el.toast.classList.remove("is-visible"), 2600); }

Object.assign(window, { editTransaction, deleteTransaction, editBudget, deleteBudget, editAccount, deleteAccount, showRegister, toggleCleared, editUser, deleteUser, editBook, deleteBook, unshareBook, editRecurring, deleteRecurring });
